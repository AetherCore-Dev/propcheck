/**
 * Property line formatter — single row in the results table.
 */

import chalk from "chalk";
import type {
  PropertyDefinition,
  PropertyOutcome,
  PropertyRiskTag,
} from "@propcheck/common";

/** User-friendly short labels for risk tags. */
const RISK_LABELS: Readonly<Record<PropertyRiskTag, string>> = {
  float_exact_equality: "float ===",
  tiny_abs_tolerance: "tight tolerance",
  missing_precondition: "no precondition",
  wide_numeric_domain: "wide range",
  doc_domain_mismatch: "doc mismatch",
  spec_code_conflict: "spec conflict",
  roundtrip_numeric_fragility: "roundtrip fragile",
  metamorphic_scale_risk: "scale risk",
};

function formatRiskTags(tags: readonly PropertyRiskTag[]): string {
  if (tags.length === 0) return "";
  const labels = tags.map((t) => RISK_LABELS[t] ?? t);
  return ` ${chalk.yellow(`(${labels.join(", ")})`)}`;
}

function formatStatus(property: PropertyDefinition): string {
  const statusLabel = (() => {
    switch (property.status) {
      case "risky":
        return chalk.yellow("[risky]");
      case "refined":
        return chalk.cyan("[refined]");
      case "quarantined":
      case "dropped":
        return chalk.gray(`[${property.status}]`);
      default:
        return "";
    }
  })();
  const status = statusLabel ? ` ${statusLabel}` : "";
  const risk = formatRiskTags(property.riskTags);
  return `${status}${risk}`;
}

export function formatPropertyLine(
  property: PropertyDefinition,
  outcome?: PropertyOutcome,
): string {
  const desc = `${property.targetFunction}: ${property.description}`;
  const padded = desc.padEnd(50);
  const id = chalk.dim(`[${property.id}]`);

  const meta = formatStatus(property);

  if (!outcome) {
    // Inference display — show quality as visual indicator
    const scoreNum = property.score;
    const quality = scoreNum >= 12 ? chalk.green("★") : scoreNum >= 9 ? chalk.yellow("★") : chalk.red("★");
    return `  ${chalk.cyan("*")} ${padded} ${quality} ${chalk.dim(`${scoreNum}/13`)}${meta}`;
  }

  switch (outcome.status) {
    case "passed": {
      const iters = `(${outcome.iterations}/${outcome.iterations})`;
      const dur = `${(outcome.duration / 1000).toFixed(1)}s`;
      return `  ${chalk.green("\u2713")} ${id} ${padded} ${chalk.green("PASS")} ${chalk.dim(iters)}  ${chalk.dim(dur)}${meta}`;
    }
    case "failed": {
      return `  ${chalk.red("\u2717")} ${id} ${padded} ${chalk.red("FAIL")}${meta}`;
    }
    case "error": {
      return `  ${chalk.yellow("\u26A0")} ${id} ${padded} ${chalk.yellow("ERROR")}${meta}`;
    }
  }
}
