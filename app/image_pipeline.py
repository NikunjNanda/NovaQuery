import io
import os
import zipfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple
from PIL import Image

MAX_ZIP_BYTES = 100 * 1024 * 1024       # 100 MB max ZIP file size
MAX_IMAGES = 300                         # max 300 images extracted
MAX_IMAGE_BYTES = 10 * 1024 * 1024      # 10 MB per image
MAX_TOTAL_UNCOMPRESSED = 500 * 1024 * 1024 # 500 MB total uncompressed

SUPPORTED_IMAGE_FORMATS = {"JPEG", "PNG", "WEBP", "GIF"}
METADATA_EXTENSIONS = {".csv", ".xlsx", ".xls", ".json"}


class ZipSlipException(Exception):
    """Raised when a ZIP entry contains path traversal."""
    pass


class ZipLimitException(Exception):
    """Raised when ZIP contents exceed resource limits."""
    pass


def is_symlink(zip_info: zipfile.ZipInfo) -> bool:
    """Checks if a zipinfo entry is a symbolic link."""
    return ((zip_info.external_attr >> 16) & 0o120000) == 0o120000


def is_ignored_entry(filename: str) -> bool:
    """
    Checks if a zip entry should be ignored:
    - __MACOSX resource forks
    - Hidden files or directories (starting with '.' like .DS_Store, excluding traversal ..)
    - Nested .zip files
    """
    parts = Path(filename.replace("\\", "/")).parts
    for p in parts:
        if p in {".", ".."}:
            continue
        if p.startswith(".") or p.startswith("__MACOSX"):
            return True
    if filename.lower().endswith(".zip"):
        return True
    return False


def validate_zip_slip(entry_name: str, base_dir: Path) -> Path:
    """
    Ensures the destination path stays strictly within base_dir.
    Raises ZipSlipException on path traversal attempts.
    """
    normalized = entry_name.replace("\\", "/")
    parts = Path(normalized).parts
    if ".." in parts or os.path.isabs(normalized) or Path(normalized).is_absolute():
        raise ZipSlipException(f"Path traversal detected in zip entry: {entry_name}")

    dest = (base_dir / normalized).resolve()
    base_resolved = base_dir.resolve()
    try:
        dest.relative_to(base_resolved)
    except ValueError:
        raise ZipSlipException(f"Path traversal detected in zip entry: {entry_name}")
    return dest


def generate_unique_filename(name: str, existing_names: Set[str]) -> str:
    """Generates a collision-free filename like photo.jpg -> photo_2.jpg."""
    clean_name = Path(name).name
    stem = Path(clean_name).stem
    suffix = Path(clean_name).suffix.lower()

    if clean_name.lower() not in existing_names:
        existing_names.add(clean_name.lower())
        return clean_name

    counter = 2
    while f"{stem}_{counter}{suffix}".lower() in existing_names:
        counter += 1

    unique_name = f"{stem}_{counter}{suffix}"
    existing_names.add(unique_name.lower())
    return unique_name


def validate_and_open_image(raw_bytes: bytes) -> Tuple[Optional[Image.Image], Optional[str]]:
    """
    Validates image content using Pillow.
    Returns (Image object, format string) or (None, None) if invalid/unsupported.
    """
    try:
        img = Image.open(io.BytesIO(raw_bytes))
        fmt = (img.format or "").upper()
        if fmt not in SUPPORTED_IMAGE_FORMATS:
            return None, None
        # Load pixels to ensure no truncated or corrupted streams
        img.load()
        return img, fmt
    except Exception:
        return None, None


def create_thumbnail(img: Image.Image, dest_path: Path, max_size: int = 256) -> bool:
    """
    Generates a 256px maximum dimension thumbnail and saves it to dest_path.
    """
    try:
        thumb = img.copy()
        thumb.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)

        fmt = (img.format or "JPEG").upper()
        # If RGBA image is being saved as JPEG, convert to RGB
        if fmt == "JPEG" and thumb.mode in ("RGBA", "LA", "P"):
            bg = Image.new("RGB", thumb.size, (255, 255, 255))
            if thumb.mode == "P":
                thumb = thumb.convert("RGBA")
            bg.paste(thumb, mask=thumb.split()[-1] if thumb.mode == "RGBA" else None)
            thumb = bg

        thumb.save(dest_path, format=fmt)
        return True
    except Exception as e:
        print(f"Failed to generate thumbnail for {dest_path.name}: {e}")
        return False


