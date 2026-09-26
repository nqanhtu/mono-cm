# Mono-CM — Quản lý hồ sơ tòa án

Hệ thống quản lý hồ sơ lưu trữ của tòa án: theo dõi hồ sơ vụ án, vị trí lưu trữ vật lý, mượn/trả hồ sơ, và xuất mục lục/báo cáo để đối chiếu.

## Language

**Hồ sơ**:
Một vụ án hoặc văn bản được lưu trữ, có Mã hồ sơ duy nhất, vị trí lưu trữ (Hộp), ngày tháng, số tờ, và các bên liên quan. Trong code là model `File`.
_Avoid_: File (khi nói tiếng Việt), Case, Document (`Document` trong code là tài liệu con bên trong một Hồ sơ, không phải Hồ sơ)

**Mục lục hồ sơ**:
Bảng liệt kê tuần tự các Hồ sơ (STT, Hộp số, Mã hồ sơ, các bên liên quan, tiêu đề, loại án, năm, số tờ) dùng để đối chiếu với hồ sơ giấy vật lý trong kho. Luôn sắp xếp cố định theo Hộp số → Mã hồ sơ, không theo thứ tự hiển thị trên màn hình.
_Avoid_: Danh sách hồ sơ (màn hình xem/lọc trên UI, không nhằm mục đích đối chiếu kho), Báo cáo (trang Reports phục vụ thống kê, khác mục đích)

**Mã hồ sơ**:
Định danh duy nhất của một Hồ sơ, theo quy ước `Loại - Năm - Số thứ tự`. Trong code là `File.code`.
_Avoid_: Mã VB, File code

**Hộp**:
Đơn vị lưu trữ vật lý chứa nhiều Hồ sơ, có vị trí (Kho → Dãy → Kệ → Ô) và Hộp số. Trong code là model `StorageBox`.
_Avoid_: Box, Thùng

**Loại án**:
Phân loại của một vụ án, hiện ghi gộp cả loại án lẫn cấp xét xử trong một chuỗi (vd. "Hình sự sơ thẩm", "Hôn nhân sơ thẩm"). Được gán độc lập trên cả Hồ sơ và Hộp: loại án của một Hộp không quyết định loại án của các Hồ sơ nằm trong nó, và hai giá trị này có thể lệch nhau.
_Avoid_: Case type, Loại vụ việc

**Hồ sơ lệch loại**:
Hồ sơ có Loại án khác nhãn Loại án của Hộp chứa nó (so sánh chính xác, không bỏ qua khác biệt cách viết). Một Hộp có Hồ sơ lệch loại có thể là **Hộp lẫn loại án** (Hồ sơ thuộc từ 2 Loại án trở lên) hoặc **Hộp sai nhãn** (Hồ sơ chỉ một Loại án nhưng khác nhãn Hộp). Hệ thống chỉ phát hiện, chưa quy định Hồ sơ lệch loại là lỗi hay xếp gửi hợp lệ.
_Avoid_: Hồ sơ sai hộp, Hộp lỗi

**Nguyên đơn/Bị hại**:
Các bên khởi kiện hoặc bị hại trong một Hồ sơ. Lưu chung trong một trường duy nhất (`File.plaintiffs`) — hệ thống hiện không phân biệt Nguyên đơn dân sự và Bị hại hình sự trong dữ liệu dù là hai vai trò pháp lý khác nhau.
_Avoid_: Plaintiffs (khi nói tiếng Việt), Người khởi kiện

**Bị cáo/Bị đơn**:
Các bên bị buộc tội (hình sự) hoặc bị kiện (dân sự) trong một Hồ sơ. Bị cáo hình sự lưu ở `File.defendants`, Bị đơn dân sự lưu riêng ở `File.civilDefendants`; hai trường này hiển thị gộp chung trên UI và trong Mục lục hồ sơ.
_Avoid_: Defendants (khi nói tiếng Việt), Người bị kiện
