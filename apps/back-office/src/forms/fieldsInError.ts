// The field list of consult C2 section 2, built here from the form's own check and never
// from the server. Given a request schema of `@pos/contracts` and a candidate body, it
// says which of the schema's own fields would be refused, in the schema's key order.
//
// The issue objects, their messages and their `keys` are read for nothing but
// `path[0]`, and only a value that is one of the schema's own keys is kept. An
// `unrecognized_keys` issue has an empty path, so a key the schema does not know can never
// contribute. Nothing from an issue is stored, rendered or logged. The schema and its
// `safeParse` come from the contracts, so this package needs no zod of its own (rule 9).

interface RequestSchema {
  readonly shape: Readonly<Record<string, unknown>>;
  safeParse(input: unknown): {
    success: boolean;
    error?: { issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey> }> };
  };
}

export function fieldsInError<S extends RequestSchema>(
  schema: S,
  body: unknown
): ReadonlyArray<keyof S['shape'] & string> {
  const parsed = schema.safeParse(body);
  if (parsed.success) return [];
  const own = Object.keys(schema.shape);
  const named = new Set<string>();
  for (const issue of parsed.error?.issues ?? []) {
    const first = issue.path[0];
    if (typeof first === 'string' && own.includes(first)) named.add(first);
  }
  return own.filter((key) => named.has(key)) as Array<keyof S['shape'] & string>;
}
