from datetime import datetime, timedelta, timezone
from io import BytesIO
from uuid import UUID, uuid4
from unittest.mock import AsyncMock, Mock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from jose import jwt
from PIL import Image, PngImagePlugin

from app.api.v1 import assets, render
from app.core.config import settings
from app.core import watermark_policy
from app.core.watermark_assets import resolve_custom_watermark
from app.schemas.job import JobStatus, RenderJob


@pytest.fixture
def watermark_api(monkeypatch, tmp_path):
    upload_dir = tmp_path / "uploads"
    upload_dir.mkdir()
    monkeypatch.setattr(settings, "UPLOAD_DIR", upload_dir)
    monkeypatch.setattr(settings, "STORAGE_DIR", tmp_path)
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "JWT_SECRET", "test-only-watermark-key")
    submit = AsyncMock(return_value=RenderJob(
        id="job", userId="owner", createdAt="now", updatedAt="now",
    ))
    monkeypatch.setattr(render.job_queue, "submit_render", submit)
    app = FastAPI()
    app.include_router(assets.router)
    app.include_router(render.router)
    return TestClient(app), submit


def auth(user_id):
    token = jwt.encode({"sub": user_id, "aud": "authenticated"}, settings.JWT_SECRET, algorithm="HS256")
    return {"Authorization": f"Bearer {token}"}


def logo_png(size=(3, 2)):
    output = BytesIO()
    metadata = PngImagePlugin.PngInfo()
    metadata.add_text("sample", "remove this metadata")
    Image.new("RGBA", size, (10, 20, 30, 90)).save(output, format="PNG", pnginfo=metadata)
    return output.getvalue()


def test_upload_normalizes_alpha_and_checks_owner_at_export(watermark_api):
    client, submit = watermark_api
    response = client.post("/assets/watermarks", files={"file": ("logo.png", logo_png(), "image/png")},
                           headers=auth("owner"))
    assert response.status_code == 201
    asset = response.json()
    assert (asset["width"], asset["height"]) == (3, 2)

    with Image.open(resolve_custom_watermark(UUID(asset["assetId"]), "owner")) as image:
        assert image.mode == "RGBA"
        assert image.getpixel((0, 0)) == (10, 20, 30, 90)
        assert not image.info

    request = {
        "tracks": [],
        "clips": [{"id": "clip", "trackId": "track", "name": "Clip", "type": "video",
                   "start": 0, "duration": 1}],
        "watermark": {"enabled": True, "source": "custom", "assetId": asset["assetId"],
                      "x": 1, "y": 1, "width": 0.15, "opacity": 1},
    }
    assert client.post("/render", json=request, headers=auth("other")).status_code == 404
    submit.assert_not_awaited()
    assert client.post("/render", json=request, headers=auth("owner")).status_code == 200
    submit.assert_awaited_once()
    resolved = submit.await_args.args[2]
    assert resolved.path == resolve_custom_watermark(UUID(asset["assetId"]), "owner")
    assert (resolved.x, resolved.y, resolved.width, resolved.opacity) == (1, 1, 0.15, 1)
    request["watermark"]["assetId"] = str(uuid4())
    assert client.post("/render", json=request, headers=auth("owner")).status_code == 404


def test_rejects_invalid_and_oversized_images(watermark_api, monkeypatch):
    client, _ = watermark_api
    monkeypatch.setattr(settings, "MAX_WATERMARK_DIMENSION", 3)
    for payload in (b"not a PNG", logo_png((4, 2))):
        response = client.post("/assets/watermarks", files={"file": ("logo.png", payload, "image/png")},
                               headers=auth("owner"))
        assert response.status_code == 422

    monkeypatch.setattr(settings, "MAX_WATERMARK_UPLOAD_BYTES", 10)
    response = client.post("/assets/watermarks", files={"file": ("logo.png", logo_png(), "image/png")},
                           headers=auth("owner"))
    assert response.status_code == 413
    assert not list(settings.UPLOAD_DIR.iterdir())


