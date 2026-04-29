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
            COALESCE(ca.label, ra.apparecchiatura) AS apparecchiatura,
            tipologia,
            produttore,
            modello,
            qta,
            nuovo,
            trasferimento,
            inv,
            note
         FROM room_apparecchiature ra
         LEFT JOIN catalog_apparecchiature ca ON ca.id = ra.catalog_apparecchiatura_id
         WHERE ra.room_id = :room_id
         ORDER BY ra.sort_order ASC, ra.id ASC'
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
            COALESCE(ci.label, ri.tipologia) AS tipologia,
            ri.qta_presenti AS qtaPresenti,
            ri.qta_da_implementare AS qtaDaImplementare,
            ri.note
         FROM room_impiantistica ri
         LEFT JOIN catalog_impiantistica ci ON ci.id = ri.catalog_impiantistica_id
         WHERE ri.room_id = :room_id
         ORDER BY ri.sort_order ASC, ri.id ASC'
    );
    $impiantisticaStatement->execute([':room_id' => $roomId]);
    $impiantistica = $impiantisticaStatement->fetchAll();

    $altreDotazioniStatement = $pdo->prepare(
        'SELECT
            COALESCE(cad.label, rad.altra_dotazione) AS altraDotazione,
            rad.presente,
            rad.da_implementare AS daImplementare,
            rad.note
         FROM room_altre_dotazioni rad
         LEFT JOIN catalog_altre_dotazioni cad ON cad.id = rad.catalog_altra_dotazione_id
         WHERE rad.room_id = :room_id
         ORDER BY rad.sort_order ASC, rad.id ASC'
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
