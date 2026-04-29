<?php

declare(strict_types=1);

require __DIR__ . '/database.php';
require_once __DIR__ . '/utils.php';
require_once __DIR__ . '/catalog-utils.php';

header('Content-Type: application/json; charset=utf-8');

if (!in_array($_SERVER['REQUEST_METHOD'], ['GET', 'POST'], true)) {
    apiErrorResponse('Metodo non consentito', 405);
}

function readCatalogType(): string
{
    $type = trim((string)($_REQUEST['type'] ?? ''));
    if ($type === '') {
        apiErrorResponse('type obbligatorio');
    }
    try {
        getCatalogTableByType($type);
    } catch (InvalidArgumentException $invalidArgumentException) {
        apiErrorResponse($invalidArgumentException->getMessage());
    }
    return $type;
}

try {
    $pdo = getDatabaseConnection();
    $action = trim((string)($_REQUEST['action'] ?? 'list'));
    $type = readCatalogType();
    $tableName = getCatalogTableByType($type);

    if ($action === 'list' && $_SERVER['REQUEST_METHOD'] === 'GET') {
        $activeOnly = trim((string)($_GET['activeOnly'] ?? '1')) !== '0';
        echo json_encode([
            'ok' => true,
            'type' => $type,
            'rows' => fetchCatalogRows($pdo, $tableName, $activeOnly),
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $rawBody = file_get_contents('php://input');
    $payload = json_decode($rawBody ?: '', true);
    if (!is_array($payload)) {
        apiErrorResponse('Payload JSON non valido');
    }

    if ($action === 'upsert') {
        $label = trim((string)($payload['label'] ?? ''));
        try {
            assertValidCatalogLabel($label);
        } catch (InvalidArgumentException $invalidArgumentException) {
            apiErrorResponse($invalidArgumentException->getMessage());
        }
        $code = trim((string)($payload['code'] ?? ''));
        if ($code === '') {
            $code = normalizeCatalogCode($label);
        }
        $code = normalizeCatalogCode($code);
        try {
            assertValidCatalogCode($code);
        } catch (InvalidArgumentException $invalidArgumentException) {
            apiErrorResponse($invalidArgumentException->getMessage());
        }
        $sortOrder = (int)($payload['sortOrder'] ?? 0);
        $isActive = (int)($payload['isActive'] ?? 1) === 0 ? 0 : 1;

        $statement = $pdo->prepare(
            "INSERT INTO {$tableName} (code, label, sort_order, is_active)
             VALUES (:code, :label, :sort_order, :is_active)
             ON DUPLICATE KEY UPDATE
               label = VALUES(label),
               code = VALUES(code),
               sort_order = VALUES(sort_order),
               is_active = VALUES(is_active),
               updated_at = CURRENT_TIMESTAMP"
        );
        $statement->execute([
            ':code' => $code,
            ':label' => $label,
            ':sort_order' => $sortOrder,
            ':is_active' => $isActive,
        ]);

        echo json_encode([
            'ok' => true,
            'type' => $type,
            'rows' => fetchCatalogRows($pdo, $tableName, false),
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($action === 'setActive') {
        $id = (int)($payload['id'] ?? 0);
        if ($id <= 0) {
            apiErrorResponse('id obbligatorio');
        }
        $isActive = (int)($payload['isActive'] ?? 1) === 0 ? 0 : 1;
        $statement = $pdo->prepare(
            "UPDATE {$tableName} SET is_active = :is_active, updated_at = CURRENT_TIMESTAMP WHERE id = :id"
        );
        $statement->execute([
            ':is_active' => $isActive,
            ':id' => $id,
        ]);

        echo json_encode([
            'ok' => true,
            'type' => $type,
            'rows' => fetchCatalogRows($pdo, $tableName, false),
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    apiErrorResponse('action non valida (list|upsert|setActive)');
} catch (Throwable $throwable) {
    apiErrorResponse('Errore cataloghi: ' . $throwable->getMessage(), 500);
}
