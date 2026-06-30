<?php
require_once __DIR__ . '/bootstrap.php';

try {
    $data = json_input();

    if (!isset($data['game_id'], $data['winner'])) {
        json_response(["status" => "error", "message" => "Invalid input data"], 400);
    }

    $conn = db_connection();
    ensure_schema($conn);
    $gameId = (int) $data['game_id'];
    $winner = (string) $data['winner'];

    $stmt = $conn->prepare("UPDATE games SET winner = ?, status = 'completed', completed_at = NOW() WHERE id = ?");
    $stmt->bind_param("si", $winner, $gameId);
    $stmt->execute();

    json_response(["status" => "success"]);
} catch (Throwable $error) {
    json_response(["status" => "error", "message" => $error->getMessage()], 500);
}