def test_serves_the_packaged_official_logo(watermark_api):
    client, _ = watermark_api
    response = client.get("/assets/watermarks/official")
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    assert response.content == settings.OFFICIAL_WATERMARK_PATH.read_bytes()


@pytest.mark.parametrize("status, expected", [
    (JobStatus.PROCESSING, 404),
    (JobStatus.FAILED, 404),
    (JobStatus.COMPLETED, 200),
])
def test_only_completed_job_is_downloadable(watermark_api, tmp_path, monkeypatch, status, expected):
    client, _ = watermark_api
    monkeypatch.setattr(settings, "EXPORT_DIR", tmp_path)
    output = tmp_path / "export.mp4"
    output.write_bytes(b"existing render output")
    job = RenderJob(id="job", userId="owner", status=status, outputFile=str(output),
                    createdAt="now", updatedAt="now")
    monkeypatch.setattr(render.ExportRepository, "get_export", AsyncMock(return_value=job))
    assert client.get("/render/jobs/job/download").status_code == expected


def test_subscription_policy_is_enforced_on_direct_api_requests(watermark_api, monkeypatch):
    client, submit = watermark_api
    free, expired, premium = (str(uuid4()) for _ in range(3))
    now = datetime.now(timezone.utc)
    expiry = {expired: now - timedelta(days=1), premium: now + timedelta(days=1)}
    query = Mock()
    for method in ("select", "eq", "gt", "limit"):
        getattr(query, method).return_value = query

    def lookup():
        column, user_id = query.eq.call_args.args
        cutoff_column, cutoff = query.gt.call_args.args
        assert (column, cutoff_column) == ("user_id", "premium_until")
        return Mock(data=[{"user_id": user_id}] if expiry.get(user_id, now) > datetime.fromisoformat(cutoff) else [])

    query.execute.side_effect = lookup
    supabase = Mock()
    supabase.table.return_value = query
    monkeypatch.setattr(watermark_policy, "get_supabase", lambda: supabase)
    monkeypatch.setattr(settings, "WATERMARK_SUBSCRIPTIONS_ENABLED", True)
    request = {
        "tracks": [],
        "clips": [{"id": "clip", "trackId": "track", "name": "Clip", "type": "video",
                   "start": 0, "duration": 1}],
    }
    custom = {"enabled": True, "source": "custom", "assetId": str(uuid4()),
              "x": 0, "y": 0, "width": 0.5, "opacity": 0}

    for user_id in (free, expired):
        assert client.get("/render/capabilities", headers=auth(user_id)).json() == {"canCustomizeWatermark": False}
        assert client.post("/assets/watermarks", files={"file": ("logo.png", logo_png())},
                           headers=auth(user_id)).status_code == 403
        for settings_payload in ({}, {"watermark": custom}, {"watermark": {**custom, "enabled": False}}):
            assert client.post("/render", json={**request, **settings_payload}, headers=auth(user_id)).status_code == 200
            resolved = submit.await_args.args[2]
            assert resolved.path == settings.OFFICIAL_WATERMARK_PATH
            assert (resolved.x, resolved.y, resolved.width, resolved.opacity) == (1, 1, 0.15, 0.85)

    assert client.get("/render/capabilities", headers=auth(premium)).json() == {"canCustomizeWatermark": True}
    upload = client.post("/assets/watermarks", files={"file": ("logo.png", logo_png())}, headers=auth(premium))
    assert upload.status_code == 201
    custom["assetId"] = upload.json()["assetId"]
    assert client.post("/render", json={**request, "watermark": custom}, headers=auth(premium)).status_code == 200
    assert submit.await_args.args[2].path == resolve_custom_watermark(UUID(custom["assetId"]), premium)
    assert client.post("/render", json={**request, "watermark": {**custom, "enabled": False}},
                       headers=auth(premium)).status_code == 200
    assert submit.await_args.args[2] is None
    query.execute.side_effect = RuntimeError("database unavailable")
    submit.reset_mock()
    assert client.post("/render", json=request, headers=auth(premium)).status_code == 503
    submit.assert_not_awaited()
