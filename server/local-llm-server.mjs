import express from 'express'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import fs from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

const DEFAULT_API_PORT = 8787
const DEFAULT_LLAMA_PORT = 11435
const DEFAULT_MODEL_PATH = 'C:\\Users\\erbos\\Downloads\\Qwen3-8B-Q4_K_M.gguf'
const DEFAULT_RUNTIME_PATH = path.join(repoRoot, 'tools', 'llama-runtime', 'llama-b8934', 'llama-server.exe')
const DEFAULT_CONTEXT_SIZE = 8192
const DEFAULT_TIMEOUT_MS = 180_000

const app = express()
app.use(express.json({ limit: '1mb' }))

let llamaProcess = null
let startupPromise = null
let startupError = null
let startupState = 'idle'

function parseArg(flag) {
  const index = process.argv.indexOf(flag)
  if (index === -1) return null
  return process.argv[index + 1] ?? null
}

function resolvePath(value) {
  if (!value) return null
  return path.isAbsolute(value) ? value : path.resolve(repoRoot, value)
}

function getApiPort() {
  const value = parseArg('--port') ?? process.env.SMARTPASTURE_AI_API_PORT
  return Number(value || DEFAULT_API_PORT)
}

function getStaticDir() {
  return resolvePath(parseArg('--static') ?? process.env.SMARTPASTURE_STATIC_DIR)
}

function getLlamaPort() {
  return Number(process.env.SMARTPASTURE_LLAMA_PORT || DEFAULT_LLAMA_PORT)
}

function getThreads() {
  const configured = Number(process.env.SMARTPASTURE_LLM_THREADS || '')
  if (Number.isFinite(configured) && configured > 0) {
    return configured
  }

  return Math.max(4, Math.min(12, os.cpus().length - 1))
}

function getModelPath() {
  return process.env.SMARTPASTURE_LLM_MODEL_PATH || DEFAULT_MODEL_PATH
}

function getRuntimePath() {
  return process.env.SMARTPASTURE_LLAMA_SERVER_PATH || DEFAULT_RUNTIME_PATH
}

function modelNameFromPath(filePath) {
  return path.basename(filePath).replace(path.extname(filePath), '')
}

function languageName(language) {
  if (language === 'kk') return 'Kazakh'
  if (language === 'ru') return 'Russian'
  return 'English'
}

function priorityBand(score) {
  if (score >= 0.7) return 'high'
  if (score >= 0.4) return 'medium'
  return 'low'
}

function confidenceBand(score) {
  if (score >= 0.7) return 'high'
  if (score >= 0.45) return 'medium'
  return 'low'
}

function riskBand(score) {
  if (score >= 0.65) return 'high'
  if (score >= 0.4) return 'medium'
  return 'low'
}

function formatNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : 'unknown'
}

function formatDistance(valueKm) {
  if (typeof valueKm !== 'number' || !Number.isFinite(valueKm)) return 'unknown'
  return valueKm < 10 ? `${valueKm.toFixed(1)} km` : `${Math.round(valueKm)} km`
}

function formatNullable(value, suffix, fallback) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return `${value.toFixed(value < 10 ? 2 : 0)}${suffix}`
}

function buildSystemPrompt(language) {
  if (language === 'kk') {
    return [
      'You are SmartPasture local AI for farmers and livestock managers.',
      'Write in very simple Kazakh.',
      'Use only the facts given in the input.',
      'Do not invent bore yield, groundwater depth, water chemistry, HPS, lab results, or hidden field data.',
      'Do not guess whether mapped water is usable, drinkable, or enough unless the input says so.',
      'If evidence is partial or DEM is missing, say clearly that confidence is limited.',
      'Keep the answer short and practical.',
      'Format:',
      '1. One short line starting with "Qorytyndy:".',
      '2. Four to six short bullet points.',
      '3. One short line starting with "Kelesi qadam:".',
      'No tables. No long paragraphs. No jargon unless explained simply.',
    ].join(' ')
  }

  if (language === 'ru') {
    return [
      'You are SmartPasture local AI for farmers and livestock managers.',
      'Write in very simple Russian.',
      'Use only the facts given in the input.',
      'Do not invent bore yield, groundwater depth, water chemistry, HPS, lab results, or hidden field data.',
      'Do not guess whether mapped water is usable, drinkable, or enough unless the input says so.',
      'If evidence is partial or DEM is missing, say clearly that confidence is limited.',
      'Keep the answer short and practical.',
      'Format:',
      '1. One short line starting with "Итог:".',
      '2. Four to six short bullet points.',
      '3. One short line starting with "Что делать дальше:".',
      'No tables. No long paragraphs. No jargon unless explained simply.',
    ].join(' ')
  }

  return [
    'You are SmartPasture local AI for farmers and livestock managers.',
    'Write in very simple English.',
    'Use only the facts given in the input.',
    'Do not invent bore yield, groundwater depth, water chemistry, HPS, lab results, or hidden field data.',
    'Do not guess whether mapped water is usable, drinkable, or enough unless the input says so.',
    'If evidence is partial or DEM is missing, say clearly that confidence is limited.',
    'Keep the answer short and practical.',
    'Format:',
    '1. One short line starting with "Bottom line:".',
    '2. Four to six short bullet points.',
    '3. One short line starting with "Next step:".',
    'No tables. No long paragraphs. No jargon unless explained simply.',
  ].join(' ')
}

