"""Contract tests for the safe Workspace Registry frontend projection."""
from __future__ import annotations

import copy
import json
import sys
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[1]
ROOT = BACKEND.parent
sys.path.insert(0, str(BACKEND))

from scripts import generate_workspace_projection as projection_generator  # noqa: E402
from services import workspace_registry as registry  # noqa: E402

SNAPSHOT = ROOT / "docs" / "architecture" / "workspace_projection.snapshot.json"
PROHIBITED_FIELDS = {
    "launchMode",
    "launch_mode",
    "external",
    "availability",
    "permission",
    "emoji",
    "description",
    "presetId",
}
EXPECTED_FIELDS = {"key", "status", "label", "route", "location"}
VALID_LIFECYCLE = {"live", "preview", "declared", "deprecated"}
VALID_LOCATIONS = {"internal", "external"}


@pytest.fixture(scope="module")
def snapshot() -> list[dict[str, str]]:
    return json.loads(SNAPSHOT.read_text(encoding="utf-8"))


def test_every_registry_key_appears_in_projection(snapshot):
    registry_keys = {space["space_key"] for space in registry.WORKSPACE_REGISTRY}
    assert {space["key"] for space in snapshot} == registry_keys


def test_projection_rows_have_exactly_the_contract_fields(snapshot):
    assert all(set(space) == EXPECTED_FIELDS for space in snapshot)


def test_projection_contains_only_allowed_lifecycle_values(snapshot):
    assert {space["status"] for space in snapshot} <= VALID_LIFECYCLE


def test_projection_contains_only_explicit_allowed_locations(snapshot):
    assert {space["location"] for space in snapshot} <= VALID_LOCATIONS


def test_projection_has_no_prohibited_fields(snapshot):
    assert not any(PROHIBITED_FIELDS.intersection(space) for space in snapshot)


def test_checked_in_snapshot_matches_registry(snapshot):
    projection_generator.validate_snapshot(snapshot)


def test_missing_registry_status_fails(monkeypatch):
    spaces = copy.deepcopy(registry.WORKSPACE_REGISTRY)
    del spaces[0]["status"]
    monkeypatch.setattr(registry, "WORKSPACE_REGISTRY", spaces)

    with pytest.raises(ValueError, match="missing status"):
        projection_generator.build_snapshot()


def test_missing_registry_location_fails():
    spaces = copy.deepcopy(registry.WORKSPACE_REGISTRY)
    del spaces[0]["location"]

    with pytest.raises(ValueError, match="missing or unknown location"):
        projection_generator.build_snapshot(spaces)


def test_manually_altered_snapshot_fails_validation(snapshot):
    altered = copy.deepcopy(snapshot)
    altered[0]["label"] = "Manually edited"

    with pytest.raises(ValueError, match="differs from WORKSPACE_REGISTRY"):
        projection_generator.validate_snapshot(altered)


def test_duplicate_keys_and_unknown_lifecycle_fail():
    spaces = copy.deepcopy(registry.WORKSPACE_REGISTRY)
    spaces.append(copy.deepcopy(spaces[0]))
    with pytest.raises(ValueError, match="duplicate workspace key"):
        projection_generator.build_snapshot(spaces)

    spaces = copy.deepcopy(registry.WORKSPACE_REGISTRY)
    spaces[0]["status"] = "available"
    with pytest.raises(ValueError, match="unknown lifecycle status"):
        projection_generator.build_snapshot(spaces)
