UPDATE room_apparecchiature ra
LEFT JOIN catalog_apparecchiature ca ON LOWER(TRIM(ca.label)) = LOWER(TRIM(ra.apparecchiatura))
SET ra.catalog_apparecchiatura_id = ca.id
WHERE ra.apparecchiatura IS NOT NULL
  AND TRIM(ra.apparecchiatura) <> ''
  AND ra.catalog_apparecchiatura_id IS NULL;

UPDATE room_impiantistica ri
LEFT JOIN catalog_impiantistica ci ON LOWER(TRIM(ci.label)) = LOWER(TRIM(ri.tipologia))
SET ri.catalog_impiantistica_id = ci.id
WHERE ri.tipologia IS NOT NULL
  AND TRIM(ri.tipologia) <> ''
  AND ri.catalog_impiantistica_id IS NULL;

UPDATE room_altre_dotazioni rad
LEFT JOIN catalog_altre_dotazioni cad ON LOWER(TRIM(cad.label)) = LOWER(TRIM(rad.altra_dotazione))
SET rad.catalog_altra_dotazione_id = cad.id
WHERE rad.altra_dotazione IS NOT NULL
  AND TRIM(rad.altra_dotazione) <> ''
  AND rad.catalog_altra_dotazione_id IS NULL;
