# Quy trình Backup & Restore Database — mono-cm

Tài liệu vận hành cho team. Áp dụng cho toàn bộ database PostgreSQL của hệ thống — cả server trung tâm lẫn máy chủ đặt tại từng tòa án.

> **Nguyên tắc số 1:** backup phải làm ở **tầng database** (`pg_dump`), không phải ở tầng ứng dụng.
> Nút "Sao lưu" trong giao diện admin **không** thay thế được quy trình này — xem [Phụ lục B](#phụ-lục-b--về-nút-sao-lưukhôi-phục-trong-giao-diện-admin).

---

## Tổng quan kiến trúc

Hệ thống có **hai nơi** cần backup, với mục đích hoàn toàn khác nhau:

```
          TRUNG TÂM                                TÒA ÁN (mỗi tỉnh một máy)
┌──────────────────────────────┐            ┌────────────────────────────────┐
│ VPS Backend 103.152.164.153  │            │ Windows Server + Docker Desktop│
│   dongnai_server             │            │   PostgreSQL 18                │
│   longan_server              │            │   dongnai_city ◀── DỮ LIỆU THẬT│
│                              │            │                                │
│ VPS DB 160.30.160.49         │  bàn giao  │ C:\mono-cm\backups\            │
│   PostgreSQL 18              │ ─────────▶ │      ▲                         │
│   dongnai_city (dàn dựng)    │  qua mạng  │      │ Task Scheduler 02:00    │
│   longan_city  (dàn dựng)    │  (Phần E)  │      └── pg-backup.sh          │
│                              │            │      │                         │
│ cron 02:00 ──▶ pg-backup.sh  │            │      ▼                         │
│   /opt/mono-cm/backups/      │            │ Ổ ngoài / thư mục mạng         │
│         │                    │            └────────────────────────────────┘
│         ▼ 02:30 (đã mã hoá)  │
└─────────┼────────────────────┘
          ▼
   Off-site (S3 / Google Drive)
```

**Điểm quan trọng nhất phải hiểu đúng:** sau khi bàn giao, **dữ liệu thật nằm ở máy tòa án**, không nằm ở trung tâm. Trung tâm chỉ giữ bản dàn dựng ban đầu. Cán bộ tòa án nhập hồ sơ hằng ngày lên máy của họ, và **không ai khác có bản sao dữ liệu đó**.

| Nơi | Backup để bảo vệ cái gì | Ai chịu trách nhiệm |
|---|---|---|
| Trung tâm | Dữ liệu dàn dựng, dữ liệu demo, cấu hình | Team kỹ thuật |
| **Tòa án** | **Toàn bộ hồ sơ nghiệp vụ — mất là mất hẳn** | Team cài đặt, tòa án vận hành |

Vì vậy [Phần E6](#e6-bật-backup-định-kỳ-tại-tòa-án) quan trọng hơn toàn bộ Phần A. Bàn giao xong mà không bật backup tại chỗ là để một ổ cứng hỏng xoá sổ hồ sơ của cả một tòa án.

**Quy tắc 3-2-1:** 3 bản sao, 2 loại lưu trữ khác nhau, **1 bản nằm ngoài máy chủ**.
Bản dump nằm cùng ổ đĩa với database **không được tính là backup** — ổ hỏng là mất cả hai.

---

## Quy ước bắt buộc: thống nhất phiên bản PostgreSQL

**Toàn hệ thống dùng cùng một major version.** Tài liệu này lấy mốc **PostgreSQL 18**; nếu đơn vị chốt phiên bản khác thì thay đồng loạt trong mọi lệnh bên dưới (`postgres:18-alpine` → `postgres:<major>-alpine`).

Đây không phải quy định hình thức: `pg_restore` **không nạp được** bản dump sinh ra từ server **mới hơn**. Trung tâm chạy PG 18 mà một tòa án cài PG 15 thì gói bàn giao sẽ hỏng đúng ở bước cuối — khi đã tới nơi và đã hẹn lịch với đơn vị.

Kiểm tra ở **cả hai đầu** trước mỗi lần bàn giao, hai số major phải bằng nhau:

```bash
docker run --rm postgres:18-alpine psql "postgresql://postgres:MẬT_KHẨU@ĐỊA_CHỈ:5432/postgres" -tAc "SHOW server_version"
```

Lệch phiên bản thì dừng lại, xử lý xong mới bàn giao. Không có cách "lách" an toàn.

---

## Phần A — Cài đặt backup tự động ở trung tâm (làm một lần)

### A1. Xác nhận phiên bản PostgreSQL

Chạy lệnh ở mục [Quy ước bắt buộc](#quy-ước-bắt-buộc-thống-nhất-phiên-bản-postgresql) với địa chỉ `160.30.160.49` và ghi lại số major. Tag image dùng để dump phải **bằng hoặc mới hơn** phiên bản server; toàn bộ tài liệu dùng `postgres:18-alpine`.

### A2. Tạo user riêng cho backup

Không dùng user ứng dụng (`dn_city`) và cũng không dùng `postgres` để chạy backup định kỳ. Kết nối bằng `postgres` rồi chạy, **trên từng database**:

```bash
docker run --rm -it postgres:18-alpine psql "postgresql://postgres:MẬT_KHẨU@160.30.160.49:5432/dongnai_city"
```

```sql
CREATE ROLE cm_backup LOGIN PASSWORD 'ĐẶT_MẬT_KHẨU_MẠNH';
GRANT pg_read_all_data TO cm_backup;
GRANT CONNECT ON DATABASE dongnai_city TO cm_backup;
```

`CREATE ROLE` và `GRANT pg_read_all_data` là cấp **toàn server** — chỉ chạy một lần. Riêng `GRANT CONNECT` là cấp **từng database**, phải chạy lại cho mỗi tỉnh (`dongnai_city`, `longan_city`, …) và cho mỗi database mới thêm về sau.

> `pg_read_all_data` yêu cầu PostgreSQL 14 trở lên. Nếu server cũ hơn, tạm dùng user `postgres` cho backup và ghi chú lại để nâng cấp sau.

### A3. Tạo file cấu hình trên VPS backend

```bash
nano /opt/mono-cm/.env.backup
```

```bash
# libpq tự đọc các biến PG* này — không cần truyền tham số -h -U trong lệnh
PGHOST=160.30.160.49
PGPORT=5432
PGUSER=cm_backup
PGPASSWORD=MẬT_KHẨU_Ở_BƯỚC_A2

# Danh sách database, cách nhau bằng dấu cách. Thêm tỉnh mới thì thêm vào đây.
BACKUP_DATABASES=dongnai_city longan_city

# Số ngày giữ bản dump trên VPS
BACKUP_KEEP_DAYS=14
```

Khoá quyền đọc — file này chứa mật khẩu:

```bash
chmod 600 /opt/mono-cm/.env.backup
```

> File `.env.backup` **không được commit vào git**. Copy thủ công lên server như các file `.env.<tỉnh>` khác.

### A4. Lấy script backup

Script nằm sẵn trong repo tại [`scripts/pg-backup.sh`](../scripts/pg-backup.sh). VPS backend đã clone repo ở `/opt/mono-cm`, nên chỉ cần kéo về:

```bash
cd /opt/mono-cm && git pull origin main && mkdir -p /opt/mono-cm/backups && chmod +x scripts/pg-backup.sh
```

> **Lưu ý:** GitHub Actions chỉ tự deploy khi có thay đổi trong `server/**`, `lib/**`, `prisma/**` hoặc `docker-compose.server.yml`. Thư mục `scripts/**` **không** nằm trong danh sách đó, nên mỗi lần script backup được sửa, phải `git pull` thủ công trên VPS. Đây là chủ ý — sửa script backup không đáng để restart toàn bộ container ứng dụng.

Script làm những việc sau, không cần chỉnh gì thêm:

- Dump từng database trong `BACKUP_DATABASES` ra định dạng `-Fc` với `--no-owner --no-privileges`
- Ghi ra file `.tmp` rồi mới đổi tên thành `.dump` — file `.dump` **luôn** là file hoàn chỉnh, không bao giờ có bản dở dang bị nhầm là backup hợp lệ
- Chạy `pg_restore --list` để xác nhận file đọc được trước khi công nhận
- Dump thêm danh sách role cấp server (`globals-*.sql`) — cần khi dựng lại server từ đầu
- Xoá các bản cũ hơn `BACKUP_KEEP_DAYS`
- Trả exit code khác 0 nếu bất kỳ database nào lỗi, để cron ghi nhận được

### A5. Chạy thử

```bash
docker run --rm --env-file /opt/mono-cm/.env.backup -v /opt/mono-cm/backups:/backups -v /opt/mono-cm/scripts:/scripts:ro postgres:18-alpine /scripts/pg-backup.sh
```

Kết quả mong đợi: mỗi database in một dòng `[OK]` kèm dung lượng. Kiểm tra lại:

```bash
ls -lh /opt/mono-cm/backups/
```

### A6. Đặt lịch chạy hằng ngày

```bash
crontab -e
```

Thêm dòng (02:00 mỗi ngày, giờ hệ thống của VPS):

```
0 2 * * * /usr/bin/docker run --rm --env-file /opt/mono-cm/.env.backup -v /opt/mono-cm/backups:/backups -v /opt/mono-cm/scripts:/scripts:ro postgres:18-alpine /scripts/pg-backup.sh >> /var/log/pg-backup.log 2>&1
```

Xác nhận đã nhận lịch:

```bash
crontab -l
```

### A7. Đẩy bản backup ra ngoài VPS

Backup nằm một chỗ với server thì chưa an toàn. Cấu hình `rclone` trỏ tới nơi lưu trữ của đơn vị (S3, Google Drive, OneDrive…):

```bash
docker run --rm -it -v /opt/mono-cm/rclone:/config/rclone rclone/rclone config
```

Dữ liệu là hồ sơ tòa án kèm hash mật khẩu người dùng — **phải mã hoá trước khi rời VPS**. Cách gọn nhất là dùng `rclone crypt` (tạo remote loại `crypt` bọc lên remote gốc trong bước config ở trên), rồi thêm cron:

```
30 2 * * * /usr/bin/docker run --rm -v /opt/mono-cm/rclone:/config/rclone -v /opt/mono-cm/backups:/data:ro rclone/rclone copy /data cm-crypt:backups --max-age 30d >> /var/log/pg-backup.log 2>&1
```

> Dùng `copy` chứ không dùng `sync`: `copy` chỉ thêm file mới, không bao giờ xoá ở đích. Việc dọn bản cũ off-site nên đặt bằng lifecycle rule của dịch vụ lưu trữ — như vậy dù VPS bị chiếm quyền cũng không xoá được backup từ xa.

### A8. Cảnh báo khi backup hỏng

Backup âm thầm chết là kịch bản tệ nhất. Thêm cron kiểm tra mỗi sáng — nếu bản dump mới nhất cũ hơn 26 tiếng thì báo động:

```
0 8 * * * find /opt/mono-cm/backups -name 'dongnai_city-*.dump' -mmin -1560 | grep -q . || echo "CẢNH BÁO: backup dongnai_city quá 26h chưa chạy" | mail -s "[mono-cm] Backup FAIL" admin@example.com
```

Nếu VPS chưa có `mail`, thay bằng một lệnh `curl` gửi vào webhook Telegram/Slack của team.

---

## Phần B — Backup thủ công

Chạy **bắt buộc** trước mỗi lần: deploy có migration, sửa dữ liệu hàng loạt, nâng cấp PostgreSQL, hoặc thao tác trực tiếp bằng SQL trên production.

```bash
docker run --rm --env-file /opt/mono-cm/.env.backup -v /opt/mono-cm/backups:/backups -v /opt/mono-cm/scripts:/scripts:ro postgres:18-alpine /scripts/pg-backup.sh
```

Chỉ một database:

```bash
docker run --rm --env-file /opt/mono-cm/.env.backup -v /opt/mono-cm/backups:/backups postgres:18-alpine sh -c 'pg_dump -d dongnai_city -Fc --no-owner --no-privileges -f /backups/dongnai_city-truoc-migration.dump'
```

---

## Phần C — Restore

### C1. Restore sang database mới (an toàn — dùng cho hầu hết trường hợp)

Đây là cách nên dùng kể cả khi mục tiêu cuối là ghi đè production: restore ra database tạm, kiểm tra xong mới đổi tên. Không đụng vào dữ liệu đang chạy.

**Bước 1 — Tạo database trống, đặt chủ sở hữu là user của ứng dụng**

```bash
docker run --rm --env-file /opt/mono-cm/.env.backup postgres:18-alpine sh -c 'PGUSER=postgres PGPASSWORD=MẬT_KHẨU_POSTGRES createdb -O dn_city dongnai_city_restore'
```

**Bước 2 — Nạp dữ liệu, kết nối bằng chính user của ứng dụng**

```bash
docker run --rm --env-file /opt/mono-cm/.env.backup -v /opt/mono-cm/backups:/backups postgres:18-alpine sh -c 'PGUSER=dn_city PGPASSWORD=MẬT_KHẨU_DN_CITY pg_restore -d dongnai_city_restore --no-owner --no-privileges -j 4 /backups/dongnai_city-20260728T020000Z.dump'
```

> **Quan trọng:** hai bước trên phải chạy bằng user `dn_city` (lấy trong `.env.dongnai`), không phải `postgres`. Vì `--no-owner` khiến mọi bảng thuộc về **user đang thực hiện restore** — nếu restore bằng `postgres` thì ứng dụng sẽ nhận `permission denied for table ...` ngay khi khởi động. Với mỗi tỉnh, thay `dn_city` bằng user tương ứng.

**Bước 3 — Cập nhật thống kê** (bỏ qua thì truy vấn sẽ chậm bất thường sau restore)

```bash
docker run --rm --env-file /opt/mono-cm/.env.backup postgres:18-alpine sh -c 'PGUSER=dn_city PGPASSWORD=MẬT_KHẨU_DN_CITY psql -d dongnai_city_restore -c "ANALYZE"'
```

**Bước 4 — Kiểm chứng** (xem [Phần D](#phần-d--kiểm-chứng-bản-restore))

**Bước 5 — Đổi vai** (chỉ khi đã kiểm chứng xong và muốn thay production)

```bash
docker stop dongnai_server
```

```bash
docker run --rm --env-file /opt/mono-cm/.env.backup postgres:18-alpine sh -c 'PGUSER=postgres PGPASSWORD=MẬT_KHẨU_POSTGRES psql -d postgres -c "ALTER DATABASE dongnai_city RENAME TO dongnai_city_old" -c "ALTER DATABASE dongnai_city_restore RENAME TO dongnai_city"'
```

```bash
docker start dongnai_server && docker logs -f --tail 50 dongnai_server
```

Giữ `dongnai_city_old` ít nhất vài ngày rồi mới xoá — đó là đường lùi nếu phát hiện sai sót.

> Không cần chạy `prisma migrate deploy` trước khi restore. Bản dump đã mang theo toàn bộ schema và cả bảng `_prisma_migrations`, nên database sau restore là bản sao tự chứa.

### C2. Restore đè lên database đang chạy (khẩn cấp)

Chỉ dùng khi production đã hỏng và cần khôi phục nhanh nhất.

```bash
docker stop dongnai_server
```

**Vẫn phải dump hiện trạng trước** — kể cả khi dữ liệu đang hỏng, đó là bằng chứng để điều tra sau:

```bash
docker run --rm --env-file /opt/mono-cm/.env.backup -v /opt/mono-cm/backups:/backups postgres:18-alpine sh -c 'pg_dump -d dongnai_city -Fc --no-owner --no-privileges -f /backups/dongnai_city-TRUOC-KHI-RESTORE.dump'
```

Xoá và tạo lại database (`--force` tự ngắt các kết nối còn treo):

```bash
docker run --rm --env-file /opt/mono-cm/.env.backup postgres:18-alpine sh -c 'PGUSER=postgres PGPASSWORD=MẬT_KHẨU_POSTGRES dropdb --force dongnai_city && PGUSER=postgres PGPASSWORD=MẬT_KHẨU_POSTGRES createdb -O dn_city dongnai_city'
```

Nạp lại, cập nhật thống kê, bật app:

```bash
docker run --rm --env-file /opt/mono-cm/.env.backup -v /opt/mono-cm/backups:/backups postgres:18-alpine sh -c 'export PGUSER=dn_city PGPASSWORD=MẬT_KHẨU_DN_CITY; pg_restore -d dongnai_city --no-owner --no-privileges -j 4 /backups/dongnai_city-20260728T020000Z.dump && psql -d dongnai_city -c "ANALYZE"'
```

```bash
docker start dongnai_server && curl -s https://namnn07.zhost.store/dongnai/health
```

### C3. Restore chỉ một bảng

Ưu điểm của định dạng `-Fc`: lấy lại được một bảng mà không đụng phần còn lại.

Xem danh sách đối tượng trong file dump:

```bash
docker run --rm -v /opt/mono-cm/backups:/backups postgres:18-alpine pg_restore --list /backups/dongnai_city-20260728T020000Z.dump | grep 'TABLE DATA'
```

Nạp lại đúng bảng đó (bảng phải đang **rỗng**, nếu không sẽ đụng khoá chính):

```bash
docker run --rm --env-file /opt/mono-cm/.env.backup -v /opt/mono-cm/backups:/backups postgres:18-alpine sh -c 'PGUSER=dn_city PGPASSWORD=MẬT_KHẨU_DN_CITY pg_restore -d dongnai_city --data-only -t "BorrowSlip" --no-owner /backups/dongnai_city-20260728T020000Z.dump'
```

> Lưu ý ràng buộc khoá ngoại: khôi phục `BorrowSlip` mà thiếu `File` tương ứng sẽ báo lỗi. Nếu phải khôi phục nhiều bảng liên quan, làm theo cách C1 rồi copy dữ liệu sang thì an toàn hơn.

---

## Phần D — Kiểm chứng bản restore

Một bản backup chưa từng được restore thử thì chưa phải là backup.

### D1. So số bản ghi giữa hai database

Câu lệnh dưới đếm **chính xác** số dòng của mọi bảng (không dùng số ước lượng của `pg_stat`). Chạy trên **cả** database gốc và database vừa restore:

```bash
docker run --rm --env-file /opt/mono-cm/.env.backup postgres:18-alpine psql -d dongnai_city_restore -Atc "SELECT table_name || '=' || (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name), false, true, '')))[1]::text FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name"
```

Đưa hai kết quả vào file rồi `diff` — phải giống nhau **tuyệt đối**, trừ khi database gốc vẫn đang có người dùng ghi thêm.

Hệ thống hiện có 15 bảng, kết quả phải liệt kê đủ: `AgencyHistory`, `AuditLog`, `BackupRun`, `BackupSchedule`, `BorrowItem`, `BorrowSlip`, `BorrowSlipEvent`, `Document`, `File`, `FileIndex`, `StorageBox`, `StorageBoxLabel`, `StorageLayout`, `user`, `UserAccessLog`.

### D2. Kiểm tra schema khớp với code

```bash
DATABASE_URL="postgresql://dn_city:MẬT_KHẨU@160.30.160.49:5432/dongnai_city_restore" bunx prisma migrate status
```

Chạy lệnh này từ máy dev có source code và đã `bun install` (VPS backend chỉ có image, không có `node_modules`).

Phải ra `Database schema is up to date!`. Nếu báo có migration chưa áp dụng nghĩa là bản dump cũ hơn code hiện tại — chạy `bunx prisma migrate deploy` với đúng `DATABASE_URL` đó rồi kiểm tra lại.

### D3. Kiểm tra bằng ứng dụng

Trỏ một container tạm vào database vừa restore, đăng nhập và mở thử: danh sách hồ sơ, chi tiết một hồ sơ có tài liệu con, một phiếu mượn, sơ đồ kho, nhật ký truy cập.

### D4. Diễn tập định kỳ — mỗi tháng một lần

| # | Việc | Ai làm |
|---|------|--------|
| 1 | Lấy bản dump mới nhất **từ nơi lưu off-site**, không lấy bản trên VPS | Trực vận hành |
| 2 | Restore vào `*_drill` theo mục C1 bước 1–3 | Trực vận hành |
| 3 | Chạy D1 + D2, ghi lại thời gian hoàn thành | Trực vận hành |
| 4 | Xoá database `*_drill` | Trực vận hành |
| 5 | Ghi kết quả vào sổ vận hành (ngày, dung lượng, thời gian restore, đạt/không) | Trực vận hành |

Con số ở bước 3 chính là **thời gian phục hồi thực tế** của hệ thống. Không diễn tập thì con số đó chỉ là phỏng đoán.

---

## Phần E — Bàn giao database xuống máy chủ tòa án

Phần này dành cho lần cài đặt đầu tiên tại mỗi tòa án: đưa database từ trung tâm về máy chủ của đơn vị, rồi bật backup tại chỗ.

**Môi trường giả định ở tòa án:** Windows Server, Docker Desktop, PostgreSQL 18. Nếu một tòa án dùng môi trường khác, xem [Phụ lục D](#phụ-lục-d--đối-chiếu-lệnh-giữa-các-môi-trường).

**Chuẩn bị trước khi đi:** đọc [Quy ước bắt buộc](#quy-ước-bắt-buộc-thống-nhất-phiên-bản-postgresql) và xác nhận phiên bản PostgreSQL ở tòa án **trước** ngày bàn giao, không phải lúc đã tới nơi.

### E1. Đóng gói ở trung tâm

Dump **riêng** database của tòa án đó. Không gửi nhầm database của tỉnh khác — đây là hồ sơ tòa án, gửi nhầm là sự cố lộ dữ liệu.

```bash
docker run --rm --env-file /opt/mono-cm/.env.backup -v /opt/mono-cm/handover:/out postgres:18-alpine sh -c 'pg_dump -d dongnai_city -Fc --no-owner --no-privileges -f /out/dongnai_city-bangiao.dump'
```

Tạo mã kiểm tra để đầu nhận đối chiếu:

```bash
cd /opt/mono-cm/handover && sha256sum dongnai_city-bangiao.dump | tee dongnai_city-bangiao.dump.sha256
```

Mã hoá trước khi đưa lên mạng. Cài `7z` một lần nếu chưa có (`apt install -y p7zip-full`), rồi:

```bash
cd /opt/mono-cm/handover && 7z a -t7z -mhe=on -p dongnai_city-bangiao.7z dongnai_city-bangiao.dump dongnai_city-bangiao.dump.sha256
```

`-p` không kèm mật khẩu ở đây là cố ý: lệnh sẽ hỏi mật khẩu tương tác, không lưu vào lịch sử shell. `-mhe=on` mã hoá cả danh sách tên file bên trong.

Xoá bản chưa mã hoá sau khi đóng gói xong:

```bash
rm -f /opt/mono-cm/handover/dongnai_city-bangiao.dump
```

### E2. Chuyển qua mạng

- Gửi **file `.7z`** qua SFTP hoặc link tải có hạn dùng.
- Gửi **mật khẩu qua kênh khác** — gọi điện hoặc nhắn tin trực tiếp cho cán bộ phụ trách. Không gửi mật khẩu cùng kênh với link. Kênh nào gửi được link thì kênh đó cũng đọc được nếu bị lộ.
- Hết hạn hoặc xoá link ngay sau khi đầu nhận báo đã tải xong.

Ví dụ đẩy bằng SFTP:

```bash
scp /opt/mono-cm/handover/dongnai_city-bangiao.7z user@may-chu-toa-an:/c/mono-cm/handover/
```

### E3. Chuẩn bị máy chủ tòa án

Trên máy Windows, mở **PowerShell với quyền Administrator**:

```powershell
mkdir C:\mono-cm\backups, C:\mono-cm\scripts, C:\mono-cm\handover -Force
```

Giải nén `.7z` (chuột phải → 7-Zip → Extract Here, nhập mật khẩu) vào `C:\mono-cm\handover\`, rồi đối chiếu mã kiểm tra:

```powershell
Get-FileHash -Algorithm SHA256 C:\mono-cm\handover\dongnai_city-bangiao.dump | Format-List Hash
```

So chuỗi in ra với nội dung file `.sha256` — phải **giống hệt**. Khác một ký tự nghĩa là file hỏng trên đường truyền, tải lại, không được restore tiếp.

Xác nhận phiên bản PostgreSQL tại chỗ khớp với trung tâm:

```powershell
docker run --rm postgres:18-alpine psql "postgresql://postgres:MẬT_KHẨU@host.docker.internal:5432/postgres" -tAc "SHOW server_version"
```

> **Địa chỉ database dùng ở tòa án — chọn đúng một trong hai:**
> - PostgreSQL cài trực tiếp trên Windows → `PGHOST=host.docker.internal`
> - PostgreSQL cũng chạy trong Docker → `PGHOST=<tên container>` và thêm `--network <tên network>` vào **mọi** lệnh `docker run` bên dưới
>
> Toàn bộ ví dụ trong Phần E dùng trường hợp thứ nhất.

### E4. Tạo user và database rồi nạp dữ liệu

Tạo role ứng dụng và database trống thuộc sở hữu của role đó:

```powershell
docker run --rm -e PGHOST=host.docker.internal -e PGUSER=postgres -e PGPASSWORD=MẬT_KHẨU_POSTGRES postgres:18-alpine psql -d postgres -c "CREATE ROLE dn_city LOGIN PASSWORD 'MẬT_KHẨU_ỨNG_DỤNG'" -c "CREATE DATABASE dongnai_city OWNER dn_city"
```

Nạp dữ liệu, **kết nối bằng chính user `dn_city`**:

```powershell
docker run --rm -e PGHOST=host.docker.internal -e PGUSER=dn_city -e PGPASSWORD=MẬT_KHẨU_ỨNG_DỤNG -v C:\mono-cm\handover:/in postgres:18-alpine pg_restore -d dongnai_city --no-owner --no-privileges -j 4 /in/dongnai_city-bangiao.dump
```

> Đây là chỗ dễ sai nhất của cả quy trình. `--no-owner` khiến mọi bảng thuộc về **user đang chạy lệnh restore**. Restore bằng `postgres` cho tiện thì ứng dụng sẽ báo `permission denied for table ...` ngay khi khởi động, và lỗi này chỉ lộ ra lúc mở phần mềm chứ không lộ lúc restore.

Cập nhật thống kê:

```powershell
docker run --rm -e PGHOST=host.docker.internal -e PGUSER=dn_city -e PGPASSWORD=MẬT_KHẨU_ỨNG_DỤNG postgres:18-alpine psql -d dongnai_city -c "ANALYZE"
```

### E5. Kiểm chứng tại chỗ

Đếm số bản ghi mọi bảng và đối chiếu với con số trung tâm đã gửi kèm:

```powershell
docker run --rm -e PGHOST=host.docker.internal -e PGUSER=dn_city -e PGPASSWORD=MẬT_KHẨU_ỨNG_DỤNG postgres:18-alpine psql -d dongnai_city -Atc "SELECT table_name || '=' || (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name), false, true, '')))[1]::text FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name"
```

Phải đủ 15 bảng và số liệu khớp tuyệt đối. Sau đó trỏ ứng dụng vào database mới, đăng nhập và mở thử: danh sách hồ sơ, chi tiết một hồ sơ có tài liệu con, một phiếu mượn, sơ đồ kho.

Cuối cùng, xoá gói bàn giao khỏi máy — nó chứa toàn bộ dữ liệu ở dạng file rời:

```powershell
Remove-Item C:\mono-cm\handover\* -Force
```

### E6. Bật backup định kỳ tại tòa án

**Đây là bước quan trọng nhất của cả tài liệu.** Từ thời điểm này, máy chủ tòa án giữ bản dữ liệu duy nhất.

**Bước 1 — Chép script backup vào máy**

Copy [`scripts/pg-backup.sh`](../scripts/pg-backup.sh) vào `C:\mono-cm\scripts\`. Script chạy trong container Linux nên **bắt buộc phải có ký tự xuống dòng kiểu LF**. Mở bằng Notepad rồi lưu lại sẽ làm hỏng file. Sau khi chép xong, chạy lệnh này để chắc chắn:

```powershell
docker run --rm -v C:\mono-cm\scripts:/scripts alpine sh -c "sed -i 's/\r$//' /scripts/pg-backup.sh && head -1 /scripts/pg-backup.sh"
```

**Bước 2 — Tạo file cấu hình** `C:\mono-cm\.env.backup`

```
PGHOST=host.docker.internal
PGPORT=5432
PGUSER=dn_city
PGPASSWORD=MẬT_KHẨU_ỨNG_DỤNG
BACKUP_DATABASES=dongnai_city
BACKUP_KEEP_DAYS=30
```

Ở tòa án chỉ có một database nên dùng thẳng user ứng dụng, không cần tạo user backup riêng. Đặt `BACKUP_KEEP_DAYS` cao hơn trung tâm — máy tại chỗ thường còn nhiều dung lượng, và phát hiện sai sót ở đây thường chậm hơn.

Chuột phải file → Properties → Security, gỡ quyền đọc của `Users`, chỉ để `Administrators` và `SYSTEM`. File này chứa mật khẩu database.

**Bước 3 — Chạy thử**

```powershell
docker run --rm --env-file C:\mono-cm\.env.backup -v C:\mono-cm\backups:/backups -v C:\mono-cm\scripts:/scripts:ro postgres:18-alpine /scripts/pg-backup.sh
```

Phải thấy dòng `[OK]` kèm dung lượng, và file `.dump` xuất hiện trong `C:\mono-cm\backups\`.

**Bước 4 — Đặt lịch chạy hằng ngày**

```powershell
schtasks /Create /TN "mono-cm backup" /SC DAILY /ST 02:00 /RU SYSTEM /RL HIGHEST /TR "docker run --rm --env-file C:\mono-cm\.env.backup -v C:\mono-cm\backups:/backups -v C:\mono-cm\scripts:/scripts:ro postgres:18-alpine /scripts/pg-backup.sh"
```

Sau đó mở **Task Scheduler** → tìm task vừa tạo → Properties → tab **Settings** → tích **"Run task as soon as possible after a scheduled start is missed"**. Không có tuỳ chọn này thì hôm nào máy tắt lúc 02:00 là mất luôn bản backup ngày đó, và không ai biết.

Chạy thử task ngay để xác nhận nó hoạt động dưới quyền SYSTEM:

```powershell
schtasks /Run /TN "mono-cm backup"
```

**Bước 5 — Đưa bản backup ra khỏi máy chủ**

Bản dump nằm cùng ổ đĩa với database thì ổ hỏng là mất cả hai. Chọn một cách theo điều kiện của đơn vị, xếp theo mức độ ưu tiên:

1. **Thư mục mạng của đơn vị** (NAS, file server) — tốt nhất vì tự động. Thêm dòng copy vào cuối task, hoặc tạo task thứ hai lúc 02:30:
   ```powershell
   schtasks /Create /TN "mono-cm backup copy" /SC DAILY /ST 02:30 /RU SYSTEM /RL HIGHEST /TR "robocopy C:\mono-cm\backups \\NAS\backup\mono-cm /XO /R:2 /W:10"
   ```
2. **Hai ổ cứng ngoài luân phiên** — cán bộ chép thủ công mỗi tuần, mang một ổ cất ở phòng khác. Đơn giản nhưng phụ thuộc con người, phải ghi vào lịch công tác.
3. **Đồng bộ về trung tâm** — chỉ làm khi đã có văn bản đồng ý của đơn vị về việc đưa dữ liệu hồ sơ ra khỏi tòa án, và phải mã hoá như [E1](#e1-đóng-gói-ở-trung-tâm).

**Bước 6 — Bàn giao cho đơn vị**

Hướng dẫn cán bộ phụ trách CNTT của tòa án ba việc, viết ra giấy để lại:

- Mỗi tuần mở `C:\mono-cm\backups\` xem có file mới của ngày hôm trước không. Không có file mới nghĩa là backup đã hỏng, phải báo ngay.
- Không xoá thư mục `C:\mono-cm\backups\`.
- Khi cần khôi phục, gọi team kỹ thuật, **không tự thao tác**.

### E7. Khôi phục tại tòa án khi có sự cố

Dùng bản dump mới nhất trong `C:\mono-cm\backups\`, làm theo [Phần C2](#c2-restore-đè-lên-database-đang-chạy-khẩn-cấp) nhưng thay lệnh Linux bằng dạng PowerShell như ở [E4](#e4-tạo-user-và-database-rồi-nạp-dữ-liệu). Thứ tự bắt buộc:

1. Dừng ứng dụng
2. **Dump hiện trạng trước** — kể cả khi dữ liệu đang hỏng, đó là bằng chứng để điều tra
3. `dropdb --force` rồi `createdb -O dn_city`
4. `pg_restore` bằng user `dn_city`
5. `ANALYZE`
6. Bật ứng dụng, kiểm chứng theo [E5](#e5-kiểm-chứng-tại-chỗ)

Dữ liệu nhập kể từ lần backup gần nhất **sẽ mất**. Nói rõ điều này với đơn vị trước khi thao tác, để họ chuẩn bị nhập bù từ sổ giấy.

---

## Phần F — Database đặt trên Neon

Neon là PostgreSQL dạng serverless. Backup vẫn dùng `pg_dump` như mọi nơi khác, nhưng có bốn điểm riêng dễ làm hỏng bản dump nếu không biết trước.

### F1. Lấy đúng chuỗi kết nối — không dùng endpoint pooler

Neon cấp hai chuỗi kết nối cho cùng một database:

```
postgresql://user:pass@ep-abc-123-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require   ← KHÔNG dùng
postgresql://user:pass@ep-abc-123.us-east-2.aws.neon.tech/neondb?sslmode=require          ← dùng cái này
```

Khác nhau đúng chữ `-pooler` trong tên host. Chuỗi có `-pooler` đi qua PgBouncer ở chế độ transaction, trong khi `pg_dump` cần giữ một transaction xuyên suốt để lấy ảnh chụp nhất quán. Dump qua pooler hoặc là lỗi giữa chừng, hoặc tệ hơn: chạy xong nhưng dữ liệu không nhất quán giữa các bảng.

Trong bảng điều khiển Neon, bỏ tick **"Pooled connection"** để lấy chuỗi trực tiếp.

> Script kiểm chứng ở [F3](#f3-kiểm-chứng-bản-backup-có-restore-được-không) tự phát hiện và tự bỏ `-pooler`, có in thông báo. Nhưng khi tự gõ lệnh thì phải tự để ý.

### F2. Backup định kỳ từ Neon

Script [`scripts/pg-backup.sh`](../scripts/pg-backup.sh) dùng được nguyên xi, chỉ cần tách chuỗi kết nối Neon ra thành các biến trong `.env.backup`:

```bash
PGHOST=ep-abc-123.us-east-2.aws.neon.tech
PGPORT=5432
PGUSER=neondb_owner
PGPASSWORD=MẬT_KHẨU_NEON
PGSSLMODE=require
BACKUP_DATABASES=neondb
BACKUP_KEEP_DAYS=30
```

`PGSSLMODE=require` là bắt buộc — Neon từ chối mọi kết nối không mã hoá.

Backup một lần cho nhanh:

```bash
docker run --rm -e U="postgresql://user:pass@ep-abc-123.us-east-2.aws.neon.tech/neondb?sslmode=require" -v "$PWD:/w" postgres:18-alpine sh -c 'pg_dump -d "$U" -Fc --no-owner --no-privileges -f /w/neon-$(date -u +%Y%m%dT%H%M%SZ).dump'
```

> Dòng `[CẢNH BÁO] Không dump được globals (roles)` khi chạy script trên Neon là **bình thường**. Neon không cho tài khoản thường đọc danh sách role toàn server. Bản dump database vẫn hợp lệ.

### F3. Kiểm chứng bản backup có restore được không

Script [`scripts/pg-verify-restore.sh`](../scripts/pg-verify-restore.sh) làm trọn vòng: dump từ nguồn → dựng một PostgreSQL tạm trong Docker → restore vào đó → đếm và so từng bảng → dọn dẹp. **Không ghi gì vào database nguồn**, chỉ đọc.

```bash
SOURCE_URL="postgresql://user:pass@ep-abc-123.us-east-2.aws.neon.tech/neondb?sslmode=require" ./scripts/pg-verify-restore.sh
```

Kết quả khi đạt:

```
=== [1/6] Đọc thông tin database nguồn ===
Phiên bản nguồn : 17.2 (major 17)
Bộ công cụ dùng : postgres:18-alpine
...
┌────────────────────────────────────────────────┐
│  ĐẠT — bản backup restore được, dữ liệu khớp   │
└────────────────────────────────────────────────┘
  Số bảng   : 16
  Số bản ghi: 12480
  File dump : ./backup-verify/source.dump
```

Script tự chọn phiên bản bộ công cụ theo đúng phiên bản của Neon, nên không phải đoán tag image. Khi không đạt, nó in `diff` từng bảng để thấy ngay bảng nào lệch.

Có thể chạy với bất kỳ database nào, không riêng Neon:

```bash
SOURCE_URL="postgresql://dn_city:MẬT_KHẨU@160.30.160.49:5432/dongnai_city" ./scripts/pg-verify-restore.sh
```

Muốn giữ lại PostgreSQL tạm để tự vào xem dữ liệu:

```bash
KEEP_TARGET=1 SOURCE_URL="..." ./scripts/pg-verify-restore.sh
```

Nhớ `docker rm -f` container đó sau khi xem xong.

### F4. Những điểm khác của Neon so với PostgreSQL tự host

**Compute ngủ đông.** Neon tự tắt compute sau một thời gian không có kết nối. Lệnh dump đầu tiên có thể chờ vài giây để máy chủ tỉnh dậy — đó không phải lỗi. Nhưng nếu đặt lịch backup, hãy tính thêm khoảng chờ này vào timeout.

**Branch không phải backup.** Neon cho tạo branch tức thời và khôi phục về một thời điểm trong quá khứ. Rất tiện để lùi lại sau khi lỡ tay, và nên dùng. Nhưng branch nằm cùng tài khoản, cùng nhà cung cấp với bản gốc: mất quyền truy cập tài khoản, hoặc Neon gặp sự cố, hoặc hết hạn thanh toán là mất cả branch lẫn database. **Vẫn phải có bản `pg_dump` nằm ngoài Neon.**

**Không có quyền superuser.** Vì vậy `pg_dumpall --globals-only` không chạy được, và một vài đối tượng cấp hệ thống không nằm trong dump. Với schema của dự án này thì không ảnh hưởng — không có extension, view, trigger hay sequence nào ngoài các bảng do Prisma quản lý.

**Giới hạn dung lượng và băng thông.** Dump toàn bộ database mỗi ngày sẽ tính vào lượng dữ liệu truyền đi của gói dịch vụ. Với dữ liệu cỡ vài chục nghìn bản ghi thì không đáng kể, nhưng nên kiểm tra hoá đơn sau tháng đầu.

---

## Phụ lục A — Sự cố thường gặp

| Thông báo lỗi | Nguyên nhân | Cách xử lý |
|---|---|---|
| `server version mismatch` / `unsupported version` | `pg_dump` cũ hơn server | Dùng image có tag major ≥ server (mục A1) |
| `role "dn_city" does not exist` khi restore | Dump có thông tin owner | Thêm `--no-owner --no-privileges` vào **cả** lệnh dump và restore |
| `database "dongnai_city" is being accessed by other users` | App còn giữ kết nối | `docker stop dongnai_server` trước, hoặc dùng `dropdb --force` |
| `permission denied for table ...` khi dump | User backup thiếu quyền | Chạy lại `GRANT pg_read_all_data` trên **đúng** database đó (mục A2) |
| `pg_restore: error: could not execute query ... already exists` | Restore vào database không rỗng | Dùng database trống (C1) hoặc `dropdb`+`createdb` (C2) |
| File `.dump` dung lượng 0 hoặc rất nhỏ | Dump lỗi giữa chừng | Script đã chặn bằng bước `.tmp` + `pg_restore --list`; kiểm tra `/var/log/pg-backup.log` |
| Ứng dụng chậm bất thường sau restore | Chưa cập nhật thống kê | Chạy `ANALYZE` |
| `permission denied for table ...` khi **mở ứng dụng** sau restore | Restore bằng `postgres` thay vì user ứng dụng | Làm lại: `dropdb` → `createdb -O dn_city` → `pg_restore` bằng `dn_city` (mục E4) |
| `/scripts/pg-backup.sh: not found` dù file có thật (Windows) | File lưu kiểu xuống dòng CRLF | Chạy lệnh `sed -i 's/\r$//'` ở [E6 bước 1](#e6-bật-backup-định-kỳ-tại-tòa-án) |
| `could not translate host name "host.docker.internal"` | PostgreSQL chạy trong Docker chứ không phải trên máy Windows | Đổi `PGHOST` thành tên container và thêm `--network <network>` |
| `connection refused` tới `host.docker.internal:5432` | PostgreSQL chỉ lắng nghe `localhost` | Sửa `listen_addresses = '*'` trong `postgresql.conf`, thêm dòng cho dải IP Docker vào `pg_hba.conf`, restart PostgreSQL |
| `docker: invalid mount config ... path is not shared` | Docker Desktop chưa được chia sẻ ổ C | Settings → Resources → File Sharing → thêm `C:\mono-cm` |
| Task Scheduler báo `0x1` nhưng chạy tay thì được | Task chạy bằng SYSTEM, chưa thấy Docker | Kiểm tra Docker Desktop đặt chế độ khởi động cùng Windows; hoặc đổi `/RU` sang tài khoản có quyền dùng Docker |
| Hash SHA256 không khớp sau khi tải | File hỏng trên đường truyền | Tải lại. **Tuyệt đối không restore** file sai hash |
| Dump từ Neon lỗi giữa chừng, hoặc chạy xong nhưng dữ liệu lệch | Dùng nhầm endpoint pooler | Bỏ `-pooler` khỏi tên host ([F1](#f1-lấy-đúng-chuỗi-kết-nối--không-dùng-endpoint-pooler)) |
| `no pg_hba.conf entry ... no encryption` khi kết nối Neon | Thiếu SSL | Thêm `?sslmode=require` vào URL hoặc `PGSSLMODE=require` vào env |
| Neon báo `Không dump được globals (roles)` | Neon không cho tài khoản thường đọc role toàn server | Bình thường, bỏ qua — bản dump database vẫn hợp lệ |

---

## Phụ lục B — Về nút "Sao lưu"/"Khôi phục" trong giao diện admin

Giao diện admin hiện có chức năng sao lưu/khôi phục riêng, hoạt động theo cơ chế khác hẳn: nó đọc dữ liệu qua Prisma rồi xuất ra file JSON nén gzip (`server/lib/services/database-backup.ts`, `database-restore.ts`).

**Chức năng này chỉ nên dùng để xuất/chuyển giao dữ liệu, không dùng làm phương án phục hồi chính.** Lý do, đã kiểm chứng trên code hiện tại:

1. **Không chứa schema.** File JSON chỉ có dữ liệu hàng. Database đích bắt buộc phải được migrate sẵn về **đúng** phiên bản schema lúc backup; lệch một cột là restore hỏng toàn bộ.
2. **Không có snapshot nhất quán.** 15 lệnh đọc chạy tuần tự, không nằm trong một transaction. Nếu có người nhập liệu trong lúc sao lưu, file kết quả có thể chứa bản ghi con trỏ tới bản ghi cha không tồn tại → khi khôi phục sẽ lỗi khoá ngoại và file trở nên vô dụng.
3. **Cột JSON bị biến dạng.** Giá trị `NULL` của các cột JSON (`File.details`, `AuditLog.detail`, `BorrowSlipEvent.details`) sau khi khôi phục trở thành JSON `'null'` thay vì `NULL` thật.
4. **Không đối chiếu sau khi khôi phục.** API trả về "thành công" kể cả khi một số bảng bị bỏ qua.
5. **Giới hạn kỹ thuật.** Transaction đặt timeout cứng 30 giây; bản Vercel còn bị chặn thêm bởi giới hạn 60 giây và ~4.5MB mỗi request.

Khi cần dùng (ví dụ bàn giao dữ liệu cho đơn vị khác), bắt buộc:

- Chạy vào giờ không có người dùng thao tác.
- Đảm bảo database đích đã `prisma migrate deploy` về đúng phiên bản schema tương ứng.
- Sau khi khôi phục, chạy đối chiếu số bản ghi ở [mục D1](#d1-so-số-bản-ghi-giữa-hai-database).

Bản dump `pg_dump` ở tài liệu này là phương án chính. Nút trên giao diện là phương án phụ.

---

## Phụ lục C — Hướng nâng cấp

Quy trình trên cho **RPO 24 giờ**: sự cố lúc 20:00 sẽ mất dữ liệu nhập từ 02:00 sáng hôm đó. Với máy chủ tòa án, đó là một ngày làm việc phải nhập bù từ sổ giấy. Nếu đơn vị yêu cầu chặt hơn:

- **Rẻ nhất, không đổi hạ tầng:** tăng tần suất lên 2–4 lần/ngày. Thêm task lúc 12:00 và 17:00 là đưa RPO về khoảng nửa buổi làm việc.
- **RPO vài phút** — bật WAL archiving và dùng `pgBackRest` hoặc `wal-g`, cho phép khôi phục về đúng một thời điểm bất kỳ (PITR). Đáng làm ở tòa án có lượng nhập liệu lớn.
- **RTO gần bằng 0** — dựng streaming replica ở máy thứ hai. Lưu ý: replica **không** thay thế được backup (lệnh `DELETE` nhầm sẽ được nhân bản sang replica ngay lập tức).

---

## Phụ lục D — Đối chiếu lệnh giữa các môi trường

Phần E viết cho Windows + Docker Desktop. Nếu một tòa án dùng môi trường khác, phần **logic không đổi**, chỉ đổi cách gọi lệnh:

| Việc | Windows + Docker (Phần E) | Linux + Docker (Phần A–D) | PostgreSQL cài trực tiếp |
|---|---|---|---|
| Địa chỉ DB | `PGHOST=host.docker.internal` | `PGHOST=<IP>` hoặc tên container | `PGHOST=localhost` |
| Gắn thư mục | `-v C:\mono-cm\backups:/backups` | `-v /opt/mono-cm/backups:/backups` | không cần |
| Gọi công cụ | `docker run ... postgres:18-alpine pg_restore` | như cột trái | `pg_restore` trực tiếp |
| Truyền mật khẩu | `-e PGPASSWORD=...` | `--env-file` | biến môi trường hoặc `~/.pgpass` |
| Đặt lịch | Task Scheduler (`schtasks`) | `crontab -e` | `crontab -e` hoặc systemd timer |
| Kiểm tra hash | `Get-FileHash -Algorithm SHA256` | `sha256sum` | `sha256sum` |
| Chép ra ngoài | `robocopy` | `rclone copy` | `rclone copy` / `rsync` |

Với PostgreSQL cài trực tiếp, bỏ toàn bộ phần `docker run ... postgres:18-alpine` và giữ nguyên phần lệnh phía sau. Ví dụ:

```bash
pg_restore -h localhost -U dn_city -d dongnai_city --no-owner --no-privileges -j 4 dongnai_city-bangiao.dump
```

Yêu cầu duy nhất giữ nguyên ở mọi môi trường: **phiên bản bộ công cụ `pg_dump`/`pg_restore` phải bằng hoặc mới hơn phiên bản server**, và **restore phải chạy bằng user ứng dụng**.

---



---

## Phần G — Migrate dữ liệu production về DB dev/test (local)

Dùng khi dev cần chạy thử với dữ liệu thật: debug bug khó tái hiện, kiểm tra performance, test migration schema trước khi deploy lên prod.

> **Quy tắc an toàn:**
> - Không bao giờ để `DATABASE_URL` trong `.env` trỏ về production khi đang dev.
> - Script `import-to-client.ts` **xóa sạch** DB đích trước khi nạp — đảm bảo DB đích là DB dev riêng.
> - Với dữ liệu nhạy cảm (tên bị cáo, bên tranh chấp…), cân nhắc ẩn danh hóa trước khi chia cho team.

### G1. Chuẩn bị

**Yêu cầu trên máy dev:**
- `bun` đã cài
- Đã clone repo và chạy `bun install`
- PostgreSQL local đang chạy (hoặc Docker)

**Tạo DB dev trống** (nếu chưa có):

```bash
# PostgreSQL local / Docker
createdb -U postgres dev_cm_local
# Hoặc qua Docker:
docker run --rm -e PGPASSWORD=postgres postgres:18-alpine \
  createdb -h host.docker.internal -U postgres dev_cm_local
```

**Đặt biến môi trường** — tạo file `.env.dev` (không commit):

```bash
# .env.dev — chỉ dùng trên máy local, không commit
SOURCE_DB_URL=postgresql://<user>:<pass>@<prod_host>:5432/<prod_db>
DEV_DB_URL=postgresql://postgres:postgres@localhost:5432/dev_cm_local
```

### G2. Bước 1 — Chạy migration schema trước

Schema phải khớp với code hiện tại **trước** khi nạp dữ liệu. Không làm bước này thì `import-to-client.ts` sẽ lỗi FK constraint hoặc thiếu cột.

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/dev_cm_local" \
  bunx prisma migrate deploy
```

Kết quả mong đợi: `All migrations have been successfully applied.`

> Nếu báo `Database schema is up to date!` — bình thường, tiếp tục.
> Nếu báo lỗi, dừng lại và fix migration trước khi tiếp.

### G3. Bước 2 — Export dữ liệu từ production

```bash
bun prisma/scripts/export-staging.ts \
  --url="postgresql://<user>:<pass>@<prod_host>:5432/<prod_db>"
```

Script tạo thư mục `./backups/<timestamp>/` với ~15 file JSON, theo thứ tự tier (đảm bảo FK không bị vi phạm khi import). Output mẫu:

```
Exporting to local: ./backups/2026-08-07T03-30-00/

--- Tier 0: No FK ---
  [ok] 00_users.json (12 records)
  [ok] 01_agency_history.json (3 records)
  ...
--- Tier 3: Depends on Tier 2 ---
  [ok] 04_borrow_slip_events.json (47 records)

Export done! Total: 1842 records
Backup saved to: ./backups/2026-08-07T03-30-00/
```

Ghi lại đường dẫn thư mục (dùng ở bước tiếp).

### G4. Bước 3 — Import vào DB dev

```bash
bun prisma/scripts/import-to-client.ts \
  --url="postgresql://postgres:postgres@localhost:5432/dev_cm_local" \
  --from="./backups/2026-08-07T03-30-00"
```

Script sẽ:
1. Xóa sạch dữ liệu cũ trong DB dev (theo thứ tự child → parent)
2. Nạp lại theo thứ tự tier (Tier 0 → Tier 3), giữ nguyên mọi FK

> ⚠️ `AuditLog` và `UserAccessLog` có thể có số lượng lớn. Nếu chỉ cần dữ liệu nghiệp vụ, có thể bỏ các file `02_audit_logs.json` / `02_user_access_logs.json` trước khi import — script sẽ tự bỏ qua file không có.

### G5. Bước 4 — Xác nhận kết quả

So sánh số bản ghi giữa prod và dev:

```bash
bun prisma/scripts/verify-migration.ts \
  --source="postgresql://<user>:<pass>@<prod_host>:5432/<prod_db>" \
  --dest="postgresql://postgres:postgres@localhost:5432/dev_cm_local"
```

Kết quả mong đợi:

```
So sánh hai DB:
  SOURCE (prod): postgresql://***@prod_host:5432/prod_db
  DEST   (dev) : postgresql://***@localhost:5432/dev_cm_local

Table              |   SOURCE |     DEST | OK?
-------------------+---------+---------+-----
User               |       12 |       12 |  ✓
AgencyHistory      |        3 |        3 |  ✓
...
TOTAL              |     1842 |     1842 |

┌────────────────────────────────────┐
│  ✅  ĐẠT — source và dest khớp nhau  │
└────────────────────────────────────┘
```

Nếu có bảng lệch, chạy lại bước G4 — thường do timeout hoặc constraint lỗi bị bỏ qua.

### G6. Cập nhật `.env` local

Sau khi verify đạt, trỏ `.env` local về DB dev:

```bash
# .env (local only — không commit)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/dev_cm_local
```

Kiểm tra app hoạt động:

```bash
bun run dev:server
```

### G7. Chạy lại bất cứ lúc nào — script đồng bộ tự động

Thay vì chạy 4 lệnh thủ công mỗi lần, dùng script `sync-prod-to-dev.ts` — **một lệnh duy nhất** làm đủ 5 bước:

```
Bước 1 → kiểm tra kết nối cả hai DB
Bước 2 → export dữ liệu từ SOURCE ra thư mục tạm
Bước 3 → prisma migrate deploy trên DEST (đồng bộ schema)
Bước 4 → xóa data cũ + import data mới vào DEST (giữ FK order)
Bước 5 → so sánh số bản ghi SOURCE vs DEST
```

Thư mục tạm được tự dọn sau khi chạy xong — không để lại rác.

**Thiết lập một lần:**

```bash
# 1. Copy template
cp .env.sync.example .env.sync

# 2. Điền URL thật vào .env.sync (file này đã được .gitignore)
#    SOURCE_DB_URL=postgresql://<user>:<pass>@<prod_host>:5432/<prod_db>
#    DEV_DB_URL=postgresql://postgres:postgres@localhost:5432/dev_cm_local

# 3. Tạo DB dev nếu chưa có
createdb -U postgres dev_cm_local
```

**Sau đó, mỗi khi cần data mới từ prod:**

```bash
bun run db:sync
```

Hoặc truyền URL thẳng không qua file:

```bash
bun run db:sync \
  --source="postgresql://<prod_url>" \
  --dest="postgresql://postgres:postgres@localhost:5432/dev_cm_local"
```

**Output mẫu khi thành công:**

```
╔══════════════════════════════════════════════════════╗
║       sync-prod-to-dev — đồng bộ data từ prod        ║
╚══════════════════════════════════════════════════════╝
  SOURCE: postgresql://***@prod_host:5432/prod_db
  DEST  : postgresql://***@localhost:5432/dev_cm_local

🔌  Bước 1/5 — Kiểm tra kết nối...
  ✓  SOURCE (prod): postgresql://***@prod_host:5432/prod_db
  ✓  DEST   (dev) : postgresql://***@localhost:5432/dev_cm_local

📤  Bước 2/5 — Export dữ liệu từ SOURCE...
  --- Tier 0 ---
  [ok] 00_users.json (12 records)
  ...
  Export xong: 1842 records

🔧  Bước 3/5 — Đồng bộ schema (prisma migrate deploy)...
  ✓  Schema up to date

📥  Bước 4/5 — Import vào DEST...
  ✓  Cleared
  ...
  ✓  Import xong

🔍  Bước 5/5 — Kiểm tra số bản ghi SOURCE vs DEST...
  ✓  User: 12
  ✓  File: 856
  ...

╔══════════════════════════════════════════════════════╗
║  ✅  ĐỒNG BỘ THÀNH CÔNG  (18.3s)                     ║
╚══════════════════════════════════════════════════════╝
```

**Các flag tùy chọn:**

| Flag | Tác dụng |
|------|----------|
| `--dry-run` | Chỉ test kết nối, không thay đổi data — dùng để kiểm tra URL trước |
| `--skip-verify` | Bỏ qua bước so sánh số bản ghi (nhanh hơn ~2s) |
| `--keep-backup` | Giữ lại thư mục tạm `.sync-tmp/<timestamp>/` để kiểm tra thủ công |

Ví dụ:

```bash
# Kiểm tra URL có đúng không, không đụng data
bun run db:sync --dry-run

# Sync nhanh, bỏ verify
bun run db:sync --skip-verify

# Sync + giữ lại file JSON để debug
bun run db:sync --keep-backup
```

### G8. Scripts và npm scripts

| Script | Mô tả |
|--------|-------|
| `bun run db:sync` | **Sync một lệnh** — prod → dev (khuyến nghị dùng hàng ngày) |
| `bun run db:export` | Chỉ export từ prod ra file JSON |
| `bun run db:import` | Chỉ import từ file JSON vào DB đích |
| `bun run db:verify` | Kiểm tra / so sánh số bản ghi |
| `bun run db:migrate` | Chạy prisma migrate deploy |

### G9. Kết nối Backend Local vào Database Remote qua SSH Tunnel

Dùng khi muốn chạy Backend dưới máy local (`bun run dev:server`), nhưng đọc/ghi trực tiếp từ Database Remote trên server thông qua SSH Tunnel (khi DB không mở IP public).

> **Quy tắc về `.env`:**
> - **Server Production (VPS):** `DATABASE_URL` giữ nguyên (kết nối trực tiếp vì IP server đã được whitelist).
> - **Máy Local (Dev):** Cập nhật `DATABASE_URL` trong file `.env` local trỏ về `127.0.0.1:<PORT_TUNNEL>`.

**Các bước thực hiện:**

1. **Mở SSH Tunnel ở Terminal máy local (chạy ngầm với `-f`):**
   ```bash
   ssh -f -N -L 15432:127.0.0.1:5432 -p 8686 root@160.30.160.49
   ```
   *(Cờ `-f` giúp SSH chạy ngầm không chiếm màn hình Terminal. Cổng `15432` trên máy local sẽ map trực tiếp tới cổng `5432` của DB server trên remote)*

2. **Cập nhật file `.env` ở máy local:**
   ```env
   # .env (local only)
   DATABASE_URL="postgresql://<db_user>:<db_pass>@127.0.0.1:15432/<db_name>"
   ```

3. **Khởi động Backend local:**
   ```bash
   bun run dev:server
   ```

> **Mẹo — Nếu bị lỗi `Address already in use` (cổng 15432 đang bị chiếm):**
>
> 1. Xem tiến trình nào đang chiếm port 15432:
>    ```bash
>    lsof -i :15432
>    ```
> 2. Giải phóng / tắt tiến trình đang chiếm port 15432:
>    ```bash
>    # macOS / Linux (tắt 1 dòng)
>    kill -9 $(lsof -t -i:15432)
>    ```





---

**Tài liệu liên quan:** [scripts/pg-backup.sh](../scripts/pg-backup.sh) · [scripts/pg-verify-restore.sh](../scripts/pg-verify-restore.sh) · [DEPLOY.md](../.gemini/DEPLOY.md) · [docker-compose.server.yml](../docker-compose.server.yml) · [prisma/schema.prisma](../prisma/schema.prisma)
