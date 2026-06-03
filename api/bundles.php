<?php

declare(strict_types=1);

require __DIR__ . '/database.php';
require_once __DIR__ . '/utils.php';
require_once __DIR__ . '/catalog-utils.php';

header('Content-Type: application/json; charset=utf-8');

if (!in_array($_SERVER['REQUEST_METHOD'], ['GET', 'POST'], true)) {
    apiErrorResponse('Metodo non consentito', 405);
}

function asNullableBundleString(mixed $value): ?string
{
    $trimmed = trim((string)($value ?? ''));
    if ($trimmed === '' || $trimmed === '-' || strtolower($trimmed) === 'null') {
        return null;
    }
    return $trimmed;
}

function normalizeBundleItemRow(PDO $pdo, array $row, int $sortOrder): ?array
{
    $apparecchiatura = asNullableBundleString($row['apparecchiatura'] ?? null);
    if ($apparecchiatura === null) {
        return null;
    }

    $catalogApparecchiaturaId = resolveCatalogIdByLabel($pdo, 'catalog_apparecchiature', $apparecchiatura);

    return [
        'catalog_apparecchiatura_id' => $catalogApparecchiaturaId,
        'apparecchiatura' => $apparecchiatura,
        'tipologia' => asNullableBundleString($row['tipologia'] ?? null),
        'produttore' => asNullableBundleString($row['produttore'] ?? null),
        'modello' => asNullableBundleString($row['modello'] ?? null),
        'qta' => asNullableBundleString($row['qta'] ?? null),
        'nuovo' => asNullableBundleString($row['nuovo'] ?? null),
        'trasferimento' => asNullableBundleString($row['trasferimento'] ?? null),
        'note' => asNullableBundleString($row['note'] ?? null),
        'sort_order' => $sortOrder,
    ];
}

function propagateBundleChangesToRooms(PDO $pdo, int $bundleId, array $normalizedItems): void
{
    $roomsStatement = $pdo->prepare(
        'SELECT DISTINCT room_id FROM room_apparecchiature WHERE bundle_id = :bundle_id'
    );
    $roomsStatement->execute([':bundle_id' => $bundleId]);
    $affectedRoomIds = $roomsStatement->fetchAll(PDO::FETCH_COLUMN, 0);

    if (!is_array($affectedRoomIds) || $affectedRoomIds === []) {
        return;
    }

    $insertRoomRowStatement = $pdo->prepare(
        'INSERT INTO room_apparecchiature (
            room_id, catalog_apparecchiatura_id, bundle_id,
            apparecchiatura, tipologia, produttore, modello,
            qta, nuovo, trasferimento, inv, note, sort_order
         ) VALUES (
            :room_id, :catalog_apparecchiatura_id, :bundle_id,
            :apparecchiatura, :tipologia, :produttore, :modello,
            :qta, :nuovo, :trasferimento, :inv, :note, :sort_order
         )'
    );

    foreach ($affectedRoomIds as $rawRoomId) {
        $roomId = (int)$rawRoomId;

        // Legge le righe bundle esistenti per questa stanza (sort_order e inv da preservare)
        $existingRowsStatement = $pdo->prepare(
            'SELECT sort_order, inv
             FROM room_apparecchiature
             WHERE room_id = :room_id AND bundle_id = :bundle_id
             ORDER BY sort_order ASC, id ASC'
        );
        $existingRowsStatement->execute([':room_id' => $roomId, ':bundle_id' => $bundleId]);
        $existingRows = $existingRowsStatement->fetchAll(PDO::FETCH_ASSOC);
        if (!is_array($existingRows)) {
            $existingRows = [];
        }

        // Rimuove tutte le righe bundle dalla stanza
        $pdo->prepare(
            'DELETE FROM room_apparecchiature WHERE room_id = :room_id AND bundle_id = :bundle_id'
        )->execute([':room_id' => $roomId, ':bundle_id' => $bundleId]);

        $nextSortOrder = null;

        foreach ($normalizedItems as $index => $item) {
            if (isset($existingRows[$index])) {
                $sortOrder = (int)$existingRows[$index]['sort_order'];
                $preservedInv = $existingRows[$index]['inv'];
            } else {
                // Nuovi item aggiunti al bundle: trova un sort_order libero
                if ($nextSortOrder === null) {
                    $maxStatement = $pdo->prepare(
                        'SELECT COALESCE(MAX(sort_order), -1)
                         FROM room_apparecchiature
                         WHERE room_id = :room_id'
                    );
                    $maxStatement->execute([':room_id' => $roomId]);
                    $nextSortOrder = (int)$maxStatement->fetchColumn() + 1;
                }
                $sortOrder = $nextSortOrder;
                $nextSortOrder++;
                $preservedInv = null;
            }

            $insertRoomRowStatement->execute([
                ':room_id'                    => $roomId,
                ':catalog_apparecchiatura_id' => $item['catalog_apparecchiatura_id'],
                ':bundle_id'                  => $bundleId,
                ':apparecchiatura'            => $item['apparecchiatura'],
                ':tipologia'                  => $item['tipologia'],
                ':produttore'                 => $item['produttore'],
                ':modello'                    => $item['modello'],
                ':qta'                        => $item['qta'],
                ':nuovo'                      => $item['nuovo'],
                ':trasferimento'              => $item['trasferimento'],
                ':inv'                        => $preservedInv,
                ':note'                       => $item['note'],
                ':sort_order'                 => $sortOrder,
            ]);
        }
    }
}

