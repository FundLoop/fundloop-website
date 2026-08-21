from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from zkas_engine.runner import run_manifest


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the FundLoop zkAS local engine")
    subparsers = parser.add_subparsers(dest="command", required=True)

    run_parser = subparsers.add_parser("run")
    run_parser.add_argument("--manifest", required=True)
    run_parser.add_argument("--output", required=True)

    args = parser.parse_args()

    if args.command == "run":
        manifest_path = Path(args.manifest)
        output_path = Path(args.output)
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        manifest["started_at"] = datetime.now(timezone.utc).isoformat()
        result = run_manifest(manifest)
        result["execution"]["completed_at"] = datetime.now(timezone.utc).isoformat()
        output_path.write_text(json.dumps(result, indent=2), encoding="utf-8")
        return 0

    return 1


if __name__ == "__main__":
    raise SystemExit(main())
