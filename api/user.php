<?php
/**
 * User Data API
 *
 * Endpoints:
 *   POST /api/user.php?action=sync_cart       — Save/sync cart items for a user
 *   POST /api/user.php?action=get_cart         — Get cart items for a user
 *   POST /api/user.php?action=record_browse    — Record a product page view
 *   POST /api/user.php?action=create_order     — Create an order with line items
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/../db/config.php';

$action = isset($_GET['action']) ? $_GET['action'] : '';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Only POST requests are allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    $input = $_POST;
}

// Validate user_id is present and is a positive integer
$userId = isset($input['user_id']) ? (int)$input['user_id'] : 0;
if ($userId <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'A valid user_id is required.']);
    exit;
}

try {
    $pdo = getDBConnection();

    // Verify user exists
    $stmt = $pdo->prepare('SELECT id FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    if (!$stmt->fetch()) {
        http_response_code(404);
        echo json_encode(['error' => 'User not found.']);
        exit;
    }

    switch ($action) {
        case 'sync_cart':
            handleSyncCart($pdo, $userId, $input);
            break;
        case 'get_cart':
            handleGetCart($pdo, $userId);
            break;
        case 'record_browse':
            handleRecordBrowse($pdo, $userId, $input);
            break;
        case 'create_order':
            handleCreateOrder($pdo, $userId, $input);
            break;
        case 'save_address':
            handleSaveAddress($pdo, $userId, $input);
            break;
        case 'get_address':
            handleGetAddress($pdo, $userId);
            break;
        default:
            http_response_code(400);
            echo json_encode(['error' => 'Invalid action.']);
            break;
    }
} catch (PDOException $e) {
    error_log('User API database error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Database error. Please try again later.']);
}

/**
 * Sync cart: replace all cart items for the user with the provided list.
 */
function handleSyncCart($pdo, $userId, $input) {
    $items = isset($input['items']) && is_array($input['items']) ? $input['items'] : [];

    $pdo->beginTransaction();
    try {
        // Clear existing cart
        $stmt = $pdo->prepare('DELETE FROM user_cart WHERE user_id = ?');
        $stmt->execute([$userId]);

        // Insert new items
        if (!empty($items)) {
            $stmt = $pdo->prepare(
                'INSERT INTO user_cart (user_id, product_id, product_name, price, qty, image) VALUES (?, ?, ?, ?, ?, ?)'
            );
            foreach ($items as $item) {
                $productId   = isset($item['id']) ? substr(trim($item['id']), 0, 255) : '';
                $productName = isset($item['name']) ? substr(trim($item['name']), 0, 500) : '';
                $price       = isset($item['price']) ? (float)$item['price'] : 0;
                $qty         = isset($item['qty']) ? max(1, (int)$item['qty']) : 1;
                $image       = isset($item['image']) ? substr(trim($item['image']), 0, 500) : '';

                if ($productId === '' || $productName === '') continue;

                $stmt->execute([$userId, $productId, $productName, $price, $qty, $image]);
            }
        }

        $pdo->commit();
        echo json_encode(['success' => true]);
    } catch (PDOException $e) {
        $pdo->rollBack();
        throw $e;
    }
}

/**
 * Get cart items for a user.
 */
function handleGetCart($pdo, $userId) {
    $stmt = $pdo->prepare('SELECT product_id AS id, product_name AS name, price, qty, image FROM user_cart WHERE user_id = ? ORDER BY updated_at DESC');
    $stmt->execute([$userId]);
    $items = $stmt->fetchAll();

    // Ensure correct types
    foreach ($items as &$item) {
        $item['price'] = (float)$item['price'];
        $item['qty']   = (int)$item['qty'];
    }

    echo json_encode(['success' => true, 'items' => $items]);
}

/**
 * Record a product page view in browsing history.
 */
function handleRecordBrowse($pdo, $userId, $input) {
    $slug = isset($input['product_slug']) ? substr(trim($input['product_slug']), 0, 255) : '';
    $name = isset($input['product_name']) ? substr(trim($input['product_name']), 0, 500) : '';

    if ($slug === '') {
        http_response_code(400);
        echo json_encode(['error' => 'product_slug is required.']);
        return;
    }

    $stmt = $pdo->prepare('INSERT INTO browsing_history (user_id, product_slug, product_name) VALUES (?, ?, ?)');
    $stmt->execute([$userId, $slug, $name]);

    echo json_encode(['success' => true]);
}

/**
 * Create an order with line items.
 */
