# Episteme (Management Project v2)

Hệ thống quản lý đồ án tốt nghiệp và môn học, chuyển đổi hoàn toàn sang kiến trúc SQL/Prisma và loại bỏ hoàn toàn dấu vết MongoDB/Mongoose.

## 🛠️ Công nghệ sử dụng
- **Backend**: Node.js + Express.js + Prisma ORM + PostgreSQL (Neon DB / Supabase)
- **Frontend**: Next.js (App Router) + Zustand + Phosphor Icons + Tailwind CSS / PostCSS
- **Database**: PostgreSQL (Prisma Client)
- **Testing**: Playwright (E2E), Custom Integration Tests (Backend)

---

## 🚫 Loại bỏ Mongoose & MongoDB Target
> [!IMPORTANT]
> **MongoDB/Mongoose và các driver GridFS liên quan KHÔNG còn là runtime target và đã được loại bỏ hoàn toàn.**
> - SQL/Prisma là nguồn dữ liệu duy nhất (Single Source of Truth).
> - Tính năng phát hiện trùng lặp bằng AI (`aiDuplicateRisk`) và bảng điều khiển Audit đã được gỡ bỏ khỏi hệ thống theo yêu cầu nghiệp vụ.
> - Lịch sử Workflow vẫn được duy trì nội bộ thông qua bảng `workflow_events` trong PostgreSQL.

---

## 🚀 Hướng dẫn thiết lập & Chạy dự án

### 1. Cấu hình biến môi trường
Tạo file `.env` tại thư mục `backend/` từ file mẫu:
```ini
PORT=5002
NODE_ENV=development
FRONTEND_URL=http://localhost:3002
JWT_SECRET=your_jwt_secret_key_should_be_at_least_32_characters
JWT_EXPIRES_IN=7d
DATABASE_URL="postgresql://user:password@host:port/dbname?sslmode=verify-full"
STORAGE_PROVIDER=cloudinary
CLOUDINARY_URL=cloudinary://...
```
*(Không yêu cầu `MONGODB_URI` hay khóa AI nào).*

### 2. Thiết lập Database & Sinh dữ liệu mẫu (Seed)
Chạy các lệnh sau trong thư mục `backend/`:
```bash
# Cài đặt thư viện
npm install

# Xác thực Schema Prisma
npm run db:validate

# Đồng bộ schema với database
npx prisma migrate deploy

# Sinh Client Prisma
npm run db:generate

# Nạp dữ liệu mẫu (Seed admin, lecturer, student, rubric, period)
npm run db:seed
```

### 3. Chạy môi trường phát triển (Dev Server)
- **Backend**: `npm run dev` (chạy trên cổng `5002`)
- **Frontend**: `npm run dev` (chạy trên cổng `3002`)

### 4. Chạy kiểm thử tích hợp (Integration Tests)
Trong thư mục `backend/`, chạy:
```bash
npm run test
```
Tất cả 12 bộ kiểm thử tích hợp (Authentication, Periods, Projects, Appeals, File Security, Chat...) sẽ được chạy tuần tự.
