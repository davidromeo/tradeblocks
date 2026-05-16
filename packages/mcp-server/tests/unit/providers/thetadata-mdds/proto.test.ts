import { describe, expect, it } from "@jest/globals";
import { existsSync } from "fs";
import { resolve } from "path";
import * as protoLoader from "@grpc/proto-loader";
import * as grpc from "@grpc/grpc-js";

const protoPath = resolve("src/utils/providers/thetadata/mdds.proto");

describe("ThetaData MDDS proto asset", () => {
  it("loads BetaEndpoints.BetaThetaTerminal", () => {
    expect(existsSync(protoPath)).toBe(true);
    const definition = protoLoader.loadSync(protoPath, {
      longs: Number,
      enums: String,
      defaults: false,
      oneofs: true,
      bytes: Buffer,
    });
    const loaded = grpc.loadPackageDefinition(definition) as {
      BetaEndpoints?: { BetaThetaTerminal?: unknown };
    };
    expect(loaded.BetaEndpoints?.BetaThetaTerminal).toBeDefined();
  });
});
