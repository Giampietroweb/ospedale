<?php

declare(strict_types=1);

/**
 * Export XLSX delle estrazioni (stessi filtri della ricerca JSON).
 * Richiede dipendenze Composer: dalla root del progetto eseguire `composer install`.
 */

$autoloadPath = __DIR__ . '/../vendor/autoload.php';
if (!is_file($autoloadPath)) {
    http_response_code(503);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Export non disponibile: nella root del progetto eseguire `composer install` (PhpSpreadsheet).';
    exit;
}

require $autoloadPath;
require __DIR__ . '/database.php';
require_once __DIR__ . '/estrazioni-query.php';

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Metodo non consentito';
    exit;
}

try {
    $filters = parseEstrazioniFiltersFromGet($_GET);
    $pdo = getDatabaseConnection();
    $rows = fetchEstrazioniRows($pdo, $filters);
} catch (InvalidArgumentException $invalidArgument) {
    http_response_code(400);
    header('Content-Type: text/plain; charset=utf-8');
    echo $invalidArgument->getMessage();
    exit;
} catch (Throwable $throwable) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Errore: ' . $throwable->getMessage();
    exit;
}

$headerRow = [
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
];

$spreadsheet = new Spreadsheet();
$sheet = $spreadsheet->getActiveSheet();
$sheet->setTitle('Estrazioni');
$sheet->fromArray($headerRow, null, 'A1');

$rowIndex = 2;
foreach ($rows as $row) {
    if (!is_array($row)) {
        continue;
    }
    $sheet->fromArray(estrazioniRowToSpreadsheetLine($row), null, 'A' . $rowIndex);
    $rowIndex++;
}

$sheet->freezePane('A2');
foreach (range('A', 'M') as $columnId) {
    $sheet->getColumnDimension($columnId)->setAutoSize(true);
}

$filename = 'estrazioni-' . date('Ymd-His') . '.xlsx';

header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Cache-Control: private, max-age=0');

$writer = new Xlsx($spreadsheet);
$writer->save('php://output');
