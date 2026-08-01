import type { CaseFile } from "./types.js";
import { readDigitsDe } from "./utils/format.js";

// Data-only fields derived directly from the case fixture. Kept separate from
// buildDynamicVariables() below so buildElevenLabsAgentScript() can consume it
// without recursing back into buildDynamicVariables() (which itself calls
// buildElevenLabsAgentScript() to populate opening_context_script).
function rawCaseVariables(caseFile: CaseFile) {
  return {
    case_id: caseFile.id,
    case_title: caseFile.case_title,
    lieferant: caseFile.lieferant,
    vnb_name: caseFile.vnb_name,
    malo_id: caseFile.malo_id,
    malo_id_spoken: readDigitsDe(caseFile.malo_id),
    lieferstelle: caseFile.lieferstelle,
    zaehlernummer: caseFile.zaehlernummer,
    zaehlernummer_spoken: readDigitsDe(caseFile.zaehlernummer),
    anmeldung_datum: caseFile.anmeldung_datum || "nicht vorhanden",
    lieferbeginn: caseFile.lieferbeginn,
    statustext: caseFile.statustext,
    symptom: caseFile.symptom,
    goal: caseFile.goal
  };
}

// The full set of ElevenLabs dynamic variables for a call. Includes both plain
// data (address, MaLo, ...) and behavioral fields (case_specific_guidance,
// tool_sequence_hint, opening_context_script). The behavioral fields exist so
// the ONE persistent ElevenLabs agent prompt (see buildAgentPromptTemplate)
// can vary its actual behavior per case via {{placeholder}} substitution,
// instead of requiring a human to re-paste a new prompt for every case.
export function buildDynamicVariables(caseFile: CaseFile) {
  return {
    ...rawCaseVariables(caseFile),
    case_specific_guidance: caseSpecificGuidance(caseFile.id) || "Keine zusaetzliche fallspezifische Anleitung.",
    tool_sequence_hint: toolSequenceForCase(caseFile.id).join(", "),
    opening_context_script: buildElevenLabsAgentScript(caseFile)
  };
}

// Fully-interpolated preview of what the agent effectively sees once ElevenLabs
// substitutes dynamic variables into buildAgentPromptTemplate()'s placeholders.
// NOT consumed by the runtime call path (the widget never reads this) — it
// exists for human review via /api/agent-config/:caseId ("Open JSON").
export function buildAgentInstructions(caseFile: CaseFile): string {
  const vars = buildDynamicVariables(caseFile);
  const sequence = toolSequenceForCase(caseFile.id);
  const caseGuidance = caseSpecificGuidance(caseFile.id);
  return `
Du bist der telefonische Klaerfall-Agent fuer Nomos. Fuehre ein kurzes deutsches Telefonat mit dem Netzbetreiber.

ERSTE WORTE ZU EINEM MENSCHEN:
"Guten Tag, hier spricht ein KI-Assistent im Auftrag des Stromlieferanten Nomos."

Regeln:
- Sprich immer Deutsch, freundlich, warm, kurz und professionell.
- Wenn zuerst ein Telefonmenue antwortet, erkenne es als Menue und waehle per DTMF:
  - Lieferantenwechsel oder Anmeldung: 1
  - Marktkommunikation oder MaLo-Ident: 2
- Verwende nur synthetische Falldaten.
- Lies MaLo, Zaehlernummern und Vorgangsnummern langsam einzeln vor.
- Wiederhole jede neue MaLo oder Vorgangsnummer zur Bestaetigung, bevor du auflegst.
- Gewinne den Fall: Diagnose plus naechster Schritt ist wichtiger als Small Talk.
- Wenn die Sachbearbeiterin unklar antwortet, frage konkret nach: "Was ist der konkrete Grund?" und "Was ist der naechste Schritt von unserer Seite?"
- Halte wichtige Zwischenschritte mit case.record_call_event fest, wenn ein Menue gewaehlt wurde, ein Grund genannt wurde oder ein Aktenzeichen faellt.
${caseGuidance ? `\nFallspezifische Anleitung:\n${caseGuidance}\n` : ""}

Aktueller Fall:
- Fall: ${vars.case_id} / ${caseFile.case_title}
- Netzbetreiber: ${vars.vnb_name}
- Lieferant: ${vars.lieferant}
- MaLo: ${vars.malo_id_spoken}
- Lieferstelle: ${vars.lieferstelle}
- Zaehlernummer: ${vars.zaehlernummer_spoken}
- Anmeldung: ${vars.anmeldung_datum}
- Lieferbeginn: ${vars.lieferbeginn}
- Status: ${vars.statustext}
- Symptom: ${vars.symptom}
- Ziel: ${vars.goal}

Pflicht-Skills nach dem Gespraech:
${sequence.map((step, index) => `${index + 1}. ${step}`).join("\n")}

case.complete_clearing muss diagnosis, next_step, readback_confirmed und eine kurze backoffice_note_de enthalten.
`;
}

