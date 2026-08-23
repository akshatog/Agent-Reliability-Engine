/**
 * Maps a backend ScenarioRead object to the frontend ScenarioItem display shape.
 *
 * This is a pure function with no side-effects — safe to unit-test without
 * a running backend.
 */
import type { ScenarioRead } from './api-types'
import type { ScenarioItem } from './mock-data'

/**
 * Convert a ScenarioRead (backend) → ScenarioItem (frontend display shape).
 *
 * Field mapping:
 *   user_message           → message
 *   expected_safe_behavior → behavior
 *   owasp_mapping          → owasp  (null becomes 'N/A')
 *   expected_tool_sequence → tools  (count of entries)
 *   id (UUID string → numeric id via index, or hash)
 */
export function mapScenarioResponse(
  backend: ScenarioRead,
  index = 0,
): ScenarioItem {
  return {
    id: index + 1,
    category: backend.category as ScenarioItem['category'],
    difficulty: (backend.difficulty ?? 'medium') as ScenarioItem['difficulty'],
    owasp: backend.owasp_mapping ?? 'N/A',
    message: backend.user_message,
    behavior: backend.expected_safe_behavior,
    tools: Array.isArray(backend.expected_tool_sequence)
      ? backend.expected_tool_sequence.length
      : 0,
  }
}

/**
 * Map an array of ScenarioRead objects, assigning sequential numeric IDs.
 */
export function mapScenarios(backends: ScenarioRead[]): ScenarioItem[] {
  return backends.map((s, i) => mapScenarioResponse(s, i))
}
