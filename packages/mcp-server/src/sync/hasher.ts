/**
 * File Content Hashing
 *
 * Provides SHA-256 hashing for file content to detect changes.
 * Used by the sync layer to determine if CSV files need re-syncing.
 */

import * as crypto from "crypto";
import * as fs from "fs/promises";

/**
 * Compute SHA-256 hash of file content.
 *
 * @param filePath - Absolute path to the file
 * @returns Promise<string> - Hex-encoded SHA-256 hash
 * @throws Error if file cannot be read
 */
export async function hashFileContent(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(buffer).digest("hex");
}
