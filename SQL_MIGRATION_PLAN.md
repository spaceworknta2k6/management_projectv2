# Kế hoạch chuyển phần còn lại từ MongoDB sang PostgreSQL/Prisma

Tài liệu này dùng để AI/engineer khác tiếp tục migration sau các phần đã làm. Mục tiêu là chuyển dần backend từ MongoDB/Mongoose sang PostgreSQL online trên Neon qua Prisma, không làm gãy luồng hiện tại.

## Bối cảnh hiện tại

Dự án đang ở trạng thái hybrid:

- PostgreSQL/Prisma đã là nguồn chính cho:
  - `auth`
  - `users`
  - `notifications`
  - `WorkflowEvent`
  - `periods`
  - `rosters`
- MongoDB vẫn còn được dùng trực tiếp bởi nhiều domain nghiệp vụ còn lại.
- Một số phần đã migrate vẫn mirror dữ liệu sang Mongo để các module chưa migrate tiếp tục chạy:
  - `periods.service.js` mirror `ProjectPeriod`
  - `rosters.service.js` mirror `User`, `Student`, `ProjectRoster`
  - `WorkflowEvent.js` đang là adapter Prisma để giữ API gọi cũ

Không sửa trực tiếp file generated như `backend/generated/prisma/client.ts`. File đó do Prisma sinh ra.

## Nguyên tắc migration

1. Đi từng domain, mỗi lần một lát mỏng có thể test được.
2. PostgreSQL là source of truth cho domain đã migrate.
3. Trong giai đoạn chuyển tiếp, nếu domain cũ vẫn đọc Mongo thì domain mới phải mirror dữ liệu cần thiết sang Mongo.
4. Giữ `_id` trong response API bằng `id` của Prisma để frontend cũ không phải đổi ngay.
5. ID mới nên dùng ObjectId string qua `new mongoose.Types.ObjectId().toString()` để tương thích URL, validator và dữ liệu Mongo cũ.
6. Không hard-delete dữ liệu nghiệp vụ. Dùng soft delete với `isDeleted`, `deletedAt`, `deletedBy` nếu model có nghiệp vụ xóa.
7. Không expose `.env`, connection string, token, password trong code hoặc log.
8. Không sửa rộng frontend nếu backend có thể trả đúng shape cũ.
9. Sau mỗi domain phải chạy tối thiểu:
   - `node --check <file>`
   - `npm run db:validate`
   - test service/API trực tiếp bằng dữ liệu tạm và dọn sạch dữ liệu test

## Thứ tự nên làm

### 1. Groups

Làm tiếp phần này trước.

Lý do:

- `groups` phụ thuộc trực tiếp vào `ProjectRoster`, `Student`, `ProjectPeriod`.
- `rosters` đã migrate và đang mirror sang Mongo, nên có đủ dữ liệu để chuyển `groups` an toàn.
- `topics`, `chat`, `projects`, `submissions` đều phụ thuộc vào `ProjectGroup`.

File cần xem:

- `backend/domains/groups/groups.service.js`
- `backend/domains/groups/groups.router.js`
- `backend/domains/groups/groups.controller.js`
- `backend/models/ProjectGroup.js`
- `backend/domains/topics/topics.service.js`
- `backend/domains/chat/chat.service.js`

Việc cần làm:

- Thêm model Prisma `ProjectGroup`.
- Thêm migration Prisma.
- Viết script migrate dữ liệu Mongo `ProjectGroup` sang Postgres.
- Chuyển `groups.service.js` sang Prisma.
- Vẫn mirror `ProjectGroup` sang Mongo, vì `topics`, `chat`, `projects`, `submissions`, `extensions` còn đọc group từ Mongo.
- Response phải giữ shape cũ:
  - `_id`
  - `members`
  - `periodId`
  - `leaderId`
  - các trường populated nếu frontend đang dùng
- Khi tạo group, vẫn validate roster active.
  - Có thể đọc roster từ Prisma.
  - Hoặc nếu muốn ít thay đổi, đọc từ Mongo mirror trong bước đầu, sau đó đổi sang Prisma ở bước cleanup.

Test cần có:

