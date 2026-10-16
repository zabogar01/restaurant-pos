import { z } from 'zod';

// For the browser clients only; the server never imports it.
//
// The content-security policy forbids `eval` (ARCHITECTURE 14.4). At start-up zod
// probes whether it may compile validators with `Function('')`: the policy refuses
// the call, the probe catches it, and the browser still reports a
// `securitypolicyviolation`. `jitless` makes zod skip the probe. It must run before
// the first schema is built, so each client imports this module before anything else.
z.config({ jitless: true });
