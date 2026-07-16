# Karl - Management Project

Karl là hệ thống quản lý đồ án/môn học cho môi trường đại học. Ứng dụng hỗ trợ quản lý kỳ đồ án, danh sách sinh viên, nhóm, đề tài, dự án, mốc nộp bài, file nộp, chấm điểm, phúc khảo, xin gia hạn, thông báo và chat giữa sinh viên với giảng viên.

Dự án hiện dùng PostgreSQL/Prisma làm nguồn dữ liệu chính. MongoDB/Mongoose không còn là runtime target.

## Công Nghệ

### Backend

- Node.js + Express.js
- PostgreSQL + Prisma ORM
- JWT authentication
- bcryptjs để hash mật khẩu
- Socket.IO cho chat/thông báo realtime
- Multer cho upload file
- Cloudinary cho lưu trữ file/ảnh
- express-rate-limit cho giới hạn request đăng nhập/upload

### Frontend

- Next.js App Router
- React
- Zustand cho client state
- Socket.IO Client
- Phosphor Icons
- CSS Modules/Tailwind/PostCSS theo từng phần giao diện
- Playwright cho E2E test

### Kiểm Thử

- Backend integration tests trong `backend/tests`
- Frontend lint bằng ESLint
- E2E tests bằng Playwright trong `frontend/e2e`

## Cấu Trúc Thư Mục

```text
management_projectv2/
  backend/
    app.js                         # Express app, routes, middleware, Socket.IO
    config/                        # env, jwt, prisma, cloudinary, rate-limit
    middlewares/                   # auth middleware, role/context access
    domains/                       # modules nghiệp vụ theo domain
    prisma/                        # schema, migrations, seed
    tests/                         # backend integration tests
    uploads/                       # upload local/private, không commit

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

## Chức Năng Chính

- Đăng nhập bằng email/mật khẩu và Google OAuth.
- Phân quyền theo vai trò: `SYSTEM_ADMIN`, `FACULTY_STAFF`, `LECTURER`, `STUDENT`.
- Quản lý sinh viên, giảng viên, roster và kỳ đồ án.
- Tạo nhóm, mời thành viên, xác nhận nhóm.
- Đề xuất, duyệt, phân công và quản lý đề tài.
- Theo dõi project, milestone, submission package.
- Upload/tải file có kiểm tra quyền và signed URL.
- Chấm điểm theo rubric, tổng hợp final grade, publish/lock kết quả.
- Sinh viên gửi phúc khảo, xin gia hạn, xin đổi đề tài.
- Chat realtime và thông báo realtime.

## Yêu Cầu Môi Trường

- Node.js 20+ khuyến nghị.
- npm.
- PostgreSQL database hoặc dịch vụ PostgreSQL tương thích như Neon/Supabase/Railway.
- Cloudinary account nếu dùng upload file/ảnh ngoài môi trường test.
- Google OAuth credentials nếu bật đăng nhập Google.

## Pull Về Và Chạy Dự Án

### 1. Cài dependency backend

```powershell
cd D:\management_projectv2\backend
npm.cmd install
```

### 2. Tạo file môi trường backend

Tạo file `backend/.env`:

```ini
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3002
BACKEND_URL=http://localhost:5000

JWT_SECRET=replace_with_a_secret_at_least_32_characters
DATABASE_URL="postgresql://user:password@host:port/database?sslmode=verify-full"

GOOGLE_CLIENT_ID=replace_with_google_client_id
GOOGLE_CLIENT_SECRET=replace_with_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/v1/auth/google/callback

