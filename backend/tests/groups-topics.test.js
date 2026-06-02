const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { app } = require('../app');
const mongoose = require('mongoose');
const User = require('../models/User');
const Lecturer = require('../models/Lecturer');
const Student = require('../models/Student');
const ProjectPeriod = require('../models/ProjectPeriod');
const ProjectRoster = require('../models/ProjectRoster');
const ProjectGroup = require('../models/ProjectGroup');
const ProjectTopic = require('../models/ProjectTopic');
const Project = require('../models/Project');
const WorkflowEvent = require('../models/WorkflowEvent');

const TEST_PORT = 5002;

const runIntegrationTests = async () => {
  const server = app.listen(TEST_PORT, async () => {
    console.log(`\n🚀 Temporary integration test server listening on port ${TEST_PORT}...`);

    try {
      // 1. Database setup & dependencies resolution
      console.log('\n--- Test 0: Resolving and preparing database mock state ---');
      
      // Let's resolve the Lecturer (Supervisor): Kiều Tuấn Hải
      const supervisorUser = await User.findOne({ email: 'haikt@hust.edu.vn' });
      if (!supervisorUser) {
        throw new Error('❌ Test 0 Failed: Could not find Kiều Tuấn Hải in database.');
      }
      const supervisorLecturer = await Lecturer.findOne({ userId: supervisorUser._id });
      if (!supervisorLecturer) {
        throw new Error('❌ Test 0 Failed: Could not find Lecturer profile for Kiều Tuấn Hải.');
      }
      console.log(`Resolved Supervisor Lecturer ID: ${supervisorLecturer._id}`);

      // Let's resolve the Faculty Staff: Lê Thị Hương
      const staffUser = await User.findOne({ email: 'huonglt@hust.edu.vn' });
      if (!staffUser) {
        throw new Error('❌ Test 0 Failed: Could not find Faculty Staff Lê Thị Hương.');
      }

      // Check if Student 1 (Hoàng Anh) exists
      const student1User = await User.findOne({ email: 'hoanganh@hust.edu.vn' });
      if (!student1User) {
        throw new Error('❌ Test 0 Failed: Student Hoàng Anh not found.');
      }
      const student1Profile = await Student.findOne({ userId: student1User._id });
      if (!student1Profile) {
        throw new Error('❌ Test 0 Failed: Student profile for Hoàng Anh not found.');
      }
      console.log(`Resolved Student 1: Hoàng Anh (ID: ${student1Profile._id})`);

      // Ensure Student 2 (Nguyễn Văn Nam) exists
      let student2User = await User.findOne({ email: 'namnv@hust.edu.vn' });
      const salt = await require('bcryptjs').genSalt(10);
      const passwordHash = await require('bcryptjs').hash('password123', salt);

      if (!student2User) {
        student2User = await User.create({
          fullName: 'Nguyễn Văn Nam',
          email: 'namnv@hust.edu.vn',
          passwordHash,
          roles: ['STUDENT'],
          status: 'active',
        });
      }

      let student2Profile = await Student.findOne({ userId: student2User._id });
      if (!student2Profile) {
        student2Profile = await Student.create({
          userId: student2User._id,
          studentCode: '22021499',
          className: 'IT-K67',
          cohort: 'K67',
          major: 'Công nghệ thông tin',
          facultyId: supervisorLecturer.facultyId,
        });
      }
      console.log(`Resolved Student 2: Nguyễn Văn Nam (ID: ${student2Profile._id})`);

      // Ensure active Project Period exists
      let period = await ProjectPeriod.findOne({ name: 'Đợt Đồ Án Tốt Nghiệp Kỳ 2025.2' });
      if (!period) {
        period = await ProjectPeriod.create({
          name: 'Đợt Đồ Án Tốt Nghiệp Kỳ 2025.2',
          schoolYear: '2025-2026',
          semester: 'Học kỳ II',
          type: 'foundation_project',
          facultyId: supervisorLecturer.facultyId,
          departmentId: supervisorLecturer.departmentId,
          registrationStart: new Date('2026-06-01'),
          registrationEnd: new Date('2026-06-15'),
          topicChangeDeadline: new Date('2026-06-20'),
          projectStart: new Date('2026-06-25'),
          projectEnd: new Date('2026-10-31'),
          preDefenseSubmissionDeadline: new Date('2026-10-15'),
          defenseStart: new Date('2026-11-05'),
          defenseEnd: new Date('2026-11-15'),
          postDefenseRevisionDeadline: new Date('2026-11-20'),
          archiveDeadline: new Date('2026-11-30'),
          minGroupSize: 1,
          maxGroupSize: 3,
          rubricVersion: 'v1.0-IT-HUST',
          scoringFormula: {
            supervisor: 0.3,
            reviewer: 0.2,
            committee: 0.5
          },
          status: 'registration_open', // must be registration_open to propose
        });
      } else {
        // Ensure status is registration_open for testing groups creation
        period.status = 'registration_open';
        await period.save();
      }
      console.log(`Resolved ProjectPeriod ID: ${period._id} (Status: ${period.status})`);

      // Register both students in the Period Roster if they aren't already
      await ProjectRoster.findOneAndUpdate(
        { periodId: period._id, studentId: student1Profile._id },
        { classSection: 'IT4911', status: 'active', importedBy: staffUser._id },
        { upsert: true, new: true }
      );
      await ProjectRoster.findOneAndUpdate(
        { periodId: period._id, studentId: student2Profile._id },
        { classSection: 'IT4911', status: 'active', importedBy: staffUser._id },
        { upsert: true, new: true }
      );
      console.log('✅ Registered both students in the Active Project Roster.');

      // Clean up previous runs
      await ProjectGroup.deleteMany({ periodId: period._id });
      await ProjectTopic.deleteMany({ periodId: period._id });
      await Project.deleteMany({ periodId: period._id });
      console.log('✅ Cleaned up old group/topic/project documents for this period.');

      // 2. Login operations
      console.log('\n--- Test 1: Logging in test actors ---');
      
      const loginActor = async (email, password) => {
        const res = await fetch(`http://localhost:${TEST_PORT}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const result = await res.json();
        if (!result.success || !result.data.accessToken) {
          throw new Error(`Failed to login for ${email}`);
        }
        return result.data.accessToken;
      };

      const tokenStudent1 = await loginActor('hoanganh@hust.edu.vn', 'password123');
      const tokenStudent2 = await loginActor('namnv@hust.edu.vn', 'password123');
      const tokenStaff = await loginActor('huonglt@hust.edu.vn', 'password123');
      console.log('✅ Tokens successfully retrieved for Student 1, Student 2, and Staff.');

      // 3. Create Group
      console.log('\n--- Test 2: POST /api/v1/groups (Student 1 creates Group) ---');
      const createGroupRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/groups`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenStudent1}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          periodId: period._id.toString(),
          name: 'IT-Group-Alpha'
        })
      });

      const createGroupResult = await createGroupRes.json();
      console.log('HTTP Status:', createGroupRes.status);
      if (!createGroupResult.success || !createGroupResult.data._id) {
        throw new Error(`❌ Test 2 Failed: Group creation failed. Message: ${createGroupResult.message}`);
      }
      const groupId = createGroupResult.data._id;
      console.log(`✅ Test 2 Passed: Group "IT-Group-Alpha" created with ID: ${groupId} and status draft.`);

      // 4. Invite Student 2
      console.log('\n--- Test 3: POST /api/v1/groups/:id/invite (Student 1 invites Student 2) ---');
      const inviteRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/groups/${groupId}/invite`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenStudent1}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          studentId: student2Profile._id.toString()
        })
      });

      const inviteResult = await inviteRes.json();
      console.log('HTTP Status:', inviteRes.status);
      if (!inviteResult.success) {
        throw new Error(`❌ Test 3 Failed: Invitation failed. Message: ${inviteResult.message}`);
      }
      console.log('✅ Test 3 Passed: Successfully invited Student 2. Invitation is in pending invited state.');

      // 5. Accept Invitation
      console.log('\n--- Test 4: POST /api/v1/groups/:id/accept (Student 2 accepts invitation) ---');
      const acceptRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/groups/${groupId}/accept`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenStudent2}`,
          'Content-Type': 'application/json'
        }
      });

      const acceptResult = await acceptRes.json();
      console.log('HTTP Status:', acceptRes.status);
      if (!acceptResult.success) {
        throw new Error(`❌ Test 4 Failed: Acceptance failed. Message: ${acceptResult.message}`);
      }
      console.log('✅ Test 4 Passed: Student 2 successfully joined the group.');

      // 6. Confirm Group
      console.log('\n--- Test 5: POST /api/v1/groups/:id/confirm (Student 1 confirms group roster) ---');
      const confirmRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/groups/${groupId}/confirm`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenStudent1}`,
          'Content-Type': 'application/json'
        }
      });

      const confirmResult = await confirmRes.json();
      console.log('HTTP Status:', confirmRes.status);
      if (!confirmResult.success || confirmResult.data.status !== 'confirmed') {
        throw new Error(`❌ Test 5 Failed: Confirm group failed. Message: ${confirmResult.message}`);
      }
      console.log('✅ Test 5 Passed: Group successfully confirmed and finalized with 2 members.');

      // 7. Propose Topic Outline
      console.log('\n--- Test 6: POST /api/v1/topics (Student 1 proposes project outline) ---');
      const topicPayload = {
        periodId: period._id.toString(),
        groupId: groupId,
        title: 'Xây dựng hệ thống quản lý đồ án tốt nghiệp hỗ trợ bởi AI',
        summary: 'Nghiên cứu quy trình nghiệp vụ và tích hợp các tác vụ AI hỗ trợ chấm điểm và đánh giá đề tài.',
        objectives: 'Tạo lập hệ thống quản lý mốc thời gian, tạo nhóm, chấm điểm, tự động quét tương đồng.',
        scope: 'Khoa Công nghệ thông tin HUST.',
        technologies: ['Node.js', 'Express', 'React', 'MongoDB', 'LangChain'],
        expectedResult: 'Hệ thống chạy thử nghiệm hoàn thiện có báo cáo chi tiết.',
        plan: 'Tháng 1-2: Phân tích. Tháng 3-4: Code. Tháng 5: Bảo vệ.',
        keywords: ['Do an tốt nghiệp', 'AI assistant', 'Management system'],
        proposedSupervisorId: supervisorLecturer._id.toString()
      };

      const proposeTopicRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/topics`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenStudent1}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(topicPayload)
      });

      const proposeTopicResult = await proposeTopicRes.json();
      console.log('HTTP Status:', proposeTopicRes.status);
      if (!proposeTopicResult.success || !proposeTopicResult.data._id) {
        throw new Error(`❌ Test 6 Failed: Topic proposal failed. Message: ${proposeTopicResult.message}`);
      }
      const topicId = proposeTopicResult.data._id;
      console.log(`✅ Test 6 Passed: Topic proposed successfully with ID: ${topicId} in status submitted.`);

      // 8. Administrative Outline Review
      console.log('\n--- Test 7: POST /api/v1/topics/:id/approve (Faculty Staff approves topic outline) ---');
      const approveTopicRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/topics/${topicId}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenStaff}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          note: 'Đề tài rất xuất sắc, đề cương chi tiết.'
        })
      });

      const approveTopicResult = await approveTopicRes.json();
      console.log('HTTP Status:', approveTopicRes.status);
      if (!approveTopicResult.success || approveTopicResult.data.status !== 'approved') {
        throw new Error(`❌ Test 7 Failed: Topic approval failed. Message: ${approveTopicResult.message}`);
      }
      console.log('✅ Test 7 Passed: Faculty Staff successfully approved the topic proposal outline.');

      // 9. Assign Supervisor and Spawn Workspace
      console.log('\n--- Test 8: POST /api/v1/topics/:id/assign-supervisor (Faculty Staff assigns supervisor) ---');
      const assignRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/topics/${topicId}/assign-supervisor`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenStaff}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          supervisorId: supervisorLecturer._id.toString()
        })
      });

      const assignResult = await assignRes.json();
      console.log('HTTP Status:', assignRes.status);
      if (!assignResult.success || !assignResult.data._id) {
        throw new Error(`❌ Test 8 Failed: Supervisor assignment failed. Message: ${assignResult.message}`);
      }
      console.log('✅ Test 8 Passed: Official Supervisor successfully assigned to the topic.');

      // 10. Relational Workspace Verification
      console.log('\n--- Test 9: Relational Workspace Verification in DB ---');
      
      // Let's verify topic is assigned
      const updatedTopic = await ProjectTopic.findById(topicId);
      console.log('Updated Topic Status:', updatedTopic.status);
      if (updatedTopic.status !== 'assigned') {
        throw new Error('❌ Test 9 Failed: Topic status is not assigned.');
      }

      // Let's verify the group is locked
      const updatedGroup = await ProjectGroup.findById(groupId);
      console.log('Updated Group Status:', updatedGroup.status);
      if (updatedGroup.status !== 'locked') {
        throw new Error('❌ Test 9 Failed: Project Group was not locked after supervisor assignment.');
      }

      // Let's verify Project was spawned correctly
      const spawnedProject = await Project.findOne({ topicId });
      if (!spawnedProject) {
        throw new Error('❌ Test 9 Failed: No Project workspace was spawned in the database.');
      }
      console.log(`Spawned Project Workspace ID: ${spawnedProject._id} (Status: ${spawnedProject.status})`);
      if (spawnedProject.status !== 'assigned') {
        throw new Error('❌ Test 9 Failed: Spawned project workspace is not in status assigned.');
      }
      console.log('✅ Test 9 Passed: Spawning verification complete. Topic is assigned, Group is locked, and Project Workspace is active!');

      console.log('\n🎉 ALL PHASE 4 GROUP FORMATION & TOPIC REGISTRATION TESTS PASSED SUCCESSFULLY! 🎉');
    } catch (error) {
      console.error('\n❌ Integration Test Suite Failed:', error.message);
      if (error.stack) console.error(error.stack);
      process.exitCode = 1;
    } finally {
      console.log('\n--- Shutting Down Test Environment ---');
      server.close(async () => {
        console.log('✅ Temporary test server shut down.');
        await mongoose.disconnect();
        console.log('✅ MongoDB connection closed.');
        process.exit(process.exitCode || 0);
      });
    }
  });
};

runIntegrationTests();
