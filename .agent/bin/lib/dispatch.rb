# The dispatcher behind .agent/bin/dispatch.sh (KIT-004). Read that file's
# header for usage. Ruby 2.6 (the macOS system Ruby): no newer syntax.
require "yaml"
require "json"
require "shellwords"
require "fileutils"
require "open3"
require "securerandom"

module Dispatch
  EXIT_REFUSED = 2
  EXIT_BLOCKED = 3
  EXIT_NO_VERDICT = 4
  RATE_LIMIT = /rate[ _-]?limit|quota|usage limit|too many requests|\b429\b/i

  class Refused < StandardError; end

  def self.refuse(msg)
    raise Refused, msg
  end

  def self.git(*args, dir: nil)
    cmd = ["git"] + (dir ? ["-C", dir] : []) + args
    out, status = Open3.capture2e(*cmd)
    [out.strip, status.success?]
  end

  def self.frontmatter(text)
    return {} unless text.to_s.start_with?("---")
    YAML.safe_load(text.split(/^---\s*$/, 3)[1].to_s) || {}
  end

  # ---------------------------------------------------------------- options
  Options = Struct.new(:id, :role, :profile, :resume, :message, :dry_run, :mode, :keep_pane)

  def self.parse(argv)
    o = Options.new
    args = argv.dup
    o.id = args.shift
    refuse "usage: dispatch.sh <TASK-ID> [--role <r>] [--profile <p>] [--mode interactive|oneshot] [--resume [--message <text>]] [--keep-pane] [--dry-run]" if o.id.nil? || o.id.start_with?("-")
    until args.empty?
      a = args.shift
      case a
      when "--role" then o.role = args.shift or refuse("--role needs a value")
      when "--profile" then o.profile = args.shift or refuse("--profile needs a value")
      when "--message" then o.message = args.shift or refuse("--message needs a value")
      when "--mode" then o.mode = args.shift or refuse("--mode needs a value")
      when "--keep-pane" then o.keep_pane = true
      when "--resume" then o.resume = true
      when "--dry-run" then o.dry_run = true
      else refuse "unknown argument #{a}"
      end
    end
    o
  end

  # ------------------------------------------------------------------ plan
  class Plan
    attr_reader :o, :cfg, :root, :main, :task_path, :task_rel, :fm, :category, :touches,
                :role, :profile_name, :profile, :cli, :worktree, :branch, :run_dir,
                :notes, :pane_name, :mode, :agent_name

    def initialize(o)
      @o = o
      @worktree = nil
      @root, ok = Dispatch.git("rev-parse", "--show-toplevel")
      Dispatch.refuse "not inside a git checkout" unless ok
      common, = Dispatch.git("rev-parse", "--path-format=absolute", "--git-common-dir")
      @git_common_dir = common
      @main = File.dirname(common)                     # the main checkout
      @cfg = YAML.load_file(File.join(@root, ".agent/agents.yaml"))
      @notes = []
      wt_root = File.expand_path(@cfg.dig("dispatch", "worktree_root") || "../restaurant-pos-wt", @main)
      @worktree = File.join(wt_root, o.id)
      load_task
      resolve_role
      resolve_profile
      resolve_mode
      @branch = "agent/#{o.id.downcase}"
      @run_dir = File.join(@main, ".agent/runs", o.id, @role)
      @pane_name = @role == "reviewer" ? "#{o.id}-review" : o.id
      @agent_name = @pane_name.downcase               # Herdr agent names are lowercase
    end

    # First match wins: --mode, the task's mode:, roles.<role>.mode (KIT-005).
    def resolve_mode
      m = (@o.mode || @fm["mode"] || @cfg.dig("roles", @role, "mode") || "oneshot").to_s
      Dispatch.refuse "mode '#{m}' is neither interactive nor oneshot" unless %w[interactive oneshot].include?(m)
      if m == "interactive" && !@cfg.dig("launch", @cli, "interactive")
        why = @cfg.dig("launch", @cli, "interactive_refused") || "agents.yaml has no launch.#{@cli}.interactive"
        Dispatch.refuse "interactive #{@cli} is not supported: #{why}. Use --mode oneshot."
      end
      @mode = m
    end

    def load_task
      find = lambda do |dir|
        Dir.glob(File.join(dir, ".agent/tasks", "#{@o.id}-*.md")) + Dir.glob(File.join(dir, ".agent/tasks", "#{@o.id}.md"))
      end
      matches = find.call(@root)
      if matches.empty? && File.directory?(@worktree)      # after dispatch the task may exist only on its branch
        matches = find.call(@worktree).map { |m| m.sub(@worktree, @root) }
      end
      Dispatch.refuse "no task file .agent/tasks/#{@o.id}-*.md in #{@root}" if matches.empty?
      Dispatch.refuse "more than one task file for #{@o.id}: #{matches.map { |m| File.basename(m) }.join(', ')}" if matches.size > 1
      @task_path = matches.first
      @task_rel = @task_path.sub(@root + "/", "")
      # Once the task has a worktree, its copy there is the one the worker and
      # the reviewer read, so status and routing come from it (FE-029 pilot).
      wt_copy = File.join(@worktree, @task_rel)
      if File.exist?(wt_copy)
        @notes << "task read from the worktree copy, #{wt_copy}"
        @task_path = wt_copy
      end
      @fm = Dispatch.frontmatter(File.read(@task_path))
      Dispatch.refuse "#{@task_rel} has no frontmatter; dispatch reads category, touches, depends_on and owns from it" if @fm.empty?
      @category = @fm["category"]
      Dispatch.refuse "#{@task_rel}: category '#{@category}' is not in agents.yaml routing" unless @cfg["routing"].key?(@category.to_s)
      @touches = Array(@fm["touches"]).map(&:to_s)
    end

    def resolve_role
      route = @cfg["routing"][@category]
      @role = @o.role || route["build"] || route["spec"]
      return if Array(@cfg.dig("dispatch", "roles")).include?(@role)
      why = case @role
            when "lead" then "the lead builds '#{@category}' tasks itself"
            when "architect", "designer" then "the #{@role} works with the owner in a pane opened by hand"
            else "roles.#{@role} is not in dispatch.roles"
            end
      Dispatch.refuse "category '#{@category}' routes to #{@role}: not dispatched, because #{why}"
    end

    def global_preset
      f = File.join(@main, ".agent/profile")
      File.exist?(f) ? File.read(f).strip : nil
    end

    # First match wins: --profile, the task's profile:, .agent/profile, the role's default.
    def builder_profile(role_name, explicit)
      spec = @cfg.dig("roles", role_name)
      profiles = spec["profiles"] || {}
      name = explicit || @fm["profile"]
      if name.nil?
        preset = global_preset
        name = preset if preset && (preset == "default" || profiles.key?(preset))
        @notes << "global preset '#{preset}' ignored: roles.#{role_name} has no such profile" if preset && name.nil?
      end
      name ||= "default"
      prof = name == "default" ? spec["default"] : profiles[name]
      Dispatch.refuse "roles.#{role_name} has no profile '#{name}'" unless prof
      [name, prof]
    end

    def resolve_profile
      if @role == "reviewer"
        built = recorded_builder_cli
        _, bprof = built ? [nil, { "cli" => built }] : builder_profile("builder", nil)
        family = @cfg["families"][bprof["cli"]] or Dispatch.refuse "no family for CLI #{bprof['cli']}"
        strength = @cfg.dig("routing", @category, "review_strength") || "strong"
        strength = "strong" unless (@touches & Array(@cfg["escalate_touches"])).empty?
        @profile = @cfg.dig("roles", "reviewer", "pick", family, strength) or
          Dispatch.refuse "no reviewer.pick.#{family}.#{strength}"
        @profile_name = "pick #{family}/#{strength} (builder on #{bprof['cli']}#{built ? ', recorded' : ', resolved'})"
        Dispatch.refuse "--profile does not apply to the reviewer; it follows the builder's family" if @o.profile
      else
        @profile_name, @profile = builder_profile(@role, @o.profile)
      end
      @cli = @profile["cli"]
      Dispatch.refuse "no launch.#{@cli} in agents.yaml" unless @cfg.dig("launch", @cli)
      if ENV["DISPATCH_TEST_MODEL"].to_s != ""
        @notes << "TEST ONLY: model #{@profile['model']} replaced by #{ENV['DISPATCH_TEST_MODEL']} (DISPATCH_TEST_MODEL)"
        @profile = @profile.merge("model" => ENV["DISPATCH_TEST_MODEL"])
      end
    end

    def recorded_builder_cli
      meta = File.join(@main, ".agent/runs", @o.id, "builder", "meta.json")
      File.exist?(meta) ? JSON.parse(File.read(meta))["cli"] : nil
    end

    def fallback_plan
      name = @cfg.dig("roles", @role, "fallback")
      return nil unless name && @role != "reviewer" && name != @profile_name
      o2 = @o.dup
      o2.profile = name
      o2.resume = false
      o2.mode = @mode
      Plan.new(o2)
    end

    # ------------------------------------------------------------ the launch
    def caveman_off?
      # YAML 1.1 reads a bare `off` as false, so both spellings mean off.
      return true if [false, "off"].include?(@cfg.dig("roles", @role, "caveman"))
      w = @cfg["caveman_off_when"] || {}
      Array(w["categories"]).include?(@category) || !(@touches & Array(w["touches"])).empty?
    end

    def gated_off
      Array(@cfg["gated_mcps"]) - Array(@cfg.dig("roles", @role, "mcps"))
    end

    def role_prompt_file
      File.join(@worktree, ".agent/roles", "#{@role}.md")
    end

    def fill(str, extra = {})
      vals = { "model" => @profile["model"], "effort" => @profile["effort"],
               "role_prompt_file" => role_prompt_file,
               "max_turns" => @cfg.dig("limits", "max_turns"),
               "git_common_dir" => @git_common_dir }.merge(extra)
      str.gsub(/\{(\w+)\}/) { vals.key?(Regexp.last_match(1)) ? vals[Regexp.last_match(1)].to_s : Regexp.last_match(0) }
    end

    # Tokenise first, then fill, so a path with a space stays one argument.
    def split(str, extra = {})
      Shellwords.split(str.to_s).map { |t| fill(t, extra) }
    end

    def task_prompt(session_resume)
      rel = @task_rel
      report = "When you have finished, run exactly one of:\n" \
               "  herdr agent prompt lead \"#{@pane_name}: #{@role} done — <one line>\"\n" \
               "  herdr agent prompt lead \"#{@pane_name}: BLOCKED — <question>\""
      if session_resume
        msg = @o.message || "The lead has answered in #{rel}, in the section above the Handoff. Continue the task under the same rules."
        return "#{msg}\n\nUpdate the Handoff. Its last line is exactly DONE or BLOCKED: <question>.\n\n#{report}"
      end
      body = case @role
             when "reviewer"
               "You are the reviewer for #{@o.id}. Review the work on branch #{@branch} against #{rel} and the documents it cites. " \
               "Write your report to .agent/reviews/#{@o.id}-review.md and nothing else. Do not commit and do not push."
             else
               "You are the #{@role} for #{@o.id}. Execute #{rel}. Commit on this branch (#{@branch}) only after " \
               "`#{@cfg['verify']}` is green, with path-scoped git add, and never push. Write the Handoff in #{rel}. " \
               "Its last line is exactly DONE or BLOCKED: <question>."
             end
      "#{body}\n\n#{report}"
    end

    # Returns [argv, env, stdin_text]
    def launch(session = nil)
      l = @cfg["launch"][@cli]
      prompt = task_prompt(!session.nil?)
      env = { "AGENT_ROLE" => @role, "TASK_ID" => @o.id }
      stdin = nil
      case @cli
      when "claude"
        argv = split(l["oneshot"]) + claude_flags(l)
        argv += split(l["resume"], "session" => session) if session
        stdin = prompt                                  # stdin, so no flag can swallow it
      when "codex"
        one = split(l["oneshot"])
        flags = one.drop(2)                             # after "codex exec"
        flags += split(l["effort"]) if @profile["effort"]
        flags += split(l["writable_roots"]) if l["writable_roots"]
        gated_off.each do |m|
          f = l.dig("mcp_off", m) or Dispatch.refuse "no launch.codex.mcp_off.#{m}; refusing to launch #{@role} with #{m} reachable"
          flags += split(f)
        end
        full = File.read(role_prompt_file_for_text) + "\n\n" + prompt
        argv = session ? split(l["resume"]) + flags + [session, full] : one.take(2) + flags + [full]
        stdin = ""                                      # /dev/null equivalent
      when "opencode"
        argv = split(l["oneshot"])
        argv += split(l["effort"]) if @profile["effort"]
        gated_off.each do |m|
          next if Array(l["mcp_none"]).include?(m)
          f = l.dig("mcp_off", m) or Dispatch.refuse "no launch.opencode.mcp_off.#{m} and #{m} not listed in mcp_none"
          argv += split(f)
        end
        argv += split(l["resume"], "session" => session) if session
        env["OPENCODE_CONFIG_CONTENT"] = JSON.generate("permission" => l["permission"]) if l["permission"]
        argv += [File.read(role_prompt_file_for_text) + "\n\n" + prompt]
      else
        Dispatch.refuse "no launch shape for CLI #{@cli}"
      end
      [argv, env, stdin]
    end

    # Everything a Claude worker gets in either mode after the model and role
    # prompt: effort, one merged --settings, permissions, one --allowedTools
    # and one --disallowedTools (Context7 included).
    def claude_flags(l)
      argv = []
      argv += split(l["effort"]) if @profile["effort"]
      settings = {}
      settings = deep_merge(settings, l["caveman_off"]) if caveman_off?
      argv += ["--settings", JSON.generate(settings)] unless settings.empty?
      argv += ["--permission-mode", l["permission_mode"]] if l["permission_mode"]
      allowed = Array(l["allowed_tools"])
      argv += ["--allowedTools", allowed.join(",")] unless allowed.empty?
      denied = Array(l["disallowed_tools"])
      gated_off.each do |m|
        tools = l.dig("mcp_off", m) or Dispatch.refuse "no launch.claude.mcp_off.#{m}; refusing to launch #{@role} with #{m} reachable"
        denied += Array(tools)
      end
      argv += ["--disallowedTools", denied.join(",")] unless denied.empty?
      argv
    end

    # Interactive (KIT-005). Returns [cli_args, env, brief]: the arguments that
    # follow `herdr agent start … --`, the pane environment, and the text sent
    # with `herdr agent prompt`. new_session is the id to assign (Claude) when
    # this is not a resume.
    def launch_interactive(session, new_session)
      l = @cfg["launch"][@cli]
      env = { "AGENT_ROLE" => @role, "TASK_ID" => @o.id }
      brief = task_prompt(!session.nil?)
      args = split(l["interactive"]).drop(1)          # herdr runs the CLI itself
      case @cli
      when "claude"
        args += claude_flags(l)
        args += session ? split(l["resume"], "session" => session) : split(l["session_new"], "session" => new_session)
      when "opencode"
        gated_off.each do |m|
          next if Array(l["mcp_none"]).include?(m)
          f = l.dig("mcp_off", m) or Dispatch.refuse "no launch.opencode.mcp_off.#{m} and #{m} not listed in mcp_none"
          args += split(f)
        end
        args += split(l["resume"], "session" => session) if session
        env["OPENCODE_CONFIG_CONTENT"] = JSON.generate("permission" => l["permission"]) if l["permission"]
        brief = File.read(role_prompt_file_for_text) + "\n\n" + brief unless session
        @notes << "effort #{@profile['effort']} not applied: the OpenCode TUI has no --variant" if @profile["effort"]
      else
        Dispatch.refuse "no interactive launch shape for CLI #{@cli}"
      end
      [args, env, brief]
    end

    # Codex and OpenCode take the role prompt as text. Before the worktree
    # exists (dry run) the current checkout's copy is read.
    def role_prompt_file_for_text
      File.exist?(role_prompt_file) ? role_prompt_file : File.join(@root, ".agent/roles", "#{@role}.md")
    end

    def deep_merge(a, b)
      a.merge(b) { |_, x, y| x.is_a?(Hash) && y.is_a?(Hash) ? deep_merge(x, y) : y }
    end

    def mcp_notes
      gated_off.map do |m|
        if @cli == "opencode" && Array(@cfg.dig("launch", "opencode", "mcp_none")).include?(m)
          "#{m}: off (OpenCode has no MCP servers configured)"
        else
          "#{m}: off (launch.#{@cli}.mcp_off)"
        end
      end + (Array(@cfg["gated_mcps"]) - gated_off).map { |m| "#{m}: on (roles.#{@role}.mcps)" }
    end
  end

  # ------------------------------------------------------------- preflight
  def self.task_status(path)
    text = File.read(path)
    fm = frontmatter(text)
    return fm["status"].to_s if fm["status"]
    line = text[/^\*\*Status:\*\*\s*(.+)$/, 1].to_s
    line =~ /\A(accepted|complete|done)/i ? "complete" : line
  end

  def self.live?(dir)
    return false if File.exist?(File.join(dir, "exit"))
    pidf = File.join(dir, "pid")
    return false unless File.exist?(pidf)
    Process.kill(0, File.read(pidf).to_i)
    true
  rescue Errno::ESRCH, Errno::EPERM
    false
  end

  def self.preflight(p)
    checks = []
    run = lambda do |label, cmd|
      out, st = Open3.capture2e("bash", *cmd, chdir: p.root)   # bash: a lone path with a space is not split
      checks << [label, st.success?, out.strip.lines.last.to_s.strip]
    end
    run.call("state cap", [File.join(p.root, ".agent/bin/check-state.sh")])
    if ENV["DISPATCH_ALLOW_STALE_HOOKS"] == "1"
      checks << ["guard hooks", true, "not checked (DISPATCH_ALLOW_STALE_HOOKS=1: testing the dispatcher before its merge)"]
    else
      run.call("guard hooks", [File.join(p.root, ".agent/bin/install-hooks.sh"), "--check"])
    end

    Array(p.fm["depends_on"]).each do |dep|
      files = Dir.glob(File.join(p.root, ".agent/tasks", "#{dep}-*.md")) + Dir.glob(File.join(p.root, ".agent/tasks", "#{dep}.md"))
      if files.size != 1
        checks << ["depends_on #{dep}", false, "no single task file for #{dep}"]
      else
        s = task_status(files.first)
        checks << ["depends_on #{dep}", s == "complete", "status '#{s}'"]
      end
    end

    status = p.fm["status"].to_s
    ok_status = p.role == "reviewer" ? %w[active review] : %w[not-started active blocked]
    checks << ["task status", ok_status.include?(status), "'#{status}' (dispatchable: #{ok_status.join(', ')})"]

    runs = Dir.glob(File.join(p.main, ".agent/runs/*/*")).select { |d| File.directory?(d) && live?(d) }
    same = runs.select { |d| d.start_with?(File.join(p.main, ".agent/runs", p.o.id) + "/") }
    checks << ["no live run of #{p.o.id}", same.empty?, same.empty? ? "none" : "live: #{same.join(', ')}"]
    if p.role == "builder"
      max = p.cfg.dig("limits", "max_builders").to_i
      builders = runs.select { |d| File.basename(d) == "builder" } - same
      checks << ["max_builders #{max}", builders.size < max, builders.empty? ? "no other builder live" : "live: #{builders.map { |d| File.basename(File.dirname(d)) }.join(', ')}"]
    end

    wt_exists = File.exist?(p.worktree)
    _, br_exists = git("rev-parse", "--verify", "--quiet", "refs/heads/#{p.branch}", dir: p.main)
    if p.o.resume
      sess = File.join(p.run_dir, "session")
      checks << ["recorded session", File.exist?(sess), File.exist?(sess) ? File.read(sess).strip : "none in #{p.run_dir}"]
      rounds = File.exist?(File.join(p.run_dir, "rounds")) ? File.read(File.join(p.run_dir, "rounds")).to_i : 0
      max = p.cfg.dig("limits", "max_fix_cycles").to_i
      checks << ["resumes #{rounds - 1} of #{max}", rounds - 1 < max, rounds - 1 < max ? "allowed" : "limit reached: escalate to the owner"]
    elsif p.role == "reviewer"
      checks << ["builder worktree", wt_exists, wt_exists ? p.worktree : "missing: the reviewer runs in the builder's worktree"]
    else
      free = !wt_exists && !br_exists
      checks << ["fresh worktree and branch", free, free ? "#{p.worktree}, #{p.branch}" : "#{wt_exists ? 'worktree' : 'branch'} exists; use --resume or remove it"]
    end
    checks
  end

  # ------------------------------------------------------------- dry run
  def self.print_plan(p, checks, argv, env, stdin, session, prompt_label = nil)
    puts "dispatch #{p.o.id}#{p.o.dry_run ? ' (dry run: nothing is created)' : ''}"
    puts "  task      #{p.task_rel}  category=#{p.category} touches=#{p.touches.inspect}"
    puts "  role      #{p.role}"
    puts "  mode      #{p.mode}#{p.mode == 'interactive' ? " (Herdr agent #{p.agent_name}; no turn cap; the pane closes on DONE or a written review verdict)" : ' (the pane closes on DONE or a written review verdict)'}"
    puts "  profile   #{p.profile_name}: #{p.cli} #{p.profile['model']}#{p.profile['effort'] ? " effort=#{p.profile['effort']}" : ''}"
    puts "  caveman   #{p.cli == 'claude' ? (p.caveman_off? ? 'off' : 'on (chat only)') : 'n/a (no always-on caveman on this CLI)'}"
    puts "  mcps      #{p.mcp_notes.join('; ')}"
    puts "  skills    no gate (owner, 2026-09-29)"
    puts "  branch    #{p.branch}"
    puts "  worktree  #{p.worktree}"
    puts "  pane      #{p.pane_name}"
    puts "  run dir   #{p.run_dir}"
    puts "  session   #{session || 'new'}"
    p.notes.each { |n| puts "  note      #{n}" }
    puts "preflight"
    checks.each { |label, ok, detail| puts "  #{ok ? 'ok  ' : 'FAIL'} #{label}: #{detail}" }
    puts "env"
    env.each { |k, v| puts "  #{k}=#{v.length > 120 ? v[0, 117] + '...' : v}" }
    puts "command"
    puts "  " + argv.map { |a| a.include?("\n") ? "<prompt: #{a.lines.size} lines, below>" : Shellwords.escape(a) }.join(" ")
    puts "prompt #{prompt_label || (stdin && !stdin.empty? ? '(on stdin)' : '(last argument)')}"
    text = stdin && !stdin.empty? ? stdin : argv.last
    puts text.to_s.lines.map { |l| "  | #{l}" }.join
  end

  # ------------------------------------------------------------ live run
  def self.prepare_worktree(p)
    wt_root = File.dirname(p.worktree)
    FileUtils.mkdir_p(wt_root)
    base = p.cfg["integration_branch"]
    out, ok = git("worktree", "add", "-b", p.branch, p.worktree, base, dir: p.main)
    refuse "git worktree add failed: #{out}" unless ok
    _, committed = git("cat-file", "-e", "HEAD:#{p.task_rel}", dir: p.worktree)
    if committed
      same = File.read(p.task_path) == File.read(File.join(p.worktree, p.task_rel))
      warn "dispatch: note: #{p.task_rel} on #{base} differs from #{p.root}; the worker reads #{base}'s copy" unless same
    else
      FileUtils.mkdir_p(File.dirname(File.join(p.worktree, p.task_rel)))
      FileUtils.cp(p.task_path, File.join(p.worktree, p.task_rel))
      env = ENV.to_h.reject { |k, _| %w[AGENT_ROLE TASK_ID].include?(k) }
      out, st = Open3.capture2e(env, "git", "-C", p.worktree, "add", "--", p.task_rel)
      refuse "git add of the task file failed: #{out}" unless st.success?
      out, st = Open3.capture2e(env, "git", "-C", p.worktree, "commit", "-q", "-m",
                                "chore(agent): add the #{p.o.id} task file\n\nThe spec is the branch's first commit, so the worker's Handoff is\nthe only change it makes to this file and the guard hook can compare\nits frontmatter against a committed version.")
      refuse "committing the task file failed: #{out}" unless st.success?
    end
    setup = p.cfg.dig("dispatch", "setup")
    return unless setup
    return puts("dispatch: #{setup} skipped (DISPATCH_SKIP_SETUP=1)") if ENV["DISPATCH_SKIP_SETUP"] == "1"
    puts "dispatch: #{setup} in #{p.worktree}"
    out, st = Open3.capture2e(*Shellwords.split(setup), chdir: p.worktree)
    refuse "#{setup} failed in #{p.worktree}:\n#{out.lines.last(15).join}" unless st.success?
  end

  # A Herdr pane starts a fresh login shell, so the worker would not see the
  # dispatcher's environment. It gets the dispatcher's PATH (the CLIs the lead
  # resolves are the ones the worker runs), the launch env, and any names in
  # DISPATCH_PASS_ENV (comma-separated; used by the dispatcher's own tests).
  def self.runner_env(env)
    extra = ENV["DISPATCH_PASS_ENV"].to_s.split(",").map(&:strip).reject(&:empty?)
    pass = { "PATH" => ENV["PATH"] }
    extra.each { |k| pass[k] = ENV[k] if ENV.key?(k) }
    pass.merge(env)
  end

  def self.write_runner(p, argv, env, stdin)
    FileUtils.mkdir_p(p.run_dir)
    %w[exit pid].each { |f| FileUtils.rm_f(File.join(p.run_dir, f)) }
    File.write(File.join(p.run_dir, "prompt.txt"), stdin.to_s)
    progress = File.join(__dir__, "dispatch_progress.rb")
    log = File.join(p.run_dir, "log.jsonl")
    caff = system("command -v caffeinate >/dev/null 2>&1") ? "caffeinate -i " : ""
    script = <<~SH
      #!/usr/bin/env bash
      # Written by dispatch.sh for #{p.o.id} (#{p.role}). Safe to read; rerun with dispatch.sh --resume.
      cd #{Shellwords.escape(p.worktree)} || exit 1
      echo $$ > #{Shellwords.escape(File.join(p.run_dir, 'pid'))}
      #{runner_env(env).map { |k, v| "export #{k}=#{Shellwords.escape(v)}" }.join("\n")}
      echo "== #{p.o.id} · #{p.role} · #{p.cli} #{p.profile['model']} · log: #{log}"
      #{caff}#{argv.map { |a| Shellwords.escape(a) }.join(' ')} < #{Shellwords.escape(File.join(p.run_dir, 'prompt.txt'))} 2>&1 | tee -a #{Shellwords.escape(log)} | ruby #{Shellwords.escape(progress)}
      code=${PIPESTATUS[0]}
      echo $code > #{Shellwords.escape(File.join(p.run_dir, 'exit'))}
      echo "== exit $code"
    SH
    path = File.join(p.run_dir, "run.sh")
    File.write(path, script)
    File.chmod(0o755, path)
    path
  end

  def self.herdr(*args)
    out, st = Open3.capture2e("herdr", *args)
    refuse "herdr #{args.first(2).join(' ')} failed: #{out.strip}" unless st.success?
    out
  end

  # A resumed round reuses the task's pane while it is still open.
  def self.open_pane(p, runner)
    l = p.cfg.dig("launch", "herdr")
    meta = File.join(p.run_dir, "meta.json")
    pane = File.exist?(meta) ? JSON.parse(File.read(meta))["pane"] : nil
    pane = nil if pane && !system("herdr", "pane", "get", pane, out: File::NULL, err: File::NULL)
    unless pane
      out = herdr(*p.split(l["open_pane"], "worktree" => p.worktree).drop(1))
      pane = JSON.parse(out).dig("result", "pane", "pane_id") or refuse "no pane id in: #{out}"
      herdr(*p.split(l["name_pane"], "pane" => pane, "task_id" => p.pane_name).drop(1))
    end
    herdr("pane", "run", pane, "bash #{Shellwords.escape(runner)}")
    pane
  end

  def self.now
    # Awake time: CLOCK_UPTIME_RAW stops while the Mac sleeps, so a lid close
    # is not counted as a stall.
    clock = defined?(Process::CLOCK_UPTIME_RAW) ? Process::CLOCK_UPTIME_RAW : Process::CLOCK_MONOTONIC
    Process.clock_gettime(clock)
  end

  def self.activity(p)
    log = File.join(p.run_dir, "log.jsonl")
    tree, = git("status", "--porcelain", dir: p.worktree)
    head, = git("rev-parse", "HEAD", dir: p.worktree)
    [File.exist?(log) ? File.size(log) : 0, tree.hash, head]
  end

  def self.wait(p)
    exit_file = File.join(p.run_dir, "exit")
    stall_min = (ENV["STALL_ALERT_MIN"] || p.cfg.dig("limits", "stall_alert_min")).to_f
    poll = (ENV["DISPATCH_POLL_SEC"] || 15).to_f
    last_sig = activity(p)
    last_change = now
    alerted = false
    until File.exist?(exit_file)
      sleep poll
      sig = activity(p)
      if sig != last_sig
        last_sig = sig
        last_change = now
        alerted = false
      elsif !alerted && now - last_change >= stall_min * 60
        mins = ((now - last_change) / 60).round(1)
        puts "STALL: #{p.o.id} #{p.role}: no log output and no file change for #{mins} min of awake time. Not killed; look at pane #{p.pane_name}."
        $stdout.flush
        system("herdr", "notification", "show", "#{p.o.id} stalled", "--body", "No output or file change for #{mins} min. The run was not killed.", "--sound", "request",
               out: File::NULL, err: File::NULL)
        alerted = true
      end
    end
    File.read(exit_file).strip.to_i
  end

  def self.find_session(p)
    key = p.cfg.dig("launch", p.cli, "session_id_from")
    log = File.join(p.run_dir, "log.jsonl")
    return nil unless key && File.exist?(log)
    found = nil                                     # the last one: a resumed round may get a new id
    File.foreach(log) do |line|
      begin
        v = dig_key(JSON.parse(line), key)
        found = v if v.is_a?(String) && !v.empty?
      rescue JSON::ParserError
        next
      end
    end
    found
  end

  def self.dig_key(obj, key)
    case obj
    when Hash
      return obj[key] if obj.key?(key)
      obj.each_value { |v| r = dig_key(v, key); return r if r }
      nil
    when Array
      obj.each { |v| r = dig_key(v, key); return r if r }
      nil
    end
  end

  def self.verdict(p)
    if p.role == "reviewer"
      f = File.join(p.worktree, ".agent/reviews", "#{p.o.id}-review.md")
      return [EXIT_NO_VERDICT, "no review file at #{f}"] unless File.exist?(f)
      # `## Verdict: clean`, `**Verdict:** clean` and `1. **Verdict:** `clean``
      # all occur (FE-029's Codex reviewer wrote the heading form).
      v = File.read(f)[/^[\s\d.#*]*Verdict[*:\s]*`?(\w+)/i, 1]
      return [EXIT_NO_VERDICT, "review written, no Verdict line"] unless v
      return [v.casecmp("blocked").zero? ? EXIT_BLOCKED : 0, "review verdict: #{v}"]
    end
    f = File.join(p.worktree, p.task_rel)
    last = File.exist?(f) ? File.read(f).lines.map(&:strip).reject(&:empty?).last.to_s : ""
    return [0, "DONE"] if last == "DONE"
    return [EXIT_BLOCKED, last] if last.start_with?("BLOCKED")
    [EXIT_NO_VERDICT, "no DONE or BLOCKED as the Handoff's last line (last line: #{last[0, 80].inspect})"]
  end

  def self.run_live(p, session, fallback_used: false)
    prepare_worktree(p) unless session || p.role == "reviewer" || File.exist?(p.worktree)
    argv, env, stdin = p.launch(session)          # after the worktree exists, so its role prompt is used
    runner = write_runner(p, argv, env, stdin)
    rounds_f = File.join(p.run_dir, "rounds")
    File.write(rounds_f, (File.exist?(rounds_f) ? File.read(rounds_f).to_i : 0) + 1)
    pane = open_pane(p, runner)
    File.write(File.join(p.run_dir, "meta.json"), JSON.pretty_generate(
      "task" => p.o.id, "role" => p.role, "cli" => p.cli, "model" => p.profile["model"],
      "profile" => p.profile_name, "pane" => pane, "worktree" => p.worktree, "branch" => p.branch))
    puts "dispatch: #{p.o.id} running in pane #{p.pane_name} (#{pane}); waiting for exit"
    $stdout.flush
    code = wait(p)
    sid = find_session(p) || session
    File.write(File.join(p.run_dir, "session"), sid) if sid
    puts "dispatch: #{p.o.id} #{p.role} exited #{code}; session #{sid || 'not found in the log'}"
    if code != 0
      log = File.join(p.run_dir, "log.jsonl")
      limited = File.exist?(log) && File.read(log) =~ RATE_LIMIT
      fb = limited && !fallback_used && p.fallback_plan
      if fb
        puts "dispatch: rate limit or quota in the log; re-running once on fallback profile #{fb.profile_name} (#{fb.cli} #{fb.profile['model']})"
        File.open(File.join(p.run_dir, "fallback.log"), "a") { |f| f.puts "#{Time.now} #{p.profile_name} -> #{fb.profile_name}" }
        return run_live(fb, nil, fallback_used: true)
      end
      puts "dispatch: non-zero exit is treated as BLOCKED: read the log, then --resume. Log: #{log}"
      return code
    end
    vcode, vtext = verdict(p)
    puts "dispatch: #{vtext}"
    close_pane_if_done(p, pane, vcode)
    vcode
  end

  # KIT-005: a round that ends DONE, or a review with a written verdict (the
  # reviewer is never resumed; findings go to the builder), needs no pane:
  # its log and session stay in the run directory. Anything else keeps the pane
  # open for the lead and the owner to read. --keep-pane overrides.
  def self.close_pane_if_done(p, pane, vcode)
    return unless vcode.zero?
    if p.o.keep_pane
      puts "dispatch: pane #{p.pane_name} kept (--keep-pane)"
      return
    end
    system("herdr", "pane", "close", pane, out: File::NULL, err: File::NULL)
    puts "dispatch: pane #{p.pane_name} closed; log and session are in #{p.run_dir}"
  end

  # ------------------------------------------------------- interactive run
  def self.agent_info(name)
    out, st = Open3.capture2e("herdr", "agent", "get", name)
    return nil unless st.success?
    JSON.parse(out).dig("result", "agent")
  rescue JSON::ParserError
    nil
  end

  def self.pane_text(pane)
    out, = Open3.capture2e("herdr", "pane", "read", pane)
    out
  end

  def self.notify(title, body)
    system("herdr", "notification", "show", title, "--body", body, "--sound", "request", out: File::NULL, err: File::NULL)
  end

  def self.start_interactive(p, session)
    l = p.cfg.dig("launch", "herdr")
    meta = File.join(p.run_dir, "meta.json")
    pane = File.exist?(meta) ? JSON.parse(File.read(meta))["pane"] : nil
    pane = nil if pane && !system("herdr", "pane", "get", pane, out: File::NULL, err: File::NULL)
    live = agent_info(p.agent_name)
    new_session = p.cli == "claude" && session.nil? ? SecureRandom.uuid : nil
    args, env, brief = p.launch_interactive(session, new_session)
    File.write(File.join(p.run_dir, "prompt.txt"), brief)

    if session && live && pane
      puts "dispatch: #{p.agent_name} is still in pane #{pane}; prompting it"
    else
      unless pane
        split = p.split(l["open_pane"], "worktree" => p.worktree).drop(1)
        runner_env(env).each { |k, v| split += ["--env", "#{k}=#{v}"] }
        out = herdr(*split)
        pane = JSON.parse(out).dig("result", "pane", "pane_id") or refuse "no pane id in: #{out}"
        herdr(*p.split(l["name_pane"], "pane" => pane, "task_id" => p.pane_name).drop(1))
      end
      start = p.split(l["start_agent"], "agent" => p.agent_name, "cli" => p.cli, "pane" => pane).drop(1)
      # A new pane's shell takes a moment to come up; until then Herdr answers
      # "not an available shell". Retry that for up to 15 s, nothing else.
      out = st = nil
      15.times do
        out, st = Open3.capture2e("herdr", *start, "--", *args)
        break if st.success? || out !~ /not an available shell/
        sleep 1
      end
      unless st.success?
        msg = (JSON.parse(out).dig("error", "message") rescue out.strip)
        hint = msg =~ /blocked/ ? " The CLI is waiting on a dialog (trust, login or update): only the owner answers it." : ""
        refuse "herdr agent start failed: #{msg}. Pane #{p.pane_name} (#{pane}) is left open.#{hint}"
      end
    end
    [pane, new_session || session, brief]
  end

  # Wait for the agent to start working, then until it is idle or gone. Blocked
  # (an approval prompt) is reported once per episode and never answered.
  def self.wait_interactive(p, pane)
    name = p.agent_name
    stall_min = (ENV["STALL_ALERT_MIN"] || p.cfg.dig("limits", "stall_alert_min")).to_f
    poll = (ENV["DISPATCH_POLL_SEC"] || 10).to_f
    # `herdr agent wait` can return the state from before the prompt, so the
    # first thing awaited is `working`.
    Open3.capture2e("herdr", "agent", "wait", name, "--until", "working", "--timeout", "120000")
    sig = lambda { [pane_text(pane).hash, git("status", "--porcelain", dir: p.worktree).first.hash, git("rev-parse", "HEAD", dir: p.worktree).first] }
    last_sig = sig.call
    last_change = now
    stalled = blocked = false
    loop do
      info = agent_info(name)
      return :gone unless info
      status = info["agent_status"]
      return :idle if %w[idle done].include?(status)
      if status == "blocked"
        unless blocked
          # Keep what the pane showed, so the record says which prompt it was
          # and the Handoff review can tell who answered it.
          n = Dir.glob(File.join(p.run_dir, "blocked-*.txt")).size + 1
          shot = File.join(p.run_dir, "blocked-#{n}.txt")
          File.write(shot, pane_text(pane))
          puts "BLOCKED ON APPROVAL: #{p.o.id} #{p.role} is waiting on a permission prompt in pane #{p.pane_name} (pane text: #{shot}). Only the owner answers it."
          $stdout.flush
          notify("#{p.o.id} needs approval", "#{p.role} is waiting on a permission prompt in pane #{p.pane_name}.")
          blocked = true
        end
      else
        blocked = false
      end
      sleep poll
      s2 = sig.call
      if s2 != last_sig
        last_sig = s2
        last_change = now
        stalled = false
      elsif !stalled && status == "working" && now - last_change >= stall_min * 60
        mins = ((now - last_change) / 60).round(1)
        puts "STALL: #{p.o.id} #{p.role}: no pane output and no file change for #{mins} min of awake time. Not stopped; look at pane #{p.pane_name}."
        $stdout.flush
        notify("#{p.o.id} stalled", "No output or file change for #{mins} min. The agent was not stopped.")
        stalled = true
      end
    end
  end

  def self.run_interactive(p, session, fallback_used: false)
    prepare_worktree(p) unless session || p.role == "reviewer" || File.exist?(p.worktree)
    FileUtils.mkdir_p(p.run_dir)
    %w[exit pid].each { |f| FileUtils.rm_f(File.join(p.run_dir, f)) }
    File.write(File.join(p.run_dir, "pid"), Process.pid.to_s)   # the dispatcher waits for the whole round
    rounds_f = File.join(p.run_dir, "rounds")
    File.write(rounds_f, (File.exist?(rounds_f) ? File.read(rounds_f).to_i : 0) + 1)
    pane, sid, brief = start_interactive(p, session)
    File.write(File.join(p.run_dir, "meta.json"), JSON.pretty_generate(
      "task" => p.o.id, "role" => p.role, "mode" => "interactive", "cli" => p.cli, "model" => p.profile["model"],
      "profile" => p.profile_name, "pane" => pane, "agent" => p.agent_name, "worktree" => p.worktree, "branch" => p.branch))
    out, st = Open3.capture2e("herdr", *p.split(p.cfg.dig("launch", "herdr", "prompt_agent"), "agent" => p.agent_name).drop(1), brief)
    refuse "herdr agent prompt failed: #{out.strip}" unless st.success?
    puts "dispatch: #{p.o.id} #{p.role} running interactively as #{p.agent_name} in pane #{p.pane_name} (#{pane}); waiting until it is idle"
    $stdout.flush
    state = wait_interactive(p, pane)
    info = agent_info(p.agent_name)
    sid = (info && info.dig("agent_session", "value")) || sid
    File.write(File.join(p.run_dir, "session"), sid) if sid
    code =
      if state == :gone
        puts "dispatch: #{p.agent_name} left before a verdict (the CLI exited or the pane closed)"
        1
      else
        vcode, vtext = verdict(p)
        if vcode == EXIT_NO_VERDICT && pane_text(pane) =~ RATE_LIMIT && !fallback_used && (fb = p.fallback_plan)
          puts "dispatch: rate limit or quota in the pane; closing it and re-running once on #{fb.profile_name} (#{fb.cli} #{fb.profile['model']})"
          File.open(File.join(p.run_dir, "fallback.log"), "a") { |f| f.puts "#{Time.now} #{p.profile_name} -> #{fb.profile_name}" }
          system("herdr", "pane", "close", pane, out: File::NULL, err: File::NULL)
          FileUtils.rm_f(File.join(p.run_dir, "meta.json"))
          File.write(File.join(p.run_dir, "exit"), "1")
          return run_interactive(fb, nil, fallback_used: true)
        end
        vtext = "idle without a verdict: read pane #{p.pane_name}, then --resume --message" if vcode == EXIT_NO_VERDICT
        puts "dispatch: #{vtext}"
        vcode
      end
    File.write(File.join(p.run_dir, "exit"), code.to_s)
    puts "dispatch: #{p.o.id} #{p.role} round over (exit #{code}); session #{sid || 'unknown'}"
    close_pane_if_done(p, pane, code)
    code
  end

  def self.main(argv)
    o = parse(argv)
    p = Plan.new(o)
    session = o.resume ? (File.read(File.join(p.run_dir, "session")).strip rescue nil) : nil
    checks = preflight(p)
    label = nil
    if p.mode == "interactive"
      args, env, stdin = p.launch_interactive(o.resume ? (session || "<none recorded>") : nil, "<new uuid>")
      herdr_cfg = p.cfg.dig("launch", "herdr")
      argv2 = ["herdr"] + p.split(herdr_cfg["start_agent"], "agent" => p.agent_name, "cli" => p.cli, "pane" => "<pane>").drop(1) + ["--"] + args
      env = runner_env(env).merge("PATH" => "<the dispatcher's PATH>")
      label = "(sent with: herdr agent prompt #{p.agent_name} <text>)"
    else
      argv2, env, stdin = p.launch(o.resume ? (session || "<none recorded>") : nil)
    end
    failed = checks.reject { |c| c[1] }
    if o.dry_run
      print_plan(p, checks, argv2, env, stdin, session, label)
      return failed.empty? ? 0 : EXIT_REFUSED
    end
    unless failed.empty?
      failed.each { |label, _, detail| warn "dispatch: refused: #{label}: #{detail}" }
      return EXIT_REFUSED
    end
    print_plan(p, checks, argv2, env, stdin, session, label) if ENV["DISPATCH_VERBOSE"] == "1"
    p.mode == "interactive" ? run_interactive(p, session) : run_live(p, session)
  rescue Refused => e
    warn "dispatch: refused: #{e.message}"
    EXIT_REFUSED
  end
end

exit Dispatch.main(ARGV) if $PROGRAM_NAME == __FILE__
