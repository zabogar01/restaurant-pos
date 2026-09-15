# ADR-001: Single-host modular monolith with two clients

**Status:** Accepted

**Date:** 2026-09-10

**Approved by:** Product owner

## Context

The MVP has two distinct interaction surfaces: a touch-first POS and a
desktop-shaped back office. They operate on one restaurant's orders, catalog,
money, printing, audit, and business-day state. Several commands must update
those concerns atomically. The MVP runs on the owner's local development
machine and is not a production floor deployment.

## Decision

Build two independently bootstrapped React/Vite frontend bundles at `/pos/`
and `/back-office/`. Serve both, plus `/api/pos/...` and
`/api/back-office/...`, from one loopback-only Fastify modular monolith backed
by one PostgreSQL database.

The clients have separate route manifests, layouts, session cookies,
audiences, and timeout policies. They share contracts, validation, money,
authentication primitives, and design tokens. Domain rules and transaction
boundaries remain in one server. There is no POS service, back-office service,
backend-for-frontend split, broker, or distributed transaction.

## Options considered

- One responsive application with role- or viewport-hidden navigation.
- Two frontend clients with one modular monolith.
- Separate POS and back-office services.
- A cloud-hosted core.

## Consequences

- Each client can fit its operating context without carrying the other
  client's routes or interaction components.
- POS and back-office commands share one authority and transaction boundary.
- Deployment, observability, and recovery remain small enough for the MVP.
- The loopback-only MVP cannot become a production or LAN deployment without
  completing the documented pre-production gate.
- If a future capability demonstrates independent scaling or deployment
  needs, it requires a new ADR rather than an incidental service split.
