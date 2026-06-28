import { db } from '../db';
import * as zlib from 'node:zlib';
import { Readable } from 'node:stream';

export type DatabaseBackup = {
  filename: string
  size: number
  buffer: Buffer
  stream: () => ReadableStream<Uint8Array>
  cleanup: () => Promise<void>
}

export type PostgresBackupRunner = () => Promise<DatabaseBackup>

const MODELS = [
  'user',
  'agencyHistory',
  'storageLayout',
  'backupSchedule',
  'backupRun',
  'storageBox',
  'auditLog',
  'userAccessLog',
  'storageBoxLabel',
  'file',
  'borrowSlip',
  'fileIndex',
  'document',
  'borrowItem',
  'borrowSlipEvent'
];

let backupInProgress = false;
let backupRunner: PostgresBackupRunner = runJsNativeBackup;

export function setPostgresBackupRunnerForTesting(runner: PostgresBackupRunner) {
  backupRunner = runner;
}

export function resetPostgresBackupRunnerForTesting() {
  backupRunner = runJsNativeBackup;
  backupInProgress = false;
}

export async function createPostgresBackup(): Promise<DatabaseBackup> {
  return await backupRunner();
}

async function runJsNativeBackup(): Promise<DatabaseBackup> {
  if (backupInProgress) {
    throw new Error('A database backup is already in progress');
  }

  backupInProgress = true;

  try {
    const backupData: Record<string, any[]> = {};
    for (const model of MODELS) {
      if (model in db && typeof (db as any)[model]?.findMany === 'function') {
        backupData[model] = await (db as any)[model].findMany();
      }
    }

    const payload = {
      metadata: {
        version: '1.0',
        timestamp: new Date().toISOString(),
      },
      data: backupData,
    };

    const jsonString = JSON.stringify(payload);
    const compressedBuffer = zlib.gzipSync(Buffer.from(jsonString, 'utf-8'));

    const filename = `court-management-${new Date().toISOString().replace(/[:.]/g, '-')}.json.gz`;

    const stream = () => {
      const readable = new Readable({
        read() {
          this.push(compressedBuffer);
          this.push(null);
        }
      });
      return Readable.toWeb(readable) as unknown as ReadableStream<Uint8Array>;
    };

    return {
      filename,
      size: compressedBuffer.length,
      buffer: compressedBuffer,
      stream,
      cleanup: async () => {
        // No-op for memory backup buffer
      },
    };
  } finally {
    backupInProgress = false;
  }
}
