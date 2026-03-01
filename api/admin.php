<?php
/**
 * Admin API
 *
 * Endpoints:
 *   GET /api/admin.php?action=stats           — Dashboard statistics
 *   GET /api/admin.php?action=products        — List products (paginated)
 *   GET /api/admin.php?action=orders          — List orders (paginated)
 *   GET /api/admin.php?action=users           — List users (paginated)
 *   GET /api/admin.php?action=categories      — List categories
 *   GET /api/admin.php?action=order_detail&id=XX — Single order detail
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');

require_once __DIR__ . '/../db/config.php';

$action = isset($_GET['action']) ? $_GET['action'] : 'stats';

try {
    $pdo = getDBConnection();

    switch ($action) {
        case 'stats':
            handleStats($pdo);
            break;
        case 'products':
            handleProducts($pdo);
            break;
        case 'orders':
            handleOrders($pdo);
            break;
        case 'users':
            handleUsers($pdo);
            break;
        case 'categories':
            handleCategories($pdo);
            break;
        case 'order_detail':
            handleOrderDetail($pdo);
            break;
        default:
            http_response_code(400);
            echo json_encode(['error' => 'Invalid action.']);
            break;
    }
} catch (PDOException $e) {
    error_log('Admin API database error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed. Please check db/config.php settings.']);
}

/**
 * Dashboard statistics.
 */
