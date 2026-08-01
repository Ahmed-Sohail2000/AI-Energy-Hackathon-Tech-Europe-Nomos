import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { getCase, loadCases } from "./cases.js";
import {
  buildAgentInstructions,
  buildAgentPromptTemplate,
  buildDynamicVariables,
  buildElevenLabsAgentScript,
  buildElevenLabsSkills
} from "./agentPrompt.js";
import { callTool, toolDefinitions } from "./mcpTools.js";
import { appendEvent, createRun, listRuns, readRun } from "./storage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const app = express();

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "nomos-clearing-agent" });
});

app.get("/api/cases", (_req, res) => {
  res.json(loadCases());
});

app.get("/api/runs", async (_req, res, next) => {
  try {
    res.json(await listRuns());
  } catch (error) {
    next(error);
  }
});

app.get("/api/runs/:runId", async (req, res, next) => {
  try {
    res.json(await readRun(req.params.runId));
  } catch (error) {
    next(error);
  }
});

app.post("/api/voice-agent/session", async (req, res, next) => {
  try {
    const body = z.object({ case_id: z.string() }).parse(req.body);
    const caseFile = getCase(body.case_id);
    if (!process.env.ELEVENLABS_AGENT_ID) {
      const error = new Error("ELEVENLABS_AGENT_ID is required for the embedded voice agent.") as Error & {
        status?: number;
      };
      error.status = 500;
      throw error;
    }
    const run = await createRun(caseFile.id);
    const dynamicVariables = {
      ...buildDynamicVariables(caseFile),
      run_id: run.run_id
    };
    const updated = await appendEvent(run.run_id, {
      event_type: "voice_agent.session_prepared",
      payload: {
        agent_id: process.env.ELEVENLABS_AGENT_ID,
        dynamic_variables: dynamicVariables
      }
    });
    res.json({
      mode: "elevenlabs",
      run: updated,
      agent_id: process.env.ELEVENLABS_AGENT_ID,
      dynamic_variables: dynamicVariables,
      agent_instructions: buildAgentInstructions(caseFile)
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/runs/:runId/simulate-outcome", async (req, res, next) => {
  try {
    const run = await readRun(req.params.runId);
    const outcome = sampleOutcome(run.case_id);
    await callTool("case.complete_clearing", { run_id: run.run_id, outcome });
    if (outcome.corrected_malo) {
      await callTool("case.update_malo", { run_id: run.run_id, corrected_malo: outcome.corrected_malo });
    }
    if (outcome.status === "needs_customer_contact") {
      await callTool("case.trigger_customer_email", { run_id: run.run_id, reason: outcome.diagnosis });
    } else if (outcome.status === "cleared") {
      await callTool("case.trigger_signup_next_step", { run_id: run.run_id });
    }
    res.json(await readRun(run.run_id));
  } catch (error) {
    next(error);
  }
});

app.get("/mcp/tools", (_req, res) => {
  res.json({ tools: toolDefinitions });
});

app.post("/mcp/tools/call", async (req, res, next) => {
  try {
    const body = z.object({ name: z.string(), arguments: z.unknown().optional() }).parse(req.body);
    res.json({ content: await callTool(body.name, body.arguments ?? {}) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/agent-prompt-template", (_req, res) => {
  res.json({
    prompt_template: buildAgentPromptTemplate(),
    note:
      "Paste this ONE template into the ElevenLabs agent's system prompt exactly once, in the ElevenLabs dashboard. " +
      "Do not re-paste it per case: the {{...}} placeholders are filled in automatically from dynamic_variables on " +
      "every /api/voice-agent/session call, which is what makes switching cases in this dashboard change the agent's " +
      "actual behavior, not just the data it reads out loud."
  });
});

app.get("/api/agent-config/:caseId", (req, res, next) => {
  try {
    const caseFile = getCase(req.params.caseId);
    res.json({
      dynamic_variables: buildDynamicVariables(caseFile),
      instructions: buildAgentInstructions(caseFile),
      conversation_script: buildElevenLabsAgentScript(caseFile),
      required_skills: buildElevenLabsSkills(caseFile),
      prompt_template: buildAgentPromptTemplate(),
      elevenlabs_note:
        "instructions/conversation_script are a fully-interpolated PREVIEW of this case only, for human review — " +
        "they are not sent to ElevenLabs at runtime. prompt_template is the case-agnostic prompt to paste into the " +
        "ElevenLabs agent's system prompt ONE TIME (see GET /api/agent-prompt-template); it works for every case " +
        "because it references the same {{dynamic_variable}} placeholders that dynamic_variables supplies fresh on " +
        "each call. Configure required_skills as tools against this app's MCP-style endpoints."
    });
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  const statusValue = error instanceof Error ? (error as Error & { status?: unknown }).status : undefined;
  const status = typeof statusValue === "number" ? statusValue : 400;
  res.status(status).json({ error: message });
});

function sampleOutcome(caseId: string) {
  if (caseId === "CASE-A") {
    return {
      case_id: caseId,
      status: "needs_customer_contact",
      diagnosis: "Der Zaehler war ein Baustromzaehler und wurde am 18.05. ausgebaut; die alte MaLo ist nicht mehr nutzbar.",
      next_step: "Kunden kontaktieren und neue Anlage klaeren.",
      meter_status: "ausgebaut",
      readback_confirmed: true,
      backoffice_note_de:
        "Telefonisch geklaert: Baustromzaehler wurde am 18.05. ausgebaut. Alte MaLo kann nicht genutzt werden. Kunde muss wegen neuer Anlage kontaktiert werden.",
      triggered_action: "customer_email"
    } as const;
  }
  if (caseId === "CASE-C") {
    return {
      case_id: caseId,
      status: "cleared",
      diagnosis: "Adresse war mehrdeutig; Zaehlernummer hat die richtige Marktlokation eindeutig gemacht.",
      next_step: "Anmeldung mit korrigierter MaLo neu starten.",
      corrected_malo: "71005523911",
      readback_confirmed: true,
      backoffice_note_de:
        "Richtige MaLo telefonisch erhalten und zurueckgelesen: 71005523911. Anmeldung mit korrigierter MaLo fortsetzen.",
      triggered_action: "signup_next_step"
    } as const;
  }
  return {
    case_id: caseId,
    status: "cleared",
    diagnosis: "Anmeldung liegt korrekt vor, wurde aber noch nicht weiterbearbeitet.",
    next_step: "Keine Neusendung noetig; Netzbetreiber bearbeitet heute weiter.",
    reference_number: "KL202644817",
    readback_confirmed: true,
    backoffice_note_de:
      "Anmeldung ist eingegangen und korrekt. Keine Neusendung erforderlich. Vorgangsnummer KL202644817, Bearbeitung erfolgt heute.",
    triggered_action: "signup_next_step"
  } as const;
}
