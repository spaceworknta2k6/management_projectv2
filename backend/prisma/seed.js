// Load test environment or standard development environment
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
require('../config/env').loadEnv();

const prisma = require('../config/prisma');
const bcrypt = require('bcryptjs');

async function main() {
  console.log('🌱 Start seeding database...');

  const passwordHash = bcrypt.hashSync('password123', 10);

  // Faculty ID and Department ID constants
  const facultyId = 'faculty-cntt-id';
  const departmentId = 'dept-cnpm-id';

  // 1. Seed SYSTEM_ADMIN
  const adminEmail = 'admin@st.phenikaa-uni.edu.vn';
  const adminUser = await prisma.user.upsert({
    where: { email_isDeleted: { email: adminEmail, isDeleted: false } },
    update: {},
    create: {
      fullName: 'Hệ thống Quản trị viên',
      email: adminEmail,
      passwordHash,
      roles: ['SYSTEM_ADMIN'],
      status: 'active',
    },
  });
  console.log(`👤 Seeded System Admin User: ${adminUser.email}`);

  // 2. Seed FACULTY_STAFF
  const staffEmail = 'huonglt@hust.edu.vn';
  const staffUser = await prisma.user.upsert({
    where: { email_isDeleted: { email: staffEmail, isDeleted: false } },
    update: {},
    create: {
      fullName: 'Lê Thị Hương',
      email: staffEmail,
      passwordHash,
      roles: ['FACULTY_STAFF'],
      status: 'active',
    },
  });
  console.log(`👤 Seeded Faculty Staff User: ${staffUser.email}`);

  // 3. Seed LECTURER (Supervisor: haikt@hust.edu.vn)
  const supervisorEmail = 'haikt@hust.edu.vn';
  const supervisorUser = await prisma.user.upsert({
    where: { email_isDeleted: { email: supervisorEmail, isDeleted: false } },
    update: {},
    create: {
      fullName: 'Kiều Tuấn Hải',
      email: supervisorEmail,
      passwordHash,
      roles: ['LECTURER'],
      status: 'active',
    },
  });
  console.log(`👤 Seeded Supervisor User: ${supervisorUser.email}`);

  const supervisorLecturer = await prisma.lecturer.upsert({
    where: { userId: supervisorUser.id },
    update: {},
    create: {
      userId: supervisorUser.id,
      lecturerCode: 'GV001',
      facultyId,
      departmentId,
      academicDegree: 'phd',
      expertise: ['Software Engineering', 'AI'],
      maxProjects: 5,
    },
  });
  console.log(`📋 Seeded Supervisor Lecturer profile: ${supervisorLecturer.lecturerCode}`);

  // 4. Seed LECTURER (Reviewer: hongnt@hust.edu.vn)
  const reviewerEmail = 'hongnt@hust.edu.vn';
  const reviewerUser = await prisma.user.upsert({
    where: { email_isDeleted: { email: reviewerEmail, isDeleted: false } },
    update: {},
    create: {
      fullName: 'Nguyễn Thị Hồng',
      email: reviewerEmail,
      passwordHash,
      roles: ['LECTURER'],
      status: 'active',
    },
  });
  console.log(`👤 Seeded Reviewer User: ${reviewerUser.email}`);

  const reviewerLecturer = await prisma.lecturer.upsert({
    where: { userId: reviewerUser.id },
    update: {},
    create: {
      userId: reviewerUser.id,
      lecturerCode: 'GV002',
      facultyId,
      departmentId,
      academicDegree: 'phd',
      expertise: ['Network Security', 'Distributed Systems'],
      maxProjects: 5,
    },
  });
  console.log(`📋 Seeded Reviewer Lecturer profile: ${reviewerLecturer.lecturerCode}`);

  // 5. Seed STUDENT (hoanganh@hust.edu.vn)
  const studentEmail = 'hoanganh@hust.edu.vn';
  const studentUser = await prisma.user.upsert({
    where: { email_isDeleted: { email: studentEmail, isDeleted: false } },
    update: {},
    create: {
      fullName: 'Hoàng Anh',
      email: studentEmail,
      passwordHash,
      roles: ['STUDENT'],
      status: 'active',
    },
  });
  console.log(`👤 Seeded Student User: ${studentUser.email}`);

  const studentProfile = await prisma.student.upsert({
    where: { userId: studentUser.id },
    update: {},
    create: {
      userId: studentUser.id,
      studentCode: '22021435',
      className: 'IT4911',
      cohort: 'K67',
      major: 'Công nghệ thông tin',
      facultyId,
    },
  });
  console.log(`📋 Seeded Student profile: ${studentProfile.studentCode}`);

  // 6. Seed default EvaluationRubric
  const rubricId = 'default-rubric-id';
  const rubric = await prisma.evaluationRubric.upsert({
    where: { id: rubricId },
    update: {},
    create: {
      id: rubricId,
      name: 'Rubric Đồ án Tốt nghiệp CNTT',
      version: '1.0',
      description: 'Tiêu chuẩn đánh giá đồ án tốt nghiệp ngành Công nghệ thông tin',
      criteria: {
        SUPERVISOR: [
          { criteriaCode: 'C1', criteriaName: 'Ý thức thái độ làm việc', maxScore: 2, weight: 1.0 },
          { criteriaCode: 'C2', criteriaName: 'Khả năng hoàn thành nhiệm vụ', maxScore: 4, weight: 1.0 },
          { criteriaCode: 'C3', criteriaName: 'Chất lượng tài liệu báo cáo', maxScore: 4, weight: 1.0 },
        ],
        REVIEWER: [
          { criteriaCode: 'C1', criteriaName: 'Tính thời sự, thực tiễn của đề tài', maxScore: 2, weight: 1.0 },
          { criteriaCode: 'C2', criteriaName: 'Mức độ giải quyết yêu cầu đặt ra', maxScore: 5, weight: 1.0 },
          { criteriaCode: 'C3', criteriaName: 'Chất lượng sản phẩm và báo cáo', maxScore: 3, weight: 1.0 },
        ],
      },
    },
  });
  console.log(`📊 Seeded Evaluation Rubric: ${rubric.name}`);

  // 7. Seed default ProjectPeriod
  const periodId = 'default-period-id';
  const registrationStart = new Date();
  const registrationEnd = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
  const topicChangeDeadline = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
  const projectStart = new Date(Date.now() + 25 * 24 * 60 * 60 * 1000);
  const projectEnd = new Date(Date.now() + 120 * 24 * 60 * 60 * 1000);
  const finalSubmissionDeadline = new Date(Date.now() + 110 * 24 * 60 * 60 * 1000);
  const gradingStart = new Date(Date.now() + 125 * 24 * 60 * 60 * 1000);
  const gradingEnd = new Date(Date.now() + 135 * 24 * 60 * 60 * 1000);
  const revisionDeadline = new Date(Date.now() + 140 * 24 * 60 * 60 * 1000);
  const archiveDeadline = new Date(Date.now() + 150 * 24 * 60 * 60 * 1000);

  const period = await prisma.projectPeriod.upsert({
    where: { id: periodId },
    update: {},
    create: {
      id: periodId,
      name: 'Học kỳ 2 - Đồ án Tốt nghiệp 2025-2026',
      schoolYear: '2025-2026',
      semester: '2',
      facultyId,
      departmentId,
      type: 'graduation_thesis',
      projectType: 'graduation_thesis',
      academicUnit: 'computer_science',
      allowIndividual: true,
      allowGroup: true,
      minGroupSize: 1,
      maxGroupSize: 3,
      registrationStart,
      registrationEnd,
      topicChangeDeadline,
      projectStart,
      projectEnd,
      finalSubmissionDeadline,
      gradingStart,
      gradingEnd,
      revisionDeadline,
      archiveDeadline,
      rubricVersion: '1.0',
      rubricId: rubric.id,
      scoringFormula: { supervisor: 0.5, reviewer: 0.5 },
      status: 'open',
    },
  });
  console.log(`📅 Seeded Project Period: ${period.name}`);

  // 8. Seed default ProjectRoster
  const roster = await prisma.projectRoster.upsert({
    where: { periodId_studentId: { periodId: period.id, studentId: studentProfile.id } },
    update: {},
    create: {
      periodId: period.id,
      studentId: studentProfile.id,
      classSection: 'IT4911-L01',
      status: 'active',
      importedBy: staffUser.id,
    },
  });
  console.log(`📋 Seeded Project Roster for student Hoàng Anh in ${period.name}`);

  console.log('✅ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
