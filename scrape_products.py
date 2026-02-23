#!/usr/bin/env python3
"""
scrape_products.py — 从本地分类页面提取商品信息并生成完整的商品详情页

功能:
  1. 扫描所有16个分类页面（包括分页）提取商品数据
  2. 从商品卡片中提取: slug, 名称, 分类, 图片URL, 价格
  3. 使用现有CSS生成完整的商品详情页面
  4. 包含: 图片画廊, 折扣表, 库存信息, 相关商品, 正确的导航链接

用法:
  python3 scrape_products.py
"""

import os
import re
import json
import html
import random
import glob as globmod

# ─── 配置 ─────────────────────────────────────────────────────────────
REPO_DIR = os.path.dirname(os.path.abspath(__file__))
PRODUCT_DIR = os.path.join(REPO_DIR, "product")

# 分类目录映射
CATEGORY_DIRS = {
    "2017": "2017",
    "2018": "2018",
    "2019": "2019",
    "2020": "2020",
    "2021": "2021",
    "2022": "2022",
    "2023": "2023",
    "2024": "2024",
    "2025": "2025",
    "flag-series": "Flag Series",
    "christmas-holiday": "Christmas &amp; Holiday",
    "wedding-flowers": "Wedding &amp; Flowers",
    "animal-series": "Animal Series",
    "global-series": "Global Series",
    "other-years": "Other Years",
    "2-oz-letter": "2 OZ Letter",
}

# 分类到URL的映射
CATEGORY_URL_MAP = {
    "2017": "../../2017/",
    "2018": "../../2018/",
    "2019": "../../2019/",
    "2020": "../../2020/",
    "2021": "../../2021/",
    "2022": "../../2022/",
    "2023": "../../2023/",
    "2024": "../../2024/",
    "2025": "../../2025/",
    "Flag Series": "../../flag-series/",
    "Christmas & Holiday": "../../christmas-holiday/",
    "Christmas &amp; Holiday": "../../christmas-holiday/",
    "Wedding & Flowers": "../../wedding-flowers/",
    "Wedding &amp; Flowers": "../../wedding-flowers/",
    "Animal Series": "../../animal-series/",
    "Global Series": "../../global-series/",
    "Other Years": "../../other-years/",
    "2 OZ Letter": "../../2-oz-letter/",
}


def find_category_html_files():
    """查找所有分类页面HTML文件（包括分页）"""
    files = []
    for cat_dir in CATEGORY_DIRS:
        cat_path = os.path.join(REPO_DIR, cat_dir)
        if os.path.isdir(cat_path):
            for f in os.listdir(cat_path):
                if f.endswith(".html"):
                    files.append(os.path.join(cat_path, f))
    # 2021 has a nested 2-oz-letter
    nested = os.path.join(REPO_DIR, "2021", "2-oz-letter")
    if os.path.isdir(nested):
        for f in os.listdir(nested):
            if f.endswith(".html"):
                files.append(os.path.join(nested, f))
    return sorted(files)


def extract_products_from_html(filepath):
    """从分类页面HTML中提取所有商品信息"""
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    products = []

    # 匹配 product-card 块
    card_pattern = re.compile(
        r'<div\s+class="product-card">\s*'
        r'<a\s+href="([^"]*)"[^>]*>\s*'
        r'<div\s+class="product-image">\s*'
        r'<img\s+src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>\s*'
        r'<img\s+class="hover-img"\s+src="([^"]*)"[^>]*>\s*'
        r'</div>\s*'
        r'<div\s+class="product-info">\s*'
        r'<p\s+class="product-category">([^<]*)</p>\s*'
        r'<p\s+class="product-name">([^<]*)</p>\s*'
        r'<p\s+class="product-price">([^<]*)</p>',
        re.DOTALL,
    )

    for m in card_pattern.finditer(content):
        href = m.group(1)
        img1 = m.group(2)
        alt = m.group(3)
        img2 = m.group(4)
        category = m.group(5).strip()
        name = m.group(6).strip()
        price = m.group(7).strip()

        # 跳过 href="#" 的链接（无效的产品链接）
        if href.strip() == "#":
            continue

        # 从 href 中提取 slug
        slug_match = re.search(r"/product/([^/]+)/?", href)
        if slug_match:
            slug = slug_match.group(1)
        else:
            slug = href.strip("/").split("/")[-1]

        # 跳过无效的 slug
        if not slug or slug == "#":
            continue

        products.append(
            {
                "slug": slug,
                "name": name,
                "category": category,
                "img1": img1,
                "img2": img2,
                "alt": alt,
                "price": price,
                "href": href,
            }
        )

    return products


