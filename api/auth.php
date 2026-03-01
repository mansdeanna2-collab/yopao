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

    // Reject excessively long email
    if (strlen($email) > 255) {
        http_response_code(400);
        echo json_encode(['error' => 'Email address is too long.']);
        return;
    }

    // Validate password (must match frontend rules in js/auth.js)
    if (strlen($password) < 8) {
        http_response_code(400);
        echo json_encode(['error' => 'Password must be at least 8 characters.']);
        return;
    }
    if (!preg_match('/[A-Z]/', $password)) {
        http_response_code(400);
        echo json_encode(['error' => 'Password must include at least one uppercase letter.']);
        return;
    }
    if (!preg_match('/[a-z]/', $password)) {
        http_response_code(400);
        echo json_encode(['error' => 'Password must include at least one lowercase letter.']);
        return;
    }
    if (!preg_match('/\d/', $password)) {
        http_response_code(400);
        echo json_encode(['error' => 'Password must include at least one number.']);
        return;
    }
    if (!preg_match('/[^A-Za-z0-9]/', $password)) {
        http_response_code(400);
        echo json_encode(['error' => 'Password must include at least one special character.']);
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
    $registerIp = getClientIp();

    $stmt = $pdo->prepare('INSERT INTO users (email, password_hash, register_ip) VALUES (?, ?, ?)');
    $stmt->execute([$email, $hash, $registerIp]);

    $userId = (int)$pdo->lastInsertId();

    // Record login log for auto-login after registration
    $userAgent = isset($_SERVER['HTTP_USER_AGENT']) ? substr($_SERVER['HTTP_USER_AGENT'], 0, 500) : '';
    $stmt = $pdo->prepare('INSERT INTO login_logs (user_id, ip_address, user_agent) VALUES (?, ?, ?)');
    $stmt->execute([$userId, $registerIp, $userAgent]);

    echo json_encode([
        'success' => true,
        'message' => 'Account created successfully!',
        'user'    => [
            'id'    => $userId,
            'email' => $email
        ]
    ]);
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
 * Only trusts proxy headers when REMOTE_ADDR is a known private/loopback address,
 * indicating the request came through a trusted reverse proxy.
 */
function getClientIp() {
    $remoteAddr = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '0.0.0.0';

    // Only trust forwarded headers if the direct connection is from a private/loopback IP (i.e. a reverse proxy)
    $isTrustedProxy = filter_var($remoteAddr, FILTER_VALIDATE_IP, FILTER_FLAG_NO_RES_RANGE) === false;

    if ($isTrustedProxy) {
        if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            $ips = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
            $ip = trim($ips[0]);
            if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                return $ip;
            }
        }
        if (!empty($_SERVER['HTTP_X_REAL_IP'])) {
            $ip = trim($_SERVER['HTTP_X_REAL_IP']);
            if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                return $ip;
            }
        }
    }

    return $remoteAddr;
}
