/**
 * Interactive confirmation for property review.
 *
 * Shows each property to the user and lets them accept, quarantine,
 * drop, or accept-all remaining.
 */

import * as readline from "node:readline";
import type {
  PropertyDefinition,
  PropertyEvidenceSource,
  PropertyRiskTag,
} from "@propcheck/common";

const RISK_LABELS: Readonly<Record<PropertyRiskTag, string>> = {
  float_exact_equality: "float ===",
  tiny_abs_tolerance: "tiny ε",
  missing_precondition: "no precondition",
  wide_numeric_domain: "wide range",
  doc_domain_mismatch: "doc mismatch",
  spec_code_conflict: "spec conflict",
  roundtrip_numeric_fragility: "roundtrip fragile",
  metamorphic_scale_risk: "scale risk",
};

const EVIDENCE_SOURCE_LABELS: Readonly<Record<PropertyEvidenceSource, string>> = {
  code: "code",
  doc: "documentation",
  spec: "spec",
  domain: "domain",
  mixed: "mixed",
};

interface ConfirmResult {
  readonly accepted: readonly PropertyDefinition[];
  readonly quarantined: readonly PropertyDefinition[];
  readonly dropped: readonly PropertyDefinition[];
}

/** User action for a single property. */
type UserAction = "accept" | "quarantine" | "drop" | "accept-all" | "quit" | "unknown";

// ANSI codes
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const CYAN = "\x1b[36m";
const YELLOW = "\x1b[33m";

const CONFLICT_RISK_TAGS = new Set<PropertyRiskTag>([
  "doc_domain_mismatch",
  "spec_code_conflict",
]);

function formatRiskTags(tags: readonly PropertyRiskTag[]): string {
  if (tags.length === 0) return "";
  return ` [${tags.map((t) => RISK_LABELS[t] ?? t).join(", ")}]`;
}

function scoreColor(score: number): string {
  if (score >= 12) return "\x1b[32m";
  if (score >= 10) return "\x1b[33m";
  return "\x1b[31m";
}

function formatEvidenceSource(evidenceSource: PropertyEvidenceSource | undefined): string | null {
  if (!evidenceSource) return null;
  return EVIDENCE_SOURCE_LABELS[evidenceSource] ?? evidenceSource;
}

function hasConflictRisk(prop: PropertyDefinition): boolean {
  return prop.riskTags.some((tag) => CONFLICT_RISK_TAGS.has(tag));
}

function formatConflictReviewNote(prop: PropertyDefinition): string | null {
  if (prop.riskTags.includes("spec_code_conflict")) {
    return "Spec-backed intent disagrees with this inferred rule — confirm the behavior is intentional before accepting.";
  }
  if (prop.riskTags.includes("doc_domain_mismatch")) {
    return "Documentation suggests a narrower domain than this rule assumes — confirm the broader behavior is intentional before accepting.";
  }
  const conflicts = prop.riskTags.filter((tag) => CONFLICT_RISK_TAGS.has(tag));
  if (conflicts.length === 0) return null;
  return `${conflicts.map((tag) => RISK_LABELS[tag]).join(", ")} detected — confirm this behavior is intentional before accepting.`;
}

function displayProperty(prop: PropertyDefinition, index: number, total: number): void {
  const riskStr = formatRiskTags(prop.riskTags);
  const statusBadge = prop.status === "quarantined" ? " 🔒 quarantined" :
                      prop.status === "risky" ? " ⚠️  risky" : "";
  const evidenceSource = formatEvidenceSource(prop.evidenceSource);
  const conflictReviewNote = formatConflictReviewNote(prop);

  console.log("");
  console.log(`  ${DIM}[${index + 1}/${total}]${RESET} ${BOLD}${prop.targetFunction}${RESET}: ${prop.description}`);
  console.log(`  ${scoreColor(prop.score)}★ ${prop.score}/13${RESET}${riskStr}${statusBadge}`);
  console.log(`  ${DIM}Category: ${prop.category} | Confidence: ${(prop.confidence * 100).toFixed(0)}%${RESET}`);
  if (evidenceSource) {
    console.log(`  ${DIM}Evidence source: ${evidenceSource}${RESET}`);
  }
  console.log(`  ${CYAN}Assertion:${RESET} ${prop.assertion}`);
  if (prop.evidence) {
    const truncated = prop.evidence.length > 80 ? prop.evidence.slice(0, 77) + "..." : prop.evidence;
    console.log(`  ${DIM}Evidence: ${truncated}${RESET}`);
  }
  if (conflictReviewNote) {
    console.log(`  ${YELLOW}Review note:${RESET} ${conflictReviewNote}`);
  }
}

