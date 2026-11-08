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


def test_detect_image_columns_unit():
    import pandas as pd
    from app.image_pipeline import detect_image_columns

    stored_files = ["cat_photo.jpg", "dog_photo.png", "bird.webp"]
    df = pd.DataFrame({
        "id": [1, 2, 3, 4],
        "exact_col": ["cat_photo.jpg", "dog_photo.png", "bird.webp", "other.gif"],  # 3/4 = 75% -> match
        "folder_col": ["images/cat_photo.jpg", "sub/folder/dog_photo.png", "bird.webp", "unrelated.png"],  # 3/4 = 75% -> match
        "stem_col": ["cat_photo", "dog_photo", "bird", "unrelated"],  # 3/4 = 75% -> match
        "non_image_col": ["apple", "banana", "cherry", "date"],  # 0% -> no match
        "low_ratio_col": ["cat_photo.jpg", "random1", "random2", "random3"],  # 1/4 = 25% < 60% -> no match
    })

    detected = detect_image_columns(df, stored_files, threshold=0.60)
    assert "exact_col" in detected
    assert "folder_col" in detected
    assert "stem_col" in detected
    assert "non_image_col" not in detected
    assert "low_ratio_col" not in detected


def test_zip_multiple_metadata_files_picks_largest():
    img_bytes = create_test_image_bytes()
    small_csv = b"id,val\n1,10\n"
    large_csv = b"id,title,img,notes\n1,First,img1.png,Lots of detailed metadata text here\n2,Second,img2.png,More text\n"

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w") as zf:
        zf.writestr("img1.png", img_bytes)
        zf.writestr("img2.png", img_bytes)
        zf.writestr("small.csv", small_csv)
        zf.writestr("catalog_large.csv", large_csv)
    zip_buffer.seek(0)

    resp = client.post("/api/upload-db", files={"file": ("multi_meta.zip", zip_buffer, "application/zip")})
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert any("Multiple metadata files" in w for w in data.get("warnings", []))
    assert any("catalog_large.csv" in w for w in data.get("warnings", []))


def test_zip_without_metadata_returns_400():
    img_bytes = create_test_image_bytes()

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w") as zf:
        zf.writestr("photo1.png", img_bytes)
        zf.writestr("photo2.png", img_bytes)
    zip_buffer.seek(0)

    resp = client.post("/api/upload-db", files={"file": ("no_meta.zip", zip_buffer, "application/zip")})
    assert resp.status_code == 400
    assert "Images-only datasets are not supported yet" in resp.json()["detail"]


def test_upload_db_detects_image_column_and_stores_state():
    img1 = create_test_image_bytes(color="red")
    img2 = create_test_image_bytes(color="blue")
    csv_bytes = b"id,product_name,image_file,price\n1,Widget A,red.png,19.99\n2,Widget B,blue.png,29.99\n"

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w") as zf:
        zf.writestr("red.png", img1)
        zf.writestr("blue.png", img2)
        zf.writestr("products.csv", csv_bytes)
    zip_buffer.seek(0)

    resp = client.post("/api/upload-db", files={"file": ("catalog.zip", zip_buffer, "application/zip")})
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["image_count"] == 2
    assert "image_file" in data["image_columns"].get("catalog", [])
    assert "red.png" in data["image_filenames"]
    assert "blue.png" in data["image_filenames"]


def test_upload_db_no_detected_column_returns_csv_columns_and_image_names():
    img1 = create_test_image_bytes()
    # CSV column values don't match image file names at all
    csv_bytes = b"id,product_code,unmatched_ref\n1,PROD_01,ref_abc\n2,PROD_02,ref_xyz\n"

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w") as zf:
        zf.writestr("picture_01.png", img1)
        zf.writestr("items.csv", csv_bytes)
    zip_buffer.seek(0)

    resp = client.post("/api/upload-db", files={"file": ("unmatched.zip", zip_buffer, "application/zip")})
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["image_columns"].get("unmatched", []) == []
    # Returns available columns so user can manually select
    assert "unmatched" in data["available_columns"]
    assert "unmatched_ref" in data["available_columns"]["unmatched"]
    assert "picture_01.png" in data["image_filenames"]


def test_set_image_column_endpoint():
    img1 = create_test_image_bytes()
    csv_bytes = b"id,name,custom_photo_col\n1,Item 1,custom1.jpg\n2,Item 2,custom2.jpg\n"

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w") as zf:
        zf.writestr("pic.png", img1)
        zf.writestr("inventory.csv", csv_bytes)
    zip_buffer.seek(0)

    upload_resp = client.post("/api/upload-db", files={"file": ("inv.zip", zip_buffer, "application/zip")})
    assert upload_resp.status_code == 200
    db_path = upload_resp.json()["db_path"]

    # 1. Success manual assignment
    payload = {
        "db_path": db_path,
        "table": "inv",
        "column": "custom_photo_col",
    }
    set_resp = client.post("/api/set-image-column", json=payload)
    assert set_resp.status_code == 200
    set_data = set_resp.json()
    assert set_data["success"] is True
    assert set_data["image_column"] == "custom_photo_col"
    assert set_data["image_columns"]["inv"] == ["custom_photo_col"]

    # 2. Non-existent column returns 400
    bad_col_resp = client.post("/api/set-image-column", json={"db_path": db_path, "table": "inv", "column": "not_real"})
    assert bad_col_resp.status_code == 400
    assert "not found in table" in bad_col_resp.json()["detail"]

    # 3. Non-existent table returns 400
    bad_tbl_resp = client.post("/api/set-image-column", json={"db_path": db_path, "table": "ghost", "column": "id"})
    assert bad_tbl_resp.status_code == 400
    assert "does not exist" in bad_tbl_resp.json()["detail"]

