import {
  defaultThetaTerminalHome,
  legacyThetaTerminalHome,
  parseJavaMajorVersion,
  resolveThetaTerminalConfig,
} from "../../src/test-exports.js";

describe("Theta terminal config", () => {
  it("parses legacy Java version output", () => {
    expect(
      parseJavaMajorVersion('java version "1.8.0_481"\nJava(TM) SE Runtime Environment')
    ).toBe(8);
  });

  it("parses modern Java version output", () => {
    expect(
      parseJavaMajorVersion('openjdk version "23.0.2" 2025-01-21')
    ).toBe(23);
  });

  it("resolves default managed paths when env is empty", () => {
    const cfg = resolveThetaTerminalConfig({});
    expect(cfg.homeDir).toBe(defaultThetaTerminalHome());
    expect(cfg.jarPath).toBe(`${defaultThetaTerminalHome()}/ThetaTerminalv3.jar`);
    expect(cfg.managedCredsPath).toBe(`${defaultThetaTerminalHome()}/creds.txt`);
  });

  it("honors env overrides", () => {
    const cfg = resolveThetaTerminalConfig({
      THETADATA_HOME: "/tmp/theta-home",
      THETADATA_JAR: "/tmp/theta-home/custom.jar",
      THETADATA_CREDS_FILE: "/tmp/theta-home/custom-creds.txt",
      THETADATA_HOST: "localhost",
      THETADATA_PORT: "25555",
      THETADATA_START_TIMEOUT_MS: "1234",
      JAVA_HOME: "/tmp/fake-java",
    });

    expect(cfg.homeDir).toBe("/tmp/theta-home");
    expect(cfg.jarPath).toBe("/tmp/theta-home/custom.jar");
    expect(cfg.credsPath).toBe("/tmp/theta-home/custom-creds.txt");
    expect(cfg.host).toBe("localhost");
    expect(cfg.port).toBe(25555);
    expect(cfg.startTimeoutMs).toBe(1234);
    expect(cfg.javaCmd).toBe("/tmp/fake-java/bin/java");
  });

  it("keeps legacy path available for backward compatibility", () => {
    expect(legacyThetaTerminalHome()).toContain("/Library/Application Support/tradeblocks/thetadata");
  });
});
