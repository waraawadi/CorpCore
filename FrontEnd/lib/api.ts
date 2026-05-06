const FALLBACK_API_BASE_URL = "http://localhost:8000/api"

/** Extrait un message lisible à partir du corps JSON d’erreur DRF (champs, detail, etc.). */
export function formatApiErrorBody(body: unknown): string {
  if (!body || typeof body !== "object") {
    return ""
  }
  const o = body as Record<string, unknown>
  if (typeof o.detail === "string" && o.detail.trim()) {
    return o.detail.trim()
  }
  if (Array.isArray(o.non_field_errors) && o.non_field_errors.length) {
    return String(o.non_field_errors[0])
  }
  const parts: string[] = []
  for (const [key, value] of Object.entries(o)) {
    if (key === "detail" || key === "non_field_errors") continue
    if (Array.isArray(value)) {
      const joined = value.map(String).filter(Boolean).join(" ")
      if (joined) parts.push(`${key}: ${joined}`)
    } else if (value != null && String(value).trim()) {
      parts.push(`${key}: ${String(value)}`)
    }
  }
  return parts.join(" — ")
}

export const getApiBaseUrl = (): string => {
  const raw = (process.env.NEXT_PUBLIC_API_BASE_URL || FALLBACK_API_BASE_URL).trim()
  const normalize = (value: string): string => {
    const withoutTrailingSlash = value.replace(/\/+$/, "")
    if (withoutTrailingSlash.endsWith("/api")) {
      return withoutTrailingSlash
    }
    return `${withoutTrailingSlash}/api`
  }

  const normalized = normalize(raw)
  if (typeof window === "undefined") {
    return normalized
  }

  try {
    const currentHost = window.location.hostname
    const isCorpCoreLocalHost =
      currentHost === "corpcore.local" || currentHost.endsWith(".corpcore.local")
    if (isCorpCoreLocalHost) {
      // Multi-tenant local setup: tenant is resolved by Host header in backend.
      // Force API calls on the current domain (ex: mgs.corpcore.local/api).
      return normalize(`${window.location.origin}/api`)
    }

    const parsed = new URL(normalized)
    const isTenantLocalhostHost = currentHost.includes(".localhost")
    const isConfiguredLocalhost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1"
    if (isTenantLocalhostHost && isConfiguredLocalhost) {
      parsed.hostname = currentHost
      return normalize(parsed.toString())
    }
  } catch {
    // keep normalized fallback
  }
  return normalized
}

