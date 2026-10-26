import vercelConfig from '../../vercel.json'
import { readFileSync } from 'node:fs'
import { COURT_SITES, courtName, courtSiteFor } from '@/lib/court-sites'

type Rewrite = { source: string; destination: string; has?: { type: string; value: string }[] }

describe('court sites', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  it('resolves only listed hosts', () => {
    expect(courtSiteFor('luutruhoso-tayninh-kv10.vercel.app')?.name).toBe('Toà án nhân dân khu vực 10 - Tây Ninh')
    expect(courtSiteFor('luutruhoso1.vercel.app')).toBeUndefined()
    expect(courtSiteFor('toString')).toBeUndefined()
  })

  it('falls back to VITE_COURT_NAME on hosts that are not shared court sites', () => {
    vi.stubEnv('VITE_COURT_NAME', 'Toà án cũ')
    expect(courtName()).toBe('Toà án cũ')
  })

  it('has exactly one host-gated /api proxy per court site, before the SPA fallback', () => {
    const rewrites = vercelConfig.rewrites as Rewrite[]
    const hostRewrites = rewrites.filter(r => r.has?.some(h => h.type === 'host'))
    const spaIndex = rewrites.findIndex(r => r.destination === '/index.html')

    expect(hostRewrites.map(r => r.has![0].value).sort()).toEqual(Object.keys(COURT_SITES).sort())
    for (const rewrite of hostRewrites) {
      const site = COURT_SITES[rewrite.has![0].value]
      expect(rewrite.source).toBe('/api/:path*')
      expect(rewrite.destination).toBe(`${site.backendUrl}/api/:path*`)
      expect(rewrites.indexOf(rewrite)).toBeLessThan(spaIndex)
    }
  })

  it('defines light and dark colors for every assigned court theme', () => {
    const courtThemesCss = readFileSync('app/court-themes.css', 'utf8')
    for (const { theme } of Object.values(COURT_SITES)) {
      if (!theme) continue
      expect(courtThemesCss).toContain(`:root[data-court-theme="${theme}"] {`)
      expect(courtThemesCss).toContain(`:root.dark[data-court-theme="${theme}"] {`)
    }
  })
})
