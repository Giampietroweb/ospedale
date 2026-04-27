<?php

declare(strict_types=1);

const ESTRAZIONI_VALID_BLOCCHI = ['nord', 'sud', 'piastra', 'sotterraneo'];

function estrazioniNormalizeInventoryCode(mixed $value): string
{
    return strtoupper(trim((string)($value ?? '')));
}

function estrazioniNormalizeInventoryListForResponse(mixed $value): array
{
    if (is_array($value)) {
        $rawValues = $value;
    } else {
        $stringValue = trim((string)($value ?? ''));
        if ($stringValue === '' || $stringValue === '-' || strtolower($stringValue) === 'null') {
            return [];
        }

        $decoded = json_decode($stringValue, true);
        if (is_array($decoded)) {
            $rawValues = $decoded;
        } else {
            $rawValues = preg_split('/\s*,\s*/', $stringValue) ?: [];
        }
    }

    $normalizedValues = [];
    foreach ($rawValues as $rawItem) {
        $normalizedCode = estrazioniNormalizeInventoryCode($rawItem);
        if ($normalizedCode === '') {
            continue;
        }
        $normalizedValues[] = $normalizedCode;
    }

    return array_values(array_unique($normalizedValues));
}

/**
 * Filtri per la ricerca estrazioni (stessi parametri GET di action=search).
 *
 * @return array{
 *   blocco: string,
 *   piano: string,
 *   reparto_filter: bool,
 *   reparto_empty: bool,
 *   reparto: string,
 *   room_code: string,
 *   apparecchiatura: string
 * }
 */
function parseEstrazioniFiltersFromGet(array $get): array
{
    $blocco = trim((string)($get['blocco'] ?? ''));
    $piano = trim((string)($get['piano'] ?? ''));
    $roomCode = trim((string)($get['room_code'] ?? ''));
    $apparecchiatura = trim((string)($get['apparecchiatura'] ?? ''));

    if ($blocco !== '' && !in_array($blocco, ESTRAZIONI_VALID_BLOCCHI, true)) {
        throw new InvalidArgumentException('blocco non valido');
    }
    if ($piano !== '' && !preg_match('/^-?\d+$/', $piano)) {
        throw new InvalidArgumentException('piano non valido');
    }

    $repartoFilter = array_key_exists('reparto', $get);
    $repartoRaw = $get['reparto'] ?? null;
    $repartoEmpty = $repartoFilter
        && ($repartoRaw === null || (is_string($repartoRaw) && trim($repartoRaw) === ''));
    $reparto = trim((string)$repartoRaw);

    return [
        'blocco' => $blocco,
        'piano' => $piano,
        'reparto_filter' => $repartoFilter,
        'reparto_empty' => $repartoEmpty,
        'reparto' => $reparto,
        'room_code' => $roomCode,
        'apparecchiatura' => $apparecchiatura,
    ];
}

/**
 * @param array{
 *   blocco: string,
 *   piano: string,
 *   reparto_filter: bool,
 *   reparto_empty: bool,
 *   reparto: string,
 *   room_code: string,
 *   apparecchiatura: string
 * } $filters
 * @return list<array<string, mixed>>
 */
function fetchEstrazioniRows(PDO $pdo, array $filters): array
{
    $blocco = $filters['blocco'];
    $piano = $filters['piano'];

    $conditions = ['1=1'];
    $params = [];

    if ($blocco !== '') {
        $conditions[] = 'r.blocco = :blocco';
        $params[':blocco'] = $blocco;
    }
    if ($piano !== '') {
        $conditions[] = 'r.piano = :piano';
        $params[':piano'] = $piano;
    }

    if ($filters['reparto_filter']) {
        if ($filters['reparto_empty']) {
            $conditions[] = '(r.reparto IS NULL OR TRIM(r.reparto) = \'\')';
        } else {
            $conditions[] = 'r.reparto = :reparto';
            $params[':reparto'] = $filters['reparto'];
        }
    }

    if ($filters['room_code'] !== '') {
        $conditions[] = 'r.room_code = :room_code';
        $params[':room_code'] = $filters['room_code'];
    }

    if ($filters['apparecchiatura'] !== '') {
        $conditions[] = 'ra.apparecchiatura = :apparecchiatura';
        $params[':apparecchiatura'] = $filters['apparecchiatura'];
    }

    $where = implode(' AND ', $conditions);
    $sql = "SELECT
            r.blocco AS blocco,
            r.piano AS piano,
            r.reparto AS reparto,
            r.room_code AS roomCode,
            ra.apparecchiatura AS apparecchiatura,
            ra.tipologia AS tipologia,
            ra.produttore AS produttore,
            ra.modello AS modello,
            ra.qta AS qta,
            ra.nuovo AS nuovo,
            ra.trasferimento AS trasferimento,
            ra.inv AS inv,
            ra.note AS note
        FROM room_apparecchiature ra
        INNER JOIN rooms r ON r.id = ra.room_id
        WHERE {$where}
        ORDER BY r.blocco ASC, CAST(r.piano AS SIGNED) ASC, r.room_code ASC, ra.sort_order ASC, ra.id ASC";

    $statement = $pdo->prepare($sql);
    $statement->execute($params);
    $rows = $statement->fetchAll();

    if (!is_array($rows)) {
        return [];
    }

    foreach ($rows as &$row) {
        if (!is_array($row)) {
            continue;
        }
        $row['inv'] = estrazioniNormalizeInventoryListForResponse($row['inv'] ?? null);
    }
    unset($row);

    /** @var list<array<string, mixed>> $rows */
    return $rows;
}

function estrazioniLabelBlocco(?string $value): string
{
    if ($value === null || $value === '') {
        return '';
    }

    return match ($value) {
        'nord' => 'Blocco Nord',
        'sud' => 'Blocco Sud',
        'piastra' => 'Piastra Centrale',
        'sotterraneo' => 'Interrato',
        default => $value,
    };
}

function estrazioniLabelPiano(?string $piano): string
{
    if ($piano === null || $piano === '') {
        return '';
    }

    if (preg_match('/^-?\d+$/', $piano) === 1) {
        $n = (int)$piano;
        if ($n < 0) {
            return 'Piano ' . $n;
        }
    }

    return 'Piano ' . $piano;
}

/**
 * @param array<string, mixed> $row
 * @return list<string|int|float>
 */
function estrazioniRowToSpreadsheetLine(array $row): array
{
    $inv = $row['inv'] ?? null;
    $invText = is_array($inv) ? implode(', ', $inv) : (string)($inv ?? '');

    return [
        estrazioniLabelBlocco(isset($row['blocco']) ? (string)$row['blocco'] : ''),
        estrazioniLabelPiano(isset($row['piano']) ? (string)$row['piano'] : ''),
        isset($row['reparto']) ? (string)$row['reparto'] : '',
        isset($row['roomCode']) ? (string)$row['roomCode'] : '',
        isset($row['apparecchiatura']) ? (string)$row['apparecchiatura'] : '',
        isset($row['tipologia']) ? (string)$row['tipologia'] : '',
        isset($row['produttore']) ? (string)$row['produttore'] : '',
        isset($row['modello']) ? (string)$row['modello'] : '',
        isset($row['qta']) ? (string)$row['qta'] : '',
        isset($row['nuovo']) ? (string)$row['nuovo'] : '',
        isset($row['trasferimento']) ? (string)$row['trasferimento'] : '',
        $invText,
        isset($row['note']) ? (string)$row['note'] : '',
    ];
}