function buildUserPrompt(payload) {
  const { pointName, language, cell } = payload
  const facts = {
    language: languageName(language),
    point_name: pointName,
    coordinates: `${cell.lat.toFixed(3)}, ${cell.lon.toFixed(3)}`,
    action: cell.actionId,
    evidence_level: cell.evidenceLevel,
    dem_available: cell.hasDem,
    context_label: cell.contextScoreLabel,
    priority_score: formatNumber(cell.scores.priority),
    priority_band: priorityBand(cell.scores.priority),
    context_score: formatNumber(cell.scores.contextScore),
    risk_score: formatNumber(cell.scores.risk),
    risk_band: riskBand(cell.scores.risk),
    confidence_score: formatNumber(cell.scores.confidence),
    confidence_band: confidenceBand(cell.scores.confidence),
    road_distance: formatDistance(cell.roadKm),
    water_distance: formatDistance(cell.waterKm),
    landuse: cell.landuseClass,
    road_class: cell.roadClass,
    water_class: cell.waterClass,
    inside_water_polygon: cell.insideWater,
    elevation: formatNullable(cell.elevationM, ' m', 'No DEM'),
    slope: formatNullable(cell.slopePct, '%', 'No DEM'),
  }

  return [
    `Explain this drilling-screening point in ${languageName(language)} for a farmer.`,
    'Keep it factual and simple.',
    'Use the following facts only:',
    JSON.stringify(facts, null, 2),
    'Please explain:',
    '- why priority is at this level,',
    '- what supports or lowers confidence,',
    '- what the main risk is,',
    '- what road and water distance mean in simple words, without guessing usability,',
    '- whether a field check is still needed.',
  ].join('\n')
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timeoutId)
  }
}

async function checkLlamaHealth() {
  try {
    const response = await fetchWithTimeout(`http://127.0.0.1:${getLlamaPort()}/health`, {}, 2500)
    return response.ok
  } catch {
    return false
  }
}

function validateRuntime() {
  const runtimePath = getRuntimePath()
  const modelPath = getModelPath()

  if (!fs.existsSync(runtimePath)) {
    throw new Error(`llama-server.exe not found at ${runtimePath}`)
  }

  if (!fs.existsSync(modelPath)) {
    throw new Error(`GGUF model not found at ${modelPath}`)
  }

  return { runtimePath, modelPath }
}

function attachProcessLogging(child) {
  child.stdout?.on('data', (chunk) => {
    const text = String(chunk).trim()
    if (text) console.log(`[llama] ${text}`)
  })

  child.stderr?.on('data', (chunk) => {
    const text = String(chunk).trim()
    if (text) console.error(`[llama] ${text}`)
  })
}

