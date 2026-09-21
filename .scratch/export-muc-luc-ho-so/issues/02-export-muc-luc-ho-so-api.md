# 02: API xuất Excel toàn bộ Mục lục hồ sơ

**What to build:** Một endpoint API mới, được bảo vệ bởi permission mới `exportFiles` (chỉ `SUPER_ADMIN`/`ADMIN`), nhận cùng bộ tham số lọc như `GET /api/files` (dùng lại hàm lọc dùng chung từ ticket 01) và trả về một file `.xlsx` chứa toàn bộ Hồ sơ khớp bộ lọc đó — không giới hạn số dòng. Dữ liệu luôn sắp xếp cố định theo Hộp số rồi đến Mã hồ sơ (bất kể tham số sort trên query), gồm đúng 9 cột: STT, Hộp số, Mã hồ sơ, Nguyên đơn/Bị hại, Bị cáo/Bị đơn, Tiêu đề, Loại án, Năm, Số tờ. Endpoint này demo được ngay bằng cách gọi trực tiếp (chưa cần UI).

**Blocked by:** 01 (Prefactor: tách hàm dựng điều kiện lọc Hồ sơ dùng chung)

**Status:** ready-for-agent

- [ ] Permission mới `exportFiles = [SUPER_ADMIN, ADMIN]` được thêm vào cả bảng phân quyền phía client và phía server, độc lập với `manageFiles` (theo ADR-0001)
- [ ] Endpoint trả 403 cho `VIEWER`/`COORDINATOR`, 200 cho `SUPER_ADMIN`/`ADMIN`
- [ ] Endpoint nhận cùng bộ tham số lọc như `GET /api/files` và trả về toàn bộ Hồ sơ khớp bộ lọc, không áp dụng giới hạn số dòng
- [ ] Kết quả luôn sắp xếp cố định theo Hộp số rồi đến Mã hồ sơ, bất kể tham số sort trong query
- [ ] File `.xlsx` trả về có đúng 9 cột theo đúng thứ tự: STT, Hộp số, Mã hồ sơ, Nguyên đơn/Bị hại, Bị cáo/Bị đơn, Tiêu đề, Loại án, Năm, Số tờ
- [ ] STT đánh số 1..N liên tục theo đúng thứ tự đã sắp xếp
- [ ] Cột Nguyên đơn/Bị hại và cột Bị cáo/Bị đơn nối các giá trị nhiều-người bằng dấu phẩy trong một ô
- [ ] Hồ sơ chưa gán Hộp hiển thị ô Hộp số trống trong file xuất
- [ ] Không có Hồ sơ nào khớp bộ lọc: trả về file `.xlsx` hợp lệ chỉ có dòng tiêu đề (0 dòng dữ liệu)
- [ ] Header `Content-Disposition` đặt tên file theo mẫu `muc-luc-ho-so_YYYYMMDD_HHmm.xlsx`
- [ ] Có contract test HTTP cho tất cả các trường hợp trên, theo pattern đã có trong `files.contract.test.ts`/`cases-reports.contract.test.ts`
