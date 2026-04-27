<?php

declare(strict_types=1);

require __DIR__ . '/database.php';
require_once __DIR__ . '/utils.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Metodo non consentito'], JSON_UNESCAPED_UNICODE);
    exit;
}

function normalizeRoomCode(mixed $value): string
{
    $normalizedValue = strtoupper(trim((string)($value ?? '')));
    return preg_replace('/[^A-Z0-9]/', '', $normalizedValue) ?? '';
}

$blocco = trim((string)($_GET['blocco'] ?? ''));
$piano = trim((string)($_GET['piano'] ?? ''));

if (!in_array($blocco, ['nord', 'sud', 'piastra', 'sotterraneo'], true)) {
    apiErrorResponse('blocco non valido');
}

if ($piano === '' || !preg_match('/^-?\d+$/', $piano)) {
    apiErrorResponse('piano non valido');
}

try {
    $pdo = getDatabaseConnection();
    $statement = $pdo->prepare(
        'SELECT room_code
         FROM rooms
         WHERE blocco = :blocco AND piano = :piano'
    );
    $statement->execute([
        ':blocco' => $blocco,
        ':piano' => $piano,
    ]);

    $rows = $statement->fetchAll();
    $roomCodes = [];

    foreach ($rows as $row) {
        if (!is_array($row)) {
            continue;
        }

        $normalizedRoomCode = normalizeRoomCode($row['room_code'] ?? '');
        if ($normalizedRoomCode === '') {
            continue;
        }

        $roomCodes[] = $normalizedRoomCode;
    }

    $centralizedMonitorStatement = $pdo->prepare(
        'SELECT DISTINCT r.room_code
         FROM rooms r
         INNER JOIN room_apparecchiature ra ON ra.room_id = r.id
         WHERE r.blocco = :blocco
           AND r.piano = :piano
           AND REPLACE(
                 REPLACE(
                   REPLACE(
                     REPLACE(UPPER(COALESCE(ra.apparecchiatura, "")), " ", ""),
                     "-",
                     ""
                   ),
                   "_",
                   ""
                 ),
                 ".",
                 ""
               ) = :monitor_label'
    );
    $centralizedMonitorStatement->execute([
        ':blocco' => $blocco,
        ':piano' => $piano,
        ':monitor_label' => 'MONITORCENTRALIZZATO',
    ]);

    $centralizedRows = $centralizedMonitorStatement->fetchAll();
    $centralizedMonitorRoomCodes = [];
    foreach ($centralizedRows as $centralizedRow) {
        if (!is_array($centralizedRow)) {
            continue;
        }
        $normalizedRoomCode = normalizeRoomCode($centralizedRow['room_code'] ?? '');
        if ($normalizedRoomCode === '') {
            continue;
        }
        $centralizedMonitorRoomCodes[] = $normalizedRoomCode;
    }

    echo json_encode([
        'ok' => true,
        'rooms' => array_values(array_unique($roomCodes)),
        'centralizedMonitorRooms' => array_values(array_unique($centralizedMonitorRoomCodes)),
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $throwable) {
    apiErrorResponse('Errore caricamento: ' . $throwable->getMessage(), 500);
}
