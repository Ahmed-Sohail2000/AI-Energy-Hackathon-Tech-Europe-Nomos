# Repository Guidelines

## Project Structure & Module Organization

This project is a TypeScript/Express MVP for the Nomos clearing-call voice agent.

- `src/` contains server code (`app.ts` builds the Express app, `server.ts` starts it), case loading, MCP-style tool handlers, agent prompt/dynamic-variable building, storage, and formatting utilities. There is no telephony integration — an earlier Twilio-based phone-call flow was deliberately removed (commit `90c75d0`) in favor of the browser-embedded ElevenLabs widget; that absence is intentional, not a gap to fill in.
- `public/` contains the lightweight dashboard UI.
- `agents/` contains Markdown prompt, domain-knowledge, and MCP-tool guidance for the voice agent.
- `data/fixtures.json` contains synthetic Nomos challenge cases; `data/runs/` stores local run JSON output.
- `tests/` contains Vitest unit tests.

Keep new source modules small and grouped by responsibility. Shared types belong in `src/types.ts`; reusable helpers belong under `src/utils/`.

## Build, Test, and Development Commands

- `npm install` installs dependencies.
- `npm run dev` starts the server in watch mode with `tsx`.
- `npm start` starts the server once.
- `npm run typecheck` runs TypeScript validation without emitting files.
- `npm test` runs the Vitest suite.
- `npm audit --audit-level=moderate` checks dependency security.

The local dashboard runs at `http://localhost:3001` by default.

## Coding Style & Naming Conventions

Use TypeScript ES modules and strict typing. Prefer explicit exported functions over large classes. Use two-space indentation, semicolons, and descriptive camelCase names for variables and functions. Type names should be PascalCase, such as `CaseFile` or `ClearingOutcome`.

Keep user-facing German agent instructions in Markdown or prompt-builder modules, not scattered through route handlers.

## Testing Guidelines

Tests use Vitest and live in `tests/*.test.ts`. Add focused tests for behavior that affects safety, routing, or structured outcomes, especially:

- digit-by-digit readback formatting
- route/integration coverage for `/api/voice-agent/session` and `/mcp/tools/call` (see `tests/server.test.ts`)
- MCP tool behavior
- fixture and prompt generation

Run `npm run typecheck` and `npm test` before handing off changes.

## Commit & Pull Request Guidelines

Use short imperative commit messages, for example `Fix agent prompt template placeholders`.

Pull requests should include a concise summary, test results, linked issue or challenge requirement, and screenshots for dashboard UI changes.

## Security & Configuration Tips

Never commit real customer data or secrets. Use `.env` for `ELEVENLABS_AGENT_ID` (see `.env.example`). There is no outbound telephony in the current architecture, so there is no number-dialing guardrail to maintain — the app never places a real phone call; all voice interaction happens through the browser-embedded ElevenLabs widget.
