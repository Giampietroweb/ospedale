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

CREATE TABLE IF NOT EXISTS room_apparecchiature (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  room_id BIGINT UNSIGNED NOT NULL,
  apparecchiatura VARCHAR(255) NULL,
  tipologia VARCHAR(100) NULL,
  produttore VARCHAR(255) NULL,
  modello VARCHAR(255) NULL,
  qta VARCHAR(50) NULL,
  nuovo VARCHAR(20) NULL,
  trasferimento VARCHAR(20) NULL,
  inv VARCHAR(100) NULL,
  note TEXT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_room_apparecchiature_room_id (room_id),
  CONSTRAINT fk_room_apparecchiature_room
    FOREIGN KEY (room_id) REFERENCES rooms (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS room_impiantistica (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  room_id BIGINT UNSIGNED NOT NULL,
  tipologia VARCHAR(255) NOT NULL,
  qta_presenti INT NULL,
  qta_da_implementare INT NULL,
  note TEXT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_room_impiantistica_room_id (room_id),
  CONSTRAINT fk_room_impiantistica_room
    FOREIGN KEY (room_id) REFERENCES rooms (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS room_altre_dotazioni (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  room_id BIGINT UNSIGNED NOT NULL,
  altra_dotazione VARCHAR(255) NOT NULL,
  presente ENUM('Si', 'No') NULL,
  da_implementare ENUM('Si', 'No') NULL,
  note TEXT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_room_altre_dotazioni_room_id (room_id),
  CONSTRAINT fk_room_altre_dotazioni_room
    FOREIGN KEY (room_id) REFERENCES rooms (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
