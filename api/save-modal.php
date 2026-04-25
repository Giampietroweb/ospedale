<?php

declare(strict_types=1);

require __DIR__ . '/database.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Metodo non consentito']);
    exit;
}

function jsonError(string $message, int $statusCode = 400): void
{
    http_response_code($statusCode);
    echo json_encode(['ok' => false, 'error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

function asNullableString(mixed $value): ?string
{
    $trimmed = trim((string)($value ?? ''));
    if ($trimmed === '' || $trimmed === '-' || strtolower($trimmed) === 'null') {
        return null;
    }
    return $trimmed;
}

function asNullableInt(mixed $value): ?int
{
    $stringValue = trim((string)($value ?? ''));
    if ($stringValue === '') {
        return null;
    }
    if (!preg_match('/^-?\d+$/', $stringValue)) {
        return null;
    }
    return (int)$stringValue;
}

function isTruthyValue(mixed $value): bool
{
    if (is_bool($value)) {
        return $value;
    }
    if ($value === null) {
        return false;
    }
    $trimmed = trim((string)$value);
    if ($trimmed === '' || $trimmed === '-' || strtolower($trimmed) === 'null') {
        return false;
    }
    return true;
}

function fetchExistingRoom(PDO $pdo, string $blocco, string $piano, string $roomCode): ?array
{
    $statement = $pdo->prepare(
        'SELECT id FROM rooms WHERE blocco = :blocco AND piano = :piano AND room_code = :room_code LIMIT 1'
    );
    $statement->execute([
        ':blocco' => $blocco,
        ':piano' => $piano,
        ':room_code' => $roomCode,
    ]);
    $row = $statement->fetch(PDO::FETCH_ASSOC);
    return is_array($row) ? $row : null;
}

function ensureRoomExists(PDO $pdo, string $blocco, string $piano, string $roomCode): int
{
    $existingRoom = fetchExistingRoom($pdo, $blocco, $piano, $roomCode);
    if ($existingRoom) {
        return (int)$existingRoom['id'];
    }

    $insertStatement = $pdo->prepare(
        'INSERT INTO rooms (blocco, piano, room_code) VALUES (:blocco, :piano, :room_code)'
    );
    $insertStatement->execute([
        ':blocco' => $blocco,
        ':piano' => $piano,
        ':room_code' => $roomCode,
    ]);

    return (int)$pdo->lastInsertId();
}

function isDbCellEmpty(mixed $value): bool
{
    if ($value === null) {
        return true;
    }
    $trimmed = trim((string)$value);
    return $trimmed === '' || $trimmed === '-' || strtolower($trimmed) === 'null';
}

function syncAutoAttributesIfEmpty(PDO $pdo, int $roomId, array $autoAttributes, array $autoFieldMap): void
{
    if ($roomId <= 0 || $autoAttributes === []) {
        return;
    }

    $statement = $pdo->prepare(
        'SELECT room_code_name, occupazione, superficie, emipiano, accreditamento_locale, posti_letto, note_arredi_segnaletica
         FROM rooms
         WHERE id = :room_id
         LIMIT 1'
    );
    $statement->execute([':room_id' => $roomId]);
    $currentValues = $statement->fetch(PDO::FETCH_ASSOC);
    if (!is_array($currentValues)) {
        return;
    }

    $setClauses = [];
    $params = [':room_id' => $roomId];

    foreach ($autoFieldMap as $payloadKey => $columnName) {
        if (!array_key_exists($payloadKey, $autoAttributes)) {
            continue;
        }

        if (!isDbCellEmpty($currentValues[$columnName] ?? null)) {
            continue;
        }

        $rawValue = $autoAttributes[$payloadKey];
        $normalizedValue = $payloadKey === 'postiLetto'
            ? asNullableInt($rawValue)
            : asNullableString($rawValue);
        if ($normalizedValue === null) {
            continue;
        }

        $paramName = ':auto_' . $payloadKey;
        $setClauses[] = sprintf('%s = %s', $columnName, $paramName);
        $params[$paramName] = $normalizedValue;
    }

    if ($setClauses === []) {
        return;
    }

    $updateSql = sprintf(
        'UPDATE rooms SET %s, updated_at = CURRENT_TIMESTAMP WHERE id = :room_id',
        implode(', ', $setClauses)
    );
    $updateStatement = $pdo->prepare($updateSql);
    foreach ($params as $paramName => $value) {
        if ($value === null) {
            $updateStatement->bindValue($paramName, null, PDO::PARAM_NULL);
            continue;
        }
        $updateStatement->bindValue($paramName, $value, is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR);
    }
    $updateStatement->execute();
}

$allowedFieldMap = [
    'roomCodeName' => 'room_code_name',
    'occupazione' => 'occupazione',
    'reparto' => 'reparto',
    'superficie' => 'superficie',
    'emipiano' => 'emipiano',
    'accreditamentoLocale' => 'accreditamento_locale',
    'postiLetto' => 'posti_letto',
    'noteArrediSegnaletica' => 'note_arredi_segnaletica',
];

$autoFieldMap = [
    'roomCodeName' => 'room_code_name',
    'occupazione' => 'occupazione',
    'superficie' => 'superficie',
    'emipiano' => 'emipiano',
    'accreditamentoLocale' => 'accreditamento_locale',
    'postiLetto' => 'posti_letto',
    'noteArrediSegnaletica' => 'note_arredi_segnaletica',
];

$rawBody = file_get_contents('php://input');
$payload = json_decode($rawBody ?: '', true);
if (!is_array($payload)) {
    jsonError('Payload JSON non valido');
}

$roomRef = is_array($payload['roomRef'] ?? null) ? $payload['roomRef'] : null;
if (!$roomRef) {
    jsonError('roomRef mancante');
}

$blocco = trim((string)($roomRef['blocco'] ?? ''));
$piano = trim((string)($roomRef['piano'] ?? ''));
$roomCode = trim((string)($roomRef['roomCode'] ?? ''));

if (!in_array($blocco, ['nord', 'sud', 'piastra', 'sotterraneo'], true)) {
    jsonError('blocco non valido');
}
if ($piano === '' || !preg_match('/^-?\d+$/', $piano)) {
    jsonError('piano non valido');
}
if ($roomCode === '') {
    jsonError('roomCode obbligatorio');
}

$action = trim((string)($payload['action'] ?? ''));
if (!in_array($action, ['saveField', 'saveApparecchiaturaRow', 'saveImpiantisticaRow', 'saveAltreDotazioniRow'], true)) {
    jsonError('action non valida');
}
$autoAttributes = is_array($payload['autoAttributes'] ?? null) ? $payload['autoAttributes'] : [];

try {
    $pdo = getDatabaseConnection();
    $pdo->beginTransaction();

    $roomId = 0;
    $skipped = false;

    if ($action === 'saveField') {
        $fieldName = trim((string)($payload['fieldName'] ?? ''));
        if (!array_key_exists($fieldName, $allowedFieldMap)) {
            jsonError('fieldName non valido');
        }

        $fieldValue = $payload['value'] ?? null;
        $columnName = $allowedFieldMap[$fieldName];
        $existingRoom = fetchExistingRoom($pdo, $blocco, $piano, $roomCode);

        if (!$existingRoom && !isTruthyValue($fieldValue)) {
            $skipped = true;
        } else {
            $roomId = ensureRoomExists($pdo, $blocco, $piano, $roomCode);
            syncAutoAttributesIfEmpty($pdo, $roomId, $autoAttributes, $autoFieldMap);
            $updateSql = sprintf('UPDATE rooms SET %s = :value, updated_at = CURRENT_TIMESTAMP WHERE id = :room_id', $columnName);
            $updateStatement = $pdo->prepare($updateSql);
            $boundValue = $fieldName === 'postiLetto'
                ? asNullableInt($fieldValue)
                : asNullableString($fieldValue);
            $updateStatement->bindValue(':value', $boundValue, $boundValue === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
            $updateStatement->bindValue(':room_id', $roomId, PDO::PARAM_INT);
            $updateStatement->execute();
        }
    }

    if ($action === 'saveImpiantisticaRow') {
        $row = is_array($payload['row'] ?? null) ? $payload['row'] : null;
        if (!$row) {
            jsonError('row mancante');
        }

        $tipologia = trim((string)($row['tipologia'] ?? ''));
        if ($tipologia === '') {
            jsonError('tipologia impiantistica obbligatoria');
        }

        $qtaPresenti = asNullableInt($row['qtaPresenti'] ?? null);
        $qtaDaImplementare = asNullableInt($row['qtaDaImplementare'] ?? null);
        $note = asNullableString($row['note'] ?? null);

        $existingRoom = fetchExistingRoom($pdo, $blocco, $piano, $roomCode);
        if (!$existingRoom && $qtaPresenti === null && $qtaDaImplementare === null && $note === null) {
            $skipped = true;
        } else {
            $roomId = ensureRoomExists($pdo, $blocco, $piano, $roomCode);
            syncAutoAttributesIfEmpty($pdo, $roomId, $autoAttributes, $autoFieldMap);
            $deleteStatement = $pdo->prepare('DELETE FROM room_impiantistica WHERE room_id = :room_id AND tipologia = :tipologia');
            $deleteStatement->execute([
                ':room_id' => $roomId,
                ':tipologia' => $tipologia,
            ]);

            if (!($qtaPresenti === null && $qtaDaImplementare === null && $note === null)) {
                $insertStatement = $pdo->prepare(
                    'INSERT INTO room_impiantistica (room_id, tipologia, qta_presenti, qta_da_implementare, note, sort_order)
                     VALUES (:room_id, :tipologia, :qta_presenti, :qta_da_implementare, :note, :sort_order)'
                );
                $insertStatement->execute([
                    ':room_id' => $roomId,
                    ':tipologia' => $tipologia,
                    ':qta_presenti' => $qtaPresenti,
                    ':qta_da_implementare' => $qtaDaImplementare,
                    ':note' => $note,
                    ':sort_order' => (int)($payload['rowIndex'] ?? 0),
                ]);
            }
        }
    }

    if ($action === 'saveAltreDotazioniRow') {
        $row = is_array($payload['row'] ?? null) ? $payload['row'] : null;
        if (!$row) {
            jsonError('row mancante');
        }

        $altraDotazione = trim((string)($row['altraDotazione'] ?? ''));
        if ($altraDotazione === '') {
            jsonError('altraDotazione obbligatoria');
        }

        $presente = asNullableString($row['presente'] ?? null);
        $daImplementare = asNullableString($row['daImplementare'] ?? null);
        $note = asNullableString($row['note'] ?? null);

        $existingRoom = fetchExistingRoom($pdo, $blocco, $piano, $roomCode);
        if (!$existingRoom && $presente === null && $daImplementare === null && $note === null) {
            $skipped = true;
        } else {
            $roomId = ensureRoomExists($pdo, $blocco, $piano, $roomCode);
            syncAutoAttributesIfEmpty($pdo, $roomId, $autoAttributes, $autoFieldMap);
            $deleteStatement = $pdo->prepare(
                'DELETE FROM room_altre_dotazioni WHERE room_id = :room_id AND altra_dotazione = :altra_dotazione'
            );
            $deleteStatement->execute([
                ':room_id' => $roomId,
                ':altra_dotazione' => $altraDotazione,
            ]);

            if (!($presente === null && $daImplementare === null && $note === null)) {
                $insertStatement = $pdo->prepare(
                    'INSERT INTO room_altre_dotazioni (room_id, altra_dotazione, presente, da_implementare, note, sort_order)
                     VALUES (:room_id, :altra_dotazione, :presente, :da_implementare, :note, :sort_order)'
                );
                $insertStatement->execute([
                    ':room_id' => $roomId,
                    ':altra_dotazione' => $altraDotazione,
                    ':presente' => $presente,
                    ':da_implementare' => $daImplementare,
                    ':note' => $note,
                    ':sort_order' => (int)($payload['rowIndex'] ?? 0),
                ]);
            }
        }
    }

    if ($action === 'saveApparecchiaturaRow') {
        $row = is_array($payload['row'] ?? null) ? $payload['row'] : null;
        if (!$row) {
            jsonError('row mancante');
        }

        $normalizedRow = [
            'apparecchiatura' => asNullableString($row['apparecchiatura'] ?? null),
            'tipologia' => asNullableString($row['tipologia'] ?? null),
            'produttore' => asNullableString($row['produttore'] ?? null),
            'modello' => asNullableString($row['modello'] ?? null),
            'qta' => asNullableString($row['qta'] ?? null),
            'nuovo' => asNullableString($row['nuovo'] ?? null),
            'trasferimento' => asNullableString($row['trasferimento'] ?? null),
            'inv' => asNullableString($row['inv'] ?? null),
            'note' => asNullableString($row['note'] ?? null),
        ];

        $hasUsefulValue = array_filter($normalizedRow, static fn($value) => $value !== null) !== [];
        $existingRoom = fetchExistingRoom($pdo, $blocco, $piano, $roomCode);

        if (!$existingRoom && !$hasUsefulValue) {
            $skipped = true;
        } else {
            $roomId = ensureRoomExists($pdo, $blocco, $piano, $roomCode);
            syncAutoAttributesIfEmpty($pdo, $roomId, $autoAttributes, $autoFieldMap);
            $sortOrder = (int)($payload['rowIndex'] ?? 0);
            $pdo->prepare('DELETE FROM room_apparecchiature WHERE room_id = :room_id AND sort_order = :sort_order')
                ->execute([':room_id' => $roomId, ':sort_order' => $sortOrder]);

            if ($hasUsefulValue) {
                $insertStatement = $pdo->prepare(
                    'INSERT INTO room_apparecchiature (
                        room_id, apparecchiatura, tipologia, produttore, modello, qta, nuovo, trasferimento, inv, note, sort_order
                    ) VALUES (
                        :room_id, :apparecchiatura, :tipologia, :produttore, :modello, :qta, :nuovo, :trasferimento, :inv, :note, :sort_order
                    )'
                );
                $insertStatement->execute([
                    ':room_id' => $roomId,
                    ':apparecchiatura' => $normalizedRow['apparecchiatura'],
                    ':tipologia' => $normalizedRow['tipologia'],
                    ':produttore' => $normalizedRow['produttore'],
                    ':modello' => $normalizedRow['modello'],
                    ':qta' => $normalizedRow['qta'],
                    ':nuovo' => $normalizedRow['nuovo'],
                    ':trasferimento' => $normalizedRow['trasferimento'],
                    ':inv' => $normalizedRow['inv'],
                    ':note' => $normalizedRow['note'],
                    ':sort_order' => $sortOrder,
                ]);
            }
        }
    }

    if ($roomId === 0) {
        $existingRoom = fetchExistingRoom($pdo, $blocco, $piano, $roomCode);
        if ($existingRoom) {
            $roomId = (int)$existingRoom['id'];
        }
    }

    $pdo->commit();
    echo json_encode([
        'ok' => true,
        'action' => $action,
        'roomId' => $roomId > 0 ? $roomId : null,
        'skipped' => $skipped,
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $throwable) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    jsonError('Errore salvataggio: ' . $throwable->getMessage(), 500);
}
