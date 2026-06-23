import { randomUUID } from 'node:crypto'
import { SignJWT, jwtVerify } from 'jose'

const secret = process.env.JWT_SECRET

if (!secret) {
  throw new Error('JWT_SECRET is not defined in environment variables')
}

const key = new TextEncoder().encode(secret)

export type FileQrPayload = {
  resourceType: 'file'
  resourceId: string
  scope: 'read'
  nonce: string
}

export async function createFileQrToken(fileId: string) {
  return await new SignJWT({
    resourceType: 'file',
    resourceId: fileId,
    scope: 'read',
    nonce: randomUUID(),
  } satisfies FileQrPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(key)
}

export async function verifyFileQrToken(token: string) {
  const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] })
  if (
    payload.resourceType !== 'file' ||
    payload.scope !== 'read' ||
    typeof payload.resourceId !== 'string'
  ) {
    throw new Error('Invalid QR token payload')
  }

  return payload as unknown as FileQrPayload
}
