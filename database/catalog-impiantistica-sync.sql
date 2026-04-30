START TRANSACTION;

DROP TEMPORARY TABLE IF EXISTS tmp_catalog_impiantistica;
CREATE TEMPORARY TABLE tmp_catalog_impiantistica (
  label VARCHAR(255) NOT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (label)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO tmp_catalog_impiantistica (label, sort_order) VALUES
('Presa elettrica', 10),
('Presa 16A (blu)', 20),
('Presa 32A (blu)', 30),
('Presa trifase 16A (rossa)', 40),
('Presa trifase 32A (rossa)', 50),
('Presa dati RJ45', 60),
('Presa Ossigeno', 70),
('Presa Aria med 3-4 bar', 80),
('Presa Aria tec 7-8 bar', 90),
('Presa Vuoto', 100),
('Presa CO2', 110),
('Presa EVAC', 120),
('Presa Protossido', 130),
('Punto acqua fredda', 140),
('Punto acqua calda', 150),
('Scarico acqua', 160),
('Aspirazione esterna', 170),
('Vapore', 180),
('Acqua  addolcita/osmotizzata', 190),
('Linea concentrati', 200),
('Cavo remotizzazione allarmi frigo', 210),
('Placche prese video', 220);

-- UPSERT voci in catalog_impiantistica (code stabile calcolato da label)
INSERT INTO catalog_impiantistica (code, label, sort_order, is_active)
SELECT
  CONCAT('IMP_', UPPER(SUBSTRING(MD5(TRIM(label)), 1, 16))) AS code,
  label,
  sort_order,
  1 AS is_active
FROM tmp_catalog_impiantistica
ON DUPLICATE KEY UPDATE
  label = VALUES(label),
  sort_order = VALUES(sort_order),
  is_active = 1,
  updated_at = CURRENT_TIMESTAMP;

-- Soft disable: tutto cio' che non e' presente nella lista ufficiale
UPDATE catalog_impiantistica ci
LEFT JOIN tmp_catalog_impiantistica t ON t.label = ci.label
SET ci.is_active = 0,
    ci.updated_at = CURRENT_TIMESTAMP
WHERE t.label IS NULL;

COMMIT;
