#!/bin/bash
# PostgreSQL 首次初始化：创建 6 个业务库与独立账号（database-per-service，权限层隔离）。
set -eo pipefail

export PGHOST="${PGHOST:-localhost}"
export PGPORT="${PGPORT:-5432}"
APP_PASSWORD="${AIRBANK_DB_PASSWORD:-AirBank@2026}"
DIR="/init"
declare -A OWNER=( [airbank_uam]=uam_app [airbank_core]=core_app [airbank_wealth]=wealth_app \
                   [airbank_counter]=counter_app [airbank_ebank]=ebank_app [airbank_loan]=loan_app )

for db in "${!OWNER[@]}"; do
  user="${OWNER[$db]}"
  psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='$user'" | grep -q 1 || \
    psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres -c "CREATE ROLE $user LOGIN PASSWORD '$APP_PASSWORD';"
  psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$db'" | grep -q 1 || \
    createdb -U "$POSTGRES_USER" -O "$user" "$db"
done

psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d airbank_uam     -f "$DIR/10-uam-schema.sql"
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d airbank_core    -f "$DIR/20-core-schema.sql"
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d airbank_wealth  -f "$DIR/30-wealth-schema.sql"
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d airbank_counter -f "$DIR/40-counter-schema.sql"
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d airbank_ebank   -f "$DIR/50-ebank-schema.sql"
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d airbank_loan    -f "$DIR/60-loan-schema.sql"

for db in "${!OWNER[@]}"; do
  user="${OWNER[$db]}"
  psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$db" -c \
    "GRANT ALL ON ALL TABLES IN SCHEMA public TO $user;
     GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO $user;
     ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $user;
     ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $user;"
done

echo "[init] AirBank databases & schemas ready."
