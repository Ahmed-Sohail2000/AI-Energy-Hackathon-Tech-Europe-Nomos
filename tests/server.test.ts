import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AddressInfo } from "node:net";
import { app } from "../src/app.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const runsDir = path.join(__dirname, "..", "data", "runs");

let baseUrl: string;
let server: ReturnType<typeof app.listen>;
const createdRunIds: string[] = [];

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await Promise.all(createdRunIds.map((runId) => fs.rm(path.join(runsDir, `${runId}.json`), { force: true })));
});

describe("POST /api/voice-agent/session", () => {
  it("creates a run and returns behavioral dynamic variables for a valid case", async () => {
    process.env.ELEVENLABS_AGENT_ID = "test-agent";
    const res = await fetch(`${baseUrl}/api/voice-agent/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ case_id: "CASE-C" })
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    createdRunIds.push(body.run.run_id);
    expect(body.mode).toBe("elevenlabs");
    expect(body.dynamic_variables.case_specific_guidance).toContain("MaLo-Ident-Fall");
    expect(body.dynamic_variables.tool_sequence_hint).toBe(
      "case.update_malo, case.complete_clearing, case.trigger_signup_next_step"
    );
    expect(body.dynamic_variables.opening_context_script).toContain("Guten Tag");
  });

  it("returns 404 for an unknown case_id", async () => {
    process.env.ELEVENLABS_AGENT_ID = "test-agent";
    const res = await fetch(`${baseUrl}/api/voice-agent/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ case_id: "CASE-NOPE" })
    });
    expect(res.status).toBe(404);
  });

  it("returns 500 when ELEVENLABS_AGENT_ID is not configured", async () => {
    delete process.env.ELEVENLABS_AGENT_ID;
    const res = await fetch(`${baseUrl}/api/voice-agent/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ case_id: "CASE-A" })
    });
    expect(res.status).toBe(500);
  });
});

describe("GET /api/agent-prompt-template", () => {
  it("returns a case-agnostic template with placeholders, not literal case data", async () => {
    const res = await fetch(`${baseUrl}/api/agent-prompt-template`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.prompt_template).toContain("{{case_id}}");
    expect(body.prompt_template).toContain("{{case_specific_guidance}}");
    expect(body.prompt_template).toContain("{{tool_sequence_hint}}");
    expect(body.prompt_template).not.toContain("CASE-A");
  });
});

describe("POST /mcp/tools/call", () => {
  it("completes a run via case.complete_clearing", async () => {
    process.env.ELEVENLABS_AGENT_ID = "test-agent";
    const sessionRes = await fetch(`${baseUrl}/api/voice-agent/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ case_id: "CASE-B" })
    });
    const session = await sessionRes.json();
    createdRunIds.push(session.run.run_id);

    const res = await fetch(`${baseUrl}/mcp/tools/call`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "case.complete_clearing",
        arguments: {
          run_id: session.run.run_id,
          outcome: {
            case_id: "CASE-B",
            status: "cleared",
            diagnosis: "test diagnosis",
            next_step: "test next step",
            readback_confirmed: true,
            backoffice_note_de: "test note"
          }
        }
      })
    });
    expect(res.status).toBe(200);

    const runRes = await fetch(`${baseUrl}/api/runs/${session.run.run_id}`);
    const run = await runRes.json();
    expect(run.status).toBe("completed");
    expect(run.outcome.diagnosis).toBe("test diagnosis");
  });

  it("surfaces an error for an unknown tool name", async () => {
    const res = await fetch(`${baseUrl}/mcp/tools/call`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "case.nonexistent", arguments: {} })
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Unknown tool");
  });
});
