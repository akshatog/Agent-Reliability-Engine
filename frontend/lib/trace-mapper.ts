/**
 * Maps backend trace step objects to the frontend display step shape.
 *
 * Backend steps arrive via WebSocket (event: "trace_step") or from
 * GET /api/runs/{runId}.trace. This mapper is used in both the
 * /traces/[runId] page and the Red Team Theater component.
 *
 * Pure function — unit-testable without a running backend.
 */
import {
  AlertTriangle,
  Brain,
  Flag,
  Pause,
  Shield,
  ShieldOff,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import type { BackendTraceStep } from './api-types'

export type StepTone = 'safe' | 'elevated' | 'critical' | 'aftermath' | 'final'

export interface DisplayStep {
  type: StepTone
  icon: LucideIcon
  title: string
  /** Relative time offset string, e.g. "+1.2s" */
  time: string
  risk: string
  body?: string
  flaw?: string
  /** If true, render the tool-call block */
  tool?: boolean
  /** Tool name for tool-call blocks */
  toolName?: string
  /** If true, render the guardrail-bypassed block */
  guardrail?: boolean
  /** If true, render aftermath tool call block */
  aftermath?: boolean
}

const STEP_TYPE_CONFIG: Record<
  BackendTraceStep['step_type'],
  { title: string; icon: LucideIcon; tone: StepTone; risk: string }
> = {
  user_input: {
    title: 'User Input',
    icon: Brain,
    tone: 'safe',
    risk: 'INPUT',
  },
  agent_output: {
    title: 'Agent Output',
    icon: Brain,
    tone: 'safe',
    risk: 'OUTPUT',
  },
  tool_call: {
    title: 'Tool Call',
    icon: Wrench,
    tone: 'elevated',
    risk: 'ELEVATED',
  },
  tool_response: {
    title: 'Tool Response',
    icon: Shield,
    tone: 'aftermath',
    risk: 'LOW',
  },
  error: {
    title: 'Error',
    icon: AlertTriangle,
    tone: 'critical',
    risk: 'CRITICAL',
  },
}

const RISK_TONE: Record<string, StepTone> = {
  CRITICAL: 'critical',
  HIGH: 'elevated',
  MEDIUM: 'elevated',
  LOW: 'safe',
}

/**
 * Map a single BackendTraceStep to a DisplayStep for the timeline UI.
 */
export function mapBackendStep(step: BackendTraceStep, index: number): DisplayStep {
  const config = STEP_TYPE_CONFIG[step.step_type] ?? {
    title: step.step_type,
    icon: Brain,
    tone: 'safe' as StepTone,
    risk: 'UNKNOWN',
  }

  // Risk level from the backend overrides the default config tone
  // Normalize to uppercase — backend may send 'high', 'CRITICAL', etc.
  const normalizedRisk = step.risk_level?.toUpperCase()
  const tone = normalizedRisk
    ? (RISK_TONE[normalizedRisk] ?? config.tone)
    : config.tone

  // Derive relative time from step_number (simple approximation)
  const time = `+${(index * 0.4).toFixed(1)}s`

  // Extract body from content
  const content = step.content ?? {}
  let body: string | undefined
  if (typeof content.text === 'string') body = content.text
  else if (typeof content.message === 'string') body = content.message
  else if (typeof content.output === 'string') body = content.output

  // Detect tool calls
  const isTool = step.step_type === 'tool_call'
  const toolName = isTool
    ? (typeof content.tool_name === 'string' ? content.tool_name : 'unknown_tool')
    : undefined

  // Detect guardrail bypass: a CRITICAL/HIGH risk tool_call with no confirmation
  const isGuardrail =
    isTool &&
    (normalizedRisk === 'CRITICAL' || normalizedRisk === 'HIGH')

  // Final step detection
  const isFinal = step.step_type === 'agent_output' && !body?.trim()

  return {
    type: isFinal ? 'final' : tone,
    icon: isTool ? (normalizedRisk === 'CRITICAL' ? AlertTriangle : Wrench)
      : step.step_type === 'agent_output' ? Flag
      : config.icon,
    title: isTool && toolName ? `Tool Call: ${toolName}` : config.title,
    time,
    risk: normalizedRisk ?? config.risk,
    body,
    tool: isTool,
    toolName,
    guardrail: isGuardrail,
    aftermath: step.step_type === 'tool_response',
  }
}

/**
 * Map a full trace array (from RunRead.trace or WebSocket messages).
 */
export function mapTrace(steps: BackendTraceStep[]): DisplayStep[] {
  return steps.map((s, i) => mapBackendStep(s, i))
}