function fetchBundleItems(PDO $pdo, int $bundleId): array
{
    $statement = $pdo->prepare(
        'SELECT
            ebi.id,
            ebi.bundle_id AS bundleId,
            COALESCE(ca.label, ebi.apparecchiatura) AS apparecchiatura,
            ebi.tipologia,
            ebi.produttore,
            ebi.modello,
            ebi.qta,
            ebi.nuovo,
            ebi.trasferimento,
            ebi.note,
            ebi.sort_order AS sortOrder
         FROM equipment_bundle_items ebi
         LEFT JOIN catalog_apparecchiature ca ON ca.id = ebi.catalog_apparecchiatura_id
         WHERE ebi.bundle_id = :bundle_id
         ORDER BY ebi.sort_order ASC, ebi.id ASC'
    );
    $statement->execute([':bundle_id' => $bundleId]);
    $rows = $statement->fetchAll(PDO::FETCH_ASSOC);
    return is_array($rows) ? $rows : [];
}

function fetchBundleSummaryRows(PDO $pdo, bool $activeOnly): array
{
    $activeClause = $activeOnly ? 'WHERE eb.is_active = 1' : '';
    $statement = $pdo->query(
        "SELECT
            eb.id,
            eb.name,
            eb.description,
            eb.is_active AS isActive,
            COUNT(ebi.id) AS itemCount
         FROM equipment_bundles eb
         LEFT JOIN equipment_bundle_items ebi ON ebi.bundle_id = eb.id
         {$activeClause}
         GROUP BY eb.id, eb.name, eb.description, eb.is_active
         ORDER BY eb.name ASC"
    );
    $rows = $statement->fetchAll(PDO::FETCH_ASSOC);
    if (!is_array($rows)) {
        return [];
    }

    return array_map(static function (array $row): array {
        return [
            'id' => (int)$row['id'],
            'name' => (string)$row['name'],
            'description' => $row['description'],
            'isActive' => (int)$row['isActive'],
            'itemCount' => (int)$row['itemCount'],
        ];
    }, $rows);
}

