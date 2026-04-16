export type EdgeCommandError = {
  code: string
  message: string
}

export type EdgeCommandSuccess<T> = {
  ok: true
  data: T
}

export type EdgeCommandFailure = {
  ok: false
  error: EdgeCommandError
}

export type EdgeCommandResult<T> = EdgeCommandSuccess<T> | EdgeCommandFailure

export function edgeCommandSuccess<T>(data: T): EdgeCommandSuccess<T> {
  return { ok: true, data }
}

export function edgeCommandFailure(code: string, message: string): EdgeCommandFailure {
  return {
    ok: false,
    error: {
      code,
      message,
    },
  }
}

function isEdgeCommandError(value: unknown): value is EdgeCommandError {
  return Boolean(
    value &&
      typeof value === "object" &&
      "code" in value &&
      "message" in value &&
      typeof (value as { code?: unknown }).code === "string" &&
      typeof (value as { message?: unknown }).message === "string",
  )
}

export function isEdgeCommandResult<T>(value: unknown): value is EdgeCommandResult<T> {
  if (!value || typeof value !== "object" || !("ok" in value)) {
    return false
  }

  const candidate = value as { ok: unknown; data?: unknown; error?: unknown }
  if (candidate.ok === true) {
    return "data" in candidate
  }

  if (candidate.ok === false) {
    return isEdgeCommandError(candidate.error)
  }

  return false
}
