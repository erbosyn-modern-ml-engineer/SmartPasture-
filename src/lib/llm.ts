import { env } from '@/lib/env'
import type { GisProbeCell } from '@/lib/types'
import type { Language } from '@/i18n/translations'

export type LocalLlmStatus = {
  configured: boolean
  ready: boolean
  starting: boolean
  state: 'idle' | 'starting' | 'ready' | 'error'
  modelPath: string
  runtimePath: string
  modelName: string
  message: string
}

export type PointExplanationResponse = {
  report: string
  model: string
  generatedAt: string
}

const apiBaseUrl = env.apiBaseUrl || ''

async function readJsonOrThrow<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    if (response.status === 502) {
      throw new Error('LOCAL_LLM_PROXY_UNAVAILABLE')
    }

    const message =
      typeof (payload as { error?: unknown }).error === 'string'
        ? (payload as { error: string }).error
        : `Request failed with ${response.status}`
    throw new Error(message)
  }

  return payload as T
}

export async function fetchLocalLlmStatus(): Promise<LocalLlmStatus> {
  const response = await fetch(`${apiBaseUrl}/api/llm/status`)
  return readJsonOrThrow<LocalLlmStatus>(response)
}

export async function requestPointExplanation(input: {
  pointName: string
  language: Language
  cell: GisProbeCell
}): Promise<PointExplanationResponse> {
  let response: Response

  try {
    response = await fetch(`${apiBaseUrl}/api/llm/explain-point`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    })
  } catch {
    throw new Error('LOCAL_LLM_PROXY_UNAVAILABLE')
  }

  return readJsonOrThrow<PointExplanationResponse>(response)
}
