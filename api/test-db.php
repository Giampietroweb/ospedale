<?php

declare(strict_types=1);

require __DIR__ . '/database.php';

header('Content-Type: application/json; charset=utf-8');

$requiredTables = [
    'rooms',
    'room_apparecchiature',
    'room_impiantistica',
    'room_altre_dotazioni',
];

try {
    $pdo = getDatabaseConnection();
    $version = (string)$pdo->query('SELECT VERSION()')->fetchColumn();
    $databaseName = (string)$pdo->query('SELECT DATABASE()')->fetchColumn();

    $existingTables = $pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
    $existingTableMap = array_fill_keys($existingTables, true);

    $tableChecks = [];
    $missingTables = [];
    foreach ($requiredTables as $tableName) {
        $isPresent = isset($existingTableMap[$tableName]);
        $tableChecks[] = [
            'table' => $tableName,
            'exists' => $isPresent,
        ];
        if (!$isPresent) {
            $missingTables[] = $tableName;
        }
    }

    echo json_encode([
        'ok' => empty($missingTables),
        'message' => empty($missingTables)
            ? 'Connessione DB riuscita e schema principale presente'
            : 'Connessione DB riuscita ma schema incompleto',
        'database' => $databaseName,
        'mysqlVersion' => $version,
        'tables' => $tableChecks,
        'missingTables' => $missingTables,
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
} catch (Throwable $throwable) {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'message' => 'Connessione DB fallita',
        'error' => $throwable->getMessage(),
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
}
