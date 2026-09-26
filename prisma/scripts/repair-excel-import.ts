/** Read-only by default. See docs/dev/excel-import-repair.md. */
import { Client } from 'pg'
import { createHash, randomUUID } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { parseExcelFile } from '../../server/lib/excel-parser'
import { assertReviewedPlan, buildRepairPlan, digest, same, type RepairPlan, type RepairRecord } from '../../server/lib/excel-repair'

const { values: args } = parseArgs({ options: {
  source: { type: 'string' }, database: { type: 'string' }, out: { type: 'string' },
  plan: { type: 'string' }, approve: { type: 'string' }, apply: { type: 'boolean' },
  rollback: { type: 'string' }, 'credentials-file': { type: 'string' }, port: { type: 'string' },
}, strict: true })

// Prisma stores timestamp-without-time-zone values as UTC. Avoid pg's local-time Date parser.
const columns = `f.id, f.code, f.title, f.type, f.year,
 to_char(f."updatedAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "updatedAt", f.plaintiffs, f.defendants,
 f."civilDefendants", f."judgmentNumber",
 to_char(f."judgmentDate", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "judgmentDate", f.details,
 b.code AS "boxCode", b."boxNumber"`
const database = args.database
if (!database || !args.out) throw new Error('--database và --out là bắt buộc')
if (args.apply && args.rollback) throw new Error('Chỉ chọn apply hoặc rollback')
const mutating = !!(args.apply || args.rollback)
let connectionString = process.env.REPAIR_DATABASE_URL
if (args['credentials-file']) {
  const doc = await readFile(args['credentials-file'], 'utf8')
  const urls = doc.match(/postgresql:\/\/[^\s`|]+/g) ?? []
  connectionString = urls.find(url => url.endsWith(`/${database}`))?.replace('<PORT>', args.port ?? '25433')
}
if (!connectionString) throw new Error('Thiếu REPAIR_DATABASE_URL hoặc thông tin kết nối trong --credentials-file')
const url = new URL(connectionString)
if (decodeURIComponent(url.pathname.slice(1)) !== database) throw new Error('Sai database trong kết nối')
const db = new Client({ connectionString, connectionTimeoutMillis: 10000, options: `-c default_transaction_read_only=${mutating ? 'off' : 'on'} -c statement_timeout=30000 -c lock_timeout=5000` })
const save = (path: string, data: unknown) => writeFile(path, JSON.stringify(data, null, 2), { mode: 0o600, flag: 'wx' })
const serial = <T>(data: T): T => JSON.parse(JSON.stringify(data))
async function records(codes: string[], lock = false): Promise<RepairRecord[]> {
  return serial((await db.query(`SELECT ${columns} FROM "File" f LEFT JOIN "StorageBox" b ON b.id=f."boxId" WHERE f.code=ANY($1::text[]) ORDER BY f.id ${lock ? 'FOR UPDATE OF f' : ''}`, [codes])).rows)
}
async function update(id: string, patch: Record<string, unknown>) {
  const keys = Object.keys(patch)
  if (!keys.length || keys.some(k => !['plaintiffs', 'defendants', 'judgmentNumber', 'judgmentDate', 'details'].includes(k))) throw new Error('Trường cập nhật không hợp lệ')
  const result = await db.query(`UPDATE "File" SET ${keys.map((k, i) => `"${k}"=$${i + 2}`).join(', ')}, "updatedAt"=clock_timestamp() WHERE id=$1`, [id, ...keys.map(k => k === 'details' && patch[k] != null ? JSON.stringify(patch[k]) : patch[k])])
  if (result.rowCount !== 1) throw new Error('Số hồ sơ cập nhật không hợp lệ')
}
type Receipt = { database: string; runId: string; planDigest: string; changes: { before: RepairRecord; after: RepairRecord; keys: string[] }[] }
try {
  await db.connect()
  await db.query(`BEGIN ISOLATION LEVEL REPEATABLE READ ${mutating ? 'READ WRITE' : 'READ ONLY'}`)
  await db.query("SET LOCAL TIME ZONE 'UTC'")
  const identity = (await db.query('SELECT current_database() AS name, current_setting(\'transaction_read_only\') AS read_only')).rows[0]
  if (identity.name !== database) throw new Error('Sai database đang kết nối')
  if (!mutating) {
    if (!args.source) throw new Error('--source là bắt buộc khi xem trước')
    const source = await readFile(args.source)
    const input = await parseExcelFile(source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength) as ArrayBuffer)
    const plan = buildRepairPlan(input, await records(input.files.map(f => f.code)), database, createHash('sha256').update(source).digest('hex'))
    await save(args.out, plan)
    console.log(JSON.stringify({ mode: 'READ ONLY', database, digest: digest(plan), summary: plan.summary, recordsToUpdate: plan.changes.length, blockers: plan.blockers, notes: plan.notes }, null, 2))
    await db.query('ROLLBACK')
  } else {
    const runId = randomUUID()
    const receipt: Receipt = { database, runId, planDigest: '', changes: [] }
    if (args.apply) {
      if (!args.plan || !args.approve) throw new Error('Apply cần --plan và --approve <digest>')
      const plan: RepairPlan = JSON.parse(await readFile(args.plan, 'utf8'))
      assertReviewedPlan(plan, args.approve, database)
      receipt.planDigest = digest(plan)
      const current = new Map((await records(plan.changes.map(c => c.before.code), true)).map(r => [r.id, r]))
      for (const { before, patch } of plan.changes) {
        if (!same(current.get(before.id), before)) throw new Error(`Hồ sơ đã thay đổi sau preview: ${before.code}`)
        await update(before.id, patch)
      }
      const after = new Map((await records(plan.changes.map(c => c.before.code))).map(r => [r.id, r]))
      for (const { before, patch } of plan.changes) {
        const actual = after.get(before.id)!
        if (!actual || Object.entries(patch).some(([key, value]) => !same(actual[key as keyof RepairRecord], value))) throw new Error(`Kiểm chứng sau cập nhật thất bại: ${before.code}`)
        receipt.changes.push({ before, after: actual, keys: Object.keys(patch) })
      }
    } else {
      const original: Receipt = JSON.parse(await readFile(args.rollback!, 'utf8'))
      if (original.database !== database || !args.approve || digest(original) !== args.approve) throw new Error('Rollback cần đúng database và digest của receipt')
      const audit = await db.query('SELECT id, detail FROM "AuditLog" WHERE id=$1 AND target=$2', [original.runId, 'ExcelImportRepair'])
      if (audit.rowCount !== 1) throw new Error('Không có nhật ký xác nhận đợt vá đã commit')
      if (audit.rows[0].detail?.receiptDigest !== digest(original)) throw new Error('Receipt không khớp bản đã ghi trong nhật ký')
      receipt.planDigest = digest(original)
      const current = new Map((await records(original.changes.map(c => c.after.code), true)).map(r => [r.id, r]))
      for (const change of original.changes) {
        if (!same(current.get(change.after.id), change.after)) throw new Error(`Không hoàn tác đè lên thay đổi mới: ${change.after.code}`)
        const patch = Object.fromEntries(change.keys.map(key => [key, change.before[key as keyof RepairRecord]]))
        await update(change.before.id, patch)
      }
      const after = new Map((await records(original.changes.map(c => c.after.code))).map(r => [r.id, r]))
      for (const change of original.changes) {
        const actual = after.get(change.before.id)!
        if (!actual || change.keys.some(key => !same(actual[key as keyof RepairRecord], change.before[key as keyof RepairRecord]))) throw new Error('Kiểm chứng hoàn tác thất bại')
        receipt.changes.push({ before: change.after, after: actual, keys: change.keys })
      }
    }
    // Save the recovery material before commit. If commit is ambiguous, consult AuditLog by runId.
    await save(args.out, receipt)
    await db.query('INSERT INTO "AuditLog" (id,action,target,"targetId",detail,"createdAt") VALUES ($1,\'UPDATE\',\'ExcelImportRepair\',$1,$2::jsonb,now())', [runId, JSON.stringify({ mode: args.apply ? 'apply' : 'rollback', planDigest: receipt.planDigest, receiptDigest: digest(receipt), count: receipt.changes.length })])
    await db.query('COMMIT')
    console.log(JSON.stringify({ committed: true, database, runId, changed: receipt.changes.length, receiptDigest: digest(receipt) }, null, 2))
  }
} catch (error) {
  await db.query('ROLLBACK').catch(() => {})
  console.error(error instanceof Error ? error.message.replace(/postgresql:\/\/\S+/g, '<REDACTED>') : 'Repair failed')
  process.exitCode = 1
} finally { await db.end() }
