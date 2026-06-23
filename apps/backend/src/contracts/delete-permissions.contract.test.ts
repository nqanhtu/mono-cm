import { describe, expect, test } from 'bun:test'
import { createTestApp, jsonRequest, sessionCookie, setDbForTesting } from './helpers'

describe('delete permissions and auditing contract', () => {
  test('DELETE /api/files/:id - reject COORDINATOR and regular ADMIN', async () => {
    const app = createTestApp()
    setDbForTesting({
      file: {
        findUnique: async () => ({ id: 'file-1', code: 'FILE001', title: 'File 1', status: 'IN_STOCK', isLocked: false, borrowItems: [] }),
      },
    })

    // Try with COORDINATOR
    const res1 = await app.handle(
      new Request('http://localhost/api/files/file-1', {
        method: 'DELETE',
        headers: { cookie: await sessionCookie('COORDINATOR') },
      })
    )
    expect(res1.status).toBe(403)

    // Try with ADMIN
    const res2 = await app.handle(
      new Request('http://localhost/api/files/file-1', {
        method: 'DELETE',
        headers: { cookie: await sessionCookie('ADMIN') },
      })
    )
    expect(res2.status).toBe(403)
  })

  test('DELETE /api/files/:id - allow SUPER_ADMIN and log audit', async () => {
    const app = createTestApp()
    let logCall: any = null
    setDbForTesting({
      file: {
        findUnique: async () => ({ id: 'file-1', code: 'FILE001', title: 'File 1', status: 'IN_STOCK', isLocked: false, borrowItems: [] }),
        update: async ({ data }: any) => ({ id: 'file-1', ...data }),
      },
      auditLog: {
        create: async ({ data }: any) => {
          logCall = data
          return {}
        },
      },
    })

    const res = await app.handle(
      new Request('http://localhost/api/files/file-1', {
        method: 'DELETE',
        headers: {
          cookie: await sessionCookie('SUPER_ADMIN', 'sa-1'),
          'x-mac-address': 'AA-BB-CC-DD-EE-FF',
        },
      })
    )
    expect(res.status).toBe(200)
    expect(logCall).not.toBeNull()
    expect(logCall.action).toBe('UPDATE') // Soft delete logs as UPDATE
    expect(logCall.macAddress).toBe('AA-BB-CC-DD-EE-FF')
    expect(logCall.userId).toBe('sa-1')
  })

  test('DELETE /api/documents/:id - reject COORDINATOR and regular ADMIN', async () => {
    const app = createTestApp()
    setDbForTesting({
      document: {
        findUnique: async () => ({ id: 'doc-1', title: 'Doc 1', fileId: 'file-1', file: { isLocked: false, createdById: 'creator-1' } }),
      },
    })

    const res1 = await app.handle(
      new Request('http://localhost/api/documents/doc-1', {
        method: 'DELETE',
        headers: { cookie: await sessionCookie('COORDINATOR') },
      })
    )
    expect(res1.status).toBe(403)

    const res2 = await app.handle(
      new Request('http://localhost/api/documents/doc-1', {
        method: 'DELETE',
        headers: { cookie: await sessionCookie('ADMIN') },
      })
    )
    expect(res2.status).toBe(403)
  })

  test('DELETE /api/documents/:id - allow SUPER_ADMIN and log audit', async () => {
    const app = createTestApp()
    let logCall: any = null
    setDbForTesting({
      document: {
        findUnique: async () => ({ id: 'doc-1', title: 'Doc 1', fileId: 'file-1', file: { isLocked: false, createdById: 'creator-1' } }),
        delete: async () => ({ id: 'doc-1' }),
      },
      auditLog: {
        create: async ({ data }: any) => {
          logCall = data
          return {}
        },
      },
    })

    const res = await app.handle(
      new Request('http://localhost/api/documents/doc-1', {
        method: 'DELETE',
        headers: {
          cookie: await sessionCookie('SUPER_ADMIN', 'sa-1'),
          'x-mac-address': 'AA-BB-CC-DD-EE-FF',
        },
      })
    )
    expect(res.status).toBe(200)
    expect(logCall).not.toBeNull()
    expect(logCall.action).toBe('DELETE')
    expect(logCall.macAddress).toBe('AA-BB-CC-DD-EE-FF')
    expect(logCall.userId).toBe('sa-1')
  })
})
