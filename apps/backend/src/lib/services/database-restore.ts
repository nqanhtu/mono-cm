import { spawn } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'

export type PostgresRestoreInput = {
  file: File
  filename: string
  size: number
}

export type DatabaseRestoreResult = {
  filename: string
  size: number
}

export type PostgresRestoreRunner = (input: PostgresRestoreInput) => Promise<DatabaseRestoreResult>

let restoreInProgress = false
let restoreRunner: PostgresRestoreRunner = runPgRestore

export function setPostgresRestoreRunnerForTesting(runner: PostgresRestoreRunner) {
  restoreRunner = runner
}

export function resetPostgresRestoreRunnerForTesting() {
  restoreRunner = runPgRestore
  restoreInProgress = false
}

export async function restorePostgresBackup(input: PostgresRestoreInput) {
  return await restoreRunner(input)
}

async function runPgRestore(input: PostgresRestoreInput): Promise<DatabaseRestoreResult> {
  if (restoreInProgress) {
    throw new Error('A database restore is already in progress')
  }

  restoreInProgress = true

  const directory = join(tmpdir(), 'court-management-api-restores')
  const inputPath = join(directory, `${randomUUID()}-${sanitizeFilename(input.filename)}`)

  try {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error('DATABASE_URL is not configured')
    }

    await mkdir(directory, { recursive: true })
    await writeFile(inputPath, Buffer.from(await input.file.arrayBuffer()))
    await runPgRestoreCommand(inputPath, buildPgEnv(connectionString))

    return {
      filename: input.filename,
      size: input.size,
    }
  } finally {
    restoreInProgress = false
    await rm(inputPath, { force: true })
  }
}

function sanitizeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function buildPgEnv(connectionString: string) {
  const url = new URL(connectionString)
  const database = url.pathname.replace(/^\//, '')
  const sslMode = url.searchParams.get('sslmode')

  return {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGDATABASE: decodeURIComponent(database),
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    ...(sslMode ? { PGSSLMODE: sslMode } : {}),
  }
}

function runPgRestoreCommand(inputPath: string, env: NodeJS.ProcessEnv) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn('pg_restore', [
      '--clean',
      '--if-exists',
      '--no-owner',
      '--no-acl',
      '--dbname',
      env.PGDATABASE || '',
      inputPath,
    ], {
      env,
      stdio: ['ignore', 'ignore', 'pipe'],
    })

    let stderr = ''

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
      if (stderr.length > 4000) stderr = stderr.slice(-4000)
    })

    child.on('error', (error) => {
      reject(error)
    })

    child.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`pg_restore exited with code ${code}${stderr ? `: ${stderr}` : ''}`))
    })
  })
}