def get_full_size_url(thumb_url):
    """将缩略图URL转换为全尺寸图片URL（移除 -247x296 等尺寸后缀）"""
    return re.sub(r"-\d+x\d+(\.\w+)$", r"\1", thumb_url)


def get_thumb_100_url(full_url):
    """将全尺寸图片URL转换为100x100缩略图URL"""
    return re.sub(r"(\.\w+)$", r"-100x100\1", full_url)


def determine_categories_for_product(slug, name, all_products_by_slug):
    """根据slug和所有分类页面中的出现情况，确定商品所属的所有分类"""
    categories = set()
    if slug in all_products_by_slug:
        for p in all_products_by_slug[slug]:
            categories.add(p["category"])
    return list(categories) if categories else ["Stamps"]


def generate_sku(slug):
    """根据slug生成SKU号码"""
    # 使用slug的hash来生成一致的SKU
    hash_val = hash(slug) % 100000
    return f"EDDM{abs(hash_val):05d}"


def generate_stock(slug):
    """根据slug生成库存数量（确定性的）"""
    random.seed(slug)
    return random.randint(200, 999)


def generate_description(name, category):
    """根据商品名称和分类生成描述文本"""
    name_clean = html.unescape(name).strip()

    # 提取年份
    year_match = re.match(r"(\d{4})\s+", name_clean)
    year = year_match.group(1) if year_match else ""
    theme = name_clean[len(year) :].strip() if year else name_clean

    desc = (
        f"The {name_clean} Forever Stamp is a beautiful addition to any collection. "
        f"Issued by the United States Postal Service (USPS), this stamp features a stunning design "
        f"that captures the essence of {theme}. "
    )

    if "Flag" in name_clean or "flag" in name_clean:
        desc += (
            "The American flag is an enduring symbol of freedom, national unity, and patriotic spirit. "
            "Old Glory waves proudly outside government offices, schools, military bases, and USPS facilities. "
        )
    elif "Christmas" in name_clean or "Holiday" in name_clean or "holiday" in category.lower():
        desc += (
            "Perfect for the holiday season, this stamp brings warmth and festive cheer to every envelope. "
            "Share the spirit of the season with family and friends through your holiday mail. "
        )
    elif "Love" in name_clean or "Wedding" in name_clean or "wedding" in category.lower():
        desc += (
            "An elegant choice for wedding invitations, anniversary cards, and love letters. "
            "This stamp adds a special touch of romance to your most meaningful correspondence. "
        )
    elif "Animal" in category or "animal" in name_clean.lower() or any(
        w in name_clean.lower()
        for w in [
            "butterfly",
            "frog",
            "shark",
            "dog",
            "cat",
            "bird",
            "otter",
            "turtle",
            "rabbit",
            "ox",
            "tiger",
            "snake",
            "dragon",
            "rat",
            "horse",
            "manatee",
            "bat",
            "elephant",
            "fox",
        ]
    ):
        desc += (
            "This beautiful nature-themed stamp showcases the wonder of the animal kingdom. "
            "A perfect choice for nature enthusiasts and stamp collectors alike. "
        )
    elif "Lunar" in name_clean or "Year of" in name_clean:
        desc += (
            "Celebrate the Lunar New Year with this beautifully designed commemorative stamp. "
            "A wonderful way to honor Asian heritage and cultural traditions. "
        )
    elif "Global" in name_clean or "global" in category.lower():
        desc += (
            "This Global Forever stamp is perfect for international mail. "
            "Valid for sending a one-ounce letter to any country in the world. "
        )
    else:
        desc += (
            "A wonderful addition to any stamp collection, this design celebrates "
            "the rich cultural heritage and diverse themes of American postal history. "
        )

    if year:
        desc += f"Issued in {year}, "
    desc += (
        "these Forever Stamps are valid for first-class mail regardless of future price changes. "
        "Each set contains 5 sheets of 20 stamps (100 stamps total), "
        "making them a great value for all your mailing needs."
    )

    return desc