async function startLlamaServer() {
  const { runtimePath, modelPath } = validateRuntime()

  if (await checkLlamaHealth()) {
    startupState = 'ready'
    startupError = null
    return
  }

  if (startupPromise) {
    return startupPromise
  }

  startupPromise = (async () => {
    startupState = 'starting'
    startupError = null

    const args = [
      '-m',
      modelPath,
      '--host',
      '127.0.0.1',
      '--port',
      String(getLlamaPort()),
      '--ctx-size',
      String(DEFAULT_CONTEXT_SIZE),
      '--threads',
      String(getThreads()),
      '--reasoning',
      'off',
      '--jinja',
      '--parallel',
      '1',
    ]

    const child = spawn(runtimePath, args, {
      cwd: path.dirname(runtimePath),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })

    llamaProcess = child
    attachProcessLogging(child)

    child.on('exit', (code, signal) => {
      console.log(`[llama] process exited (code=${code ?? 'null'}, signal=${signal ?? 'null'})`)
      llamaProcess = null
      if (startupState !== 'ready') {
        startupState = 'error'
        startupError = startupError || `Local model process exited before becoming ready (code=${code ?? 'null'})`
      } else {
        startupState = 'idle'
      }
      startupPromise = null
    })

    for (let attempt = 0; attempt < 90; attempt += 1) {
      if (await checkLlamaHealth()) {
        startupState = 'ready'
        startupError = null
        startupPromise = null
        return
      }

      if (child.exitCode != null) {
        throw new Error(`Local model process stopped with exit code ${child.exitCode}`)
      }

      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    throw new Error('Timed out while waiting for local model server to become ready')
  })()

  try {
    await startupPromise
  } catch (error) {
    startupState = 'error'
    startupError = error instanceof Error ? error.message : 'Failed to start local model server'
    startupPromise = null
    throw error
  }
}

async function ensureLlamaReady() {
  if (await checkLlamaHealth()) {
    startupState = 'ready'
    startupError = null
    return
  }

  await startLlamaServer()
}

async function requestLocalExplanation(payload) {
  await ensureLlamaReady()

  const body = {
    model: modelNameFromPath(getModelPath()),
    messages: [
      { role: 'system', content: buildSystemPrompt(payload.language) },
      { role: 'user', content: buildUserPrompt(payload) },
    ],
    temperature: 0.15,
    top_p: 0.9,
    max_tokens: 260,
    stream: false,
  }

  const response = await fetchWithTimeout(
    `http://127.0.0.1:${getLlamaPort()}/v1/chat/completions`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
    DEFAULT_TIMEOUT_MS,
  )

  if (!response.ok) {
    const details = await response.text()
    throw new Error(`Local model request failed with ${response.status}: ${details}`)
  }

  const completion = await response.json()
  const content = completion?.choices?.[0]?.message?.content

  if (!content || typeof content !== 'string') {
    throw new Error('Local model returned an empty answer')
  }

  return content.trim()
}

function readStatus() {
  const runtimePath = getRuntimePath()
  const modelPath = getModelPath()

  return {
    configured: fs.existsSync(runtimePath) && fs.existsSync(modelPath),
    ready: startupState === 'ready',
    starting: startupState === 'starting',
    state: startupState,
    modelPath,
    runtimePath,
    modelName: modelNameFromPath(modelPath),
    message: startupError || (startupState === 'ready'
      ? 'Local model is ready.'
      : startupState === 'starting'
        ? 'Local model is starting.'
        : 'Local model is not started yet.'),
  }
}

app.get('/api/llm/status', async (_request, response) => {
  const healthy = await checkLlamaHealth()
  if (healthy) {
    startupState = 'ready'
    startupError = null
  }

  response.json({
    ...readStatus(),
    ready: healthy || startupState === 'ready',
  })
})

app.post('/api/llm/explain-point', async (request, response) => {
  const { pointName, language, cell } = request.body ?? {}

  if (!pointName || typeof pointName !== 'string') {
    response.status(400).json({ error: 'pointName is required' })
    return
  }

  if (!language || !['kk', 'ru', 'en'].includes(language)) {
    response.status(400).json({ error: 'language must be kk, ru, or en' })
    return
  }

  if (!cell || typeof cell !== 'object' || typeof cell.lat !== 'number' || typeof cell.lon !== 'number') {
    response.status(400).json({ error: 'cell is required' })
    return
  }

  try {
    const report = await requestLocalExplanation({ pointName, language, cell })
    response.json({
      report,
      model: modelNameFromPath(getModelPath()),
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Local LLM request failed'
    response.status(503).json({ error: message, status: readStatus() })
  }
})

const staticDir = getStaticDir()
if (staticDir && fs.existsSync(staticDir)) {
  app.use(express.static(staticDir))

  app.use((request, response, next) => {
    if (request.path.startsWith('/api/')) {
      next()
      return
    }

    response.sendFile(path.join(staticDir, 'index.html'))
  })
}

const apiPort = getApiPort()
app.listen(apiPort, () => {
  console.log(`[smartpasture-ai] server listening on http://127.0.0.1:${apiPort}`)
  console.log(`[smartpasture-ai] model path: ${getModelPath()}`)
  console.log(`[smartpasture-ai] runtime path: ${getRuntimePath()}`)
  void ensureLlamaReady().catch((error) => {
    startupState = 'error'
    startupError = error instanceof Error ? error.message : 'Failed to start local model server'
    console.error(`[smartpasture-ai] ${startupError}`)
  })
})

function terminateLlama() {
  if (!llamaProcess || llamaProcess.killed) return
  try {
    llamaProcess.kill()
  } catch {
    // no-op
  }
}

process.on('SIGINT', () => {
  terminateLlama()
  process.exit(0)
})

process.on('SIGTERM', () => {
  terminateLlama()
  process.exit(0)
})
