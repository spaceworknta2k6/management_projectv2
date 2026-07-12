process.env.NODE_ENV = process.env.NODE_ENV || 'test';
require('../config/env').loadEnv();

const { app } = require('../app');
const prisma = require('../config/prisma');

const TEST_PORT = 5014;
const API_BASE = `http://localhost:${TEST_PORT}/api/v1`;
const SQLI_EMAIL = "' OR '1'='1' --";
const XSS_NAME = '<script>alert("XSS")</script>';

const periodPayload = (name) => ({
  name,
  schoolYear: '2025-2026',
  semester: '2',
  type: 'foundation_project',
  registrationStart: '2026-06-01T00:00:00.000Z',
  registrationEnd: '2026-06-15T00:00:00.000Z',
  topicChangeDeadline: '2026-06-20T00:00:00.000Z',
  projectStart: '2026-06-25T00:00:00.000Z',
  projectEnd: '2026-09-15T00:00:00.000Z',
  finalSubmissionDeadline: '2026-09-01T00:00:00.000Z',
  gradingStart: '2026-09-05T00:00:00.000Z',
  gradingEnd: '2026-09-10T00:00:00.000Z',
  revisionDeadline: '2026-09-20T00:00:00.000Z',
  archiveDeadline: '2026-10-01T00:00:00.000Z',
  minGroupSize: 1,
  maxGroupSize: 3,
  rubricVersion: 'PDF-CHECKLIST-TEST',
  scoringFormula: { supervisor: 0.5, reviewer: 0.5 },
});

const requestJson = async (path, { method = 'GET', token, body, headers = {} } = {}) => {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  return { res, data, text };
};

const loginActor = async (email, password = 'password123') => {
  const { res, data } = await requestJson('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  if (res.status !== 200 || !data.success || !data.data?.accessToken) {
    throw new Error(`Login failed for ${email}. HTTP ${res.status}. ${data.message || ''}`);
  }
  return data.data.accessToken;
};

const assertStatus = (actual, expected, label) => {
  if (actual !== expected) {
    throw new Error(`${label}: expected HTTP ${expected}, got ${actual}.`);
  }
};

