<?php

declare(strict_types=1);

require __DIR__ . '/database.php';
require_once __DIR__ . '/utils.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    apiErrorResponse('Metodo non consentito', 405);
}

function parseJsonField(?string $raw): mixed
{
    if ($raw === null || trim($raw) === '') {
        return null;
    }
    $decoded = json_decode($raw, true);
    return json_last_error() === JSON_ERROR_NONE ? $decoded : null;
}

function normalizeOutcome(?string $value): ?string
{
    if ($value === null || $value === '') {
        return null;
    }
    $allowed = ['success', 'error', 'pending'];
    if (!in_array($value, $allowed, true)) {
        apiErrorResponse('outcome non valido');
    }
    return $value;
}

$outcome = normalizeOutcome(isset($_GET['outcome']) ? trim((string)$_GET['outcome']) : null);
if ($outcome === null) {
    $outcome = normalizeOutcome(isset($_GET['status']) ? trim((string)$_GET['status']) : null);
}

$action = isset($_GET['action']) ? trim((string)$_GET['action']) : '';
$roomQuery = isset($_GET['roomQuery']) ? trim((string)$_GET['roomQuery']) : '';
if ($roomQuery === '') {
    $roomQuery = isset($_GET['room']) ? trim((string)$_GET['room']) : '';
}
$since = isset($_GET['since']) ? trim((string)$_GET['since']) : '';

$limit = (int)($_GET['limit'] ?? 200);
if ($limit <= 0) $limit = 200;
if ($limit > 500) $limit = 500;

$offset = (int)($_GET['offset'] ?? 0);
if ($offset < 0) $offset = 0;

if ($since !== '' && strtotime($since) === false) {
    apiErrorResponse('since non valido');
}

$whereParts = [];
$params = [];

if ($outcome !== null) {
    $whereParts[] = 'outcome = :outcome';
    $params[':outcome'] = $outcome;
}
if ($action !== '') {
    $whereParts[] = 'action = :action';
    $params[':action'] = $action;
}
if ($roomQuery !== '') {
    $whereParts[] = '(blocco LIKE :room_like OR piano LIKE :room_like OR room_code LIKE :room_like OR room_ref LIKE :room_like)';
    $params[':room_like'] = '%' . $roomQuery . '%';
}
if ($since !== '') {
    $whereParts[] = 'created_at >= :since';
    $params[':since'] = date('Y-m-d H:i:s', strtotime($since));
}

$whereSql = $whereParts === [] ? '' : ('WHERE ' . implode(' AND ', $whereParts));

try {
    $pdo = getDatabaseConnection();

    $rowsSql = "SELECT
          operation_id,
          action,
          room_ref,
          blocco,
          piano,
          room_code,
          request_payload,
          response_payload,
          error_message,
          outcome,
          created_at,
          processed_at
        FROM sync_operations
        {$whereSql}
        ORDER BY COALESCE(processed_at, created_at) DESC
        LIMIT :limit OFFSET :offset";

    $rowsStmt = $pdo->prepare($rowsSql);
    foreach ($params as $key => $value) {
        $rowsStmt->bindValue($key, $value, PDO::PARAM_STR);
    }
    $rowsStmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $rowsStmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $rowsStmt->execute();
    $rawRows = $rowsStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $statsSql = "SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN outcome = 'success' THEN 1 ELSE 0 END) AS success_count,
          SUM(CASE WHEN outcome = 'error' THEN 1 ELSE 0 END) AS error_count,
          SUM(CASE WHEN outcome = 'pending' THEN 1 ELSE 0 END) AS pending_count,
          MAX(CASE WHEN outcome = 'success' THEN processed_at ELSE NULL END) AS last_success_at
        FROM sync_operations
        {$whereSql}";
    $statsStmt = $pdo->prepare($statsSql);
    foreach ($params as $key => $value) {
        $statsStmt->bindValue($key, $value, PDO::PARAM_STR);
    }
    $statsStmt->execute();
    $statsRow = $statsStmt->fetch(PDO::FETCH_ASSOC) ?: [];

    $rows = array_map(static function (array $row): array {
        $roomRef = parseJsonField($row['room_ref'] ?? null);
        if (!is_array($roomRef)) {
            $roomRef = [
                'blocco' => $row['blocco'] ?? null,
                'piano' => $row['piano'] ?? null,
                'roomCode' => $row['room_code'] ?? null,
            ];
        }
        return [
            'operationId' => $row['operation_id'],
            'action' => $row['action'],
            'outcome' => $row['outcome'],
            'roomRef' => $roomRef,
            'createdAt' => sqlDateTimeToIso($row['created_at'] ?? null),
            'processedAt' => sqlDateTimeToIso($row['processed_at'] ?? null),
            'errorMessage' => $row['error_message'],
            'requestPayload' => parseJsonField($row['request_payload'] ?? null),
            'responsePayload' => parseJsonField($row['response_payload'] ?? null),
        ];
    }, $rawRows);

    echo json_encode([
        'ok' => true,
        'rows' => $rows,
        'stats' => [
            'total' => (int)($statsRow['total'] ?? 0),
            'success' => (int)($statsRow['success_count'] ?? 0),
            'error' => (int)($statsRow['error_count'] ?? 0),
            'pending' => (int)($statsRow['pending_count'] ?? 0),
            'lastSuccessAt' => sqlDateTimeToIso($statsRow['last_success_at'] ?? null),
        ],
        'pagination' => [
            'limit' => $limit,
            'offset' => $offset,
        ],
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $throwable) {
    apiErrorResponse('Errore storico sync: ' . $throwable->getMessage(), 500);
}
