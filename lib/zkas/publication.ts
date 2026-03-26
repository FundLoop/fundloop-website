import { ZKAS_CUBID_SCORE_BUCKETS } from "@/lib/zkas/constants"
import type {
  ZkasDatasetRow,
  ZkasIdentityMapping,
  ZkasProjectAnalyticsSummary,
  ZkasProjectCubidBucket,
  ZkasPublishedUserResult,
  ZkasRunResultRow,
} from "@/types/zkas"

export type ZkasPublicationDatasetInput = {
  datasetId: number
  projectId: number
  rows: ZkasDatasetRow[]
}

export type ZkasPublicationPaymentInput = {
  project_id: number
  amount_usd: number
}

export type ZkasPublicationBuildInput = {
  runId: number
  publishedAt: string
  datasets: ZkasPublicationDatasetInput[]
  payments: ZkasPublicationPaymentInput[]
  mappings: ZkasIdentityMapping[]
  resultRows: ZkasRunResultRow[]
  cubidScoresByUserId: Map<string, number | null | undefined>
}

export type ZkasPublicationBuildOutput = {
  publishedUserResults: ZkasPublishedUserResult[]
  projectSummaries: ZkasProjectAnalyticsSummary[]
  cubidBuckets: ZkasProjectCubidBucket[]
  unresolvedPublishedUsers: string[]
}

function projectAppKey(projectId: number, appUserId: string) {
  return `${projectId}:${appUserId}`
}

function projectZkasKey(projectId: number, zkasUserId: string) {
  return JSON.stringify([projectId, zkasUserId])
}

function resolveNumericValue(value: number | null | undefined) {
  return Number.isFinite(value) ? Number(value) : 0
}

export function getDatasetRowScore(row: ZkasDatasetRow) {
  return (
    resolveNumericValue(row.activity_score ?? 1) *
    resolveNumericValue(row.activity_count ?? 1) *
    resolveNumericValue(row.confidence_weight ?? 1)
  )
}

export function getCubidScoreBucket(score: number | null | undefined) {
  if (score === null || score === undefined || !Number.isFinite(score)) {
    return ZKAS_CUBID_SCORE_BUCKETS[0]
  }

  return (
    ZKAS_CUBID_SCORE_BUCKETS.find((bucket) => {
      if (bucket.min === null) {
        return false
      }

      const meetsMin = score >= bucket.min
      const meetsMax = bucket.max === null ? true : score <= bucket.max
      return meetsMin && meetsMax
    }) ?? ZKAS_CUBID_SCORE_BUCKETS[0]
  )
}

function buildResolutionByZkasUserId(mappings: ZkasIdentityMapping[]) {
  const resolutionByZkasUserId = new Map<string, string | null>()

  for (const mapping of mappings) {
    const resolvedUserId = mapping.fundloop_user_id?.trim() || null
    if (!resolutionByZkasUserId.has(mapping.zkas_user_id)) {
      resolutionByZkasUserId.set(mapping.zkas_user_id, resolvedUserId)
      continue
    }

    const current = resolutionByZkasUserId.get(mapping.zkas_user_id) ?? null
    if (!current || !resolvedUserId || current === resolvedUserId) {
      resolutionByZkasUserId.set(mapping.zkas_user_id, current ?? resolvedUserId)
      continue
    }

    resolutionByZkasUserId.set(mapping.zkas_user_id, null)
  }

  return resolutionByZkasUserId
}

