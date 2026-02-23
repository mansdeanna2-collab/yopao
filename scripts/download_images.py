#!/usr/bin/env python3
"""
download_images.py — Download all product images from external URLs to local storage.

This script reads products_data.json and index.html, downloads every image
referenced to the local images/products/ directory, and updates both files
to use local absolute paths (/images/products/filename).

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

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}


def url_to_filename(url):
    """Convert an image URL to a unique local filename."""
    basename = url.rsplit("/", 1)[-1] if "/" in url else url
    # Remove query strings
    basename = basename.split("?")[0]
    # If filename is too long or has special characters, use a hash
    if len(basename) > 200 or not re.match(r'^[\w\-\.]+$', basename):
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


def main():
    os.makedirs(IMAGES_DIR, exist_ok=True)

    with open(PRODUCTS_JSON, "r", encoding="utf-8") as f:
        products = json.load(f)

    # Collect all unique image URLs from products_data.json
    all_urls = set()
    for product in products:
        for key in ("img1", "img2"):
            val = product.get(key, "")
            if val and val.startswith("http"):
                all_urls.add(val)
        for img_url in product.get("images", []):
            if img_url.startswith("http"):
                all_urls.add(img_url)

    # Also collect image URLs from index.html (category cards & best sellers)
    html_urls = set()
    if os.path.exists(INDEX_HTML):
        with open(INDEX_HTML, "r", encoding="utf-8") as f:
            html_content = f.read()
        html_urls = set(re.findall(
            r'https://eddm\.shop/wp-content/uploads/[^\s\'\")]+', html_content
        ))
        all_urls |= html_urls

    print(f"Found {len(all_urls)} unique image URLs to download.")

    # Download all images
    success = 0
    fail = 0
    for i, url in enumerate(sorted(all_urls), 1):
        filename = url_to_filename(url)
        dest = os.path.join(IMAGES_DIR, filename)
        print(f"  [{i}/{len(all_urls)}] {filename} ... ", end="", flush=True)
        if download_image(url, dest):
            print("OK")
            success += 1
        else:
            fail += 1
        time.sleep(0.1)  # Be polite to the server

    print(f"\nDone: {success} downloaded, {fail} failed.")

    # Update products_data.json with local paths
    for product in products:
        for key in ("img1", "img2"):
            val = product.get(key, "")
            if val and val.startswith("http"):
                product[key] = to_local_path(val)
        if product.get("images"):
            product["images"] = [
                to_local_path(u) if u.startswith("http") else u
                for u in product["images"]
            ]

    with open(PRODUCTS_JSON, "w", encoding="utf-8") as f:
        json.dump(products, f, indent=2, ensure_ascii=False)

    print(f"Updated {PRODUCTS_JSON} with local image paths.")

    # Update index.html with local paths
    if html_urls and os.path.exists(INDEX_HTML):
        with open(INDEX_HTML, "r", encoding="utf-8") as f:
            html_content = f.read()
        html_content = re.sub(
            r'https://eddm\.shop/wp-content/uploads/[^\s\'\")]+',
            lambda m: to_local_path(m.group(0)),
            html_content,
        )
        with open(INDEX_HTML, "w", encoding="utf-8") as f:
            f.write(html_content)
        print(f"Updated {INDEX_HTML} with local image paths.")


if __name__ == "__main__":
    main()
