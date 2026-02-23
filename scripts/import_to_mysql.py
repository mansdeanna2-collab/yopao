#!/usr/bin/env python3
"""
import_to_mysql.py — Import products_data.json into the MySQL database.

This script reads the product data and inserts it into the MySQL tables
created by db/schema.sql.

Prerequisites:
    1. MySQL server running with the database created:
       mysql -u yopao -p -h 127.0.0.1 yopao < db/schema.sql
    2. Install mysql-connector-python:
       pip install mysql-connector-python
    3. Set DB_PASS environment variable:
       export DB_PASS="your_database_password"

Usage:
    python3 scripts/import_to_mysql.py
"""

import json
import os
import re
import sys

try:
    import mysql.connector
except ImportError:
    print("Please install mysql-connector-python: pip install mysql-connector-python")
    sys.exit(1)

REPO_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRODUCTS_JSON = os.path.join(REPO_DIR, "products_data.json")

# ── Database connection settings (must match db/config.php) ────────────
# Set DB_PASS environment variable before running: export DB_PASS="your_password"
DB_CONFIG = {
    "host": os.environ.get("DB_HOST", "127.0.0.1"),
    "port": int(os.environ.get("DB_PORT", "3306")),
    "user": os.environ.get("DB_USER", "yopao"),
    "password": os.environ.get("DB_PASS", "6ffc39ea3c3a285d"),
    "database": os.environ.get("DB_NAME", "yopao"),
    "charset": "utf8mb4",
}


def category_name_to_slug(name):
    """Convert category name to URL-friendly slug."""
    slug = name.lower()
    slug = re.sub(r'[^a-z0-9]+', '-', slug)
    slug = slug.strip('-')
    return slug


def parse_price(price_str):
    """Parse price string like '$29.00' to float."""
    return float(re.sub(r'[^\d.]', '', price_str))


def main():
    with open(PRODUCTS_JSON, "r", encoding="utf-8") as f:
        products = json.load(f)

    print(f"Loaded {len(products)} products from {PRODUCTS_JSON}")

    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor()

    # ── Step 1: Collect and insert all unique categories ───────────────
    category_map = {}  # name -> id
    all_categories = set()
    for product in products:
        cats = product.get("all_categories", [])
        if not cats and product.get("category"):
            cats = [product["category"]]
        for cat in cats:
            all_categories.add(cat)

    print(f"Found {len(all_categories)} unique categories.")

    for cat_name in sorted(all_categories):
        slug = category_name_to_slug(cat_name)
        cursor.execute(
            "INSERT INTO categories (slug, name) VALUES (%s, %s) "
            "ON DUPLICATE KEY UPDATE name = VALUES(name)",
            (slug, cat_name)
        )
        cursor.execute("SELECT id FROM categories WHERE slug = %s", (slug,))
        row = cursor.fetchone()
        category_map[cat_name] = row[0]

    conn.commit()
    print(f"Inserted {len(category_map)} categories.")

    # ── Step 2: Insert products ────────────────────────────────────────
    inserted = 0
    skipped = 0

    for product in products:
        slug = product.get("slug", "")
        name = product.get("name", "")
        sku = product.get("sku", "")
        price = parse_price(product.get("price", "$0.00"))
        stock = product.get("stock", 0)
        description = product.get("description", "")
        img1 = product.get("img1", "")
        img2 = product.get("img2", "")

        try:
            cursor.execute(
                """INSERT INTO products (slug, name, sku, price, stock, description, img1, img2)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                   ON DUPLICATE KEY UPDATE
                     name = VALUES(name),
                     sku = VALUES(sku),
                     price = VALUES(price),
                     stock = VALUES(stock),
                     description = VALUES(description),
                     img1 = VALUES(img1),
                     img2 = VALUES(img2)""",
                (slug, name, sku, price, stock, description, img1, img2)
            )
            product_id = cursor.lastrowid
            if product_id == 0:
                cursor.execute("SELECT id FROM products WHERE slug = %s", (slug,))
                product_id = cursor.fetchone()[0]

            # Insert product images
            images = product.get("images", [])
            cursor.execute("DELETE FROM product_images WHERE product_id = %s", (product_id,))
            for idx, img_url in enumerate(images):
                cursor.execute(
                    "INSERT INTO product_images (product_id, image_url, sort_order) VALUES (%s, %s, %s)",
                    (product_id, img_url, idx)
                )

            # Insert product-category relationships
            cats = product.get("all_categories", [])
            if not cats and product.get("category"):
                cats = [product["category"]]
            cursor.execute("DELETE FROM product_categories WHERE product_id = %s", (product_id,))
            for cat_name in cats:
                if cat_name in category_map:
                    cursor.execute(
                        "INSERT IGNORE INTO product_categories (product_id, category_id) VALUES (%s, %s)",
                        (product_id, category_map[cat_name])
                    )

            inserted += 1
        except Exception as e:
            print(f"  [ERROR] {slug}: {e}")
            skipped += 1

    conn.commit()

    # ── Step 3: Update category product counts ─────────────────────────
    cursor.execute("""
        UPDATE categories c SET product_count = (
            SELECT COUNT(DISTINCT pc.product_id)
            FROM product_categories pc
            WHERE pc.category_id = c.id
        )
    """)
    conn.commit()

    print(f"\nImport complete: {inserted} products imported, {skipped} skipped.")

    cursor.close()
    conn.close()


if __name__ == "__main__":
    main()
