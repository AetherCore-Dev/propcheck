/**
 * propcheck props — list property inventory with status overview.
 *
 * Usage:
 *   propcheck props                       List all properties
 *   propcheck props src/cart.ts           List properties for one file
 *   propcheck props --status risky        Filter by status
 *   propcheck props --json                Machine-readable output
 */

import * as path from "node:path";
import { loadConfig } from "@propcheck/config";
import { getProperties, getAllProperties } from "@propcheck/store";
import {
  reportPropertiesOverview,
  reportPropertiesOverviewAsJson,
} from "@propcheck/reporter";
import { toForwardSlash } from "@propcheck/common";
import type { PropertyStatus } from "@propcheck/common";
import { VALID_STATUSES, formatStatusError } from "./shared/status-info";

interface PropsOptions {
  status?: string;
  json?: boolean;
}

export async function propsCommand(
  target: string | undefined,
  options: PropsOptions,
): Promise<void> {
  const projectRoot = process.cwd();
  const config = loadConfig(projectRoot);
  const storeDir = path.join(projectRoot, config.storeDir);

  // Validate --status filter
  let statusFilter: PropertyStatus | undefined;
  if (options.status) {
    if (!VALID_STATUSES.has(options.status as PropertyStatus)) {
      console.error(formatStatusError(options.status));
      process.exit(2);
    }
    statusFilter = options.status as PropertyStatus;
  }

  // Load properties
  if (target) {
    const targetPath = path.resolve(projectRoot, target);
    const moduleKey = toForwardSlash(path.relative(projectRoot, targetPath));
    const ps = await getProperties(storeDir, moduleKey);

    if (!ps) {
      console.error(`\n  No properties found for ${target}`);
      console.error("  Run: propcheck infer " + target + "\n");
      process.exit(2);
    }

    if (options.json) {
      console.log(reportPropertiesOverviewAsJson([ps], statusFilter));
    } else {
      reportPropertiesOverview([ps], statusFilter);
    }
  } else {
    const allSets = await getAllProperties(storeDir);

    if (allSets.length === 0) {
      if (options.json) {
        console.log(JSON.stringify({ modules: [] }, null, 2));
      } else {
        console.log("\n  No properties found. Run: propcheck infer <file>\n");
      }
      process.exit(0);
    }

    if (options.json) {
      console.log(reportPropertiesOverviewAsJson(allSets, statusFilter));
    } else {
      reportPropertiesOverview(allSets, statusFilter);
    }
  }
}