function handleCreateOrder($pdo, $userId, $input) {
    $orderId   = isset($input['order_id']) ? preg_replace('/[^a-zA-Z0-9]/', '', substr($input['order_id'], 0, 50)) : '';
    $email     = isset($input['email']) ? substr(trim($input['email']), 0, 255) : '';
    $firstName = isset($input['first_name']) ? substr(trim($input['first_name']), 0, 100) : '';
    $lastName  = isset($input['last_name']) ? substr(trim($input['last_name']), 0, 100) : '';
    $address   = isset($input['address']) ? substr(trim($input['address']), 0, 500) : '';
    $city      = isset($input['city']) ? substr(trim($input['city']), 0, 100) : '';
    $state     = isset($input['state']) ? substr(trim($input['state']), 0, 100) : '';
    $postcode  = isset($input['postcode']) ? substr(trim($input['postcode']), 0, 20) : '';
    $total     = isset($input['total']) ? (float)$input['total'] : 0;
    $items     = isset($input['items']) && is_array($input['items']) ? $input['items'] : [];

    if ($orderId === '' || $email === '' || $firstName === '' || $lastName === '' || $address === '' || $city === '' || $postcode === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Missing required order fields.']);
        return;
    }

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare(
            'INSERT INTO orders (order_id, user_id, email, first_name, last_name, address, city, state, postcode, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([$orderId, $userId, $email, $firstName, $lastName, $address, $city, $state, $postcode, $total]);

        if (!empty($items)) {
            $stmt = $pdo->prepare(
                'INSERT INTO order_items (order_id, product_id, product_name, price, qty) VALUES (?, ?, ?, ?, ?)'
            );
            foreach ($items as $item) {
                $productId   = isset($item['id']) ? substr(trim($item['id']), 0, 255) : '';
                $productName = isset($item['name']) ? substr(trim($item['name']), 0, 500) : '';
                $price       = isset($item['price']) ? (float)$item['price'] : 0;
                $qty         = isset($item['qty']) ? max(1, (int)$item['qty']) : 1;
                if ($productId === '') continue;
                $stmt->execute([$orderId, $productId, $productName, $price, $qty]);
            }
        }

        // Clear user's cart after order is placed
        $stmt = $pdo->prepare('DELETE FROM user_cart WHERE user_id = ?');
        $stmt->execute([$userId]);

        // Auto-save address from order
        saveAddressFromOrder($pdo, $userId, $input);

        $pdo->commit();
        echo json_encode(['success' => true, 'order_id' => $orderId]);
    } catch (PDOException $e) {
        $pdo->rollBack();
        throw $e;
    }
}

/**
 * Parse and sanitize address fields from input.
 */
function parseAddressInput($input) {
    return [
        'first_name' => isset($input['first_name']) ? substr(trim($input['first_name']), 0, 100) : '',
        'last_name'  => isset($input['last_name']) ? substr(trim($input['last_name']), 0, 100) : '',
        'address'    => isset($input['address']) ? substr(trim($input['address']), 0, 500) : '',
        'address_2'  => isset($input['address_2']) ? substr(trim($input['address_2']), 0, 500) : '',
        'city'       => isset($input['city']) ? substr(trim($input['city']), 0, 100) : '',
        'state'      => isset($input['state']) ? substr(trim($input['state']), 0, 100) : '',
        'postcode'   => isset($input['postcode']) ? substr(trim($input['postcode']), 0, 20) : '',
        'phone'      => isset($input['phone']) ? substr(trim($input['phone']), 0, 50) : '',
        'email'      => isset($input['email']) ? substr(trim($input['email']), 0, 255) : '',
    ];
}

/**
 * Upsert a user's default address.
 */
function upsertDefaultAddress($pdo, $userId, $addr) {
    $stmt = $pdo->prepare('SELECT id FROM user_addresses WHERE user_id = ? AND is_default = 1 LIMIT 1');
    $stmt->execute([$userId]);
    $existing = $stmt->fetch();

    if ($existing) {
        $stmt = $pdo->prepare(
            'UPDATE user_addresses SET first_name=?, last_name=?, address=?, address_2=?, city=?, state=?, postcode=?, phone=?, email=? WHERE id=?'
        );
        $stmt->execute([$addr['first_name'], $addr['last_name'], $addr['address'], $addr['address_2'], $addr['city'], $addr['state'], $addr['postcode'], $addr['phone'], $addr['email'], $existing['id']]);
    } else {
        $stmt = $pdo->prepare(
            'INSERT INTO user_addresses (user_id, first_name, last_name, address, address_2, city, state, postcode, phone, email, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)'
        );
        $stmt->execute([$userId, $addr['first_name'], $addr['last_name'], $addr['address'], $addr['address_2'], $addr['city'], $addr['state'], $addr['postcode'], $addr['phone'], $addr['email']]);
    }
}

/**
 * Save or update a user's default address from order data.
 */
function saveAddressFromOrder($pdo, $userId, $input) {
    $addr = parseAddressInput($input);
    if ($addr['first_name'] === '' || $addr['address'] === '' || $addr['city'] === '' || $addr['postcode'] === '') {
        error_log('saveAddressFromOrder: skipped — missing required fields for user_id=' . $userId);
        return;
    }
    upsertDefaultAddress($pdo, $userId, $addr);
}

/**
 * Save a user's address.
 */
function handleSaveAddress($pdo, $userId, $input) {
    $addr = parseAddressInput($input);
    if ($addr['first_name'] === '' || $addr['address'] === '' || $addr['city'] === '' || $addr['postcode'] === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Missing required address fields (first_name, address, city, postcode).']);
        return;
    }
    upsertDefaultAddress($pdo, $userId, $addr);
    echo json_encode(['success' => true]);
}

/**
 * Get a user's default saved address.
 */
function handleGetAddress($pdo, $userId) {
    $stmt = $pdo->prepare('SELECT first_name, last_name, address, address_2, city, state, postcode, phone, email FROM user_addresses WHERE user_id = ? AND is_default = 1 LIMIT 1');
    $stmt->execute([$userId]);
    $address = $stmt->fetch();

    if ($address) {
        echo json_encode(['success' => true, 'address' => $address]);
    } else {
        echo json_encode(['success' => true, 'address' => null]);
    }
}
