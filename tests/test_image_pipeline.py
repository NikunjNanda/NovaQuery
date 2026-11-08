import io
import os
import zipfile
import pytest
from pathlib import Path
from PIL import Image
from fastapi.testclient import TestClient

from app.main import app, UPLOAD_ROOT
from app.image_pipeline import (
    process_zip_dataset,
    ZipSlipException,
    ZipLimitException,
)

client = TestClient(app)


def create_test_image_bytes(format="PNG", size=(64, 64), color="red") -> bytes:
    """Creates in-memory image bytes using Pillow."""
    img = Image.new("RGB", size, color=color)
    buf = io.BytesIO()
    img.save(buf, format=format)
    return buf.getvalue()


def test_valid_zip_extraction(tmp_path):
    # 1. Create a ZIP with 2 valid images and a metadata CSV
    img1_bytes = create_test_image_bytes(format="PNG", size=(100, 100), color="blue")
    img2_bytes = create_test_image_bytes(format="JPEG", size=(300, 200), color="green")
    csv_bytes = b"id,image_name,label\n1,blue.png,blue_square\n2,green.jpg,green_rect\n"

    zip_path = tmp_path / "valid_dataset.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        zf.writestr("blue.png", img1_bytes)
        zf.writestr("images/green.jpg", img2_bytes)
        zf.writestr("metadata.csv", csv_bytes)

    workspace_id = "test_ws_001"
    res = process_zip_dataset(zip_path, workspace_id, tmp_path)

    assert res["success"] is True
    assert res["image_count"] == 2
    assert len(res["images"]) == 2
    assert len(res["metadata_entries"]) == 1
    assert res["metadata_entries"][0]["filename"] == "metadata.csv"

    # Verify files created on disk
    ws_dir = tmp_path / workspace_id
    img1_path = ws_dir / "images" / "blue.png"
    img2_path = ws_dir / "images" / "green.jpg"
    thumb1_path = ws_dir / "thumbs" / "blue.png"
    thumb2_path = ws_dir / "thumbs" / "green.jpg"

    assert img1_path.is_file()
    assert img2_path.is_file()
    assert thumb1_path.is_file()
    assert thumb2_path.is_file()

    # Verify thumbnail size <= 256px
    thumb = Image.open(thumb2_path)
    assert max(thumb.width, thumb.height) <= 256


def test_traversal_entry_rejected_zip_slip(tmp_path):
    img_bytes = create_test_image_bytes()
    zip_path = tmp_path / "evil.zip"

    with zipfile.ZipFile(zip_path, "w") as zf:
        zf.writestr("../../evil.png", img_bytes)

    workspace_id = "test_ws_slip"
    with pytest.raises(ZipSlipException):
        process_zip_dataset(zip_path, workspace_id, tmp_path)


def test_fake_image_skipped_with_warning(tmp_path):
    valid_bytes = create_test_image_bytes(format="PNG")
    fake_bytes = b"this is not an image at all, just plain text"

    zip_path = tmp_path / "mixed.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        zf.writestr("good.png", valid_bytes)
        zf.writestr("fake.jpg", fake_bytes)

    workspace_id = "test_ws_fake"
    res = process_zip_dataset(zip_path, workspace_id, tmp_path)

    assert res["image_count"] == 1
    assert res["images"][0]["stored_name"] == "good.png"
    assert len(res["warnings"]) >= 1
    assert any("fake.jpg" in w for w in res["warnings"])


def test_duplicate_image_names_handled(tmp_path):
    img_bytes = create_test_image_bytes()

    zip_path = tmp_path / "duplicates.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        zf.writestr("folder_a/item.png", img_bytes)
        zf.writestr("folder_b/item.png", img_bytes)

    workspace_id = "test_ws_dup"
    res = process_zip_dataset(zip_path, workspace_id, tmp_path)

    assert res["image_count"] == 2
    names = [img["stored_name"] for img in res["images"]]
    assert "item.png" in names
    assert "item_2.png" in names


def test_ignored_entries(tmp_path):
    img_bytes = create_test_image_bytes()

    zip_path = tmp_path / "with_ignored.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        zf.writestr("valid.png", img_bytes)
        zf.writestr("__MACOSX/._valid.png", b"resource_fork")
        zf.writestr(".DS_Store", b"hidden")
        zf.writestr("nested.zip", b"PK...")

    workspace_id = "test_ws_ignored"
    res = process_zip_dataset(zip_path, workspace_id, tmp_path)

    assert res["image_count"] == 1
    assert res["images"][0]["stored_name"] == "valid.png"


def test_upload_db_with_zip_endpoint():
    img_bytes = create_test_image_bytes(format="PNG")
    csv_bytes = b"id,name,score\n1,Alpha,95\n2,Beta,88\n"

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w") as zf:
        zf.writestr("test.png", img_bytes)
        zf.writestr("scores.csv", csv_bytes)
    zip_buffer.seek(0)

    resp = client.post("/api/upload-db", files={"file": ("dataset.zip", zip_buffer, "application/zip")})
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "db_path" in data
    assert os.path.exists(data["db_path"])


def test_upload_zip_slip_rejected_via_endpoint():
    img_bytes = create_test_image_bytes()

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w") as zf:
        zf.writestr("../../evil.png", img_bytes)
    zip_buffer.seek(0)

    resp = client.post("/api/upload-db", files={"file": ("malicious.zip", zip_buffer, "application/zip")})
    assert resp.status_code == 400
    assert "Path traversal" in resp.json()["detail"]

