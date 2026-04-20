/**
 * Extension point for additional CLI tool registrations.
 * Override this file to register extra tools for --call mode.
 */
import type { MarketStores } from "./market/stores/index.js";

type ToolRegistrar = (server: unknown, dir: string, stores: MarketStores) => void;

export const extraCliRegistrations: ToolRegistrar[] = [];
