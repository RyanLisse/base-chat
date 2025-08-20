# Testing

This project uses Vitest for unit tests and Playwright for optional E2E tests.

## Setup

- Install deps: `npm install`
- Optional browsers (E2E): `npm run e2e:install`

## Commands

- Unit tests (watch): `npm run test:watch`
- Unit tests (CI): `npm run test`
- Coverage report: `npm run coverage` (outputs to `coverage/`)
- E2E tests: with the app running locally (`npm run dev`), run `npm run e2e`

## Notes

- Unit tests run in a jsdom environment.
- Zustand stores are tested in isolation. The `chat-store` IndexedDB adapter is mocked to an in-memory map.
- The Playwright smoke test is skipped by default unless you run a local server.

