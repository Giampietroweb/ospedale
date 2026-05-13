-- Migrazione: tabella sync_operations per idempotenza operazioni offline
-- Eseguire una sola volta sul database di produzione e sviluppo.
--
-- Politica conflitti: last-write-wins su updated_at (documentata).
-- Se operation_id è già presente, il backend restituisce ok senza rieseguire.

CREATE TABLE IF NOT EXISTS sync_operations (
    operation_id  VARCHAR(36)  NOT NULL,
    action        VARCHAR(64)  NOT NULL,
    room_ref      VARCHAR(512) NULL,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at  DATETIME     NULL,
    outcome       VARCHAR(16)  NOT NULL DEFAULT 'pending',
    PRIMARY KEY (operation_id),
    INDEX idx_sync_ops_processed_at (processed_at),
    INDEX idx_sync_ops_outcome (outcome)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
