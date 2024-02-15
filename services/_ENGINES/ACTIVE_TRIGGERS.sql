-- ACTIVE TRIGGERS IN THE DATABASE FOR REFERENCE ONLY

DELIMITER //

CREATE TRIGGER after_veve_mints_insert
AFTER INSERT ON veve_mints
FOR EACH ROW
BEGIN
    -- UPDATE IMX_STATS MINT/TRANSACTION COUNTS
    UPDATE imx_stats
    SET mint_count = mint_count + 1,
        transaction_count = transaction_count + 1,
        burn_count = burn_count + NEW.is_burned
    WHERE project_id = 'de2180a8-4e26-402a-aed1-a09a51e6e33d';

    -- INSERT INTO VEVE_WALLETS IF NEW (Only if the wallet_id is not in veve_wallets)
    INSERT INTO veve_wallets (id, first_activity_date, last_activity_date, active)
    SELECT NEW.wallet_id, NEW.timestamp_dt, NEW.timestamp_dt, 1
    WHERE NOT EXISTS (
        SELECT 1
        FROM veve_wallets
        WHERE id = NEW.wallet_id
    )
    ON DUPLICATE KEY UPDATE
        last_activity_date = NEW.timestamp_dt,
        active = 1;

    -- INSERT INTO VEVE_TOKENS
    INSERT IGNORE INTO veve_tokens (token_id, mint_date, is_burned)
    VALUES (NEW.token_id, NEW.timestamp_dt, NEW.is_burned);

    -- INSERT INTO VEVE_X_TRACKER
    IF NOT EXISTS (
        SELECT 1
        FROM veve_x_tracker
        WHERE wallet_id = NEW.wallet_id 
        AND DATE(date) = DATE(NEW.timestamp_dt)
    ) THEN
        INSERT INTO veve_x_tracker (wallet_id, date, mints, sales, purchases)
        VALUES (NEW.wallet_id, DATE(NEW.timestamp_dt), 1, 0, 0);
    ELSE
        UPDATE veve_x_tracker
        SET mints = mints + 1
        WHERE wallet_id = NEW.wallet_id 
        AND DATE(date) = DATE(NEW.timestamp_dt);
    END IF;

    -- INSERT INTO VEVE_WALLET_METRICS IF NEW
    IF NOT EXISTS (
        SELECT 1
        FROM veve_wallet_metrics
        WHERE wallet_id = NEW.wallet_id 
    ) THEN
        INSERT INTO veve_wallet_metrics (wallet_id, mint_count, net_accum, total_tokens, total_burned)
        VALUES (NEW.wallet_id, 1, 1, 1, NEW.is_burned);
    ELSE
        UPDATE veve_wallet_metrics
        SET mint_count = mint_count + 1,
            net_accum = net_accum + 1,
            total_tokens = total_tokens + 1,
            total_burned = total_burned + NEW.is_burned
        WHERE wallet_id = NEW.wallet_id;
    END IF;
END;
//

DELIMITER ;


-- #############VEVE_TRANSFERS INSERT#############
DELIMITER //

