import { SignJWT, jwtVerify } from 'jose'

const secret = process.env.JWT_SECRET

if (!secret) {
  throw new Error('JWT_SECRET is not defined in environment variables')
}

const key = new TextEncoder().encode(secret)

export async function encrypt(payload: Record<string, unknown>) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(key)
}

export async function decrypt(input: string): Promise<unknown> {
  const { payload } = await jwtVerify(input, key, {
    algorithms: ['HS256'],
  })
  return payload
}
