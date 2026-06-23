export function getClientIp(request: Request) {
  const cloudflareIp = request.headers.get('cf-connecting-ip')?.trim()
  if (cloudflareIp) return cloudflareIp

  const forwardedFor = request.headers.get('x-forwarded-for')
  const firstForwardedIp = forwardedFor?.split(',')[0]?.trim()
  if (firstForwardedIp) return firstForwardedIp

  return request.headers.get('x-real-ip')?.trim() || 'unknown'
}

export async function readJsonBody<T = Record<string, unknown>>(request: Request): Promise<T> {
  return await request.json() as T
}

export function toInt(value: unknown, fallback?: number) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) ? parsed : fallback
}