export function buildPublicationMaterialization(input: ZkasPublicationBuildInput): ZkasPublicationBuildOutput {
  const mappingByProjectApp = new Map(input.mappings.map((mapping) => [projectAppKey(mapping.project_id, mapping.app_user_id), mapping]))
  const resolutionByZkasUserId = buildResolutionByZkasUserId(input.mappings)
  const contributionByProjectId = new Map<number, number>()
  const scoreByProjectUser = new Map<string, number>()
  const activeUserCountByProjectId = new Map<number, number>()
  const datasetIdByProjectId = new Map<number, number>()
  const cubidBucketCounts = new Map<string, number>()

  for (const payment of input.payments) {
    contributionByProjectId.set(
      payment.project_id,
      (contributionByProjectId.get(payment.project_id) ?? 0) + Number(payment.amount_usd),
    )
  }

  for (const dataset of input.datasets) {
    datasetIdByProjectId.set(dataset.projectId, dataset.datasetId)
    activeUserCountByProjectId.set(dataset.projectId, dataset.rows.length)

    for (const row of dataset.rows) {
      const mapping = mappingByProjectApp.get(projectAppKey(dataset.projectId, row.app_user_id))
      const resolvedUserId = mapping ? resolutionByZkasUserId.get(mapping.zkas_user_id) ?? null : null
      const bucket = resolvedUserId
        ? getCubidScoreBucket(input.cubidScoresByUserId.get(resolvedUserId) ?? null)
        : ZKAS_CUBID_SCORE_BUCKETS[0]

      const bucketKey = `${dataset.projectId}:${bucket.key}`
      cubidBucketCounts.set(bucketKey, (cubidBucketCounts.get(bucketKey) ?? 0) + 1)

      if (!mapping) {
        continue
      }

      const key = projectZkasKey(dataset.projectId, mapping.zkas_user_id)
      scoreByProjectUser.set(key, (scoreByProjectUser.get(key) ?? 0) + getDatasetRowScore(row))
    }
  }

  const totalScoreByZkasUserId = new Map<string, number>()
  for (const [key, score] of scoreByProjectUser.entries()) {
    const [, zkasUserId] = JSON.parse(key) as [number, string]
    totalScoreByZkasUserId.set(zkasUserId, (totalScoreByZkasUserId.get(zkasUserId) ?? 0) + score)
  }

  const attributedPayoutByProjectId = new Map<number, number>()
  const publishedZkasUsersByProjectId = new Map<number, Set<string>>()
  const publishedUserResults: ZkasPublishedUserResult[] = []
  const unresolvedPublishedUsers: string[] = []
  const publishedUserIds = new Set<string>()

  for (const row of input.resultRows) {
    if (row.allocation_usd <= 0) {
      continue
    }

    const totalScore = totalScoreByZkasUserId.get(row.zkas_user_id) ?? 0
    if (totalScore > 0) {
      for (const dataset of input.datasets) {
        const projectScore = scoreByProjectUser.get(projectZkasKey(dataset.projectId, row.zkas_user_id)) ?? 0
        if (projectScore <= 0) {
          continue
        }

        const attributedShare = Number(row.allocation_usd) * (projectScore / totalScore)
        attributedPayoutByProjectId.set(
          dataset.projectId,
          (attributedPayoutByProjectId.get(dataset.projectId) ?? 0) + attributedShare,
        )

        if (!publishedZkasUsersByProjectId.has(dataset.projectId)) {
          publishedZkasUsersByProjectId.set(dataset.projectId, new Set())
        }
        publishedZkasUsersByProjectId.get(dataset.projectId)?.add(row.zkas_user_id)
      }
    }

    const resolvedUserId = resolutionByZkasUserId.get(row.zkas_user_id) ?? null
    if (!resolvedUserId) {
      unresolvedPublishedUsers.push(row.zkas_user_id)
      continue
    }

    if (publishedUserIds.has(resolvedUserId)) {
      unresolvedPublishedUsers.push(row.zkas_user_id)
      continue
    }

    publishedUserIds.add(resolvedUserId)
    publishedUserResults.push({
      run_id: input.runId,
      user_id: resolvedUserId,
      zkas_user_id: row.zkas_user_id,
      allocation_usd: Number(row.allocation_usd),
      aggregate_score: Number(row.aggregate_score),
      published_at: input.publishedAt,
      notification_id: null,
    })
  }

  const projectSummaries: ZkasProjectAnalyticsSummary[] = input.datasets.map((dataset) => {
    const contributedAmount = contributionByProjectId.get(dataset.projectId) ?? 0
    const activeUserCount = activeUserCountByProjectId.get(dataset.projectId) ?? dataset.rows.length
    const publishedUserCount = publishedZkasUsersByProjectId.get(dataset.projectId)?.size ?? 0
    const attributedPayout = attributedPayoutByProjectId.get(dataset.projectId) ?? 0

    return {
      run_id: input.runId,
      project_id: dataset.projectId,
      dataset_id: dataset.datasetId,
      contributed_amount_usd: contributedAmount,
      active_user_count: activeUserCount,
      avg_contribution_per_active_user_usd: activeUserCount > 0 ? contributedAmount / activeUserCount : 0,
      published_user_count: publishedUserCount,
      attributed_payout_usd: attributedPayout,
      avg_attributed_payout_per_published_user_usd: publishedUserCount > 0 ? attributedPayout / publishedUserCount : 0,
    }
  })

  const cubidBuckets: ZkasProjectCubidBucket[] = []
  for (const dataset of input.datasets) {
    for (const bucket of ZKAS_CUBID_SCORE_BUCKETS) {
      const key = `${dataset.projectId}:${bucket.key}`
      cubidBuckets.push({
        run_id: input.runId,
        project_id: dataset.projectId,
        bucket_key: bucket.key,
        bucket_label: bucket.label,
        user_count: cubidBucketCounts.get(key) ?? 0,
      })
    }
  }

  return {
    publishedUserResults,
    projectSummaries,
    cubidBuckets,
    unresolvedPublishedUsers,
  }
}
