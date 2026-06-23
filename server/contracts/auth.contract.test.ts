import { describe, expect, test } from 'bun:test'
import bcrypt from 'bcryptjs'

import { createTestApp, jsonRequest, postJson, sessionCookie, setDbForTesting } from './helpers'

describe('auth contract', () => {
    test('OPTIONS /api/auth/session allows the frontend MAC address header', async () => {
      const app = createTestApp()
      const origin = 'https://court-management-livid.vercel.app'

      const response = await app.handle(jsonRequest('/api/auth/session', {
        method: 'OPTIONS',
        headers: {
          origin,
          'access-control-request-method': 'GET',
          'access-control-request-headers': 'x-mac-address',
        },
      }))

      expect(response.status).toBe(204)
      expect(response.headers.get('access-control-allow-origin')).toBe(origin)
      expect(response.headers.get('access-control-allow-headers')).toContain('x-mac-address')
    })

    test('protected routes without a session keep the legacy error shape', async () => {
      const app = createTestApp()
  
      const response = await app.handle(jsonRequest('/api/users'))
  
      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({ error: 'Unauthorized' })
    })

    test('POST /api/auth/login with missing credentials keeps the legacy response shape', async () => {
      const app = createTestApp()
  
      const response = await app.handle(postJson('/api/auth/login', { username: 'admin' }))
  
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        success: false,
        message: 'Vui lòng nhập đầy đủ thông tin',
      })
    })

    test('POST /api/auth/session/update without a session keeps the API error shape', async () => {
      const app = createTestApp()
  
      const response = await app.handle(postJson('/api/auth/session/update', {}))
  
      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({
        success: false,
        message: 'No session',
      })
    })

    test('POST /api/auth/session/update with an invalid session keeps the API error shape', async () => {
      const app = createTestApp()
  
      const response = await app.handle(postJson('/api/auth/session/update', {}, {
        headers: { cookie: 'session=invalid-token' },
      }))
  
      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({
        success: false,
        message: 'Invalid session',
      })
    })

    test('POST /api/auth/logout keeps the success response shape and clears the cookie', async () => {
      const app = createTestApp()
      setDbForTesting({
        userAccessLog: {
          create: async () => ({ id: 'access-logout' }),
        },
      })
  
      const response = await app.handle(jsonRequest('/api/auth/logout', {
        method: 'POST',
        headers: { cookie: await sessionCookie('ADMIN') },
      }))
  
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ success: true })
      expect(response.headers.get('set-cookie')).toContain('session=;')
    })

    test('POST /api/auth/login records a successful access log with request device metadata', async () => {
      const app = createTestApp()
      const accessLogCreateCalls: unknown[] = []
      const password = await bcrypt.hash('secret', 4)

      setDbForTesting({
        user: {
          findUnique: async () => ({
            id: 'user-1',
            username: 'admin',
            password,
            status: true,
            role: 'SUPER_ADMIN',
            fullName: 'Admin User',
          }),
        },
        userAccessLog: {
          create: async (args: unknown) => {
            accessLogCreateCalls.push(args)
            return { id: 'access-1' }
          },
        },
      })

      const response = await app.handle(postJson('/api/auth/login', {
        username: 'admin',
        password: 'secret',
      }, {
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
          'x-forwarded-for': '203.0.113.10',
        },
      }))

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ success: true })
      expect(accessLogCreateCalls).toHaveLength(1)
      expect(accessLogCreateCalls[0]).toMatchObject({
        data: {
          userId: 'user-1',
          event: 'LOGIN',
          ipAddress: '203.0.113.10',
          deviceType: 'desktop',
          osName: 'Windows',
          browserName: 'Chrome',
        },
      })
    })

    test('POST /api/auth/login stores only the client IP from a forwarded chain', async () => {
      const app = createTestApp()
      const accessLogCreateCalls: unknown[] = []
      const password = await bcrypt.hash('secret', 4)

      setDbForTesting({
        user: {
          findUnique: async () => ({
            id: 'user-1',
            username: 'admin',
            password,
            status: true,
            role: 'SUPER_ADMIN',
            fullName: 'Admin User',
          }),
        },
        userAccessLog: {
          create: async (args: unknown) => {
            accessLogCreateCalls.push(args)
            return { id: 'access-1' }
          },
        },
      })

      const response = await app.handle(postJson('/api/auth/login', {
        username: 'admin',
        password: 'secret',
      }, {
        headers: {
          'x-forwarded-for': '115.76.51.82, 54.179.125.20, 162.158.189.66, 10.197.9.129',
        },
      }))

      expect(response.status).toBe(200)
      expect(accessLogCreateCalls[0]).toMatchObject({
        data: {
          ipAddress: '115.76.51.82',
        },
      })
    })

    test('POST /api/auth/logout records a logout access log when a session exists', async () => {
      const app = createTestApp()
      const accessLogCreateCalls: unknown[] = []

      setDbForTesting({
        userAccessLog: {
          create: async (args: unknown) => {
            accessLogCreateCalls.push(args)
            return { id: 'access-logout' }
          },
        },
      })

      const response = await app.handle(jsonRequest('/api/auth/logout', {
        method: 'POST',
        headers: {
          cookie: await sessionCookie('ADMIN'),
          'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
          'x-real-ip': '198.51.100.7',
        },
      }))

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ success: true })
      expect(accessLogCreateCalls).toHaveLength(1)
      expect(accessLogCreateCalls[0]).toMatchObject({
        data: {
          userId: 'test-user-id',
          event: 'LOGOUT',
          ipAddress: '198.51.100.7',
          deviceType: 'mobile',
          osName: 'iOS',
          browserName: 'Mobile Safari',
        },
      })
    })

    test('POST /api/auth/logout without a session does not create an access log', async () => {
      const app = createTestApp()
      const accessLogCreateCalls: unknown[] = []

      setDbForTesting({
        userAccessLog: {
          create: async (args: unknown) => {
            accessLogCreateCalls.push(args)
            return { id: 'access-logout' }
          },
        },
      })

      const response = await app.handle(jsonRequest('/api/auth/logout', { method: 'POST' }))

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ success: true })
      expect(accessLogCreateCalls).toHaveLength(0)
    })

    test('protected routes with an insufficient role keep the legacy forbidden error shape', async () => {
      const app = createTestApp()
  
      const response = await app.handle(jsonRequest('/api/users', {
        headers: { cookie: await sessionCookie('VIEWER') },
      }))
  
      expect(response.status).toBe(403)
      expect(await response.json()).toEqual({ error: 'Forbidden' })
    })
})
