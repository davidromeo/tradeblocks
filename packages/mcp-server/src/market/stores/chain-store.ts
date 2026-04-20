/**
 * ChainStore — Abstract base for option chain snapshot storage.
 *
 * Phase 1: Signatures only.
 *
 * Option chains are partitioned by (underlying, date). `readChain(underlying, date)`
 * returns all contracts observed for that underlying on that trading date.
 */
import type { StoreContext, ContractRow, CoverageReport } from "./types.js";

export abstract class ChainStore {
  constructor(protected readonly ctx: StoreContext) {}

  abstract writeChain(underlying: string, date: string, rows: ContractRow[]): Promise<void>;
  abstract readChain(underlying: string, date: string): Promise<ContractRow[]>;
  abstract getCoverage(underlying: string, from: string, to: string): Promise<CoverageReport>;
}
