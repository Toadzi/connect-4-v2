<?php
require_once __DIR__ . '/bootstrap.php';

try {
    $conn = db_connection();
    ensure_schema($conn);
    $data = json_input();
    $rows = max(4, min(9, isset($data['rows']) ? (int) $data['rows'] : 6));
    $cols = max(4, min(10, isset($data['cols']) ? (int) $data['cols'] : 7));
    $playerName = normalize_player_name($data['player_name'] ?? 'Spieler');
    $aiName = normalize_player_name($data['ai_name'] ?? 'AI', 'AI');
    $algorithm = isset($data['algorithm']) ? truncate_text(trim((string) $data['algorithm']), 32) : null;
    $depth = isset($data['depth']) ? (int) $data['depth'] : null;

    $stmt = $conn->prepare(
        "INSERT INTO games (player_name, ai_name, winner, status, `rows`, `cols`, algorithm, depth, started_at)
         VALUES (?, ?, NULL, 'in_progress', ?, ?, ?, ?, NOW())"
    );
    $stmt->bind_param("ssiisi", $playerName, $aiName, $rows, $cols, $algorithm, $depth);
    $stmt->execute();

    json_response(["status" => "success", "game_id" => $stmt->insert_id]);
} catch (Throwable $error) {
    json_response(["status" => "error", "message" => $error->getMessage()], 500);
}
