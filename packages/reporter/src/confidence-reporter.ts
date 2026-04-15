import chalk from "chalk";

export interface ConfidenceReport {
  readonly target: string | null;
  readonly tier: 1 | 2 | 3 | 4;
  readonly score: number;
  readonly readiness: {
    readonly overallOk: boolean;
    readonly inferReady: boolean;
    readonly fixReady: boolean;
    readonly warnings: number;
    readonly mockMode: boolean;
  };
  readonly summary: {
    readonly modules: number;
    readonly staleModules: number;
    readonly missingModules: number;
    readonly totalProperties: number;
    readonly activeProperties: number;
    readonly acceptedProperties: number;
    readonly refinedProperties: number;
    readonly riskyProperties: number;
    readonly quarantinedProperties: number;
    readonly droppedProperties: number;
    readonly validatedProperties: number;
    readonly humanVerifiedProperties: number;
    readonly specBackedProperties: number;
  };
  readonly recommendations: readonly string[];
}

function colorForTier(tier: ConfidenceReport["tier"]): (text: string) => string {
  switch (tier) {
    case 3:
    case 4:
      return chalk.green;
    case 2:
      return chalk.yellow;
    default:
      return chalk.red;
  }
}

function colorForScore(score: number): (text: string) => string {
  if (score >= 75) return chalk.green;
  if (score >= 40) return chalk.yellow;
  return chalk.red;
}

export function reportConfidence(report: ConfidenceReport): void {
  const tierColor = colorForTier(report.tier);
  const scoreColor = colorForScore(report.score);
  const activeLabel = `${report.summary.activeProperties}/${report.summary.totalProperties}`;
  const readinessLabel = report.readiness.overallOk
    ? chalk.green("ready")
    : report.readiness.inferReady || report.readiness.fixReady
      ? chalk.yellow("partial")
      : chalk.red("blocked");

  console.log("");
  console.log(chalk.bold("  propcheck confidence"));
  console.log("");
  console.log(`  Target      : ${report.target ?? "project"}`);
  console.log(`  Tier        : ${tierColor(`Tier ${report.tier}`)}`);
  console.log(`  Score       : ${scoreColor(`${report.score}/100`)}`);
  console.log(`  Readiness   : ${readinessLabel} (${report.readiness.mockMode ? "mock" : "real"} mode, ${report.readiness.warnings} warning(s))`);
  console.log(`  Properties  : ${activeLabel} active | ${report.summary.acceptedProperties} accepted | ${report.summary.refinedProperties} refined | ${report.summary.riskyProperties} risky`);
  console.log(`  Evidence    : ${report.summary.validatedProperties} validated | ${report.summary.humanVerifiedProperties} human-verified | ${report.summary.specBackedProperties} spec-backed`);
  console.log(`  Coverage    : ${report.summary.modules} module(s) tracked | ${report.summary.staleModules} stale | ${report.summary.missingModules} missing`);
  if (report.summary.quarantinedProperties > 0 || report.summary.droppedProperties > 0) {
    console.log(`  Excluded    : ${report.summary.quarantinedProperties} quarantined | ${report.summary.droppedProperties} dropped`);
  }

  if (report.recommendations.length > 0) {
    console.log("");
    console.log(chalk.bold("  Next steps"));
    for (const recommendation of report.recommendations) {
      console.log(`    • ${recommendation}`);
    }
  }

  console.log("");
}

export function reportConfidenceAsJson(report: ConfidenceReport): string {
  return JSON.stringify(report, null, 2);
}
