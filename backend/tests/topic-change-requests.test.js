process.env.NODE_ENV = process.env.NODE_ENV || 'test';
require('../config/env').loadEnv();

const { app } = require('../app');
const {
  db,
  newObjectId,
  User,
  Lecturer,
  Student,
  ProjectPeriod,
  ProjectRoster,
  ProjectGroup,
  ProjectTopic,
  Project,
  TopicChangeRequest,
  WorkflowEvent
} = require('./db-compat');
const prisma = require('../config/prisma');

const TEST_PORT = 5012;

const runIntegrationTests = async () => {
  const server = app.listen(TEST_PORT, async () => {
    console.log(`\n🚀 Temporary integration test server listening on port ${TEST_PORT}...`);

    try {
      // 1. Resolve and prepare mock state
      console.log('\n--- Test 0: Resolving database dependencies and preparing project workspace ---');

      // Resolve Supervisor: Kiều Tuấn Hải
      const supervisorUser = await User.findOne({ email: 'haikt@hust.edu.vn' });
      if (!supervisorUser) throw new Error('❌ Supervisor Kiều Tuấn Hải not found.');
      const supervisorLecturer = await Lecturer.findOne({ userId: supervisorUser._id });
      if (!supervisorLecturer) throw new Error('❌ Supervisor Lecturer profile not found.');

      // Resolve Student: Hoàng Anh
      const studentUser = await User.findOne({ email: 'hoanganh@hust.edu.vn' });
      if (!studentUser) throw new Error('❌ Student Hoàng Anh not found.');
      const studentProfile = await Student.findOne({ userId: studentUser._id });
      if (!studentProfile) throw new Error('❌ Student profile not found.');

      // Resolve Staff: Lê Thị Hương
      const staffUser = await User.findOne({ email: 'huonglt@hust.edu.vn' });
      if (!staffUser) throw new Error('❌ Staff Lê Thị Hương not found.');

      // Find or create Project Period
      let period = await ProjectPeriod.findOne({ name: 'Đợt Đồ Án Tốt Nghiệp Kỳ 2025.2' });
      if (period) {
        period.topicChangeDeadline = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
        period.projectEnd = new Date(Date.now() + 120 * 24 * 60 * 60 * 1000);
        await period.save();
      } else {
        period = await ProjectPeriod.create({
          name: 'Đợt Đồ Án Tốt Nghiệp Kỳ 2025.2',
          schoolYear: '2025-2026',
          semester: 'Học kỳ II',
          type: 'foundation_project',
          facultyId: supervisorLecturer.facultyId,
          departmentId: supervisorLecturer.departmentId,
          registrationStart: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
          registrationEnd: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          topicChangeDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          projectStart: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
          projectEnd: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000),
          finalSubmissionDeadline: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000),
          gradingStart: new Date(Date.now() + 110 * 24 * 60 * 60 * 1000),
          gradingEnd: new Date(Date.now() + 115 * 24 * 60 * 60 * 1000),
          revisionDeadline: new Date(Date.now() + 118 * 24 * 60 * 60 * 1000),
          archiveDeadline: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000),
          minGroupSize: 1,
          maxGroupSize: 3,
          rubricVersion: 'v1.0-IT-HUST',
          scoringFormula: { supervisor: 0.5, reviewer: 0.5 },
          status: 'in_progress',
        });
      }

      await prisma.projectPeriod.upsert({
        where: { id: period._id.toString() },
        create: {
          id: period._id.toString(),
          mongoId: period._id.toString(),
          name: period.name,
          schoolYear: period.schoolYear,
          semester: period.semester,
          type: period.type,
          facultyId: period.facultyId.toString(),
          departmentId: period.departmentId.toString(),
          registrationStart: period.registrationStart,
          registrationEnd: period.registrationEnd,
          projectStart: period.projectStart,
          projectEnd: period.projectEnd,
          topicChangeDeadline: period.topicChangeDeadline,
          scoringFormula: period.scoringFormula || {},
          rubricVersion: period.rubricVersion,
          status: period.status
        },
        update: {
          projectEnd: period.projectEnd,
          topicChangeDeadline: period.topicChangeDeadline
        }
      });

      // Register student in roster
      await ProjectRoster.findOneAndUpdate(
        { periodId: period._id, studentId: studentProfile._id },
        { classSection: 'IT4911', status: 'active', importedBy: staffUser._id },
        { upsert: true }
      );

      // Clean up previous runs
      await ProjectGroup.deleteMany({ periodId: period._id });
      await ProjectTopic.deleteMany({ periodId: period._id });
      await Project.deleteMany({ periodId: period._id });
      await TopicChangeRequest.deleteMany({});
      await prisma.topicChangeRequest.deleteMany({ where: {} });
      await prisma.project.deleteMany({ where: { periodId: period._id.toString() } });
      await prisma.projectTopic.deleteMany({ where: { periodId: period._id.toString() } });
      await prisma.projectGroup.deleteMany({ where: { periodId: period._id.toString() } });
      console.log('✅ Cleaned up old database records.');

      // Create valid Project Group
      const group = await ProjectGroup.create({
        periodId: period._id,
        name: 'IT-Group-Gamma',
        leaderStudentId: studentProfile._id,
        members: [{ studentId: studentProfile._id, role: 'LEADER', status: 'accepted', contributionWeight: 1.0 }],
        status: 'locked'
      });
      await prisma.projectGroup.create({
        data: {
          id: group._id.toString(),
          mongoId: group._id.toString(),
          periodId: group.periodId.toString(),
          name: group.name,
          leaderStudentId: group.leaderStudentId.toString(),
          members: group.members,
          status: group.status,
        }
      });

      // Create valid Topic
      const topic = await ProjectTopic.create({
        periodId: period._id,
        groupId: group._id,
        proposedByStudentId: studentProfile._id,
        title: 'Thiết kế website bán hàng tích hợp AI',
        summary: 'Website bán hàng thời trang.',
        objectives: 'Mục tiêu...',
        scope: 'Khoa CNTT',
        expectedResult: 'Hệ thống...',
        plan: 'Kế hoạch ban đầu...',
        proposedSupervisorId: supervisorLecturer._id,
        supervisorId: supervisorLecturer._id,
        departmentId: period.departmentId,
        status: 'assigned'
      });
      await prisma.projectTopic.create({
        data: {
          id: topic._id.toString(),
          mongoId: topic._id.toString(),
          periodId: topic.periodId.toString(),
          groupId: topic.groupId.toString(),
          proposedByStudentId: topic.proposedByStudentId.toString(),
          title: topic.title,
          summary: topic.summary,
          objectives: topic.objectives,
          scope: topic.scope,
          expectedResult: topic.expectedResult,
          plan: topic.plan,
          proposedSupervisorId: topic.proposedSupervisorId.toString(),
          supervisorId: topic.supervisorId.toString(),
          departmentId: topic.departmentId.toString(),
          status: topic.status,
        }
      });

      // Create official Project Workspace in in_progress
      const project = await Project.create({
        periodId: period._id,
        groupId: group._id,
        topicId: topic._id,
        supervisorId: supervisorLecturer._id,
        status: 'in_progress'
      });
      await prisma.project.create({
        data: {
          id: project._id.toString(),
          mongoId: project._id.toString(),
          periodId: project.periodId.toString(),
          groupId: project.groupId.toString(),
          topicId: project.topicId.toString(),
          supervisorId: project.supervisorId.toString(),
          status: project.status,
        }
      });
      const projectId = project._id;
      console.log(`Prepared Project Workspace ID: ${projectId} (Status: ${project.status})`);

      // 2. Authentication
      console.log('\n--- Test 1: Logging in test actors ---');
      const loginActor = async (email, password) => {
        const res = await fetch(`http://localhost:${TEST_PORT}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const result = await res.json();
        if (!result.success) throw new Error(`Failed login for ${email}`);
        return result.data.accessToken;
      };

      const tokenStudent = await loginActor('hoanganh@hust.edu.vn', 'password123');
      const tokenSupervisor = await loginActor('haikt@hust.edu.vn', 'password123');
      const tokenStaff = await loginActor('huonglt@hust.edu.vn', 'password123');
      console.log('✅ Access tokens acquired successfully.');

      // 3. Create Topic Change Request
      console.log('\n--- Test 2: POST /api/v1/topics/:id/change-requests (Student creates topic change request) ---');
      const changePayload = {
        newTitle: 'Thiết kế website bán hàng thời trang tích hợp chatbot AI thông minh',
        newScope: 'Doanh nghiệp thời trang vừa và nhỏ tại Hà Nội',
        newPlan: 'Tuần 1-3: Khảo sát, thiết kế. Tuần 4-10: Cài đặt. Tuần 11-14: Tích hợp chatbot AI.',
        reason: 'Để làm nổi bật tính ứng dụng của AI hỗ trợ mua sắm trực tuyến.'
      };

      const createRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/topics/${topic._id}/change-requests`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenStudent}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(changePayload)
      });

      const createResult = await createRes.json();
      console.log('HTTP Status:', createRes.status);
      if (!createResult.success || !createResult.data._id) {
        throw new Error(`❌ Test 2 Failed: Request creation failed. Msg: ${createResult.message}`);
      }
      const requestId = createResult.data._id;
      console.log(`✅ Test 2 Passed: Topic change request created. Status: ${createResult.data.status}, ID: ${requestId}`);

      // 4. Read Change Requests
      console.log('\n--- Test 3: GET /api/v1/topic-change-requests and /:id (Student queries requests) ---');
      const listRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/topic-change-requests`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${tokenStudent}` }
      });
      const listResult = await listRes.json();
      console.log('GET list HTTP Status:', listRes.status);
      if (!listResult.success || listResult.data.length === 0) {
        throw new Error('❌ Test 3 Failed: List requests is empty.');
      }

      const getOneRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/topic-change-requests/${requestId}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${tokenStudent}` }
      });
      const getOneResult = await getOneRes.json();
      console.log('GET single request HTTP Status:', getOneRes.status);
      if (!getOneResult.success || getOneResult.data._id !== requestId) {
        throw new Error('❌ Test 3 Failed: Could not get request by ID.');
      }
      console.log('✅ Test 3 Passed: Request queried successfully.');

      // 5. Supervisor Recommendation
      console.log('\n--- Test 4: POST /api/v1/topic-change-requests/:id/supervisor-approve (Supervisor approves) ---');
      const supervisorRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/topic-change-requests/${requestId}/supervisor-approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenSupervisor}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ note: 'GVHD nhất trí đề xuất thay đổi đề tài vì tính thực tiễn cao.' })
      });
      const supervisorResult = await supervisorRes.json();
      console.log('Supervisor Approve HTTP Status:', supervisorRes.status);
      if (!supervisorResult.success || supervisorResult.data.supervisorApproval.status !== 'approved') {
        throw new Error(`❌ Test 4 Failed: Supervisor approval failed. Msg: ${supervisorResult.message}`);
      }
      console.log('✅ Test 4 Passed: Supervisor recommended approval successfully.');

      // 6. Faculty Final Approval
      console.log('\n--- Test 5: POST /api/v1/topic-change-requests/:id/faculty-approve (Faculty Staff approves) ---');
      const facultyRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/topic-change-requests/${requestId}/faculty-approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenStaff}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ note: 'Khoa phê duyệt đổi tên đề tài theo đề xuất của GVHD.' })
      });
      const facultyResult = await facultyRes.json();
      console.log('Faculty Approve HTTP Status:', facultyRes.status);
      if (!facultyResult.success || facultyResult.data.status !== 'approved') {
        throw new Error(`❌ Test 5 Failed: Faculty final approval failed. Msg: ${facultyResult.message}`);
      }
      console.log('✅ Test 5 Passed: Faculty officially approved the change request.');

      // 7. Database verification
      console.log('\n--- Test 6: Verify changes applied in ProjectTopic and Project versions ---');
      const updatedTopic = await ProjectTopic.findById(topic._id);
      console.log('Original Title: Thiết kế website bán hàng tích hợp AI');
      console.log('New Title in DB:', updatedTopic.title);
      console.log('Topic Status in DB:', updatedTopic.status);
      console.log('Topic Version in DB:', updatedTopic.version);

      if (updatedTopic.title !== changePayload.newTitle || updatedTopic.status !== 'changed') {
        throw new Error('❌ Test 6 Failed: Topic was not updated in DB.');
      }

      const updatedProject = await Project.findById(project._id);
      if (updatedProject.version !== 2) {
        throw new Error(`❌ Test 6 Failed: Project version was not incremented (Current version: ${updatedProject.version}).`);
      }

      // Check Workflow Event log
      const event = await WorkflowEvent.findOne({ entityId: topic._id, action: 'APPLY_TOPIC_CHANGE' });
      if (!event) {
        throw new Error('❌ Test 6 Failed: APPLY_TOPIC_CHANGE WorkflowEvent log was not created.');
      }
      console.log('✅ Test 6 Passed: Database states and WorkflowEvent are correct.');

      // 8. Cancel request flow
      console.log('\n--- Test 7: Student cancels pending request ---');
      const secondPayload = {
        newTitle: 'Một đề tài khác nữa',
        newScope: 'Phạm vi',
        newPlan: 'Kế hoạch',
        reason: 'Lý do'
      };

      const secondCreateRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/topics/${topic._id}/change-requests`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenStudent}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(secondPayload)
      });
      const secondCreateResult = await secondCreateRes.json();
      const secondRequestId = secondCreateResult.data._id;

      const cancelRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/topic-change-requests/${secondRequestId}/cancel`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenStudent}` }
      });
      const cancelResult = await cancelRes.json();
      console.log('Cancel HTTP Status:', cancelRes.status);
      if (!cancelResult.success || cancelResult.data.status !== 'cancelled') {
        throw new Error(`❌ Test 7 Failed: Cancel request failed. Msg: ${cancelResult.message}`);
      }
      console.log('✅ Test 7 Passed: Successfully cancelled the pending request.');

      console.log('\n🎉 ALL TOPIC CHANGE REQUESTS INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉');
    } catch (error) {
      console.error('\n❌ Integration Test Suite Failed:', error.message);
      if (error.stack) console.error(error.stack);
      process.exitCode = 1;
    } finally {
      console.log('\n--- Shutting Down Test Environment ---');
      server.close(async () => {
        console.log('✅ Temporary test server shut down.');
        await db.disconnect();
        console.log('✅ Compatibility DB connection closed.');
        process.exit(process.exitCode || 0);
      });
    }
  });
};

runIntegrationTests();
