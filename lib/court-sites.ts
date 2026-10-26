// Courts served from one shared Vercel project, one domain each. vercel.json
// proxies `/api/*` on each host to that court's backend (same-origin, so every
// court keeps its own session cookie). Hosts not listed here are the per-court
// Vercel projects, which still use VITE_API_URL / VITE_COURT_NAME.
// Keep in sync with the host-gated rewrites in vercel.json (checked by test).
// theme: a shadcn accent theme defined in app/court-themes.css.
export type CourtSite = {
  name: string
  backendUrl: string
  theme: 'emerald' | 'violet' | 'amber'
}

export const COURT_SITES: Record<string, CourtSite> = {
  'luutruhoso-tayninh-kv10.vercel.app': {
    name: 'Toà án nhân dân khu vực 10 - Tây Ninh',
    backendUrl: 'https://namnn07.zhost.store/tayninh-kv10',
    theme: 'emerald',
  },
  'luutruhoso-tayninh-kv11.vercel.app': {
    name: 'Toà án nhân dân khu vực 11 - Tây Ninh',
    backendUrl: 'https://namnn07.zhost.store/tayninh-kv11',
    theme: 'violet',
  },
  'luutruhoso-tayninh-kv12.vercel.app': {
    name: 'Toà án nhân dân khu vực 12 - Tây Ninh',
    backendUrl: 'https://namnn07.zhost.store/tayninh-kv12',
    theme: 'amber',
  },
}

export function courtSiteFor(hostname: string): CourtSite | undefined {
  return Object.hasOwn(COURT_SITES, hostname) ? COURT_SITES[hostname] : undefined
}

export function currentCourtSite(): CourtSite | undefined {
  if (typeof window === 'undefined') return undefined
  return courtSiteFor(window.location.hostname)
}

export function courtName(): string | undefined {
  return currentCourtSite()?.name || import.meta.env.VITE_COURT_NAME || undefined
}
