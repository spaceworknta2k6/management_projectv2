const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { app } = require('../app');
const mongoose = require('mongoose');
const User = require('../models/User');
const Lecturer = require('../models/Lecturer');
const Student = require('../models/Student');
const ProjectPeriod = require('../models/ProjectPeriod');
const Project = require('../models/Project');
const FileAsset = require('../models/FileAsset');

const TEST_PORT = 5007;

const runIntegrationTests = async () => {
  const server = app.listen(TEST_PORT, async () => {
    console.log(`\n🚀 Temporary integration test server listening on port ${TEST_PORT}...`);

    try {
      // 1. Resolve actors
      console.log('\n--- Test 0: Resolving database dependencies ---');
      const studentUser = await User.findOne({ email: 'hoanganh@hust.edu.vn' });
      if (!studentUser) throw new Error('❌ Student not found.');
      const studentProfile = await Student.findOne({ userId: studentUser._id });
      if (!studentProfile) throw new Error('❌ Student profile not found.');

      const supervisorUser = await User.findOne({ email: 'haikt@hust.edu.vn' });
      if (!supervisorUser) throw new Error('❌ Supervisor not found.');

      const reviewerUser = await User.findOne({ email: 'hongnt@hust.edu.vn' });
      if (!reviewerUser) throw new Error('❌ Reviewer not found.');
      const reviewerLecturer = await Lecturer.findOne({ userId: reviewerUser._id });
      if (!reviewerLecturer) throw new Error('❌ Reviewer Lecturer profile not found.');

      // Clean up previous runs
      await FileAsset.deleteMany({});
      console.log('✅ Cleaned up old file assets.');

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

      const tokenStudent = await loginActor('hoanganh@hust.edu.vn', 'password123');
      const tokenSupervisor = await loginActor('haikt@hust.edu.vn', 'password123');
      const tokenReviewer = await loginActor('hongnt@hust.edu.vn', 'password123');
      console.log('✅ Access tokens retrieved successfully.');

      // Mock a project ownerId to test contextual scopes
      const mockProject = await Project.create({
        periodId: new mongoose.Types.ObjectId(),
        groupId: new mongoose.Types.ObjectId(),
        topicId: new mongoose.Types.ObjectId(),
        supervisorId: supervisorUser._id, // haikt is Supervisor
        status: 'in_progress'
      });
      const projectId = mockProject._id;
      console.log(`✅ Created mock project workspace: ${projectId}`);

      // 2. Upload valid PDF file
      console.log('\n--- Test 1: POST /api/v1/files/upload (Upload valid PDF) ---');
      
      // Construct a valid mock PDF buffer starting with %PDF (hex 25 50 44 46)
      const pdfContent = Buffer.concat([
        Buffer.from('%PDF-1.4\n'),
        Buffer.from('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n'),
        Buffer.from('%%EOF')
      ]);

      const formData = new FormData();
      const blob = new Blob([pdfContent], { type: 'application/pdf' });
      formData.append('file', blob, 'De_Cuong_Chi_Tiet.pdf');
      formData.append('ownerType', 'project');
      formData.append('ownerId', projectId.toString());

      const uploadRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/files/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenStudent}` },
        body: formData
      });

      const uploadResult = await uploadRes.json();
      console.log('HTTP Status:', uploadRes.status);
      if (!uploadResult.success || !uploadResult.data._id) {
        throw new Error(`❌ Test 1 Failed: Upload valid PDF failed. Msg: ${uploadResult.message}`);
      }
      const fileId = uploadResult.data._id;
      console.log('File Metadata outcomes in DB:');
      console.log('- mimeVerified:', uploadResult.data.mimeVerified);
      console.log('- sha256 Hashing:', uploadResult.data.sha256);
      console.log('- size:', uploadResult.data.size, 'bytes');
      console.log('- scanStatus:', uploadResult.data.scanStatus);
      console.log('✅ Test 1 Passed: Valid PDF upload succeeded!');

      // 3. Fake format detection (Magic number blocks)
      console.log('\n--- Test 2: Fake extension upload (Magic numbers block verification) ---');
      const fakePdfContent = Buffer.from('MZ恶意可执行程序代码...'); // Executable Windows PE header (MZ) disguised as PDF
      const fakeFormData = new FormData();
      const fakeBlob = new Blob([fakePdfContent], { type: 'application/pdf' });
      fakeFormData.append('file', fakeBlob, 'Malicious_Script.pdf');

      const fakeRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/files/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenStudent}` },
        body: fakeFormData
      });
      const fakeResult = await fakeRes.json();
      console.log('HTTP Status (Should be 400):', fakeRes.status);
      console.log('Error Message:', fakeResult.message);
      if (fakeRes.status !== 400) {
        throw new Error('❌ Test 2 Failed: Fake PDF disguised executable was allowed to upload.');
      }
      console.log('✅ Test 2 Passed: Disguised binary payload successfully detected and blocked!');

      // 4. Scoped access control checks (RBAC Scoping blocks)
      console.log('\n--- Test 3: Scoped access control check (Lecturer with no association) ---');
      // Lecturer Nguyễn Thị Hồng (hongnt@hust.edu.vn) has no relationship to project or file
      const accessRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/files/${fileId}/download-url`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${tokenReviewer}` }
      });
      const accessResult = await accessRes.json();
      console.log('HTTP Status (Should be 403):', accessRes.status);
      console.log('Message:', accessResult.message);
      if (accessRes.status !== 403) {
        throw new Error('❌ Test 3 Failed: Unauthorized lecturer was granted access to private project file.');
      }
      console.log('✅ Test 3 Passed: Unauthorized download request successfully blocked!');

      // 5. Signed URL generation & streaming download
      console.log('\n--- Test 4: HMAC Signed URL generation and file download stream ---');
      // Student hoanganh requests signed download URL
      const signedRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/files/${fileId}/download-url`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${tokenStudent}` }
      });
      const signedResult = await signedRes.json();
      if (!signedResult.success || !signedResult.data.downloadUrl) {
        throw new Error('❌ Failed to retrieve Signed URL.');
      }
      const downloadPath = signedResult.data.downloadUrl;
      console.log('Generated Signed URL:', downloadPath);

      // Perform download using Signed URL (without Auth header!)
      const downloadRes = await fetch(`http://localhost:${TEST_PORT}${downloadPath}`);
      console.log('Download HTTP Status:', downloadRes.status);
      if (downloadRes.status !== 200) {
        throw new Error(`❌ Signed URL download failed: ${downloadRes.status}`);
      }
      const downloadedContent = await downloadRes.text();
      console.log('Downloaded Content first line:', downloadedContent.split('\n')[0]);
      if (!downloadedContent.startsWith('%PDF-1.4')) {
        throw new Error('❌ Downloaded content integrity check failed.');
      }
      console.log('✅ Test 4 Passed: Downloaded binary streamed successfully with correct content!');

      // 6. Signed URL tampering check
      console.log('\n--- Test 5: Signed URL tampering check ---');
      const tamperedPath = downloadPath.replace('token=', 'token=modified_hash_for_tamper_test');
      const tamperRes = await fetch(`http://localhost:${TEST_PORT}${tamperedPath}`);
      console.log('Tamper Download HTTP Status (Should be 403):', tamperRes.status);
      if (tamperRes.status !== 403) {
        throw new Error('❌ Test 5 Failed: Tampered HMAC signature was accepted by server.');
      }
      console.log('✅ Test 5 Passed: Tampered download token successfully blocked!');

      // Clean up project
      await Project.findByIdAndDelete(projectId);

      console.log('\n🎉 ALL PHASE 11 FILE SECURITY INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉');
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