def process_zip_dataset(
    zip_path: Path,
    workspace_id: str,
    uploads_root: Path,
) -> Dict[str, Any]:
    """
    Extracts and validates an image dataset ZIP:
    - Zip-slip safe
    - Enforces size, count, and uncompressed limits
    - Stores images in uploads/<workspace_id>/images/
    - Generates 256px thumbnails in uploads/<workspace_id>/thumbs/
    - Collects metadata files (.csv, .xlsx, .json)
    """
    workspace_dir = uploads_root / workspace_id
    images_dir = workspace_dir / "images"
    thumbs_dir = workspace_dir / "thumbs"

    images_dir.mkdir(parents=True, exist_ok=True)
    thumbs_dir.mkdir(parents=True, exist_ok=True)

    warnings: List[str] = []
    extracted_images: List[Dict[str, Any]] = []
    metadata_entries: List[Dict[str, Any]] = []

    total_uncompressed = 0
    image_count = 0
    existing_stored_names: Set[str] = set()

    with zipfile.ZipFile(zip_path, "r") as zf:
        infolist = zf.infolist()

        for info in infolist:
            # 1. Zip-slip check FIRST on all entries
            validate_zip_slip(info.filename, images_dir)

            # 2. Skip directories
            if info.is_dir() or info.filename.endswith("/"):
                continue

            # 3. Check symlinks
            if is_symlink(info):
                warnings.append(f"Skipped symlink '{info.filename}'")
                continue

            # 4. Check hidden files / __MACOSX / nested zips
            if is_ignored_entry(info.filename):
                continue

            # 5. Check uncompressed limits
            if info.file_size > MAX_IMAGE_BYTES:
                warnings.append(
                    f"Skipped '{info.filename}': File size {info.file_size / (1024*1024):.1f}MB exceeds 10MB limit"
                )
                continue

            total_uncompressed += info.file_size
            if total_uncompressed > MAX_TOTAL_UNCOMPRESSED:
                raise ZipLimitException(
                    f"ZIP uncompressed size exceeds maximum allowed {MAX_TOTAL_UNCOMPRESSED // (1024*1024)}MB."
                )

            # Read raw bytes
            data = zf.read(info)
            ext = Path(info.filename).suffix.lower()

            # Check if this is a metadata file (.csv, .xlsx, .json)
            if ext in METADATA_EXTENSIONS:
                metadata_entries.append({
                    "filename": Path(info.filename).name,
                    "original_path": info.filename,
                    "size_bytes": info.file_size,
                    "data": data,
                })
                continue

            # Otherwise, test as candidate image
            if image_count >= MAX_IMAGES:
                warnings.append(f"Reached maximum image limit ({MAX_IMAGES}). Remaining images skipped.")
                break

            img, fmt = validate_and_open_image(data)
            if not img:
                warnings.append(f"Skipped '{info.filename}': Not a valid or supported image format (JPEG, PNG, WEBP, GIF).")
                continue

            # Generate collision-free stored filename
            stored_name = generate_unique_filename(info.filename, existing_stored_names)
            stored_img_path = images_dir / stored_name
            stored_thumb_path = thumbs_dir / stored_name

            # Write full image
            stored_img_path.write_bytes(data)

            # Generate thumbnail
            create_thumbnail(img, stored_thumb_path, max_size=256)

            image_count += 1
            extracted_images.append({
                "original_name": Path(info.filename).name,
                "original_zip_path": info.filename,
                "stored_name": stored_name,
                "rel_path": f"{workspace_id}/images/{stored_name}",
                "thumb_rel_path": f"{workspace_id}/thumbs/{stored_name}",
                "size_bytes": info.file_size,
                "format": fmt,
                "width": img.width,
                "height": img.height,
            })

    return {
        "success": True,
        "workspace_id": workspace_id,
        "image_count": len(extracted_images),
        "images": extracted_images,
        "metadata_entries": metadata_entries,
        "warnings": warnings,
        "total_uncompressed_bytes": total_uncompressed,
    }
