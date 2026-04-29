<?php

declare(strict_types=1);

require_once __DIR__ . '/utils.php';

const ESTRAZIONI_VALID_BLOCCHI = ['nord', 'sud', 'piastra', 'sotterraneo'];
const ESTRAZIONI_VALID_TIPI = ['apparecchiature', 'impiantistica', 'altre_dotazioni'];

/**
 * Condizioni WHERE su alias `r` (rooms) condivise da tutte le estrazioni.
 *
 * @param array{
 *   blocco: string,
 *   piano: string,
 *   reparto_filter: bool,
 *   reparto_empty: bool,
 *   reparto: string,
 *   room_code: string
 * } $filters
 * @return array{0: string, 1: array<string, mixed>}
 */
function estrazioniBuildRoomWhereAndParams(array $filters): array
{
    $conditions = ['1=1'];
    $params = [];

    if ($filters['blocco'] !== '') {
        $conditions[] = 'r.blocco = :blocco';
        $params[':blocco'] = $filters['blocco'];
    }
    if ($filters['piano'] !== '') {
        $conditions[] = 'r.piano = :piano';
        $params[':piano'] = $filters['piano'];
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

    return [implode(' AND ', $conditions), $params];
}

/**
 * @return array{
 *   tipo: string,
 *   blocco: string,
 *   piano: string,
 *   reparto_filter: bool,
 *   reparto_empty: bool,
 *   reparto: string,
 *   room_code: string,
 *   dettaglio: string
 * }
 */
function parseEstrazioniFiltersFromGet(array $get): array
{
    $tipo = trim((string)($get['tipo'] ?? 'apparecchiature'));
    if (!in_array($tipo, ESTRAZIONI_VALID_TIPI, true)) {
        throw new InvalidArgumentException('tipo non valido');
    }

    $blocco = trim((string)($get['blocco'] ?? ''));
    $piano = trim((string)($get['piano'] ?? ''));
    $roomCode = trim((string)($get['room_code'] ?? ''));

    $dettaglio = trim((string)($get['dettaglio'] ?? ''));
    if ($dettaglio === '' && $tipo === 'apparecchiature') {
        $dettaglio = trim((string)($get['apparecchiatura'] ?? ''));
    }

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
        'tipo' => $tipo,
        'blocco' => $blocco,
        'piano' => $piano,
        'reparto_filter' => $repartoFilter,
        'reparto_empty' => $repartoEmpty,
        'reparto' => $reparto,
        'room_code' => $roomCode,
        'dettaglio' => $dettaglio,
    ];
}

/**
 * Lista DISTINCT per la tendina "dettaglio" in base al tipo e al contesto geografico (blocco/piano opzionali).
 *
 * @return list<string>
 */
