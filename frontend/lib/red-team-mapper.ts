/**
 * Maps a RedTeamChatResponse (backend) → RedTeamDisplayItem (frontend).
 *
 * The real response shape differs significantly from the mock RedTeamScenario:
 *   - confidence is a 0-1 float, not a "94%" string
 *   - verdict is nested under classification, not top-level
 *   - severity is nested under classification
 *   - trace is NOT in the response (comes via WebSocket or GET /api/runs/{id})
 *   - prompt must be passed in from the original user input
 *   - time comes from scenario.created_at (ISO timestamp)
 *
 * Pure function — unit-testable without a running backend.
 */
import type { RedTeamChatResponse, RedTeamDisplayItem } from './api-types'

/**
 * Map a RedTeamChatResponse and the original user input message
 * to a RedTeamDisplayItem ready for the UI.
 *
 * @param resp     - The full response from POST /api/red-team-chat
 * @param input    - The original natural-language string the user typed
 */
export function mapRedTeamResponse(
  resp: RedTeamChatResponse,
  input: string,
): RedTeamDisplayItem {
  // Runtime type validation
  if (!resp || typeof resp !== 'object') {
    throw new TypeError('Invalid response: Expected an object')
  }
  if (!resp.scenario || !resp.classification || !resp.run_id) {
    throw new TypeError('Invalid response: Missing scenario, classification, or run_id')
  }
  if (!Array.isArray(resp.guardrail_results)) {
    throw new TypeError('Invalid response: guardrail_results must be an array')
  }
  if (typeof resp.classification.verdict !== 'string' || typeof resp.classification.confidence !== 'number') {
    throw new TypeError('Invalid response: classification fields are malformed')
  }

  const { scenario, classification, guardrail_results, run_id } = resp

  return {
    prompt: input,
    category: scenario.category,
    severity: classification.severity ?? '—',
    // Convert float 0.94 → "94%"
    confidence: `${Math.round(classification.confidence * 100)}%`,
    verdict: classification.verdict,
    // Human-readable localised time from ISO timestamp
    time: new Date(scenario.created_at).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    }),
    runId: run_id,
    guardrailResults: guardrail_results,
    justification: classification.justification,
  }
}