try {
    $pdo = getDatabaseConnection();
    $action = trim((string)($_REQUEST['action'] ?? 'list'));

    if ($action === 'list' && $_SERVER['REQUEST_METHOD'] === 'GET') {
        $activeOnly = trim((string)($_GET['activeOnly'] ?? '1')) !== '0';
        $withItems = trim((string)($_GET['withItems'] ?? '0')) === '1';
        $bundles = fetchBundleSummaryRows($pdo, $activeOnly);

        if ($withItems) {
            foreach ($bundles as &$bundle) {
                $bundle['items'] = fetchBundleItems($pdo, (int)$bundle['id']);
            }
            unset($bundle);
        }

        echo json_encode(['ok' => true, 'bundles' => $bundles], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($action === 'get' && $_SERVER['REQUEST_METHOD'] === 'GET') {
        $bundleId = (int)($_GET['id'] ?? 0);
        if ($bundleId <= 0) {
            apiErrorResponse('id bundle obbligatorio');
        }

        $statement = $pdo->prepare(
            'SELECT id, name, description, is_active AS isActive
             FROM equipment_bundles
             WHERE id = :id
             LIMIT 1'
        );
        $statement->execute([':id' => $bundleId]);
        $bundle = $statement->fetch(PDO::FETCH_ASSOC);
        if (!is_array($bundle)) {
            apiErrorResponse('Bundle non trovato', 404);
        }

        echo json_encode([
            'ok' => true,
            'bundle' => [
                'id' => (int)$bundle['id'],
                'name' => (string)$bundle['name'],
                'description' => $bundle['description'],
                'isActive' => (int)$bundle['isActive'],
                'items' => fetchBundleItems($pdo, $bundleId),
            ],
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $rawBody = file_get_contents('php://input');
    $payload = json_decode($rawBody ?: '', true);
    if (!is_array($payload)) {
        apiErrorResponse('Payload JSON non valido');
    }

    if ($action === 'save' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $name = trim((string)($payload['name'] ?? ''));
        if ($name === '') {
            apiErrorResponse('name obbligatorio');
        }

        $description = asNullableBundleString($payload['description'] ?? null);
        $bundleId = (int)($payload['id'] ?? 0);
        $items = is_array($payload['items'] ?? null) ? $payload['items'] : [];

        $normalizedItems = [];
        foreach ($items as $index => $item) {
            if (!is_array($item)) {
                continue;
            }
            $normalizedItem = normalizeBundleItemRow($pdo, $item, $index);
            if ($normalizedItem !== null) {
                $normalizedItems[] = $normalizedItem;
            }
        }

        if ($normalizedItems === []) {
            apiErrorResponse('Almeno una apparecchiatura nel bundle');
        }

        $pdo->beginTransaction();

        if ($bundleId > 0) {
            $updateStatement = $pdo->prepare(
                'UPDATE equipment_bundles
                 SET name = :name, description = :description, is_active = 1, updated_at = CURRENT_TIMESTAMP
                 WHERE id = :id'
            );
            $updateStatement->execute([
                ':id' => $bundleId,
                ':name' => $name,
                ':description' => $description,
            ]);
            if ($updateStatement->rowCount() === 0) {
                $existsStatement = $pdo->prepare('SELECT id FROM equipment_bundles WHERE id = :id LIMIT 1');
                $existsStatement->execute([':id' => $bundleId]);
                if (!$existsStatement->fetch(PDO::FETCH_ASSOC)) {
                    apiErrorResponse('Bundle non trovato', 404);
                }
            }
        } else {
            $insertStatement = $pdo->prepare(
                'INSERT INTO equipment_bundles (name, description, is_active)
                 VALUES (:name, :description, 1)
                 ON DUPLICATE KEY UPDATE
                   description = VALUES(description),
                   is_active = 1,
                   updated_at = CURRENT_TIMESTAMP'
            );
            $insertStatement->execute([
                ':name' => $name,
                ':description' => $description,
            ]);
            $bundleId = (int)$pdo->lastInsertId();
            if ($bundleId === 0) {
                $lookupStatement = $pdo->prepare('SELECT id FROM equipment_bundles WHERE name = :name LIMIT 1');
                $lookupStatement->execute([':name' => $name]);
                $existing = $lookupStatement->fetch(PDO::FETCH_ASSOC);
                $bundleId = is_array($existing) ? (int)$existing['id'] : 0;
            }
        }

        if ($bundleId <= 0) {
            apiErrorResponse('Impossibile salvare il bundle');
        }

        $pdo->prepare('DELETE FROM equipment_bundle_items WHERE bundle_id = :bundle_id')
            ->execute([':bundle_id' => $bundleId]);

        $insertItemStatement = $pdo->prepare(
            'INSERT INTO equipment_bundle_items (
                bundle_id, catalog_apparecchiatura_id, apparecchiatura, tipologia, produttore, modello,
                qta, nuovo, trasferimento, note, sort_order
             ) VALUES (
                :bundle_id, :catalog_apparecchiatura_id, :apparecchiatura, :tipologia, :produttore, :modello,
                :qta, :nuovo, :trasferimento, :note, :sort_order
             )'
        );

        foreach ($normalizedItems as $normalizedItem) {
            $insertItemStatement->execute([
                ':bundle_id' => $bundleId,
                ':catalog_apparecchiatura_id' => $normalizedItem['catalog_apparecchiatura_id'],
                ':apparecchiatura' => $normalizedItem['apparecchiatura'],
                ':tipologia' => $normalizedItem['tipologia'],
                ':produttore' => $normalizedItem['produttore'],
                ':modello' => $normalizedItem['modello'],
                ':qta' => $normalizedItem['qta'],
                ':nuovo' => $normalizedItem['nuovo'],
                ':trasferimento' => $normalizedItem['trasferimento'],
                ':note' => $normalizedItem['note'],
                ':sort_order' => $normalizedItem['sort_order'],
            ]);
        }

        propagateBundleChangesToRooms($pdo, $bundleId, $normalizedItems);

        $pdo->commit();

        echo json_encode([
            'ok' => true,
            'bundle' => [
                'id' => $bundleId,
                'name' => $name,
                'description' => $description,
                'isActive' => 1,
                'items' => fetchBundleItems($pdo, $bundleId),
            ],
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($action === 'delete' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $bundleId = (int)($payload['id'] ?? 0);
        if ($bundleId <= 0) {
            apiErrorResponse('id bundle obbligatorio');
        }

        $statement = $pdo->prepare(
            'UPDATE equipment_bundles SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = :id'
        );
        $statement->execute([':id' => $bundleId]);

        echo json_encode(['ok' => true, 'id' => $bundleId], JSON_UNESCAPED_UNICODE);
        exit;
    }

    apiErrorResponse('action non valida');
} catch (Throwable $throwable) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    apiErrorResponse('Errore bundle: ' . $throwable->getMessage(), 500);
}
