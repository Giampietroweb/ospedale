<?php

declare(strict_types=1);

function apiErrorResponse(string $message, int $statusCode = 400): void
{
    http_response_code($statusCode);
    echo json_encode(['ok' => false, 'error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

function normalizeInventoryCode(mixed $value): string
{
    return strtoupper(trim((string)($value ?? '')));
}

function normalizeInventoryListForResponse(mixed $value): array
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
        $normalizedCode = normalizeInventoryCode($rawItem);
        if ($normalizedCode === '') {
            continue;
        }
        $normalizedValues[] = $normalizedCode;
    }

    return array_values(array_unique($normalizedValues));
}
