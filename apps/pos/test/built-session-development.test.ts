// @vitest-environment jsdom
import { builtSessionTests } from './built-session-support.js';

// `import.meta.env.DEV` follows NODE_ENV, so a build under NODE_ENV=development
// would carry a DEV-keyed fixture. The switch is the command, not the environment.
builtSessionTests('development');
