import { z } from 'zod';

/**
 * A table's label (consult C2, section 4): 1 to 32 characters, no leading or
 * trailing whitespace and no control character (Unicode category Cc). The length is
 * in UTF-16 units, as `max` counts. The schema refuses an untrimmed label rather than
 * trimming it, so the server stores exactly what it validated and the schema's input
 * and output types are the same. No custom messages: the wording is the client's.
 */
export const TableLabel = z
  .string()
  .min(1)
  .max(32)
  .refine((label) => label === label.trim())
  .refine((label) => !/\p{Cc}/u.test(label));

/** A table as every table route answers it. Nothing else: no seat count, no area. */
export const TableView = z.strictObject({
  tableId: z.uuid(),
  label: z.string(),
  isActive: z.boolean(),
});
export type TableView = z.infer<typeof TableView>;

export const CreateTableRequest = z.strictObject({ label: TableLabel });
export const UpdateTableRequest = z.strictObject({ tableId: z.uuid(), label: TableLabel });
export const DeactivateTableRequest = z.strictObject({ tableId: z.uuid() });
export const ReactivateTableRequest = z.strictObject({ tableId: z.uuid() });

/** What the four commands answer: the row as committed. */
export const TableResponse = z.strictObject({ table: TableView });
export type TableResponse = z.infer<typeof TableResponse>;

/** What the list read answers: every table, active and inactive. */
export const TablesResponse = z.strictObject({ tables: z.array(TableView) });
export type TablesResponse = z.infer<typeof TablesResponse>;