function handleStats($pdo) {
    $stats = [];

    $stmt = $pdo->query('SELECT COUNT(*) AS cnt FROM products');
    $stats['total_products'] = (int)$stmt->fetch()['cnt'];

    $stmt = $pdo->query('SELECT COUNT(*) AS cnt FROM orders');
    $stats['total_orders'] = (int)$stmt->fetch()['cnt'];

    $stmt = $pdo->query('SELECT COUNT(*) AS cnt FROM users');
    $stats['total_users'] = (int)$stmt->fetch()['cnt'];

    $stmt = $pdo->query('SELECT COUNT(*) AS cnt FROM categories');
    $stats['total_categories'] = (int)$stmt->fetch()['cnt'];

    $stmt = $pdo->query('SELECT COALESCE(SUM(total), 0) AS revenue FROM orders');
    $stats['total_revenue'] = (float)$stmt->fetch()['revenue'];

    $stmt = $pdo->query("SELECT COUNT(*) AS cnt FROM orders WHERE status = 'pending'");
    $stats['pending_orders'] = (int)$stmt->fetch()['cnt'];

    $stmt = $pdo->query('SELECT id, order_id, email, total, status, created_at FROM orders ORDER BY created_at DESC LIMIT 5');
    $stats['recent_orders'] = $stmt->fetchAll();

    $stmt = $pdo->query('SELECT id, email, created_at FROM users ORDER BY created_at DESC LIMIT 5');
    $stats['recent_users'] = $stmt->fetchAll();

    echo json_encode($stats, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

/**
 * List products with pagination and search.
 */
function handleProducts($pdo) {
    $page = max(1, isset($_GET['page']) ? (int)$_GET['page'] : 1);
    $limit = 20;
    $offset = ($page - 1) * $limit;
    $search = isset($_GET['q']) ? trim($_GET['q']) : '';

    if ($search !== '') {
        $safeQ = str_replace(['%', '_'], ['\\%', '\\_'], $search);
        $like = '%' . $safeQ . '%';

        $stmt = $pdo->prepare('SELECT COUNT(*) AS cnt FROM products WHERE name LIKE ?');
        $stmt->execute([$like]);
        $total = (int)$stmt->fetch()['cnt'];

        $stmt = $pdo->prepare('SELECT id, slug, name, sku, price, stock, img1 FROM products WHERE name LIKE ? ORDER BY id DESC LIMIT ? OFFSET ?');
        $stmt->execute([$like, $limit, $offset]);
    } else {
        $stmt = $pdo->query('SELECT COUNT(*) AS cnt FROM products');
        $total = (int)$stmt->fetch()['cnt'];

        $stmt = $pdo->prepare('SELECT id, slug, name, sku, price, stock, img1 FROM products ORDER BY id DESC LIMIT ? OFFSET ?');
        $stmt->execute([$limit, $offset]);
    }

    $products = $stmt->fetchAll();
    foreach ($products as &$p) {
        $p['price'] = '$' . number_format((float)$p['price'], 2);
    }

    echo json_encode([
        'items' => $products,
        'total' => $total,
        'page'  => $page,
        'pages' => max(1, ceil($total / $limit))
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

/**
 * List orders with pagination.
 */
function handleOrders($pdo) {
    $page = max(1, isset($_GET['page']) ? (int)$_GET['page'] : 1);
    $limit = 20;
    $offset = ($page - 1) * $limit;
    $status = isset($_GET['status']) ? trim($_GET['status']) : '';

    if ($status !== '') {
        $stmt = $pdo->prepare('SELECT COUNT(*) AS cnt FROM orders WHERE status = ?');
        $stmt->execute([$status]);
        $total = (int)$stmt->fetch()['cnt'];

        $stmt = $pdo->prepare('SELECT id, order_id, user_id, email, first_name, last_name, total, status, created_at FROM orders WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?');
        $stmt->execute([$status, $limit, $offset]);
    } else {
        $stmt = $pdo->query('SELECT COUNT(*) AS cnt FROM orders');
        $total = (int)$stmt->fetch()['cnt'];

        $stmt = $pdo->prepare('SELECT id, order_id, user_id, email, first_name, last_name, total, status, created_at FROM orders ORDER BY created_at DESC LIMIT ? OFFSET ?');
        $stmt->execute([$limit, $offset]);
    }

    $orders = $stmt->fetchAll();

    echo json_encode([
        'items' => $orders,
        'total' => $total,
        'page'  => $page,
        'pages' => max(1, ceil($total / $limit))
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

/**
 * List users with pagination.
 */
function handleUsers($pdo) {
    $page = max(1, isset($_GET['page']) ? (int)$_GET['page'] : 1);
    $limit = 20;
    $offset = ($page - 1) * $limit;

    $stmt = $pdo->query('SELECT COUNT(*) AS cnt FROM users');
    $total = (int)$stmt->fetch()['cnt'];

    $stmt = $pdo->prepare('SELECT u.id, u.email, u.register_ip, u.created_at,
        (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS order_count,
        (SELECT COUNT(*) FROM login_logs l WHERE l.user_id = u.id) AS login_count
        FROM users u ORDER BY u.created_at DESC LIMIT ? OFFSET ?');
    $stmt->execute([$limit, $offset]);
    $users = $stmt->fetchAll();

    echo json_encode([
        'items' => $users,
        'total' => $total,
        'page'  => $page,
        'pages' => max(1, ceil($total / $limit))
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

/**
 * List categories.
 */
function handleCategories($pdo) {
    $stmt = $pdo->query('SELECT c.id, c.slug, c.name, c.image, c.product_count,
        (SELECT COUNT(*) FROM product_categories pc WHERE pc.category_id = c.id) AS actual_count
        FROM categories c ORDER BY c.name');
    $categories = $stmt->fetchAll();

    echo json_encode($categories, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

/**
 * Get single order detail with line items.
 */
function handleOrderDetail($pdo) {
    $orderId = isset($_GET['id']) ? trim($_GET['id']) : '';
    if ($orderId === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Missing id parameter']);
        return;
    }

    $stmt = $pdo->prepare('SELECT * FROM orders WHERE order_id = ?');
    $stmt->execute([$orderId]);
    $order = $stmt->fetch();

    if (!$order) {
        http_response_code(404);
        echo json_encode(['error' => 'Order not found']);
        return;
    }

    $stmt = $pdo->prepare('SELECT product_id, product_name, price, qty FROM order_items WHERE order_id = ?');
    $stmt->execute([$orderId]);
    $order['items'] = $stmt->fetchAll();

    echo json_encode($order, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
