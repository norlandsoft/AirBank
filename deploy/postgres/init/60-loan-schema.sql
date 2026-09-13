-- airbank_loan 小额信贷系统库结构（docs/design/13 §3）
CREATE TABLE IF NOT EXISTS t_loan_product (
    id            BIGSERIAL PRIMARY KEY,
    product_code  VARCHAR(8)    NOT NULL UNIQUE,
    product_name  VARCHAR(64)   NOT NULL,
    description   VARCHAR(256),
    min_amount    BIGINT        NOT NULL,
    max_amount    BIGINT        NOT NULL,
    term_options  VARCHAR(32)   NOT NULL,
    annual_rate   NUMERIC(6, 4) NOT NULL,
    repay_method  VARCHAR(24)   NOT NULL DEFAULT 'EQUAL_INSTALLMENT',
    min_score     INT           NOT NULL DEFAULT 550,
    status        VARCHAR(12)   NOT NULL DEFAULT 'ON_SALE',
    created_by    VARCHAR(32)   DEFAULT 'system',
    updated_by    VARCHAR(32)   DEFAULT 'system',
    created_at    TIMESTAMP     DEFAULT now(),
    updated_at    TIMESTAMP     DEFAULT now()
);

CREATE TABLE IF NOT EXISTS t_loan_apply (
    id              BIGSERIAL PRIMARY KEY,
    apply_no        VARCHAR(20)   NOT NULL UNIQUE,
    request_no      VARCHAR(48)   NOT NULL UNIQUE,
    customer_id     BIGINT        NOT NULL,
    product_code    VARCHAR(8)    NOT NULL,
    amount          BIGINT        NOT NULL,
    term_months     INT           NOT NULL,
    purpose         VARCHAR(128),
    acct_no         VARCHAR(18)   NOT NULL,
    status          VARCHAR(20)   NOT NULL,
    id_check_result VARCHAR(12),
    credit_score    INT,
    approve_amount  BIGINT,
    approve_rate    NUMERIC(6, 4),
    reject_reason   VARCHAR(256),
    loan_no         VARCHAR(20),
    channel         VARCHAR(8)    NOT NULL,
    operator        VARCHAR(32),
    created_by      VARCHAR(32)   DEFAULT 'system',
    updated_by      VARCHAR(32)   DEFAULT 'system',
    created_at      TIMESTAMP     DEFAULT now(),
    updated_at      TIMESTAMP     DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_apply_customer ON t_loan_apply (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_apply_status   ON t_loan_apply (status);

CREATE TABLE IF NOT EXISTS t_loan_account (
    id              BIGSERIAL PRIMARY KEY,
    loan_no         VARCHAR(20)   NOT NULL UNIQUE,
    apply_no        VARCHAR(20)   NOT NULL UNIQUE,
    customer_id     BIGINT        NOT NULL,
    product_code    VARCHAR(8)    NOT NULL,
    product_name    VARCHAR(64)   NOT NULL,
    principal       BIGINT        NOT NULL,
    annual_rate     NUMERIC(6, 4) NOT NULL,
    term_months     INT           NOT NULL,
    repay_method    VARCHAR(24)   NOT NULL,
    acct_no         VARCHAR(18)   NOT NULL,
    disburse_txn_no VARCHAR(26),
    disburse_date   DATE,
    remain_principal BIGINT       NOT NULL,
    paid_principal  BIGINT        NOT NULL DEFAULT 0,
    paid_interest   BIGINT        NOT NULL DEFAULT 0,
    status          VARCHAR(12)   NOT NULL,
    channel         VARCHAR(8)    NOT NULL,
    operator        VARCHAR(32),
    created_by      VARCHAR(32)   DEFAULT 'system',
    updated_by      VARCHAR(32)   DEFAULT 'system',
    created_at      TIMESTAMP     DEFAULT now(),
    updated_at      TIMESTAMP     DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_loan_customer ON t_loan_account (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loan_status   ON t_loan_account (status);

CREATE TABLE IF NOT EXISTS t_loan_schedule (
    id         BIGSERIAL PRIMARY KEY,
    loan_id    BIGINT      NOT NULL,
    loan_no    VARCHAR(20) NOT NULL,
    period_no  INT         NOT NULL,
    due_date   DATE        NOT NULL,
    principal  BIGINT      NOT NULL,
    interest   BIGINT      NOT NULL,
    total      BIGINT      NOT NULL,
    status     VARCHAR(12) NOT NULL DEFAULT 'PENDING',
    paid_at    TIMESTAMP,
    created_by VARCHAR(32) DEFAULT 'system',
    updated_by VARCHAR(32) DEFAULT 'system',
    created_at TIMESTAMP   DEFAULT now(),
    updated_at TIMESTAMP   DEFAULT now(),
    UNIQUE (loan_id, period_no)
);
CREATE INDEX IF NOT EXISTS idx_schedule_due ON t_loan_schedule (due_date, status);

CREATE TABLE IF NOT EXISTS t_loan_repayment (
    id               BIGSERIAL PRIMARY KEY,
    repay_no         VARCHAR(20) NOT NULL UNIQUE,
    request_no       VARCHAR(48) NOT NULL UNIQUE,
    loan_id          BIGINT      NOT NULL,
    loan_no          VARCHAR(20) NOT NULL,
    repay_mode       VARCHAR(12) NOT NULL,
    period_no        INT,
    amount           BIGINT      NOT NULL,
    principal_part   BIGINT      NOT NULL,
    interest_part    BIGINT      NOT NULL,
    principal_txn_no VARCHAR(26),
    interest_txn_no  VARCHAR(26),
    status           VARCHAR(12) NOT NULL DEFAULT 'SUCCESS',
    fail_reason      VARCHAR(256),
    channel          VARCHAR(8)  NOT NULL,
    operator         VARCHAR(32),
    created_by       VARCHAR(32) DEFAULT 'system',
    updated_by       VARCHAR(32) DEFAULT 'system',
    created_at       TIMESTAMP   DEFAULT now(),
    updated_at       TIMESTAMP   DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_repay_loan ON t_loan_repayment (loan_id);

-- 外联系统查询留痕（mock 联网核查 / 征信）
CREATE TABLE IF NOT EXISTS t_ext_check_log (
    id            BIGSERIAL PRIMARY KEY,
    biz_no        VARCHAR(20) NOT NULL,
    check_type    VARCHAR(20) NOT NULL,
    request_text  TEXT,
    response_text TEXT,
    result        VARCHAR(12),
    created_at    TIMESTAMP   DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ext_log_biz ON t_ext_check_log (biz_no, check_type);

-- 编号序列（申请号 LA / 借据号 LN / 还款号 RP）
CREATE SEQUENCE IF NOT EXISTS seq_apply START 1;
CREATE SEQUENCE IF NOT EXISTS seq_loan  START 1;
CREATE SEQUENCE IF NOT EXISTS seq_repay START 1;