CLOUDINARY_CLOUD_NAME=replace_with_cloud_name
CLOUDINARY_API_KEY=replace_with_api_key
CLOUDINARY_API_SECRET=replace_with_api_secret
```

Không commit `.env` hoặc secret thật lên Git.

### 3. Chuẩn bị Prisma/database

```powershell
cd D:\management_projectv2\backend
npm.cmd run db:generate
npm.cmd run db:validate
```

Nếu database mới chưa có bảng:

```powershell
npm.cmd run db:migrate
```

Nếu cần dữ liệu mẫu:

```powershell
npm.cmd run db:seed
```

### 4. Chạy backend

```powershell
cd D:\management_projectv2\backend
npm.cmd run dev
```

Backend chạy theo `PORT` trong `.env`, ví dụ:

```text
http://localhost:5000
```

Health check:

```text
http://localhost:5000/health
```

### 5. Cài dependency frontend

Mở terminal khác:

```powershell
cd D:\management_projectv2\frontend
npm.cmd install
```

### 6. Tạo file môi trường frontend

Tạo file `frontend/.env.local`:

```ini
NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
```

Nếu backend chạy port khác, đổi URL cho khớp. Ví dụ backend `5002`:

```ini
NEXT_PUBLIC_API_URL=http://localhost:5002/api/v1
```

### 7. Chạy frontend

```powershell
cd D:\management_projectv2\frontend
npm.cmd run dev
```

Frontend chạy tại:

```text
http://localhost:3002
```

## Lệnh Thường Dùng

### Backend

```powershell
cd D:\management_projectv2\backend
npm.cmd run dev
npm.cmd run start
npm.cmd run test
npm.cmd run test:env
npm.cmd run db:validate
npm.cmd run db:migrate
npm.cmd run db:generate
npm.cmd run db:seed
```

Ý nghĩa:

| Lệnh | Mục đích |
| --- | --- |
| `npm.cmd run dev` | Chạy backend bằng nodemon |
| `npm.cmd run start` | Chạy backend bằng node |
| `npm.cmd run test` | Chạy toàn bộ backend integration tests |
| `npm.cmd run test:env` | Kiểm tra biến môi trường test |
| `npm.cmd run db:validate` | Validate Prisma schema |
| `npm.cmd run db:migrate` | Chạy migration dev |
| `npm.cmd run db:generate` | Generate Prisma client |
| `npm.cmd run db:seed` | Nạp dữ liệu mẫu |

### Frontend

```powershell
cd D:\management_projectv2\frontend
npm.cmd run dev
npm.cmd run build
npm.cmd run start
npm.cmd run lint
npm.cmd run test:e2e
```

Ý nghĩa:

| Lệnh | Mục đích |
| --- | --- |
| `npm.cmd run dev` | Chạy Next.js dev server ở port 3002 |
| `npm.cmd run build` | Build production frontend |
| `npm.cmd run start` | Chạy frontend production sau khi build |
| `npm.cmd run lint` | Kiểm tra lint |
| `npm.cmd run test:e2e` | Chạy Playwright E2E tests |

## Kiểm Tra Dự Án

Backend integration tests:

```powershell
cd D:\management_projectv2\backend
npm.cmd run test
```

Frontend lint:

```powershell
cd D:\management_projectv2\frontend
npm.cmd run lint
```

E2E tests cần backend và frontend đang chạy trước:

```powershell
cd D:\management_projectv2\frontend
npm.cmd run test:e2e
```

Nếu chỉ muốn kiểm tra nhanh code mà không mở browser, chạy backend test và frontend lint là đủ.

## Bảo Mật Chính

- JWT secret bắt buộc tối thiểu 32 ký tự.
- Password được hash bằng bcrypt, không lưu plaintext.
- Access token ngắn hạn, refresh token dài hơn.
- Cookie auth dùng `HttpOnly`, `SameSite=Lax`, và `Secure` trong production.
- Backend kiểm tra user còn tồn tại, chưa bị khóa, chưa inactive ở mỗi request bảo vệ.
- Route quan trọng dùng `protect` và `requireRole`.
- Quyền dữ liệu kiểm thêm theo owner/project/group/supervisor/reviewer.
- Login và upload có rate limit.
- File upload kiểm tra size, magic bytes, MIME và sanitize filename.
- File private tải qua kiểm quyền hoặc signed URL ngắn hạn.
- Business data dùng soft delete với `isDeleted`, `deletedAt`, `deletedBy`.

## Lưu Ý Khi Commit

Không commit các thư mục/file sau:

```text
node_modules/
.env
backend/.env
frontend/.env.local
backend/uploads/
backend/public/uploads/
reports/
```

Các mục này đã được `.gitignore` chặn, nhưng vẫn cần kiểm tra trước khi commit nếu có secret hoặc file cá nhân.

## Ghi Chú Vận Hành

- `FRONTEND_URL` ở backend phải khớp origin frontend để CORS và cookie hoạt động.
- `NEXT_PUBLIC_API_URL` ở frontend phải trỏ đúng backend API.
- Google OAuth local cần redirect URI khớp trong Google Console.
- Production nên dùng HTTPS và `DATABASE_URL` có SSL.
- Cloudinary credentials chỉ đặt trong môi trường backend, không đưa sang frontend.
