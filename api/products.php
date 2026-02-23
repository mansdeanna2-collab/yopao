<?php
/**
 * Products API
 *
 * Endpoints:
 *   GET /api/products.php?action=list                        — All products
 *   GET /api/products.php?action=list&category=Flag+Series   — Filter by category name
 *   GET /api/products.php?action=get&slug=xxx                — Single product by slug
 *   GET /api/products.php?action=search&q=keyword            — Search products
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/../db/config.php';

// CDN base URL for product images (used when local files are missing)
define('IMAGE_CDN_BASE', 'https://eddm.shop/wp-content/uploads/2026/01/');

/**
 * Resolve an image path to a working URL.
 * If the local file exists, returns the local path.
 * Otherwise, returns the external CDN URL.
 */
function resolveImageUrl($path) {
    if (!$path || $path === '') return '';
    // Already an absolute URL — return as-is
    if (strpos($path, 'http://') === 0 || strpos($path, 'https://') === 0) {
        return $path;
    }
    // Local path like /images/products/filename.jpg
    if (strpos($path, '/images/products/') === 0) {
        $filename = basename($path);
        $localFile = __DIR__ . '/../images/products/' . $filename;
        if (file_exists($localFile) && filesize($localFile) > 0) {
            return $path;
        }
        return IMAGE_CDN_BASE . $filename;
    }
    return $path;
}

/**
 * Apply resolveImageUrl to all image fields in a product array.
 */
function resolveProductImages(&$product) {
    if (isset($product['img1'])) {
        $product['img1'] = resolveImageUrl($product['img1']);
    }
    if (isset($product['img2'])) {
        $product['img2'] = resolveImageUrl($product['img2']);
    }
    if (isset($product['images']) && is_array($product['images'])) {
        $product['images'] = array_map('resolveImageUrl', $product['images']);
    }
}

$action = isset($_GET['action']) ? $_GET['action'] : 'list';

try {
    $pdo = getDBConnection();

    switch ($action) {
        case 'get':
            handleGetProduct($pdo);
            break;
        case 'search':
            handleSearch($pdo);
            break;
        case 'list':
        default:
            handleListProducts($pdo);
            break;
    }
} catch (PDOException $e) {
    error_log('Products API database error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed. Please check db/config.php settings.']);
}

/**
 * List products, optionally filtered by category.
 */
function handleListProducts($pdo) {
    $category = isset($_GET['category']) ? trim($_GET['category']) : '';

    if ($category !== '') {
        $stmt = $pdo->prepare('
            SELECT DISTINCT p.id, p.slug, p.name, p.sku, p.price, p.stock,
                   p.description, p.img1, p.img2
            FROM products p
            JOIN product_categories pc ON p.id = pc.product_id
            JOIN categories c ON pc.category_id = c.id
            WHERE c.name = ?
            ORDER BY p.id
        ');
        $stmt->execute([$category]);
    } else {
        $stmt = $pdo->query('SELECT id, slug, name, sku, price, stock, description, img1, img2 FROM products ORDER BY id');
    }

    $products = $stmt->fetchAll();

    foreach ($products as &$product) {
        $product['price'] = '$' . number_format((float)$product['price'], 2);
        $product['images'] = getProductImages($pdo, $product['id']);
        $product['all_categories'] = getProductCategories($pdo, $product['id']);
        $product['category'] = !empty($product['all_categories']) ? $product['all_categories'][0] : '';
        resolveProductImages($product);
    }

    echo json_encode($products, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

/**
 * Get a single product by slug.
 */
function handleGetProduct($pdo) {
    $slug = isset($_GET['slug']) ? trim($_GET['slug']) : '';
    if ($slug === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Missing slug parameter']);
        return;
    }

    $stmt = $pdo->prepare('SELECT id, slug, name, sku, price, stock, description, img1, img2 FROM products WHERE slug = ?');
    $stmt->execute([$slug]);
    $product = $stmt->fetch();

    if (!$product) {
        http_response_code(404);
        echo json_encode(['error' => 'Product not found']);
        return;
    }

    $product['price'] = '$' . number_format((float)$product['price'], 2);
    $product['images'] = getProductImages($pdo, $product['id']);
    $product['all_categories'] = getProductCategories($pdo, $product['id']);
    $product['category'] = !empty($product['all_categories']) ? $product['all_categories'][0] : '';
    resolveProductImages($product);

    echo json_encode($product, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

/**
 * Search products by name.
 */
function handleSearch($pdo) {
    $q = isset($_GET['q']) ? trim($_GET['q']) : '';
    if ($q === '') {
        echo json_encode([]);
        return;
    }

    $stmt = $pdo->prepare('SELECT id, slug, name, sku, price, stock, description, img1, img2 FROM products WHERE name LIKE ? ORDER BY id LIMIT 50');
    $stmt->execute(['%' . $q . '%']);
    $products = $stmt->fetchAll();

    foreach ($products as &$product) {
        $product['price'] = '$' . number_format((float)$product['price'], 2);
        $product['images'] = getProductImages($pdo, $product['id']);
        $product['all_categories'] = getProductCategories($pdo, $product['id']);
        $product['category'] = !empty($product['all_categories']) ? $product['all_categories'][0] : '';
        resolveProductImages($product);
    }

    echo json_encode($products, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

/**
 * Get image URLs for a product.
 */
function getProductImages($pdo, $productId) {
    $stmt = $pdo->prepare('SELECT image_url FROM product_images WHERE product_id = ? ORDER BY sort_order');
    $stmt->execute([$productId]);
    return $stmt->fetchAll(PDO::FETCH_COLUMN);
}

/**
 * Get category names for a product.
 */
function getProductCategories($pdo, $productId) {
    $stmt = $pdo->prepare('SELECT c.name FROM categories c JOIN product_categories pc ON c.id = pc.category_id WHERE pc.product_id = ? ORDER BY c.name');
    $stmt->execute([$productId]);
    return $stmt->fetchAll(PDO::FETCH_COLUMN);
}
