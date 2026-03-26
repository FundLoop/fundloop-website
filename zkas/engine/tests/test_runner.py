from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from zkas_engine.runner import run_manifest


class RunnerTestCase(unittest.TestCase):
    def test_proportional_allocation(self) -> None:
        with tempfile.TemporaryDirectory() as tempdir:
            dataset_path = Path(tempdir) / "dataset.json"
            identity_path = Path(tempdir) / "identity.json"

            dataset_path.write_text(
                json.dumps(
                    [
                        {"month": "2026-04", "project_id": 1, "app_user_id": "a", "activity_score": 2},
                        {"month": "2026-04", "project_id": 1, "app_user_id": "b", "activity_score": 1},
                    ]
                ),
                encoding="utf-8",
            )
            identity_path.write_text(
                json.dumps(
                    [
                        {"project_id": 1, "app_user_id": "a", "zkas_user_id": "user-a"},
                        {"project_id": 1, "app_user_id": "b", "zkas_user_id": "user-b"},
                    ]
                ),
                encoding="utf-8",
            )

            result = run_manifest(
                {
                    "run_id": 1,
                    "month": "2026-04",
                    "usd_pool": 90,
                    "datasets": [
                        {
                            "dataset_id": 1,
                            "project_id": 1,
                            "format": "json",
                            "file_path": str(dataset_path),
                        }
                    ],
                    "identity_artifact": {
                        "artifact_id": 1,
                        "file_path": str(identity_path),
                    },
                }
            )

            self.assertEqual(result["user_count"], 2)
            rows = {row["zkas_user_id"]: row for row in result["rows"]}
            self.assertAlmostEqual(rows["user-a"]["allocation_usd"], 60.0, places=5)
            self.assertAlmostEqual(rows["user-b"]["allocation_usd"], 30.0, places=5)


if __name__ == "__main__":
    unittest.main()
