#!/bin/sh
# Kiểm chứng một bản backup có thật sự restore được hay không.
#
# Quy trình tự động, không đụng vào database nguồn (chỉ đọc):
#   1. Đọc phiên bản PostgreSQL của nguồn, chọn đúng bộ công cụ
#   2. Đếm chính xác số bản ghi mọi bảng ở nguồn  -> mốc đối chiếu
#   3. pg_dump -Fc ra file
#   4. Dựng một PostgreSQL tạm trong Docker
#   5. pg_restore vào đó
#   6. Đếm lại và so từng bảng với mốc ban đầu
#   7. Dọn container tạm, giữ lại file dump
#
# Cách chạy:
#   SOURCE_URL="postgresql://user:pass@host/db?sslmode=require" ./scripts/pg-verify-restore.sh
#
# Yêu cầu: máy chạy script phải có Docker.
#
# Hướng dẫn đầy đủ: docs/BACKUP-RESTORE.md
set -eu

WORKDIR=${WORKDIR:-./backup-verify}
KEEP_TARGET=${KEEP_TARGET:-0}   # đặt 1 để giữ lại container tạm sau khi chạy xong
TARGET_DB=verify_target
CID=""
NET=""

# ── Câu lệnh đếm chính xác số dòng mọi bảng trong schema public ──────────────
COUNT_SQL="SELECT table_name || '=' || (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name), false, true, '')))[1]::text FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name"

log()  { echo "$*"; }
fail() { echo "[LỖI] $*" >&2; exit 1; }

cleanup() {
  [ -n "$CID" ] && [ "$KEEP_TARGET" != "1" ] && docker rm -f "$CID" >/dev/null 2>&1 || true
  [ -n "$NET" ] && [ "$KEEP_TARGET" != "1" ] && docker network rm "$NET" >/dev/null 2>&1 || true
  return 0
}
trap cleanup EXIT INT TERM

# ── Kiểm tra đầu vào ─────────────────────────────────────────────────────────
[ -n "${SOURCE_URL:-}" ] || fail "Chưa đặt SOURCE_URL. Ví dụ:
  SOURCE_URL=\"postgresql://user:pass@host/db?sslmode=require\" $0"

command -v docker >/dev/null 2>&1 || fail "Không tìm thấy Docker. Script này cần Docker để dựng PostgreSQL tạm."
docker info >/dev/null 2>&1 || fail "Docker chưa chạy. Khởi động Docker rồi chạy lại."

# ── Neon: bắt buộc dùng endpoint trực tiếp, không dùng endpoint pooler ───────
# Endpoint pooler đi qua PgBouncer ở chế độ transaction; pg_dump cần giữ một
# transaction xuyên suốt nên dump qua pooler có thể lỗi hoặc ra dữ liệu không
# nhất quán. Chuỗi kết nối pooler nhận ra qua "-pooler" trong tên host.
case "$SOURCE_URL" in
  *-pooler.*)
    SOURCE_URL=$(echo "$SOURCE_URL" | sed 's/-pooler\./\./')
    log "[LƯU Ý] Đã tự chuyển sang endpoint trực tiếp (bỏ '-pooler')."
    log "        pg_dump không dùng được qua connection pooler."
    ;;
esac

mkdir -p "$WORKDIR"

# ── Bước 1: phiên bản PostgreSQL của nguồn ───────────────────────────────────
log ""
log "=== [1/6] Đọc thông tin database nguồn ==="

SRC_VER=$(docker run --rm -e U="$SOURCE_URL" postgres:18-alpine \
  sh -c 'psql "$U" -tAc "SHOW server_version"' 2>/dev/null | tr -d ' ') \
  || fail "Không kết nối được tới database nguồn. Kiểm tra lại SOURCE_URL."

MAJOR=$(echo "$SRC_VER" | cut -d. -f1)
case "$MAJOR" in
  1[0-9]|[0-9]) ;;
  *) fail "Không đọc được major version từ chuỗi '$SRC_VER'." ;;
esac

IMG="postgres:${MAJOR}-alpine"
log "Phiên bản nguồn : $SRC_VER (major $MAJOR)"
log "Bộ công cụ dùng : $IMG"

# ── Bước 2: mốc đối chiếu ────────────────────────────────────────────────────
log ""
log "=== [2/6] Đếm số bản ghi ở nguồn ==="

docker run --rm -e U="$SOURCE_URL" -e Q="$COUNT_SQL" "$IMG" \
  sh -c 'psql "$U" -Atc "$Q"' > "$WORKDIR/counts-source.txt" \
  || fail "Không đếm được số bản ghi ở nguồn."

SRC_TABLES=$(wc -l < "$WORKDIR/counts-source.txt" | tr -d ' ')
[ "$SRC_TABLES" -gt 0 ] || fail "Database nguồn không có bảng nào trong schema public."
log "Tìm thấy $SRC_TABLES bảng."

# ── Bước 3: dump ─────────────────────────────────────────────────────────────
log ""
log "=== [3/6] pg_dump ==="

