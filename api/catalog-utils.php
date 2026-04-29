<?php

declare(strict_types=1);

const CATALOG_TABLES = [
    'apparecchiature' => 'catalog_apparecchiature',
    'impiantistica' => 'catalog_impiantistica',
    'altre_dotazioni' => 'catalog_altre_dotazioni',
    'ancoraggi_apparecchiature' => 'catalog_ancoraggi_apparecchiature',
    'emipiani' => 'catalog_emipiani',
    'produttore' => 'catalog_produttore',
    'reparto' => 'catalog_reparto',
    'accreditamento_locale' => 'catalog_accreditamento_locale',
];

function getCatalogTableByType(string $type): string
{
    if (!array_key_exists($type, CATALOG_TABLES)) {
        throw new InvalidArgumentException('Tipo catalogo non valido');
    }

    return CATALOG_TABLES[$type];
}

function normalizeCatalogCode(string $label): string
{
    $upper = strtoupper(trim($label));
    if ($upper === '') {
        return '';
    }
    $transliterated = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $upper);
    $normalized = preg_replace('/[^A-Z0-9]+/', '_', $transliterated !== false ? $transliterated : $upper);
    $normalized = trim((string)$normalized, '_');
    return $normalized !== '' ? $normalized : 'CATALOGO';
}

function assertValidCatalogCode(string $code): void
{
    if ($code === '' || !preg_match('/^[A-Z0-9_]{1,120}$/', $code)) {
        throw new InvalidArgumentException('code non valido: usare solo A-Z, 0-9 e underscore');
    }
}

function assertValidCatalogLabel(string $label): void
{
    if ($label === '' || strlen($label) > 255) {
        throw new InvalidArgumentException('label obbligatoria e massimo 255 caratteri');
    }
}

function resolveCatalogIdByLabel(PDO $pdo, string $tableName, ?string $label): ?int
{
    $normalizedLabel = trim((string)$label);
    if ($normalizedLabel === '') {
        return null;
    }

    $statement = $pdo->prepare(
        "SELECT id FROM {$tableName} WHERE LOWER(label) = LOWER(:label) LIMIT 1"
    );
    $statement->execute([':label' => $normalizedLabel]);
    $row = $statement->fetch(PDO::FETCH_ASSOC);
    if (!is_array($row)) {
        return null;
    }

    return (int)$row['id'];
}

function fetchCatalogRows(PDO $pdo, string $tableName, bool $activeOnly = false): array
{
    $where = $activeOnly ? 'WHERE is_active = 1' : '';
    $statement = $pdo->query(
        "SELECT id, code, label, sort_order AS sortOrder, is_active AS isActive
         FROM {$tableName}
         {$where}
         ORDER BY sort_order ASC, label ASC"
    );
    $rows = $statement->fetchAll(PDO::FETCH_ASSOC);
    return is_array($rows) ? $rows : [];
}
