import { Elysia, t } from 'elysia'
import bcrypt from 'bcryptjs'

import { db } from '@/lib/db'
import { encrypt, decrypt } from '@/lib/auth-jwt'
import { clearSessionCookie, getCookie, setSessionCookie } from '@/lib/cookies'
import { apiError } from '@/lib/http'
import { getSession } from '@/lib/session'
import { createUserAccessLog } from '@/lib/services/access-log'

const authSuccessSchema = t.Object({
  success: t.Boolean(),
})

const authMessageSchema = t.Object({
  success: t.Boolean(),
  message: t.String(),
})

export const authRoutes = new Elysia()
  .post('/api/auth/login', async ({ body, request, set }) => {
    try {
      const username = body.username
      const password = body.password

      if (!username || !password) {
        return { success: false, message: 'Vui lòng nhập đầy đủ thông tin' }
      }

      const user = await db.user.findUnique({ where: { username } })
      if (!user || !user.status) {
        set.status = 401
        return { success: false, message: 'Tài khoản không tồn tại hoặc bị khóa' }
      }

      const isValid = await bcrypt.compare(password, user.password)
      if (!isValid) {
        set.status = 401
        return { success: false, message: 'Sai mật khẩu' }
      }

      const session = await encrypt({
        id: user.id,
        username: user.username,
        role: user.role,
        fullName: user.fullName,
      })

      setSessionCookie(set, session)
      await createUserAccessLog({ event: 'LOGIN', request, userId: user.id })
      return { success: true }
    } catch (error) {
      console.error('Login error:', error)
      set.status = 500
      return { success: false, message: 'Lỗi hệ thống' }
    }
  }, {
    body: t.Object({
      username: t.Optional(t.String()),
      password: t.Optional(t.String()),
    }),
    response: {
      200: t.Union([authSuccessSchema, authMessageSchema]),
      401: authMessageSchema,
      500: authMessageSchema,
    },
    detail: {
      tags: ['Auth'],
      summary: 'Login',
    },
  })
  .post('/api/auth/logout', async ({ request, set }) => {
    const session = await getSession(request.headers)
    if (session?.id) {
      await createUserAccessLog({ event: 'LOGOUT', request, userId: session.id })
    }
    clearSessionCookie(set)
    return { success: true }
  }, {
    response: authSuccessSchema,
    detail: {
      tags: ['Auth'],
      summary: 'Logout',
    },
  })
  .get('/api/auth/session', async ({ request }) => {
    return await getSession(request.headers)
  }, {
    detail: {
      tags: ['Auth'],
      summary: 'Get current session',
    },
  })
  .post('/api/auth/session/update', async ({ request, set }) => {
    const session = getCookie(request.headers, 'session')
    if (!session) return apiError(set, 'No session', 401)

    try {
      const parsed = await decrypt(session) as Record<string, unknown>
      const expires = new Date(Date.now() + 8 * 60 * 60 * 1000)
      parsed.expires = expires
      const newSession = await encrypt(parsed)
      setSessionCookie(set, newSession, expires)
      return { success: true, expires }
    } catch {
      return apiError(set, 'Invalid session', 401)
    }
  }, {
    response: {
      200: t.Object({
        success: t.Boolean(),
        expires: t.Date(),
      }),
      401: authMessageSchema,
    },
    detail: {
      tags: ['Auth'],
      summary: 'Refresh session',
    },
  })
