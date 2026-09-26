import { test, expect } from 'bun:test'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import * as XLSX from 'xlsx'
import { digest } from '../../server/lib/excel-repair'

// Optional PostgreSQL/WASM runtime, installed outside the repository. No production connection.
const runtime = process.env.REPAIR_TEST_PGLITE
test.skipIf(!runtime)('repair CLI: preview, approval, atomic failure, apply, idempotence, stale guard and rollback', async () => {
  const { PGlite } = await import(runtime!)
  const dir = await mkdtemp(join(tmpdir(), 'excel-repair-test-'))
  const data = join(dir, 'pg')
  const preload = join(dir, 'adapter.ts')
  await writeFile(preload, `import { mock } from 'bun:test';
import { PGlite } from ${JSON.stringify(runtime)};
mock.module('pg', () => ({ Client: class {
 db; async connect(){this.db=new PGlite(${JSON.stringify(data)}); await this.db.waitReady;}
 async query(sql,args){const r=await this.db.query(sql,args);return {...r,rowCount:r.rowCount ?? r.affectedRows ?? r.rows.length};}
 async end(){await this.db?.close();}
}}));`)
  async function sql(query: string) { const db = new PGlite(data); try { return await db.query(query) } finally { await db.close() } }
  const setup = new PGlite(data)
  await setup.exec(`CREATE TABLE "StorageBox" (id text PRIMARY KEY, code text, "boxNumber" text);
    CREATE TABLE "File" (id text PRIMARY KEY, code text UNIQUE, title text, type text, year int, "boxId" text,
    "updatedAt" timestamp(3), plaintiffs text[], defendants text[], "civilDefendants" text[], "judgmentNumber" text, "judgmentDate" timestamp(3), details jsonb);
    CREATE TABLE "AuditLog" (id text PRIMARY KEY, action text, target text, "targetId" text, detail jsonb, "createdAt" timestamp(3));
    INSERT INTO "StorageBox" VALUES ('box','H12','12');
    INSERT INTO "File" VALUES ('file','HS-1','Test','Hình sự',2023,'box','2026-01-01','{}','{}','{}',NULL,NULL,'{"summary":"keep"}');`)
  await setup.close()
  const source = join(dir, 'source.xlsx')
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ 'Hồ sơ số': 'HS-1', 'Hộp số': '12', 'Tiêu đề': 'Test', 'Loại án': 'Hình sự', 'Thời gian': 2023, 'Nguyên đơn/người bị hại': 'A', 'Bị cáo/bị đơn': 'B', 'Số bản án/quyết định': '1/2023', 'Ngày bản án/quyết định': '15/04/2023' }]), 'Hồ sơ')
  await writeFile(source, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
  async function run(args: string[], expected = 0) {
    const child = Bun.spawn([process.execPath, '--preload', preload, resolve('prisma/scripts/repair-excel-import.ts'), '--database', 'postgres', ...args], { env: { ...process.env, REPAIR_DATABASE_URL: 'postgresql://test@localhost/postgres' }, stdout: 'pipe', stderr: 'pipe' })
    const [out, err, status] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
    expect(status, out + err).toBe(expected)
    return out + err
  }
  const planPath = join(dir, 'plan.json')
  await run(['--source', source, '--out', planPath])
  const plan = await Bun.file(planPath).json()
  expect(plan.summary.fields).toEqual({ plaintiffs: 1, defendants: 1, judgmentNumber: 1, judgmentDate: 1 })
  expect((await sql('SELECT plaintiffs FROM "File"')).rows[0].plaintiffs).toEqual([])
  await run(['--apply', '--plan', planPath, '--approve', 'wrong', '--out', join(dir, 'wrong.json')], 1)
  // Fail audit insertion after UPDATE: the entire transaction must roll back.
  await sql('ALTER TABLE "AuditLog" ADD CONSTRAINT fail_audit CHECK (target <> \'ExcelImportRepair\')')
  await run(['--apply', '--plan', planPath, '--approve', digest(plan), '--out', join(dir, 'failed.json')], 1)
  expect((await sql('SELECT plaintiffs FROM "File"')).rows[0].plaintiffs).toEqual([])
  await sql('ALTER TABLE "AuditLog" DROP CONSTRAINT fail_audit')
  const receiptPath = join(dir, 'receipt.json')
  await run(['--apply', '--plan', planPath, '--approve', digest(plan), '--out', receiptPath])
  expect((await sql('SELECT plaintiffs FROM "File"')).rows[0].plaintiffs).toEqual(['A'])
  expect((await sql('SELECT count(*) FROM "AuditLog"')).rows[0].count).toBe(1)
  const again = join(dir, 'again.json')
  await run(['--source', source, '--out', again])
  expect((await Bun.file(again).json()).changes).toEqual([])
  await run(['--apply', '--plan', planPath, '--approve', digest(plan), '--out', join(dir, 'stale.json')], 1)
  const receipt = await Bun.file(receiptPath).json()
  await sql('UPDATE "File" SET title=\'newer edit\'')
  await run(['--rollback', receiptPath, '--approve', digest(receipt), '--out', join(dir, 'stale-rollback.json')], 1)
  await sql('UPDATE "File" SET title=\'Test\'')
  await run(['--rollback', receiptPath, '--approve', digest(receipt), '--out', join(dir, 'rollback.json')])
  const restored = (await sql('SELECT plaintiffs, defendants, "judgmentDate", details FROM "File"')).rows[0]
  expect(restored).toEqual({ plaintiffs: [], defendants: [], judgmentDate: null, details: { summary: 'keep' } })
}, 120000)
