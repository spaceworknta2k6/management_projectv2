const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { app } = require('../app');
const mongoose = require('mongoose');

const TEST_PORT = 5020;

const runUsersTests = async () => {
  // Start server on temporary port 5020
  const server = app.listen(TEST_PORT, async () => {
    console.log(`\n🚀 Temporary integration test server listening on port ${TEST_PORT}...`);
    
    try {
      // 1. Đăng nhập bằng tài khoản sinh viên (Hoàng Anh) để lấy token
      console.log('\n--- Đăng nhập bằng sinh viên (hoanganh@hust.edu.vn) ---');
      const studentLoginRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'hoanganh@hust.edu.vn',
          password: 'password123'
        })
      });
      const studentLogin = await studentLoginRes.json();
      const studentToken = studentLogin.data.accessToken;
      const studentId = studentLogin.data.user.id;

      // 2. Đăng nhập bằng tài khoản admin (admin@st.phenikaa-uni.edu.vn)
      console.log('\n--- Đăng nhập bằng admin (admin@st.phenikaa-uni.edu.vn) ---');
      const adminLoginRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@st.phenikaa-uni.edu.vn',
          password: 'password123'
        })
      });
      const adminLogin = await adminLoginRes.json();
      const adminToken = adminLogin.data.accessToken;
      const adminId = adminLogin.data.user.id;

      // Test 1: Sinh viên truy cập danh sách users -> Bị từ chối (403)
      console.log('\n--- Test 1: Sinh viên gọi GET /api/v1/users (Mong đợi: 403) ---');
      const res1 = await fetch(`http://localhost:${TEST_PORT}/api/v1/users`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${studentToken}` }
      });
      console.log('HTTP Status:', res1.status);
      if (res1.status !== 403) {
        throw new Error('❌ Test 1 Failed: Sinh viên vẫn có quyền truy cập trang quản lý tài khoản!');
      }
      console.log('✅ Test 1 Passed: Sinh viên bị chặn chính xác.');

      // Test 2: Admin truy cập danh sách users -> Thành công (200)
      console.log('\n--- Test 2: Admin gọi GET /api/v1/users (Mong đợi: 200) ---');
      const res2 = await fetch(`http://localhost:${TEST_PORT}/api/v1/users`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      const usersList = await res2.json();
      console.log('HTTP Status:', res2.status);
      console.log('Tổng số tài khoản tìm thấy:', usersList.pagination.total);
      if (res2.status !== 200 || !usersList.success) {
        throw new Error('❌ Test 2 Failed: Admin không truy cập được danh sách.');
      }
      console.log('✅ Test 2 Passed: Admin lấy danh sách tài khoản thành công.');

      // Test 3: Admin thay đổi vai trò của sinh viên
      console.log('\n--- Test 3: Admin thay đổi vai trò sinh viên sang [STUDENT, LECTURER] (Mong đợi: 200) ---');
      const res3 = await fetch(`http://localhost:${TEST_PORT}/api/v1/users/${studentId}/role`, {
        method: 'PATCH',
        headers: { 
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ roles: ['STUDENT', 'LECTURER'] })
      });
      const changeRoleRes = await res3.json();
      console.log('HTTP Status:', res3.status);
      if (res3.status !== 200 || !changeRoleRes.success) {
        throw new Error('❌ Test 3 Failed: Thay đổi vai trò không thành công.');
      }
      console.log('✅ Test 3 Passed: Cập nhật vai trò thành công.');

      // Test 4: Admin khóa tài khoản sinh viên
      console.log('\n--- Test 4: Admin khóa tài khoản sinh viên (status: locked) (Mong đợi: 200) ---');
      const res4 = await fetch(`http://localhost:${TEST_PORT}/api/v1/users/${studentId}/status`, {
        method: 'PATCH',
        headers: { 
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'locked' })
      });
      console.log('HTTP Status:', res4.status);
      if (res4.status !== 200) {
        throw new Error('❌ Test 4 Failed: Khóa tài khoản không thành công.');
      }
      console.log('✅ Test 4 Passed: Khóa tài khoản thành công.');

      // Test 5: Sinh viên đã bị khóa thử đăng nhập lại -> Bị chặn (403)
      console.log('\n--- Test 5: Sinh viên bị khóa thử login lại (Mong đợi: 403) ---');
      const blockLoginRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'hoanganh@hust.edu.vn',
          password: 'password123'
        })
      });
      console.log('HTTP Status:', blockLoginRes.status);
      if (blockLoginRes.status !== 403) {
        throw new Error('❌ Test 5 Failed: Sinh viên bị khóa vẫn có thể đăng nhập thành công!');
      }
      console.log('✅ Test 5 Passed: Đăng nhập bị chặn chính xác do tài khoản bị khóa.');

      // Reset trạng thái tài khoản sinh viên về active
      console.log('\n--- Reset trạng thái sinh viên về active ---');
      await fetch(`http://localhost:${TEST_PORT}/api/v1/users/${studentId}/status`, {
        method: 'PATCH',
        headers: { 
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'active' })
      });

      // Reset vai trò sinh viên về STUDENT
      await fetch(`http://localhost:${TEST_PORT}/api/v1/users/${studentId}/role`, {
        method: 'PATCH',
        headers: { 
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ roles: ['STUDENT'] })
      });

      // Test 6: Admin tự khóa chính mình -> Bị chặn (400)
      console.log('\n--- Test 6: Admin tự khóa chính mình (Mong đợi: 400) ---');
      const res6 = await fetch(`http://localhost:${TEST_PORT}/api/v1/users/${adminId}/status`, {
        method: 'PATCH',
        headers: { 
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'locked' })
      });
      console.log('HTTP Status:', res6.status);
      if (res6.status !== 400) {
        throw new Error('❌ Test 6 Failed: Hệ thống vẫn cho phép admin tự khóa chính mình!');
      }
      console.log('✅ Test 6 Passed: Tự khóa bản thân bị chặn thành công.');

      console.log('\n🎉 TẤT CẢ CÁC BÀI KIỂM THỬ TÍCH HỢP ĐÃ VƯỢT QUA THÀNH CÔNG! 🎉');
    } catch (error) {
      console.error('\n❌ Thất bại khi kiểm thử:', error.message);
    } finally {
      console.log('\n--- Đang tắt môi trường kiểm thử ---');
      server.close(async () => {
        console.log('✅ Đã tắt server kiểm thử tạm thời.');
        await mongoose.disconnect();
        console.log('✅ Đã đóng kết nối MongoDB.');
        process.exit(0);
      });
    }
  });
};

runUsersTests();
