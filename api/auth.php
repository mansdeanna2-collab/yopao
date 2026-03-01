<?php
/**
 * Authentication API
 *
 * Endpoints:
 *   POST /api/auth.php?action=register   — Register a new user (email, password)
 *   POST /api/auth.php?action=login      — Log in (email, password), records IP
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

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

try {
    $pdo = getDBConnection();

    switch ($action) {
        case 'register':
            handleRegister($pdo, $input);
            break;
        case 'login':
            handleLogin($pdo, $input);
            break;
        default:
            http_response_code(400);
            echo json_encode(['error' => 'Invalid action. Use action=register or action=login']);
            break;
    }
} catch (PDOException $e) {
    error_log('Auth API database error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Database error. Please try again later.']);
}

/**
 * Register a new user.
 */
function handleRegister($pdo, $input) {
    $email    = isset($input['email']) ? trim($input['email']) : '';
    $password = isset($input['password']) ? $input['password'] : '';

    // Validate email
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['error' => 'A valid email address is required.']);
        return;
    }

    // Validate password
    if (strlen($password) < 8) {
        http_response_code(400);
        echo json_encode(['error' => 'Password must be at least 8 characters.']);
        return;
    }

    // Check if email already exists
    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ?');
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
        http_response_code(409);
        echo json_encode(['error' => 'An account with this email already exists.']);
        return;
    }

    // Hash password and insert user
    $hash = password_hash($password, PASSWORD_DEFAULT);

    $stmt = $pdo->prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)');
    $stmt->execute([$email, $hash]);

    echo json_encode(['success' => true, 'message' => 'Account created successfully!']);
}

/**
 * Log in an existing user and record the login IP.
 */
function handleLogin($pdo, $input) {
    $email    = isset($input['email']) ? trim($input['email']) : '';
    $password = isset($input['password']) ? $input['password'] : '';

    if ($email === '' || $password === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Email and password are required.']);
        return;
    }

    // Look up user
    $stmt = $pdo->prepare('SELECT id, email, password_hash FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid email or password.']);
        return;
    }

    // Record login IP
    $ip = getClientIp();
    $userAgent = isset($_SERVER['HTTP_USER_AGENT']) ? substr($_SERVER['HTTP_USER_AGENT'], 0, 500) : '';

    $stmt = $pdo->prepare('INSERT INTO login_logs (user_id, ip_address, user_agent) VALUES (?, ?, ?)');
    $stmt->execute([$user['id'], $ip, $userAgent]);

    echo json_encode([
        'success' => true,
        'message' => 'Login successful!',
        'user'    => [
            'id'    => (int)$user['id'],
            'email' => $user['email']
        ]
    ]);
}

/**
 * Get the client's real IP address.
 */
function getClientIp() {
    if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $ips = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
        $ip = trim($ips[0]);
        if (filter_var($ip, FILTER_VALIDATE_IP)) {
            return $ip;
        }
    }
    if (!empty($_SERVER['HTTP_X_REAL_IP'])) {
        $ip = trim($_SERVER['HTTP_X_REAL_IP']);
        if (filter_var($ip, FILTER_VALIDATE_IP)) {
            return $ip;
        }
    }
    return isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '0.0.0.0';
}
