SELECT 'room_apparecchiature' AS source_table, COUNT(*) AS unmatched_count
FROM room_apparecchiature ra
LEFT JOIN catalog_apparecchiature ca ON ca.id = ra.catalog_apparecchiatura_id
WHERE ra.apparecchiatura IS NOT NULL
  AND TRIM(ra.apparecchiatura) <> ''
  AND ca.id IS NULL;

SELECT 'room_impiantistica' AS source_table, COUNT(*) AS unmatched_count
FROM room_impiantistica ri
LEFT JOIN catalog_impiantistica ci ON ci.id = ri.catalog_impiantistica_id
WHERE ri.tipologia IS NOT NULL
  AND TRIM(ri.tipologia) <> ''
  AND ci.id IS NULL;

SELECT 'room_altre_dotazioni' AS source_table, COUNT(*) AS unmatched_count
FROM room_altre_dotazioni rad
LEFT JOIN catalog_altre_dotazioni cad ON cad.id = rad.catalog_altra_dotazione_id
WHERE rad.altra_dotazione IS NOT NULL
  AND TRIM(rad.altra_dotazione) <> ''
  AND cad.id IS NULL;

SELECT ra.apparecchiatura AS legacy_value, COUNT(*) AS occurrences
FROM room_apparecchiature ra
LEFT JOIN catalog_apparecchiature ca ON ca.id = ra.catalog_apparecchiatura_id
WHERE ra.apparecchiatura IS NOT NULL
  AND TRIM(ra.apparecchiatura) <> ''
  AND ca.id IS NULL
GROUP BY ra.apparecchiatura
ORDER BY occurrences DESC, legacy_value ASC;

SELECT ri.tipologia AS legacy_value, COUNT(*) AS occurrences
FROM room_impiantistica ri
LEFT JOIN catalog_impiantistica ci ON ci.id = ri.catalog_impiantistica_id
WHERE ri.tipologia IS NOT NULL
  AND TRIM(ri.tipologia) <> ''
  AND ci.id IS NULL
GROUP BY ri.tipologia
ORDER BY occurrences DESC, legacy_value ASC;

SELECT rad.altra_dotazione AS legacy_value, COUNT(*) AS occurrences
FROM room_altre_dotazioni rad
LEFT JOIN catalog_altre_dotazioni cad ON cad.id = rad.catalog_altra_dotazione_id
WHERE rad.altra_dotazione IS NOT NULL
  AND TRIM(rad.altra_dotazione) <> ''
  AND cad.id IS NULL
GROUP BY rad.altra_dotazione
ORDER BY occurrences DESC, legacy_value ASC;

SHOW TABLES LIKE 'catalog_%';

SELECT 'catalog_apparecchiature' AS catalog_table, COUNT(*) AS rows_count FROM catalog_apparecchiature
UNION ALL SELECT 'catalog_impiantistica', COUNT(*) FROM catalog_impiantistica
UNION ALL SELECT 'catalog_altre_dotazioni', COUNT(*) FROM catalog_altre_dotazioni
UNION ALL SELECT 'catalog_ancoraggi_apparecchiature', COUNT(*) FROM catalog_ancoraggi_apparecchiature
UNION ALL SELECT 'catalog_emipiani', COUNT(*) FROM catalog_emipiani
UNION ALL SELECT 'catalog_produttore', COUNT(*) FROM catalog_produttore
UNION ALL SELECT 'catalog_reparto', COUNT(*) FROM catalog_reparto
UNION ALL SELECT 'catalog_accreditamento_locale', COUNT(*) FROM catalog_accreditamento_locale;
