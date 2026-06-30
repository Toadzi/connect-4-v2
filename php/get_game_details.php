<?php
require_once __DIR__ . '/bootstrap.php';

try {
    $conn = db_connection();
    ensure_schema($conn);

    $gameId = isset($_GET['game_id']) ? (int) $_GET['game_id'] : 0;
    if ($gameId <= 0) {
        json_response(['status' => 'error', 'message' => 'game_id fehlt oder ist ungültig.'], 400);
    }

    $gameStmt = $conn->prepare(
        "SELECT
            id,
            player_name,
            ai_name,
            winner,
            status,
            `rows`,
            `cols`,
            algorithm,
            depth,
            started_at,
            completed_at
         FROM games
         WHERE id = ?"
    );
    $gameStmt->bind_param('i', $gameId);
    $gameStmt->execute();
    $gameResult = $gameStmt->get_result();
    $game = $gameResult->fetch_assoc();

    if (!$game) {
        json_response(['status' => 'error', 'message' => 'Spiel nicht gefunden.'], 404);
    }

    $movesStmt = $conn->prepare(
        "SELECT player, `col`, `row`, move_number
         FROM move_history
         WHERE game_id = ?
         ORDER BY move_number ASC, id ASC"
    );
    $movesStmt->bind_param('i', $gameId);
    $movesStmt->execute();
    $movesResult = $movesStmt->get_result();
    $moves = [];

    while ($row = $movesResult->fetch_assoc()) {
        $moves[] = [
            'player' => $row['player'],
            'col' => (int) $row['col'],
            'row' => (int) $row['row'],
            'move_number' => (int) $row['move_number']
        ];
    }

    json_response([
        'status' => 'success',
        'game' => [
            'id' => (int) $game['id'],
            'player_name' => $game['player_name'],
            'ai_name' => $game['ai_name'],
            'winner' => $game['winner'],
            'status' => $game['status'],
            'rows' => (int) $game['rows'],
            'cols' => (int) $game['cols'],
            'algorithm' => $game['algorithm'],
            'depth' => $game['depth'] !== null ? (int) $game['depth'] : null,
            'started_at' => $game['started_at'],
            'completed_at' => $game['completed_at']
        ],
        'moves' => $moves
    ]);
} catch (Throwable $error) {
    json_response(['status' => 'error', 'message' => $error->getMessage()], 500);
}