function fetchEstrazioniDettaglioChoices(PDO $pdo, string $tipo, string $blocco, string $piano): array
{
    if (!in_array($tipo, ESTRAZIONI_VALID_TIPI, true)) {
        return [];
    }

    $filters = [
        'blocco' => $blocco,
        'piano' => $piano,
        'reparto_filter' => false,
        'reparto_empty' => false,
        'reparto' => '',
        'room_code' => '',
    ];
    [$roomWhere, $params] = estrazioniBuildRoomWhereAndParams($filters);

    if ($tipo === 'apparecchiature') {
        $sql = "SELECT v
            FROM (
              SELECT ca.label AS v, ca.sort_order AS sort_order
              FROM catalog_apparecchiature ca
              WHERE ca.is_active = 1
              UNION
              SELECT COALESCE(ca.label, ra.apparecchiatura) AS v, 999999 AS sort_order
              FROM room_apparecchiature ra
              LEFT JOIN catalog_apparecchiature ca ON ca.id = ra.catalog_apparecchiatura_id
              INNER JOIN rooms r ON r.id = ra.room_id
              WHERE ({$roomWhere})
                AND COALESCE(ca.label, ra.apparecchiatura) IS NOT NULL
                AND TRIM(COALESCE(ca.label, ra.apparecchiatura)) <> ''
            ) choices
            GROUP BY v
            ORDER BY MIN(sort_order) ASC, v ASC";
    } elseif ($tipo === 'impiantistica') {
        $sql = "SELECT v
            FROM (
              SELECT ci.label AS v, ci.sort_order AS sort_order
              FROM catalog_impiantistica ci
              WHERE ci.is_active = 1
              UNION
              SELECT COALESCE(ci.label, ri.tipologia) AS v, 999999 AS sort_order
              FROM room_impiantistica ri
              LEFT JOIN catalog_impiantistica ci ON ci.id = ri.catalog_impiantistica_id
              INNER JOIN rooms r ON r.id = ri.room_id
              WHERE ({$roomWhere})
                AND COALESCE(ci.label, ri.tipologia) IS NOT NULL
                AND TRIM(COALESCE(ci.label, ri.tipologia)) <> ''
            ) choices
            GROUP BY v
            ORDER BY MIN(sort_order) ASC, v ASC";
    } else {
        $sql = "SELECT v
            FROM (
              SELECT cad.label AS v, cad.sort_order AS sort_order
              FROM catalog_altre_dotazioni cad
              WHERE cad.is_active = 1
              UNION
              SELECT COALESCE(cad.label, rad.altra_dotazione) AS v, 999999 AS sort_order
              FROM room_altre_dotazioni rad
              LEFT JOIN catalog_altre_dotazioni cad ON cad.id = rad.catalog_altra_dotazione_id
              INNER JOIN rooms r ON r.id = rad.room_id
              WHERE ({$roomWhere})
                AND COALESCE(cad.label, rad.altra_dotazione) IS NOT NULL
                AND TRIM(COALESCE(cad.label, rad.altra_dotazione)) <> ''
            ) choices
            GROUP BY v
            ORDER BY MIN(sort_order) ASC, v ASC";
    }

    try {
        $statement = $pdo->prepare($sql);
        $statement->execute($params);
        $rows = $statement->fetchAll(PDO::FETCH_COLUMN, 0);
    } catch (Throwable) {
        return fetchEstrazioniDettaglioChoicesLegacy($pdo, $tipo, $blocco, $piano);
    }
    if (!is_array($rows)) {
        return [];
    }

    $out = [];
    foreach ($rows as $cell) {
        if ($cell === null) {
            continue;
        }
        $s = trim((string)$cell);
        if ($s !== '') {
            $out[] = $s;
        }
    }

    return array_values(array_unique($out));
}

function fetchEstrazioniDettaglioChoicesLegacy(PDO $pdo, string $tipo, string $blocco, string $piano): array
{
    if (!in_array($tipo, ESTRAZIONI_VALID_TIPI, true)) {
        return [];
    }

    $filters = [
        'blocco' => $blocco,
        'piano' => $piano,
        'reparto_filter' => false,
        'reparto_empty' => false,
        'reparto' => '',
        'room_code' => '',
    ];
    [$roomWhere, $params] = estrazioniBuildRoomWhereAndParams($filters);

    if ($tipo === 'apparecchiature') {
        $sql = "SELECT DISTINCT ra.apparecchiatura AS v
            FROM room_apparecchiature ra
            INNER JOIN rooms r ON r.id = ra.room_id
            WHERE ({$roomWhere})
              AND ra.apparecchiatura IS NOT NULL AND TRIM(ra.apparecchiatura) <> ''
            ORDER BY ra.apparecchiatura ASC";
    } elseif ($tipo === 'impiantistica') {
        $sql = "SELECT DISTINCT ri.tipologia AS v
            FROM room_impiantistica ri
            INNER JOIN rooms r ON r.id = ri.room_id
            WHERE ({$roomWhere})
              AND ri.tipologia IS NOT NULL AND TRIM(ri.tipologia) <> ''
            ORDER BY ri.tipologia ASC";
    } else {
        $sql = "SELECT DISTINCT rad.altra_dotazione AS v
            FROM room_altre_dotazioni rad
            INNER JOIN rooms r ON r.id = rad.room_id
            WHERE ({$roomWhere})
              AND rad.altra_dotazione IS NOT NULL AND TRIM(rad.altra_dotazione) <> ''
            ORDER BY rad.altra_dotazione ASC";
    }

    $statement = $pdo->prepare($sql);
    $statement->execute($params);
    $rows = $statement->fetchAll(PDO::FETCH_COLUMN, 0);
    return is_array($rows) ? array_values(array_unique(array_map('strval', $rows))) : [];
}

/**
 * @param array<string, mixed> $filters
 * @return list<array<string, mixed>>
 */
