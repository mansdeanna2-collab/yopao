<?php
/**
 * MySQL Database Configuration
 *
 * Configure your MySQL connection here, or set environment variables:
 *   DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS
 *
 * IMPORTANT: Set the DB_PASS environment variable before running:
 *   export DB_PASS="your_database_password"
 */

define('DB_HOST', getenv('DB_HOST') ?: '127.0.0.1');
define('DB_PORT', getenv('DB_PORT') ?: '3306');
define('DB_NAME', getenv('DB_NAME') ?: 'yopao');
define('DB_USER', getenv('DB_USER') ?: 'yopao');
define('DB_PASS', getenv('DB_PASS') ?: 'LmczwhREFaEdF8FK');
define('DB_CHARSET', 'utf8mb4');

/**
 * Get a PDO database connection.
 *
 * @return PDO
 */
function getDBConnection() {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];
        $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
    }
    return $pdo;
}
