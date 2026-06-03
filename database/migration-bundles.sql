CREATE TABLE IF NOT EXISTS equipment_bundles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_equipment_bundles_name (name),
  KEY idx_equipment_bundles_active (is_active, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS equipment_bundle_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  bundle_id BIGINT UNSIGNED NOT NULL,
  catalog_apparecchiatura_id BIGINT UNSIGNED NULL,
  apparecchiatura VARCHAR(255) NULL,
  tipologia VARCHAR(100) NULL,
  produttore VARCHAR(255) NULL,
  modello VARCHAR(255) NULL,
  qta VARCHAR(50) NULL,
  nuovo VARCHAR(20) NULL,
  trasferimento VARCHAR(20) NULL,
  note TEXT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_equipment_bundle_items_bundle_id (bundle_id),
  KEY idx_equipment_bundle_items_catalog_apparecchiatura_id (catalog_apparecchiatura_id),
  CONSTRAINT fk_equipment_bundle_items_bundle
    FOREIGN KEY (bundle_id) REFERENCES equipment_bundles (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_equipment_bundle_items_catalog_apparecchiatura
    FOREIGN KEY (catalog_apparecchiatura_id) REFERENCES catalog_apparecchiature (id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP PROCEDURE IF EXISTS ensure_bundle_transition_fk;
DROP PROCEDURE IF EXISTS ensure_bundle_transition_index;
DROP PROCEDURE IF EXISTS ensure_bundle_transition_column;

DELIMITER //

CREATE PROCEDURE ensure_bundle_transition_column(
  IN target_table VARCHAR(64),
  IN target_column VARCHAR(64),
  IN target_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = target_table
      AND COLUMN_NAME = target_column
  ) THEN
    SET @ddl = CONCAT('ALTER TABLE `', target_table, '` ADD COLUMN `', target_column, '` ', target_definition);
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END//

CREATE PROCEDURE ensure_bundle_transition_index(
  IN target_table VARCHAR(64),
  IN target_index VARCHAR(64),
  IN target_column VARCHAR(64)
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = target_table
      AND INDEX_NAME = target_index
  ) THEN
    SET @ddl = CONCAT('ALTER TABLE `', target_table, '` ADD INDEX `', target_index, '` (`', target_column, '`)');
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END//

CREATE PROCEDURE ensure_bundle_transition_fk(
  IN target_table VARCHAR(64),
  IN target_constraint VARCHAR(64),
  IN target_column VARCHAR(64),
  IN ref_table VARCHAR(64)
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = target_table
      AND CONSTRAINT_NAME = target_constraint
      AND CONSTRAINT_TYPE = 'FOREIGN KEY'
  ) THEN
    SET @ddl = CONCAT(
      'ALTER TABLE `', target_table, '` ADD CONSTRAINT `', target_constraint,
      '` FOREIGN KEY (`', target_column, '`) REFERENCES `', ref_table, '` (`id`) ON DELETE SET NULL'
    );
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END//

DELIMITER ;

CALL ensure_bundle_transition_column('room_apparecchiature', 'bundle_id', 'BIGINT UNSIGNED NULL AFTER catalog_apparecchiatura_id');
CALL ensure_bundle_transition_index('room_apparecchiature', 'idx_room_apparecchiature_bundle_id', 'bundle_id');
CALL ensure_bundle_transition_fk('room_apparecchiature', 'fk_room_apparecchiature_bundle', 'bundle_id', 'equipment_bundles');

DROP PROCEDURE IF EXISTS ensure_bundle_transition_fk;
DROP PROCEDURE IF EXISTS ensure_bundle_transition_index;
DROP PROCEDURE IF EXISTS ensure_bundle_transition_column;
