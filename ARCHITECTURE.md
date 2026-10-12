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

## Phase 2: feature boundaries

The client controller in `app/gather.tsx` retains navigation, async state management, and modal orchestration. The following **presentational feature pages** now receive their data and callbacks as props, preserving the same DOM markup and event behavior:

- `app/components/orders-page.tsx`: order history, pickup progress and review entry points.
- `app/components/shared-carts-page.tsx`: invitations, member removal/restoration, and shared-cart navigation.
- `app/components/account-page.tsx`: account settings and profile submission.
- `app/types.ts`: the shared typed snapshot contract for feature components and parent state.

The existing `POST /api/gather` action dispatcher still handles all requests at the same URL. Two independent responsibilities are now delegated to functions without altering action names or responses:

- `app/api/gather/actions/reviews.ts`: submission and validation of customer reviews.
- `app/api/gather/actions/employee.ts`: employee order status, inventory, and store administration.

The shopping view, cart sidebar and checkout modal remain in the controller for a later, separately tested extraction. The cart and checkout authorization/database semantics have **not** been changed. This refactor adds no migrations and makes no deliberate behavioral changes.

### Verification gate

This change should be merged only after `npm run typecheck`, `npm run lint`, `npm run test:flows` and manual visual checks pass on the branch. Run `npm run dev` while executing flow tests in a second terminal. Pay particular attention to shared-cart invitation joining, removal/restoration, profile editing, order reviews and the employee dashboard.

### Lint migration note

Phase 2 also fixes React's ref mutation warnings by synchronizing callback/data refs after commits, uses Next's client-side link component for the home navigation, and removes unused imports. The original code extensively uses `any` around untyped JSON and D1 results; ESLint's `no-explicit-any` rule is temporarily exempted **only in those legacy and extracted modules**, rather than disabling it project-wide. This avoids changing runtime data semantics during this behavior-preserving refactor. Properly typed API action payloads, database rows and client snapshots should be introduced gradually in a later PR; the exception should then be removed. The TypeScript compiler remains enabled.
