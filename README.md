# Karl - Management Project

Karl là hệ thống quản lý đồ án/môn học cho môi trường đại học. Ứng dụng hỗ trợ quản lý kỳ đồ án, danh sách sinh viên, nhóm, đề tài, dự án, mốc nộp bài, file nộp, chấm điểm, phúc khảo, xin gia hạn, thông báo và chat realtime giữa sinh viên với giảng viên.

Dự án hiện dùng PostgreSQL và Prisma làm nguồn dữ liệu chính. MongoDB/Mongoose không còn là runtime target.

## Mục lục

- [Công nghệ sử dụng](#công-nghệ-sử-dụng)
- [Yêu cầu trước khi cài đặt](#yêu-cầu-trước-khi-cài-đặt)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Cài đặt nhanh](#cài-đặt-nhanh)
- [Cài đặt chi tiết](#cài-đặt-chi-tiết)
- [Tài khoản mẫu sau khi seed](#tài-khoản-mẫu-sau-khi-seed)
- [Các lệnh thường dùng](#các-lệnh-thường-dùng)
- [Kiểm thử](#kiểm-thử)
- [Xử lý lỗi thường gặp](#xử-lý-lỗi-thường-gặp)
- [Lưu ý bảo mật và dữ liệu](#lưu-ý-bảo-mật-và-dữ-liệu)

## Công nghệ sử dụng

### Backend

- Node.js, Express.js
- PostgreSQL, Prisma ORM
- JWT authentication, cookie `HttpOnly`
- bcryptjs để hash mật khẩu
- Socket.IO cho chat và thông báo realtime
- Multer cho upload file
- express-rate-limit cho giới hạn request đăng nhập/upload

### Frontend

- Next.js App Router
- React
- Zustand cho client state
- Socket.IO Client
- Phosphor Icons
- CSS Modules, Tailwind/PostCSS
- Playwright cho E2E test

## Yêu cầu trước khi cài đặt

Cài sẵn các công cụ sau:

| Công cụ | Phiên bản khuyến nghị | Ghi chú |
| --- | --- | --- |
| Node.js | 20 trở lên | Nên dùng bản LTS mới |
| npm | Đi kèm Node.js | Repo đang dùng `package-lock.json` |
| PostgreSQL | 14 trở lên | Có thể dùng local PostgreSQL, Neon, Supabase hoặc Railway |
| Git | Bất kỳ bản mới | Dùng để clone source |

Tuỳ chọn:

- Google OAuth credentials nếu muốn đăng nhập bằng Google.
- Cloudinary account nếu muốn dùng lưu trữ file/ảnh ngoài local. Code hiện tại có module cấu hình Cloudinary, nhưng upload vẫn có nhánh xử lý local/test.
- Playwright browsers nếu muốn chạy E2E test.

## Cấu trúc thư mục

```text
management_projectv2/
  backend/
    app.js                         # Express app, routes, middleware, Socket.IO
    config/                        # env, jwt, prisma, cloudinary, rate-limit
    middlewares/                   # auth middleware, RBAC, kiểm tra quyền truy cập
    domains/                       # module nghiệp vụ theo domain
    prisma/                        # schema, migrations, seed
    tests/                         # backend integration tests
    uploads/                       # file upload local/private, không commit

  frontend/
    src/app/                       # Next.js routes: auth, dashboard, verify
    src/components/                # layout/dashboard/ui components
    src/features/                  # feature-specific hooks/api
    src/services/                  # API client, auth service
    src/store/                     # Zustand stores
    public/images/                 # static images
    e2e/                           # Playwright E2E tests

  reports/                         # báo cáo local, không cần deploy
  README.md
```

## Cài đặt nhanh

Các lệnh dưới đây dành cho Windows PowerShell:

```powershell
git clone <repository-url>
cd management_projectv2

cd backend
npm.cmd install
# Tạo backend/.env theo mẫu ở phần "Cài đặt chi tiết" trước khi chạy các lệnh dưới đây.
npm.cmd run db:generate
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd run dev
```

Mở terminal thứ hai:

```powershell
cd D:\management_projectv2\frontend
npm.cmd install
# Tạo frontend/.env.local theo mẫu ở phần "Cài đặt chi tiết" trước khi chạy frontend.
npm.cmd run dev
```

Sau khi chạy thành công:

- Frontend: `http://localhost:3002`
- Backend API: `http://localhost:5000/api/v1`
- Health check: `http://localhost:5000/health`

## Cài đặt chi tiết

### 1. Clone source

```powershell
git clone <repository-url>
cd management_projectv2
```

Nếu đã có source sẵn trong máy:

```powershell
cd D:\management_projectv2
```

### 2. Chuẩn bị database PostgreSQL

Tạo một database trống, ví dụ:

```sql
CREATE DATABASE management_project;
```

Chuẩn bị connection string theo mẫu:

```text
postgresql://USER:PASSWORD@HOST:PORT/DATABASE
```

Ví dụ khi chạy PostgreSQL local:

```text
postgresql://postgres:postgres@localhost:5432/management_project
```

Nếu dùng database cloud, nhà cung cấp thường đưa sẵn `DATABASE_URL`. Hãy bật SSL theo hướng dẫn của nhà cung cấp nếu họ yêu cầu.

### 3. Cài dependency backend

```powershell
cd D:\management_projectv2\backend
npm.cmd install
```

macOS/Linux:

```bash
cd backend
npm install
```

### 4. Tạo file môi trường backend

Tạo file `backend/.env`:

```ini
NODE_ENV=development
HOST=0.0.0.0
PORT=5000

FRONTEND_URL=http://localhost:3002
BACKEND_URL=http://localhost:5000

DATABASE_URL="postgresql://postgres:postgres@localhost:5432/management_project"
JWT_SECRET=change_this_to_a_random_secret_with_at_least_32_characters
SCORE_VERIFY_SECRET=change_this_to_another_random_secret_with_at_least_32_characters

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:5000/api/v1/auth/google/callback

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Trong đó:

| Biến | Bắt buộc | Ý nghĩa |
| --- | --- | --- |
| `NODE_ENV` | Có | Dùng `development`, `test` hoặc `production` |
| `HOST` | Không | Mặc định `0.0.0.0` |
| `PORT` | Không | Mặc định `5000` |
| `FRONTEND_URL` | Có | Origin frontend để CORS và cookie hoạt động |
| `BACKEND_URL` | Nên có | URL backend dùng khi tạo callback/link |
| `DATABASE_URL` | Có | Connection string PostgreSQL cho Prisma |
| `JWT_SECRET` | Có | Tối thiểu 32 ký tự |
| `SCORE_VERIFY_SECRET` | Nên có | Secret ký link/điểm xác minh; nếu thiếu sẽ fallback sang `JWT_SECRET` |
| `GOOGLE_CLIENT_ID` | Tuỳ chọn | Chỉ cần khi bật đăng nhập Google |
| `GOOGLE_CLIENT_SECRET` | Tuỳ chọn | Chỉ cần khi bật đăng nhập Google |
| `GOOGLE_REDIRECT_URI` | Tuỳ chọn | Callback URL cấu hình trong Google Console |
| `CLOUDINARY_*` | Tuỳ chọn | Chỉ cần khi cấu hình upload qua Cloudinary |

Không commit `.env` hoặc secret thật lên Git.

### 5. Generate Prisma client

```powershell
cd D:\management_projectv2\backend
npm.cmd run db:generate
```

### 6. Chạy migration database

Với database mới:

```powershell
npm.cmd run db:migrate
```

Lệnh này áp dụng migrations trong `backend/prisma/migrations` và tạo các bảng cần thiết.

Nếu chỉ muốn kiểm tra schema:

```powershell
npm.cmd run db:validate
```

### 7. Nạp dữ liệu mẫu

```powershell
npm.cmd run db:seed
```

Seed sẽ tạo người dùng mẫu, kỳ đồ án, roster, đề tài, project, milestone, điểm và thông báo demo.

### 8. Chạy backend

```powershell
cd D:\management_projectv2\backend
npm.cmd run dev
```

Khi chạy thành công, backend lắng nghe theo `PORT` trong `.env`, thường là:

```text
http://localhost:5000
```

Kiểm tra nhanh bằng trình duyệt hoặc Postman:

```text
http://localhost:5000/health
```

Kết quả mong đợi:

```json
{
  "success": true,
  "message": "Server is healthy!"
}
```

### 9. Cài dependency frontend

Mở terminal mới:

```powershell
cd D:\management_projectv2\frontend
npm.cmd install
```

macOS/Linux:

```bash
cd frontend
npm install
```

### 10. Tạo file môi trường frontend

Tạo file `frontend/.env.local`:

```ini
NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
NEXT_PUBLIC_DEFAULT_GROUP_AVATAR_URL=https://cdn-icons-png.flaticon.com/512/166/166258.png
```

Trong đó:

| Biến | Bắt buộc | Ý nghĩa |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Có | URL API backend, luôn kèm `/api/v1` |
| `NEXT_PUBLIC_DEFAULT_GROUP_AVATAR_URL` | Không | Ảnh mặc định cho nhóm chat/nhóm dự án |

Nếu backend chạy port khác, đổi `NEXT_PUBLIC_API_URL` cho khớp.

### 11. Chạy frontend

```powershell
cd D:\management_projectv2\frontend
npm.cmd run dev
```

Frontend mặc định chạy tại:

```text
http://localhost:3002
```

Truy cập `http://localhost:3002/auth/login` để đăng nhập.

## Tài khoản mẫu sau khi seed

Tất cả tài khoản seed mặc định dùng mật khẩu:

```text
password123
```

| Vai trò | Email |
| --- | --- |
| Quản trị hệ thống | `admin@st.phenikaa-uni.edu.vn` |
| Giáo vụ khoa | `huonglt@hust.edu.vn` |
| Giảng viên hướng dẫn | `haikt@hust.edu.vn` |
| Giảng viên phản biện | `hongnt@hust.edu.vn` |
| Sinh viên | `hoanganh@hust.edu.vn` |
| Sinh viên demo | `quan.nm22@st.phenikaa-uni.edu.vn` |
| Sinh viên demo | `linh.tp22@st.phenikaa-uni.edu.vn` |
| Sinh viên demo | `anh.pd22@st.phenikaa-uni.edu.vn` |
| Giảng viên demo | `ngocpt@phenikaa-uni.edu.vn` |

Không dùng mật khẩu seed cho production.

## Các lệnh thường dùng

### Backend

Chạy trong thư mục `backend`:

| Lệnh | Mục đích |
| --- | --- |
| `npm.cmd run dev` | Chạy backend bằng nodemon |
| `npm.cmd run start` | Chạy backend bằng Node.js |
| `npm.cmd run test` | Chạy toàn bộ backend integration tests |
| `npm.cmd run test:integration` | Alias của backend integration tests |
| `npm.cmd run test:env` | Kiểm tra biến môi trường test |
| `npm.cmd run db:validate` | Validate Prisma schema |
| `npm.cmd run db:migrate` | Chạy Prisma migration dev |
| `npm.cmd run db:generate` | Generate Prisma client |
| `npm.cmd run db:seed` | Nạp dữ liệu mẫu |
| `npm.cmd run db:studio` | Mở Prisma Studio |

Trên macOS/Linux, thay `npm.cmd` bằng `npm`.

### Frontend

Chạy trong thư mục `frontend`:

| Lệnh | Mục đích |
| --- | --- |
| `npm.cmd run dev` | Chạy Next.js dev server ở port 3002 |
| `npm.cmd run build` | Build production frontend |
| `npm.cmd run start` | Chạy frontend production sau khi build |
| `npm.cmd run lint` | Kiểm tra lint |
| `npm.cmd run test:e2e` | Chạy Playwright E2E tests |

## Kiểm thử

### Kiểm tra backend

Backend tests cần `DATABASE_URL` và `JWT_SECRET` trong `backend/.env`.

```powershell
cd D:\management_projectv2\backend
npm.cmd run test:env
npm.cmd run test
```

### Kiểm tra frontend lint

```powershell
cd D:\management_projectv2\frontend
npm.cmd run lint
```

### Kiểm tra E2E bằng Playwright

Cài browser cho Playwright nếu máy chưa có:

```powershell
cd D:\management_projectv2\frontend
npx.cmd playwright install
```

Chạy backend và frontend ở hai terminal riêng trước, sau đó chạy:

```powershell
cd D:\management_projectv2\frontend
npm.cmd run test:e2e
```

Biến môi trường E2E tuỳ chọn:

```powershell
$env:PLAYWRIGHT_BASE_URL="http://localhost:3002"
$env:PLAYWRIGHT_API_BASE_URL="http://localhost:5000/api/v1"
npm.cmd run test:e2e
```

## Xử lý lỗi thường gặp

### `JWT_SECRET must be configured and at least 32 characters long`

Mở `backend/.env` và đặt `JWT_SECRET` dài tối thiểu 32 ký tự.

### Frontend gọi API bị lỗi CORS hoặc không đăng nhập được

Kiểm tra hai biến sau:

```ini
# backend/.env
FRONTEND_URL=http://localhost:3002

# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
```

Sau khi sửa `.env`, dừng server và chạy lại cả backend/frontend.

### Prisma không kết nối được database

Kiểm tra:

- PostgreSQL đang chạy.
- Database đã được tạo.
- `DATABASE_URL` đúng user, password, host, port và database.
- Nếu dùng database cloud, cấu hình SSL đúng theo nhà cung cấp.

Sau đó chạy lại:

```powershell
cd D:\management_projectv2\backend
npm.cmd run db:validate
npm.cmd run db:migrate
```

### Port đã được sử dụng

Nếu port `5000` bận, đổi `PORT` trong `backend/.env`, ví dụ:

```ini
PORT=5002
BACKEND_URL=http://localhost:5002
```

Sau đó cập nhật frontend:

```ini
NEXT_PUBLIC_API_URL=http://localhost:5002/api/v1
```

Frontend đang cố định lệnh dev ở port `3002` trong `frontend/package.json`.

### Playwright không tìm thấy browser

Chạy:

```powershell
cd D:\management_projectv2\frontend
npx.cmd playwright install
```

## Lưu ý bảo mật và dữ liệu

- Không commit `.env`, token, API key, mật khẩu hoặc credential thật.
- `JWT_SECRET` và `SCORE_VERIFY_SECRET` trong production phải là chuỗi ngẫu nhiên mạnh.
- Cookie auth dùng `HttpOnly`, `SameSite=Lax` và bật `Secure` trong production.
- `FRONTEND_URL` phải khớp đúng origin frontend để CORS và cookie hoạt động.
- File project/submission là file private, phải đi qua API kiểm tra quyền hoặc signed URL.
- Business data dùng soft delete với các field như `isDeleted`, `deletedAt`, `deletedBy`.
- Không commit `node_modules/`, `backend/uploads/`, `backend/public/uploads/`, `reports/` hoặc file cá nhân.

## Gợi ý quy trình chạy local hằng ngày

Terminal 1:

```powershell
cd D:\management_projectv2\backend
npm.cmd run dev
```

Terminal 2:

```powershell
cd D:\management_projectv2\frontend
npm.cmd run dev
```

Mở trình duyệt tại:

```text
http://localhost:3002
```
