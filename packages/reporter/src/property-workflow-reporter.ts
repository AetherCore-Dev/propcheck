/**
 * Property Workflow Reporter — display property inventory and details.
 *
 * Used by `propcheck props` and `propcheck property` commands.
 */

import chalk from "chalk";
import type {
  PropertyDefinition,
  PropertySet,
  PropertyStatus,
} from "@propcheck/common";

/* ── helpers ────────────────────────────────────── */

function statusIcon(status: PropertyStatus): string {
  switch (status) {
    case "accepted":
      return chalk.green("●");
    case "risky":
      return chalk.yellow("●");
    case "refined":
      return chalk.cyan("●");
    case "quarantined":
      return chalk.gray("○");
    case "dropped":
      return chalk.strikethrough(chalk.gray("○"));
  }
}

function statusBadge(status: PropertyStatus): string {
  switch (status) {
    case "accepted":
      return chalk.green(status);
    case "risky":
      return chalk.yellow(status);
    case "refined":
      return chalk.cyan(status);
    case "quarantined":
      return chalk.gray(status);
    case "dropped":
      return chalk.strikethrough(chalk.gray(status));
  }
}

function summarize(text: string, maxLen: number): string {
  return text.length > maxLen ? text.slice(0, maxLen - 1) + "…" : text;
}

/* ── overview (propcheck props) ─────────────────── */

export interface PropertiesOverviewJson {
  readonly modules: readonly {
    readonly filePath: string;
    readonly properties: readonly {
      readonly id: string;
      readonly targetFunction: string;
      readonly description: string;
      readonly status: PropertyStatus;
      readonly humanVerified: boolean;
      readonly riskScore: number;
      readonly riskTags: readonly string[];
    }[];
    readonly summary: {
      readonly total: number;
      readonly accepted: number;
      readonly risky: number;
      readonly refined: number;
      readonly quarantined: number;
      readonly dropped: number;
    };
  }[];
}

export function reportPropertiesOverview(
  propertySets: readonly PropertySet[],
  statusFilter?: PropertyStatus,
): void {
  if (propertySets.length === 0) {
    console.log("\n  No properties found. Run: propcheck infer <file>\n");
    return;
  }

  for (const ps of propertySets) {
    const props = statusFilter
      ? ps.properties.filter((p) => p.status === statusFilter)
      : ps.properties;

    if (props.length === 0) continue;

    console.log("");
    console.log(chalk.bold(`  ${ps.filePath}`));

    for (const p of props) {
      const icon = statusIcon(p.status);
      const desc = summarize(`${p.targetFunction}: ${p.description}`, 50);
      const badge = statusBadge(p.status);
      const verified = p.humanVerified ? chalk.green(" ✔ verified") : "";
      const risk =
        p.riskTags.length > 0
          ? chalk.yellow(` risk:${p.riskTags.join(",")}`)
          : "";
      console.log(`    ${icon} ${chalk.dim(p.id)} ${desc}  ${badge}${verified}${risk}`);
    }

    // Module summary
    const counts = countByStatus(ps.properties);
    const parts: string[] = [];
    parts.push(`${ps.properties.length} total`);
    if (counts.accepted > 0) parts.push(chalk.green(`${counts.accepted} accepted`));
    if (counts.risky > 0) parts.push(chalk.yellow(`${counts.risky} risky`));
    if (counts.refined > 0) parts.push(chalk.cyan(`${counts.refined} refined`));
    if (counts.quarantined > 0) parts.push(chalk.gray(`${counts.quarantined} quarantined`));
    if (counts.dropped > 0) parts.push(chalk.gray(`${counts.dropped} dropped`));
    console.log(chalk.dim(`    ── ${parts.join(" | ")}`));
  }
  console.log("");
}

