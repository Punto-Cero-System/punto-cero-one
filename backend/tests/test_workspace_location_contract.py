"""Contract tests for explicit Workspace location, independent of lifecycle."""
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
VALID_LOCATIONS = {"internal", "external"}


@pytest.fixture(scope="module")
def workspaces() -> dict[str, dict]:
    return {space["space_key"]: space for space in registry.WORKSPACE_REGISTRY}


@pytest.fixture(scope="module")
def snapshot() -> list[dict[str, str]]:
    return json.loads(SNAPSHOT.read_text(encoding="utf-8"))


def test_every_registry_workspace_declares_a_valid_location(workspaces):
    assert all(
        isinstance(space.get("location"), str)
        and space["location"] in VALID_LOCATIONS
        for space in workspaces.values()
    )


def test_location_is_independent_of_lifecycle_and_availability(workspaces):
    legal = workspaces["legal"]
    community = workspaces["comunidad"]

    assert legal["status"] == "live"
    assert legal["location"] == "internal"
    assert community["status"] == "live"
    assert community["location"] == "external"
    assert registry.derive_availability(community["status"]) == "open"


def test_entry_url_does_not_determine_location(workspaces):
    assert workspaces["legal"]["entry_url"]
    assert workspaces["legal"]["location"] == "internal"
    assert workspaces["empresa"]["entry_url"] is None
    assert workspaces["empresa"]["route"] == "/workspace/empresa"
    assert workspaces["empresa"]["location"] == "internal"


def test_absent_location_fails_closed_in_projection_generator():
    spaces = copy.deepcopy(registry.WORKSPACE_REGISTRY)
    del spaces[0]["location"]

    with pytest.raises(ValueError, match="missing or unknown location"):
        projection_generator.build_snapshot(spaces)


@pytest.mark.parametrize(
    ("workspace_key", "mutated_location"),
    [("comunidad", "internal"), ("empresa", "external")],
)
def test_contracted_location_mutations_are_detected(
    snapshot,
    workspace_key,
    mutated_location,
    monkeypatch,
):
    spaces = copy.deepcopy(registry.WORKSPACE_REGISTRY)
    workspace = next(
        space for space in spaces if space["space_key"] == workspace_key
    )
    workspace["location"] = mutated_location
    monkeypatch.setattr(registry, "WORKSPACE_REGISTRY", spaces)

    with pytest.raises(ValueError, match="differs from WORKSPACE_REGISTRY"):
        projection_generator.validate_snapshot(snapshot)
