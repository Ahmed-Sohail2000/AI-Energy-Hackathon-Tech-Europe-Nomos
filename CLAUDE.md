# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install                 # install dependencies
npm run dev                 # start the server in watch mode (tsx), default http://localhost:3001
npm start                   # start the server once, no watch
npm run typecheck           # tsc --noEmit
npm test                    # vitest run (all tests)
npx vitest run tests/server.test.ts   # run a single test file
npx vitest run -t "returns 404"       # run tests matching a name
```

Run `npm run typecheck && npm test` before handing off any change — a `PostToolUse` hook (`.claude/settings.json` + `.claude/hooks/post-edit-check.cjs`) already does this automatically for edits under `src/**`/`tests/**`.

## Architecture

This is a single-agent, single-region MVP: an Express + TypeScript backend (`src/`) serving a framework-free HTML/CSS/JS frontend (`public/`) for a German energy-market "clearing call" back-office console. `src/app.ts` builds the Express app (routes, middleware); `src/server.ts` is the thin entry point that imports it and calls `.listen()` — this split exists so `tests/server.test.ts` can import the app without binding the configured port.

**The voice agent is entirely client-side.** There is no server-side ElevenLabs SDK/WebSocket relay. The frontend (`public/app.js`) mounts an `<elevenlabs-convai>` web component (from the `@elevenlabs/convai-widget-embed` CDN script) directly in the DOM; the browser talks to ElevenLabs' Conversational AI service on its own. The backend's only job is to mint a `run_id`, build `dynamic_variables`, and return them for the widget to use.

**Critical: one ElevenLabs agent for every case — prompt is a template, not per-case text.** ElevenLabs Conversational AI uses a single persistent agent (`ELEVENLABS_AGENT_ID`) whose system prompt is edited by a human in the ElevenLabs dashboard, not sent per API call. So case-specific *behavior* (which DTMF option to press, what to say when a menu answers, which tools to call in what order) cannot be pushed per-request the way case *data* is. The fix implemented here: `src/agentPrompt.ts` has two parallel builders —
- `buildAgentPromptTemplate()` — a case-agnostic string with `{{placeholder}}` tokens (e.g. `{{case_specific_guidance}}`, `{{tool_sequence_hint}}`, `{{opening_context_script}}`). This is pasted into the ElevenLabs dashboard **exactly once**, ever. `GET /api/agent-prompt-template` serves it.
- `buildDynamicVariables(caseFile)` — returns both plain data fields (MaLo, address, ...) *and* the three behavioral fields above, computed per case. These are sent fresh on every `POST /api/voice-agent/session` call, and ElevenLabs substitutes them into the template's placeholders at call time.

This is what makes switching cases in the dashboard change the agent's actual behavior, not just the data it reads aloud. If you touch `buildDynamicVariables()` or `buildAgentPromptTemplate()`, keep every placeholder name in sync between the two, or the substitution silently produces a broken prompt. `buildAgentInstructions(caseFile)` (fully-interpolated, case-specific) still exists but is **not** sent to ElevenLabs at runtime — it's a human-readable preview only (used by `GET /api/agent-config/:caseId`'s "Open JSON" / "Copy config" affordances in the Setup step).

`rawCaseVariables()` in `agentPrompt.ts` exists solely to break a recursion: `buildDynamicVariables()` calls `buildElevenLabsAgentScript()` to populate `opening_context_script`, and `buildElevenLabsAgentScript()` needs case data too — it reads from `rawCaseVariables()`, not `buildDynamicVariables()`, to avoid calling itself indirectly.

**Telephony was deliberately removed, not forgotten.** An earlier iteration placed real phone calls via Twilio (`src/twilioClient.ts`, TwiML routes, a WebSocket bridge to ElevenLabs). That was fully deleted in commit `90c75d0` ("Switch dashboard to direct ElevenLabs agent") in favor of the current browser-widget-only flow. Do not reintroduce Twilio/telephony code as a "fix" unless explicitly asked — the absence is intentional. `PUBLIC_BASE_URL` was a Twilio-era env var (used to build webhook callback URLs) and has been removed from `.env.example`/README as dead config; there is nothing in the current architecture that needs a public callback URL.

**Agent persona source of truth**: `agents/*.md` are the prose spec for the agent's persona, required tool sequence, and German conversation scripts. `src/agentPrompt.ts` is the code implementation of that spec (`buildAgentPromptTemplate()` mirrors `agents/nomos-clearing-agent.md`; the runtime-variables list in `agents/elevenlabs-agent-skills.md` must match `buildDynamicVariables()`'s keys). If you change one, change the other.

**Storage is flat JSON files**, no database: `src/storage.ts` writes one file per run under `data/runs/<run_id>.json` (gitignored, created at runtime). `data/fixtures.json` holds the three synthetic cases (CASE-A/B/C) — all data is explicitly synthetic (see its `_note` field), never real customer data.

**MCP-style tools** (`src/mcpTools.ts`, exposed over plain HTTP at `GET /mcp/tools` and `POST /mcp/tools/call`, not the actual MCP protocol) are how the live ElevenLabs agent reports outcomes back mid-conversation — `case.complete_clearing` is the tool that marks a run `completed` and stores the structured `ClearingOutcome`. `POST /api/runs/:runId/simulate-outcome` (backed by the hardcoded `sampleOutcome()` in `src/app.ts`) is a separate, explicitly-labeled demo path for exercising the UI without a live call — it is not meant to reflect real call outcomes and should stay hardcoded.

**Error status codes**: `getCase()` (`src/cases.ts`) throws with `.status = 404` for an unknown `case_id`; the missing-`ELEVENLABS_AGENT_ID` check in `app.ts` throws with `.status = 500`. The catch-all error middleware in `app.ts` reads that `.status` (defaulting to 400) — when adding new failure paths, attach `.status` the same way rather than letting everything collapse to 400.
