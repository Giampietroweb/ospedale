<?php

declare(strict_types=1);

require __DIR__ . '/../../api/database.php';
require_once __DIR__ . '/../../api/utils.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Metodo non consentito'], JSON_UNESCAPED_UNICODE);
    exit;
}

/** @var array<string, string> */
$bloccoLabels = [
    'nord' => 'Blocco Nord',
    'sud' => 'Blocco Sud',
    'piastra' => 'Piastra Centrale',
    'sotterraneo' => 'Interrato',
];

try {
    $pdo = getDatabaseConnection();
    $statement = $pdo->query(
        'SELECT id, blocco, piano, room_code, room_code_name
         FROM rooms
         ORDER BY blocco ASC, CAST(piano AS SIGNED) ASC, piano ASC, room_code ASC
         LIMIT 10'
    );
    $rows = $statement->fetchAll();

    $rooms = [];
    foreach ($rows as $row) {
        if (!is_array($row)) {
            continue;
        }

        $id = (int)($row['id'] ?? 0);
        if ($id <= 0) {
            continue;
        }

        $blocco = (string)($row['blocco'] ?? '');
        $piano = (string)($row['piano'] ?? '');
        $roomCode = (string)($row['room_code'] ?? '');
        $roomCodeName = trim((string)($row['room_code_name'] ?? ''));

        $bloccoLabel = $bloccoLabels[$blocco] ?? $blocco;
        $label = implode(' · ', [$bloccoLabel, 'Piano ' . $piano, $roomCode]);
        if ($roomCodeName !== '') {
            $label .= ' — ' . $roomCodeName;
        }

        $rooms[] = [
            'id' => $id,
            'blocco' => $blocco,
            'piano' => $piano,
            'roomCode' => $roomCode,
            'roomCodeName' => $roomCodeName,
            'label' => $label,
        ];
    }

    echo json_encode(['ok' => true, 'rooms' => $rooms], JSON_UNESCAPED_UNICODE);
} catch (Throwable $throwable) {
    apiErrorResponse('Errore caricamento: ' . $throwable->getMessage(), 500);
}
