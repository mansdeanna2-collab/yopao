<?php
/**
 * Admin API
 *
 * Endpoints:
 *   POST /api/admin.php?action=admin_login                    — Admin login (public)
 *   GET /api/admin.php?action=stats                           — Dashboard statistics
 *   GET /api/admin.php?action=products                        — List products (paginated)
 *   GET /api/admin.php?action=orders                          — List orders (paginated)
 *   GET /api/admin.php?action=users                           — List users (paginated)
 *   GET /api/admin.php?action=categories                      — List categories
 *   GET /api/admin.php?action=order_detail&id=XX              — Single order detail
 *   GET /api/admin.php?action=update_order_status&id=XX&status=YY — Update order status
 *   GET /api/admin.php?action=login_logs                      — List login logs (paginated)
 *   POST /api/admin.php?action=delete_order                   — Delete an order
 *   POST /api/admin.php?action=delete_user                    — Delete a user
 *
 * All endpoints except admin_login require a valid admin token
 * sent via the Authorization header: "Bearer <token>"
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/../db/config.php';

$action = isset($_GET['action']) ? $_GET['action'] : 'stats';

try {
    $pdo = getDBConnection();

    // Admin login is the only public endpoint
    if ($action === 'admin_login') {
        handleAdminLogin($pdo);
        exit;
    }

    // All other actions require admin authentication
    $admin = verifyAdminToken($pdo);
    if (!$admin) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized. Please log in as admin.']);
        exit;
    }

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
        case 'update_order_status':
            handleUpdateOrderStatus($pdo);
            break;
        case 'login_logs':
            handleLoginLogs($pdo);
            break;
        case 'delete_order':
            handleDeleteOrder($pdo);
            break;
        case 'delete_user':
            handleDeleteUser($pdo);
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

/* ========== Admin Authentication ========== */

/**
 * Handle admin login. Accepts POST with JSON body { username, password }.
 */
function handleAdminLogin($pdo) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'Only POST requests are allowed for login.']);
        return;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $username = isset($input['username']) ? trim($input['username']) : '';
    $password = isset($input['password']) ? $input['password'] : '';

    if ($username === '' || $password === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Username and password are required.']);
        return;
    }

    $stmt = $pdo->prepare('SELECT id, username, password_hash FROM admin_users WHERE username = ?');
    $stmt->execute([$username]);
    $admin = $stmt->fetch();

    if (!$admin || !password_verify($password, $admin['password_hash'])) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid username or password.']);
        return;
    }

    // Generate a secure random token
    $token = bin2hex(random_bytes(32));
    $expiresAt = date('Y-m-d H:i:s', time() + 86400); // 24 hours

    // Clean up expired sessions
    $pdo->exec('DELETE FROM admin_sessions WHERE expires_at < NOW()');

    // Insert new session
    $stmt = $pdo->prepare('INSERT INTO admin_sessions (admin_id, token, expires_at) VALUES (?, ?, ?)');
    $stmt->execute([$admin['id'], $token, $expiresAt]);

    echo json_encode([
        'success' => true,
        'token'   => $token,
        'admin'   => [
            'id'       => (int)$admin['id'],
            'username' => $admin['username']
        ]
    ]);
}

/**
 * Verify admin token from Authorization header.
 * Returns admin user array on success, false on failure.
 */
function verifyAdminToken($pdo) {
    $authHeader = '';
    if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
    } elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $authHeader = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    } elseif (function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        if (isset($headers['Authorization'])) {
            $authHeader = $headers['Authorization'];
        }
    }

    if ($authHeader === '' || strpos($authHeader, 'Bearer ') !== 0) {
        return false;
    }

    $token = substr($authHeader, 7);
    if (strlen($token) !== 64 || !ctype_xdigit($token)) {
        return false;
    }

    $stmt = $pdo->prepare('SELECT s.admin_id, a.username FROM admin_sessions s JOIN admin_users a ON a.id = s.admin_id WHERE s.token = ? AND s.expires_at > NOW()');
    $stmt->execute([$token]);
    $session = $stmt->fetch();

    return $session ?: false;
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
        COUNT(DISTINCT o.id) AS order_count,
        COUNT(DISTINCT l.id) AS login_count
        FROM users u
        LEFT JOIN orders o ON o.user_id = u.id
        LEFT JOIN login_logs l ON l.user_id = u.id
        GROUP BY u.id
        ORDER BY u.created_at DESC LIMIT ? OFFSET ?');
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

/**
 * Update order status.
 */
function handleUpdateOrderStatus($pdo) {
    $orderId = isset($_GET['id']) ? trim($_GET['id']) : '';
    $newStatus = isset($_GET['status']) ? trim($_GET['status']) : '';

    if ($orderId === '' || $newStatus === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Missing id or status parameter']);
        return;
    }

    // Only allow valid status values
    $allowed = ['pending', 'shipped', 'completed', 'cancelled'];
    if (!in_array($newStatus, $allowed, true)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid status value']);
        return;
    }

    $stmt = $pdo->prepare('UPDATE orders SET status = ? WHERE order_id = ?');
    $stmt->execute([$newStatus, $orderId]);

    if ($stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(['error' => 'Order not found']);
        return;
    }

    echo json_encode(['success' => true]);
}

/**
 * List login logs with pagination.
 */
function handleLoginLogs($pdo) {
    $page = max(1, isset($_GET['page']) ? (int)$_GET['page'] : 1);
    $limit = 30;
    $offset = ($page - 1) * $limit;

    $stmt = $pdo->query('SELECT COUNT(*) AS cnt FROM login_logs');
    $total = (int)$stmt->fetch()['cnt'];

    $stmt = $pdo->prepare('SELECT l.id, l.user_id, u.email, l.ip_address, l.user_agent, l.login_at
        FROM login_logs l
        LEFT JOIN users u ON u.id = l.user_id
        ORDER BY l.login_at DESC LIMIT ? OFFSET ?');
    $stmt->execute([$limit, $offset]);
    $logs = $stmt->fetchAll();

    echo json_encode([
        'items' => $logs,
        'total' => $total,
        'page'  => $page,
        'pages' => max(1, ceil($total / $limit))
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

/**
 * Delete an order by order_id (POST with JSON body { order_id }).
 */
function handleDeleteOrder($pdo) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'Only POST requests are allowed.']);
        return;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $orderId = isset($input['order_id']) ? trim($input['order_id']) : '';

    if ($orderId === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Missing order_id parameter.']);
        return;
    }

    // order_items are automatically removed via CASCADE foreign key
    $stmt = $pdo->prepare('DELETE FROM orders WHERE order_id = ?');
    $stmt->execute([$orderId]);

    if ($stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(['error' => 'Order not found.']);
        return;
    }

    echo json_encode(['success' => true]);
}

/**
 * Delete a user by id (POST with JSON body { user_id }).
 */
function handleDeleteUser($pdo) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'Only POST requests are allowed.']);
        return;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $userId = isset($input['user_id']) ? (int)$input['user_id'] : 0;

    if ($userId <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing or invalid user_id parameter.']);
        return;
    }

    // The CASCADE foreign keys will clean up related records (login_logs, user_cart, browsing_history, user_addresses)
    $stmt = $pdo->prepare('DELETE FROM users WHERE id = ?');
    $stmt->execute([$userId]);

    if ($stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(['error' => 'User not found.']);
        return;
    }

    echo json_encode(['success' => true]);
}