def generate_product_page(product_data, all_products, all_products_by_slug):
    """生成完整的商品详情页HTML"""
    slug = product_data["slug"]
    name = product_data["name"]
    category = product_data["category"]
    price_str = product_data["price"]
    img1_thumb = product_data["img1"]
    img2_thumb = product_data["img2"]

    # 获取全尺寸图片URL
    img1_full = get_full_size_url(img1_thumb)
    img2_full = get_full_size_url(img2_thumb)
    img1_100 = get_thumb_100_url(img1_full)
    img2_100 = get_thumb_100_url(img2_full)

    # 解析价格
    price_match = re.search(r"[\d.]+", price_str)
    base_price = float(price_match.group()) if price_match else 29.00

    # 计算折扣价
    d10 = round(base_price * 0.9, 2)
    d15 = round(base_price * 0.85, 2)
    d20 = round(base_price * 0.8, 2)
    d25 = round(base_price * 0.75, 2)
    d30 = round(base_price * 0.7, 2)

    # 生成SKU和库存
    sku = generate_sku(slug)
    stock = generate_stock(slug)

    # 确定所有分类
    categories = determine_categories_for_product(slug, name, all_products_by_slug)

    # 生成分类链接HTML
    cat_links = []
    for cat in categories:
        url = CATEGORY_URL_MAP.get(cat, "#")
        cat_display = html.unescape(cat)
        cat_links.append(f'<a href="{url}">{cat_display}</a>')
    categories_html = ", ".join(cat_links)

    # 主分类URL
    main_cat_url = CATEGORY_URL_MAP.get(category, "#")
    main_cat_display = html.unescape(category)

    # 生成描述
    description = generate_description(name, category)

    # HTML转义名称
    name_escaped = html.escape(name)

    # 选择相关商品（同分类的其他商品，最多5个）
    related = []
    for p in all_products:
        if p["slug"] != slug and p["category"] == category and len(related) < 5:
            # 检查是否已经在related中
            if not any(r["slug"] == p["slug"] for r in related):
                related.append(p)
    # 如果同分类不够5个，从其他分类补充
    if len(related) < 5:
        for p in all_products:
            if (
                p["slug"] != slug
                and len(related) < 5
                and not any(r["slug"] == p["slug"] for r in related)
            ):
                related.append(p)

    # 生成相关商品HTML
    related_html = ""
    for r in related:
        r_slug = r["slug"]
        r_name = html.escape(r["name"])
        r_cat = html.escape(r["category"])
        r_price = r["price"]
        r_img = r["img1"]
        related_html += f"""
      <div class="product-card">
        <a href="../{r_slug}/">
          <div class="product-image">
            <img src="{r_img}" alt="{r_name}" loading="lazy">
          </div>
          <div class="product-info">
            <p class="product-category">{r_cat}</p>
            <p class="product-name">{r_name}</p>
            <p class="product-price">{r_price}</p>
          </div>
        </a>
      </div>"""

    # 生成完整HTML页面
    page_html = f"""<!DOCTYPE html>
<html lang="en-US">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{name_escaped} &ndash; Buy Discount Postage Online</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../../css/common.css">
  <link rel="stylesheet" href="../../css/product.css">
</head>
<body>

<!-- Top Bar -->
<div class="top-bar">
  <span class="top-bar-text">Free Shipping On All Orders. 3&ndash;8 Business Days Delivery</span>
  <span class="top-bar-search">&#128269;</span>
</div>

<!-- Header -->
<div class="header-wrapper" id="header">
  <header class="site-header">
    <button class="hamburger" id="hamburger-btn" aria-label="Menu">&#9776;</button>
    <div class="logo"><a href="../../index.html"><span class="logo-icon">S</span>stampstores</a></div>
    <nav class="nav-main">
      <a href="../../index.html">HOME</a>
      <a href="../../flag-series/">FLAG SERIES</a>
      <a href="../../christmas-holiday/">CHRISTMAS &amp; HOLIDAY</a>
      <a href="../../wedding-flowers/">WEDDING &amp; FLOWERS</a>
      <a href="../../animal-series/">ANIMAL SERIES</a>
      <a href="../../other-years/">OTHER YEARS &#9662;</a>
      <a href="#">CONTACT US</a>
    </nav>
    <div class="header-right">
      <a href="#" class="header-icon account-icon desktop-only" aria-label="Account">&#128100;</a>
      <div class="cart-wrapper" id="cart-wrapper">
        <button class="cart-link" id="cart-toggle" aria-label="Cart">
          <span id="cart-total">$0.00</span>
          <span class="cart-badge" id="cart-badge">0</span>
        </button>
        <div class="cart-dropdown" id="cart-dropdown">
          <div id="cart-items-list"></div>
          <div class="cart-subtotal" id="cart-subtotal-row" style="display:none">
            <span>Subtotal:</span>
            <span class="subtotal-amount" id="cart-subtotal-amount">$0.00</span>
          </div>
          <div class="cart-actions" id="cart-action-btns" style="display:none">
            <button class="cart-btn view-cart-btn">VIEW CART</button>
            <button class="cart-btn checkout-btn">CHECKOUT</button>
          </div>
        </div>
      </div>
    </div>
  </header>
</div>

<!-- Mobile Nav -->
<div class="mobile-nav-overlay" id="mobile-nav-overlay"></div>
<div class="mobile-nav-panel" id="mobile-nav-panel">
  <div class="close-btn" id="mobile-nav-close">&times;</div>
  <ul>
    <li><a href="../../index.html">HOME</a></li>
    <li><a href="../../flag-series/">FLAG SERIES</a></li>
    <li><a href="../../christmas-holiday/">CHRISTMAS &amp; HOLIDAY</a></li>
    <li><a href="../../wedding-flowers/">WEDDING &amp; FLOWERS</a></li>
    <li><a href="../../animal-series/">ANIMAL SERIES</a></li>
    <li><a href="../../other-years/">OTHER YEARS</a></li>
    <li><a href="../../2-oz-letter/">2 OZ LETTER</a></li>
    <li><a href="../../global-series/">GLOBAL SERIES</a></li>
    <li><a href="#">CONTACT US</a></li>
  </ul>
</div>

<!-- Breadcrumb -->
<div class="breadcrumb-section">
  <div class="breadcrumb-inner">
    <div class="breadcrumb">
      <a href="../../index.html">Home</a>
      <span class="divider">/</span>
      <a href="{main_cat_url}">{main_cat_display}</a>
      <span class="divider">/</span>
      <span class="current">{name_escaped}</span>
    </div>
  </div>
</div>

<!-- Product Section -->
<div class="product-section">
  <div class="product-layout">

    <!-- Gallery -->
    <div class="product-gallery">
      <div class="gallery-main" id="gallery-main">
        <img id="gallery-main-img" src="{img1_full}" alt="{name_escaped}">
        <button class="gallery-arrow prev" id="gallery-prev">&#10094;</button>
        <button class="gallery-arrow next" id="gallery-next">&#10095;</button>
        <button class="gallery-zoom" id="gallery-zoom-btn" aria-label="Zoom">&#128269;</button>
      </div>
      <div class="gallery-thumbs">
        <img class="gallery-thumb active" src="{img1_100}" alt="{name_escaped}" data-index="0" data-full="{img1_full}">
        <img class="gallery-thumb" src="{img2_100}" alt="{name_escaped}" data-index="1" data-full="{img2_full}">
      </div>
    </div>

    <!-- Product Info -->
    <div class="product-info-col">
      <h1 class="product-title">{name_escaped}</h1>
      <div class="product-divider"></div>
      <div class="product-price-main">{price_str}</div>

      <p class="discount-label"><strong>Buy More, Pay Less! (1 style = 100 Pcs)</strong></p>
      <table class="discount-table">
        <thead>
          <tr><th>QUANTITY</th><th>PRICE</th><th>DISCOUNT</th></tr>
        </thead>
        <tbody>
          <tr data-qty-min="3" data-qty-max="5" data-price="{d10:.2f}" data-discount="10">
            <td>3 - 5</td>
            <td>${d10:.2f}</td>
            <td class="discount-pct">10%</td>
          </tr>
          <tr data-qty-min="6" data-qty-max="10" data-price="{d15:.2f}" data-discount="15">
            <td>6 - 10</td>
            <td>${d15:.2f}</td>
            <td class="discount-pct">15%</td>
          </tr>
          <tr data-qty-min="11" data-qty-max="30" data-price="{d20:.2f}" data-discount="20">
            <td>11 - 30</td>
            <td>${d20:.2f}</td>
            <td class="discount-pct">20%</td>
          </tr>
          <tr data-qty-min="31" data-qty-max="100" data-price="{d25:.2f}" data-discount="25">
            <td>31 - 100</td>
            <td>${d25:.2f}</td>
            <td class="discount-pct">25%</td>
          </tr>
          <tr data-qty-min="101" data-price="{d30:.2f}" data-discount="30">
            <td>101+</td>
            <td>${d30:.2f}</td>
            <td class="discount-pct">30%</td>
          </tr>
        </tbody>
      </table>

      <!-- Variation -->
      <div class="variation-row">
        <div class="variation-label">Quantity: <span id="variation-selected">5 Sheets of 20 (100 Stamps)</span></div>
        <div class="variation-btns">
          <button class="variation-btn active" id="variation-btn-1">5 Sheets of 20 (100 Stamps)</button>
          <button class="variation-clear" id="variation-clear">Clear</button>
        </div>
      </div>

      <!-- Selected Price & Stock -->
      <div class="selected-price-row">
        <span class="selected-price">{price_str}</span>
        <span class="stock-status">{stock} in stock</span>
      </div>

      <!-- Quantity & Add to Cart -->
      <div class="qty-cart-row">
        <div class="qty-stepper">
          <button id="qty-minus" aria-label="Decrease quantity">&#8722;</button>
          <input type="number" id="qty-input" value="1" min="1" max="{stock}" aria-label="Quantity">
          <button id="qty-plus" aria-label="Increase quantity">+</button>
        </div>
        <button class="add-to-cart-main" id="add-to-cart-btn">ADD TO CART</button>
      </div>

      <!-- Product Meta -->
      <div class="product-meta">
        <p>SKU: <span>{sku}</span></p>
        <p>Categories: {categories_html}</p>
      </div>

      <!-- Social Share -->
      <div class="social-share">
        <a href="#" class="social-btn" aria-label="Share on Facebook" title="Facebook">f</a>
        <a href="#" class="social-btn" aria-label="Share on Twitter" title="Twitter">X</a>
        <a href="#" class="social-btn" aria-label="Share via Email" title="Email">&#9993;</a>
        <a href="#" class="social-btn" aria-label="Share on WhatsApp" title="WhatsApp">W</a>
        <a href="#" class="social-btn" aria-label="Share on Pinterest" title="Pinterest">P</a>
      </div>

    </div>
  </div>
</div>

<!-- Description Tab -->
<div class="product-tabs-section">
  <div class="tab-buttons">
    <button class="tab-btn active" data-tab="description">DESCRIPTION</button>
  </div>
  <div class="tab-panel active" id="tab-description">
    <p>{description}</p>
    <ul style="list-style:disc; padding-left:24px; margin-top:12px;">
      <li>100% authentic USPS Forever stamps</li>
      <li>Self-adhesive &ndash; no licking required</li>
      <li>Never expires &ndash; valid regardless of price increases</li>
      <li>Perfect for everyday mailing, invitations, greeting cards</li>
    </ul>
  </div>
</div>

<!-- Related Products -->
<div class="related-section">
  <h2 class="related-title">Related Products</h2>
  <div class="related-grid">{related_html}
  </div>
</div>

<!-- Footer -->
<footer>
  <div class="footer-content">
    <div class="footer-columns">
      <div class="footer-column">
        <h3>INFORMATION</h3>
        <div class="footer-divider"></div>
        <ul>
          <li><a href="#">Privacy Policy</a></li>
          <li><a href="#">Shipping Policy</a></li>
          <li><a href="#">Refund and Return Policy</a></li>
          <li><a href="#">Terms of Service</a></li>
          <li><a href="#">Billings Terms and Condition</a></li>
        </ul>
      </div>
      <div class="footer-column">
        <h3>NEED HELP</h3>
        <div class="footer-divider"></div>
        <ul>
          <li><a href="#">About Us</a></li>
          <li><a href="#">Track Order</a></li>
          <li><a href="#">Contact Us</a></li>
          <li><a href="#">FAQs</a></li>
        </ul>
      </div>
      <div class="footer-column">
        <h3>CONTACT</h3>
        <div class="footer-divider"></div>
        <div class="contact-info">
          <p><strong>EDDM LLC</strong></p>
          <p><strong>Email:</strong> support@eddm.shop</p>
          <p><strong>Phone:</strong> (970) 329-9777</p>
          <p><strong>Address:</strong> 3605 Avalon St, Philadelphia, PA 19114</p>
        </div>
      </div>
    </div>
  </div>
  <div class="footer-bottom">
    <div class="payment-icons">
      <span>PayPal</span>
      <span>Stripe</span>
      <span>VISA</span>
      <span>MasterCard</span>
      <span>Cash on Delivery</span>
    </div>
    <div class="copyright">Copyright 2026 &copy; <strong>eddm.shop</strong></div>
  </div>
</footer>

<button class="back-to-top" id="back-to-top" aria-label="Go to top">&#9650;</button>

<script src="../../js/common.js"></script>
<script>
(function () {{
  // Gallery Slider
  var galleryImages = ['{img1_full}', '{img2_full}'];
  var currentIndex = 0;
  var mainImg = document.getElementById("gallery-main-img");
  var thumbs = document.querySelectorAll(".gallery-thumb");
  var prevBtn = document.getElementById("gallery-prev");
  var nextBtn = document.getElementById("gallery-next");

  function showSlide(idx) {{
    if (galleryImages.length === 0) return;
    currentIndex = (idx + galleryImages.length) % galleryImages.length;
    mainImg.src = galleryImages[currentIndex];
    thumbs.forEach(function(t, i) {{
      t.classList.toggle("active", i === currentIndex);
    }});
  }}

  thumbs.forEach(function(thumb) {{
    thumb.addEventListener("click", function() {{
      showSlide(parseInt(this.getAttribute("data-index")));
    }});
  }});
  if (prevBtn) prevBtn.addEventListener("click", function() {{ showSlide(currentIndex - 1); }});
  if (nextBtn) nextBtn.addEventListener("click", function() {{ showSlide(currentIndex + 1); }});

  // Discount Price Helpers
  var BASE_PRICE = {base_price:.2f};
  var discountRows = document.querySelectorAll('.discount-table tbody tr');

  function getDiscountPrice(qty) {{
    var price = BASE_PRICE;
    discountRows.forEach(function(row) {{
      var min = parseInt(row.getAttribute('data-qty-min'));
      var maxAttr = row.getAttribute('data-qty-max');
      var max = maxAttr ? parseInt(maxAttr) : Infinity;
      var rowPrice = parseFloat(row.getAttribute('data-price'));
      if (qty >= min && qty <= max) {{
        price = rowPrice;
      }}
    }});
    return price;
  }}

  function fmt(n) {{ return "$" + n.toFixed(2); }}

  function updatePriceByQty() {{
    var qty = parseInt(document.getElementById('qty-input').value) || 1;
    var price = getDiscountPrice(qty);
    discountRows.forEach(function(row) {{
      row.classList.remove('active-row');
      var min = parseInt(row.getAttribute('data-qty-min'));
      var maxAttr = row.getAttribute('data-qty-max');
      var max = maxAttr ? parseInt(maxAttr) : Infinity;
      if (qty >= min && qty <= max) {{
        row.classList.add('active-row');
      }}
    }});
    var priceEl = document.querySelector('.selected-price');
    var mainPriceEl = document.querySelector('.product-price-main');
    var priceHtml;
    if (price < BASE_PRICE) {{
      priceHtml = '<del class="original-price">' + fmt(BASE_PRICE) + '</del> <span class="sale-price">' + fmt(price) + '</span>';
    }} else {{
      priceHtml = fmt(BASE_PRICE);
    }}
    if (priceEl) priceEl.innerHTML = priceHtml;
    if (mainPriceEl) mainPriceEl.innerHTML = priceHtml;
  }}

  // Quantity Stepper
  document.getElementById("qty-minus").addEventListener("click", function() {{
    var input = document.getElementById("qty-input");
    var val = parseInt(input.value) || 1;
    if (val > 1) {{ input.value = val - 1; }}
    updatePriceByQty();
  }});
  document.getElementById("qty-plus").addEventListener("click", function() {{
    var input = document.getElementById("qty-input");
    var val = parseInt(input.value) || 1;
    input.value = val + 1;
    updatePriceByQty();
  }});
  document.getElementById("qty-input").addEventListener("input", function() {{
    updatePriceByQty();
  }});

  // Add to Cart
  document.getElementById("add-to-cart-btn").addEventListener("click", function() {{
    var qty = parseInt(document.getElementById("qty-input").value) || 1;
    var productId = "{slug}";
    var productName = "{name.replace('"', '\\"')}";
    var productPrice = getDiscountPrice(qty);
    var productImage = galleryImages[0];
    for (var i = 0; i < qty; i++) {{
      addToCart(productId, productName, productPrice, productImage);
    }}
  }});

  // Variation toggle & clear
  document.getElementById("variation-btn-1").addEventListener("click", function() {{
    this.classList.add("active");
    document.getElementById("variation-selected").textContent = "5 Sheets of 20 (100 Stamps)";
    var priceEl = document.querySelector(".selected-price");
    if (priceEl) priceEl.style.display = "";
  }});
  document.getElementById("variation-clear").addEventListener("click", function() {{
    document.querySelectorAll(".variation-btn").forEach(function(b) {{ b.classList.remove("active"); }});
    document.getElementById("variation-selected").textContent = "";
    var priceEl = document.querySelector(".selected-price");
    if (priceEl) priceEl.style.display = "none";
  }});

  // Tabs
  document.querySelectorAll(".tab-btn").forEach(function(btn) {{
    btn.addEventListener("click", function() {{
      var tab = this.getAttribute("data-tab");
      document.querySelectorAll(".tab-btn").forEach(function(b) {{ b.classList.remove("active"); }});
      document.querySelectorAll(".tab-panel").forEach(function(p) {{ p.classList.remove("active"); }});
      this.classList.add("active");
      var panel = document.getElementById("tab-" + tab);
      if (panel) {{ panel.classList.add("active"); }}
    }});
  }});

  // Discount table row click - set quantity and update price
  discountRows.forEach(function(row) {{
    row.addEventListener("click", function() {{
      var minQty = parseInt(this.getAttribute("data-qty-min"));
      if (minQty) {{
        var input = document.getElementById("qty-input");
        if (input) input.value = minQty;
        updatePriceByQty();
      }}
    }});
  }});

  // Initialize price display on page load
  updatePriceByQty();
}}());
</script>

</body>
</html>"""
    return page_html


