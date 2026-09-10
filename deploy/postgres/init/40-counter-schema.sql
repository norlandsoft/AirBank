-- airbank_counter 柜面系统库结构（docs/design/06 §5）
CREATE TABLE IF NOT EXISTS t_teller_shift (
    id          BIGSERIAL PRIMARY KEY,
    teller_no   VARCHAR(8) NOT NULL,
    branch_no   VARCHAR(3) NOT NULL,
    shift_date  DATE       NOT NULL,
    sign_in_at  TIMESTAMP  DEFAULT now(),
    sign_out_at TIMESTAMP,
    status      VARCHAR(16) NOT NULL DEFAULT 'OPEN',
    UNIQUE (teller_no, shift_date)
);

CREATE TABLE IF NOT EXISTS t_cash_box (
    id            BIGSERIAL PRIMARY KEY,
    teller_no     VARCHAR(8) NOT NULL,
    shift_date    DATE       NOT NULL,
    begin_balance BIGINT     NOT NULL DEFAULT 0,
    cash_in       BIGINT     NOT NULL DEFAULT 0,
    cash_out      BIGINT     NOT NULL DEFAULT 0,
    balance       BIGINT     NOT NULL DEFAULT 0,
    UNIQUE (teller_no, shift_date)
);

CREATE TABLE IF NOT EXISTS t_cash_box_flow (
    id            BIGSERIAL PRIMARY KEY,
    teller_no     VARCHAR(8)  NOT NULL,
    shift_date    DATE        NOT NULL,
    direction     VARCHAR(4)  NOT NULL,
    amount        BIGINT      NOT NULL,
    biz_type      VARCHAR(24) NOT NULL,
    ct_txn_id     BIGINT,
    balance_after BIGINT      NOT NULL,
    created_at    TIMESTAMP   DEFAULT now()
);

CREATE TABLE IF NOT EXISTS t_counter_txn (
    id             BIGSERIAL PRIMARY KEY,
    ct_no          VARCHAR(18) NOT NULL UNIQUE,
    biz_type       VARCHAR(24) NOT NULL,
    payload        JSONB       NOT NULL,
    amount         BIGINT      NOT NULL DEFAULT 0,
    status         VARCHAR(16) NOT NULL,
    teller_no      VARCHAR(8)  NOT NULL,
    branch_no      VARCHAR(3)  NOT NULL,
    shift_date     DATE,
    reviewer_no    VARCHAR(8),
    reviewed_at    TIMESTAMP,
    review_comment VARCHAR(200),
    request_no     VARCHAR(48) UNIQUE,
    result         JSONB,
    fail_reason    VARCHAR(256),
    reversed_by    BIGINT,
    created_by     VARCHAR(32) DEFAULT 'system',
    updated_by     VARCHAR(32) DEFAULT 'system',
    created_at     TIMESTAMP   DEFAULT now(),
    updated_at     TIMESTAMP   DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ct_status ON t_counter_txn (status);
CREATE INDEX IF NOT EXISTS idx_ct_teller ON t_counter_txn (teller_no, shift_date);

CREATE TABLE IF NOT EXISTS t_voucher (
    id           BIGSERIAL PRIMARY KEY,
    ct_txn_id    BIGINT      NOT NULL,
    voucher_no   VARCHAR(16) NOT NULL UNIQUE,
    voucher_type VARCHAR(24) NOT NULL,
    content      JSONB       NOT NULL,
    generated_at TIMESTAMP   DEFAULT now()
);

CREATE TABLE IF NOT EXISTS t_day_settlement (
    id           BIGSERIAL PRIMARY KEY,
    teller_no    VARCHAR(8) NOT NULL,
    shift_date   DATE       NOT NULL,
    txn_count    INT        NOT NULL DEFAULT 0,
    cash_in      BIGINT     NOT NULL DEFAULT 0,
    cash_out     BIGINT     NOT NULL DEFAULT 0,
    debit_total  BIGINT     NOT NULL DEFAULT 0,
    credit_total BIGINT     NOT NULL DEFAULT 0,
    box_begin    BIGINT     NOT NULL DEFAULT 0,
    box_end      BIGINT     NOT NULL DEFAULT 0,
    balanced     BOOLEAN    NOT NULL DEFAULT FALSE,
    report       JSONB,
    reviewed_by  VARCHAR(8),
    UNIQUE (teller_no, shift_date)
);

CREATE TABLE IF NOT EXISTS t_review_log (
    id        BIGSERIAL PRIMARY KEY,
    ct_txn_id BIGINT      NOT NULL,
    action    VARCHAR(8)  NOT NULL,
    actor     VARCHAR(8)  NOT NULL,
    comment   VARCHAR(200),
    created_at TIMESTAMP  DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS seq_ct START 1001;