function fetchEstrazioniApparecchiatureRows(PDO $pdo, array $filters): array
{
    [$roomWhere, $params] = estrazioniBuildRoomWhereAndParams($filters);

    if ($filters['dettaglio'] !== '') {
        $roomWhere .= ' AND COALESCE(ca.label, ra.apparecchiatura) = :dettaglio';
        $params[':dettaglio'] = $filters['dettaglio'];
    }

    $sql = "SELECT
            r.blocco AS blocco,
            r.piano AS piano,
            r.reparto AS reparto,
            r.room_code AS roomCode,
            COALESCE(ca.label, ra.apparecchiatura) AS apparecchiatura,
            ra.tipologia AS tipologia,
            ra.produttore AS produttore,
            ra.modello AS modello,
            ra.qta AS qta,
            ra.nuovo AS nuovo,
            ra.trasferimento AS trasferimento,
            ra.inv AS inv,
            ra.note AS note
        FROM room_apparecchiature ra
        LEFT JOIN catalog_apparecchiature ca ON ca.id = ra.catalog_apparecchiatura_id
        INNER JOIN rooms r ON r.id = ra.room_id
        WHERE {$roomWhere}
        ORDER BY r.blocco ASC, CAST(r.piano AS SIGNED) ASC, r.room_code ASC, ra.sort_order ASC, ra.id ASC";

    $statement = $pdo->prepare($sql);
    $statement->execute($params);
    $rows = $statement->fetchAll(PDO::FETCH_ASSOC);

    if (!is_array($rows)) {
        return [];
    }

    foreach ($rows as &$row) {
        if (!is_array($row)) {
            continue;
        }
        $row['inv'] = normalizeInventoryListForResponse($row['inv'] ?? null);
    }
    unset($row);

    /** @var list<array<string, mixed>> $rows */
    return $rows;
}

/**
 * @param array<string, mixed> $filters
 * @return list<array<string, mixed>>
 */
function fetchEstrazioniImpiantisticaRows(PDO $pdo, array $filters): array
{
    [$roomWhere, $params] = estrazioniBuildRoomWhereAndParams($filters);

    if ($filters['dettaglio'] !== '') {
        $roomWhere .= ' AND COALESCE(ci.label, ri.tipologia) = :dettaglio';
        $params[':dettaglio'] = $filters['dettaglio'];
    }

    $sql = "SELECT
            r.blocco AS blocco,
            r.piano AS piano,
            r.reparto AS reparto,
            r.room_code AS roomCode,
            COALESCE(ci.label, ri.tipologia) AS tipologiaImpianto,
            ri.qta_presenti AS qtaPresenti,
            ri.qta_da_implementare AS qtaDaImplementare,
            ri.note AS note
        FROM room_impiantistica ri
        LEFT JOIN catalog_impiantistica ci ON ci.id = ri.catalog_impiantistica_id
        INNER JOIN rooms r ON r.id = ri.room_id
        WHERE {$roomWhere}
        ORDER BY r.blocco ASC, CAST(r.piano AS SIGNED) ASC, r.room_code ASC, ri.sort_order ASC, ri.id ASC";

    $statement = $pdo->prepare($sql);
    $statement->execute($params);
    $rows = $statement->fetchAll(PDO::FETCH_ASSOC);

    return is_array($rows) ? $rows : [];
}

/**
 * @param array<string, mixed> $filters
 * @return list<array<string, mixed>>
 */
function fetchEstrazioniAltreDotazioniRows(PDO $pdo, array $filters): array
{
    [$roomWhere, $params] = estrazioniBuildRoomWhereAndParams($filters);

    if ($filters['dettaglio'] !== '') {
        $roomWhere .= ' AND COALESCE(cad.label, rad.altra_dotazione) = :dettaglio';
        $params[':dettaglio'] = $filters['dettaglio'];
    }

    $sql = "SELECT
            r.blocco AS blocco,
            r.piano AS piano,
            r.reparto AS reparto,
            r.room_code AS roomCode,
            COALESCE(cad.label, rad.altra_dotazione) AS altraDotazione,
            rad.presente AS presente,
            rad.da_implementare AS daImplementare,
            rad.note AS note
        FROM room_altre_dotazioni rad
        LEFT JOIN catalog_altre_dotazioni cad ON cad.id = rad.catalog_altra_dotazione_id
        INNER JOIN rooms r ON r.id = rad.room_id
        WHERE {$roomWhere}
        ORDER BY r.blocco ASC, CAST(r.piano AS SIGNED) ASC, r.room_code ASC, rad.sort_order ASC, rad.id ASC";

    $statement = $pdo->prepare($sql);
    $statement->execute($params);
    $rows = $statement->fetchAll(PDO::FETCH_ASSOC);

    return is_array($rows) ? $rows : [];
}

