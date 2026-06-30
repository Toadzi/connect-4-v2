<?php
require_once __DIR__ . '/bootstrap.php';

try {
    $conn = db_connection();
    ensure_schema($conn);

    $playerFilter = normalize_player_name($_GET['player_name'] ?? '', '');
    $rankingLimit = 50;
    $matchLimit = 100;

    $rankingSql = "
        SELECT
            player_name,
            COUNT(*) AS matches,
            SUM(CASE WHEN LOWER(COALESCE(winner, '')) = 'player' THEN 1 ELSE 0 END) AS wins,
            SUM(CASE WHEN LOWER(COALESCE(winner, '')) = 'ai' THEN 1 ELSE 0 END) AS losses,
            SUM(CASE WHEN LOWER(COALESCE(winner, '')) = 'draw' THEN 1 ELSE 0 END) AS draws,
            ROUND(
                (SUM(CASE WHEN LOWER(COALESCE(winner, '')) = 'player' THEN 1 ELSE 0 END) / COUNT(*)) * 100,
                1
            ) AS win_rate,
            MAX(COALESCE(completed_at, started_at)) AS last_played
        FROM games
        WHERE status = 'completed'
          AND COALESCE(player_name, '') <> ''
        GROUP BY player_name
        ORDER BY wins DESC, win_rate DESC, matches DESC, last_played DESC
        LIMIT ?
    ";

    $rankingStmt = $conn->prepare($rankingSql);
    $rankingStmt->bind_param('i', $rankingLimit);
    $rankingStmt->execute();
    $rankingResult = $rankingStmt->get_result();
    $rankings = [];

    while ($row = $rankingResult->fetch_assoc()) {
        $rankings[] = [
            'player_name' => $row['player_name'],
            'matches' => (int) $row['matches'],
            'wins' => (int) $row['wins'],
            'losses' => (int) $row['losses'],
            'draws' => (int) $row['draws'],
            'win_rate' => (float) $row['win_rate'],
            'last_played' => $row['last_played']
        ];
    }

    $matchSql = "
        SELECT
            g.id,
            g.player_name,
            g.ai_name,
            g.winner,
            g.status,
            g.`rows`,
            g.`cols`,
            g.algorithm,
            g.depth,
            g.started_at,
            g.completed_at,
            COUNT(mh.id) AS move_count
        FROM games g
        LEFT JOIN move_history mh ON mh.game_id = g.id
        WHERE g.status = 'completed'
    ";

    if ($playerFilter !== '') {
        $matchSql .= " AND g.player_name = ?";
    }

    $matchSql .= "
        GROUP BY
            g.id, g.player_name, g.ai_name, g.winner, g.status, g.`rows`, g.`cols`,
            g.algorithm, g.depth, g.started_at, g.completed_at
        ORDER BY COALESCE(g.completed_at, g.started_at) DESC, g.id DESC
        LIMIT ?
    ";

    if ($playerFilter !== '') {
        $matchStmt = $conn->prepare($matchSql);
        $matchStmt->bind_param('si', $playerFilter, $matchLimit);
    } else {
        $matchStmt = $conn->prepare($matchSql);
        $matchStmt->bind_param('i', $matchLimit);
    }

    $matchStmt->execute();
    $matchResult = $matchStmt->get_result();
    $matches = [];

    while ($row = $matchResult->fetch_assoc()) {
        $winnerToken = strtolower((string) ($row['winner'] ?? ''));
        $resultLabel = 'Unentschieden';
        if ($winnerToken === 'player') {
            $resultLabel = $row['player_name'] . ' gewinnt';
        } elseif ($winnerToken === 'ai') {
            $resultLabel = ($row['ai_name'] ?: 'AI') . ' gewinnt';
        }

        $matches[] = [
            'id' => (int) $row['id'],
            'player_name' => $row['player_name'],
            'ai_name' => $row['ai_name'],
            'winner' => $row['winner'],
            'result_label' => $resultLabel,
            'rows' => (int) $row['rows'],
            'cols' => (int) $row['cols'],
            'algorithm' => $row['algorithm'],
            'depth' => $row['depth'] !== null ? (int) $row['depth'] : null,
            'started_at' => $row['started_at'],
            'completed_at' => $row['completed_at'],
            'move_count' => (int) $row['move_count']
        ];
    }

    json_response([
        'status' => 'success',
        'filter' => [
            'player_name' => $playerFilter
        ],
        'rankings' => $rankings,
        'matches' => $matches
    ]);
} catch (Throwable $error) {
    json_response(['status' => 'error', 'message' => $error->getMessage()], 500);
}
