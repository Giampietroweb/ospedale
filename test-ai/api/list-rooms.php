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

/** Solo stanza demo presentazione (tendina Test AI). */
$demoRoomCodeOnly = 'P2-151-058';

try {
    $pdo = getDatabaseConnection();
    $statement = $pdo->prepare(
        'SELECT id, blocco, piano, room_code, room_code_name
         FROM rooms
         WHERE room_code = :room_code
         LIMIT 1'
    );
    $statement->execute([':room_code' => $demoRoomCodeOnly]);
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
