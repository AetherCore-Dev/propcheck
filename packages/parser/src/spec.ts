import type { SpecConstraint, SpecContext, SpecSignal } from "@propcheck/common";

const RANGE_PATTERNS: readonly RegExp[] = [
  /0\s*(?:-|to)\s*100/i,
  /0-100/i,
  /0 to 100/i,
];

function toSentenceList(rawText: string): readonly string[] {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-*]\s*/, "").trim())
    .filter(Boolean);
}

function detectConstraints(detail: string, subject: string): SpecConstraint[] {
  const constraints: SpecConstraint[] = [];
  const normalized = detail.toLowerCase();

  if (/non-negative|nonnegative|must not be negative|cannot be negative|never be negative/.test(normalized)) {
    constraints.push({ subject, kind: "non-negative", detail, min: 0 });
  }

  if (/must be positive|positive number|greater than zero|>\s*0/.test(normalized)) {
    constraints.push({ subject, kind: "positive", detail, min: Number.MIN_VALUE });
  }

  if (/percentage|percent/.test(normalized) || RANGE_PATTERNS.some((pattern) => pattern.test(normalized))) {
    constraints.push({ subject, kind: "range", detail, min: 0, max: 100 });
  }

  return constraints;
}

function extractFunctionSignal(line: string, functionNames: readonly string[]): SpecSignal | null {
  const lower = line.toLowerCase();
  const matchedName = functionNames.find((name) => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped.toLowerCase()}\\b`).test(lower);
  });

  if (!matchedName) return null;

  return {
    functionName: matchedName,
    requirements: [line],
    constraints: detectConstraints(line, matchedName),
  };
}

export function parseSpecText(
  sourcePath: string,
  rawText: string,
  functionNames: readonly string[],
): SpecContext {
  const lines = toSentenceList(rawText);
  const byFunction = new Map<string, SpecSignal>();
  const generalRequirements: string[] = [];

  for (const line of lines) {
    const signal = extractFunctionSignal(line, functionNames);
    if (!signal) {
      generalRequirements.push(line);
      continue;
    }

    const existing = byFunction.get(signal.functionName);
    if (existing) {
      byFunction.set(signal.functionName, {
        functionName: existing.functionName,
        requirements: [...existing.requirements, ...signal.requirements],
        constraints: [...existing.constraints, ...signal.constraints],
      });
    } else {
      byFunction.set(signal.functionName, signal);
    }
  }

  return {
    sourcePath,
    rawText,
    generalRequirements,
    functions: [...byFunction.values()],
  };
}
