/**
 * Extension point for additional CLI tool registrations.
 * Override this file to register extra tools for --call mode.
 */
type ToolRegistrar = (server: unknown, dir: string) => void;

export const extraCliRegistrations: ToolRegistrar[] = [];
