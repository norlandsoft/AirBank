-- airbank_ebank 网上银行库结构（docs/design/06 §6）
CREATE TABLE IF NOT EXISTS t_ebank_txn (
    id            BIGSERIAL PRIMARY KEY,
    request_no    VARCHAR(48) NOT NULL UNIQUE,
    biz_type      VARCHAR(16) NOT NULL,
    customer_id   BIGINT      NOT NULL,
    acct_no       VARCHAR(18) NOT NULL,
    amount        BIGINT      NOT NULL DEFAULT 0,
    status        VARCHAR(12) NOT NULL,
    downstream_no VARCHAR(32),
    created_by    VARCHAR(32) DEFAULT 'system',
    updated_by    VARCHAR(32) DEFAULT 'system',
    created_at    TIMESTAMP   DEFAULT now(),
    updated_at    TIMESTAMP   DEFAULT now(),
    finished_at   TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ebank_txn_customer ON t_ebank_txn (customer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS t_transfer_limit (
    id           BIGSERIAL PRIMARY KEY,
    customer_id  BIGINT NOT NULL UNIQUE,
    single_limit BIGINT NOT NULL,
    daily_limit  BIGINT NOT NULL,
    updated_by   VARCHAR(32) DEFAULT 'system',
    updated_at   TIMESTAMP   DEFAULT now()
);

CREATE TABLE IF NOT EXISTS t_beneficiary (
    id          BIGSERIAL PRIMARY KEY,
    customer_id BIGINT      NOT NULL,
    payee_name  VARCHAR(64) NOT NULL,
    payee_acct  VARCHAR(18) NOT NULL,
    bank_name   VARCHAR(32) NOT NULL DEFAULT 'AirBank',
    alias       VARCHAR(32),
    UNIQUE (customer_id, payee_acct)
);

CREATE TABLE IF NOT EXISTS t_e_receipt (
    id          BIGSERIAL PRIMARY KEY,
    receipt_no  VARCHAR(20) NOT NULL UNIQUE,
    customer_id BIGINT      NOT NULL,
    biz_type    VARCHAR(16) NOT NULL,
    biz_no      VARCHAR(48) NOT NULL,
    content     JSONB       NOT NULL,
    created_at  TIMESTAMP   DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_receipt_customer ON t_e_receipt (customer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS t_message (
    id         BIGSERIAL PRIMARY KEY,
    customer_id BIGINT      NOT NULL,
    msg_type   VARCHAR(8)  NOT NULL,
    title      VARCHAR(100) NOT NULL,
    content    VARCHAR(1000),
    is_read    BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP   DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_message_customer ON t_message (customer_id, created_at DESC);
