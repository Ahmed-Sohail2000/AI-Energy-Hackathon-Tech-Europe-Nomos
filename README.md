# Nomos Clearing Voice Agent

Runnable MVP for the Nomos energy-market voice-agent challenge.

## What It Does

- Loads the synthetic Nomos fixture cases.
- Builds German agent instructions and dynamic variables for ElevenLabs Conversational AI.
- Embeds the ElevenLabs voice agent directly in the dashboard.
- Exposes MCP-style tools for case lookup, call logging, clearing completion, MaLo update, signup continuation, and customer-email handoff.
- Stores run state as local JSON under `data/runs`.
- Provides a local dashboard at `http://localhost:3001`.

## Setup

```powershell
cd nomos-clearing-agent
copy .env.example .env
npm install
npm run dev
```

Set `.env` values:

```env
PORT=3001
ELEVENLABS_AGENT_ID=...
```

## ElevenLabs Agent Configuration

This app uses **one** ElevenLabs Conversational AI agent for every case — the agent's system prompt is a template, not per-case text, so it only needs to be set up once:

1. Open `GET /api/agent-prompt-template` and paste the `prompt_template` value into the ElevenLabs agent's system prompt, in the ElevenLabs dashboard. Do this **once** — never re-paste it per case.
2. Configure the ElevenLabs agent's tools to call `POST /mcp/tools/call` on this app (locally: `http://localhost:3001/mcp/tools/call`; when deployed, use that deployment's URL).
3. That's it. When the dashboard starts a session via `/api/voice-agent/session`, it sends fresh `dynamic_variables` (case data **and** case-specific behavioral fields — `case_specific_guidance`, `tool_sequence_hint`, `opening_context_script`) that ElevenLabs substitutes into the `{{...}}` placeholders in the template. This is what makes switching cases in the dashboard change the agent's actual behavior, not just the data it reads out loud.

`GET /api/agent-config/:caseId` still exists for human debugging — it returns a fully-interpolated **preview** of what the agent effectively sees for that one case (`instructions`, `conversation_script`), but that preview is not sent to ElevenLabs at runtime; only the one `prompt_template` plus per-call `dynamic_variables` are.

The agent must:

- Speak German.
- Disclose AI as first words to a human.
- Handle menu-like prompts when they appear in the test conversation.
- Read long numbers one character at a time.
- Use the MCP-style tools to store the outcome and trigger the next action.

## Validation Checklist

Automated (`npm test`):
- Digit-by-digit readback formatting, prompt/script generation for all three cases.
- `POST /api/voice-agent/session` creates a run and returns the new behavioral dynamic-variable fields; unknown `case_id` → 404; missing `ELEVENLABS_AGENT_ID` → 500.
- `POST /mcp/tools/call` completes a run via `case.complete_clearing`; unknown tool name is rejected.

Manual:
- Dashboard loads and lists CASE-A, CASE-B, CASE-C.
- "Simulate outcome" completes each case with its expected canned action (customer email for CASE-A, signup next step + reference number for CASE-B, corrected MaLo + signup next step for CASE-C).
- With the one-time `prompt_template` pasted into the ElevenLabs dashboard, a live widget run for CASE-C specifically follows the CASE-C-only playbook (DTMF 2, meter-number disambiguation, MaLo readback) — this is the concrete proof that case-switching changes agent behavior, not just data.

## Sources Used

- https://github.com/nomos-energy/voice-agent/
- https://github.com/nomos-energy/voice-agent/blob/main/CHEATSHEET.md
- https://github.com/nomos-energy/voice-agent/blob/main/fixtures.json
- https://github.com/nomos-energy/voice-agent/tree/main/recordings
