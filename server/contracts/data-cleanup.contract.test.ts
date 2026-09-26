import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'

import { dataCleanupRoutes } from '@/api-routes/data-cleanup.routes'
import { encrypt } from '@/lib/auth-jwt'
import { resetDbForTesting, setDbForTesting } from '@/lib/db'

type Call = { model: string; op: string; args: any }

function createFakeDb(seed: {
  boxes?: { id: string; caseType: string | null }[]
  files?: { id: string; type: string; status?: string }[]
}) {
  const boxes = seed.boxes ?? []
  const files = seed.files ?? []
  const calls: Call[] = []
  const record = (model: string, op: string, args: any) => calls.push({ model, op, args })

  const matches = (value: string | null, cond: any) =>
    cond === undefined ? true : cond === null ? value === null : typeof cond === 'object' ? cond.in.includes(value) : value === cond

  const liveFile = (file: { status?: string }, where: any) => !(where?.NOT?.status && file.status === where.NOT.status)

  const groupCounts = <T>(rows: T[], key: keyof T) => {
    const counts = new Map<unknown, number>()
    for (const row of rows) counts.set(row[key], (counts.get(row[key]) ?? 0) + 1)
    return [...counts].map(([value, count]) => ({ [key]: value, _count: { _all: count } }))
  }

  const fakeDb: any = {
    storageBox: {
      groupBy: async (args: any) => (record('storageBox', 'groupBy', args), groupCounts(boxes, 'caseType')),
      findMany: async (args: any) => {
        record('storageBox', 'findMany', args)
        const where = args.where
        if (where.OR) return boxes.filter((box) => where.OR.some((c: any) => matches(box.caseType, c.caseType)))
        return boxes.filter((box) => matches(box.caseType, where.caseType)).map(({ id }) => ({ id }))
      },
      findUnique: async (args: any) => (record('storageBox', 'findUnique', args), boxes.find((box) => box.id === args.where.id) ?? null),
      updateMany: async (args: any) => {
        record('storageBox', 'updateMany', args)
        const hit = boxes.filter((box) => matches(box.id, args.where.id) && matches(box.caseType, args.where.caseType))
        for (const box of hit) box.caseType = args.data.caseType
        return { count: hit.length }
      },
    },
    file: {
      groupBy: async (args: any) => (record('file', 'groupBy', args), groupCounts(files.filter((file) => liveFile(file, args.where)), 'type')),
      findMany: async (args: any) => {
        record('file', 'findMany', args)
        return files.filter((file) => liveFile(file, args.where) && matches(file.type, args.where.type)).map(({ id }) => ({ id, box: null }))
      },
      findUnique: async (args: any) => (record('file', 'findUnique', args), files.find((file) => file.id === args.where.id) ?? null),
      updateMany: async (args: any) => {
        record('file', 'updateMany', args)
        const hit = files.filter((file) => matches(file.id, args.where.id) && matches(file.type, args.where.type))
        for (const file of hit) file.type = args.data.type
        return { count: hit.length }
      },
    },
    auditLog: { create: async (args: any) => (record('auditLog', 'create', args), {}) },
    $transaction: async (fn: (tx: any) => unknown) => fn(fakeDb),
  }

  return { fakeDb, calls, boxes, files }
}

async function cookieFor(role: string) {
  const token = await encrypt({ id: `user-${role}`, username: role.toLowerCase(), fullName: role, role })
  return `session=${token}`
}

const app = new Elysia().use(dataCleanupRoutes)

