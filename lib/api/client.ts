export type ApiError = {
  status: number
  message: string
  details?: unknown
}

export class ApiClientError extends Error {
  status: number
  details?: unknown

  constructor(error: ApiError) {
    super(error.message)
    this.name = 'ApiClientError'
    this.status = error.status
    this.details = error.details
  }
}

export function apiUrl(path: string) {
  if (/^https?:\/\//.test(path)) return path

  const configuredBaseUrl = import.meta.env.PROD ? import.meta.env.VITE_API_URL : ''
  const baseUrl = typeof configuredBaseUrl === 'string'
    ? configuredBaseUrl.trim().replace(/^["']|["']$/g, '')
    : ''

  if (!baseUrl) {
    return `/${path.replace(/^\/+/, '')}`
  }

  return `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
}

function getMockDeviceMacAddress() {
  if (typeof window === 'undefined') return null
  
  try {
    let mac = localStorage.getItem('deviceMacAddress');
    if (!mac) {
      // Browser clients cannot read a real MAC address; production uses this stable mock device id.
      const hex = () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
      mac = `02:${hex()}:${hex()}:${hex()}:${hex()}:${hex()}`.toUpperCase();
      localStorage.setItem('deviceMacAddress', mac);
    }
    return mac;
  } catch {
    return null; // Handle incognito mode / disabled storage
  }
}

export function apiFetch(input: string, init?: RequestInit) {
  const macAddress = getMockDeviceMacAddress();
  const defaultHeaders: HeadersInit = macAddress ? { 'x-mac-address': macAddress } : {};

  return fetch(apiUrl(input), {
    ...init,
    credentials: 'include',
    headers: {
      ...defaultHeaders,
      ...(init?.headers || {}),
    },
  })
}

export async function apiJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(input, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers || {}),
    },
  })
  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new ApiClientError({
      status: response.status,
      message: data?.message || data?.error || `API request failed with status ${response.status}`,
      details: data,
    })
  }

  return data as T
}

export async function apiDownload(input: string, init?: RequestInit) {
  const response = await apiFetch(input, init)
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new ApiClientError({
      status: response.status,
      message: data?.message || data?.error || `Download failed with status ${response.status}`,
      details: data,
    })
  }
  return response
}

export async function swrFetcher<T>(url: string): Promise<T> {
  const response = await apiFetch(url)
  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`)
  }
  return await response.json() as T
}
