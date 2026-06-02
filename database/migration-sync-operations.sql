-- Migrazione: tabella sync_operations per idempotenza operazioni offline
-- Eseguire una sola volta sul database di produzione e sviluppo.
--
-- Politica conflitti: last-write-wins su updated_at (documentata).
-- Se operation_id è già presente, il backend restituisce ok senza rieseguire.

CREATE TABLE IF NOT EXISTS sync_operations (
    operation_id  VARCHAR(36)  NOT NULL,
    action        VARCHAR(64)  NOT NULL,
    room_ref      VARCHAR(512) NULL,
    blocco        VARCHAR(30)  NULL,
    piano         VARCHAR(20)  NULL,
    room_code     VARCHAR(100) NULL,
    request_payload  LONGTEXT  NULL,
    response_payload LONGTEXT  NULL,
    error_message    TEXT      NULL,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at  DATETIME     NULL,
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    outcome       VARCHAR(16)  NOT NULL DEFAULT 'pending',
    PRIMARY KEY (operation_id),
    INDEX idx_sync_ops_action (action),
    INDEX idx_sync_ops_room (blocco, piano, room_code),
    INDEX idx_sync_ops_processed_at (processed_at),
    INDEX idx_sync_ops_outcome (outcome)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
