import type { Context } from 'elysia'

export type AppSet = Context['set']

export type ApiPayload<T> = {
  success: boolean
  data?: T
  message?: string
  errors?: unknown
}

export function apiSuccess<T>(data?: T, message?: string) {
  return { success: true, data, message } satisfies ApiPayload<T>
}

export function apiError(set: AppSet, message: string, status = 400, errors?: unknown) {
  set.status = status
  return { success: false, message, errors } satisfies ApiPayload<never>
}

export function jsonError(set: AppSet, error: string, status = 400) {
  set.status = status
  return { error }
}