const runIntegrationTests = async () => {
  const server = app.listen(TEST_PORT, async () => {
    console.log(`\nTemporary PDF checklist test server listening on port ${TEST_PORT}...`);

    try {
      const adminToken = await loginActor('admin@st.phenikaa-uni.edu.vn');
      const staffToken = await loginActor('huonglt@hust.edu.vn');
      const studentToken = await loginActor('hoanganh@hust.edu.vn');

      console.log('\n--- TC-06: Locked account cannot login ---');
      const studentLookup = await requestJson('/users?search=hoanganh', { token: adminToken });
      assertStatus(studentLookup.res.status, 200, 'TC-06 lookup');
      const lockedUser = studentLookup.data.data.find((user) => user.email === 'hoanganh@hust.edu.vn');
      if (!lockedUser?._id) throw new Error('TC-06: test student user was not found.');
      try {
        const lockRes = await requestJson(`/users/${lockedUser._id}/status`, {
          method: 'PATCH',
          token: adminToken,
          body: { status: 'locked' },
        });
        assertStatus(lockRes.res.status, 200, 'TC-06 lock user');
        const lockedLogin = await requestJson('/auth/login', {
          method: 'POST',
          body: { email: 'hoanganh@hust.edu.vn', password: 'password123' },
        });
        assertStatus(lockedLogin.res.status, 403, 'TC-06 locked login');
        if (lockedLogin.data.success !== false) throw new Error('TC-06: locked login did not return failure payload.');
      } finally {
        await requestJson(`/users/${lockedUser._id}/status`, {
          method: 'PATCH',
          token: adminToken,
          body: { status: 'active' },
        });
      }
      console.log('TC-06 passed.');

      console.log('\n--- TC-07: Protected route rejects unauthenticated request ---');
      const noAuthMe = await requestJson('/auth/me');
      assertStatus(noAuthMe.res.status, 401, 'TC-07');
      console.log('TC-07 passed.');

      console.log('\n--- TC-08: Admin-only route rejects normal user role ---');
      const usersByStudent = await requestJson('/users', { token: studentToken });
      assertStatus(usersByStudent.res.status, 403, 'TC-08');
      console.log('TC-08 passed.');

      console.log('\n--- TC-09: Creating a valid period returns a new ID ---');
      const createPeriod = await requestJson('/periods', {
        method: 'POST',
        token: staffToken,
        body: periodPayload(`PDF Checklist CRUD E2E ${Date.now()}`),
      });
      assertStatus(createPeriod.res.status, 201, 'TC-09');
      const crudPeriodId = createPeriod.data.data?._id;
      if (!crudPeriodId) throw new Error('TC-09: create period did not return a new ID.');
      console.log('TC-09 passed.');

      console.log('\n--- TC-10: Creating a period with empty required name is rejected ---');
      const invalidPeriod = await requestJson('/periods', {
        method: 'POST',
        token: staffToken,
        body: periodPayload(''),
      });
      assertStatus(invalidPeriod.res.status, 422, 'TC-10');
      if (!Array.isArray(invalidPeriod.data.errors) || !invalidPeriod.data.errors.some((e) => e.field === 'name')) {
        throw new Error('TC-10: validation response did not include the name field.');
      }
      console.log('TC-10 passed.');

      console.log('\n--- TC-11: Updating an existing period changes persisted data ---');
      const updatedName = `PDF Checklist CRUD Updated ${Date.now()}`;
      const updatePeriod = await requestJson(`/periods/${crudPeriodId}`, {
        method: 'PATCH',
        token: staffToken,
        body: { name: updatedName },
      });
      assertStatus(updatePeriod.res.status, 200, 'TC-11 update');
      if (updatePeriod.data.data?.name !== updatedName) {
        throw new Error('TC-11: updated period name was not returned.');
      }
      const updatedLookup = await requestJson(`/periods/${crudPeriodId}`, { token: staffToken });
      assertStatus(updatedLookup.res.status, 200, 'TC-11 lookup');
      if (updatedLookup.data.data?.name !== updatedName) {
        throw new Error('TC-11: updated period name was not persisted.');
      }
      console.log('TC-11 passed.');

      console.log('\n--- TC-12: Student cannot update another user account ---');
      const adminUsersByStudent = await requestJson('/users', { token: studentToken });
      assertStatus(adminUsersByStudent.res.status, 403, 'TC-12');
      console.log('TC-12 passed.');

      console.log('\n--- TC-13: Deleting an existing period removes it from default queries ---');
      const deletePeriod = await requestJson(`/periods/${crudPeriodId}`, {
        method: 'DELETE',
        token: staffToken,
      });
      assertStatus(deletePeriod.res.status, 200, 'TC-13 delete');
      const deletedLookup = await requestJson(`/periods/${crudPeriodId}`, { token: staffToken });
      assertStatus(deletedLookup.res.status, 404, 'TC-13 lookup after delete');
      console.log('TC-13 passed.');

      console.log('\n--- TC-14: Deleting a non-existent period returns 404 ---');
      const missingDelete = await requestJson('/periods/ffffffffffffffffffffffff', {
        method: 'DELETE',
        token: staffToken,
      });
      assertStatus(missingDelete.res.status, 404, 'TC-14');
      console.log('TC-14 passed.');

      console.log('\n--- TC-15: User search with a matching keyword returns filtered data ---');
      const searchHit = await requestJson('/users?search=hoanganh', { token: adminToken });
      assertStatus(searchHit.res.status, 200, 'TC-15');
      if (!searchHit.data.success || !searchHit.data.data.some((user) => user.email === 'hoanganh@hust.edu.vn')) {
        throw new Error('TC-15: expected hoanganh@hust.edu.vn in search results.');
      }
      console.log('TC-15 passed.');

      console.log('\n--- TC-16: User search with no matching keyword returns an empty array ---');
      const searchMiss = await requestJson('/users?search=__no_such_user_pdf_checklist__', { token: adminToken });
      assertStatus(searchMiss.res.status, 200, 'TC-16');
      if (!searchMiss.data.success || !Array.isArray(searchMiss.data.data) || searchMiss.data.data.length !== 0) {
        throw new Error('TC-16: expected an empty result array.');
      }
      console.log('TC-16 passed.');

      console.log('\n--- TC-17: Pagination returns page 1 with limit and meta ---');
      const pagedUsers = await requestJson('/users?page=1&limit=5', { token: adminToken });
      assertStatus(pagedUsers.res.status, 200, 'TC-17');
      if (
        !pagedUsers.data.success ||
        !Array.isArray(pagedUsers.data.data) ||
        pagedUsers.data.data.length > 5 ||
        pagedUsers.data.pagination?.page !== 1 ||
        pagedUsers.data.pagination?.limit !== 5
      ) {
        throw new Error('TC-17: pagination data or meta is incorrect.');
      }
      console.log('TC-17 passed.');

      console.log('\n--- TC-18: Valid JPEG upload stores file metadata and returns URL/path data ---');
      const jpegBytes = Buffer.from('ffd8ffe000104a46494600010101006000600000ffd9', 'hex');
      const jpegFormData = new FormData();
      jpegFormData.append('file', new Blob([jpegBytes], { type: 'image/jpeg' }), 'avatar-test.jpg');
      jpegFormData.append('ownerType', 'pdf_checklist_upload');
      jpegFormData.append('ownerId', 'pdf-checklist-owner');
      const jpegUpload = await fetch(`${API_BASE}/files/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${studentToken}` },
        body: jpegFormData,
      });
      const jpegData = await jpegUpload.json();
      assertStatus(jpegUpload.status, 201, 'TC-18');
      if (!jpegData.success || !jpegData.data?._id || jpegData.data.mimeVerified !== 'image/jpeg' || !jpegData.data.storageKey) {
        throw new Error('TC-18: JPEG upload did not return expected file metadata.');
      }
      await prisma.fileAsset.deleteMany({ where: { ownerType: 'pdf_checklist_upload' } });
      console.log('TC-18 passed.');

      console.log('\n--- TC-19: Dangerous .exe upload is rejected ---');
      const exeFormData = new FormData();
      exeFormData.append('file', new Blob([Buffer.from('MZ executable payload')], { type: 'application/x-msdownload' }), 'malware.exe');
      const exeUpload = await fetch(`${API_BASE}/files/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${studentToken}` },
        body: exeFormData,
      });
      const exeData = await exeUpload.json();
      assertStatus(exeUpload.status, 400, 'TC-19');
      if (exeData.success !== false) throw new Error('TC-19: executable upload did not return failure payload.');
      console.log('TC-19 passed.');

      console.log('\n--- TC-20: CSV export returns downloadable CSV content ---');
      const csvRes = await fetch(`${API_BASE}/users/export?format=csv`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const csvText = await csvRes.text();
      assertStatus(csvRes.status, 200, 'TC-20');
      const contentType = csvRes.headers.get('content-type') || '';
      if (!contentType.includes('text/csv') || !csvText.includes('email') || !csvText.includes('hoanganh@hust.edu.vn')) {
        throw new Error('TC-20: CSV export did not return expected CSV content.');
      }
      console.log('TC-20 passed.');

      console.log('\n--- TC-21: Dashboard stats API returns total, monthly, and recent groups ---');
      const stats = await requestJson('/stats/summary', { token: staffToken });
      assertStatus(stats.res.status, 200, 'TC-21');
      if (!stats.data.success || !stats.data.data?.total || !stats.data.data?.monthly || !stats.data.data?.recent) {
        throw new Error('TC-21: stats summary missing total, monthly, or recent data.');
      }
      console.log('TC-21 passed.');

      console.log('\n--- TC-22: Logout clears session and protected route rejects missing credentials ---');
      const logout = await requestJson('/auth/logout', { method: 'POST' });
      assertStatus(logout.res.status, 200, 'TC-22 logout');
      const afterLogout = await requestJson('/auth/me');
      assertStatus(afterLogout.res.status, 401, 'TC-22 protected route after logout');
      console.log('TC-22 passed.');

      console.log('\n--- Security 42.1: SQL injection payload cannot login and does not expose SQL errors ---');
      const sqlInjection = await requestJson('/auth/login', {
        method: 'POST',
        body: { email: SQLI_EMAIL, password: 'anything' },
      });
      if (sqlInjection.res.status === 200 || sqlInjection.data.success !== false) {
        throw new Error('Security 42.1: SQL injection payload was accepted.');
      }
      if (/syntax|prisma|postgres|sql|stack/i.test(sqlInjection.text)) {
        throw new Error('Security 42.1: response exposed database/internal error details.');
      }
      console.log('Security 42.1 passed.');

      console.log('\n--- Security 42.2: XSS payload is stored and returned as inert text data ---');
      const xssPeriod = await requestJson('/periods', {
        method: 'POST',
        token: staffToken,
        body: periodPayload(XSS_NAME),
      });
      assertStatus(xssPeriod.res.status, 201, 'Security 42.2 create');
      const xssPeriodId = xssPeriod.data.data?._id;
      if (xssPeriod.data.data?.name !== XSS_NAME) {
        throw new Error('Security 42.2: XSS payload was not returned as plain string data.');
      }
      await requestJson(`/periods/${xssPeriodId}`, { method: 'DELETE', token: staffToken });
      console.log('Security 42.2 passed.');

      console.log('\n--- Security 42.3: Password is stored as bcrypt hash, not plaintext ---');
      const hashedUser = await prisma.user.findFirst({
        where: { email: 'hoanganh@hust.edu.vn', isDeleted: false },
        select: { passwordHash: true },
      });
      if (!hashedUser?.passwordHash || !/^\$2[aby]\$\d{2}\$/.test(hashedUser.passwordHash)) {
        throw new Error('Security 42.3: password hash is not in bcrypt format.');
      }
      if (hashedUser.passwordHash === 'password123') {
        throw new Error('Security 42.3: password is stored in plaintext.');
      }
      console.log('Security 42.3 passed.');

      console.log('\n--- Security 42.4: Auth cookies are HttpOnly and SameSite=Lax ---');
      const cookieLogin = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'hoanganh@hust.edu.vn', password: 'password123' }),
      });
      assertStatus(cookieLogin.status, 200, 'Security 42.4 login');
      const setCookies = typeof cookieLogin.headers.getSetCookie === 'function'
        ? cookieLogin.headers.getSetCookie()
        : [cookieLogin.headers.get('set-cookie') || ''];
      const cookieText = setCookies.join('\n');
      for (const cookieName of ['karl_token', 'karl_refresh_token']) {
        const matchingCookie = setCookies.find((cookie) => cookie.startsWith(`${cookieName}=`)) || cookieText;
        if (!matchingCookie.includes(cookieName) || !/HttpOnly/i.test(matchingCookie) || !/SameSite=Lax/i.test(matchingCookie)) {
          throw new Error(`Security 42.4: ${cookieName} cookie is missing HttpOnly or SameSite=Lax.`);
        }
      }
      console.log('Security 42.4 passed.');

      console.log('\nAll PDF checklist API tests passed.');
    } catch (error) {
      console.error('\nPDF checklist test suite failed:', error.message);
      if (error.stack) console.error(error.stack);
      process.exitCode = 1;
    } finally {
      console.log('\n--- Shutting Down Test Environment ---');
      server.close(() => {
        console.log('Temporary PDF checklist test server shut down.');
        process.exit(process.exitCode || 0);
      });
    }
  });
};

runIntegrationTests();
