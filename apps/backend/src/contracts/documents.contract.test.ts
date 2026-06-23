import { describe, expect, test } from 'bun:test'

import { createTestApp, jsonRequest, postJson, sessionCookie, setDbForTesting } from './helpers'

describe('documents contract', () => {
    test('POST /api/documents keeps the successful create response shape', async () => {
      const app = createTestApp()
      const document = {
        id: 'doc-1',
        fileId: 'file-1',
        title: 'Văn bản 1',
        code: null,
        year: 2026,
        pageCount: 10,
        order: 1,
        note: null,
        preservationTime: null,
        contentIndex: null,
      }
      const documentCreateCalls: unknown[] = []
      const auditCreateCalls: unknown[] = []
  
      setDbForTesting({
        document: {
          create: async (args: unknown) => {
            documentCreateCalls.push(args)
            return document
          },
        },
        file: {
          findUnique: async () => ({ id: 'file-1', isLocked: false }),
        },
        auditLog: {
          create: async (args: unknown) => {
            auditCreateCalls.push(args)
            return { id: 'audit-1' }
          },
        },
      })
  
      const response = await app.handle(postJson('/api/documents', {
        fileId: 'file-1',
        title: 'Văn bản 1',
        year: 2026,
        pageCount: 10,
        order: 1,
      }, {
        headers: { cookie: await sessionCookie('ADMIN') },
      }))
  
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ success: true, data: document })
      expect(documentCreateCalls).toHaveLength(1)
      expect(auditCreateCalls).toHaveLength(1)
    })

    test('DELETE /api/documents/:id keeps the not found API error shape', async () => {
      const app = createTestApp()
  
      setDbForTesting({
        document: {
          findUnique: async () => null,
        },
      })
  
      const response = await app.handle(jsonRequest('/api/documents/doc-missing', {
        method: 'DELETE',
        headers: { cookie: await sessionCookie('SUPER_ADMIN') },
      }))
  
      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({
        success: false,
        message: 'Document not found',
      })
    })

    test('POST /api/documents allows COORDINATOR users to add sub-profiles to their own profiles', async () => {
      const app = createTestApp()
      const documentCreateCalls: unknown[] = []
      const document = {
        id: 'doc-1',
        fileId: 'file-1',
        title: 'Văn bản mới',
        code: null,
        year: null,
        pageCount: null,
        order: 0,
        note: null,
        preservationTime: null,
        contentIndex: null,
        createdById: 'test-user-id',
        updatedById: 'test-user-id',
      }

      setDbForTesting({
        file: {
          findUnique: async () => ({
            id: 'file-1',
            isLocked: false,
            createdById: 'test-user-id',
          }),
        },
        document: {
          create: async (args: unknown) => {
            documentCreateCalls.push(args)
            return document
          },
        },
        auditLog: {
          create: async () => ({ id: 'audit-1' }),
        },
      })

      const response = await app.handle(postJson('/api/documents', {
        fileId: 'file-1',
        title: 'Văn bản mới',
      }, {
        headers: { cookie: await sessionCookie('COORDINATOR') },
      }))

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ success: true, data: document })
      expect(documentCreateCalls).toEqual([
        {
          data: {
            fileId: 'file-1',
            title: 'Văn bản mới',
            code: null,
            year: null,
            pageCount: null,
            order: 0,
            note: null,
            preservationTime: null,
            contentIndex: null,
            createdById: 'test-user-id',
            updatedById: 'test-user-id',
          },
        },
      ])
    })

    test('POST /api/documents rejects COORDINATOR users adding sub-profiles to profiles they do not own', async () => {
      const app = createTestApp()

      setDbForTesting({
        file: {
          findUnique: async () => ({
            id: 'file-1',
            isLocked: false,
            createdById: 'another-user-id',
          }),
        },
      })

      const response = await app.handle(postJson('/api/documents', {
        fileId: 'file-1',
        title: 'Văn bản mới',
      }, {
        headers: { cookie: await sessionCookie('COORDINATOR') },
      }))

      expect(response.status).toBe(403)
      expect(await response.json()).toEqual({
        success: false,
        message: 'Không có quyền thêm tài liệu vào hồ sơ này',
      })
    })

    test('PUT /api/documents/:id - fails when parent file is locked and user is COORDINATOR', async () => {
      const app = createTestApp()
  
      setDbForTesting({
        document: {
          findUnique: async () => ({
            id: 'doc-1',
            title: 'Doc 1',
            fileId: 'file-1',
            file: { id: 'file-1', isLocked: true },
          }),
        },
      })
  
      const response = await app.handle(jsonRequest('/api/documents/doc-1', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          cookie: await sessionCookie('COORDINATOR'),
        },
        body: JSON.stringify({ title: 'Updated Title' }),
      }))
  
      expect(response.status).toBe(403)
      expect(await response.json()).toEqual({
        success: false,
        message: 'File is locked',
      })
    })

    test('PUT /api/documents/:id - succeeds when parent file is locked and user is SUPER_ADMIN', async () => {
      const app = createTestApp()
  
      setDbForTesting({
        document: {
          findUnique: async () => ({
            id: 'doc-1',
            title: 'Doc 1',
            fileId: 'file-1',
            file: { id: 'file-1', isLocked: true },
          }),
          update: async () => ({
            id: 'doc-1',
            title: 'Updated Title',
          }),
        },
        auditLog: {
          create: async () => ({ id: 'audit-1' }),
        },
      })
  
      const response = await app.handle(jsonRequest('/api/documents/doc-1', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          cookie: await sessionCookie('SUPER_ADMIN'),
        },
        body: JSON.stringify({ title: 'Updated Title' }),
      }))
  
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        success: true,
        data: { id: 'doc-1', title: 'Updated Title' },
      })
    })

    test('PUT /api/documents/:id allows COORDINATOR users to edit sub-profiles in their own profiles', async () => {
      const app = createTestApp()
      const updateCalls: unknown[] = []

      setDbForTesting({
        document: {
          findUnique: async () => ({
            id: 'doc-1',
            title: 'Văn bản cũ',
            fileId: 'file-1',
            file: {
              id: 'file-1',
              isLocked: false,
              createdById: 'test-user-id',
            },
          }),
          update: async (args: unknown) => {
            updateCalls.push(args)
            return {
              id: 'doc-1',
              title: 'Văn bản mới',
            }
          },
        },
        auditLog: {
          create: async () => ({ id: 'audit-1' }),
        },
      })

      const response = await app.handle(jsonRequest('/api/documents/doc-1', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          cookie: await sessionCookie('COORDINATOR'),
        },
        body: JSON.stringify({ title: 'Văn bản mới' }),
      }))

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        success: true,
        data: { id: 'doc-1', title: 'Văn bản mới' },
      })
      expect(updateCalls).toEqual([
        {
          where: { id: 'doc-1' },
          data: {
            title: 'Văn bản mới',
            code: null,
            year: null,
            pageCount: null,
            order: undefined,
            note: null,
            preservationTime: null,
            contentIndex: null,
            updatedById: 'test-user-id',
          },
        },
      ])
    })

    test('PUT /api/documents/:id rejects COORDINATOR users editing sub-profiles in profiles they do not own', async () => {
      const app = createTestApp()

      setDbForTesting({
        document: {
          findUnique: async () => ({
            id: 'doc-1',
            title: 'Văn bản cũ',
            fileId: 'file-1',
            file: {
              id: 'file-1',
              isLocked: false,
              createdById: 'another-user-id',
            },
          }),
        },
      })

      const response = await app.handle(jsonRequest('/api/documents/doc-1', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          cookie: await sessionCookie('COORDINATOR'),
        },
        body: JSON.stringify({ title: 'Văn bản mới' }),
      }))

      expect(response.status).toBe(403)
      expect(await response.json()).toEqual({
        success: false,
        message: 'Không có quyền chỉnh sửa tài liệu thuộc hồ sơ này',
      })
    })

    test('DELETE /api/documents/:id - fails when parent file is locked and user is COORDINATOR', async () => {
      const app = createTestApp()
  
      setDbForTesting({
        document: {
          findUnique: async () => ({
            id: 'doc-1',
            title: 'Doc 1',
            fileId: 'file-1',
            file: { id: 'file-1', isLocked: true },
          }),
        },
      })
  
      const response = await app.handle(jsonRequest('/api/documents/doc-1', {
        method: 'DELETE',
        headers: { cookie: await sessionCookie('COORDINATOR') },
      }))
  
      expect(response.status).toBe(403)
      expect(await response.json()).toEqual({
        success: false,
        message: 'Chỉ duy nhất SUPER_ADMIN mới được phép xóa hồ sơ con',
      })
    })

    test('POST /api/documents - fails when parent file is locked and user is COORDINATOR', async () => {
      const app = createTestApp()

      setDbForTesting({
        file: {
          findUnique: async () => ({
            id: 'file-1',
            isLocked: true,
          }),
        },
      })

      const response = await app.handle(postJson('/api/documents', {
        fileId: 'file-1',
        title: 'Văn bản mới',
      }, {
        headers: { cookie: await sessionCookie('COORDINATOR') },
      }))

      expect(response.status).toBe(403)
      expect(await response.json()).toEqual({
        success: false,
        message: 'Hồ sơ đã bị khóa, không thể thêm tài liệu con',
      })
    })
})
