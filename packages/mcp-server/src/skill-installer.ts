/**
 * Skill Installer Module
 *
 * Provides programmatic installation of TradeBlocks agent skills
 * to Claude Code, Codex CLI, and Gemini CLI platforms.
 *
 * Used by Phase 15 CLI for `tradeblocks-mcp install-skills` command.
 */

import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

export type Platform = "claude" | "codex" | "gemini";

const PLATFORM_PATHS: Record<Platform, string> = {
  claude: ".claude/skills",
  codex: ".codex/skills",
  gemini: ".gemini/skills",
};

export interface SkillManifest {
  version: string;
  skills: string[];
  platforms: Record<string, string>;
}

export interface InstallResult {
  installed: string[];
  skipped: string[];
  errors: string[];
}

/**
 * Get the path to bundled agent-skills directory.
 * Works both when running from compiled dist/ and from source src/.
 */
export async function getSkillsSourcePath(): Promise<string> {
  // Get the directory of this module
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // When running from npm package: dist/skill-installer.js -> agent-skills/
  const distPath = path.join(__dirname, "..", "agent-skills");

  // When running from source: src/skill-installer.ts -> ../agent-skills/
  const srcPath = path.join(__dirname, "..", "..", "agent-skills");

  // Check which exists
  try {
    await fs.access(distPath);
    return distPath;
  } catch {
    try {
      await fs.access(srcPath);
      return srcPath;
    } catch {
      throw new Error(
        `Could not find agent-skills directory at ${distPath} or ${srcPath}`
      );
    }
  }
}

/**
 * Get the target installation path for a platform.
 */
export function getTargetPath(platform: Platform): string {
  return path.join(os.homedir(), PLATFORM_PATHS[platform]);
}

/**
 * Load and return the skill manifest.
 */
export async function loadManifest(): Promise<SkillManifest> {
  const sourcePath = await getSkillsSourcePath();
  const indexPath = path.join(sourcePath, "index.json");
  const content = await fs.readFile(indexPath, "utf-8");
  return JSON.parse(content) as SkillManifest;
}

/**
 * List all available skills from the manifest.
 */
export async function listAvailableSkills(): Promise<string[]> {
  const manifest = await loadManifest();
  return manifest.skills;
}

/**
 * Copy a directory recursively.
 */
async function copyDirectory(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

/**
 * Install all TradeBlocks skills to the specified platform.
 *
 * @param platform - Target platform (claude, codex, or gemini)
 * @param options - Installation options
 * @returns Result object with installed, skipped, and error arrays
 */
export async function installSkills(
  platform: Platform,
  options: { force?: boolean } = {}
): Promise<InstallResult> {
  const sourcePath = await getSkillsSourcePath();
  const targetPath = getTargetPath(platform);
  const skills = await listAvailableSkills();

  const result: InstallResult = { installed: [], skipped: [], errors: [] };

  // Ensure target directory exists
  await fs.mkdir(targetPath, { recursive: true });

  for (const skill of skills) {
    const skillSource = path.join(sourcePath, skill);
    const skillTarget = path.join(targetPath, skill);

    try {
      // Check if already exists
      let exists = false;
      try {
        await fs.access(skillTarget);
        exists = true;
      } catch {
        // Does not exist
      }

      if (exists && !options.force) {
        result.skipped.push(skill);
        continue;
      }

      // Remove existing if force
      if (exists && options.force) {
        await fs.rm(skillTarget, { recursive: true });
      }

      // Copy skill directory (not symlink - more portable for npm)
      await copyDirectory(skillSource, skillTarget);
      result.installed.push(skill);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push(`${skill}: ${message}`);
    }
  }

  return result;
}

/**
 * Uninstall all TradeBlocks skills from the specified platform.
 *
 * @param platform - Target platform (claude, codex, or gemini)
 * @returns Array of removed skill names
 */
export async function uninstallSkills(platform: Platform): Promise<string[]> {
  const targetPath = getTargetPath(platform);
  const skills = await listAvailableSkills();
  const removed: string[] = [];

  for (const skill of skills) {
    const skillPath = path.join(targetPath, skill);
    try {
      await fs.rm(skillPath, { recursive: true });
      removed.push(skill);
    } catch {
      // Ignore - skill may not be installed
    }
  }

  return removed;
}

/**
 * Check which skills are currently installed for a platform.
 *
 * @param platform - Target platform (claude, codex, or gemini)
 * @returns Object with installed and missing skill arrays
 */
export async function checkInstallation(
  platform: Platform
): Promise<{ installed: string[]; missing: string[] }> {
  const targetPath = getTargetPath(platform);
  const skills = await listAvailableSkills();

  const installed: string[] = [];
  const missing: string[] = [];

  for (const skill of skills) {
    const skillPath = path.join(targetPath, skill, "SKILL.md");
    try {
      await fs.access(skillPath);
      installed.push(skill);
    } catch {
      missing.push(skill);
    }
  }

  return { installed, missing };
}
