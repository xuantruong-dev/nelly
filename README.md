# Hoa Nelly – Website Thương Mại Điện Tử Hoa Bóng Bay Nghệ Thuật

Ứng dụng web full-stack (React + Vite + Express + SQLite + Sharp) cho thương hiệu **Hoa Nelly** – chuyên hoa bóng bay nghệ thuật, tạo hình nhân vật, phụ kiện sinh nhật, quà tặng và trang trí sự kiện.

## Yêu cầu hệ thống

- **Node.js `>= 22.6.0`** (chạy trực tiếp `node server.ts` cho môi trường production)
- `npm` hoặc `bun`

## Chạy thử ở máy cục bộ (Local Development)

```bash
npm install
cp .env.example .env
npm run dev
```

Mở trình duyệt tại `http://localhost:3000`.

## Build & Chạy Production

```bash
npm install
npm run build
NODE_ENV=production npm start
```

Kiểm tra tình trạng máy chủ: `GET /api/health`.

## Biến môi trường (`.env`)

Xem mẫu tại `.env.example`:

| Biến | Mô tả | Mặc định |
| --- | --- | --- |
| `APP_URL` | Tên miền chính thức của website (dùng cho `/sitemap.xml`) | `http://localhost:3000` |
| `PORT` | Cổng lắng nghe của Express server | `3000` |
| `ADMIN_PASSCODE` | Mật khẩu đăng nhập quản trị viên cấp chủ cửa hàng (khuyến nghị đặt trước khi public) | *(trống – bật thiết lập lần đầu tại `/quan-tri`)* |
| `ADMIN_EMAIL` | Email tài khoản chủ cửa hàng mặc định | `admin@hoanelly.vn` |
| `DB_PATH` | Đường dẫn tệp cơ sở dữ liệu SQLite | `./data/hoanelly.db` |
| `UPLOAD_DIR` | Thư mục lưu tệp ảnh/video tải lên | `./data/uploads` |
| `IMAGE_CACHE_DIR` | Thư mục đệm ảnh WebP đã tối ưu | `./data/image-cache` |

## Lưu ý khi triển khai (Deploy từ GitHub)

Vì website có backend Express, cơ sở dữ liệu SQLite (`better-sqlite3`) và tối ưu ảnh phía server (`sharp`), hãy triển khai lên nền tảng hỗ trợ **Node.js server** như **Render**, **Railway**, **Fly.io**, hoặc **VPS** *(không dùng GitHub Pages hoặc static-only host)*:

1. **Build Command**: `npm install && npm run build`
2. **Start Command**: `NODE_ENV=production npm start`
3. **Node Version**: chọn **Node 22** (đã khai báo trong `package.json` → `engines.node`)
4. **Ổ đĩa bền vững (Persistent Disk / Volume)**: Gắn volume vào thư mục `./data` (hoặc cấu hình `DB_PATH`, `UPLOAD_DIR`, `IMAGE_CACHE_DIR` trỏ vào đường dẫn volume) để dữ liệu đơn hàng, sản phẩm, đánh giá và ảnh tải lên không bị mất sau mỗi lần deploy lại.
5. **Bảo mật quản trị**: Đặt biến môi trường `ADMIN_PASSCODE` (tối thiểu 8 ký tự mạnh) hoặc truy cập `/quan-tri` ngay sau khi deploy để thiết lập mật khẩu chủ cửa hàng.
