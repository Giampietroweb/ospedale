<?php

declare(strict_types=1);

require __DIR__ . '/database.php';
require_once __DIR__ . '/estrazioni-query.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Metodo non consentito'], JSON_UNESCAPED_UNICODE);
    exit;
}

function errorResponse(string $message, int $statusCode = 400): void
{
    http_response_code($statusCode);
    echo json_encode(['ok' => false, 'error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

function readBloccoParam(): string
{
    return trim((string)($_GET['blocco'] ?? ''));
}

function readPianoParam(): string
{
    return trim((string)($_GET['piano'] ?? ''));
}

function readTipoParam(): string
{
    $tipo = trim((string)($_GET['tipo'] ?? 'apparecchiature'));
    if (!in_array($tipo, ESTRAZIONI_VALID_TIPI, true)) {
        errorResponse('tipo non valido');
    }

    return $tipo;
}

function assertValidBlocco(string $blocco): void
{
    if (!in_array($blocco, ESTRAZIONI_VALID_BLOCCHI, true)) {
        errorResponse('blocco non valido');
    }
}

function assertValidPiano(string $piano): void
{
    if ($piano === '' || !preg_match('/^-?\d+$/', $piano)) {
        errorResponse('piano non valido');
    }
}

/**
 * @return list<string>
 */
function fetchDistinctStrings(PDO $pdo, string $sql, array $params = []): array
{
    $statement = $pdo->prepare($sql);
    $statement->execute($params);
    $rows = $statement->fetchAll(PDO::FETCH_COLUMN, 0);
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

/**
 * @return array{reparti: list<string>, hasEmptyReparto: bool, stanze: list<string>}
 */
function fetchRepartiAndStanze(PDO $pdo, string $whereSql = '', array $params = []): array
{
    $repartiStatement = $pdo->prepare(
        'SELECT DISTINCT reparto
         FROM rooms'
        . ($whereSql !== '' ? " WHERE {$whereSql}" : '')
        . ' ORDER BY reparto IS NULL, reparto ASC'
    );
    $repartiStatement->execute($params);
    $repartiRows = $repartiStatement->fetchAll(PDO::FETCH_COLUMN, 0);

    $reparti = [];
    $hasEmptyReparto = false;
    if (is_array($repartiRows)) {
        foreach ($repartiRows as $cell) {
            if ($cell === null || trim((string)$cell) === '') {
                $hasEmptyReparto = true;
                continue;
            }
            $reparti[] = trim((string)$cell);
        }
    }
    $reparti = array_values(array_unique($reparti));

    $stanze = fetchDistinctStrings(
        $pdo,
        'SELECT DISTINCT room_code
         FROM rooms'
        . ($whereSql !== '' ? " WHERE {$whereSql}" : '')
        . ' ORDER BY room_code ASC',
        $params
    );

    return [
        'reparti' => $reparti,
        'hasEmptyReparto' => $hasEmptyReparto,
        'stanze' => $stanze,
    ];
}

function handleOptions(PDO $pdo): void
{
    $tipo = readTipoParam();
    $blocco = readBloccoParam();
    $piano = readPianoParam();

    if ($blocco === '' && $piano === '') {
        $blocchi = fetchDistinctStrings(
            $pdo,
            'SELECT DISTINCT blocco FROM rooms ORDER BY blocco ASC'
        );
        $piani = fetchDistinctStrings(
            $pdo,
            'SELECT DISTINCT piano FROM rooms ORDER BY CAST(piano AS SIGNED) ASC, piano ASC'
        );
        $roomFilters = fetchRepartiAndStanze($pdo);
        $dettaglioChoices = fetchEstrazioniDettaglioChoices($pdo, $tipo, '', '');

        echo json_encode([
            'ok' => true,
            'tipo' => $tipo,
            'blocchi' => $blocchi,
            'piani' => $piani,
            'reparti' => $roomFilters['reparti'],
            'hasEmptyReparto' => $roomFilters['hasEmptyReparto'],
            'stanze' => $roomFilters['stanze'],
            'dettaglioChoices' => $dettaglioChoices,
            'apparecchiature' => $tipo === 'apparecchiature' ? $dettaglioChoices : [],
        ], JSON_UNESCAPED_UNICODE);
        return;
    }

    if ($blocco !== '') {
        assertValidBlocco($blocco);
    }
    if ($piano !== '') {
        assertValidPiano($piano);
    }

    if ($blocco !== '' && $piano === '') {
        $piani = fetchDistinctStrings(
            $pdo,
            'SELECT DISTINCT piano FROM rooms WHERE blocco = :blocco ORDER BY CAST(piano AS SIGNED) ASC, piano ASC',
            [':blocco' => $blocco]
        );
        $roomFilters = fetchRepartiAndStanze(
            $pdo,
            'blocco = :blocco',
            [':blocco' => $blocco]
        );

        $dettaglioChoices = fetchEstrazioniDettaglioChoices($pdo, $tipo, $blocco, '');

        echo json_encode([
            'ok' => true,
            'tipo' => $tipo,
            'piani' => $piani,
            'reparti' => $roomFilters['reparti'],
            'hasEmptyReparto' => $roomFilters['hasEmptyReparto'],
            'stanze' => $roomFilters['stanze'],
            'dettaglioChoices' => $dettaglioChoices,
            'apparecchiature' => $tipo === 'apparecchiature' ? $dettaglioChoices : [],
        ], JSON_UNESCAPED_UNICODE);
        return;
    }

    $whereParts = [];
    $params = [];
    if ($blocco !== '') {
        $whereParts[] = 'blocco = :blocco';
        $params[':blocco'] = $blocco;
    }
    if ($piano !== '') {
        $whereParts[] = 'piano = :piano';
        $params[':piano'] = $piano;
    }
    $whereSql = implode(' AND ', $whereParts);
    $roomFilters = fetchRepartiAndStanze($pdo, $whereSql, $params);
    $dettaglioChoices = fetchEstrazioniDettaglioChoices($pdo, $tipo, $blocco, $piano);

    echo json_encode([
        'ok' => true,
        'tipo' => $tipo,
        'reparti' => $roomFilters['reparti'],
        'hasEmptyReparto' => $roomFilters['hasEmptyReparto'],
        'stanze' => $roomFilters['stanze'],
        'dettaglioChoices' => $dettaglioChoices,
        'apparecchiature' => $tipo === 'apparecchiature' ? $dettaglioChoices : [],
    ], JSON_UNESCAPED_UNICODE);
}

function handleSearch(PDO $pdo): void
{
    try {
        $filters = parseEstrazioniFiltersFromGet($_GET);
    } catch (InvalidArgumentException $invalidArgument) {
        errorResponse($invalidArgument->getMessage());
    }

    $rows = fetchEstrazioniRows($pdo, $filters);

    echo json_encode([
        'ok' => true,
        'tipo' => $filters['tipo'],
        'rows' => $rows,
    ], JSON_UNESCAPED_UNICODE);
}

$action = trim((string)($_GET['action'] ?? ''));

try {
    $pdo = getDatabaseConnection();

    if ($action === 'options') {
        handleOptions($pdo);
        return;
    }

    if ($action === 'search') {
        handleSearch($pdo);
        return;
    }

    errorResponse('action non valido (options|search)');
} catch (Throwable $throwable) {
    errorResponse('Errore: ' . $throwable->getMessage(), 500);
}
