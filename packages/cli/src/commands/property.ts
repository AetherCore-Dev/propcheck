/**
 * propcheck property — inspect or update a single property.
 *
 * Usage:
 *   propcheck property src/cart.ts prop_001              Show property detail
 *   propcheck property src/cart.ts prop_001 --status quarantined   Update status
 *   propcheck property src/cart.ts prop_001 --json       Machine-readable output
 */

import * as path from "node:path";
import { loadConfig } from "@propcheck/config";
import { getProperties, setProperties } from "@propcheck/store";
import {
  reportPropertyDetail,
  reportPropertyDetailAsJson,
  reportStatusUpdate,
} from "@propcheck/reporter";
import { toForwardSlash } from "@propcheck/common";
import type { PropertyStatus, PropertySet, PropertyDefinition } from "@propcheck/common";
import { VALID_STATUSES, formatStatusError } from "./shared/status-info";

interface PropertyOptions {
  status?: string;
  json?: boolean;
}

export async function propertyCommand(
  target: string,
  propertyId: string,
  options: PropertyOptions,
): Promise<void> {
  const projectRoot = process.cwd();
  const config = loadConfig(projectRoot);
  const storeDir = path.join(projectRoot, config.storeDir);

  // Resolve module key
  const targetPath = path.resolve(projectRoot, target);
  const moduleKey = toForwardSlash(path.relative(projectRoot, targetPath));

  // Load property set
  const ps = await getProperties(storeDir, moduleKey);
  if (!ps) {
    console.error(`\n  No properties found for ${target}`);
    console.error("  Run: propcheck infer " + target + "\n");
    process.exit(2);
  }

  // Find property by ID
  const property = ps.properties.find((p) => p.id === propertyId);
  if (!property) {
    console.error(`\n  Property "${propertyId}" not found in ${target}`);
    console.error("  Available IDs: " + ps.properties.map((p) => p.id).join(", ") + "\n");
    process.exit(2);
  }

  // If --status is provided, update the property status
  if (options.status) {
    if (!VALID_STATUSES.has(options.status as PropertyStatus)) {
      console.error(formatStatusError(options.status));
      process.exit(2);
    }

    const newStatus = options.status as PropertyStatus;
    const oldStatus = property.status;

    // Create updated property with new status and humanVerified = true
    const updatedProperty: PropertyDefinition = {
      ...property,
      status: newStatus,
      humanVerified: true,
    };

    // Replace in property set (immutable pattern)
    const updatedProperties = ps.properties.map((p) =>
      p.id === propertyId ? updatedProperty : p,
    );
    const updatedPs: PropertySet = {
      ...ps,
      properties: updatedProperties,
    };

    await setProperties(storeDir, moduleKey, updatedPs);

    if (options.json) {
      console.log(reportPropertyDetailAsJson(updatedProperty, ps.filePath));
    } else {
      reportStatusUpdate(propertyId, ps.filePath, oldStatus, newStatus);
    }
    return;
  }

  // Read-only: display property detail
  if (options.json) {
    console.log(reportPropertyDetailAsJson(property, ps.filePath));
  } else {
    reportPropertyDetail(property, ps.filePath);
  }
}
