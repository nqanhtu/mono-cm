import { UAParser } from 'ua-parser-js'

import { db } from '@/lib/db'
import { getClientIp } from '@/lib/request'
import type { UserAccessEvent } from '@/generated/prisma/client'

export type AccessDeviceMetadata = {
  ipAddress: string
  macAddress: string | null
  userAgent: string
  deviceType: string
  osName: string | null
  osVersion: string | null
  browserName: string | null
  browserVersion: string | null
}

export function getAccessDeviceMetadata(request: Request): AccessDeviceMetadata {
  const userAgent = request.headers.get('user-agent') || ''
  const macAddress = request.headers.get('x-mac-address') || null
  const parsed = UAParser(userAgent)
  const deviceType = parsed.device.type || 'desktop'

  return {
    ipAddress: getClientIp(request),
    macAddress,
    userAgent,
    deviceType,
    osName: parsed.os.name || null,
    osVersion: parsed.os.version || null,
    browserName: parsed.browser.name || null,
    browserVersion: parsed.browser.version || null,
  }
}

export async function createUserAccessLog({
  event,
  request,
  userId,
}: {
  event: UserAccessEvent
  request: Request
  userId: string
}) {
  try {
    const metadata = getAccessDeviceMetadata(request)
    await db.userAccessLog.create({
      data: {
        userId,
        event,
        ...metadata,
      },
    })
  } catch (error) {
    console.error('Failed to create user access log:', error)
  }
}
