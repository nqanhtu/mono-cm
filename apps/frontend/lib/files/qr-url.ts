export function getFileDetailQrUrl(fileId: string, origin?: string) {
  const baseUrl = origin ?? (typeof window === 'undefined' ? '' : window.location.origin)
  const path = `/files/${encodeURIComponent(fileId)}`

  return baseUrl ? `${baseUrl}${path}` : path
}