// The ONE case-agnostic prompt template, pasted into the ElevenLabs agent's
// system prompt in the ElevenLabs dashboard exactly once. It never changes
// when the operator switches cases in the UI — only the dynamic variables
// (buildDynamicVariables, sent fresh on every /api/voice-agent/session call)
// change, and ElevenLabs substitutes them into these {{placeholder}}s at
// call time. This is what makes case-switching change agent BEHAVIOR, not
// just the data values it reads out loud.
export function buildAgentPromptTemplate(): string {
  return `
Du bist der telefonische Klaerfall-Agent fuer Nomos. Fuehre ein kurzes deutsches Telefonat mit dem Netzbetreiber.

ERSTE WORTE ZU EINEM MENSCHEN:
"Guten Tag, hier spricht ein KI-Assistent im Auftrag des Stromlieferanten Nomos."

Regeln:
- Sprich immer Deutsch, freundlich, warm, kurz und professionell.
- Wenn zuerst ein Telefonmenue antwortet, erkenne es als Menue und waehle per DTMF:
  - Lieferantenwechsel oder Anmeldung: 1
  - Marktkommunikation oder MaLo-Ident: 2
- Verwende nur synthetische Falldaten.
- Lies MaLo, Zaehlernummern und Vorgangsnummern langsam einzeln vor.
- Wiederhole jede neue MaLo oder Vorgangsnummer zur Bestaetigung, bevor du auflegst.
- Gewinne den Fall: Diagnose plus naechster Schritt ist wichtiger als Small Talk.
- Wenn die Sachbearbeiterin unklar antwortet, frage konkret nach: "Was ist der konkrete Grund?" und "Was ist der naechste Schritt von unserer Seite?"
- Halte wichtige Zwischenschritte mit case.record_call_event fest, wenn ein Menue gewaehlt wurde, ein Grund genannt wurde oder ein Aktenzeichen faellt.

Gespraechseroeffnung fuer diesen Fall:
{{opening_context_script}}

Fallspezifische Anleitung:
{{case_specific_guidance}}

Aktueller Fall:
- Fall: {{case_id}} / {{case_title}}
- Netzbetreiber: {{vnb_name}}
- Lieferant: {{lieferant}}
- MaLo: {{malo_id_spoken}}
- Lieferstelle: {{lieferstelle}}
- Zaehlernummer: {{zaehlernummer_spoken}}
- Anmeldung: {{anmeldung_datum}}
- Lieferbeginn: {{lieferbeginn}}
- Status: {{statustext}}
- Symptom: {{symptom}}
- Ziel: {{goal}}

Pflicht-Skills nach dem Gespraech (in dieser Reihenfolge): {{tool_sequence_hint}}

case.complete_clearing muss diagnosis, next_step, readback_confirmed und eine kurze backoffice_note_de enthalten.
`;
}

