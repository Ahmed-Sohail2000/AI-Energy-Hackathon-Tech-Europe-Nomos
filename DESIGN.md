# Nomos Console Design

Use this as the portable UI brief for Stitch or any design handoff.

## Product Feel

Operational, calm, and precise. The console should feel like a professional back-office tool for clearing energy-market calls, not a marketing page.

## Screens

1. Cases: compact queue with case type, operator, and status.
2. Setup: selected case facts plus connector/tool readiness.
3. Call: launch or simulate the voice-agent workflow.
4. Review: recent runs and structured outcomes.

## Visual Rules

- White and soft neutral surfaces with green action accents and blue informational accents.
- 8px radius for cards, buttons, and panels.
- Dense spacing, low copy, clear labels.
- Avoid large decorative artwork, gradients, or oversized text blocks.
- Mobile layout stacks screens with sticky navigation at the top.
- **Split register by section**: the landing/marketing section (hero, flow, use cases, stack) is allowed a confident display headline — capped at `clamp(2.6rem, 4.4vw, 4.2rem)`, not the maximal marketing-scale size a landing page might default to — while the operator console section stays strictly dense/utilitarian per this brief. This is a deliberate compromise: a console-only product still needs a landing page that reads as a product, but the console itself should never adopt marketing-page proportions.

## Interaction Rules

- Primary path is always `Next`.
- Secondary actions are copy config, open JSON config, refresh, and simulate outcome.
- Connector names shown in UI: ElevenLabs, Web Widget, Agent Prompt, MCP Tools. (This app is browser-widget-only — there is no Twilio, OpenAI, or Google Stitch integration.)
- MCP tools should be visible as short command chips, not long paragraphs.
