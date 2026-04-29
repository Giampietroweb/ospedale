CREATE TABLE IF NOT EXISTS rooms (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  blocco VARCHAR(30) NOT NULL,
  piano VARCHAR(20) NOT NULL,
  room_code VARCHAR(100) NOT NULL,
  room_code_name VARCHAR(255) NULL,
  occupazione VARCHAR(255) NULL,
  reparto VARCHAR(255) NULL,
  superficie VARCHAR(50) NULL,
  emipiano VARCHAR(20) NULL,
  accreditamento_locale VARCHAR(255) NULL,
  posti_letto INT NULL,
  note_arredi_segnaletica TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_room_ref (blocco, piano, room_code),
  KEY idx_rooms_blocco_piano (blocco, piano),
  KEY idx_rooms_room_code (room_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS catalog_apparecchiature (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(120) NOT NULL,
  label VARCHAR(255) NOT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_catalog_apparecchiature_code (code),
  UNIQUE KEY uniq_catalog_apparecchiature_label (label),
  KEY idx_catalog_apparecchiature_active_sort (is_active, sort_order, label)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS catalog_impiantistica (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(120) NOT NULL,
  label VARCHAR(255) NOT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_catalog_impiantistica_code (code),
  UNIQUE KEY uniq_catalog_impiantistica_label (label),
  KEY idx_catalog_impiantistica_active_sort (is_active, sort_order, label)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS catalog_altre_dotazioni (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(120) NOT NULL,
  label VARCHAR(255) NOT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_catalog_altre_dotazioni_code (code),
  UNIQUE KEY uniq_catalog_altre_dotazioni_label (label),
  KEY idx_catalog_altre_dotazioni_active_sort (is_active, sort_order, label)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS catalog_ancoraggi_apparecchiature (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(120) NOT NULL,
  label VARCHAR(255) NOT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_catalog_ancoraggi_apparecchiature_code (code),
  UNIQUE KEY uniq_catalog_ancoraggi_apparecchiature_label (label),
  KEY idx_catalog_ancoraggi_apparecchiature_active_sort (is_active, sort_order, label)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS catalog_emipiani (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(120) NOT NULL,
  label VARCHAR(255) NOT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_catalog_emipiani_code (code),
  UNIQUE KEY uniq_catalog_emipiani_label (label),
  KEY idx_catalog_emipiani_active_sort (is_active, sort_order, label)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS catalog_produttore (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(120) NOT NULL,
  label VARCHAR(255) NOT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_catalog_produttore_code (code),
  UNIQUE KEY uniq_catalog_produttore_label (label),
  KEY idx_catalog_produttore_active_sort (is_active, sort_order, label)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS catalog_reparto (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(120) NOT NULL,
  label VARCHAR(255) NOT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_catalog_reparto_code (code),
  UNIQUE KEY uniq_catalog_reparto_label (label),
  KEY idx_catalog_reparto_active_sort (is_active, sort_order, label)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS catalog_accreditamento_locale (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(120) NOT NULL,
  label VARCHAR(255) NOT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_catalog_accreditamento_locale_code (code),
  UNIQUE KEY uniq_catalog_accreditamento_locale_label (label),
  KEY idx_catalog_accreditamento_locale_active_sort (is_active, sort_order, label)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS room_apparecchiature (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  room_id BIGINT UNSIGNED NOT NULL,
  catalog_apparecchiatura_id BIGINT UNSIGNED NULL,
  apparecchiatura VARCHAR(255) NULL,
  tipologia VARCHAR(100) NULL,
  produttore VARCHAR(255) NULL,
  modello VARCHAR(255) NULL,
  qta VARCHAR(50) NULL,
  nuovo VARCHAR(20) NULL,
  trasferimento VARCHAR(20) NULL,
  inv TEXT NULL,
  note TEXT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_room_apparecchiature_room_id (room_id),
  KEY idx_room_apparecchiature_catalog_apparecchiatura_id (catalog_apparecchiatura_id),
  CONSTRAINT fk_room_apparecchiature_room
    FOREIGN KEY (room_id) REFERENCES rooms (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_room_apparecchiature_catalog_apparecchiatura
    FOREIGN KEY (catalog_apparecchiatura_id) REFERENCES catalog_apparecchiature (id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS room_impiantistica (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  room_id BIGINT UNSIGNED NOT NULL,
  catalog_impiantistica_id BIGINT UNSIGNED NULL,
  tipologia VARCHAR(255) NOT NULL,
  qta_presenti INT NULL,
  qta_da_implementare INT NULL,
  note TEXT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_room_impiantistica_room_id (room_id),
  KEY idx_room_impiantistica_catalog_impiantistica_id (catalog_impiantistica_id),
  CONSTRAINT fk_room_impiantistica_room
    FOREIGN KEY (room_id) REFERENCES rooms (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_room_impiantistica_catalog_impiantistica
    FOREIGN KEY (catalog_impiantistica_id) REFERENCES catalog_impiantistica (id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS room_altre_dotazioni (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  room_id BIGINT UNSIGNED NOT NULL,
  catalog_altra_dotazione_id BIGINT UNSIGNED NULL,
  altra_dotazione VARCHAR(255) NOT NULL,
  presente ENUM('Si', 'No') NULL,
  da_implementare ENUM('Si', 'No') NULL,
  note TEXT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_room_altre_dotazioni_room_id (room_id),
  KEY idx_room_altre_dotazioni_catalog_altra_dotazione_id (catalog_altra_dotazione_id),
  CONSTRAINT fk_room_altre_dotazioni_room
    FOREIGN KEY (room_id) REFERENCES rooms (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_room_altre_dotazioni_catalog_altra_dotazione
    FOREIGN KEY (catalog_altra_dotazione_id) REFERENCES catalog_altre_dotazioni (id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP PROCEDURE IF EXISTS ensure_catalog_transition_fk;
DROP PROCEDURE IF EXISTS ensure_catalog_transition_index;
DROP PROCEDURE IF EXISTS ensure_catalog_transition_column;

DELIMITER //

CREATE PROCEDURE ensure_catalog_transition_column(
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

CREATE PROCEDURE ensure_catalog_transition_index(
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

CREATE PROCEDURE ensure_catalog_transition_fk(
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

CALL ensure_catalog_transition_column('room_apparecchiature', 'catalog_apparecchiatura_id', 'BIGINT UNSIGNED NULL AFTER room_id');
CALL ensure_catalog_transition_index('room_apparecchiature', 'idx_room_apparecchiature_catalog_apparecchiatura_id', 'catalog_apparecchiatura_id');
CALL ensure_catalog_transition_fk('room_apparecchiature', 'fk_room_apparecchiature_catalog_apparecchiatura', 'catalog_apparecchiatura_id', 'catalog_apparecchiature');

CALL ensure_catalog_transition_column('room_impiantistica', 'catalog_impiantistica_id', 'BIGINT UNSIGNED NULL AFTER room_id');
CALL ensure_catalog_transition_index('room_impiantistica', 'idx_room_impiantistica_catalog_impiantistica_id', 'catalog_impiantistica_id');
CALL ensure_catalog_transition_fk('room_impiantistica', 'fk_room_impiantistica_catalog_impiantistica', 'catalog_impiantistica_id', 'catalog_impiantistica');

CALL ensure_catalog_transition_column('room_altre_dotazioni', 'catalog_altra_dotazione_id', 'BIGINT UNSIGNED NULL AFTER room_id');
CALL ensure_catalog_transition_index('room_altre_dotazioni', 'idx_room_altre_dotazioni_catalog_altra_dotazione_id', 'catalog_altra_dotazione_id');
CALL ensure_catalog_transition_fk('room_altre_dotazioni', 'fk_room_altre_dotazioni_catalog_altra_dotazione', 'catalog_altra_dotazione_id', 'catalog_altre_dotazioni');

DROP PROCEDURE IF EXISTS ensure_catalog_transition_fk;
DROP PROCEDURE IF EXISTS ensure_catalog_transition_index;
DROP PROCEDURE IF EXISTS ensure_catalog_transition_column;
