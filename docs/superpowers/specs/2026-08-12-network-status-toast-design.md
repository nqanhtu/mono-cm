# Thiết kế Cấu trúc & Giao diện Network Status Banner (Thông báo Mất kết nối mạng)

**Ngày khởi tạo**: 2026-08-12  
**Dự án**: `mono-cm` (React / Vite / TailwindCSS)  

---

## 1. Tổng quan & Mục tiêu
Tính năng hiển thị thanh cảnh báo trạng thái mạng cố định ở mép trên màn hình (Sticky Top Network Status Banner) nhằm thông báo cho người dùng khi thiết bị bị rớt mạng hoặc khôi phục lại kết nối internet.

### Yêu cầu chính:
- **Giao diện**: Thanh cố định mép trên (Top Sticky Banner), trượt hiển thị/ẩn mượt mà.
- **Cơ chế phát hiện mạng (Hybrid)**: 
  - Lắng nghe sự kiện `online` / `offline` từ browser API.
  - Xác minh bằng cách gửi request ping thực tế (timeout 3s) đến tệp tĩnh/API server kèm header `cache: 'no-store'`.
  - Định kỳ 10 giây heartbeat ping tự động khi đang offline.
- **Trạng thái & Màu sắc**:
  - **Mất mạng (`offline`)**: Nền cam hổ phách (`bg-amber-600`), icon `WifiOff`, thông báo ngoại tuyến, kèm nút **"Thử lại"** (có hiệu ứng xoay spinner khi đang ping).
  - **Đã kết nối lại (`reconnected`)**: Nền xanh lá cây (`bg-emerald-600`), icon `Wifi`, hiển thị 2.5 giây rồi tự thu hồi trượt ẩn đi.
  - **Bình thường (`online`)**: Trượt ẩn hoàn toàn (`-translate-y-full opacity-0 pointer-events-none`).

---

## 2. Thiết kế Kiến trúc & Component

### 2.1 Custom Hook: `src/hooks/use-network-status.ts`
Quản lý toàn bộ logic kiểm tra và trạng thái mạng:

- **State**:
  - `status`: `'online'` | `'offline'` | `'reconnected'`
  - `isChecking`: `boolean` (đang ping kiểm tra)
- **Functions**:
  - `checkPing()`: Khởi tạo request `fetch('/favicon.ico', { cache: 'no-store' })` sử dụng `AbortController` (timeout 3000ms).
    - Nếu phản hồi thành công (200 OK): chuyển trạng thái từ `offline` -> `reconnected`, hẹn giờ 2500ms chuyển về `online`.
    - Nếu thất bại/timeout: duy trì trạng thái `offline`.
- **Event Listeners & Heartbeat**:
  - Lắng nghe `window.ononline` và `window.onoffline`.
  - Khi offline, chạy `setInterval` 10000ms gọi `checkPing()`.
  - Lắng nghe `document.onvisibilitychange`: Tạm dừng interval khi tab ẩn (`document.hidden`) và ping ngay 1 lần khi người dùng quay lại tab (`visible`).

### 2.2 Component: `src/components/common/network-status-banner.tsx`
Component giao diện độc lập (self-contained UI):

- **Định vị & Styling (TailwindCSS)**:
  - `fixed top-0 left-0 right-0 w-full z-[9999] px-4 py-2 text-sm font-medium text-white shadow-md transition-all duration-300 ease-in-out flex items-center justify-between`
- **Class theo trạng thái**:
  - Hidden (`online`): `-translate-y-full opacity-0 pointer-events-none`
  - Visible (`offline`): `translate-y-0 opacity-100 bg-amber-600`
  - Visible (`reconnected`): `translate-y-0 opacity-100 bg-emerald-600`
- **Các thành phần giao diện**:
  - Left: Flex container chứa Icon (`WifiOff` hoặc `Wifi`) + Nhãn văn bản thông báo.
  - Right: Button **"Thử lại"** (Chỉ hiển thị khi `status === 'offline'`), chứa Icon `RefreshCw` (xoay `animate-spin` khi `isChecking === true`).

### 2.3 Tích hợp tại Root Layout (`src/App.tsx`)
Chỉ cần chèn `<NetworkStatusBanner />` ở cấp cao nhất trong cây React DOM tại `App.tsx` (hoặc `RootLayout`), không làm thay đổi hay giật layout nội dung trang phía dưới.

---

## 3. Kế hoạch Kiểm thử & Kiểm tra

1. **Kiểm thử Giả lập Rớt Mạng**:
   - Tắt kết nối Wi-Fi/Ethernet hoặc bật chế độ Offline trong Chrome DevTools -> Banner màu cam xuất hiện trượt xuống.
2. **Kiểm thử Nút Thử Lại**:
   - Bấm "Thử lại" khi chưa có mạng -> Icon `RefreshCw` xoay, sau 3s giữ nguyên màu cam.
3. **Kiểm thử Khôi phục Mạng**:
   - Bật lại Wi-Fi -> Banner chuyển sang màu xanh lá (`reconnected`) trong 2.5s rồi trượt ẩn hẳn.
4. **Kiểm thử Tab Background**:
   - Chuyển sang tab khác khi offline, bật lại Wi-Fi rồi quay lại tab app -> Banner lập tức phát hiện và chuyển sang xanh lá.

---
