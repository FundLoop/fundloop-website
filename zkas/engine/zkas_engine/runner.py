from __future__ import annotations

import csv
import hashlib
import json
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from typing import Any


def _decimal(value: Any) -> Decimal:
    if value in (None, ""):
        return Decimal("1")
    return Decimal(str(value))


def _load_dataset(dataset: dict[str, Any]) -> list[dict[str, Any]]:
    path = Path(dataset["file_path"])
    if dataset["format"] == "csv":
        with path.open("r", encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle)
            return list(reader)

    with path.open("r", encoding="utf-8") as handle:
        parsed = json.load(handle)

    if isinstance(parsed, list):
        return parsed
    if isinstance(parsed, dict) and isinstance(parsed.get("rows"), list):
        return parsed["rows"]
    raise ValueError("Unsupported JSON dataset shape")


def _load_identity_map(path_str: str) -> dict[tuple[int, str], str]:
    path = Path(path_str)
    with path.open("r", encoding="utf-8") as handle:
        parsed = json.load(handle)

    rows = parsed if isinstance(parsed, list) else parsed.get("mappings", [])
    lookup: dict[tuple[int, str], str] = {}

    for row in rows:
        project_id = int(row["project_id"])
        app_user_id = str(row["app_user_id"]).strip()
        zkas_user_id = str(row["zkas_user_id"]).strip()
        lookup[(project_id, app_user_id)] = zkas_user_id

    return lookup


@dataclass
class AggregatedUser:
    total_score: Decimal
    project_ids: set[int]
    row_count: int


def run_manifest(manifest: dict[str, Any]) -> dict[str, Any]:
    lookup = _load_identity_map(manifest["identity_artifact"]["file_path"])
    aggregates: dict[str, AggregatedUser] = {}
    usd_pool = Decimal(str(manifest["usd_pool"]))

    for dataset in manifest["datasets"]:
        rows = _load_dataset(dataset)
        project_id = int(dataset["project_id"])

        for row in rows:
            app_user_id = str(row["app_user_id"]).strip()
            identity_key = (project_id, app_user_id)
            if identity_key not in lookup:
                raise ValueError(f"Missing identity mapping for project {project_id} user {app_user_id}")

            zkas_user_id = lookup[identity_key]
            row_score = _decimal(row.get("activity_score")) * _decimal(row.get("activity_count")) * _decimal(
                row.get("confidence_weight")
            )
            existing = aggregates.get(zkas_user_id)
            if existing is None:
                existing = AggregatedUser(total_score=Decimal("0"), project_ids=set(), row_count=0)
                aggregates[zkas_user_id] = existing

            existing.total_score += row_score
            existing.project_ids.add(project_id)
            existing.row_count += 1

    total_score = sum((entry.total_score for entry in aggregates.values()), Decimal("0"))
    rows: list[dict[str, Any]] = []
    total_allocated = Decimal("0")

    for zkas_user_id in sorted(aggregates.keys()):
        entry = aggregates[zkas_user_id]
        eligible = entry.total_score > 0
        allocation = Decimal("0")
        if eligible and total_score > 0:
            allocation = (usd_pool * entry.total_score / total_score).quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)

        total_allocated += allocation
        row_hash = hashlib.sha256(f"{zkas_user_id}:{entry.total_score}:{allocation}".encode("utf-8")).hexdigest()
        rows.append(
            {
                "zkas_user_id": zkas_user_id,
                "eligibility": eligible,
                "aggregate_score": float(entry.total_score),
                "allocation_usd": float(allocation),
                "app_count": entry.row_count,
                "project_count": len(entry.project_ids),
                "output_row_hash": row_hash,
            }
        )

    return {
        "version": "run-result.v1",
        "run_id": int(manifest["run_id"]),
        "month": manifest["month"],
        "usd_pool": float(usd_pool),
        "total_score": float(total_score),
        "total_allocated_usd": float(total_allocated),
        "user_count": len(rows),
        "rows": rows,
        "execution": {
            "mode": "local",
            "started_at": manifest.get("started_at"),
            "completed_at": manifest.get("completed_at"),
            "attestation": None,
        },
    }
