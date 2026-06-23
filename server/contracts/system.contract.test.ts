import { describe, expect, test } from 'bun:test'

import { createTestApp, jsonRequest, postJson, sessionCookie, setDbForTesting } from './helpers'

describe('system contract', () => {
    test('GET /health returns the health payload', async () => {
      const app = createTestApp()
  
      const response = await app.handle(jsonRequest('/health'))
  
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ ok: true })
    })

    test('unknown routes keep the legacy not found error shape', async () => {
      const app = createTestApp()
  
      const response = await app.handle(jsonRequest('/api/not-found'))
  
      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({ error: 'Not Found' })
    })

    test('POST /api/reset without a session keeps the Vietnamese legacy error shape', async () => {
      const app = createTestApp()
  
      const response = await app.handle(postJson('/api/reset', { confirm: 'RESET' }))
  
      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({ error: 'Chưa đăng nhập' })
    })

    test('GET /openapi/json exposes the OpenAPI contract metadata', async () => {
      const app = createTestApp()
  
      const response = await app.handle(jsonRequest('/openapi/json'))
      const body = await response.json() as {
        openapi?: string
        info?: { title?: string; version?: string; description?: string }
        paths?: Record<string, unknown>
      }
  
      expect(response.status).toBe(200)
      expect(body.openapi).toStartWith('3.')
      expect(body.info).toEqual({
        title: 'Court Management API',
        version: '0.1.0',
        description: 'API documentation for the court records management system.',
      })
      expect(body.paths).toHaveProperty('/health')
      expect(body.paths).toHaveProperty('/api/auth/login')
    })

    test('GET /openapi/json documents health and auth route contracts', async () => {
      const app = createTestApp()
  
      const response = await app.handle(jsonRequest('/openapi/json'))
      const body = await response.json() as {
        paths?: Record<string, {
          get?: { tags?: string[]; summary?: string; responses?: Record<string, unknown> }
          post?: {
            tags?: string[]
            summary?: string
            requestBody?: unknown
            responses?: Record<string, unknown>
          }
        }>
      }
  
      expect(response.status).toBe(200)
      expect(body.paths?.['/health']?.get).toMatchObject({
        tags: ['System'],
        summary: 'Health check',
      })
      expect(body.paths?.['/api/auth/login']?.post).toMatchObject({
        tags: ['Auth'],
        summary: 'Login',
      })
      expect(body.paths?.['/api/auth/login']?.post?.requestBody).toBeDefined()
      expect(body.paths?.['/api/auth/login']?.post?.responses).toHaveProperty('200')
      expect(body.paths?.['/api/auth/logout']?.post).toMatchObject({
        tags: ['Auth'],
        summary: 'Logout',
      })
      expect(body.paths?.['/api/auth/session/update']?.post).toMatchObject({
        tags: ['Auth'],
        summary: 'Refresh session',
      })
    })

    test('GET /openapi exposes the documentation UI', async () => {
      const app = createTestApp()
  
      const response = await app.handle(jsonRequest('/openapi'))
      const body = await response.text()
  
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toContain('text/html')
      expect(body).toContain('Court Management API')
    })
})
