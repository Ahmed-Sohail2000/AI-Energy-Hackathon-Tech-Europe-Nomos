import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CaseFile } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesPath = path.join(__dirname, "..", "data", "fixtures.json");

export function loadCases(): CaseFile[] {
  const raw = JSON.parse(fs.readFileSync(fixturesPath, "utf8")) as { cases: CaseFile[] };
  return raw.cases;
}

export function getCase(caseId: string): CaseFile {
  const match = loadCases().find((item) => item.id === caseId);
  if (!match) {
    const error = new Error(`Unknown case_id: ${caseId}`) as Error & { status?: number };
    error.status = 404;
    throw error;
  }
  return match;
}
