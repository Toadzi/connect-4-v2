<?php

header('Content-Type: application/json');

function load_env_file($path) {
    if (!is_readable($path)) {
        return;
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $trimmed = trim($line);
        if ($trimmed === '' || str_starts_with($trimmed, '#')) {
            continue;
        }

        $separatorPosition = strpos($trimmed, '=');
        if ($separatorPosition === false) {
            continue;
        }

        $name = trim(substr($trimmed, 0, $separatorPosition));
        $value = trim(substr($trimmed, $separatorPosition + 1));
        $value = trim($value, "\"'");

        putenv($name . '=' . $value);
        $_ENV[$name] = $value;
        $_SERVER[$name] = $value;
    }
}

load_env_file(dirname(__DIR__) . '/.env');

function env_value($name, $default = null) {
    $value = getenv($name);
    if ($value === false || $value === '') {
        return $default;
    }

    return $value;
}

function json_input() {
    $data = json_decode(file_get_contents('php://input'), true);
    return is_array($data) ? $data : [];
}

function json_response($payload, $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode($payload);
    exit();
}

function db_connection() {
    $host = env_value('CONNECT4_DB_HOST', 'localhost');
    $user = env_value('CONNECT4_DB_USER');
    $password = env_value('CONNECT4_DB_PASSWORD');
    $database = env_value('CONNECT4_DB_NAME');

    if (!$user || !$password || !$database) {
        throw new RuntimeException('Database environment variables are missing.');
    }

    mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
    $connection = new mysqli($host, $user, $password, $database);
    $connection->set_charset('utf8mb4');

    return $connection;
}

function normalize_player_name($value, $default = 'Spieler') {
    $value = trim((string) $value);
    $value = preg_replace('/\s+/', ' ', $value);
    $value = truncate_text($value, 80);

    return $value !== '' ? $value : $default;
}

function truncate_text($value, $length) {
    $value = (string) $value;
    if (function_exists('mb_substr')) {
        return mb_substr($value, 0, $length);
    }

    return substr($value, 0, $length);
}

function table_exists(mysqli $conn, $tableName) {
    $sql = "SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param('s', $tableName);
    $stmt->execute();
    $result = $stmt->get_result()->fetch_assoc();

    return (int) ($result['count'] ?? 0) > 0;
}

function column_exists(mysqli $conn, $tableName, $columnName) {
    $sql = "SELECT COUNT(*) AS count FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param('ss', $tableName, $columnName);
    $stmt->execute();
    $result = $stmt->get_result()->fetch_assoc();

    return (int) ($result['count'] ?? 0) > 0;
}

function ensure_schema(mysqli $conn) {
    $conn->query(
        "CREATE TABLE IF NOT EXISTS games (
            id INT AUTO_INCREMENT PRIMARY KEY,
            player_name VARCHAR(80) NOT NULL DEFAULT 'Spieler',
            ai_name VARCHAR(80) NOT NULL DEFAULT 'AI',
            winner VARCHAR(80) DEFAULT NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'in_progress',
            `rows` INT NOT NULL DEFAULT 6,
            `cols` INT NOT NULL DEFAULT 7,
            algorithm VARCHAR(32) DEFAULT NULL,
            depth INT DEFAULT NULL,
            started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            completed_at DATETIME DEFAULT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    $conn->query(
        "CREATE TABLE IF NOT EXISTS move_history (
            id INT AUTO_INCREMENT PRIMARY KEY,
            game_id INT NOT NULL,
            player VARCHAR(80) NOT NULL,
            `col` INT NOT NULL,
            `row` INT NOT NULL,
            move_number INT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_move_history_game_move (game_id, move_number)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    $conn->query(
        "CREATE TABLE IF NOT EXISTS game_states (
            state VARCHAR(255) PRIMARY KEY,
            score DOUBLE NOT NULL DEFAULT 0
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    $gameColumns = [
        'player_name' => "ALTER TABLE games ADD COLUMN player_name VARCHAR(80) NOT NULL DEFAULT 'Spieler' AFTER id",
        'ai_name' => "ALTER TABLE games ADD COLUMN ai_name VARCHAR(80) NOT NULL DEFAULT 'AI' AFTER player_name",
        'winner' => "ALTER TABLE games ADD COLUMN winner VARCHAR(80) DEFAULT NULL AFTER ai_name",
        'status' => "ALTER TABLE games ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT 'in_progress' AFTER winner",
        'rows' => "ALTER TABLE games ADD COLUMN `rows` INT NOT NULL DEFAULT 6 AFTER status",
        'cols' => "ALTER TABLE games ADD COLUMN `cols` INT NOT NULL DEFAULT 7 AFTER `rows`",
        'algorithm' => "ALTER TABLE games ADD COLUMN algorithm VARCHAR(32) DEFAULT NULL AFTER `cols`",
        'depth' => "ALTER TABLE games ADD COLUMN depth INT DEFAULT NULL AFTER algorithm",
        'started_at' => "ALTER TABLE games ADD COLUMN started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER depth",
        'completed_at' => "ALTER TABLE games ADD COLUMN completed_at DATETIME DEFAULT NULL AFTER started_at"
    ];

    foreach ($gameColumns as $columnName => $statement) {
        if (!column_exists($conn, 'games', $columnName)) {
            $conn->query($statement);
        }
    }

    $moveColumns = [
        'game_id' => "ALTER TABLE move_history ADD COLUMN game_id INT NOT NULL AFTER id",
        'player' => "ALTER TABLE move_history ADD COLUMN player VARCHAR(80) NOT NULL AFTER game_id",
        'col' => "ALTER TABLE move_history ADD COLUMN `col` INT NOT NULL AFTER player",
        'row' => "ALTER TABLE move_history ADD COLUMN `row` INT NOT NULL AFTER `col`",
        'move_number' => "ALTER TABLE move_history ADD COLUMN move_number INT NOT NULL AFTER `row`",
        'created_at' => "ALTER TABLE move_history ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER move_number"
    ];

    foreach ($moveColumns as $columnName => $statement) {
        if (!column_exists($conn, 'move_history', $columnName)) {
            $conn->query($statement);
        }
    }
}
