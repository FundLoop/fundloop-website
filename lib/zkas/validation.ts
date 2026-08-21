import { ZKAS_OPTIONAL_COLUMNS, ZKAS_REQUIRED_COLUMNS } from "@/lib/zkas/constants"
import { assertMonthString, isValidMonthString } from "@/lib/zkas/month"
import type { ParsedZkasDataset, ZkasDatasetFormat, ZkasDatasetRow, ZkasValidationIssue } from "@/types/zkas"

type RawRow = Record<string, unknown>

function addIssue(
  issues: ZkasValidationIssue[],
  issue: ZkasValidationIssue,
) {
  issues.push(issue)
}

function splitCsvLine(line: string) {
  const result: string[] = []
  let current = ""
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === "," && !inQuotes) {
      result.push(current)
      current = ""
      continue
    }

    current += char
  }

  result.push(current)
  return result.map((value) => value.trim())
}

function parseCsv(content: string) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length === 0) {
    throw new Error("The uploaded file is empty.")
  }

  const headers = splitCsvLine(lines[0])
  const rows = lines.slice(1).map((line) => {
    const values = splitCsvLine(line)
    const row: RawRow = {}
    headers.forEach((header, index) => {
      row[header] = values[index] ?? ""
    })
    return row
  })

  return {
    detectedColumns: headers,
    rows,
  }
}

function parseJson(content: string) {
  const parsed = JSON.parse(content) as unknown
  const rows =
    Array.isArray(parsed) ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as { rows?: unknown[] }).rows)
      ? (parsed as { rows: unknown[] }).rows
      : null

  if (!rows) {
    throw new Error("JSON uploads must be an array of dataset rows or an object with a rows array.")
  }

  if (rows.length === 0) {
    throw new Error("The uploaded file is empty.")
  }

  const detectedColumns = Array.from(
    new Set(
      rows.flatMap((row) =>
        row && typeof row === "object" ? Object.keys(row as Record<string, unknown>) : [],
      ),
    ),
  )

  return {
    detectedColumns,
    rows: rows as RawRow[],
  }
}

function normalizeOptionalNumber(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null
  }

  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value))
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

export function parseIdentityArtifact(content: string) {
  const parsed = JSON.parse(content) as unknown
  const mappings =
    Array.isArray(parsed) ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as { mappings?: unknown[] }).mappings)
      ? (parsed as { mappings: unknown[] }).mappings
      : null

  if (!mappings) {
    throw new Error("Identity artifact must be an array or an object with a mappings array.")
  }

  return mappings.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`Identity mapping row ${index + 1} is invalid.`)
    }

    const row = entry as Record<string, unknown>
    const projectId = Number.parseInt(String(row.project_id ?? ""), 10)
    const appUserId = String(row.app_user_id ?? "").trim()
    const zkasUserId = String(row.zkas_user_id ?? "").trim()
    const fundloopUserId = String(row.fundloop_user_id ?? "").trim() || null

    if (!Number.isInteger(projectId) || !appUserId || !zkasUserId) {
      throw new Error(`Identity mapping row ${index + 1} is missing required fields.`)
    }

    return {
      project_id: projectId,
      app_user_id: appUserId,
      zkas_user_id: zkasUserId,
      fundloop_user_id: fundloopUserId,
    }
  })
}

