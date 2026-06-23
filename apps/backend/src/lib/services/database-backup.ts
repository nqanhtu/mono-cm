import { spawn } from 'node:child_process'
import { mkdir, rm, stat } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { Readable } from 'node:stream'

export type DatabaseBackup = {
  filename: string
  size: number
  stream: () => ReadableStream<Uint8Array>
  cleanup: () => Promise<void>
}

export type PostgresBackupRunner = () => Promise<DatabaseBackup>

let backupInProgress = false
let backupRunner: PostgresBackupRunner = runPgDumpBackup

export function setPostgresBackupRunnerForTesting(runner: PostgresBackupRunner) {
  backupRunner = runner
}

export function resetPostgresBackupRunnerForTesting() {
  backupRunner = runPgDumpBackup
  backupInProgress = false
}

export async function createPostgresBackup() {
  return await backupRunner()
}

async function runPgDumpBackup(): Promise<DatabaseBackup> {
  if (backupInProgress) {
    throw new Error('A database backup is already in progress')
  }

  backupInProgress = true

  try {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error('DATABASE_URL is not configured')
    }

    const filename = `court-management-${new Date().toISOString().replace(/[:.]/g, '-')}.dump`
    const directory = join(tmpdir(), 'court-management-api-backups')
    const outputPath = join(directory, `${randomUUID()}-${filename}`)

    await mkdir(directory, { recursive: true })
    await runPgDump(outputPath, buildPgEnv(connectionString))

    const stats = await stat(outputPath)
    const cleanup = async () => {
      await rm(outputPath, { force: true })
    }

    return {
      filename,
      size: stats.size,
      stream: () => streamFileWithCleanup(outputPath, cleanup),
      cleanup,
    }
  } finally {
    backupInProgress = false
  }
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

function runPgDump(outputPath: string, env: NodeJS.ProcessEnv) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn('pg_dump', [
      '--format=custom',
      '--no-owner',
      '--no-acl',
      '--file',
      outputPath,
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

      reject(new Error(`pg_dump exited with code ${code}${stderr ? `: ${stderr}` : ''}`))
    })
  })
}

function streamFileWithCleanup(path: string, cleanup: () => Promise<void>) {
  const stream = Readable.toWeb(createReadStream(path)) as unknown as ReadableStream<Uint8Array>
  const reader = stream.getReader()

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const result = await reader.read()
      if (result.done) {
        controller.close()
        await cleanup()
        return
      }

      controller.enqueue(result.value)
    },
    async cancel() {
      await reader.cancel()
      await cleanup()
    },
  })
}
