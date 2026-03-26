import "server-only"

import { execFile } from "node:child_process"
import { tmpdir } from "node:os"
import path from "node:path"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { promisify } from "node:util"
import type { LocalExecutionManifest, ZkasRunResultArtifact } from "@/types/zkas"

const execFileAsync = promisify(execFile)

export async function runLocalZkasExecution(input: {
  manifest: LocalExecutionManifest
  datasetFiles: Array<{ objectPath: string; content: string }>
  identityArtifactContent: string
}) {
  const workdir = await mkdtemp(path.join(tmpdir(), "fundloop-zkas-"))
  const engineDir = path.join(process.cwd(), "zkas", "engine")
  const manifestPath = path.join(workdir, "local-run-manifest.json")
  const outputPath = path.join(workdir, "run-result.json")

  try {
    for (const dataset of input.manifest.datasets) {
      const matchingArtifact = input.datasetFiles.find((file) => file.objectPath === dataset.file_path)
      if (!matchingArtifact) {
        throw new Error(`Missing dataset artifact for ${dataset.file_path}`)
      }

      const localPath = path.join(workdir, `dataset-${dataset.dataset_id}.${dataset.format}`)
      await writeFile(localPath, matchingArtifact.content, "utf8")
      dataset.file_path = localPath
    }

    const identityPath = path.join(workdir, "identity-artifact.json")
    await writeFile(identityPath, input.identityArtifactContent, "utf8")
    input.manifest.identity_artifact.file_path = identityPath

    await writeFile(manifestPath, JSON.stringify(input.manifest, null, 2), "utf8")

    const { stdout, stderr } = await execFileAsync(process.env.PYTHON_BIN ?? "python3", ["-m", "zkas_engine.cli", "run", "--manifest", manifestPath, "--output", outputPath], {
      cwd: engineDir,
    })

    const resultText = await readFile(outputPath, "utf8")
    const result = JSON.parse(resultText) as ZkasRunResultArtifact

    return {
      result,
      logs: [stdout, stderr].filter(Boolean).join("\n").trim() || "Local runner completed without extra logs.",
    }
  } finally {
    await rm(workdir, { force: true, recursive: true })
  }
}
