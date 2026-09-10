-- airbank_wealth 理财系统库结构（docs/design/06 §4）
CREATE TABLE IF NOT EXISTS t_product (
    id                BIGSERIAL PRIMARY KEY,
    product_code      VARCHAR(8)    NOT NULL UNIQUE,
    product_name      VARCHAR(64)   NOT NULL,
    term_days         INT           NOT NULL,
    annual_rate       NUMERIC(6, 4) NOT NULL,
    risk_level        VARCHAR(2)    NOT NULL,
    min_amount        BIGINT        NOT NULL,
    step_amount       BIGINT        NOT NULL,
    max_single_amount BIGINT        NOT NULL,
    raise_limit       BIGINT        NOT NULL,
    raised_amount     BIGINT        NOT NULL DEFAULT 0,
    raise_start_date  DATE          NOT NULL,
    raise_end_date    DATE          NOT NULL,
    value_date        DATE          NOT NULL,
    maturity_date     DATE          NOT NULL,
    status            VARCHAR(12)   NOT NULL DEFAULT 'DRAFT',
    redeem_fee_rate   NUMERIC(6, 4) NOT NULL DEFAULT 0,
    created_by        VARCHAR(32)   DEFAULT 'system',
    updated_by        VARCHAR(32)   DEFAULT 'system',
    created_at        TIMESTAMP     DEFAULT now(),
    updated_at        TIMESTAMP     DEFAULT now()
);

CREATE TABLE IF NOT EXISTS t_wealth_order (
    id             BIGSERIAL PRIMARY KEY,
    order_no       VARCHAR(20)   NOT NULL UNIQUE,
    request_no     VARCHAR(48)   NOT NULL UNIQUE,
    order_type     VARCHAR(8)    NOT NULL,
    product_id     BIGINT        NOT NULL,
    product_code   VARCHAR(8)    NOT NULL,
    customer_id    BIGINT        NOT NULL,
    acct_no        VARCHAR(18)   NOT NULL,
    amount         BIGINT        NOT NULL,
    shares         NUMERIC(20, 2),
    income_amount  BIGINT        NOT NULL DEFAULT 0,
    status         VARCHAR(16)   NOT NULL,
    pay_txn_no     VARCHAR(26),
    redeem_txn_no  VARCHAR(26),
    income_txn_no  VARCHAR(26),
    confirm_date   DATE,
    channel        VARCHAR(8)    NOT NULL,
    operator       VARCHAR(32),
    fail_reason    VARCHAR(256),
    created_by     VARCHAR(32)   DEFAULT 'system',
    updated_by     VARCHAR(32)   DEFAULT 'system',
    created_at     TIMESTAMP     DEFAULT now(),
    updated_at     TIMESTAMP     DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_customer ON t_wealth_order (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_product  ON t_wealth_order (product_id);
CREATE INDEX IF NOT EXISTS idx_order_status   ON t_wealth_order (status);

CREATE TABLE IF NOT EXISTS t_position (
    id              BIGSERIAL PRIMARY KEY,
    customer_id     BIGINT         NOT NULL,
    product_id      BIGINT         NOT NULL,
    product_code    VARCHAR(8)     NOT NULL,
    acct_no         VARCHAR(18)    NOT NULL,
    total_shares    NUMERIC(20, 2) NOT NULL DEFAULT 0,
    frozen_shares   NUMERIC(20, 2) NOT NULL DEFAULT 0,
    cost_amount     BIGINT         NOT NULL DEFAULT 0,
    accruing_income BIGINT         NOT NULL DEFAULT 0,
    paid_income     BIGINT         NOT NULL DEFAULT 0,
    first_buy_date  DATE,
    UNIQUE (customer_id, product_id)
);

CREATE TABLE IF NOT EXISTS t_income_record (
    id         BIGSERIAL PRIMARY KEY,
    position_id BIGINT        NOT NULL,
    batch_date DATE          NOT NULL,
    income     BIGINT        NOT NULL,
    rate       NUMERIC(6, 4) NOT NULL,
    UNIQUE (position_id, batch_date)
);

CREATE TABLE IF NOT EXISTS t_settlement_batch (
    id             BIGSERIAL PRIMARY KEY,
    batch_no       VARCHAR(24) NOT NULL UNIQUE,
    product_id     BIGINT      NOT NULL,
    batch_date     DATE        NOT NULL,
    principal_total BIGINT     NOT NULL DEFAULT 0,
    income_total   BIGINT      NOT NULL DEFAULT 0,
    status         VARCHAR(12) NOT NULL,
    created_at     TIMESTAMP   DEFAULT now()
);

CREATE TABLE IF NOT EXISTS t_settlement_instruction (
    id               BIGSERIAL PRIMARY KEY,
    batch_no         VARCHAR(24) NOT NULL,
    position_id      BIGINT      NOT NULL,
    instruction_type VARCHAR(8)  NOT NULL,
    amount           BIGINT      NOT NULL,
    request_no       VARCHAR(48) NOT NULL UNIQUE,
    txn_no           VARCHAR(26),
    status           VARCHAR(8)  NOT NULL DEFAULT 'NEW',
    UNIQUE (batch_no, position_id, instruction_type)
);

CREATE TABLE IF NOT EXISTS t_recon_task (
    id                    BIGSERIAL PRIMARY KEY,
    batch_date            DATE        NOT NULL UNIQUE,
    status                VARCHAR(12) NOT NULL,
    gl_2061_balance       BIGINT      NOT NULL DEFAULT 0,
    position_principal_sum BIGINT     NOT NULL DEFAULT 0,
    diff                  BIGINT      NOT NULL DEFAULT 0,
    created_at            TIMESTAMP   DEFAULT now()
);

CREATE TABLE IF NOT EXISTS t_recon_diff (
    id          BIGSERIAL PRIMARY KEY,
    task_id     BIGINT      NOT NULL,
    diff_type   VARCHAR(8)  NOT NULL,
    biz_key     VARCHAR(48) NOT NULL,
    core_amount BIGINT      NOT NULL DEFAULT 0,
    wealth_amount BIGINT    NOT NULL DEFAULT 0,
    remark      VARCHAR(200)
);

CREATE SEQUENCE IF NOT EXISTS seq_order START 1001;
