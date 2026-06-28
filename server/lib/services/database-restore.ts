import { db } from '../db';
import * as zlib from 'node:zlib';

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

const MODELS = [
  'borrowSlipEvent',
  'borrowItem',
  'borrowSlip',
  'fileIndex',
  'document',
  'file',
  'storageBoxLabel',
  'storageBox',
  'auditLog',
  'userAccessLog',
  'agencyHistory',
  'storageLayout',
  'backupRun',
  'user',
  'backupSchedule',
];

let restoreInProgress = false;
let restoreRunner: PostgresRestoreRunner = runJsNativeRestore;

export function setPostgresRestoreRunnerForTesting(runner: PostgresRestoreRunner) {
  restoreRunner = runner;
}

export function resetPostgresRestoreRunnerForTesting() {
  restoreRunner = runJsNativeRestore;
  restoreInProgress = false;
}

export async function restorePostgresBackup(input: PostgresRestoreInput): Promise<DatabaseRestoreResult> {
  return await restoreRunner(input);
}

function convertDates(obj: any): any {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) {
    return obj.map(convertDates);
  }
  const result = { ...obj } as Record<string, any>;
  for (const key of Object.keys(result)) {
    const val = result[key];
    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
      result[key] = new Date(val);
    } else if (typeof val === 'object' && val !== null) {
      result[key] = convertDates(val);
    }
  }
  return result;
}

async function runJsNativeRestore(input: PostgresRestoreInput): Promise<DatabaseRestoreResult> {
  if (restoreInProgress) {
    throw new Error('A database restore is already in progress');
  }

  restoreInProgress = true;

  try {
    const arrayBuffer = await input.file.arrayBuffer();
    const gzipBuffer = Buffer.from(arrayBuffer);
    const jsonString = zlib.gunzipSync(gzipBuffer).toString('utf-8');
    const payload = JSON.parse(jsonString);

    if (!payload.metadata || payload.metadata.version !== '1.0' || !payload.data) {
      throw new Error('Invalid backup file format');
    }

    const backupData = convertDates(payload.data);

    await db.$transaction(async (tx) => {
      // 1. Clear all tables in child-to-parent order to avoid foreign key violations
      for (const model of MODELS) {
        if (model in tx) {
          await (tx as any)[model].deleteMany();
        }
      }

      // 2. Populate tables in reverse order (parent-to-child)
      for (const model of [...MODELS].reverse()) {
        if (model in tx && backupData[model]) {
          const records = backupData[model];
          if (records.length > 0) {
            await (tx as any)[model].createMany({
              data: records,
              skipDuplicates: true
            });
          }
        }
      }
    }, {
      timeout: 30000 // 30s timeout for import transaction
    });

    return {
      filename: input.filename,
      size: input.size,
    };
  } finally {
    restoreInProgress = false;
  }
}
