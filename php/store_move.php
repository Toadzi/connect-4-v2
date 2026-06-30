<?php
require_once __DIR__ . '/bootstrap.php';

try {
    $data = json_input();

    if (!isset($data['game_id'], $data['player'], $data['col'], $data['row'], $data['moveNumber'])) {
        json_response(["status" => "error", "message" => "Invalid input data"], 400);
    }

    $conn = db_connection();
    ensure_schema($conn);
    $gameId = (int) $data['game_id'];
    $player = normalize_player_name($data['player'], 'Spieler');
    $col = (int) $data['col'];
    $row = (int) $data['row'];
    $moveNumber = (int) $data['moveNumber'];

    $stmt = $conn->prepare("INSERT INTO move_history (game_id, player, `col`, `row`, move_number) VALUES (?, ?, ?, ?, ?)");
    $stmt->bind_param("isiii", $gameId, $player, $col, $row, $moveNumber);
    $stmt->execute();

    json_response(["status" => "success"]);
} catch (Throwable $error) {
    json_response(["status" => "error", "message" => $error->getMessage()], 500);
}
