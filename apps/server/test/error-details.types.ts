// Case 28, compile-time only (no `.test.ts`, so vitest does not run it; `npm run
// typecheck` does). No current code declares details, so for every code a details
// argument of any kind must not compile, and an ErrorBody must not take one. If
// a line below starts compiling, its @ts-expect-error is unused and the
// typecheck fails: the contract has stopped keeping an exception's text out.
import { ErrorCode } from '@pos/contracts';
import type { ErrorBody } from '@pos/contracts';
import { AppError } from '../src/http/errors.js';

export function neverCalled(cause: Error, text: string): void {
  // @ts-expect-error a string
  new AppError(ErrorCode.INTERNAL, 500, text);
  // @ts-expect-error an exception's message
  new AppError(ErrorCode.INTERNAL, 500, cause.message);
  // @ts-expect-error an exception
  new AppError(ErrorCode.INTERNAL, 500, new Error('x'));
  // @ts-expect-error an undeclared object
  new AppError(ErrorCode.INTERNAL, 500, { any: 'object' });
  // @ts-expect-error a string in the body
  const internalText: ErrorBody = { error: { code: ErrorCode.INTERNAL, details: text } };
  // @ts-expect-error an undeclared object in the body
  const internalObject: ErrorBody = { error: { code: ErrorCode.INTERNAL, details: { any: 'object' } } };
  void [internalText, internalObject];

  // @ts-expect-error a string
  new AppError(ErrorCode.UNAVAILABLE, 500, text);
  // @ts-expect-error an exception's message
  new AppError(ErrorCode.UNAVAILABLE, 500, cause.message);
  // @ts-expect-error an exception
  new AppError(ErrorCode.UNAVAILABLE, 500, new Error('x'));
  // @ts-expect-error an undeclared object
  new AppError(ErrorCode.UNAVAILABLE, 500, { any: 'object' });
  // @ts-expect-error a string in the body
  const unavailableText: ErrorBody = { error: { code: ErrorCode.UNAVAILABLE, details: text } };
  // @ts-expect-error an undeclared object in the body
  const unavailableObject: ErrorBody = { error: { code: ErrorCode.UNAVAILABLE, details: { any: 'object' } } };
  void [unavailableText, unavailableObject];

  // @ts-expect-error a string
  new AppError(ErrorCode.NOT_FOUND, 500, text);
  // @ts-expect-error an exception's message
  new AppError(ErrorCode.NOT_FOUND, 500, cause.message);
  // @ts-expect-error an exception
  new AppError(ErrorCode.NOT_FOUND, 500, new Error('x'));
  // @ts-expect-error an undeclared object
  new AppError(ErrorCode.NOT_FOUND, 500, { any: 'object' });
  // @ts-expect-error a string in the body
  const not_foundText: ErrorBody = { error: { code: ErrorCode.NOT_FOUND, details: text } };
  // @ts-expect-error an undeclared object in the body
  const not_foundObject: ErrorBody = { error: { code: ErrorCode.NOT_FOUND, details: { any: 'object' } } };
  void [not_foundText, not_foundObject];

  // @ts-expect-error a string
  new AppError(ErrorCode.VALIDATION_FAILED, 500, text);
  // @ts-expect-error an exception's message
  new AppError(ErrorCode.VALIDATION_FAILED, 500, cause.message);
  // @ts-expect-error an exception
  new AppError(ErrorCode.VALIDATION_FAILED, 500, new Error('x'));
  // @ts-expect-error an undeclared object
  new AppError(ErrorCode.VALIDATION_FAILED, 500, { any: 'object' });
  // @ts-expect-error a string in the body
  const validation_failedText: ErrorBody = { error: { code: ErrorCode.VALIDATION_FAILED, details: text } };
  // @ts-expect-error an undeclared object in the body
  const validation_failedObject: ErrorBody = { error: { code: ErrorCode.VALIDATION_FAILED, details: { any: 'object' } } };
  void [validation_failedText, validation_failedObject];

  // @ts-expect-error a string
  new AppError(ErrorCode.PAYLOAD_TOO_LARGE, 500, text);
  // @ts-expect-error an exception's message
  new AppError(ErrorCode.PAYLOAD_TOO_LARGE, 500, cause.message);
  // @ts-expect-error an exception
  new AppError(ErrorCode.PAYLOAD_TOO_LARGE, 500, new Error('x'));
  // @ts-expect-error an undeclared object
  new AppError(ErrorCode.PAYLOAD_TOO_LARGE, 500, { any: 'object' });
  // @ts-expect-error a string in the body
  const payload_too_largeText: ErrorBody = { error: { code: ErrorCode.PAYLOAD_TOO_LARGE, details: text } };
  // @ts-expect-error an undeclared object in the body
  const payload_too_largeObject: ErrorBody = { error: { code: ErrorCode.PAYLOAD_TOO_LARGE, details: { any: 'object' } } };
  void [payload_too_largeText, payload_too_largeObject];

  // @ts-expect-error a string
  new AppError(ErrorCode.UNSUPPORTED_MEDIA_TYPE, 500, text);
  // @ts-expect-error an exception's message
  new AppError(ErrorCode.UNSUPPORTED_MEDIA_TYPE, 500, cause.message);
  // @ts-expect-error an exception
  new AppError(ErrorCode.UNSUPPORTED_MEDIA_TYPE, 500, new Error('x'));
  // @ts-expect-error an undeclared object
  new AppError(ErrorCode.UNSUPPORTED_MEDIA_TYPE, 500, { any: 'object' });
  // @ts-expect-error a string in the body
  const unsupported_media_typeText: ErrorBody = { error: { code: ErrorCode.UNSUPPORTED_MEDIA_TYPE, details: text } };
  // @ts-expect-error an undeclared object in the body
  const unsupported_media_typeObject: ErrorBody = { error: { code: ErrorCode.UNSUPPORTED_MEDIA_TYPE, details: { any: 'object' } } };
  void [unsupported_media_typeText, unsupported_media_typeObject];

  // What is allowed: a code alone, and a body without details.
  new AppError(ErrorCode.INTERNAL, 500);
  const fine: ErrorBody = { error: { code: ErrorCode.INTERNAL } };
  void fine;
}
