import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams as useReactRouterSearchParams,
} from 'react-router-dom'

export { useParams }

export function useRouter() {
  const navigate = useNavigate()

  return {
    push: (href: string) => navigate(href),
    replace: (href: string) => navigate(href, { replace: true }),
    back: () => navigate(-1),
    forward: () => navigate(1),
  }
}

export function usePathname() {
  return useLocation().pathname
}

export function useSearchParams() {
  const [searchParams] = useReactRouterSearchParams()
  return searchParams
}