/**
 * @param array<string, mixed> $filters
 * @return list<array<string, mixed>>
 */
function fetchEstrazioniRows(PDO $pdo, array $filters): array
{
    $tipo = $filters['tipo'];

    return match ($tipo) {
        'impiantistica' => fetchEstrazioniImpiantisticaRows($pdo, $filters),
        'altre_dotazioni' => fetchEstrazioniAltreDotazioniRows($pdo, $filters),
        default => fetchEstrazioniApparecchiatureRows($pdo, $filters),
    };
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
 * @return list<string>
 */
function estrazioniExportHeadersForTipo(string $tipo): array
{
    return match ($tipo) {
        'impiantistica' => [
            'Blocco',
            'Piano',
            'Reparto',
            'ID Stanza',
            'Tipologia impiantistica',
            'Q.tà presenti',
            'Q.tà da implementare',
            'Note',
        ],
        'altre_dotazioni' => [
            'Blocco',
            'Piano',
            'Reparto',
            'ID Stanza',
            'Altra dotazione',
            'Presente',
            'Da implementare',
            'Note',
        ],
        default => [
            'Blocco',
            'Piano',
            'Reparto',
            'ID Stanza',
            'Apparecchiatura',
            'Tipologia',
            'Produttore',
            'Modello',
            'Q.tà',
            'Nuovo',
            'Trasferimento',
            'Inv.',
            'Note',
        ],
    };
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

/**
 * @param array<string, mixed> $row
 * @return list<string|int|float>
 */
function estrazioniImpiantisticaRowToSpreadsheetLine(array $row): array
{
    return [
        estrazioniLabelBlocco(isset($row['blocco']) ? (string)$row['blocco'] : ''),
        estrazioniLabelPiano(isset($row['piano']) ? (string)$row['piano'] : ''),
        isset($row['reparto']) ? (string)$row['reparto'] : '',
        isset($row['roomCode']) ? (string)$row['roomCode'] : '',
        isset($row['tipologiaImpianto']) ? (string)$row['tipologiaImpianto'] : '',
        isset($row['qtaPresenti']) && $row['qtaPresenti'] !== null && $row['qtaPresenti'] !== '' ? (string)$row['qtaPresenti'] : '',
        isset($row['qtaDaImplementare']) && $row['qtaDaImplementare'] !== null && $row['qtaDaImplementare'] !== '' ? (string)$row['qtaDaImplementare'] : '',
        isset($row['note']) ? (string)$row['note'] : '',
    ];
}

/**
 * @param array<string, mixed> $row
 * @return list<string|int|float>
 */
function estrazioniAltreDotazioniRowToSpreadsheetLine(array $row): array
{
    return [
        estrazioniLabelBlocco(isset($row['blocco']) ? (string)$row['blocco'] : ''),
        estrazioniLabelPiano(isset($row['piano']) ? (string)$row['piano'] : ''),
        isset($row['reparto']) ? (string)$row['reparto'] : '',
        isset($row['roomCode']) ? (string)$row['roomCode'] : '',
        isset($row['altraDotazione']) ? (string)$row['altraDotazione'] : '',
        isset($row['presente']) ? (string)$row['presente'] : '',
        isset($row['daImplementare']) ? (string)$row['daImplementare'] : '',
        isset($row['note']) ? (string)$row['note'] : '',
    ];
}

/**
 * @param array<string, mixed> $row
 * @return list<string|int|float>
 */
function estrazioniExportRowToLine(string $tipo, array $row): array
{
    return match ($tipo) {
        'impiantistica' => estrazioniImpiantisticaRowToSpreadsheetLine($row),
        'altre_dotazioni' => estrazioniAltreDotazioniRowToSpreadsheetLine($row),
        default => estrazioniRowToSpreadsheetLine($row),
    };
}

/**
 * @return list<string>
 */
function estrazioniExportColumnLettersForTipo(string $tipo): array
{
    return match ($tipo) {
        'impiantistica', 'altre_dotazioni' => range('A', 'H'),
        default => range('A', 'M'),
    };
}
