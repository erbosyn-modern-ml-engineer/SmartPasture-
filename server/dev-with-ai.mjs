import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const viteArgs = process.argv.slice(2)

const children = []

function killChildTree(child) {
  if (!child || child.killed) return

  if (process.platform === 'win32') {
    spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true })
    return
  }

  child.kill('SIGTERM')
}

function run(command, args, label, shell = false) {
  const child = spawn(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    windowsHide: false,
    shell,
  })

  child.on('exit', (code) => {
    if (code && code !== 0) {
      console.error(`[${label}] exited with code ${code}`)
      shutdown(code)
    }
  })

  children.push(child)
  return child
}

function shutdown(exitCode = 0) {
  while (children.length) {
    const child = children.pop()
    killChildTree(child)
  }

  setTimeout(() => process.exit(exitCode), 200)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

run(process.execPath, ['server/local-llm-server.mjs'], 'llm:api')
run(
  npmCommand,
  ['run', 'dev:web', ...(viteArgs.length ? ['--', ...viteArgs] : [])],
  'vite',
  process.platform === 'win32',
)
