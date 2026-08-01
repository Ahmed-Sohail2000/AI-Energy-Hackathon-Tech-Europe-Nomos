# Nomos MCP-Style Tools

The MVP exposes MCP-style tool calls over HTTP:

- `GET /mcp/tools`
- `POST /mcp/tools/call`

Call payload:

```json
{
  "name": "case.get",
  "arguments": {
    "case_id": "CASE-A"
  }
}
```

## Tools

- `case.get(case_id)`: load one synthetic fixture case.
- `case.record_call_event(run_id, event_type, payload)`: append transcript or milestone data.
- `case.complete_clearing(run_id, outcome)`: store the final structured clearing result.
- `case.update_malo(run_id, corrected_malo)`: record a corrected MaLo.
- `case.trigger_signup_next_step(run_id)`: mock continuing the signup process.
- `case.trigger_customer_email(run_id, reason)`: mock handoff to the email agent.

## Required Tool Sequence

- CASE-A: `case.complete_clearing` then `case.trigger_customer_email`.
- CASE-B: `case.complete_clearing` then `case.trigger_signup_next_step`.
- CASE-C: `case.update_malo`, `case.complete_clearing`, then `case.trigger_signup_next_step`.

The live agent learns this sequence per case via the `tool_sequence_hint` dynamic variable — see `agents/nomos-clearing-agent.md`'s "Delivery Mechanism" section.
