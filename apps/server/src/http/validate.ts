import { ErrorCode } from '@pos/contracts';
import { AppError } from './errors.js';

// The shape of a zod schema that this file needs. zod is a dependency of
// @pos/contracts alone; the server sees a schema through this and nothing more.
interface Parser<T> {
  safeParse(input: unknown): { success: true; data: T } | { success: false };
}

/**
 * The one place a request body is parsed (ARCH-012 section 9). On failure the parse
 * result is dropped: its issues quote the client's input, and nothing built from
 * them may reach an error, a response or a log. `VALIDATION_FAILED` carries no
 * details.
 */
export function parseBody<T>(schema: Parser<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new AppError(ErrorCode.VALIDATION_FAILED, 400);
  return parsed.data;
}