function askQuestion(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

/** Map raw user input to a normalized action for standard review prompts. */
function parseUserInput(answer: string): UserAction {
  switch (answer) {
    case "a": case "": case "accept": return "accept";
    case "q": case "quarantine": return "quarantine";
    case "d": case "drop": return "drop";
    case "A": case "all": return "accept-all";
    case "Q": case "quit": return "quit";
    default: return "unknown";
  }
}

function parseConflictUserInput(answer: string): UserAction {
  switch (answer) {
    case "i": case "intentional": case "accept": return "accept";
    case "q": case "quarantine": return "quarantine";
    case "d": case "drop": return "drop";
    case "Q": case "quit": return "quit";
    default: return "unknown";
  }
}

async function promptForAction(rl: readline.Interface, prop: PropertyDefinition): Promise<UserAction> {
  const requiresIntentionalConfirmation = hasConflictRisk(prop);
  let action: UserAction = "unknown";

  while (action === "unknown") {
    const raw = await askQuestion(
      rl,
      requiresIntentionalConfirmation
        ? `\n  ${BOLD}Conflict action [i/q/d/Q]:${RESET} `
        : `\n  ${BOLD}Action [a/q/d/A/Q]:${RESET} `,
    );
    action = requiresIntentionalConfirmation ? parseConflictUserInput(raw) : parseUserInput(raw);
    if (action === "unknown") {
      console.log(
        requiresIntentionalConfirmation
          ? `  ${DIM}→ Unrecognized: "${raw}". Use (i)ntentional, (q)uarantine, (d)rop, (Q)uit${RESET}`
          : `  ${DIM}→ Unrecognized: "${raw}". Use (a)ccept, (q)uarantine, (d)rop, (A)ll, (Q)uit${RESET}`,
      );
    }
  }

  return action;
}

/** Log feedback for a user action. */
function logAction(action: UserAction, prop: PropertyDefinition): void {
  const messages: Record<UserAction, string> = {
    "accept": hasConflictRisk(prop) ? "→ Accepted as intentional" : "→ Accepted",
    "quarantine": "→ Quarantined (won't run in CI by default)",
    "drop": "→ Dropped (will not be saved)",
    "accept-all": "→ Accepted (safe rules will be auto-accepted; conflicts still require review)",
    "quit": "", // handled separately
    "unknown": "", // handled separately (re-prompt)
  };
  if (action !== "quit" && action !== "unknown") {
    console.log(`  ${DIM}${messages[action]}${RESET}`);
  }
}

function markHumanVerified(
  property: PropertyDefinition,
  status: PropertyDefinition["status"] = property.status,
): PropertyDefinition {
  return {
    ...property,
    status,
    humanVerified: true,
  };
}

/**
 * Interactively review properties one by one.
 */
export async function confirmProperties(
  properties: readonly PropertyDefinition[],
): Promise<ConfirmResult> {
  if (properties.length === 0) {
    return { accepted: [], quarantined: [], dropped: [] };
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const accepted: PropertyDefinition[] = [];
  const quarantined: PropertyDefinition[] = [];
  const dropped: PropertyDefinition[] = [];
  let acceptAll = false;

  console.log(`\n  ${BOLD}Review ${properties.length} discovered rules:${RESET}`);
  console.log(`  ${DIM}(a)ccept  (q)uarantine  (d)rop  (A)ccept all remaining safe rules  (Q)uit${RESET}`);
  console.log(`  ${DIM}Conflict rules require explicit (i)ntentional confirmation before acceptance.${RESET}`);

  try {
    for (let i = 0; i < properties.length; i++) {
      const prop = properties[i];

      if (acceptAll && !hasConflictRisk(prop)) {
        accepted.push(markHumanVerified(prop));
        continue;
      }

      displayProperty(prop, i, properties.length);
      const action = await promptForAction(rl, prop);

      switch (action) {
        case "accept":
          accepted.push(markHumanVerified(prop));
          break;
        case "quarantine":
          quarantined.push(markHumanVerified(prop, "quarantined"));
          break;
        case "drop":
          dropped.push({ ...prop, status: "dropped" });
          break;
        case "accept-all":
          acceptAll = true;
          accepted.push(markHumanVerified(prop));
          break;
        case "quit":
          console.log(`  ${DIM}→ Quit: remaining ${properties.length - i} rules will be dropped${RESET}`);
          for (let j = i; j < properties.length; j++) {
            dropped.push({ ...properties[j], status: "dropped" });
          }
          return { accepted, quarantined, dropped };
      }
      logAction(action, prop);
    }
  } finally {
    rl.close();
  }

  console.log(`\n  ${BOLD}Review complete:${RESET} ${accepted.length} accepted, ${quarantined.length} quarantined, ${dropped.length} dropped`);
  return { accepted, quarantined, dropped };
}
