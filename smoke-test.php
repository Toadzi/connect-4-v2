<?php
require_once __DIR__ . '/php/bootstrap.php';
header('Content-Type: text/html; charset=UTF-8');

$checks = [];

$requiredEnv = [
    'CONNECT4_DB_HOST',
    'CONNECT4_DB_USER',
    'CONNECT4_DB_PASSWORD',
    'CONNECT4_DB_NAME',
];

foreach ($requiredEnv as $name) {
    $value = getenv($name);
    $checks[] = [
        'label' => "ENV {$name}",
        'status' => !empty($value),
        'details' => !empty($value) ? 'gesetzt' : 'fehlt',
    ];
}

try {
    $conn = db_connection();
    $result = $conn->query('SELECT 1 AS ok');
    $row = $result ? $result->fetch_assoc() : null;
    $checks[] = [
        'label' => 'Datenbankverbindung',
        'status' => isset($row['ok']) && (int) $row['ok'] === 1,
        'details' => isset($row['ok']) ? 'Verbindung erfolgreich' : 'Testquery fehlgeschlagen',
    ];
    $conn->close();
} catch (Throwable $error) {
    $checks[] = [
        'label' => 'Datenbankverbindung',
        'status' => false,
        'details' => $error->getMessage(),
    ];
}

$activeFiles = [
    'index.html',
    'game.js',
    'board.js',
    'ai_worker.js',
    'php/start_game.php',
    'php/store_move.php',
    'php/end_game.php',
    'php/store_state.php',
];

foreach ($activeFiles as $file) {
    $checks[] = [
        'label' => "Datei {$file}",
        'status' => file_exists(__DIR__ . '/' . $file),
        'details' => file_exists(__DIR__ . '/' . $file) ? 'vorhanden' : 'fehlt',
    ];
}

$passed = count(array_filter($checks, fn ($check) => $check['status']));
$total = count($checks);
?>
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Connect 4 Smoke Test</title>
    <style>
        body {
            margin: 0;
            font-family: system-ui, sans-serif;
            background: #11151c;
            color: #f4f7fb;
        }

        .page {
            max-width: 860px;
            margin: 0 auto;
            padding: 24px;
        }

        .summary {
            background: #1c2330;
            border: 1px solid #2d384b;
            border-radius: 16px;
            padding: 20px;
            margin-bottom: 24px;
        }

        .checks {
            display: grid;
            gap: 12px;
        }

        .check {
            background: #1c2330;
            border: 1px solid #2d384b;
            border-radius: 14px;
            padding: 16px;
        }

        .ok {
            border-color: #2f9e44;
        }

        .fail {
            border-color: #e03131;
        }

        .status {
            font-weight: 700;
            margin-bottom: 8px;
        }

        .hint {
            color: #c5d0e0;
            font-size: 0.95rem;
        }

        code {
            background: rgba(255, 255, 255, 0.08);
            padding: 2px 6px;
            border-radius: 6px;
        }
    </style>
</head>
<body>
    <main class="page">
        <section class="summary">
            <h1>Connect 4 Smoke Test</h1>
            <p><?php echo $passed; ?> von <?php echo $total; ?> Checks erfolgreich.</p>
            <p class="hint">Aufruf lokal z. B. unter <code>http://localhost:8000/smoke-test.php</code>.</p>
        </section>

        <section class="checks">
            <?php foreach ($checks as $check): ?>
                <article class="check <?php echo $check['status'] ? 'ok' : 'fail'; ?>">
                    <div class="status"><?php echo $check['status'] ? 'OK' : 'FEHLER'; ?>: <?php echo htmlspecialchars($check['label'], ENT_QUOTES, 'UTF-8'); ?></div>
                    <div class="hint"><?php echo htmlspecialchars($check['details'], ENT_QUOTES, 'UTF-8'); ?></div>
                </article>
            <?php endforeach; ?>
        </section>
    </main>
</body>
</html>
