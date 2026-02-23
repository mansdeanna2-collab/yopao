#!/usr/bin/env python3
"""
download_images.py — Download product images, with incremental missing-file support.

This script scans products_data.json and index.html for all image references
(both external URLs and already-converted local paths), checks which files
are physically missing from images/products/, and downloads only those.

A url_map.json mapping file is maintained so that once an external URL is
seen, the script can always recover the download URL for any missing file
on subsequent runs.

Usage:
    python3 scripts/download_images.py
"""

import json
import os
import re
import sys
import time
import hashlib
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError

REPO_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRODUCTS_JSON = os.path.join(REPO_DIR, "products_data.json")
INDEX_HTML = os.path.join(REPO_DIR, "index.html")
IMAGES_DIR = os.path.join(REPO_DIR, "images", "products")
URL_MAP_FILE = os.path.join(IMAGES_DIR, "url_map.json")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}

EXTERNAL_URL_PATTERN = r"https://eddm\.shop/wp-content/uploads/[^\s'\")]+"
LOCAL_PATH_PATTERN = r"/images/products/([^\s'\"\)\;]+)"

# Known base URLs to try when reconstructing download URLs for missing files.
# Order matters: most common first.
KNOWN_BASE_URLS = [
    "https://eddm.shop/wp-content/uploads/2026/01/",
    "https://eddm.shop/wp-content/uploads/2025/09/",
]

# Maximum filename length to avoid filesystem issues on various OS/FS combos.
MAX_FILENAME_LENGTH = 200


def filename_from_path(path):
    """Extract the filename from a local image path like /images/products/foo.jpg."""
    return path.split("/")[-1]


def url_to_filename(url):
    """Convert an image URL to a unique local filename."""
    basename = url.rsplit("/", 1)[-1] if "/" in url else url
    basename = basename.split("?")[0]
    if len(basename) > MAX_FILENAME_LENGTH or not re.match(r'^[\w\-\.]+$', basename):
        ext = os.path.splitext(basename)[1] or ".jpg"
        basename = hashlib.md5(url.encode()).hexdigest() + ext
    return basename


def download_image(url, dest_path):
    """Download a single image. Returns True on success."""
    if os.path.exists(dest_path):
        return True
    try:
        req = Request(url, headers=HEADERS)
        with urlopen(req, timeout=30) as resp:
            data = resp.read()
        with open(dest_path, "wb") as f:
            f.write(data)
        return True
    except (URLError, HTTPError, OSError) as e:
        print(f"  [FAIL] {url} — {e}")
        return False


def to_local_path(url):
    """Convert an external URL to a local absolute path."""
    filename = url_to_filename(url)
    return f"/images/products/{filename}"