- Student trong roster tạo group thành công.
- Student không có trong roster bị chặn.
- Invite member trong roster thành công.
- Invite member ngoài roster bị chặn.
- Accept/reject invitation.
- Không cho vượt giới hạn group size từ period.
- Mongo mirror có group mới để `topics/chat` vẫn đọc được.

### 2. Topics

Làm sau `groups`.

Lý do:

- `topics` phụ thuộc vào `ProjectGroup`, `ProjectRoster`, `ProjectPeriod`, `Lecturer`, `Project`.
- Khi topic được approve/assign có thể spawn `Project`, nên đây là domain trung tâm.

File cần xem:

- `backend/domains/topics/topics.service.js`
- `backend/domains/topics/topics.validator.js`
- `backend/models/ProjectTopic.js`
- `backend/models/Project.js`
- `backend/utils/project-owner.js`

Việc cần làm:

- Thêm model Prisma `ProjectTopic`.
- Có thể thêm model Prisma `Project` cùng lúc nếu phần assign topic tạo project khó tách riêng.
- Nếu chưa migrate `Project`, thì topic service khi assign vẫn có thể tạo Project trong Mongo như hiện tại, nhưng cách này chỉ là tạm.
- Khuyến nghị: migrate `ProjectTopic` và `Project` trong cùng một slice hoặc hai slice liên tiếp rất gần nhau.
- Mirror `ProjectTopic` sang Mongo nếu các module như `extensions`, `topics.validator`, `scores` còn đọc Mongo.
- Giữ các status hiện tại:
  - `draft`
  - `submitted`
  - `approved`
  - `assigned`
  - `locked`
  - `changed`
  - `rejected`
  - `cancelled`

Test cần có:

- Student propose topic cá nhân.
- Group propose topic nhóm.
- Lecturer approve/reject.
- Staff assign supervisor.
- Khi assigned thì project được tạo đúng owner cá nhân/nhóm.
- Không cho tạo topic trùng active topic/project.
- Validator vẫn trả lỗi rõ ràng.

### 3. Projects

Nếu chưa migrate cùng topics thì làm ngay sau topics.

File cần xem:

- `backend/models/Project.js`
- Các domain đang dùng `Project`:
  - `topics`
  - `scores`
  - `submissions`
  - `milestones`
  - `extensions`
  - `appeals`
  - `chat`

Việc cần làm:

- Thêm model Prisma `Project`.
- Migrate Mongo `Project` sang Postgres.
- Tạo helper chung để resolve owner:
  - project cá nhân: `studentId`
  - project nhóm: `groupId`
- Cập nhật `backend/utils/project-owner.js` và `backend/utils/access-control.js` nếu cần.
- Mirror `Project` sang Mongo cho các domain chưa migrate.

Test cần có:

- Project cá nhân truy cập bởi đúng student.
- Project nhóm truy cập bởi member nhóm.
- Supervisor truy cập project mình hướng dẫn.
- Staff/admin truy cập theo quyền hiện tại.
- Các status project cũ vẫn được giữ.

### 4. Milestones

Làm sau `Project`.

File cần xem:

- `backend/domains/milestones/milestones.service.js`
- `backend/models/Milestone.js`
- `backend/models/SubmissionPackage.js`
- `backend/models/ExtensionRequest.js`

Việc cần làm:

- Thêm model Prisma `Milestone`.
- Migrate dữ liệu.
- Chuyển service sang Prisma.
- Nếu `submissions/extensions` chưa migrate, mirror `Milestone` sang Mongo.

Test cần có:

- Supervisor tạo milestone.
- Update/delete mềm milestone.
- Student submit milestone work nếu đúng owner.
- Lock/unlock milestone.
- Không cho submit khi quá hạn nếu nghiệp vụ hiện tại đang chặn.

### 5. Submissions

Làm sau `Project` và tốt nhất sau `Milestones`.

File cần xem:

- `backend/domains/submissions/submissions.service.js`
- `backend/models/SubmissionPackage.js`

Việc cần làm:

- Thêm model Prisma `SubmissionPackage`.
- Các trường nested file metadata có thể dùng `Json`.
- Giữ access-control theo project owner.
- Mirror sang Mongo nếu `extensions/scores/appeals` còn đọc.

Test cần có:

