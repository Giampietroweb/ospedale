<?php

declare(strict_types=1);

require __DIR__ . '/database.php';
require_once __DIR__ . '/utils.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Metodo non consentito']);
    exit;
}

$blocco = trim((string)($_GET['blocco'] ?? ''));
$piano = trim((string)($_GET['piano'] ?? ''));
$roomCode = trim((string)($_GET['roomCode'] ?? ''));

if (!in_array($blocco, ['nord', 'sud', 'piastra', 'sotterraneo'], true)) {
    apiErrorResponse('blocco non valido');
}
if ($piano === '' || !preg_match('/^-?\d+$/', $piano)) {
    apiErrorResponse('piano non valido');
}
if ($roomCode === '') {
    apiErrorResponse('roomCode obbligatorio');
}

try {
    $pdo = getDatabaseConnection();
    $roomStatement = $pdo->prepare(
        'SELECT
            id,
            blocco,
            piano,
            room_code,
            room_code_name,
            occupazione,
            reparto,
            superficie,
            emipiano,
            accreditamento_locale,
            posti_letto,
            note_arredi_segnaletica
         FROM rooms
         WHERE blocco = :blocco AND piano = :piano AND room_code = :room_code
         LIMIT 1'
    );
    $roomStatement->execute([
        ':blocco' => $blocco,
        ':piano' => $piano,
        ':room_code' => $roomCode,
    ]);
    $room = $roomStatement->fetch();

    if (!$room) {
        echo json_encode(['ok' => true, 'exists' => false], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $roomId = (int)$room['id'];

    $apparecchiatureStatement = $pdo->prepare(
        'SELECT
            apparecchiatura,
            tipologia,
            produttore,
            modello,
            qta,
            nuovo,
            trasferimento,
            inv,
            note
         FROM room_apparecchiature
         WHERE room_id = :room_id
         ORDER BY sort_order ASC, id ASC'
    );
    $apparecchiatureStatement->execute([':room_id' => $roomId]);
    $apparecchiature = $apparecchiatureStatement->fetchAll();
    if (is_array($apparecchiature)) {
        foreach ($apparecchiature as &$apparecchiaturaRow) {
            if (!is_array($apparecchiaturaRow)) {
                continue;
            }
            $apparecchiaturaRow['inv'] = normalizeInventoryListForResponse($apparecchiaturaRow['inv'] ?? null);
        }
        unset($apparecchiaturaRow);
    }

    $impiantisticaStatement = $pdo->prepare(
        'SELECT
            tipologia,
            qta_presenti AS qtaPresenti,
            qta_da_implementare AS qtaDaImplementare,
            note
         FROM room_impiantistica
         WHERE room_id = :room_id
         ORDER BY sort_order ASC, id ASC'
    );
    $impiantisticaStatement->execute([':room_id' => $roomId]);
    $impiantistica = $impiantisticaStatement->fetchAll();

    $altreDotazioniStatement = $pdo->prepare(
        'SELECT
            altra_dotazione AS altraDotazione,
            presente,
            da_implementare AS daImplementare,
            note
         FROM room_altre_dotazioni
         WHERE room_id = :room_id
         ORDER BY sort_order ASC, id ASC'
    );
    $altreDotazioniStatement->execute([':room_id' => $roomId]);
    $altreDotazioni = $altreDotazioniStatement->fetchAll();

    $response = [
        'ok' => true,
        'exists' => true,
        'roomRef' => [
            'blocco' => $room['blocco'],
            'piano' => $room['piano'],
            'roomCode' => $room['room_code'],
        ],
        'attributiStanza' => [
            'roomCodeName' => $room['room_code_name'],
            'occupazione' => $room['occupazione'],
            'reparto' => $room['reparto'],
            'superficie' => $room['superficie'],
            'emipiano' => $room['emipiano'],
            'accreditamentoLocale' => $room['accreditamento_locale'],
            'postiLetto' => $room['posti_letto'],
            'noteArrediSegnaletica' => $room['note_arredi_segnaletica'],
        ],
        'apparecchiature' => $apparecchiature,
        'impiantistica' => $impiantistica,
        'altreDotazioni' => $altreDotazioni,
    ];

    echo json_encode($response, JSON_UNESCAPED_UNICODE);
} catch (Throwable $throwable) {
    apiErrorResponse('Errore caricamento: ' . $throwable->getMessage(), 500);
}
