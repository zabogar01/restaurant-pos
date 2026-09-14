# ADR-004: Versioned exact nett monetary policy

**Status:** Accepted

**Date:** 2026-09-10

**Approved by:** Product owner

## Context

The same sale must produce identical totals in the POS, Receipt, refund,
audit, and BusinessDayReport even after rates, configuration, or application
code change. Floating point, per-line tax rounding, and live configuration
lookup cannot provide that guarantee.

The owner selected the nett convention rather than Indonesian “++” billing.
Menu prices are tax-inclusive, service charge is untaxed, and tax is derived
for display rather than added to the amount paid.

## Decision

Represent all money as integer minor units. Use `bigint` for in-process money
and exact rate arithmetic behind one Money module; ordinary counts remain
`number`. Encode money as canonical base-10 integer strings at JSON boundaries.
Binary floating point never represents money.

Represent rates as integer parts per million and round computed money half-up
exactly once at the defined storage or display boundary. Calculate totals in
this order:

1. sum non-voided tax-inclusive line totals into subtotal;
2. calculate and subtract the one allowed discount;
3. derive included tax once at Order level from the discounted subtotal;
4. calculate untaxed service charge from that discounted subtotal;
5. add service charge to obtain the Order total.

An Order captures an immutable SettingsVersion when opened. Lines snapshot
component prices and a resolved unit price floored at zero. Discounts snapshot
their name, kind, and value. Later configuration changes do not alter those
facts. The settled installation currency is IDR with precision zero.

## Options considered

- Binary floating-point calculation.
- Tax-exclusive “++” billing.
- Live settings lookup for open and historical Orders.
- Integer exact arithmetic with immutable snapshots and a calculation-policy
  version.

## Consequences

- Menu prices are the tax-inclusive amount paid; the receipt tax line never
  increases the total.
- Historical figures remain reproducible and explainable.
- API schemas and tests must treat integer money strings and policy versions
  explicitly.
- The product owner must still set maximum permitted tax and service-charge
  rates; approval of this ADR does not close that product question.
