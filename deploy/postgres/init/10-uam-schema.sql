-- airbank_uam 用户中心库结构（docs/design/06 §2）
CREATE TABLE IF NOT EXISTS t_branch (
    id          BIGSERIAL PRIMARY KEY,
    branch_no   VARCHAR(3)  NOT NULL UNIQUE,
    branch_name VARCHAR(64) NOT NULL,
    address     VARCHAR(200),
    status      VARCHAR(16) NOT NULL DEFAULT 'NORMAL',
    created_by  VARCHAR(32) DEFAULT 'system',
    updated_by  VARCHAR(32) DEFAULT 'system',
    created_at  TIMESTAMP   DEFAULT now(),
    updated_at  TIMESTAMP   DEFAULT now()
);

CREATE TABLE IF NOT EXISTS t_customer (
    id               BIGSERIAL PRIMARY KEY,
    customer_no      VARCHAR(12)  NOT NULL UNIQUE,
    customer_name    VARCHAR(64)  NOT NULL,
    id_type          VARCHAR(2)   NOT NULL DEFAULT '01',
    id_no_enc        VARCHAR(256) NOT NULL,
    id_no_hash       CHAR(64)     NOT NULL UNIQUE,
    id_no_mask       VARCHAR(20)  NOT NULL,
    mobile_enc       VARCHAR(256) NOT NULL,
    mobile_hash      CHAR(64)     NOT NULL UNIQUE,
    mobile_mask      VARCHAR(16)  NOT NULL,
    gender           VARCHAR(2),
    occupation       VARCHAR(32),
    address          VARCHAR(200),
    risk_level       VARCHAR(2),
    risk_assess_date DATE,
    status           VARCHAR(16)  NOT NULL DEFAULT 'NORMAL',
    created_by       VARCHAR(32)  DEFAULT 'system',
    updated_by       VARCHAR(32)  DEFAULT 'system',
    created_at       TIMESTAMP    DEFAULT now(),
    updated_at       TIMESTAMP    DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customer_name ON t_customer (customer_name);

CREATE TABLE IF NOT EXISTS t_user (
    id            BIGSERIAL PRIMARY KEY,
    user_type     VARCHAR(16) NOT NULL,
    login_name    VARCHAR(32) NOT NULL UNIQUE,
    password_hash VARCHAR(72) NOT NULL,
    customer_id   BIGINT,
    teller_no     VARCHAR(8) UNIQUE,
    branch_no     VARCHAR(3),
    real_name     VARCHAR(64),
    mobile_mask   VARCHAR(16),
    status        VARCHAR(16) NOT NULL DEFAULT 'NORMAL',
    fail_count    INT         NOT NULL DEFAULT 0,
    lock_until    TIMESTAMP,
    created_by    VARCHAR(32) DEFAULT 'system',
    updated_by    VARCHAR(32) DEFAULT 'system',
    created_at    TIMESTAMP   DEFAULT now(),
    updated_at    TIMESTAMP   DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_customer ON t_user (customer_id);

CREATE TABLE IF NOT EXISTS t_role (
    id        BIGSERIAL PRIMARY KEY,
    role_code VARCHAR(24) NOT NULL UNIQUE,
    role_name VARCHAR(32) NOT NULL,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS t_permission (
    id         BIGSERIAL PRIMARY KEY,
    perm_code  VARCHAR(48) NOT NULL UNIQUE,
    perm_name  VARCHAR(64) NOT NULL,
    perm_type  VARCHAR(8)  NOT NULL DEFAULT 'ACTION',
    sort       INT         NOT NULL DEFAULT 0,
    created_at TIMESTAMP   DEFAULT now()
);

CREATE TABLE IF NOT EXISTS t_user_role (
    id      BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    role_id BIGINT NOT NULL,
    UNIQUE (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS t_role_permission (
    id            BIGSERIAL PRIMARY KEY,
    role_id       BIGINT NOT NULL,
    permission_id BIGINT NOT NULL,
    UNIQUE (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS t_risk_assessment (
    id          BIGSERIAL PRIMARY KEY,
    customer_id BIGINT     NOT NULL,
    score       INT        NOT NULL,
    level       VARCHAR(2) NOT NULL,
    answers     JSONB,
    assess_date DATE       NOT NULL,
    expire_date DATE       NOT NULL,
    created_at  TIMESTAMP  DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_risk_customer ON t_risk_assessment (customer_id, assess_date DESC);

CREATE TABLE IF NOT EXISTS t_login_log (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT,
    login_name VARCHAR(32),
    channel    VARCHAR(8),
    ip         VARCHAR(64),
    user_agent VARCHAR(200),
    result     VARCHAR(8),
    reason     VARCHAR(100),
    login_time TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_login_log_user ON t_login_log (user_id, login_time DESC);

CREATE SEQUENCE IF NOT EXISTS seq_customer START 1001;