export function reportPropertiesOverviewAsJson(
  propertySets: readonly PropertySet[],
  statusFilter?: PropertyStatus,
): string {
  const modules = propertySets
    .map((ps) => {
      const props = statusFilter
        ? ps.properties.filter((p) => p.status === statusFilter)
        : ps.properties;
      return {
        filePath: ps.filePath,
        properties: props.map((p) => ({
          id: p.id,
          targetFunction: p.targetFunction,
          description: p.description,
          status: p.status,
          humanVerified: p.humanVerified ?? false,
          riskScore: p.riskScore,
          riskTags: p.riskTags,
        })),
        summary: countByStatus(props),
      };
    })
    .filter((m) => m.properties.length > 0);

  const json: PropertiesOverviewJson = { modules };
  return JSON.stringify(json, null, 2);
}

/* ── detail (propcheck property) ────────────────── */

export interface PropertyDetailJson {
  readonly filePath: string;
  readonly property: {
    readonly id: string;
    readonly targetFunction: string;
    readonly description: string;
    readonly category: string;
    readonly assertion: string;
    readonly status: PropertyStatus;
    readonly humanVerified: boolean;
    readonly score: number;
    readonly riskScore: number;
    readonly riskTags: readonly string[];
    readonly confidence: number;
    readonly evidence: string;
    readonly inferredAt: string;
    readonly modelId: string;
  };
}

export function reportPropertyDetail(
  property: PropertyDefinition,
  filePath: string,
): void {
  console.log("");
  console.log(chalk.bold(`  ${filePath} — ${property.id}`));
  console.log("");
  console.log(`  Function   : ${property.targetFunction}`);
  console.log(`  Description: ${property.description}`);
  console.log(`  Category   : ${property.category}`);
  console.log(`  Status     : ${statusBadge(property.status)}${property.humanVerified ? chalk.green(" ✔ verified") : ""}`);
  console.log(`  Score      : ${property.score}/13  risk: ${property.riskScore}`);
  if (property.riskTags.length > 0) {
    console.log(`  Risk tags  : ${chalk.yellow(property.riskTags.join(", "))}`);
  }
  console.log(`  Confidence : ${(property.confidence * 100).toFixed(0)}%`);
  console.log(`  Evidence   : ${property.evidence}`);
  console.log("");
  console.log(chalk.dim("  Assertion:"));
  console.log(`    ${property.assertion}`);
  console.log("");
  console.log(chalk.dim(`  Inferred: ${property.inferredAt}  model: ${property.modelId}`));
  if (property.validation) {
    const v = property.validation;
    console.log(chalk.dim(`  Validated: smoke=${v.smokePasses} canary=${v.canaryPasses} seeds=[${v.seedsTested.join(",")}] at ${v.lastValidatedAt}`));
  }
  console.log("");
}

export function reportPropertyDetailAsJson(
  property: PropertyDefinition,
  filePath: string,
): string {
  const json: PropertyDetailJson = {
    filePath,
    property: {
      id: property.id,
      targetFunction: property.targetFunction,
      description: property.description,
      category: property.category,
      assertion: property.assertion,
      status: property.status,
      humanVerified: property.humanVerified ?? false,
      score: property.score,
      riskScore: property.riskScore,
      riskTags: property.riskTags,
      confidence: property.confidence,
      evidence: property.evidence,
      inferredAt: property.inferredAt,
      modelId: property.modelId,
    },
  };
  return JSON.stringify(json, null, 2);
}

/* ── status update confirmation ─────────────────── */

export function reportStatusUpdate(
  propertyId: string,
  filePath: string,
  oldStatus: PropertyStatus,
  newStatus: PropertyStatus,
): void {
  console.log("");
  console.log(
    `  ${chalk.bold(propertyId)} in ${filePath}: ` +
    `${statusBadge(oldStatus)} → ${statusBadge(newStatus)}` +
    chalk.green(" ✔ humanVerified"),
  );
  console.log("");
}

/* ── utils ──────────────────────────────────────── */

function countByStatus(
  properties: readonly PropertyDefinition[],
): { total: number; accepted: number; risky: number; refined: number; quarantined: number; dropped: number } {
  const counts = { total: 0, accepted: 0, risky: 0, refined: 0, quarantined: 0, dropped: 0 };
  for (const p of properties) {
    counts.total++;
    counts[p.status]++;
  }
  return counts;
}
