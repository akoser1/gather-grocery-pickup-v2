# Application architecture

Gather is a React/TypeScript grocery pickup prototype with a Vinext frontend and a Cloudflare Workers D1-backed API. Refactoring here intentionally preserves existing routes, API request/response contracts, persistence, and user-facing behavior.

## Modules

- `app/gather.tsx`: top-level client orchestration for shopping, cart state, navigation, modals, and actions.
- `app/components/product-card.tsx`: stateless product presentation, quantity buttons, and stock labels. Receives its stock, quantity, store, busy state, and callback from the parent.
- `app/catalog.ts`: the existing sample product/store catalog and price helpers.
- `app/api/gather/route.ts`: GET and POST route handlers and existing action dispatch, preserving the original API endpoints and action names.
- `app/api/gather/server.ts`: shared persistence, session, password, access, seed, and error-handling helpers.
- `app/api/gather/snapshot.ts`: read model for the data returned to the frontend, including open carts, members, orders, inventory, and reviews.
- `db/schema.ts` and `drizzle/`: the unchanged D1/SQLite schema and migrations.

## Behavior-preservation rules

- Keep the `/api/gather` GET and POST interfaces and authentication/session semantics unchanged.
- Backend checks remain the source of truth for permissions and inventory limits. UI quantity buttons are only a convenience.
- Checkout closes the cart, expires its invitation, and revokes members' access as before.
- Removed members cannot rejoin until restored by the owner.
- Product inventory and unavailable-state presentation use the existing store-specific stock values.
- Preserve the existing HTML class names and CSS, preserving the user interface.

## Validation before merging

In a local checkout of this branch:

```bash
npm install
npm run setup
npm run typecheck
npm run lint
npm run dev
```

While the development server is running, use another terminal to run `npm run test:flows`. Also manually check shopping, stock limits, shared-cart removal/rejoining, checkout, and order history.

This is a deliberate incremental architectural refactor, not a rewrite. Subsequent splits of the larger page/controller and POST action dispatcher should be performed separately, with tests after each step.