async function call(method: string, path: string, role: string | null, body?: unknown) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (role) headers.cookie = await cookieFor(role)
  const response = await app.handle(new Request(`http://localhost${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }))
  return { status: response.status, body: await response.json().catch(() => null) }
}

let fake: ReturnType<typeof createFakeDb>

beforeEach(() => {
  fake = createFakeDb({
    boxes: [
      { id: 'b1', caseType: 'Hôn nhân sơ thẩm' },
      { id: 'b2', caseType: 'Hơn nhân sơ thẩm' },
      { id: 'b3', caseType: 'Hơn nhân sơ thẩm' },
      { id: 'b4', caseType: null },
    ],
    files: [
      { id: 'f1', type: 'Hôn nhân sơ thẩm' },
      { id: 'f2', type: 'Hơn nhân sơ thẩm' },
      { id: 'f3', type: 'Hình sự ' },
      { id: 'f4', type: '' },
      { id: 'f5', type: 'Hơn nhân sơ thẩm', status: 'ARCHIVED' },
      { id: 'f6', type: '', status: 'ARCHIVED' },
    ],
  })
  setDbForTesting(fake.fakeDb)
})

afterEach(() => resetDbForTesting())

describe('permissions', () => {
  const endpoints: [string, string, unknown?][] = [
    ['GET', '/api/admin/data-cleanup/case-types'],
    ['GET', '/api/admin/data-cleanup/case-types/blank'],
    ['POST', '/api/admin/data-cleanup/case-types/rename', { from: 'Hơn nhân sơ thẩm', to: 'Hôn nhân sơ thẩm' }],
    ['POST', '/api/admin/data-cleanup/case-types/fill', { kind: 'box', id: 'b4', value: 'Dân sự sơ thẩm' }],
  ]

  for (const [method, path, body] of endpoints) {
    it(`${method} ${path} is SUPER_ADMIN only`, async () => {
      expect((await call(method, path, null, body)).status).toBe(401)
      for (const role of ['ADMIN', 'VIEWER', 'COORDINATOR']) {
        expect((await call(method, path, role, body)).status).toBe(403)
      }
      expect(fake.calls.filter((c) => c.op === 'updateMany')).toEqual([])
      expect((await call(method, path, 'SUPER_ADMIN', body)).status).toBe(200)
    })
  }
})

describe('GET /api/admin/data-cleanup/case-types', () => {
  it('returns exact-value groups with box/file counts and a blank bucket', async () => {
    const { body } = await call('GET', '/api/admin/data-cleanup/case-types', 'SUPER_ADMIN')
    expect(body).toEqual({
      groups: [
        { value: 'Hình sự ', boxCount: 0, fileCount: 1, hasExtraWhitespace: true },
        { value: 'Hôn nhân sơ thẩm', boxCount: 1, fileCount: 1, hasExtraWhitespace: false },
        { value: 'Hơn nhân sơ thẩm', boxCount: 2, fileCount: 1, hasExtraWhitespace: false },
      ],
      blank: { boxCount: 1, fileCount: 1 },
    })
  })
})

describe('POST /api/admin/data-cleanup/case-types/rename', () => {
  it('updates only records holding exactly the old value and trims the new value', async () => {
    const { status, body } = await call('POST', '/api/admin/data-cleanup/case-types/rename', 'SUPER_ADMIN', {
      from: 'Hơn nhân sơ thẩm',
      to: '  Hôn nhân sơ thẩm ',
    })

    expect(status).toBe(200)
    expect(body).toEqual({ boxesUpdated: 2, filesUpdated: 1 })
    expect(fake.boxes.map((b) => b.caseType)).toEqual(['Hôn nhân sơ thẩm', 'Hôn nhân sơ thẩm', 'Hôn nhân sơ thẩm', null])
    expect(fake.files.map((f) => f.type)).toEqual(['Hôn nhân sơ thẩm', 'Hôn nhân sơ thẩm', 'Hình sự ', '', 'Hơn nhân sơ thẩm', ''])
    expect(fake.calls.find((c) => c.model === 'storageBox' && c.op === 'findMany')!.args.where).toEqual({ caseType: 'Hơn nhân sơ thẩm' })
    expect(fake.calls.find((c) => c.model === 'file' && c.op === 'findMany')!.args.where).toEqual({ type: 'Hơn nhân sơ thẩm', NOT: { status: 'ARCHIVED' } })
  })

  it('writes an audit log with old value, new value and affected ids', async () => {
    await call('POST', '/api/admin/data-cleanup/case-types/rename', 'SUPER_ADMIN', { from: 'Hơn nhân sơ thẩm', to: 'Hôn nhân sơ thẩm' })
    const audit = fake.calls.find((c) => c.model === 'auditLog')!.args.data
    expect(audit.action).toBe('UPDATE')
    expect(audit.userId).toBe('user-SUPER_ADMIN')
    expect(JSON.parse(audit.detail)).toEqual({
      operation: 'rename',
      from: 'Hơn nhân sơ thẩm',
      to: 'Hôn nhân sơ thẩm',
      boxIds: ['b2', 'b3'],
      fileIds: ['f2'],
    })
  })

  it('returns zero counts when the old value no longer exists', async () => {
    const { status, body } = await call('POST', '/api/admin/data-cleanup/case-types/rename', 'SUPER_ADMIN', { from: 'Không tồn tại', to: 'Dân sự sơ thẩm' })
    expect(status).toBe(200)
    expect(body).toEqual({ boxesUpdated: 0, filesUpdated: 0 })
  })

  it('rejects blank new value, unchanged value and renaming the blank bucket', async () => {
    for (const payload of [
      { from: 'Hơn nhân sơ thẩm', to: '   ' },
      { from: 'Hơn nhân sơ thẩm', to: 'Hơn nhân sơ thẩm' },
      { from: '', to: 'Dân sự sơ thẩm' },
      { from: null, to: 'Dân sự sơ thẩm' },
    ]) {
      expect((await call('POST', '/api/admin/data-cleanup/case-types/rename', 'SUPER_ADMIN', payload)).status).toBe(400)
    }
    expect(fake.calls.filter((c) => c.op === 'updateMany')).toEqual([])
  })
})

describe('POST /api/admin/data-cleanup/case-types/fill', () => {
  it('fills a blank box and a blank file, trimming the value', async () => {
    expect((await call('POST', '/api/admin/data-cleanup/case-types/fill', 'SUPER_ADMIN', { kind: 'box', id: 'b4', value: ' Dân sự sơ thẩm ' })).status).toBe(200)
    expect((await call('POST', '/api/admin/data-cleanup/case-types/fill', 'SUPER_ADMIN', { kind: 'file', id: 'f4', value: 'Hình sự sơ thẩm' })).status).toBe(200)
    expect(fake.boxes.find((b) => b.id === 'b4')!.caseType).toBe('Dân sự sơ thẩm')
    expect(fake.files.find((f) => f.id === 'f4')!.type).toBe('Hình sự sơ thẩm')
    expect(fake.calls.filter((c) => c.model === 'auditLog')).toHaveLength(2)
  })

  it('refuses to overwrite a record that already has a case type', async () => {
    const res = await call('POST', '/api/admin/data-cleanup/case-types/fill', 'SUPER_ADMIN', { kind: 'box', id: 'b1', value: 'Dân sự sơ thẩm' })
    expect(res.status).toBe(409)
    expect(fake.boxes.find((b) => b.id === 'b1')!.caseType).toBe('Hôn nhân sơ thẩm')
  })

  it('treats archived (soft-deleted) files as not found', async () => {
    expect((await call('POST', '/api/admin/data-cleanup/case-types/fill', 'SUPER_ADMIN', { kind: 'file', id: 'f6', value: 'Dân sự sơ thẩm' })).status).toBe(404)
    expect(fake.files.find((f) => f.id === 'f6')!.type).toBe('')
  })

  it('returns 404 for unknown records and 400 for invalid input', async () => {
    expect((await call('POST', '/api/admin/data-cleanup/case-types/fill', 'SUPER_ADMIN', { kind: 'file', id: 'nope', value: 'X' })).status).toBe(404)
    expect((await call('POST', '/api/admin/data-cleanup/case-types/fill', 'SUPER_ADMIN', { kind: 'box', id: 'b4', value: '  ' })).status).toBe(400)
    expect((await call('POST', '/api/admin/data-cleanup/case-types/fill', 'SUPER_ADMIN', { kind: 'other', id: 'b4', value: 'X' })).status).toBe(400)
  })
})

describe('GET /api/admin/data-cleanup/case-types/blank', () => {
  it('lists blank boxes and files plus trimmed, de-duplicated suggestions', async () => {
    const { body } = await call('GET', '/api/admin/data-cleanup/case-types/blank', 'SUPER_ADMIN')
    expect(body.boxes.map((b: any) => b.id)).toEqual(['b4'])
    expect(body.files.map((f: any) => f.id)).toEqual(['f4'])
    expect(body.suggestions).toEqual(['Hình sự', 'Hôn nhân sơ thẩm', 'Hơn nhân sơ thẩm'])
  })
})
