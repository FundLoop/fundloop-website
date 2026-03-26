import { describe, expect, it } from 'vitest'
import { hashManifest } from '@/lib/zkas/manifest'
import { buildPublicationMaterialization } from '@/lib/zkas/publication'
import { parseIdentityArtifact, validateDatasetContent } from '@/lib/zkas/validation'

describe('validateDatasetContent', () => {
  it('accepts a valid CSV dataset', () => {
    const parsed = validateDatasetContent({
      content: 'month,project_id,app_user_id,activity_score\n2026-04,42,user-a,2\n2026-04,42,user-b,1',
      expectedMonth: '2026-04',
      expectedProjectId: 42,
      format: 'csv',
    })

    expect(parsed.summary.rowCount).toBe(2)
    expect(parsed.summary.issueCounts.errors).toBe(0)
    expect(parsed.rows[0].activity_score).toBe(2)
  })

  it('rejects missing required columns', () => {
    const parsed = validateDatasetContent({
      content: 'month,project_id\n2026-04,42',
      expectedMonth: '2026-04',
      expectedProjectId: 42,
      format: 'csv',
    })

    expect(parsed.issues.some((issue) => issue.code === 'missing_required_column')).toBe(true)
  })

  it('rejects partial optional column usage', () => {
    const parsed = validateDatasetContent({
      content:
        'month,project_id,app_user_id,activity_score\n2026-04,42,user-a,2\n2026-04,42,user-b,',
      expectedMonth: '2026-04',
      expectedProjectId: 42,
      format: 'csv',
    })

    expect(parsed.issues.some((issue) => issue.code === 'partial_optional_column')).toBe(true)
  })

  it('rejects duplicate project-month-user rows', () => {
    const parsed = validateDatasetContent({
      content:
        'month,project_id,app_user_id\n2026-04,42,user-a\n2026-04,42,user-a',
      expectedMonth: '2026-04',
      expectedProjectId: 42,
      format: 'csv',
    })

    expect(parsed.issues.some((issue) => issue.code === 'duplicate_row')).toBe(true)
  })

  it('rejects month and project mismatches', () => {
    const parsed = validateDatasetContent({
      content:
        'month,project_id,app_user_id\n2026-05,41,user-a',
      expectedMonth: '2026-04',
      expectedProjectId: 42,
      format: 'csv',
    })

    expect(parsed.issues.some((issue) => issue.code === 'month_mismatch')).toBe(true)
    expect(parsed.issues.some((issue) => issue.code === 'project_mismatch')).toBe(true)
  })

  it('accepts JSON row arrays', () => {
    const parsed = validateDatasetContent({
      content: JSON.stringify([
        { month: '2026-04', project_id: 42, app_user_id: 'user-a', activity_count: 3, confidence_weight: 0.5 },
      ]),
      expectedMonth: '2026-04',
      expectedProjectId: 42,
      format: 'json',
    })

    expect(parsed.summary.issueCounts.errors).toBe(0)
    expect(parsed.rows[0].confidence_weight).toBe(0.5)
  })
})

describe('parseIdentityArtifact', () => {
  it('parses mapping arrays', () => {
    const mappings = parseIdentityArtifact(
      JSON.stringify([{ project_id: 42, app_user_id: 'user-a', zkas_user_id: 'zkas-a', fundloop_user_id: 'user-1' }]),
    )

    expect(mappings).toHaveLength(1)
    expect(mappings[0].zkas_user_id).toBe('zkas-a')
    expect(mappings[0].fundloop_user_id).toBe('user-1')
  })
})

describe('hashManifest', () => {
  it('is deterministic for identical manifest payloads', () => {
    const manifest = {
      version: 'run-manifest.v1' as const,
      run_id: 1,
      month: '2026-04',
      usd_pool: 100,
      allocation_policy: 'proportional_pool' as const,
      engine_bundle: {
        git_ref: 'abc',
        image_ref: 'zkas/local',
        config_version: 'local-v1',
      },
      schema_version: 'zkas.v1',
      datasets: [],
      payments: [],
      identity_artifact: {
        artifact_id: 1,
        object_path: '2026-04/identity.json',
        artifact_hash: 'hash',
        schema_version: 'zkas.v1',
      },
    }

    expect(hashManifest(manifest)).toBe(hashManifest({ ...manifest }))
  })
})

describe('buildPublicationMaterialization', () => {
  it('computes attributed payout and cubid buckets per project', () => {
    const materialized = buildPublicationMaterialization({
      runId: 7,
      publishedAt: '2026-04-30T00:00:00.000Z',
      payments: [
        { project_id: 1, amount_usd: 60 },
        { project_id: 2, amount_usd: 40 },
      ],
      datasets: [
        {
          datasetId: 11,
          projectId: 1,
          rows: [
            { month: '2026-04', project_id: 1, app_user_id: 'a-1', activity_score: 3 },
            { month: '2026-04', project_id: 1, app_user_id: 'a-2', activity_score: 1 },
          ],
        },
        {
          datasetId: 12,
          projectId: 2,
          rows: [
            { month: '2026-04', project_id: 2, app_user_id: 'b-1', activity_score: 2 },
          ],
        },
      ],
      mappings: [
        { project_id: 1, app_user_id: 'a-1', zkas_user_id: 'zkas-1', fundloop_user_id: 'user-1' },
        { project_id: 1, app_user_id: 'a-2', zkas_user_id: 'zkas-2' },
        { project_id: 2, app_user_id: 'b-1', zkas_user_id: 'zkas-1', fundloop_user_id: 'user-1' },
      ],
      resultRows: [
        {
          zkas_user_id: 'zkas-1',
          eligibility: true,
          aggregate_score: 5,
          allocation_usd: 100,
          app_count: 2,
          project_count: 2,
          output_row_hash: 'row-1',
        },
        {
          zkas_user_id: 'zkas-2',
          eligibility: false,
          aggregate_score: 1,
          allocation_usd: 0,
          app_count: 1,
          project_count: 1,
          output_row_hash: 'row-2',
        },
      ],
      cubidScoresByUserId: new Map([
        ['user-1', 82],
      ]),
    })

    expect(materialized.publishedUserResults).toHaveLength(1)
    expect(materialized.projectSummaries).toHaveLength(2)
    expect(materialized.projectSummaries.find((summary) => summary.project_id === 1)?.attributed_payout_usd).toBe(60)
    expect(materialized.projectSummaries.find((summary) => summary.project_id === 2)?.attributed_payout_usd).toBe(40)
    expect(materialized.projectSummaries.find((summary) => summary.project_id === 1)?.active_user_count).toBe(2)
    expect(materialized.cubidBuckets.find((bucket) => bucket.project_id === 1 && bucket.bucket_key === '75_plus')?.user_count).toBe(1)
    expect(materialized.cubidBuckets.find((bucket) => bucket.project_id === 1 && bucket.bucket_key === 'unresolved')?.user_count).toBe(1)
  })
})
