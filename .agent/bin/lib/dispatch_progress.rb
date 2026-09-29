# Turns a CLI's JSON event stream into short readable lines for the task's
# Herdr pane (KIT-004). The raw stream is kept in the run's log.jsonl; this is
# only for watching. Knows Claude stream-json, Codex --json and OpenCode
# --format json well enough to show text and tool calls; anything else is
# printed as it came.
require "json"

$stdout.sync = true

def short(s, n = 160)
  s = s.to_s.gsub(/\s+/, " ").strip
  s.length > n ? s[0, n - 1] + "…" : s
end

def tool_summary(input)
  return "" unless input.is_a?(Hash)
  v = input["command"] || input["file_path"] || input["path"] || input["pattern"] || input["description"] || input.values.first
  short(v, 120)
end

STDIN.each_line do |line|
  begin
    e = JSON.parse(line)
  rescue JSON::ParserError
    puts line
    next
  end
  next puts(short(line)) unless e.is_a?(Hash)
  case e["type"]
  # Claude stream-json
  when "system"
    puts "· session #{e['session_id']} (#{e['model']})" if e["subtype"] == "init"
  when "assistant"
    Array(e.dig("message", "content")).each do |c|
      case c["type"]
      when "text" then puts "▸ #{short(c['text'], 400)}"
      when "tool_use" then puts "  ⚙ #{c['name']} #{tool_summary(c['input'])}"
      end
    end
  when "user" then nil
  when "result"
    puts "■ result: #{e['subtype']} · turns #{e['num_turns']} · #{e['duration_ms'].to_i / 1000}s#{e['total_cost_usd'] ? format(' · $%.2f', e['total_cost_usd']) : ''}"
  # Codex --json
  when "thread.started" then puts "· thread #{e['thread_id']}"
  when "item.completed"
    it = e["item"] || {}
    case it["type"]
    when "agent_message" then puts "▸ #{short(it['text'], 400)}"
    when "command_execution" then puts "  ⚙ #{short(it['command'], 140)} → #{it['exit_code']}"
    when "file_change" then puts "  ✎ #{Array(it['changes']).map { |ch| ch['path'] }.join(', ')}"
    when "reasoning" then nil
    else puts "  · #{it['type']}"
    end
  when "turn.completed" then puts "■ turn completed"
  when "error", "turn.failed" then puts "✖ #{short(e['message'] || e.dig('error', 'message') || line)}"
  # OpenCode --format json
  when "text" then puts "▸ #{short(e.dig('part', 'text') || e['text'], 400)}"
  when "tool_use", "tool"
    part = e["part"] || e
    puts "  ⚙ #{part['tool']} #{tool_summary(part.dig('state', 'input'))}"
  else
    nil
  end
end
