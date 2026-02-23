#!/usr/bin/env python3
"""
download_images.py — Download all product images from external URLs to local storage.

This script reads products_data.json and downloads every image referenced in
the product records to the local images/products/ directory. It also updates
products_data.json with the new local image paths.

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
    """Convert an external URL to a local relative path."""
    filename = url_to_filename(url)
    return f"images/products/{filename}"


def main():
    os.makedirs(IMAGES_DIR, exist_ok=True)

    with open(PRODUCTS_JSON, "r", encoding="utf-8") as f:
        products = json.load(f)

    # Collect all unique image URLs
    all_urls = set()
    for product in products:
        if product.get("img1"):
            all_urls.add(product["img1"])
        if product.get("img2"):
            all_urls.add(product["img2"])
        for img_url in product.get("images", []):
            all_urls.add(img_url)

    print(f"Found {len(all_urls)} unique image URLs across {len(products)} products.")

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
        if product.get("img1"):
            product["img1"] = to_local_path(product["img1"])
        if product.get("img2"):
            product["img2"] = to_local_path(product["img2"])
        if product.get("images"):
            product["images"] = [to_local_path(u) for u in product["images"]]

    output_path = os.path.join(REPO_DIR, "products_data_local.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(products, f, indent=2, ensure_ascii=False)

    print(f"Updated product data saved to: {output_path}")
    print("After verifying images, you can rename products_data_local.json to products_data.json")


if __name__ == "__main__":
    main()