CREATE TRIGGER after_veve_transfers_insert
AFTER INSERT ON veve_transfers
FOR EACH ROW
BEGIN
    -- UPDATE IMX_STATS MINT/TRANSACTION COUNTS
    UPDATE imx_stats
    SET transfer_count = transfer_count + 1,
        transaction_count = transaction_count + 1,
        burn_count = burn_count + NEW.is_burned
    WHERE project_id = 'de2180a8-4e26-402a-aed1-a09a51e6e33d';

    -- BUYERS WALLET
    INSERT INTO veve_wallets (id, first_activity_date, last_activity_date, active)
    VALUES (NEW.to_wallet, NEW.timestamp_dt, NEW.timestamp_dt, 1)
    ON DUPLICATE KEY UPDATE
        last_activity_date = GREATEST(NEW.timestamp_dt, last_activity_date),
        active = 1;

    -- SELLERS WALLET
    INSERT INTO veve_wallets (id, first_activity_date, last_activity_date, active, has_kyc)
    VALUES (NEW.from_wallet, NEW.timestamp_dt, NEW.timestamp_dt, 1, 1)
    ON DUPLICATE KEY UPDATE
        last_activity_date = GREATEST(NEW.timestamp_dt, last_activity_date),
        active = 1,
        has_kyc = 1;

    -- BUYERS WALLET METRICS
    INSERT INTO veve_wallet_metrics (wallet_id, purchase_count, net_accum, total_tokens, transfer_count, total_burned)
    VALUES (NEW.to_wallet, 1, 1, 1, 1, NEW.is_burned)
    ON DUPLICATE KEY UPDATE
        purchase_count = purchase_count + 1,
        net_accum = net_accum + 1,
        total_tokens = total_tokens + 1,
        transfer_count = transfer_count + 1,
        total_burned = total_burned + NEW.is_burned;

    -- SELLERS WALLET METRICS
    INSERT INTO veve_wallet_metrics (wallet_id, sale_count, net_accum, total_tokens, transfer_count, total_burned)
    VALUES (NEW.from_wallet, 1, -1, -1, 1, NEW.is_burned)
    ON DUPLICATE KEY UPDATE
        sale_count = sale_count + 1,
        net_accum = net_accum - 1,
        total_tokens = total_tokens - 1,
        transfer_count = transfer_count + 1,
        total_burned = total_burned + NEW.is_burned;

    -- INSERT TO_WALLET INTO VEVE_X_TRACKER
    IF NOT EXISTS (
            SELECT 1
            FROM veve_x_tracker
            WHERE wallet_id = NEW.to_wallet
            AND DATE(date) = DATE(NEW.timestamp_dt)
        ) THEN
            INSERT INTO veve_x_tracker (wallet_id, date, mints, sales, purchases)
            VALUES (NEW.to_wallet, DATE(NEW.timestamp_dt), 0, 0, 1);
        ELSE
            UPDATE veve_x_tracker
            SET purchases = purchases + 1
            WHERE wallet_id = NEW.to_wallet 
            AND DATE(date) = DATE(NEW.timestamp_dt);
    END IF;

    -- INSERT FROM_WALLET INTO VEVE_X_TRACKER
    IF NOT EXISTS (
            SELECT 1
            FROM veve_x_tracker
            WHERE wallet_id = NEW.from_wallet
            AND DATE(date) = DATE(NEW.timestamp_dt)
        ) THEN
            INSERT INTO veve_x_tracker (wallet_id, date, mints, sales, purchases)
            VALUES (NEW.from_wallet, DATE(NEW.timestamp_dt), 0, 1, 0);
        ELSE
            UPDATE veve_x_tracker
            SET sales = sales + 1
            WHERE wallet_id = NEW.from_wallet 
            AND DATE(date) = DATE(NEW.timestamp_dt);
    END IF;

    -- UPDATE VEVE_MINTS.TRANSFER_COUNT
    UPDATE veve_mints
    SET transfer_count = transfer_count + 1
    WHERE token_id = NEW.token_id;

    -- UPDATE VEVE_TOKENS IS_BURNED STATUS
    UPDATE veve_tokens 
    SET is_burned = NEW.is_burned
    WHERE token_id = NEW.token_id;
END;
//
DELIMITER ;


-- #############VEVE_WALLETS INSERT#############
DELIMITER //

CREATE TRIGGER after_veve_wallets_insert
AFTER INSERT ON veve_wallets
FOR EACH ROW
BEGIN
    UPDATE imx_stats
    SET wallet_count = wallet_count + 1
    WHERE project_id = 'de2180a8-4e26-402a-aed1-a09a51e6e33d';
END;
//
DELIMITER ;

-- #############VEVE_TOKENS INSERT#############
DELIMITER //

CREATE TRIGGER after_veve_tokens_insert
AFTER INSERT ON veve_tokens
FOR EACH ROW
BEGIN
    UPDATE imx_stats
    SET token_count = token_count + 1
    WHERE project_id = 'de2180a8-4e26-402a-aed1-a09a51e6e33d';
END;
//
DELIMITER ;
