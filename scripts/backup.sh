#!/bin/sh
# Backup diário do banco (PostgreSQL) e das imagens (MinIO).
# Uso (na pasta do projeto, no servidor):   sh scripts/backup.sh
# Agendar às 3h (crontab -e):
#   0 3 * * * cd /caminho/do/projeto && sh scripts/backup.sh >> backups/backup.log 2>&1
# Depois copie a pasta backups/ para fora do servidor (Google Drive, S3, outro servidor).
set -e
cd "$(dirname "$0")/.."
[ -f .env ] && . ./.env
DB_USER=${DB_USER:-paulopop}
DB_NAME=${DB_NAME:-academypop}
KEEP_DAYS=${KEEP_DAYS:-14}
STAMP=$(date +%Y-%m-%d_%H%M)
mkdir -p backups

echo "[$STAMP] Backup do banco..."
docker compose exec -T postgres pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner | gzip > "backups/db_$STAMP.sql.gz"

echo "[$STAMP] Backup das imagens (MinIO)..."
MINIO_ID=$(docker compose ps -q minio)
docker run --rm --volumes-from "$MINIO_ID" alpine tar czf - /data > "backups/minio_$STAMP.tar.gz"

echo "[$STAMP] Removendo backups com mais de $KEEP_DAYS dias..."
find backups -name 'db_*.sql.gz' -mtime +"$KEEP_DAYS" -delete
find backups -name 'minio_*.tar.gz' -mtime +"$KEEP_DAYS" -delete

echo "[$STAMP] OK"
# Restaurar o banco:
#   gunzip -c backups/db_AAAA-MM-DD_HHMM.sql.gz | docker compose exec -T postgres psql -U $DB_USER -d $DB_NAME
