<?php
require_once __DIR__ . '/bootstrap.php';

try {
    $data = json_input();

    if (!isset($data['state'], $data['score'])) {
        json_response(["status" => "error", "message" => "Invalid input data"], 400);
    }

    $conn = db_connection();
    $state = (string) $data['state'];
    $score = (float) $data['score'];

    $stmt = $conn->prepare("INSERT INTO game_states (state, score) VALUES (?, ?) ON DUPLICATE KEY UPDATE score = VALUES(score)");
    $stmt->bind_param("sd", $state, $score);
    $stmt->execute();

    json_response(["status" => "success"]);
} catch (Throwable $error) {
    json_response(["status" => "error", "message" => $error->getMessage()], 500);
}
