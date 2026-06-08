const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { assertSafeTestDatabase } = require('./test-db-guard');
assertSafeTestDatabase();

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
const Committee = require('../models/Committee');
const DefenseSession = require('../models/DefenseSession');
const ScoreSheet = require('../models/ScoreSheet');
const FinalGrade = require('../models/FinalGrade');

const TEST_PORT = 5005;

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

      // Resolve Reviewer: Nguyễn Thị Hồng
      const reviewerUser = await User.findOne({ email: 'hongnt@hust.edu.vn' });
      if (!reviewerUser) throw new Error('❌ Reviewer Nguyễn Thị Hồng not found.');
      const reviewerLecturer = await Lecturer.findOne({ userId: reviewerUser._id });
      if (!reviewerLecturer) throw new Error('❌ Reviewer Lecturer profile not found.');

      // Resolve Staff: Lê Thị Hương
      const staffUser = await User.findOne({ email: 'huonglt@hust.edu.vn' });
      if (!staffUser) throw new Error('❌ Staff Lê Thị Hương not found.');
      const staffLecturer = await Lecturer.findOne({ userId: staffUser._id });
      if (!staffLecturer) throw new Error('❌ Staff Lecturer profile not found.');

      // Resolve Student: Hoàng Anh
      const studentUser = await User.findOne({ email: 'hoanganh@hust.edu.vn' });
      if (!studentUser) throw new Error('❌ Student Hoàng Anh not found.');
      const studentProfile = await Student.findOne({ userId: studentUser._id });
      if (!studentProfile) throw new Error('❌ Student profile not found.');

      // Dynamically create a 3rd Lecturer: Trần Văn Khánh
      let khanUser = await User.findOne({ email: 'khanhtv@hust.edu.vn' });
      if (!khanUser) {
        khanUser = await User.create({
          fullName: 'Trần Văn Khánh',
          email: 'khanhtv@hust.edu.vn',
          passwordHash: supervisorUser.passwordHash,
          roles: ['LECTURER'],
          status: 'active',
          isDeleted: false
        });
      } else {
        khanUser.passwordHash = supervisorUser.passwordHash;
        khanUser.status = 'active';
        khanUser.isDeleted = false;
        if (!khanUser.roles.includes('LECTURER')) {
          khanUser.roles.push('LECTURER');
        }
        await khanUser.save();
      }
      let khanLecturer = await Lecturer.findOne({ userId: khanUser._id });
      if (!khanLecturer) {
        khanLecturer = await Lecturer.create({
          userId: khanUser._id,
          lecturerCode: 'GV005',
          facultyId: supervisorLecturer.facultyId,
          departmentId: supervisorLecturer.departmentId,
          academicDegree: 'phd',
          expertise: ['Algorithms', 'Software Engineering'],
          maxProjects: 3,
          isExternal: false,
          organization: 'HUST',
          isDeleted: false
        });
      } else {
        khanLecturer.isDeleted = false;
        await khanLecturer.save();
      }

      // Find or create Project Period
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
          status: 'in_progress',
        });
      }

      // Clean up previous runs
      await ProjectGroup.deleteMany({ periodId: period._id });
      await ProjectTopic.deleteMany({ periodId: period._id });
      await Project.deleteMany({ periodId: period._id });
      await Committee.deleteMany({ periodId: period._id });
      await DefenseSession.deleteMany({});
      await ScoreSheet.deleteMany({ periodId: period._id });
      await FinalGrade.deleteMany({ periodId: period._id });
      console.log('✅ Cleaned up old database collections.');

      // Create valid Project Group
      const group = await ProjectGroup.create({
        periodId: period._id,
        name: 'IT-Group-Alpha',
        leaderStudentId: studentProfile._id,
        members: [{
          studentId: studentProfile._id,
          role: 'LEADER',
          status: 'accepted',
          contributionWeight: 1.0
        }],
        status: 'locked'
      });

      // Create valid Topic
      const topic = await ProjectTopic.create({
        periodId: period._id,
        groupId: group._id,
        proposedByStudentId: studentProfile._id,
        title: 'Xây dựng hệ thống quản lý đồ án tốt nghiệp hỗ trợ bởi AI',
        summary: 'Tóm tắt...',
        objectives: 'Mục tiêu...',
        scope: 'Khoa CNTT',
        expectedResult: 'Hệ thống...',
        plan: 'Kế hoạch...',
        proposedSupervisorId: supervisorLecturer._id,
        supervisorId: supervisorLecturer._id,
        departmentId: period.departmentId,
        status: 'assigned'
      });

      // Create official Project Workspace
      const project = await Project.create({
        periodId: period._id,
        groupId: group._id,
        topicId: topic._id,
        supervisorId: supervisorLecturer._id,
        reviewerId: reviewerLecturer._id,
        status: 'in_progress'
      });
      const projectId = project._id;
      console.log(`Prepared Project Workspace ID: ${projectId}`);

      // Logins
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

      const tokenStaff = await loginActor('huonglt@hust.edu.vn', 'password123');
      const tokenSupervisor = await loginActor('haikt@hust.edu.vn', 'password123');
      const tokenReviewer = await loginActor('hongnt@hust.edu.vn', 'password123');
      const tokenKhanh = await loginActor('khanhtv@hust.edu.vn', 'password123');
      console.log('✅ All actor access tokens retrieved.');

      // 2. Create and approve a valid Committee
      console.log('\n--- Test 1: POST /api/v1/committees (Create Committee) ---');
      const committeePayload = {
        periodId: period._id.toString(),
        name: 'Hội đồng chấm HĐ-CNTT-01',
        evaluationMode: 'defense',
        members: [
          { lecturerId: supervisorLecturer._id.toString(), role: 'COMMITTEE_MEMBER' },
          { lecturerId: reviewerLecturer._id.toString(), role: 'COMMITTEE_SECRETARY' },
          { lecturerId: khanLecturer._id.toString(), role: 'COMMITTEE_CHAIR' }
        ]
      };

      const cCreateRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/committees`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenStaff}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(committeePayload)
      });
      const cCreateResult = await cCreateRes.json();
      console.log('HTTP Status:', cCreateRes.status);
      if (!cCreateResult.success) {
        throw new Error(`❌ Test 1 Failed: Create Committee failed. Msg: ${cCreateResult.message}`);
      }
      const committeeId = cCreateResult.data._id;
      console.log(`✅ Test 1 Passed: Committee "${cCreateResult.data.name}" created in draft status.`);

      // Approve and Activate Committee
      await fetch(`http://localhost:${TEST_PORT}/api/v1/committees/${committeeId}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenStaff}` }
      });
      await fetch(`http://localhost:${TEST_PORT}/api/v1/committees/${committeeId}/activate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenStaff}` }
      });
      console.log('✅ Approved and Activated Committee.');

      // 3. Conflict of Interest Validation
      console.log('\n--- Test 2: Conflict of Interest Verification ---');
      // Create a 2nd committee where Kiều Tuấn Hải (Supervisor) is COMMITTEE_CHAIR
      const coiCommitteePayload = {
        periodId: period._id.toString(),
        name: 'Hội đồng lỗi COI',
        members: [
          { lecturerId: supervisorLecturer._id.toString(), role: 'COMMITTEE_CHAIR' },
          { lecturerId: reviewerLecturer._id.toString(), role: 'COMMITTEE_SECRETARY' },
          { lecturerId: khanLecturer._id.toString(), role: 'COMMITTEE_MEMBER' }
        ]
      };
      const coiRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/committees`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenStaff}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(coiCommitteePayload)
      });
      const coiResult = await coiRes.json();
      const coiCommitteeId = coiResult.data._id;
      
      // Approve and Activate the COI Committee
      await fetch(`http://localhost:${TEST_PORT}/api/v1/committees/${coiCommitteeId}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenStaff}` }
      });
      await fetch(`http://localhost:${TEST_PORT}/api/v1/committees/${coiCommitteeId}/activate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenStaff}` }
      });

      // Try scheduling a session with this committee where Supervisor is Chair
      const coiSessionPayload = {
        projectId: projectId.toString(),
        committeeId: coiCommitteeId.toString(),
        mode: 'online',
        meetingUrl: 'https://teams.microsoft.com/l/meetup-join/abc',
        defenseDate: new Date('2026-06-15T00:00:00.000Z').toISOString(),
        startTime: '09:00',
        endTime: '09:45',
        orderNumber: 1
      };

      const scheduleCoiRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/defense-sessions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenStaff}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(coiSessionPayload)
      });
      const scheduleCoiResult = await scheduleCoiRes.json();
      console.log('HTTP Status:', scheduleCoiRes.status);
      console.log('Error Message:', scheduleCoiResult.message);
      if (scheduleCoiRes.status !== 400 && scheduleCoiRes.status !== 403) {
        throw new Error('❌ Test 2 Failed: Scheduler accepted session that has a Conflict of Interest.');
      }
      console.log('✅ Test 2 Passed: Conflict of Interest successfully blocked!');

      // 4. Time Overlap Validation
      console.log('\n--- Test 3: Overlapping Schedule Verification ---');
      // Schedule valid session 1 using our 1st valid committee (Khanh is Chair, Hai is Member, Hong is Sec)
      const session1Payload = {
        projectId: projectId.toString(),
        committeeId: committeeId.toString(),
        mode: 'online',
        meetingUrl: 'https://teams.microsoft.com/l/meetup-join/session1',
        defenseDate: new Date('2026-06-15T00:00:00.000Z').toISOString(),
        startTime: '09:00',
        endTime: '09:45',
        orderNumber: 1
      };

      const s1Res = await fetch(`http://localhost:${TEST_PORT}/api/v1/defense-sessions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenStaff}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(session1Payload)
      });
      const s1Result = await s1Res.json();
      console.log('Session 1 Creation HTTP Status:', s1Res.status);
      if (!s1Result.success) {
        throw new Error(`❌ Setup Failed: Could not create Session 1. Msg: ${s1Result.message}`);
      }
      const sessionId = s1Result.data._id;
      console.log(`✅ Session 1 created successfully with ID: ${sessionId}`);

      // Try scheduling overlapping session 2 (09:30 - 10:15) with same day and same committee
      const session2Payload = {
        projectId: projectId.toString(),
        committeeId: committeeId.toString(),
        mode: 'online',
        meetingUrl: 'https://teams.microsoft.com/l/meetup-join/session2',
        defenseDate: new Date('2026-06-15T00:00:00.000Z').toISOString(),
        startTime: '09:30',
        endTime: '10:15',
        orderNumber: 2
      };

      const s2Res = await fetch(`http://localhost:${TEST_PORT}/api/v1/defense-sessions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenStaff}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(session2Payload)
      });
      const s2Result = await s2Res.json();
      console.log('Session 2 Creation HTTP Status:', s2Res.status);
      console.log('Overlap Error Message:', s2Result.message);
      if (s2Res.status !== 409) {
        throw new Error('❌ Test 3 Failed: Overlapping schedule was not prevented.');
      }
      console.log('✅ Test 3 Passed: Overlapping schedule successfully blocked with 409 Conflict!');

      // 5. Defense Session Operational Workflow
      console.log('\n--- Test 4: Defense Session Operations ---');
      // Secretary Nguyễn Thị Hồng checks identity
      const idRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/defense-sessions/${sessionId}/check-identity`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenReviewer}` }
      });
      const idResult = await idRes.json();
      if (!idResult.success || !idResult.data.identityChecked) {
        throw new Error('❌ Check identity failed.');
      }
      console.log('✅ Checked student identity.');

      // Start session
      const startRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/defense-sessions/${sessionId}/start`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenReviewer}` }
      });
      const startResult = await startRes.json();
      if (!startResult.success || startResult.data.status !== 'in_progress') {
        throw new Error('❌ Start session failed.');
      }
      console.log('✅ Defense session is now in_progress.');

      // Report incident
      const incPayload = {
        type: 'network',
        resolution: 'Nhóm chuyển sang dùng mạng di động 4G phát từ điện thoại để khắc phục gián đoạn.'
      };
      const incRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/defense-sessions/${sessionId}/report-incident`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenReviewer}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(incPayload)
      });
      const incResult = await incRes.json();
      if (!incResult.success || incResult.data.incidentReports.length === 0) {
        throw new Error('❌ Report incident failed.');
      }
      console.log('✅ Recorded technical network incident.');

      // Upload recording url
      const recPayload = { recordingUrl: 'https://hust.microsoftstream.com/recording/hd-01' };
      const recRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/defense-sessions/${sessionId}/upload-recording`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenReviewer}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(recPayload)
      });
      const recResult = await recRes.json();
      if (!recResult.success || recResult.data.recordingUrl !== recPayload.recordingUrl) {
        throw new Error('❌ Upload recording failed.');
      }
      console.log('✅ Recorded video link.');

      // Complete session
      const compRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/defense-sessions/${sessionId}/complete`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenReviewer}` }
      });
      const compResult = await compRes.json();
      if (!compResult.success || compResult.data.status !== 'completed') {
        throw new Error('❌ Complete session failed.');
      }
      console.log('✅ Test 4 Passed: Defense session successfully completed!');

      // 6. Score Sheets Submission & Optimistic Locking
      console.log('\n--- Test 5: ScoreSheets and Optimistic Locking ---');
      
      // Grader 1: Kiều Tuấn Hải (Supervisor) submits scoresheet
      const supScorePayload = {
        projectId: projectId.toString(),
        groupId: group._id.toString(),
        periodId: period._id.toString(),
        rubricRole: 'SUPERVISOR',
        targetType: 'SUPERVISOR',
        targetId: projectId.toString(),
        criteriaScores: [
          { criteriaCode: 'C1', criteriaName: 'Chuyên cần', maxScore: 3, score: 2.8, weight: 1.0 },
          { criteriaCode: 'C2', criteriaName: 'Tiến độ', maxScore: 7, score: 6.2, weight: 1.0 }
        ],
        comment: 'Hoàn thành rất xuất sắc các mốc nhiệm vụ.'
      };

      const sSupRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/scores/score-sheets`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenSupervisor}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(supScorePayload)
      });
      const sSupResult = await sSupRes.json();
      if (!sSupResult.success) {
        throw new Error(`❌ Supervisor score submit failed: ${sSupResult.message}`);
      }
      const supSheetId = sSupResult.data._id;
      console.log(`✅ Supervisor scoresheet submitted successfully. Raw total: ${sSupResult.data.rawTotal}, Version: ${sSupResult.data.version}`);

      // TEST OPTIMISTIC LOCKING: Try updating scoresheet with wrong version
      const supUpdatePayloadWrong = {
        version: 99, // incorrect version
        comment: 'Cập nhật lỗi khóa lạc quan'
      };
      const supUpWrongRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/scores/score-sheets/${supSheetId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${tokenSupervisor}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(supUpdatePayloadWrong)
      });
      console.log('Optimistic lock update wrong HTTP Status:', supUpWrongRes.status);
      if (supUpWrongRes.status !== 409) {
        throw new Error('❌ Test 5 Failed: Optimistic locking did not block incorrect version update.');
      }

      // Update with correct version
      const supUpdatePayloadCorrect = {
        version: 0, // correct version
        comment: 'Hoàn thành xuất sắc các mốc nhiệm vụ đề cương chi tiết.'
      };
      const supUpCorrectRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/scores/score-sheets/${supSheetId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${tokenSupervisor}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(supUpdatePayloadCorrect)
      });
      const supUpCorrectResult = await supUpCorrectRes.json();
      console.log('Optimistic lock update correct HTTP Status:', supUpCorrectRes.status);
      if (!supUpCorrectResult.success || supUpCorrectResult.data.version !== 1) {
        throw new Error(`❌ Test 5 Failed: Correct version update failed. Msg: ${supUpCorrectResult.message}`);
      }
      console.log(`✅ Optimistic locking update passed successfully! Version incremented to: ${supUpCorrectResult.data.version}`);

      // Lock Supervisor score
      await fetch(`http://localhost:${TEST_PORT}/api/v1/scores/score-sheets/${supSheetId}/lock`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenSupervisor}` }
      });
      console.log('✅ Supervisor scorecard locked.');

      // Grader 2: Nguyễn Thị Hồng (Reviewer) submits & locks scoresheet
      const revScorePayload = {
        projectId: projectId.toString(),
        groupId: group._id.toString(),
        periodId: period._id.toString(),
        rubricRole: 'REVIEWER',
        targetType: 'REVIEWER',
        targetId: projectId.toString(),
        criteriaScores: [
          { criteriaCode: 'C1', criteriaName: 'Tính khoa học', maxScore: 4, score: 3.2, weight: 1.0 },
          { criteriaCode: 'C2', criteriaName: 'Sản phẩm triển khai', maxScore: 6, score: 5.0, weight: 1.0 }
        ],
        comment: 'Đồ án chất lượng tốt.'
      };
      const sRevRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/scores/score-sheets`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenReviewer}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(revScorePayload)
      });
      const sRevResult = await sRevRes.json();
      const revSheetId = sRevResult.data._id;
      await fetch(`http://localhost:${TEST_PORT}/api/v1/scores/score-sheets/${revSheetId}/lock`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenReviewer}` }
      });
      console.log('✅ Reviewer scorecard submitted & locked.');

      // Grader 3, 4, 5: 3 Committee members submit scorecards
      const submitCommitteeScore = async (graderToken, graderLecturerId, score1, score2) => {
        const payload = {
          projectId: projectId.toString(),
          groupId: group._id.toString(),
          periodId: period._id.toString(),
          rubricRole: 'COMMITTEE_MEMBER',
          targetType: 'COMMITTEE_MEMBER',
          targetId: projectId.toString(),
          criteriaScores: [
            { criteriaCode: 'C1', criteriaName: 'Thuyết trình', maxScore: 5, score: score1, weight: 1.0 },
            { criteriaCode: 'C2', criteriaName: 'Trả lời câu hỏi', maxScore: 5, score: score2, weight: 1.0 }
          ],
          comment: 'Nhận xét bảo vệ hội đồng.'
        };
        const res = await fetch(`http://localhost:${TEST_PORT}/api/v1/scores/score-sheets`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${graderToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (!result.success) throw new Error('Committee score submission failed.');
        
        await fetch(`http://localhost:${TEST_PORT}/api/v1/scores/score-sheets/${result.data._id}/lock`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${graderToken}` }
        });
      };

      // Grader 3 (Trần Văn Khánh - Chair): 4.5 + 4.5 = 9.0
      await submitCommitteeScore(tokenKhanh, khanLecturer._id, 4.5, 4.5);
      // Grader 4 (Kiều Tuấn Hải - Member): 4.2 + 4.0 = 8.2
      await submitCommitteeScore(tokenSupervisor, supervisorLecturer._id, 4.2, 4.0);
      // Grader 5 (Nguyễn Thị Hồng - Sec): 4.8 + 4.6 = 9.4
      await submitCommitteeScore(tokenReviewer, reviewerLecturer._id, 4.8, 4.6);
      console.log('✅ All 3 Committee member scorecards submitted and locked.');
      console.log('✅ Test 5 Passed: Scoresheets locked and optimistic locking verified!');

      // 7. Aggregation & Variance Flags Check
      console.log('\n--- Test 6: FinalGrade Aggregation & Calculations ---');
      const aggRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/scores/final-grades/aggregate/${projectId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenStaff}` }
      });
      const aggResult = await aggRes.json();
      console.log('HTTP Status:', aggRes.status);
      if (!aggResult.success) {
        throw new Error(`❌ Aggregation Failed: ${aggResult.message}`);
      }
      
      const gradeId = aggResult.data._id;
      console.log('Aggregated Final Grade Outcomes:');
      console.log('- Supervisor score:', aggResult.data.componentScores.supervisor);
      console.log('- Reviewer score:', aggResult.data.componentScores.reviewer);
      console.log('- Committee avg score:', aggResult.data.componentScores.committee);
      console.log('- Final Score (Calculated & Rounded):', aggResult.data.finalScore);
      console.log('- Letter Grade (HUST standards):', aggResult.data.letterGrade);
      console.log('- Pass status:', aggResult.data.passStatus);

      // Verify rounding-free formula logic:
      // supervisorRaw = 9.0
      // reviewerRaw = 8.2
      // committeeRawAvg = (9.0 + 8.2 + 9.4) / 3 = 8.866666...
      // finalScoreRaw = (9.0 * 0.3) + (8.2 * 0.2) + (8.866666... * 0.5) = 2.7 + 1.64 + 4.43333... = 8.77333...
      // Rounded final score should be 8.8
      if (aggResult.data.finalScore !== 8.8) {
        throw new Error(`❌ Final Score Math is incorrect! Expected 8.8, but got: ${aggResult.data.finalScore}`);
      }
      if (aggResult.data.letterGrade !== 'A') {
        throw new Error(`❌ Letter Grade is incorrect! Expected A, but got: ${aggResult.data.letterGrade}`);
      }
      console.log('✅ Verify math successful: Expected 8.8 and letter grade A - matched perfectly!');

      // Publish Grade
      const pubRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/scores/final-grades/${gradeId}/publish`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenStaff}` }
      });
      const pubResult = await pubRes.json();
      if (!pubResult.success || !pubResult.data.publishedAt) {
        throw new Error('❌ Publish grade failed.');
      }
      console.log('✅ Final Grade officially published to student.');

      // Verify project is now finalized
      const updatedProject = await Project.findById(projectId);
      console.log('Project Status in DB:', updatedProject.status);
      if (updatedProject.status !== 'finalized') {
        throw new Error('❌ Project status should be finalized.');
      }
      console.log('✅ Project Status verified in DB as finalized!');

      console.log('\n🎉 ALL PHASE 7 COMMITTEES & SCORES INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉');
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
