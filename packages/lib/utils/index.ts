/**
 * Utility functions exports
 */

// Legacy UI utilities (from old utils.ts)
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Truncates a strategy name to a maximum length with ellipsis.
 *
 * @param strategyName - The full strategy name
 * @param maxLength - Maximum character length (default: 40)
 * @returns Truncated strategy name with ellipsis if needed
 *
 * @example
 * truncateStrategyName("move downic super long description...", 40)
 * // Returns: "move downic super long description th..."
 */
export function truncateStrategyName(
  strategyName: string,
  maxLength: number = 40
): string {
  if (!strategyName || strategyName.length <= maxLength) {
    return strategyName
  }
  return `${strategyName.substring(0, maxLength)}...`
}

/**
 * UUID generation with fallback for non-secure contexts (plain HTTP over IP).
 * crypto.randomUUID() requires HTTPS or localhost (secure context).
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

// Core utility modules
export * from './equity-curve'
export * from './risk-free-rate'
export * from './time-conversions'
export * from './time-formatting'
export * from './csv-headers'
export * from './export-helpers'
export * from './async-helpers'
export * from './combine-leg-groups'
export * from './performance-export'
export * from './trade-normalization'
export * from './trade-frequency'
export * from './performance-helpers'