export function buildElevenLabsAgentScript(caseFile: CaseFile): string {
  const vars = rawCaseVariables(caseFile);
  if (caseFile.id === "CASE-C") {
    return [
      "Wenn ein Telefonmenue antwortet, waehle per DTMF die 2 fuer Marktkommunikation oder MaLo-Ident.",
      "Sobald eine Person antwortet, sage als erste Worte: Guten Tag, hier spricht ein KI-Assistent im Auftrag des Stromlieferanten Nomos.",
      `Wir wollen einen Kunden bei ${vars.vnb_name} anmelden, aber die Marktlokation, die wir haben, passt nicht zur Adresse, und ueber die automatische Identifikation bekommen wir keine eindeutige zurueck.`,
      `Wir hatten dazu bereits geschrieben, Betreff mit der MaLo ${vars.malo_id_spoken} und Nomos, aber noch keine Rueckmeldung erhalten.`,
      `Wenn die Sachbearbeiterin nach der Adresse fragt: ${vars.lieferstelle}. Erklaere, dass das Haus mehrere Lieferstellen hat und die Adresse allein nicht eindeutig ist.`,
      `Gib dann die Zaehlernummer als klaerendes Merkmal: ${vars.zaehlernummer_spoken}.`,
      "Wenn die Sachbearbeiterin eine korrekte Marktlokation nennt, lies sie sofort digit-by-digit zurueck und frage nach Bestaetigung.",
      "Nach Bestaetigung: case.update_malo mit der korrigierten MaLo aufrufen, dann case.complete_clearing mit Diagnose, naechstem Schritt und readback_confirmed=true, danach case.trigger_signup_next_step.",
      "Der naechste Schritt lautet: Anmeldung mit der korrigierten Marktlokation neu starten."
    ].join("\n");
  }
  return [
    "Guten Tag, hier spricht ein KI-Assistent im Auftrag des Stromlieferanten Nomos.",
    `Ich rufe wegen ${vars.case_id} bei ${vars.vnb_name} an.`,
    `Es geht um die Marktlokation ${vars.malo_id_spoken} an der Lieferstelle ${vars.lieferstelle}.`,
    `Der aktuelle Status lautet: ${vars.statustext}`,
    `Unser Ziel ist: ${vars.goal}`,
    "Koennen Sie mir bitte den konkreten Grund und den naechsten Schritt nennen?"
  ].join("\n");
}

export function buildElevenLabsSkills(caseFile: CaseFile) {
  return toolSequenceForCase(caseFile.id).map((toolName) => ({
    name: toolName,
    when_to_call: skillPurpose(toolName)
  }));
}

function toolSequenceForCase(caseId: string): string[] {
  if (caseId === "CASE-A") {
    return ["case.complete_clearing", "case.trigger_customer_email"];
  }
  if (caseId === "CASE-C") {
    return ["case.update_malo", "case.complete_clearing", "case.trigger_signup_next_step"];
  }
  return ["case.complete_clearing", "case.trigger_signup_next_step"];
}

function skillPurpose(toolName: string): string {
  switch (toolName) {
    case "case.update_malo":
      return "Call immediately after the operator gives a corrected MaLo and the agent reads it back.";
    case "case.complete_clearing":
      return "Call before hangup once diagnosis, next step, and readback status are known.";
    case "case.trigger_customer_email":
      return "Call when Nomos needs new information from the customer before signup can continue.";
    case "case.trigger_signup_next_step":
      return "Call when clearing is complete and the signup workflow can continue.";
    default:
      return "Call when this case requires the skill.";
  }
}

function caseSpecificGuidance(caseId: string): string {
  if (caseId === "CASE-C") {
    return [
      "- Das ist der MaLo-Ident-Fall: Die vorhandene MaLo passt nicht zur Adresse.",
      "- Wenn ein Menue kommt, waehle Marktkommunikation/MaLo-Ident mit DTMF 2.",
      "- Erwaehne nach der KI-Offenlegung, dass Nomos bereits per E-Mail geschrieben hat: Betreff mit der vorhandenen MaLo und Nomos.",
      "- Nutze die Zaehlernummer als entscheidendes Merkmal, weil das Gebaeude mehrere Lieferstellen hat.",
      "- Ziel ist die korrigierte MaLo. Lies sie vollstaendig einzeln zurueck und warte auf Bestaetigung.",
      "- Erfolgreicher Abschluss: corrected_malo speichern, Diagnose 'Adresse war mehrdeutig/alte MaLo passte nicht', naechster Schritt 'Anmeldung mit korrigierter MaLo neu starten'."
    ].join("\n");
  }
  return "";
}