DUMP="$WORKDIR/source.dump"
docker run --rm -e U="$SOURCE_URL" -v "$(cd "$WORKDIR" && pwd):/w" "$IMG" \
  sh -c 'pg_dump -d "$U" -Fc --no-owner --no-privileges -f /w/source.dump' \
  || fail "pg_dump thất bại."

docker run --rm -v "$(cd "$WORKDIR" && pwd):/w" "$IMG" \
  pg_restore --list /w/source.dump > /dev/null \
  || fail "File dump không đọc được."

log "Đã tạo $DUMP ($(du -h "$DUMP" | cut -f1))"

# ── Bước 4: dựng PostgreSQL tạm ──────────────────────────────────────────────
log ""
log "=== [4/6] Dựng PostgreSQL tạm để thử restore ==="

NET="cm-verify-net-$$"
docker network create "$NET" >/dev/null

CID=$(docker run -d --name "cm-verify-pg-$$" --network "$NET" \
  -e POSTGRES_PASSWORD=verify "$IMG")

i=0
until docker exec "$CID" pg_isready -U postgres >/dev/null 2>&1; do
  i=$((i + 1))
  [ "$i" -gt 60 ] && fail "PostgreSQL tạm không khởi động được sau 60 giây."
  sleep 1
done
log "PostgreSQL tạm đã sẵn sàng (container ${CID%%[0-9a-f][0-9a-f]*}...)."

# ── Bước 5: restore ──────────────────────────────────────────────────────────
log ""
log "=== [5/6] pg_restore vào database tạm ==="

HOSTNAME_PG="cm-verify-pg-$$"
docker run --rm --network "$NET" \
  -e PGHOST="$HOSTNAME_PG" -e PGUSER=postgres -e PGPASSWORD=verify \
  "$IMG" createdb "$TARGET_DB" || fail "Không tạo được database tạm."

set +e
docker run --rm --network "$NET" \
  -e PGHOST="$HOSTNAME_PG" -e PGUSER=postgres -e PGPASSWORD=verify \
  -v "$(cd "$WORKDIR" && pwd):/w" "$IMG" \
  pg_restore -d "$TARGET_DB" --no-owner --no-privileges -j 4 /w/source.dump \
  > "$WORKDIR/restore.log" 2>&1
RESTORE_RC=$?
set -e

ERR_COUNT=$(grep -c 'error:' "$WORKDIR/restore.log" 2>/dev/null || true)
ERR_COUNT=${ERR_COUNT:-0}

if [ "$ERR_COUNT" -gt 0 ]; then
  log "[CẢNH BÁO] pg_restore báo $ERR_COUNT lỗi. Chi tiết: $WORKDIR/restore.log"
  head -20 "$WORKDIR/restore.log"
else
  log "pg_restore chạy sạch, không có lỗi nào."
fi

# ── Bước 6: đối chiếu ────────────────────────────────────────────────────────
log ""
log "=== [6/6] Đối chiếu số bản ghi ==="

docker run --rm --network "$NET" \
  -e PGHOST="$HOSTNAME_PG" -e PGUSER=postgres -e PGPASSWORD=verify -e Q="$COUNT_SQL" \
  "$IMG" sh -c 'psql -d '"$TARGET_DB"' -Atc "$Q"' > "$WORKDIR/counts-restored.txt" \
  || fail "Không đếm được số bản ghi ở bản restore."

log ""
if diff -u "$WORKDIR/counts-source.txt" "$WORKDIR/counts-restored.txt" > "$WORKDIR/counts.diff"; then
  TOTAL=$(awk -F= '{s += $2} END {print s+0}' "$WORKDIR/counts-source.txt")
  log "┌────────────────────────────────────────────────┐"
  log "│  ĐẠT — bản backup restore được, dữ liệu khớp   │"
  log "└────────────────────────────────────────────────┘"
  log "  Số bảng   : $SRC_TABLES"
  log "  Số bản ghi: $TOTAL"
  log "  File dump : $DUMP"
  [ "$ERR_COUNT" -gt 0 ] && log "  Lưu ý     : pg_restore có $ERR_COUNT cảnh báo, xem restore.log"
  RESULT=0
else
  log "┌────────────────────────────────────────────────┐"
  log "│  KHÔNG ĐẠT — số bản ghi lệch giữa hai bên      │"
  log "└────────────────────────────────────────────────┘"
  log ""
  log "Dòng '-' là nguồn, dòng '+' là bản restore:"
  cat "$WORKDIR/counts.diff"
  log ""
  log "Nếu database nguồn vẫn đang có người nhập liệu thì lệch vài dòng là bình thường."
  log "Chạy lại lúc không có ai thao tác để có kết quả chính xác."
  RESULT=1
fi

log ""
log "Kết quả chi tiết trong $WORKDIR/"
[ "$KEEP_TARGET" = "1" ] && log "Container tạm được giữ lại: $HOSTNAME_PG (nhớ xoá thủ công)"

exit ${RESULT:-0}
