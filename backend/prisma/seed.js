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
    update: {
      name: 'Học kỳ 3 - Đồ án Tốt nghiệp 2025-2026',
      schoolYear: '2025-2026',
      semester: '3',
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
      status: 'open',
    },
    create: {
      id: periodId,
      name: 'Học kỳ 3 - Đồ án Tốt nghiệp 2025-2026',
      schoolYear: '2025-2026',
      semester: '3',
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

  // 9. Seed realistic demo data for a fuller local database.
  const demoStudents = [
    {
      fullName: 'Nguyen Minh Quan',
      email: 'quan.nm22@st.phenikaa-uni.edu.vn',
      studentCode: '22021436',
      className: 'K16-CNTT1',
      cohort: 'K16',
      major: 'Cong nghe thong tin',
      skills: ['React', 'Node.js', 'PostgreSQL'],
      interests: ['Quan ly giao duc', 'He thong thong tin'],
      technologies: ['Next.js', 'Express', 'Prisma'],
    },
    {
      fullName: 'Tran Phuong Linh',
      email: 'linh.tp22@st.phenikaa-uni.edu.vn',
      studentCode: '22021437',
      className: 'K16-CNTT1',
      cohort: 'K16',
      major: 'Ky thuat phan mem',
      skills: ['UI/UX', 'Testing', 'React'],
      interests: ['Ung dung web', 'Trai nghiem nguoi dung'],
      technologies: ['Figma', 'Playwright', 'Tailwind CSS'],
    },
    {
      fullName: 'Pham Duc Anh',
      email: 'anh.pd22@st.phenikaa-uni.edu.vn',
      studentCode: '22021438',
      className: 'K16-CNTT2',
      cohort: 'K16',
      major: 'Khoa hoc may tinh',
      skills: ['Python', 'Machine Learning', 'Data Processing'],
      interests: ['Du doan diem', 'Phan tich hoc tap'],
      technologies: ['Python', 'scikit-learn', 'FastAPI'],
    },
  ];

  const seededStudents = [];
  for (const student of demoStudents) {
    const user = await prisma.user.upsert({
      where: { email_isDeleted: { email: student.email, isDeleted: false } },
      update: {
        fullName: student.fullName,
        phoneNumber: '09' + student.studentCode.slice(-8),
        cohort: student.cohort,
      },
      create: {
        fullName: student.fullName,
        email: student.email,
        passwordHash,
        roles: ['STUDENT'],
        status: 'active',
        phoneNumber: '09' + student.studentCode.slice(-8),
        cohort: student.cohort,
      },
    });

    const profile = await prisma.student.upsert({
      where: { userId: user.id },
      update: {
        className: student.className,
        cohort: student.cohort,
        major: student.major,
        skills: student.skills,
        interests: student.interests,
        technologies: student.technologies,
      },
      create: {
        userId: user.id,
        studentCode: student.studentCode,
        className: student.className,
        cohort: student.cohort,
        major: student.major,
        facultyId,
        skills: student.skills,
        interests: student.interests,
        technologies: student.technologies,
      },
    });

    await prisma.projectRoster.upsert({
      where: { periodId_studentId: { periodId: period.id, studentId: profile.id } },
      update: { classSection: `${student.className}-DA1`, status: 'active' },
      create: {
        periodId: period.id,
        studentId: profile.id,
        classSection: `${student.className}-DA1`,
        status: 'active',
        importedBy: staffUser.id,
      },
    });

    seededStudents.push(profile);
  }
  console.log(`Seeded ${seededStudents.length} additional students and rosters.`);

  const secondSupervisorEmail = 'ngocpt@phenikaa-uni.edu.vn';
  const secondSupervisorUser = await prisma.user.upsert({
    where: { email_isDeleted: { email: secondSupervisorEmail, isDeleted: false } },
    update: { fullName: 'Pham Thi Ngoc' },
    create: {
      fullName: 'Pham Thi Ngoc',
      email: secondSupervisorEmail,
      passwordHash,
      roles: ['LECTURER'],
      status: 'active',
    },
  });

  const secondSupervisorLecturer = await prisma.lecturer.upsert({
    where: { userId: secondSupervisorUser.id },
    update: {
      expertise: ['Data Science', 'Learning Analytics', 'Python'],
      maxProjects: 6,
    },
    create: {
      userId: secondSupervisorUser.id,
      lecturerCode: 'GV004',
      facultyId,
      departmentId,
      academicDegree: 'phd',
      expertise: ['Data Science', 'Learning Analytics', 'Python'],
      maxProjects: 6,
    },
  });
  console.log(`Seeded additional lecturer: ${secondSupervisorUser.email}`);

  const groupMembers = seededStudents.slice(0, 2).map((profile, index) => ({
    studentId: profile.id,
    role: index === 0 ? 'leader' : 'member',
    contributionWeight: index === 0 ? 55 : 45,
    status: 'accepted',
    joinedAt: new Date().toISOString(),
  }));

  const group = await prisma.projectGroup.upsert({
    where: { id: 'demo-group-smart-campus' },
    update: {
      members: groupMembers,
      status: 'approved',
      leaderStudentId: seededStudents[0].id,
    },
    create: {
      id: 'demo-group-smart-campus',
      mongoId: '64f100000000000000000101',
      periodId: period.id,
      name: 'Nhom Smart Campus',
      leaderStudentId: seededStudents[0].id,
      members: groupMembers,
      status: 'approved',
    },
  });

  const groupTopic = await prisma.projectTopic.upsert({
    where: { id: 'demo-topic-smart-campus' },
    update: {
      groupId: group.id,
      ownerId: group.id,
      supervisorId: supervisorLecturer.id,
      approvedByLecturerId: supervisorLecturer.id,
      status: 'assigned',
    },
    create: {
      id: 'demo-topic-smart-campus',
      mongoId: '64f100000000000000000201',
      periodId: period.id,
      ownerType: 'group',
      ownerId: group.id,
      groupId: group.id,
      createdByRole: 'student',
      createdByUserId: seededStudents[0].userId,
      approvedByLecturerId: supervisorLecturer.id,
      title: 'Xay dung he thong quan ly tien do do an tot nghiep',
      summary: 'He thong ho tro giao vu, giang vien va sinh vien theo doi de tai, moc nop bai, phan hoi va diem so.',
      objectives: 'So hoa quy trinh dang ky de tai, nop bao cao, cham diem va cong bo ket qua.',
      scope: 'Ung dung web cho khoa CNTT, gom dashboard, phan quyen, nop tai lieu va theo doi workflow.',
      technologies: ['Next.js', 'Express', 'Prisma', 'PostgreSQL', 'Socket.IO'],
      expectedResult: 'MVP co kha nang quan ly mot dot do an voi nhom sinh vien, giang vien huong dan va giang vien phan bien.',
      plan: 'Khao sat quy trinh; thiet ke CSDL; xay API; xay giao dien; kiem thu voi du lieu mau.',
      keywords: ['graduation project', 'workflow', 'dashboard'],
      academicUnit: 'computer_science',
      topicDomain: 'software_development',
      supervisorId: supervisorLecturer.id,
      departmentId,
      status: 'assigned',
      approvedBy: supervisorLecturer.id,
      approvedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
      capacityMaxStudents: 3,
      capacityMaxGroups: 1,
      currentGroupCount: 1,
    },
  });

  const individualTopic = await prisma.projectTopic.upsert({
    where: { id: 'demo-topic-learning-analytics' },
    update: {
      studentId: seededStudents[2].id,
      ownerId: seededStudents[2].id,
      supervisorId: secondSupervisorLecturer.id,
      approvedByLecturerId: secondSupervisorLecturer.id,
      status: 'approved',
    },
    create: {
      id: 'demo-topic-learning-analytics',
      mongoId: '64f100000000000000000202',
      periodId: period.id,
      ownerType: 'student',
      ownerId: seededStudents[2].id,
      studentId: seededStudents[2].id,
      createdByRole: 'student',
      createdByUserId: seededStudents[2].userId,
      approvedByLecturerId: secondSupervisorLecturer.id,
      title: 'Phan tich du lieu hoc tap de canh bao som rui ro tre tien do',
      summary: 'Mo hinh phan tich log nop bai va phan hoi de goi y canh bao som cho sinh vien co nguy co cham tien do.',
      objectives: 'Xay pipeline du lieu, bo chi so rui ro va dashboard thong ke cho giang vien huong dan.',
      scope: 'Du lieu demo trong pham vi hoc phan do an, khong xu ly du lieu nhay cam ngoai he thong.',
      technologies: ['Python', 'FastAPI', 'PostgreSQL', 'Chart.js'],
      expectedResult: 'Prototype hien thi diem rui ro va goi y hanh dong cho tung sinh vien.',
      plan: 'Thu thap du lieu mau; xay dac trung; huan luyen mo hinh; tich hop dashboard; danh gia ket qua.',
      keywords: ['learning analytics', 'early warning', 'data science'],
      academicUnit: 'computer_science',
      topicDomain: 'data_science',
      supervisorId: secondSupervisorLecturer.id,
      departmentId,
      status: 'approved',
      approvedBy: secondSupervisorLecturer.id,
      approvedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      capacityMaxStudents: 1,
      capacityMaxGroups: 0,
      currentStudentCount: 1,
    },
  });

  const groupProject = await prisma.project.upsert({
    where: { id: 'demo-project-smart-campus' },
    update: {
      reviewerId: reviewerLecturer.id,
      status: 'in_progress',
    },
    create: {
      id: 'demo-project-smart-campus',
      mongoId: '64f100000000000000000301',
      periodId: period.id,
      ownerType: 'group',
      ownerId: group.id,
      groupId: group.id,
      topicId: groupTopic.id,
      supervisorId: supervisorLecturer.id,
      reviewerId: reviewerLecturer.id,
      status: 'in_progress',
    },
  });

  await prisma.project.upsert({
    where: { id: 'demo-project-learning-analytics' },
    update: {
      reviewerId: reviewerLecturer.id,
      status: 'assigned',
    },
    create: {
      id: 'demo-project-learning-analytics',
      mongoId: '64f100000000000000000302',
      periodId: period.id,
      ownerType: 'student',
      ownerId: seededStudents[2].id,
      studentId: seededStudents[2].id,
      topicId: individualTopic.id,
      supervisorId: secondSupervisorLecturer.id,
      reviewerId: reviewerLecturer.id,
      status: 'assigned',
    },
  });

  const milestone = await prisma.milestone.upsert({
    where: { id: 'demo-milestone-smart-campus-proposal' },
    update: {
      status: 'accepted',
      feedback: [
        {
          by: supervisorUser.id,
          role: 'SUPERVISOR',
          comment: 'De cuong ro muc tieu, can bo sung them tieu chi nghiem thu cho tung module.',
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
    },
    create: {
      id: 'demo-milestone-smart-campus-proposal',
      mongoId: '64f100000000000000000401',
      projectId: groupProject.id,
      title: 'Nop de cuong va ke hoach thuc hien',
      description: 'Nhom nop de cuong chi tiet, backlog chuc nang va lich lam viec 4 tuan dau.',
      deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      status: 'accepted',
      submissions: [
        {
          submittedBy: seededStudents[0].userId,
          fileName: 'de-cuong-smart-campus.pdf',
          submittedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'submitted',
        },
      ],
      feedback: [
        {
          by: supervisorUser.id,
          role: 'SUPERVISOR',
          comment: 'De cuong ro muc tieu, can bo sung them tieu chi nghiem thu cho tung module.',
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
    },
  });

  await prisma.submissionPackage.upsert({
    where: { id: 'demo-submission-smart-campus-final' },
    update: {
      status: 'submitted',
      reviewedBy: supervisorUser.id,
      reviewNotes: 'Da nhan ban bao cao giua ky, cho phan bien tiep tuc gop y.',
    },
    create: {
      id: 'demo-submission-smart-campus-final',
      mongoId: '64f100000000000000000501',
      ownerType: 'group',
      ownerId: groupProject.id,
      groupId: group.id,
      projectOwnerType: 'group',
      projectOwnerId: group.id,
      periodId: period.id,
      phase: 'midterm_report',
      deadline: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000),
      status: 'submitted',
      items: [
        { type: 'report_pdf', name: 'Bao cao giua ky', status: 'submitted' },
        { type: 'source_code', name: 'Repository snapshot', status: 'submitted' },
      ],
      submittedBy: seededStudents[0].userId,
      submittedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      reviewedBy: supervisorUser.id,
      reviewedAt: new Date(),
      reviewNotes: 'Da nhan ban bao cao giua ky, cho phan bien tiep tuc gop y.',
    },
  });

  const supervisorScores = [
    { criteriaCode: 'C1', criteriaName: 'Y thuc thai do lam viec', maxScore: 2, weight: 1, score: 1.8 },
    { criteriaCode: 'C2', criteriaName: 'Kha nang hoan thanh nhiem vu', maxScore: 4, weight: 1, score: 3.5 },
    { criteriaCode: 'C3', criteriaName: 'Chat luong tai lieu bao cao', maxScore: 4, weight: 1, score: 3.4 },
  ];
  const reviewerScores = [
    { criteriaCode: 'C1', criteriaName: 'Tinh thoi su, thuc tien cua de tai', maxScore: 2, weight: 1, score: 1.7 },
    { criteriaCode: 'C2', criteriaName: 'Muc do giai quyet yeu cau dat ra', maxScore: 5, weight: 1, score: 4.1 },
    { criteriaCode: 'C3', criteriaName: 'Chat luong san pham va bao cao', maxScore: 3, weight: 1, score: 2.4 },
  ];

  await prisma.scoreSheet.upsert({
    where: {
      targetType_targetId_graderId_rubricRole: {
        targetType: 'PROJECT',
        targetId: groupProject.id,
        graderId: supervisorLecturer.id,
        rubricRole: 'SUPERVISOR',
      },
    },
    update: {
      criteriaScores: supervisorScores,
      rawTotal: 8.7,
      roundedTotal: 8.7,
      comment: 'Nhom bam sat ke hoach, tien do tot va giao tiep chu dong.',
      lockedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
    },
    create: {
      id: 'demo-score-smart-campus-supervisor',
      mongoId: '64f100000000000000000601',
      rubricId: rubric.id,
      rubricRole: 'SUPERVISOR',
      rubricVersion: rubric.version,
      targetType: 'PROJECT',
      targetId: groupProject.id,
      projectId: groupProject.id,
      ownerType: 'group',
      ownerId: group.id,
      groupId: group.id,
      periodId: period.id,
      graderId: supervisorLecturer.id,
      graderRole: 'SUPERVISOR',
      criteriaScores: supervisorScores,
      rawTotal: 8.7,
      roundedTotal: 8.7,
      comment: 'Nhom bam sat ke hoach, tien do tot va giao tiep chu dong.',
      lockedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
    },
  });

  await prisma.scoreSheet.upsert({
    where: {
      targetType_targetId_graderId_rubricRole: {
        targetType: 'PROJECT',
        targetId: groupProject.id,
        graderId: reviewerLecturer.id,
        rubricRole: 'REVIEWER',
      },
    },
    update: {
      criteriaScores: reviewerScores,
      rawTotal: 8.2,
      roundedTotal: 8.2,
      comment: 'San pham co tinh ung dung, can trinh bay ro hon ve bao mat file nop.',
      lockedAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
    },
    create: {
      id: 'demo-score-smart-campus-reviewer',
      mongoId: '64f100000000000000000602',
      rubricId: rubric.id,
      rubricRole: 'REVIEWER',
      rubricVersion: rubric.version,
      targetType: 'PROJECT',
      targetId: groupProject.id,
      projectId: groupProject.id,
      ownerType: 'group',
      ownerId: group.id,
      groupId: group.id,
      periodId: period.id,
      graderId: reviewerLecturer.id,
      graderRole: 'REVIEWER',
      criteriaScores: reviewerScores,
      rawTotal: 8.2,
      roundedTotal: 8.2,
      comment: 'San pham co tinh ung dung, can trinh bay ro hon ve bao mat file nop.',
      lockedAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
    },
  });

  const finalGrade = await prisma.finalGrade.upsert({
    where: { projectId: groupProject.id },
    update: {
      componentScores: { supervisor: 8.7, reviewer: 8.2 },
      finalScore: 8.5,
      letterGrade: 'A',
      passStatus: 'passed',
      publishedAt: new Date(),
    },
    create: {
      id: 'demo-final-smart-campus',
      mongoId: '64f100000000000000000701',
      projectId: groupProject.id,
      ownerType: 'group',
      ownerId: group.id,
      groupId: group.id,
      periodId: period.id,
      evaluationMode: 'standard',
      componentScores: { supervisor: 8.7, reviewer: 8.2 },
      finalScore: 8.5,
      letterGrade: 'A',
      passStatus: 'passed',
      varianceFlags: [],
      formulaVersion: rubric.version,
      publishedAt: new Date(),
    },
  });

  const learningAnalyticsProject = await prisma.project.findUnique({
    where: { id: 'demo-project-learning-analytics' },
  });

  await prisma.submissionPackage.upsert({
    where: { id: 'demo-submission-learning-analytics-final' },
    update: {
      status: 'accepted',
      submittedBy: seededStudents[2].userId,
      reviewedBy: secondSupervisorUser.id,
      reviewNotes: 'Bao cao co bo chi so ro, can them phan giai thich gioi han cua mo hinh.',
    },
    create: {
      id: 'demo-submission-learning-analytics-final',
      mongoId: '64f100000000000000000502',
      ownerType: 'student',
      ownerId: learningAnalyticsProject.id,
      studentId: seededStudents[2].id,
      projectOwnerType: 'student',
      projectOwnerId: seededStudents[2].id,
      periodId: period.id,
      phase: 'final_report',
      deadline: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
      status: 'accepted',
      items: [
        { type: 'report_pdf', name: 'Bao cao cuoi ky', status: 'accepted' },
        { type: 'demo_video', name: 'Video demo dashboard canh bao', status: 'accepted' },
      ],
      submittedBy: seededStudents[2].userId,
      submittedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      reviewedBy: secondSupervisorUser.id,
      reviewedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      reviewNotes: 'Bao cao co bo chi so ro, can them phan giai thich gioi han cua mo hinh.',
    },
  });

  const learningSupervisorScores = [
    { criteriaCode: 'C1', criteriaName: 'Y thuc thai do lam viec', maxScore: 2, weight: 1, score: 1.7 },
    { criteriaCode: 'C2', criteriaName: 'Kha nang hoan thanh nhiem vu', maxScore: 4, weight: 1, score: 3.2 },
    { criteriaCode: 'C3', criteriaName: 'Chat luong tai lieu bao cao', maxScore: 4, weight: 1, score: 3.1 },
  ];
  const learningReviewerScores = [
    { criteriaCode: 'C1', criteriaName: 'Tinh thoi su, thuc tien cua de tai', maxScore: 2, weight: 1, score: 1.6 },
    { criteriaCode: 'C2', criteriaName: 'Muc do giai quyet yeu cau dat ra', maxScore: 5, weight: 1, score: 3.8 },
    { criteriaCode: 'C3', criteriaName: 'Chat luong san pham va bao cao', maxScore: 3, weight: 1, score: 2.2 },
  ];

  await prisma.scoreSheet.upsert({
    where: {
      targetType_targetId_graderId_rubricRole: {
        targetType: 'PROJECT',
        targetId: learningAnalyticsProject.id,
        graderId: secondSupervisorLecturer.id,
        rubricRole: 'SUPERVISOR',
      },
    },
    update: {
      criteriaScores: learningSupervisorScores,
      rawTotal: 8.0,
      roundedTotal: 8.0,
      comment: 'Sinh vien chu dong xu ly du lieu va co san pham demo ro rang.',
      lockedAt: new Date(Date.now() - 10 * 60 * 60 * 1000),
    },
    create: {
      id: 'demo-score-learning-analytics-supervisor',
      mongoId: '64f100000000000000000603',
      rubricId: rubric.id,
      rubricRole: 'SUPERVISOR',
      rubricVersion: rubric.version,
      targetType: 'PROJECT',
      targetId: learningAnalyticsProject.id,
      projectId: learningAnalyticsProject.id,
      ownerType: 'student',
      ownerId: seededStudents[2].id,
      studentId: seededStudents[2].id,
      periodId: period.id,
      graderId: secondSupervisorLecturer.id,
      graderRole: 'SUPERVISOR',
      criteriaScores: learningSupervisorScores,
      rawTotal: 8.0,
      roundedTotal: 8.0,
      comment: 'Sinh vien chu dong xu ly du lieu va co san pham demo ro rang.',
      lockedAt: new Date(Date.now() - 10 * 60 * 60 * 1000),
    },
  });

  await prisma.scoreSheet.upsert({
    where: {
      targetType_targetId_graderId_rubricRole: {
        targetType: 'PROJECT',
        targetId: learningAnalyticsProject.id,
        graderId: reviewerLecturer.id,
        rubricRole: 'REVIEWER',
      },
    },
    update: {
      criteriaScores: learningReviewerScores,
      rawTotal: 7.6,
      roundedTotal: 7.6,
      comment: 'Huong tiep can co them so sanh voi baseline va mo ta tap du lieu.',
      lockedAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
    },
    create: {
      id: 'demo-score-learning-analytics-reviewer',
      mongoId: '64f100000000000000000604',
      rubricId: rubric.id,
      rubricRole: 'REVIEWER',
      rubricVersion: rubric.version,
      targetType: 'PROJECT',
      targetId: learningAnalyticsProject.id,
      projectId: learningAnalyticsProject.id,
      ownerType: 'student',
      ownerId: seededStudents[2].id,
      studentId: seededStudents[2].id,
      periodId: period.id,
      graderId: reviewerLecturer.id,
      graderRole: 'REVIEWER',
      criteriaScores: learningReviewerScores,
      rawTotal: 7.6,
      roundedTotal: 7.6,
      comment: 'Huong tiep can co them so sanh voi baseline va mo ta tap du lieu.',
      lockedAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
    },
  });

  const learningFinalGrade = await prisma.finalGrade.upsert({
    where: { projectId: learningAnalyticsProject.id },
    update: {
      componentScores: { supervisor: 8.0, reviewer: 7.6 },
      finalScore: 7.8,
      letterGrade: 'B',
      passStatus: 'passed',
      publishedAt: new Date(),
    },
    create: {
      id: 'demo-final-learning-analytics',
      mongoId: '64f100000000000000000702',
      projectId: learningAnalyticsProject.id,
      ownerType: 'student',
      ownerId: seededStudents[2].id,
      studentId: seededStudents[2].id,
      periodId: period.id,
      evaluationMode: 'standard',
      componentScores: { supervisor: 8.0, reviewer: 7.6 },
      finalScore: 7.8,
      letterGrade: 'B',
      passStatus: 'passed',
      varianceFlags: [],
      formulaVersion: rubric.version,
      publishedAt: new Date(),
    },
  });

  const hoangAnhTopic = await prisma.projectTopic.upsert({
    where: { id: 'demo-topic-library-booking' },
    update: {
      studentId: studentProfile.id,
      ownerId: studentProfile.id,
      proposedByStudentId: studentProfile.id,
      supervisorId: supervisorLecturer.id,
      status: 'assigned',
    },
    create: {
      id: 'demo-topic-library-booking',
      mongoId: '64f100000000000000000203',
      periodId: period.id,
      ownerType: 'student',
      ownerId: studentProfile.id,
      studentId: studentProfile.id,
      proposedByStudentId: studentProfile.id,
      createdByRole: 'student',
      createdByUserId: studentUser.id,
      approvedByLecturerId: supervisorLecturer.id,
      title: 'He thong dat lich phong tu hoc va thiet bi thu vien',
      summary: 'Ung dung giup sinh vien dat phong tu hoc, muon thiet bi va nhan thong bao lich su dung.',
      objectives: 'Quan ly lich dat phong, tranh trung lich va tao bao cao tan suat su dung tai nguyen.',
      scope: 'Prototype cho thu vien khoa, gom dat lich, phe duyet va thong bao.',
      technologies: ['Next.js', 'Express', 'PostgreSQL'],
      expectedResult: 'Sinh vien co the dat lich, can bo thu vien co the duyet va thong ke su dung.',
      plan: 'Phan tich quy trinh; thiet ke lich dat; xay API; kiem thu voi du lieu mau.',
      keywords: ['booking', 'library', 'notification'],
      academicUnit: 'computer_science',
      topicDomain: 'software_development',
      supervisorId: supervisorLecturer.id,
      departmentId,
      status: 'assigned',
      approvedBy: supervisorLecturer.id,
      approvedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
      capacityMaxStudents: 1,
      capacityMaxGroups: 0,
      currentStudentCount: 1,
    },
  });

  const hoangAnhProject = await prisma.project.upsert({
    where: { id: 'demo-project-library-booking' },
    update: {
      reviewerId: reviewerLecturer.id,
      status: 'in_progress',
    },
    create: {
      id: 'demo-project-library-booking',
      mongoId: '64f100000000000000000303',
      periodId: period.id,
      ownerType: 'student',
      ownerId: studentProfile.id,
      studentId: studentProfile.id,
      topicId: hoangAnhTopic.id,
      supervisorId: supervisorLecturer.id,
      reviewerId: reviewerLecturer.id,
      status: 'in_progress',
    },
  });

  await prisma.milestone.upsert({
    where: { id: 'demo-milestone-library-booking-progress' },
    update: {
      status: 'needs_revision',
      submissions: [
        {
          submittedBy: {
            id: studentUser.id,
            fullName: studentUser.fullName,
            email: studentUser.email,
          },
          fileIds: [],
          note: 'Em da nop ban prototype man hinh dat phong va luong phe duyet lich.',
          submittedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
      feedback: [
        {
          by: supervisorUser.id,
          status: 'needs_revision',
          comment: 'Can bo sung sequence diagram va luong xu ly khi huy lich.',
          createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
    },
    create: {
      id: 'demo-milestone-library-booking-progress',
      mongoId: '64f100000000000000000402',
      projectId: hoangAnhProject.id,
      title: 'Bao cao tien do dat lich thu vien',
      description: 'Nop prototype, mo ta luong dat phong va ke hoach hoan thien QR check-in.',
      deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      status: 'needs_revision',
      submissions: [
        {
          submittedBy: {
            id: studentUser.id,
            fullName: studentUser.fullName,
            email: studentUser.email,
          },
          fileIds: [],
          note: 'Em da nop ban prototype man hinh dat phong va luong phe duyet lich.',
          submittedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
      feedback: [
        {
          by: supervisorUser.id,
          status: 'needs_revision',
          comment: 'Can bo sung sequence diagram va luong xu ly khi huy lich.',
          createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
    },
  });

  await prisma.submissionPackage.upsert({
    where: { id: 'demo-submission-library-booking-progress' },
    update: {
      status: 'needs_revision',
      submittedBy: studentUser.id,
      reviewedBy: supervisorUser.id,
      reviewNotes: 'Can bo sung sequence diagram va luong xu ly khi huy lich.',
    },
    create: {
      id: 'demo-submission-library-booking-progress',
      mongoId: '64f100000000000000000503',
      ownerType: 'student',
      ownerId: hoangAnhProject.id,
      studentId: studentProfile.id,
      projectOwnerType: 'student',
      projectOwnerId: studentProfile.id,
      periodId: period.id,
      phase: 'progress',
      deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      status: 'needs_revision',
      items: [
        { type: 'progress_report', name: 'Bao cao tien do tuan 4', status: 'submitted' },
        { type: 'prototype_url', name: 'Link prototype dat phong', status: 'needs_revision' },
      ],
      submittedBy: studentUser.id,
      submittedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      reviewedBy: supervisorUser.id,
      reviewedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      reviewNotes: 'Can bo sung sequence diagram va luong xu ly khi huy lich.',
    },
  });

  const librarySupervisorScores = [
    { criteriaCode: 'C1', criteriaName: 'Y thuc thai do lam viec', maxScore: 2, weight: 1, score: 1.5 },
    { criteriaCode: 'C2', criteriaName: 'Kha nang hoan thanh nhiem vu', maxScore: 4, weight: 1, score: 3.0 },
    { criteriaCode: 'C3', criteriaName: 'Chat luong tai lieu bao cao', maxScore: 4, weight: 1, score: 2.8 },
  ];
  const libraryReviewerScores = [
    { criteriaCode: 'C1', criteriaName: 'Tinh thoi su, thuc tien cua de tai', maxScore: 2, weight: 1, score: 1.5 },
    { criteriaCode: 'C2', criteriaName: 'Muc do giai quyet yeu cau dat ra', maxScore: 5, weight: 1, score: 3.4 },
    { criteriaCode: 'C3', criteriaName: 'Chat luong san pham va bao cao', maxScore: 3, weight: 1, score: 2.0 },
  ];

  await prisma.scoreSheet.upsert({
    where: {
      targetType_targetId_graderId_rubricRole: {
        targetType: 'PROJECT',
        targetId: hoangAnhProject.id,
        graderId: supervisorLecturer.id,
        rubricRole: 'SUPERVISOR',
      },
    },
    update: {
      criteriaScores: librarySupervisorScores,
      rawTotal: 7.3,
      roundedTotal: 7.3,
      comment: 'Tien do on, can hoan thien them tai lieu thiet ke va xu ly ngoai le.',
      lockedAt: new Date(Date.now() - 9 * 60 * 60 * 1000),
    },
    create: {
      id: 'demo-score-library-booking-supervisor',
      mongoId: '64f100000000000000000605',
      rubricId: rubric.id,
      rubricRole: 'SUPERVISOR',
      rubricVersion: rubric.version,
      targetType: 'PROJECT',
      targetId: hoangAnhProject.id,
      projectId: hoangAnhProject.id,
      ownerType: 'student',
      ownerId: studentProfile.id,
      studentId: studentProfile.id,
      periodId: period.id,
      graderId: supervisorLecturer.id,
      graderRole: 'SUPERVISOR',
      criteriaScores: librarySupervisorScores,
      rawTotal: 7.3,
      roundedTotal: 7.3,
      comment: 'Tien do on, can hoan thien them tai lieu thiet ke va xu ly ngoai le.',
      lockedAt: new Date(Date.now() - 9 * 60 * 60 * 1000),
    },
  });

  await prisma.scoreSheet.upsert({
    where: {
      targetType_targetId_graderId_rubricRole: {
        targetType: 'PROJECT',
        targetId: hoangAnhProject.id,
        graderId: reviewerLecturer.id,
        rubricRole: 'REVIEWER',
      },
    },
    update: {
      criteriaScores: libraryReviewerScores,
      rawTotal: 6.9,
      roundedTotal: 6.9,
      comment: 'Y tuong kha thuc te, can chung minh ro hon luong check-in QR.',
      lockedAt: new Date(Date.now() - 7 * 60 * 60 * 1000),
    },
    create: {
      id: 'demo-score-library-booking-reviewer',
      mongoId: '64f100000000000000000606',
      rubricId: rubric.id,
      rubricRole: 'REVIEWER',
      rubricVersion: rubric.version,
      targetType: 'PROJECT',
      targetId: hoangAnhProject.id,
      projectId: hoangAnhProject.id,
      ownerType: 'student',
      ownerId: studentProfile.id,
      studentId: studentProfile.id,
      periodId: period.id,
      graderId: reviewerLecturer.id,
      graderRole: 'REVIEWER',
      criteriaScores: libraryReviewerScores,
      rawTotal: 6.9,
      roundedTotal: 6.9,
      comment: 'Y tuong kha thuc te, can chung minh ro hon luong check-in QR.',
      lockedAt: new Date(Date.now() - 7 * 60 * 60 * 1000),
    },
  });

  await prisma.finalGrade.upsert({
    where: { projectId: hoangAnhProject.id },
    update: {
      componentScores: { supervisor: 7.3, reviewer: 6.9 },
      finalScore: 7.1,
      letterGrade: 'B',
      passStatus: 'passed',
      publishedAt: new Date(),
    },
    create: {
      id: 'demo-final-library-booking',
      mongoId: '64f100000000000000000703',
      projectId: hoangAnhProject.id,
      ownerType: 'student',
      ownerId: studentProfile.id,
      studentId: studentProfile.id,
      periodId: period.id,
      evaluationMode: 'standard',
      componentScores: { supervisor: 7.3, reviewer: 6.9 },
      finalScore: 7.1,
      letterGrade: 'B',
      passStatus: 'passed',
      varianceFlags: [],
      formulaVersion: rubric.version,
      publishedAt: new Date(),
    },
  });

  await prisma.topicChangeRequest.upsert({
    where: { id: '64f100000000000000000801' },
    update: {
      status: 'pending',
      newTitle: 'He thong dat lich phong tu hoc tich hop QR check-in',
      supervisorApproval: { status: 'pending', note: '' },
      facultyApproval: { status: 'pending', note: '' },
    },
    create: {
      id: '64f100000000000000000801',
      mongoId: '64f100000000000000000801',
      topicId: hoangAnhTopic.id,
      ownerType: 'student',
      ownerId: studentProfile.id,
      studentId: studentProfile.id,
      oldTitle: hoangAnhTopic.title,
      newTitle: 'He thong dat lich phong tu hoc tich hop QR check-in',
      newScope: 'Bo sung chuc nang QR check-in va ghi nhan lich su vao/ra phong tu hoc.',
      newPlan: 'Cap nhat model lich dat; them API check-in; them man hinh QR; kiem thu voi 20 luot dat mau.',
      reason: 'Sau khi khao sat thu vien, nhu cau xac thuc sinh vien den dung lich quan trong hon chuc nang muon thiet bi.',
      supervisorApproval: { status: 'pending', note: '' },
      facultyApproval: { status: 'pending', note: '' },
      requestedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      status: 'pending',
    },
  });

  await prisma.topicChangeRequest.upsert({
    where: { id: '64f100000000000000000802' },
    update: {
      status: 'approved',
      supervisorApproval: {
        status: 'approved',
        note: 'Huong dieu chinh hop ly voi du lieu hien co.',
        reviewedBy: secondSupervisorUser.id,
        reviewedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
      facultyApproval: {
        status: 'approved',
        note: 'Dong y cho sinh vien dieu chinh pham vi.',
        reviewedBy: staffUser.id,
        reviewedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
    },
    create: {
      id: '64f100000000000000000802',
      mongoId: '64f100000000000000000802',
      topicId: individualTopic.id,
      ownerType: 'student',
      ownerId: seededStudents[2].id,
      studentId: seededStudents[2].id,
      oldTitle: individualTopic.title,
      newTitle: 'Phan tich du lieu hoc tap va goi y canh bao som tre tien do',
      newScope: 'Tap trung vao dashboard canh bao va goi y hanh dong thay vi mo hinh du doan diem tong quat.',
      newPlan: 'Tinh lai bo chi so rui ro; bo sung rule-based recommendation; cap nhat dashboard va bao cao danh gia.',
      reason: 'Du lieu diem qua it, trong khi log nop bai va phan hoi du de canh bao tre tien do.',
      supervisorApproval: {
        status: 'approved',
        note: 'Huong dieu chinh hop ly voi du lieu hien co.',
        reviewedBy: secondSupervisorUser.id,
        reviewedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
      facultyApproval: {
        status: 'approved',
        note: 'Dong y cho sinh vien dieu chinh pham vi.',
        reviewedBy: staffUser.id,
        reviewedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
      requestedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      status: 'approved',
    },
  });

  const demoNotificationIds = [
    'demo-notification-milestone-feedback',
    'demo-notification-final-grade',
    'demo-notification-review-assigned',
  ];

  await prisma.notification.updateMany({
    where: {
      id: { notIn: demoNotificationIds },
      entityId: {
        in: [milestone.id, finalGrade.id, individualTopic.id],
      },
    },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: staffUser.id,
    },
  });

  await prisma.notification.upsert({
    where: { id: 'demo-notification-milestone-feedback' },
    update: {
      recipientId: seededStudents[0].userId,
      type: 'MILESTONE_FEEDBACK',
      title: 'Giang vien da phan hoi moc nop de cuong',
      body: 'De cuong da duoc chap nhan, nhom can bo sung tieu chi nghiem thu cho tung module.',
      entityType: 'Milestone',
      entityId: milestone.id,
      actionUrl: '/dashboard/submissions',
      readAt: null,
      isDeleted: false,
      deletedAt: null,
      deletedBy: null,
    },
    create: {
      id: 'demo-notification-milestone-feedback',
      recipientId: seededStudents[0].userId,
      type: 'MILESTONE_FEEDBACK',
      title: 'Giang vien da phan hoi moc nop de cuong',
      body: 'De cuong da duoc chap nhan, nhom can bo sung tieu chi nghiem thu cho tung module.',
      entityType: 'Milestone',
      entityId: milestone.id,
      actionUrl: '/dashboard/submissions',
    },
  });

  await prisma.notification.upsert({
    where: { id: 'demo-notification-final-grade' },
    update: {
      recipientId: seededStudents[1].userId,
      type: 'FINAL_GRADE_PUBLISHED',
      title: 'Diem tong ket da duoc cong bo',
      body: `Nhom Smart Campus dat ${finalGrade.finalScore} (${finalGrade.letterGrade}).`,
      entityType: 'FinalGrade',
      entityId: finalGrade.id,
      actionUrl: '/dashboard/scores',
      readAt: null,
      isDeleted: false,
      deletedAt: null,
      deletedBy: null,
    },
    create: {
      id: 'demo-notification-final-grade',
      recipientId: seededStudents[1].userId,
      type: 'FINAL_GRADE_PUBLISHED',
      title: 'Diem tong ket da duoc cong bo',
      body: `Nhom Smart Campus dat ${finalGrade.finalScore} (${finalGrade.letterGrade}).`,
      entityType: 'FinalGrade',
      entityId: finalGrade.id,
      actionUrl: '/dashboard/scores',
    },
  });

  await prisma.notification.upsert({
    where: { id: 'demo-notification-review-assigned' },
    update: {
      recipientId: reviewerUser.id,
      type: 'REVIEW_ASSIGNED',
      title: 'Co de tai moi can phan bien',
      body: 'Ban da duoc phan cong phan bien de tai Phan tich du lieu hoc tap.',
      entityType: 'ProjectTopic',
      entityId: individualTopic.id,
      actionUrl: '/dashboard/projects',
      readAt: null,
      isDeleted: false,
      deletedAt: null,
      deletedBy: null,
    },
    create: {
      id: 'demo-notification-review-assigned',
      recipientId: reviewerUser.id,
      type: 'REVIEW_ASSIGNED',
      title: 'Co de tai moi can phan bien',
      body: 'Ban da duoc phan cong phan bien de tai Phan tich du lieu hoc tap.',
      entityType: 'ProjectTopic',
      entityId: individualTopic.id,
      actionUrl: '/dashboard/projects',
    },
  });

  console.log('Seeded realistic demo topics, projects, submissions, scores and notifications.');

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
