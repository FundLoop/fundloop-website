export function isValidMonthString(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
}

export function assertMonthString(value: string) {
  if (!isValidMonthString(value)) {
    throw new Error(`Invalid month string: ${value}`)
  }

  return value
}

export function getMonthBounds(value: string) {
  const month = assertMonthString(value)
  const [year, monthIndex] = month.split("-").map((part) => Number.parseInt(part, 10))

  const start = new Date(Date.UTC(year, monthIndex - 1, 1, 0, 0, 0, 0))
  const end = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0))

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  }
}
