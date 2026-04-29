INSERT INTO catalog_impiantistica (code, label, sort_order, is_active)
VALUES
('PRESA_ELETTRICA', 'Presa elettrica', 10, 1),
('PRESA_16A', 'Presa 16A', 20, 1),
('PRESA_32A', 'Presa 32A', 30, 1),
('PRESA_DATI_RJ45', 'Presa dati RJ45', 40, 1),
('REMORIZZAZIONE_ALLARME_FRIGO', 'Remorizzazione allarme frigo', 50, 1),
('PRESA_OSSIGENO', 'Presa Ossigeno', 60, 1),
('PRESA_ARIA_MED_3_4_BAR', 'Presa Aria med 3-4 bar', 70, 1),
('PRESA_ARIA_TEC_7_8_BAR', 'Presa Aria tec 7-8 bar', 80, 1),
('PRESA_VUOTO', 'Presa Vuoto', 90, 1),
('PRESA_CO2', 'Presa CO2', 100, 1),
('PRESA_EVAC', 'Presa EVAC', 110, 1),
('PRESA_PROTOOSSIDO', 'Presa Protossido', 120, 1),
('PUNTO_ACQUA_FREDDA', 'Punto acqua fredda', 130, 1),
('PUNTO_ACQUA_CALDA', 'Punto acqua calda', 140, 1),
('SCARICO_ACQUA', 'Scarico acqua', 150, 1),
('ASPIRAZIONE_ESTERNA', 'Aspirazione esterna', 160, 1),
('VAPORE', 'Vapore', 170, 1),
('PLACCE_PRESE_VIDEO', 'Placche prese video', 180, 1)
ON DUPLICATE KEY UPDATE
label = VALUES(label), sort_order = VALUES(sort_order), is_active = VALUES(is_active), updated_at = CURRENT_TIMESTAMP;

INSERT INTO catalog_altre_dotazioni (code, label, sort_order, is_active)
VALUES
('CLIMATIZZAZIONE_DEDICATA', 'Climatizzazione dedicata', 10, 1),
('BADGE', 'Badge', 20, 1),
('TELECAMERA_IT', 'Telecamera IT', 30, 1),
('ARMADIO_FARMACI_INTELLIGENTE', 'Armadio farmaci intelligente', 40, 1),
('TESTA_LETTO', 'Testa-letto', 50, 1),
('BARRA_NORMALIZZATA_VERTICALE', 'Barra normalizzata verticale', 60, 1),
('BARRA_NORMALIZZATA_ORIZZONTALE', 'Barra normalizzata orizzontale', 70, 1)
ON DUPLICATE KEY UPDATE
label = VALUES(label), sort_order = VALUES(sort_order), is_active = VALUES(is_active), updated_at = CURRENT_TIMESTAMP;

INSERT INTO catalog_ancoraggi_apparecchiature (code, label, sort_order, is_active)
VALUES
('CARRELLATO', 'Carrellato', 10, 1),
('PARETE', 'Parete', 20, 1),
('PENSILE', 'Pensile', 30, 1),
('SOFFITTO', 'Soffitto', 40, 1),
('BARRA', 'Barra', 50, 1)
ON DUPLICATE KEY UPDATE
label = VALUES(label), sort_order = VALUES(sort_order), is_active = VALUES(is_active), updated_at = CURRENT_TIMESTAMP;

INSERT INTO catalog_emipiani (code, label, sort_order, is_active)
VALUES
('OVEST', 'Ovest', 10, 1),
('EST', 'Est', 20, 1)
ON DUPLICATE KEY UPDATE
label = VALUES(label), sort_order = VALUES(sort_order), is_active = VALUES(is_active), updated_at = CURRENT_TIMESTAMP;

INSERT INTO catalog_produttore (code, label, sort_order, is_active)
VALUES
('PHILIPS', 'Philips', 10, 1),
('GETINGE', 'Getinge', 20, 1),
('FLOWMETER', 'Flowmeter', 30, 1),
('SIEMENS', 'Siemens', 40, 1)
ON DUPLICATE KEY UPDATE
label = VALUES(label), sort_order = VALUES(sort_order), is_active = VALUES(is_active), updated_at = CURRENT_TIMESTAMP;

INSERT INTO catalog_reparto (code, label, sort_order, is_active)
VALUES
('CARDIOLOGIA', 'Cardiologia', 10, 1)
ON DUPLICATE KEY UPDATE
label = VALUES(label), sort_order = VALUES(sort_order), is_active = VALUES(is_active), updated_at = CURRENT_TIMESTAMP;

INSERT INTO catalog_accreditamento_locale (code, label, sort_order, is_active)
VALUES
('DEGENZA_2_PL_A_USO_SINGOLO', 'Degenza 2 PL a uso singolo', 10, 1),
('STUDIO_MEDICI', 'Studio medici', 20, 1)
ON DUPLICATE KEY UPDATE
label = VALUES(label), sort_order = VALUES(sort_order), is_active = VALUES(is_active), updated_at = CURRENT_TIMESTAMP;

-- Seed minimo dal dato legacy presente per apparecchiature.
INSERT INTO catalog_apparecchiature (code, label, sort_order, is_active)
SELECT DISTINCT
  UPPER(TRIM(REPLACE(REPLACE(REPLACE(ra.apparecchiatura, ' ', '_'), '-', '_'), '/', '_'))) AS code,
  TRIM(ra.apparecchiatura) AS label,
  9999,
  1
FROM room_apparecchiature ra
WHERE ra.apparecchiatura IS NOT NULL AND TRIM(ra.apparecchiatura) <> ''
ON DUPLICATE KEY UPDATE
  label = VALUES(label),
  is_active = VALUES(is_active),
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO catalog_produttore (code, label, sort_order, is_active)
SELECT DISTINCT
  UPPER(TRIM(REPLACE(REPLACE(REPLACE(ra.produttore, ' ', '_'), '-', '_'), '/', '_'))) AS code,
  TRIM(ra.produttore) AS label,
  9999,
  1
FROM room_apparecchiature ra
WHERE ra.produttore IS NOT NULL
  AND TRIM(ra.produttore) <> ''
  AND TRIM(ra.produttore) <> '-'
ON DUPLICATE KEY UPDATE
  label = VALUES(label),
  is_active = VALUES(is_active),
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO catalog_reparto (code, label, sort_order, is_active)
SELECT DISTINCT
  UPPER(TRIM(REPLACE(REPLACE(REPLACE(r.reparto, ' ', '_'), '-', '_'), '/', '_'))) AS code,
  TRIM(r.reparto) AS label,
  9999,
  1
FROM rooms r
WHERE r.reparto IS NOT NULL
  AND TRIM(r.reparto) <> ''
  AND TRIM(r.reparto) <> '-'
ON DUPLICATE KEY UPDATE
  label = VALUES(label),
  is_active = VALUES(is_active),
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO catalog_accreditamento_locale (code, label, sort_order, is_active)
SELECT DISTINCT
  UPPER(TRIM(REPLACE(REPLACE(REPLACE(r.accreditamento_locale, ' ', '_'), '-', '_'), '/', '_'))) AS code,
  TRIM(r.accreditamento_locale) AS label,
  9999,
  1
FROM rooms r
WHERE r.accreditamento_locale IS NOT NULL
  AND TRIM(r.accreditamento_locale) <> ''
  AND TRIM(r.accreditamento_locale) <> '-'
ON DUPLICATE KEY UPDATE
  label = VALUES(label),
  is_active = VALUES(is_active),
  updated_at = CURRENT_TIMESTAMP;
