"""Generate the safe frontend projection snapshot from WORKSPACE_REGISTRY."""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any, Iterable, Mapping

BACKEND = Path(__file__).resolve().parents[1]
ROOT = BACKEND.parent
OUT = ROOT / "docs" / "architecture" / "workspace_projection.snapshot.json"

sys.path.insert(0, str(BACKEND))

from services import workspace_registry as registry  # noqa: E402

PROJECTION_FIELDS = ("key", "status", "label", "route", "location")
VALID_LIFECYCLE = frozenset(
    ("live", "preview", "declared", "deprecated")
)
VALID_LOCATIONS = frozenset(("internal", "external"))


def build_snapshot(
    spaces: Iterable[Mapping[str, Any]] | None = None,
) -> list[dict[str, str]]:
    """Validate registry entries and project only contract-approved fields."""
    source = registry.WORKSPACE_REGISTRY if spaces is None else spaces
    snapshot: list[dict[str, str]] = []
    seen_keys: set[str] = set()

    for index, space in enumerate(source):
        key = space.get("space_key")
        if not isinstance(key, str) or not key.strip():
            raise ValueError(f"workspace at index {index} is missing a valid space_key")
        if key in seen_keys:
            raise ValueError(f"duplicate workspace key: {key}")
        seen_keys.add(key)

        if "status" not in space or space["status"] is None or space["status"] == "":
            raise ValueError(f"workspace {key} is missing status")
        status = space["status"]
        if not isinstance(status, str) or status not in VALID_LIFECYCLE:
            raise ValueError(f"workspace {key} has unknown lifecycle status: {status!r}")
        location = space.get("location")
        if not isinstance(location, str) or location not in VALID_LOCATIONS:
            raise ValueError(f"workspace {key} has missing or unknown location: {location!r}")

        row: dict[str, str] = {"key": key, "status": status, "location": location}
        for field in ("label", "route"):
            value = space.get(field)
            if not isinstance(value, str) or not value.strip():
                raise ValueError(f"workspace {key} is missing a valid {field}")
            row[field] = value
        snapshot.append({field: row[field] for field in PROJECTION_FIELDS})

    return snapshot


def validate_snapshot(
    snapshot: Any,
    spaces: Iterable[Mapping[str, Any]] | None = None,
) -> None:
    """Reject invalid or manually altered snapshots against the live registry."""
    if not isinstance(snapshot, list):
        raise ValueError("workspace projection snapshot must be a list")

    for index, row in enumerate(snapshot):
        if not isinstance(row, dict) or set(row) != set(PROJECTION_FIELDS):
            raise ValueError(
                f"snapshot row {index} must contain exactly {PROJECTION_FIELDS}"
            )
        if not isinstance(row["status"], str) or row["status"] not in VALID_LIFECYCLE:
            raise ValueError(
                f"snapshot row {index} has unknown lifecycle status: "
                f"{row['status']!r}"
            )
        if not isinstance(row["location"], str) or row["location"] not in VALID_LOCATIONS:
            raise ValueError(
                f"snapshot row {index} has unknown location: {row['location']!r}"
            )

    expected = build_snapshot(spaces)
    if snapshot != expected:
        raise ValueError("workspace projection snapshot differs from WORKSPACE_REGISTRY")


def main() -> int:
    snapshot = build_snapshot()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(snapshot, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"generated {OUT} ({len(snapshot)} workspaces)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
