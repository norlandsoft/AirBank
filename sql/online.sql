-- 网银系统数据库DDL脚本

-- ================================
-- 用户表
-- ================================
DROP TABLE IF EXISTS bank_online_user;
CREATE TABLE bank_online_user
(
    id       VARCHAR(32)  NOT NULL,
    name     VARCHAR(32)  NOT NULL,
    password VARCHAR(32)  NOT NULL,
    address  VARCHAR(256) NULL,
    email    VARCHAR(64)  NULL,
    phone    VARCHAR(32)  NULL,
    CONSTRAINT pk_bank_online_user PRIMARY KEY (id)
);