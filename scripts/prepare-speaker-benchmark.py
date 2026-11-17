#!/usr/bin/env python3
"""Fetch the pinned CC BY 4.0 vocadito v3 dataset (no Python dependencies)."""
import hashlib
from pathlib import Path
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / ".cache/speaker-benchmark"
URL = "https://zenodo.org/api/records/5578807/files/vocadito.zip/content"
CHECKSUM = "dea40fd18f14d899643c4ba221b33a46"


def main():
    CACHE.mkdir(parents=True, exist_ok=True)
    archive = CACHE / "vocadito.zip"
    if not archive.exists():
        print("Downloading vocadito v3 (58.5 MB, CC BY 4.0)...", flush=True)
        temporary = archive.with_suffix(".download")
        urllib.request.urlretrieve(URL, temporary)
        temporary.replace(archive)
    if hashlib.md5(archive.read_bytes()).hexdigest() != CHECKSUM:
        raise RuntimeError(f"Dataset checksum mismatch: remove {archive} and retry")
    with zipfile.ZipFile(archive) as source:
        for member in source.infolist():
            target = (CACHE / member.filename).resolve()
            if not target.is_relative_to(CACHE.resolve()):
                raise RuntimeError("Unexpected archive path")
            source.extract(member, CACHE)
    print(f"Verified and extracted dataset to {CACHE}")


if __name__ == "__main__":
    main()
