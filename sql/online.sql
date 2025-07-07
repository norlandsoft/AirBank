-- 网银系统数据库DDL脚本

-- ================================
-- 用户表
-- ================================
DROP TABLE IF EXISTS bank_online_user;
CREATE TABLE bank_online_user
(
    id          VARCHAR(32) NOT NULL,
    name        VARCHAR(32) NOT NULL,
    password    VARCHAR(32) NOT NULL,
    customer_id varchar(32) NOT NULL,
    CONSTRAINT pk_bank_online_user PRIMARY KEY (id)
);