import { getFileDetailQrUrl } from '@/lib/files/qr-url'

describe('getFileDetailQrUrl', () => {
  it('builds an absolute file detail URL from an origin', () => {
    expect(getFileDetailQrUrl('file-1', 'https://court.example')).toBe('https://court.example/files/file-1')
  })

  it('encodes file ids before adding them to the URL path', () => {
    expect(getFileDetailQrUrl('file id/1', 'https://court.example')).toBe('https://court.example/files/file%20id%2F1')
  })
})