- Tạo package theo phase.
- Upload/update file metadata.
- Submit/finalize package.
- Student chỉ submit được project của mình/nhóm mình.
- Supervisor/staff xem được đúng quyền.

### 6. Scores và Final Grades

Đây là phần rủi ro cao, làm sau khi `Project`, `Rubric`, `Submission` đã ổn.

File cần xem:

- `backend/domains/scores/scores.service.js`
- `backend/models/ScoreSheet.js`
- `backend/models/FinalGrade.js`
- `backend/models/EvaluationRubric.js`

Việc cần làm:

- Thêm model Prisma:
  - `ScoreSheet`
  - `FinalGrade`
  - có thể thêm `EvaluationRubric` trước hoặc cùng lúc
- `criteriaScores`, `componentScores`, công thức tính điểm nên dùng `Json`.
- Unique constraint quan trọng:
  - `ScoreSheet`: `(targetType, targetId, graderId)`
- Giữ nguyên cách tính:
  - raw total
  - rounded total
  - final score
  - letter grade
  - pass/fail theo `period.passScore`
- Cẩn thận luồng publish điểm vì có thể đổi status period sang `results_published`.

Test cần có:

- Submit score sheet lần đầu.
- Submit/update score sheet trùng target/grader.
- Lock score sheet.
- Calculate final grade.
- Public verify score sheet.
- Publish grade.
- Kiểm tra status period sau publish.

### 7. Appeals

Làm sau scores.

File cần xem:

- `backend/domains/appeals/appeals.service.js`
- `backend/models/AppealRequest.js`
- `backend/models/ScoreSheet.js`
- `backend/models/FinalGrade.js`

Việc cần làm:

- Thêm model Prisma `AppealRequest`.
- Dùng Prisma cho link recheck score sheet và update final grade.
- Giữ workflow event.

Test cần có:

- Student tạo appeal.
- Staff/lecturer xử lý appeal.
- Link recheck score sheet.
- Recalculate final grade sau appeal.
- Danh sách appeal theo role.

### 8. Extensions

Làm sau `Project`, `Milestone`, `Submission`.

File cần xem:

- `backend/domains/extensions/extensions.service.js`
- `backend/models/ExtensionRequest.js`

Việc cần làm:

- Thêm model Prisma `ExtensionRequest`.
- Target có thể là milestone/submission package, nên cần đảm bảo hai phần đó đã migrate.
- Giữ kiểm tra owner access.

Test cần có:

- Student gửi extension request.
- Lecturer/staff approve/reject.
- Deadline target được cập nhật đúng.
- Không cho user ngoài owner gửi request.

### 9. Rubrics

Có thể làm trước scores nếu muốn giảm rủi ro cho scores.

File cần xem:

- `backend/domains/rubrics/rubrics.service.js`
- `backend/models/EvaluationRubric.js`

Việc cần làm:

- Thêm model Prisma `EvaluationRubric`.
- Criteria nested dùng `Json`.
- Khi xóa rubric phải kiểm tra period đang dùng.
- Mirror sang Mongo nếu `scores` còn đọc Mongo.

Test cần có:

- Create/update/list/detail rubric.
- Soft delete rubric.
- Chặn delete nếu period đang dùng rubric.

### 10. Chat

Làm sau groups/projects.

File cần xem:

- `backend/domains/chat/chat.service.js`
- `backend/domains/chat/chat.socket.js`
- `backend/models/ChatRoom.js`
- `backend/models/ChatMessage.js`

Việc cần làm:

- Thêm model Prisma:
  - `ChatRoom`
  - `ChatMessage`
- Cẩn thận realtime socket.
- Có thể migrate sau cùng vì ít ảnh hưởng grading, nhưng phụ thuộc group/project owner.

Test cần có:

- Tạo room theo group/project.
- Gửi message.
- Socket auth vẫn nhận user từ Postgres.
- Chỉ member/supervisor/staff đúng quyền xem room.

## Prisma schema notes

Khi thêm model mới, ưu tiên giữ tên bảng snake_case:

- `project_groups`
- `project_topics`
- `projects`
- `milestones`
- `submission_packages`
- `evaluation_rubrics`
- `score_sheets`
- `final_grades`
- `appeal_requests`
- `extension_requests`
- `chat_rooms`
- `chat_messages`

