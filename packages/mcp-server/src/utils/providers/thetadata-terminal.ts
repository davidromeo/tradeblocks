import { closeSync, existsSync, mkdirSync, openSync, symlinkSync, unlinkSync } from "fs";
import { spawn, execFile } from "child_process";
import net from "net";
import os from "os";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const DEFAULT_PORT = 25503;
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_JAR_NAME = "ThetaTerminalv3.jar";
const DEFAULT_CREDS_NAME = "creds.txt";

export interface ThetaTerminalConfig {
  homeDir: string;
  jarPath: string;
  credsPath: string;
  managedCredsPath: string;
  logPath: string;
  host: string;
  port: number;
  javaCmd: string;
  startTimeoutMs: number;
}

export function defaultThetaTerminalHome(): string {
  return path.join(
    os.homedir(),
    "Library",
    "Application Support",
    "tradeblocks",
    "lib",
    "thetadata",
  );
}

export function legacyThetaTerminalHome(): string {
  return path.join(
    os.homedir(),
    "Library",
    "Application Support",
    "tradeblocks",
    "thetadata",
  );
}

export function parseJavaMajorVersion(output: string): number | null {
  const legacy = output.match(/version "1\.(\d+)\./);
  if (legacy) return Number(legacy[1]);

  const modern = output.match(/version "(\d+)(?:[.\-+]|")/);
  if (modern) return Number(modern[1]);

  return null;
}

export function resolveThetaTerminalConfig(env: NodeJS.ProcessEnv = process.env): ThetaTerminalConfig {
  const defaultHome = defaultThetaTerminalHome();
  const legacyHome = legacyThetaTerminalHome();
  const homeDir = env.THETADATA_HOME
    ? path.resolve(env.THETADATA_HOME)
    : (existsSync(defaultHome) || !existsSync(legacyHome) ? defaultHome : legacyHome);

  const jarPath = env.THETADATA_JAR
    ? path.resolve(env.THETADATA_JAR)
    : path.join(homeDir, DEFAULT_JAR_NAME);
  const credsPath = env.THETADATA_CREDS_FILE
    ? path.resolve(env.THETADATA_CREDS_FILE)
    : path.join(homeDir, DEFAULT_CREDS_NAME);

  return {
    homeDir,
    jarPath,
    credsPath,
    managedCredsPath: path.join(homeDir, DEFAULT_CREDS_NAME),
    logPath: path.join(homeDir, "ThetaTerminal.log"),
    host: env.THETADATA_HOST || DEFAULT_HOST,
    port: Number.parseInt(env.THETADATA_PORT || String(DEFAULT_PORT), 10) || DEFAULT_PORT,
    javaCmd: env.JAVA_HOME ? path.join(env.JAVA_HOME, "bin", "java") : "java",
    startTimeoutMs: Number.parseInt(env.THETADATA_START_TIMEOUT_MS || String(DEFAULT_TIMEOUT_MS), 10) || DEFAULT_TIMEOUT_MS,
  };
}

export async function detectJavaMajorVersion(javaCmd: string): Promise<number | null> {
  try {
    const { stdout, stderr } = await execFileAsync(javaCmd, ["-version"]);
    return parseJavaMajorVersion(`${stdout}\n${stderr}`);
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string };
    return parseJavaMajorVersion(`${err.stdout || ""}\n${err.stderr || ""}`);
  }
}

export async function isThetaTerminalRunning(host: string, port: number, timeoutMs = 1_000): Promise<boolean> {
  return await new Promise<boolean>((resolve) => {
    const socket = net.createConnection({ host, port });
    let settled = false;

    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(value);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

function ensureManagedCredsFile(config: ThetaTerminalConfig): void {
  mkdirSync(config.homeDir, { recursive: true });

  if (!existsSync(config.credsPath)) {
    throw new Error(
      `ThetaData creds file not found at ${config.credsPath}. ` +
      `Place ${DEFAULT_CREDS_NAME} in ${config.homeDir} or set THETADATA_CREDS_FILE.`
    );
  }

  if (path.resolve(config.credsPath) === path.resolve(config.managedCredsPath)) {
    return;
  }

  try {
    if (existsSync(config.managedCredsPath)) unlinkSync(config.managedCredsPath);
  } catch {
    // Best-effort cleanup before creating the symlink.
  }
  symlinkSync(config.credsPath, config.managedCredsPath);
}

async function waitForThetaTerminal(config: ThetaTerminalConfig): Promise<void> {
  const deadline = Date.now() + config.startTimeoutMs;
  while (Date.now() < deadline) {
    if (await isThetaTerminalRunning(config.host, config.port, 1_000)) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(
    `ThetaTerminal did not start listening on ${config.host}:${config.port} ` +
    `within ${config.startTimeoutMs}ms. Check ${config.logPath}.`
  );
}

export async function ensureThetaTerminalRunning(env: NodeJS.ProcessEnv = process.env): Promise<"already_running" | "started"> {
  const config = resolveThetaTerminalConfig(env);

  if (!existsSync(config.jarPath)) {
    throw new Error(
      `ThetaTerminal JAR not found at ${config.jarPath}. ` +
      `Expected ${DEFAULT_JAR_NAME} in ${config.homeDir} or set THETADATA_JAR.`
    );
  }

  const javaMajor = await detectJavaMajorVersion(config.javaCmd);
  if (javaMajor == null || javaMajor < 21) {
    throw new Error(
      `ThetaTerminal requires Java 21+. Found ${javaMajor ?? "unknown"} via ${config.javaCmd}.`
    );
  }

  if (await isThetaTerminalRunning(config.host, config.port, 1_000)) {
    return "already_running";
  }

  ensureManagedCredsFile(config);
  mkdirSync(config.homeDir, { recursive: true });

  const stdoutFd = openSync(config.logPath, "a");
  const stderrFd = openSync(config.logPath, "a");
  try {
    const child = spawn(
      config.javaCmd,
      ["-jar", config.jarPath],
      {
        cwd: config.homeDir,
        detached: true,
        stdio: ["ignore", stdoutFd, stderrFd],
      },
    );
    child.unref();
  } finally {
    closeSync(stdoutFd);
    closeSync(stderrFd);
  }

  await waitForThetaTerminal(config);
  return "started";
}
