-- airbank_core 核心系统库结构（docs/design/06 §3）
CREATE TABLE IF NOT EXISTS t_account (
    id                BIGSERIAL PRIMARY KEY,
    acct_no           VARCHAR(18) NOT NULL UNIQUE,
    card_no           VARCHAR(19) NOT NULL UNIQUE,
    customer_id       BIGINT      NOT NULL,
    acct_type         VARCHAR(8)  NOT NULL,
    product_code      VARCHAR(4)  NOT NULL,
    subject_code      VARCHAR(8)  NOT NULL,
    branch_no         VARCHAR(3)  NOT NULL,
    balance           BIGINT      NOT NULL DEFAULT 0 CHECK (balance >= 0),
    frozen_amount     BIGINT      NOT NULL DEFAULT 0,
    accrued_interest  BIGINT      NOT NULL DEFAULT 0,
    last_interest_date DATE,
    status            VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    opened_at         TIMESTAMP   DEFAULT now(),
    closed_at         TIMESTAMP,
    version           INT         NOT NULL DEFAULT 0,
    created_by        VARCHAR(32) DEFAULT 'system',
    updated_by        VARCHAR(32) DEFAULT 'system',
    created_at        TIMESTAMP   DEFAULT now(),
    updated_at        TIMESTAMP   DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_account_customer ON t_account (customer_id);
CREATE INDEX IF NOT EXISTS idx_account_status   ON t_account (status);
CREATE INDEX IF NOT EXISTS idx_account_branch   ON t_account (branch_no);

CREATE TABLE IF NOT EXISTS t_time_deposit (
    id            BIGSERIAL PRIMARY KEY,
    deposit_no    VARCHAR(20)    NOT NULL UNIQUE,
    acct_no       VARCHAR(18)    NOT NULL,
    term_months   INT            NOT NULL,
    annual_rate   NUMERIC(6, 4)  NOT NULL,
    amount        BIGINT         NOT NULL,
    value_date    DATE           NOT NULL,
    maturity_date DATE           NOT NULL,
    interest      BIGINT         NOT NULL DEFAULT 0,
    status        VARCHAR(16)    NOT NULL DEFAULT 'HOLDING',
    paid_at       TIMESTAMP,
    created_by    VARCHAR(32)    DEFAULT 'system',
    updated_by    VARCHAR(32)    DEFAULT 'system',
    created_at    TIMESTAMP      DEFAULT now(),
    updated_at    TIMESTAMP      DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_deposit_acct    ON t_time_deposit (acct_no);
CREATE INDEX IF NOT EXISTS idx_deposit_mature  ON t_time_deposit (maturity_date, status);

CREATE TABLE IF NOT EXISTS t_transaction (
    id                 BIGSERIAL PRIMARY KEY,
    txn_no             VARCHAR(26) NOT NULL UNIQUE,
    request_no         VARCHAR(48) NOT NULL UNIQUE,
    txn_type           VARCHAR(24) NOT NULL,
    amount             BIGINT      NOT NULL,
    from_acct          VARCHAR(18),
    to_acct            VARCHAR(18),
    from_balance_after BIGINT,
    to_balance_after   BIGINT,
    channel            VARCHAR(8)  NOT NULL,
    operator           VARCHAR(32),
    branch_no          VARCHAR(3),
    summary            VARCHAR(128),
    batch_date         DATE        NOT NULL,
    status             VARCHAR(12) NOT NULL,
    reverse_of         VARCHAR(26),
    finished_at        TIMESTAMP,
    created_by         VARCHAR(32) DEFAULT 'system',
    updated_by         VARCHAR(32) DEFAULT 'system',
    created_at         TIMESTAMP   DEFAULT now(),
    updated_at         TIMESTAMP   DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_txn_from   ON t_transaction (from_acct, batch_date);
CREATE INDEX IF NOT EXISTS idx_txn_to     ON t_transaction (to_acct, batch_date);
CREATE INDEX IF NOT EXISTS idx_txn_date   ON t_transaction (batch_date);
CREATE INDEX IF NOT EXISTS idx_txn_type   ON t_transaction (txn_type);

-- 会计分录（append-only）
CREATE TABLE IF NOT EXISTS t_journal (
    id            BIGSERIAL PRIMARY KEY,
    txn_no        VARCHAR(26) NOT NULL,
    entry_no      INT         NOT NULL,
    dr_cr         VARCHAR(2)  NOT NULL,
    subject_code  VARCHAR(8)  NOT NULL,
    acct_no       VARCHAR(18),
    amount        BIGINT      NOT NULL,
    balance_after BIGINT,
    summary       VARCHAR(128),
    batch_date    DATE        NOT NULL,
    created_by    VARCHAR(32) DEFAULT 'system',
    updated_by    VARCHAR(32) DEFAULT 'system',
    created_at    TIMESTAMP   DEFAULT now(),
    updated_at    TIMESTAMP   DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_journal_txn    ON t_journal (txn_no);
CREATE INDEX IF NOT EXISTS idx_journal_acct   ON t_journal (acct_no, batch_date);
CREATE INDEX IF NOT EXISTS idx_journal_subj   ON t_journal (subject_code, batch_date);
CREATE INDEX IF NOT EXISTS idx_journal_date   ON t_journal (batch_date);

CREATE TABLE IF NOT EXISTS t_gl_subject (
    subject_code VARCHAR(8)  PRIMARY KEY,
    subject_name VARCHAR(32) NOT NULL,
    category     VARCHAR(12) NOT NULL,
    direction    VARCHAR(2)  NOT NULL,
    status       VARCHAR(8)  NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE IF NOT EXISTS t_gl_balance (
    id           BIGSERIAL PRIMARY KEY,
    batch_date   DATE        NOT NULL,
    subject_code VARCHAR(8)  NOT NULL,
    dr_sum       BIGINT      NOT NULL DEFAULT 0,
    cr_sum       BIGINT      NOT NULL DEFAULT 0,
    balance      BIGINT      NOT NULL DEFAULT 0,
    UNIQUE (batch_date, subject_code)
);

CREATE TABLE IF NOT EXISTS t_accrual_interest (
    id         BIGSERIAL PRIMARY KEY,
    acct_no    VARCHAR(18)   NOT NULL,
    batch_date DATE          NOT NULL,
    accrual    BIGINT        NOT NULL,
    rate       NUMERIC(6, 4) NOT NULL,
    UNIQUE (acct_no, batch_date)
);

CREATE TABLE IF NOT EXISTS t_batch_task (
    id           BIGSERIAL PRIMARY KEY,
    batch_type   VARCHAR(24) NOT NULL,
    batch_date   DATE        NOT NULL,
    status       VARCHAR(12) NOT NULL,
    current_step INT         NOT NULL DEFAULT 0,
    started_at   TIMESTAMP,
    finished_at  TIMESTAMP,
    created_by   VARCHAR(32) DEFAULT 'system',
    created_at   TIMESTAMP   DEFAULT now(),
    UNIQUE (batch_type, batch_date)
);

CREATE TABLE IF NOT EXISTS t_batch_step_log (
    id        BIGSERIAL PRIMARY KEY,
    task_id   BIGINT      NOT NULL,
    step_no   INT         NOT NULL,
    step_name VARCHAR(64) NOT NULL,
    rows      INT         NOT NULL DEFAULT 0,
    status    VARCHAR(12) NOT NULL,
    message   VARCHAR(500),
    cost_ms   BIGINT      NOT NULL DEFAULT 0
);

CREATE SEQUENCE IF NOT EXISTS seq_acct    START 100001;
CREATE SEQUENCE IF NOT EXISTS seq_card    START 100001;
CREATE SEQUENCE IF NOT EXISTS seq_txn     START 100001;
CREATE SEQUENCE IF NOT EXISTS seq_deposit START 1001;
