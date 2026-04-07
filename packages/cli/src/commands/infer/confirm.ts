/**
 * Interactive confirmation for property review.
 *
 * Shows each property to the user and lets them accept, quarantine,
 * drop, or accept-all remaining.
 */

import * as readline from "node:readline";
import type { PropertyDefinition } from "@propcheck/common";

const RISK_LABELS: Readonly<Record<string, string>> = {
  float_exact_equality: "float ===",
  tiny_abs_tolerance: "tiny ε",
  missing_precondition: "no precondition",
  wide_numeric_domain: "wide range",
  doc_domain_mismatch: "doc mismatch",
  roundtrip_numeric_fragility: "roundtrip fragile",
  metamorphic_scale_risk: "scale risk",
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

function formatRiskTags(tags: readonly string[]): string {
  if (tags.length === 0) return "";
  return ` [${tags.map((t) => RISK_LABELS[t] ?? t).join(", ")}]`;
}

function scoreColor(score: number): string {
  if (score >= 12) return "\x1b[32m";
  if (score >= 10) return "\x1b[33m";
  return "\x1b[31m";
}

function displayProperty(prop: PropertyDefinition, index: number, total: number): void {
  const riskStr = formatRiskTags(prop.riskTags);
  const statusBadge = prop.status === "quarantined" ? " 🔒 quarantined" :
                      prop.status === "risky" ? " ⚠️  risky" : "";

  console.log("");
  console.log(`  ${DIM}[${index + 1}/${total}]${RESET} ${BOLD}${prop.targetFunction}${RESET}: ${prop.description}`);
  console.log(`  ${scoreColor(prop.score)}★ ${prop.score}/13${RESET}${riskStr}${statusBadge}`);
  console.log(`  ${DIM}Category: ${prop.category} | Confidence: ${(prop.confidence * 100).toFixed(0)}%${RESET}`);
  console.log(`  ${CYAN}Assertion:${RESET} ${prop.assertion}`);
  if (prop.evidence) {
    const truncated = prop.evidence.length > 80 ? prop.evidence.slice(0, 77) + "..." : prop.evidence;
    console.log(`  ${DIM}Evidence: ${truncated}${RESET}`);
  }
}

function askQuestion(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

/** Map raw user input to a normalized action. */
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

/** Log feedback for a user action. */
function logAction(action: UserAction): void {
  const messages: Record<UserAction, string> = {
    "accept": "→ Accepted",
    "quarantine": "→ Quarantined (won't run in CI by default)",
    "drop": "→ Dropped (will not be saved)",
    "accept-all": "→ Accepted (accepting all remaining)",
    "quit": "", // handled separately
    "unknown": "", // handled separately (re-prompt)
  };
  if (action !== "quit" && action !== "unknown") {
    console.log(`  ${DIM}${messages[action]}${RESET}`);
  }
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
  console.log(`  ${DIM}(a)ccept  (q)uarantine  (d)rop  (A)ccept all remaining  (Q)uit${RESET}`);

  try {
    for (let i = 0; i < properties.length; i++) {
      const prop = properties[i];

      if (acceptAll) { accepted.push(prop); continue; }

      displayProperty(prop, i, properties.length);

      // Re-prompt loop for unrecognized input
      let action: UserAction = "unknown";
      while (action === "unknown") {
        const raw = await askQuestion(rl, `\n  ${BOLD}Action [a/q/d/A/Q]:${RESET} `);
        action = parseUserInput(raw);
        if (action === "unknown") {
          console.log(`  ${DIM}→ Unrecognized: "${raw}". Use (a)ccept, (q)uarantine, (d)rop, (A)ll, (Q)uit${RESET}`);
        }
      }

      switch (action) {
        case "accept":
          accepted.push(prop);
          break;
        case "quarantine":
          quarantined.push({ ...prop, status: "quarantined" });
          break;
        case "drop":
          dropped.push({ ...prop, status: "dropped" });
          break;
        case "accept-all":
          acceptAll = true;
          accepted.push(prop);
          break;
        case "quit":
          console.log(`  ${DIM}→ Quit: remaining ${properties.length - i} rules will be dropped${RESET}`);
          for (let j = i; j < properties.length; j++) {
            dropped.push({ ...properties[j], status: "dropped" });
          }
          return { accepted, quarantined, dropped };
      }
      logAction(action);
    }
  } finally {
    rl.close();
  }

  console.log(`\n  ${BOLD}Review complete:${RESET} ${accepted.length} accepted, ${quarantined.length} quarantined, ${dropped.length} dropped`);
  return { accepted, quarantined, dropped };
}
