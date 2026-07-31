#!/bin/sh
# Backup toàn bộ database PostgreSQL của mono-cm sang định dạng custom (-Fc).
#
# Chạy bên trong container postgres:<major>-alpine, ghi kết quả ra /backups.
# Cấu hình đọc từ biến môi trường (xem /opt/mono-cm/.env.backup):
#
#   PGHOST, PGPORT, PGUSER, PGPASSWORD   — libpq tự đọc, không cần truyền -h/-U
#   BACKUP_DATABASES                     — danh sách database, cách nhau bằng dấu cách
#   BACKUP_KEEP_DAYS                     — số ngày giữ file trên đĩa (mặc định 14)
#
# Cách chạy:
#   docker run --rm \
#     --env-file /opt/mono-cm/.env.backup \
#     -v /opt/mono-cm/backups:/backups \
#     -v /opt/mono-cm/scripts:/scripts:ro \
#     postgres:17-alpine /scripts/pg-backup.sh
#
# Hướng dẫn đầy đủ: docs/BACKUP-RESTORE.md
set -eu

OUT=/backups
TS=$(date -u +%Y%m%dT%H%M%SZ)
KEEP=${BACKUP_KEEP_DAYS:-14}
FAILED=0

if [ -z "${BACKUP_DATABASES:-}" ]; then
  echo "[LỖI] Chưa đặt BACKUP_DATABASES. Kiểm tra lại file .env.backup."
  exit 1
fi

if [ ! -d "$OUT" ]; then
  echo "[LỖI] Không thấy thư mục $OUT. Thiếu tham số -v /opt/mono-cm/backups:/backups ?"
  exit 1
fi

echo "=== Backup bắt đầu lúc $TS (UTC) ==="

for DB in $BACKUP_DATABASES; do
  FILE="$OUT/${DB}-${TS}.dump"

  # -Fc  : custom format — nén sẵn, restore song song được, restore chọn lọc được
  # --no-owner --no-privileges : bỏ owner/quyền, để restore sang server có role khác
  if ! pg_dump -d "$DB" -Fc --no-owner --no-privileges -f "$FILE.tmp"; then
    echo "[LỖI] pg_dump thất bại: $DB"
    rm -f "$FILE.tmp"
    FAILED=1
    continue
  fi

  # Kiểm tra file đọc được trước khi công nhận là bản backup hợp lệ
  if ! pg_restore --list "$FILE.tmp" > /dev/null 2>&1; then
    echo "[LỖI] File dump hỏng, không đọc được: $DB"
    rm -f "$FILE.tmp"
    FAILED=1
    continue
  fi

  # Đổi tên là bước cuối — file .dump luôn hoàn chỉnh, không bao giờ dở dang
  mv "$FILE.tmp" "$FILE"
  echo "[OK] $FILE ($(du -h "$FILE" | cut -f1))"
done

# Backup danh sách role/user cấp server — cần khi dựng lại server từ đầu.
# -l postgres: database dùng để kết nối (user backup không có database cùng tên).
if pg_dumpall --globals-only --no-role-passwords -l postgres -f "$OUT/globals-${TS}.sql" 2>/dev/null; then
  echo "[OK] $OUT/globals-${TS}.sql"
else
  echo "[CẢNH BÁO] Không dump được globals (roles). Backup database vẫn hợp lệ."
  rm -f "$OUT/globals-${TS}.sql"
fi

# Dọn bản cũ
find "$OUT" -name '*.dump' -mtime "+$KEEP" -delete
find "$OUT" -name '*.sql'  -mtime "+$KEEP" -delete
find "$OUT" -name '*.tmp'  -mtime +1 -delete

if [ "$FAILED" -eq 0 ]; then
  echo "=== Backup hoàn tất ==="
else
  echo "=== Backup KẾT THÚC VỚI LỖI — kiểm tra log phía trên ==="
fi

exit $FAILED