export function validateDatasetContent(input: {
  content: string
  format: ZkasDatasetFormat
  expectedMonth: string
  expectedProjectId: number
}): ParsedZkasDataset {
  const expectedMonth = assertMonthString(input.expectedMonth)
  const parser = input.format === "csv" ? parseCsv : parseJson
  const { detectedColumns, rows } = parser(input.content)
  const issues: ZkasValidationIssue[] = []

  for (const column of ZKAS_REQUIRED_COLUMNS) {
    if (!detectedColumns.includes(column)) {
      addIssue(issues, {
        severity: "error",
        code: "missing_required_column",
        message: `Missing required column: ${column}`,
        field: column,
      })
    }
  }

  const usedOptionalColumns = ZKAS_OPTIONAL_COLUMNS.filter((column) =>
    rows.some((row) => row[column] !== undefined && row[column] !== null && row[column] !== ""),
  )

  const seenKeys = new Set<string>()
  const parsedRows: ZkasDatasetRow[] = []

  rows.forEach((row, index) => {
    const rowNumber = index + 2
    const month = String(row.month ?? "").trim()
    const projectId = Number.parseInt(String(row.project_id ?? ""), 10)
    const appUserId = String(row.app_user_id ?? "").trim()

    if (!month) {
      addIssue(issues, {
        severity: "error",
        code: "missing_month",
        message: "Each row must include a month value.",
        rowNumber,
        field: "month",
      })
    } else if (!isValidMonthString(month)) {
      addIssue(issues, {
        severity: "error",
        code: "invalid_month",
        message: "Month values must use YYYY-MM format.",
        rowNumber,
        field: "month",
      })
    } else if (month !== expectedMonth) {
      addIssue(issues, {
        severity: "error",
        code: "month_mismatch",
        message: `Row month ${month} does not match upload month ${expectedMonth}.`,
        rowNumber,
        field: "month",
      })
    }

    if (!Number.isInteger(projectId)) {
      addIssue(issues, {
        severity: "error",
        code: "invalid_project_id",
        message: "project_id must be an integer.",
        rowNumber,
        field: "project_id",
      })
    } else if (projectId !== input.expectedProjectId) {
      addIssue(issues, {
        severity: "error",
        code: "project_mismatch",
        message: `Row project_id ${projectId} does not match the selected project ${input.expectedProjectId}.`,
        rowNumber,
        field: "project_id",
      })
    }

    if (!appUserId) {
      addIssue(issues, {
        severity: "error",
        code: "missing_app_user_id",
        message: "app_user_id cannot be blank.",
        rowNumber,
        field: "app_user_id",
      })
    }

    const optionalValues = Object.fromEntries(
      ZKAS_OPTIONAL_COLUMNS.map((column) => [column, normalizeOptionalNumber(row[column])]),
    ) as Record<(typeof ZKAS_OPTIONAL_COLUMNS)[number], number | null>

    for (const column of usedOptionalColumns) {
      const value = optionalValues[column]
      if (value === null) {
        addIssue(issues, {
          severity: "error",
          code: "partial_optional_column",
          message: `${column} is used in this file, so every row must provide a value.`,
          rowNumber,
          field: column,
        })
      } else if (Number.isNaN(value)) {
        addIssue(issues, {
          severity: "error",
          code: "non_numeric_optional_value",
          message: `${column} must be numeric when provided.`,
          rowNumber,
          field: column,
        })
      }
    }

    const dedupeKey = `${month}:${projectId}:${appUserId}`
    if (seenKeys.has(dedupeKey)) {
      addIssue(issues, {
        severity: "error",
        code: "duplicate_row",
        message: "Duplicate month/project_id/app_user_id rows are not allowed.",
        rowNumber,
      })
    }
    seenKeys.add(dedupeKey)

    parsedRows.push({
      month: month || expectedMonth,
      project_id: Number.isInteger(projectId) ? projectId : input.expectedProjectId,
      app_user_id: appUserId,
      activity_score: optionalValues.activity_score,
      activity_count: optionalValues.activity_count,
      confidence_weight: optionalValues.confidence_weight,
    })
  })

  if (usedOptionalColumns.length === 0) {
    addIssue(issues, {
      severity: "warning",
      code: "optional_columns_omitted",
      message: "No optional scoring columns were provided. Every row will use the default multiplier of 1.",
      field: "file",
    })
  }

  if (parsedRows.length < 5) {
    addIssue(issues, {
      severity: "warning",
      code: "low_row_count",
      message: "The dataset contains fewer than 5 rows. Review it before approval.",
      field: "file",
      metadata: { rowCount: parsedRows.length },
    })
  }

  return {
    format: input.format,
    rows: parsedRows,
    issues,
    summary: {
      rowCount: parsedRows.length,
      detectedColumns,
      usedOptionalColumns,
      issueCounts: {
        errors: issues.filter((issue) => issue.severity === "error").length,
        warnings: issues.filter((issue) => issue.severity === "warning").length,
      },
    },
  }
}