def main():
    print("=" * 60)
    print("商品详情页面生成脚本")
    print("=" * 60)

    # Step 1: 扫描所有分类页面
    print("\n[1/4] 扫描分类页面...")
    category_files = find_category_html_files()
    print(f"  找到 {len(category_files)} 个分类HTML文件")

    # Step 2: 提取所有商品信息
    print("\n[2/4] 提取商品信息...")
    all_products = []
    all_products_by_slug = {}

    for filepath in category_files:
        products = extract_products_from_html(filepath)
        rel_path = os.path.relpath(filepath, REPO_DIR)
        if products:
            print(f"  {rel_path}: {len(products)} 个商品")
        for p in products:
            all_products.append(p)
            slug = p["slug"]
            if slug not in all_products_by_slug:
                all_products_by_slug[slug] = []
            all_products_by_slug[slug].append(p)

    # 去重（保留第一个出现的）
    unique_products = {}
    for p in all_products:
        if p["slug"] not in unique_products:
            unique_products[p["slug"]] = p

    print(f"\n  总计: {len(all_products)} 个商品卡片")
    print(f"  唯一商品: {len(unique_products)} 个")

    # Step 3: 生成商品详情页
    print("\n[3/4] 生成商品详情页...")
    generated = 0
    skipped = 0

    for slug, product_data in sorted(unique_products.items()):
        product_dir = os.path.join(PRODUCT_DIR, slug)
        product_file = os.path.join(product_dir, "index.html")

        # 创建目录
        os.makedirs(product_dir, exist_ok=True)

        # 生成页面
        page_html = generate_product_page(
            product_data, all_products, all_products_by_slug
        )

        with open(product_file, "w", encoding="utf-8") as f:
            f.write(page_html)

        generated += 1

    print(f"  生成: {generated} 个页面")
    print(f"  跳过: {skipped} 个页面")

    # Step 4: 保存商品数据JSON（供参考）
    print("\n[4/4] 保存商品数据...")
    products_json = []
    for slug, p in sorted(unique_products.items()):
        categories = determine_categories_for_product(
            slug, p["name"], all_products_by_slug
        )
        products_json.append(
            {
                "slug": slug,
                "name": p["name"],
                "category": p["category"],
                "all_categories": categories,
                "price": p["price"],
                "img1": p["img1"],
                "img2": p["img2"],
                "sku": generate_sku(slug),
                "stock": generate_stock(slug),
            }
        )

    json_path = os.path.join(REPO_DIR, "products_data.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(products_json, f, ensure_ascii=False, indent=2)
    print(f"  数据保存到: {json_path}")

    print("\n" + "=" * 60)
    print(f"完成! 共生成 {generated} 个商品详情页面")
    print("=" * 60)


if __name__ == "__main__":
    main()
