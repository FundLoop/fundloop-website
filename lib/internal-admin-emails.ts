export function parseInternalAdminEmailAllowlist(source = process.env.FUNDLOOP_INTERNAL_ADMIN_EMAILS) {
  return new Set(
    (source ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  )
}

export function isInternalAdminEmail(email: string | null, source = process.env.FUNDLOOP_INTERNAL_ADMIN_EMAILS) {
  if (!email) {
    return false
  }

  return parseInternalAdminEmailAllowlist(source).has(email.toLowerCase())
}
