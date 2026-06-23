import { describe, expect, test } from 'bun:test'

import { createTestApp, jsonRequest, postJson, sessionCookie, setDbForTesting } from './helpers'

describe('upload contract', () => {
    test('POST /api/upload/excel/preview without a session keeps the legacy auth error shape', async () => {
      const app = createTestApp()
      const formData = new FormData()
  
      const response = await app.handle(jsonRequest('/api/upload/excel/preview', {
        method: 'POST',
        body: formData,
      }))
  
      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({ error: 'Unauthorized' })
    })

    test('POST /api/upload/excel/preview with no file keeps the API error shape', async () => {
      const app = createTestApp()
      const formData = new FormData()
  
      const response = await app.handle(jsonRequest('/api/upload/excel/preview', {
        method: 'POST',
        headers: { cookie: await sessionCookie('ADMIN') },
        body: formData,
      }))
  
      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({
        success: false,
        message: 'Vui lòng chọn file Excel',
      })
    })

    test('POST /api/files/import-child-docs with no file keeps the legacy JSON error shape', async () => {
      const app = createTestApp()
      const formData = new FormData()
  
      const response = await app.handle(jsonRequest('/api/files/import-child-docs', {
        method: 'POST',
        headers: { cookie: await sessionCookie('ADMIN') },
        body: formData,
      }))
  
      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ error: 'Missing fileId or file' })
    })
})
