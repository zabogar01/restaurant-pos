import { z } from 'zod';

/**
 * A custom tender method's name (consult C2, section 8; DESIGN-018): 1 to 32 characters,
 * no leading or trailing whitespace and no control character (Unicode category Cc).
 * The length counts code points, as zod's `max` does. The schema refuses an untrimmed
 * name rather than trimming it, so the server stores exactly what it validated and the
 * schema's input and output types are the same. No custom messages: the wording is the
 * client's. Cash and card are fixed kinds, not named here; a custom name may equal them.
 */
export const TenderMethodName = z
  .string()
  .min(1)
  .max(32)
  .refine((name) => name === name.trim())
  .refine((name) => !/\p{Cc}/u.test(name));

/** A custom tender method as every route answers it. Nothing else: no fee, no order, no icon. */
export const TenderMethodView = z.strictObject({
  tenderMethodId: z.uuid(),
  name: z.string(),
  isActive: z.boolean(),
});
export type TenderMethodView = z.infer<typeof TenderMethodView>;

export const CreateTenderMethodRequest = z.strictObject({ name: TenderMethodName });
export const UpdateTenderMethodRequest = z.strictObject({ tenderMethodId: z.uuid(), name: TenderMethodName });
export const DeactivateTenderMethodRequest = z.strictObject({ tenderMethodId: z.uuid() });
export const ReactivateTenderMethodRequest = z.strictObject({ tenderMethodId: z.uuid() });

/** What the four commands answer: the row as committed. */
export const TenderMethodResponse = z.strictObject({ tenderMethod: TenderMethodView });
export type TenderMethodResponse = z.infer<typeof TenderMethodResponse>;

/** What the list read answers: every custom method, active and inactive. */
export const TenderMethodsResponse = z.strictObject({ tenderMethods: z.array(TenderMethodView) });
export type TenderMethodsResponse = z.infer<typeof TenderMethodsResponse>;