def load_url_map():
    """Load the filename → URL mapping from disk."""
    if os.path.exists(URL_MAP_FILE):
        with open(URL_MAP_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_url_map(url_map):
    """Persist the filename → URL mapping to disk."""
    with open(URL_MAP_FILE, "w", encoding="utf-8") as f:
        json.dump(url_map, f, indent=2, ensure_ascii=False)


def try_download_with_fallback(filename, url_map):
    """Try to download a missing file using the url_map or known base URLs.

    Returns (success: bool, url: str or None).
    """
    dest = os.path.join(IMAGES_DIR, filename)

    # 1. Try the URL stored in the map
    if filename in url_map:
        url = url_map[filename]
        if download_image(url, dest):
            return True, url

    # 2. Try known base URLs as fallback
    for base in KNOWN_BASE_URLS:
        url = base + filename
        if download_image(url, dest):
            return True, url

    return False, None


def main():
    os.makedirs(IMAGES_DIR, exist_ok=True)

    url_map = load_url_map()

    with open(PRODUCTS_JSON, "r", encoding="utf-8") as f:
        products = json.load(f)

    # ── Collect all image references ──────────────────────────────────
    # filename → external_url (if known)
    external_urls = {}   # filename -> url  (from external URLs still present)
    all_filenames = set()  # every filename we need on disk

    # From products_data.json
    for product in products:
        for key in ("img1", "img2"):
            val = product.get(key, "")
            if not val:
                continue
            if val.startswith("http"):
                fn = url_to_filename(val)
                external_urls[fn] = val
                all_filenames.add(fn)
            elif val.startswith("/images/products/"):
                all_filenames.add(filename_from_path(val))

        for img_url in product.get("images", []):
            if img_url.startswith("http"):
                fn = url_to_filename(img_url)
                external_urls[fn] = img_url
                all_filenames.add(fn)
            elif img_url.startswith("/images/products/"):
                all_filenames.add(filename_from_path(img_url))

    # From index.html
    if os.path.exists(INDEX_HTML):
        with open(INDEX_HTML, "r", encoding="utf-8") as f:
            html_content = f.read()

        # External URLs still in HTML
        for url in re.findall(EXTERNAL_URL_PATTERN, html_content):
            fn = url_to_filename(url)
            external_urls[fn] = url
            all_filenames.add(fn)

        # Already-converted local paths
        for fn in re.findall(LOCAL_PATH_PATTERN, html_content):
            all_filenames.add(fn)

    # Merge newly discovered external URLs into the map
    for fn, url in external_urls.items():
        url_map[fn] = url

    # ── Determine which files are missing ─────────────────────────────
    missing = []
    for fn in sorted(all_filenames):
        if not os.path.exists(os.path.join(IMAGES_DIR, fn)):
            missing.append(fn)

    if not missing:
        print(f"All {len(all_filenames)} images already exist. Nothing to download.")
        save_url_map(url_map)
        return

    print(f"Found {len(missing)} missing images out of {len(all_filenames)} total.")

    # ── Download missing files ────────────────────────────────────────
    success = 0
    fail = 0
    for i, fn in enumerate(missing, 1):
        print(f"  [{i}/{len(missing)}] {fn} ... ", end="", flush=True)

        if fn in external_urls:
            # We have the exact URL
            url = external_urls[fn]
            dest = os.path.join(IMAGES_DIR, fn)
            if download_image(url, dest):
                print("OK")
                url_map[fn] = url
                success += 1
            else:
                fail += 1
        else:
            # Try url_map and known base URLs
            ok, url = try_download_with_fallback(fn, url_map)
            if ok:
                print("OK")
                if url:
                    url_map[fn] = url
                success += 1
            else:
                fail += 1

        time.sleep(0.1)

    print(f"\nDone: {success} downloaded, {fail} failed.")

    # ── Save the URL map ──────────────────────────────────────────────
    save_url_map(url_map)
    print(f"URL map saved to {URL_MAP_FILE} ({len(url_map)} entries).")

    # ── Convert any remaining external URLs to local paths ────────────
    updated_json = False
    for product in products:
        for key in ("img1", "img2"):
            val = product.get(key, "")
            if val and val.startswith("http"):
                product[key] = to_local_path(val)
                updated_json = True
        if product.get("images"):
            new_images = []
            for u in product["images"]:
                if u.startswith("http"):
                    new_images.append(to_local_path(u))
                    updated_json = True
                else:
                    new_images.append(u)
            product["images"] = new_images

    if updated_json:
        with open(PRODUCTS_JSON, "w", encoding="utf-8") as f:
            json.dump(products, f, indent=2, ensure_ascii=False)
        print(f"Updated {PRODUCTS_JSON} with local image paths.")

    if os.path.exists(INDEX_HTML):
        with open(INDEX_HTML, "r", encoding="utf-8") as f:
            html_content = f.read()
        if re.search(EXTERNAL_URL_PATTERN, html_content):
            html_content = re.sub(
                EXTERNAL_URL_PATTERN,
                lambda m: to_local_path(m.group(0)),
                html_content,
            )
            with open(INDEX_HTML, "w", encoding="utf-8") as f:
                f.write(html_content)
            print(f"Updated {INDEX_HTML} with local image paths.")


if __name__ == "__main__":
    main()