Mỗi model nên có:

- `id String @id`
- `mongoId String? @unique @map("mongo_id")`
- `createdAt DateTime @default(now()) @map("created_at")`
- `updatedAt DateTime @updatedAt @map("updated_at")` nếu entity có update
- `isDeleted Boolean @default(false) @map("is_deleted")` nếu entity có xóa mềm
- `deletedAt DateTime? @map("deleted_at")`
- `deletedBy String? @map("deleted_by")`

Các mảng object/nested object trong Mongoose nên map sang `Json` nếu không cần query sâu bằng SQL.

## Data migration script pattern

Mỗi domain nên có script riêng trong `backend/scripts`:

- `migrate-groups-to-postgres.js`
- `migrate-topics-projects-to-postgres.js`
- `migrate-milestones-to-postgres.js`
- `migrate-submissions-to-postgres.js`
- `migrate-rubrics-to-postgres.js`
- `migrate-scores-to-postgres.js`
- `migrate-appeals-to-postgres.js`
- `migrate-extensions-to-postgres.js`
- `migrate-chat-to-postgres.js`

Pattern:

1. `loadEnv()`
2. connect Mongo
3. đọc collection Mongo với `{ includeDeleted: true }` nếu model có pre-find filter
4. upsert vào Prisma bằng `id = mongo _id string`
5. không log secret
6. in summary dạng count
7. disconnect Mongo và Prisma

## Verification checklist cho mỗi domain

Sau khi migrate một domain:

- `node --check backend/domains/<domain>/<domain>.service.js`
- `npm run db:validate`
- `npx prisma migrate dev --name <name>` nếu có schema mới
- `npx prisma generate`
- chạy script migrate data
- test service trực tiếp bằng dữ liệu tạm
- test HTTP endpoint chính nếu backend server chạy được
- kiểm tra Mongo mirror nếu domain cũ còn phụ thuộc
- dọn dữ liệu test:
  - hard delete chỉ cho dữ liệu test có prefix rõ ràng
  - không hard delete business data

## Test E2E cuối sau khi migrate nhiều domain

Luồng tối thiểu cần chạy:

1. Login staff.
2. Tạo period.
3. Import roster.
4. Login student.
5. Student tạo group hoặc đề xuất topic cá nhân.
6. Staff/lecturer approve topic.
7. Assign supervisor.
8. Tạo milestone.
9. Student submit milestone/submission.
10. Lecturer chấm điểm.
11. Staff publish final grade.
12. Student xem điểm.
13. Student tạo appeal.
14. Staff xử lý appeal.

Nếu Playwright E2E hiện có dùng `frontend/e2e/single-student.spec.js`, ưu tiên chạy lại sau mỗi nhóm migration lớn.

## Rủi ro cần chú ý

- Prisma không tự populate như Mongoose. Service phải tự join và trả shape cũ cho frontend.
- Một số validator đang import Mongoose model trực tiếp. Nếu chỉ migrate service mà quên validator, request vẫn có thể đọc Mongo.
- `project-owner` và `access-control` là điểm giao giữa nhiều domain, không refactor rộng nếu chưa test đủ.
- Các unique index trong Mongo có thể khác Prisma. Cần chuyển thành `@@unique` đúng nghiệp vụ.
- JSON fields trong Prisma cần normalize Map/Object từ Mongoose.
- Trong giai đoạn hybrid, nếu quên mirror, module chưa migrate sẽ không thấy dữ liệu mới.
- Không chạy `git reset --hard` hoặc revert thay đổi không phải của mình.

## Definition of done

Một domain được coi là migrate xong khi:

- Schema Prisma có model tương ứng.
- Migration đã apply lên Neon.
- Data migration script chạy thành công.
- Service chính đọc/ghi PostgreSQL.
- Response API giữ shape frontend đang dùng.
- Module chưa migrate vẫn chạy nhờ mirror hoặc adapter.
- Có test trực tiếp qua service/API cho create/list/update/delete hoặc status transition chính.
- Không còn dữ liệu test sót lại ngoài các bản ghi soft-delete nghiệp vụ hợp lệ.
