export const DEFAULT_AUTH_REDIRECT = "/worship-prep"

export function getSafeNextPath(value: string | null | undefined): string {
  if (!value) return DEFAULT_AUTH_REDIRECT
  if (!value.startsWith("/") || value.startsWith("//")) {
    return DEFAULT_AUTH_REDIRECT
  }
  return value
}

export function getPathWithSearch(pathname: string, search: string): string {
  return `${pathname}${search}`
}
