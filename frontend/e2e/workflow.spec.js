const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

test.beforeAll(async () => {
  console.log('Running database cleanup before E2E runs...');
  try {
    execSync('node clean-e2e.js', { cwd: '..' });
    console.log('Cleanup completed successfully.');
  } catch (error) {
    console.error('Cleanup failed:', error.message);
  }
});

test('Episteme full role-based E2E workflow', async ({ page, context }) => {
  // Generate a unique identifier for this test run
  const runId = Date.now();
  const periodName = `Đợt Đồ án E2E ${runId}`;
  const groupName = `Group E2E ${runId}`;
  const topicTitle = `Đề tài E2E ${runId}`;
  const milestoneTitle = `Báo cáo E2E ${runId}`;

  console.log(`Starting E2E workflow run: ${runId}`);

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 1: Faculty Staff creates and opens a Project Period
  // ────────────────────────────────────────────────────────────────────────────
  console.log('Step 1: Faculty Staff logging in to create and open period...');
  await page.goto('/auth/login');
  await page.fill('input[name="email"]', 'huonglt@hust.edu.vn');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');

  await page.waitForURL('/dashboard');
  await expect(page.locator('text=Lê Thị Hương')).toBeVisible();

  // Navigate to periods management page
  await page.goto('/dashboard/periods');
  await page.waitForSelector('text=Quản lý Đợt đồ án');

  // Trigger period creation modal
  await page.click('button:has-text("Khởi tạo đợt mới")');

  // Fill in period details
  await page.fill('input[name="name"]', periodName);
  await page.fill('input[name="schoolYear"]', '2025-2026');
  await page.fill('input[name="semester"]', '2');
  await page.selectOption('select[name="type"]', 'foundation_project');
  await page.fill('input[name="rubricVersion"]', 'HUST-SET-2026');
  await page.fill('input[name="minGroupSize"]', '1');
  await page.fill('input[name="maxGroupSize"]', '2');

  // Listen to response to get period ID
  const periodPromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/periods') &&
      response.request().method() === 'POST'
  );
  await page.click('button[type="submit"]');
  const periodResponse = await periodPromise;
  expect(periodResponse.status()).toBe(201);
  const periodResponseBody = await periodResponse.json();
  const periodId = periodResponseBody.data._id;
  console.log(`Period created successfully: ID = ${periodId}`);

  // Open registration for this period
  const openRegPromise = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/v1/periods/${periodId}/open-registration`) &&
      response.request().method() === 'POST'
  );
  // Find the Mở đăng ký button for the newly created period card
  const periodCard = page.locator(`div:has-text("${periodName}")`);
  await periodCard.locator('button:has-text("Mở đăng ký đề tài")').click();
  const openRegResponse = await openRegPromise;
  expect(openRegResponse.status()).toBe(200);
  console.log('Opened topic registration for the period');

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 2: Use Faculty Staff credentials to roster student Hoàng Anh to period via API
  // ────────────────────────────────────────────────────────────────────────────
  console.log('Step 2: Rostering student Hoàng Anh to the period via API...');
  const cookies = await context.cookies();
  const tokenCookie = cookies.find((c) => c.name === 'karl_token');
  expect(tokenCookie).toBeDefined();
  const staffToken = tokenCookie.value;

  const rosterRes = await page.evaluate(
    async ({ periodId, token }) => {
      const apiBaseUrl = 'http://localhost:5000/api/v1';
      const response = await fetch(`${apiBaseUrl}/periods/${periodId}/rosters/import`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roster: [
            {
              studentCode: '22021435', // Hoàng Anh
              classSection: 'IT4911',
              fullName: 'Hoàng Anh',
              email: 'hoanganh@hust.edu.vn',
            },
          ],
        }),
      });
      return { status: response.status, body: await response.json() };
    },
    { periodId, token: staffToken }
  );
  expect(rosterRes.status).toBe(200);
  expect(rosterRes.body.success).toBe(true);
  console.log('Student Hoàng Anh successfully rostered');

  // Log out Faculty Staff
  await page.locator('button[title="Đăng xuất"]').click();
  await page.waitForURL('/auth/login');

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 3: Student Hoàng Anh creates group and proposes a topic
  // ────────────────────────────────────────────────────────────────────────────
  console.log('Step 3: Student logging in to create group and propose topic...');
  await page.fill('input[name="email"]', 'hoanganh@hust.edu.vn');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL('/dashboard');
  await expect(page.locator('text=Hoàng Anh')).toBeVisible();

  // Navigate to Groups page and create group
  await page.goto('/dashboard/groups');
  await page.fill('input[name="newGroupName"]', groupName);
  await page.click('button:has-text("Khởi tạo nhóm")');
  await page.waitForSelector(`text=${groupName}`);

  // Confirm group list
  await page.click('button:has-text("Xác nhận chốt danh sách")');
  await page.click('button:has-text("Xác nhận")');
  console.log('Group created and confirmed successfully');

  // Navigate to Topics page and propose topic
  await page.goto('/dashboard/topics');
  await page.click('button:has-text("Đề xuất đề tài mới")');
  
  // Select the period from select dropdown explicitly
  await page.selectOption('select', { label: periodName });
  
  // Fill proposed topic form
  await page.fill('input[name="title"]', topicTitle);
  await page.fill('textarea', 'Nội dung thực hiện kiểm thử E2E tự động toàn diện.');
  
  const topicPromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/topics') &&
      response.request().method() === 'POST'
  );
  await page.click('button[type="submit"]:has-text("Đề xuất")');
  const topicResponse = await topicPromise;
  expect(topicResponse.status()).toBe(201);
  const topicResponseBody = await topicResponse.json();
  const topicId = topicResponseBody.data._id;
  const groupId = topicResponseBody.data.groupId;
  console.log(`Topic proposed successfully: ID = ${topicId}, Group ID = ${groupId}`);

  // Log out Student
  await page.locator('button[title="Đăng xuất"]').click();
  await page.waitForURL('/auth/login');

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 4: Staff approves topic & assigns supervisor via API to spawn Project
  // ────────────────────────────────────────────────────────────────────────────
  console.log('Step 4: Staff approving topic and assigning supervisor via API...');
  
  const setupRes = await page.evaluate(
    async ({ token, topicId }) => {
      const apiBaseUrl = 'http://localhost:5000/api/v1';
      // 1. Approve topic
      const approveRes = await fetch(`${apiBaseUrl}/topics/${topicId}/approve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (approveRes.status !== 200) return { error: 'Topic approval failed', status: approveRes.status };

      // 2. Fetch lecturers to get haikt@hust.edu.vn (Kiều Tuấn Hải) ID
      const lecturersRes = await fetch(`${apiBaseUrl}/auth/lecturers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const lecturersData = await lecturersRes.json();
      const haikt = lecturersData.data.find((l) => l.userId?.email === 'haikt@hust.edu.vn' || l.email === 'haikt@hust.edu.vn');
      if (!haikt) return { error: 'Supervisor haikt not found' };

      // 3. Assign supervisor
      const assignRes = await fetch(`${apiBaseUrl}/topics/${topicId}/assign-supervisor`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ supervisorId: haikt._id }),
      });
      const assignData = await assignRes.json();
      return { status: assignRes.status, data: assignData };
    },
    { token: staffToken, topicId }
  );
  expect(setupRes.status).toBe(200);
  const projectId = setupRes.data.data._id;
  console.log(`Supervisor assigned and Project spawned successfully: Project ID = ${projectId}`);

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 5: Supervisor Kiều Tuấn Hải sets a Milestone
  // ────────────────────────────────────────────────────────────────────────────
  console.log('Step 5: Supervisor logging in to create a Milestone...');
  await page.goto('/auth/login');
  await page.fill('input[name="email"]', 'haikt@hust.edu.vn');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL('/dashboard');
  await expect(page.locator('text=Kiều Tuấn Hải')).toBeVisible();

  // Navigate to Submissions & Milestones
  await page.goto('/dashboard/submissions');
  await page.waitForSelector('text=Nộp báo cáo & Mốc tiến độ');

  // Trigger milestone creation
  await page.click('button:has-text("Tạo mốc nộp mới")');
  await page.fill('input[name="title"]', milestoneTitle);
  await page.fill('textarea', 'Sinh viên tải lên báo cáo PDF để kiểm thử E2E.');
  // Input deadline date
  await page.fill('input[type="datetime-local"]', '2026-12-31T18:00');

  const milestonePromise = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/v1/projects/${projectId}/milestones`) &&
      response.request().method() === 'POST'
  );
  await page.click('button[type="submit"]');
  const milestoneResponse = await milestonePromise;
  expect(milestoneResponse.status()).toBe(201);
  const milestoneResponseBody = await milestoneResponse.json();
  const milestoneId = milestoneResponseBody.data._id;
  console.log(`Milestone created successfully: ID = ${milestoneId}`);

  // Log out Supervisor
  await page.locator('button[title="Đăng xuất"]').click();
  await page.waitForURL('/auth/login');

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 6: Student Hoàng Anh submits a report to the Milestone
  // ────────────────────────────────────────────────────────────────────────────
  console.log('Step 6: Student logging in to submit report to milestone...');
  await page.fill('input[name="email"]', 'hoanganh@hust.edu.vn');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL('/dashboard');

  await page.goto('/dashboard/submissions');
  await page.waitForSelector(`text=${milestoneTitle}`);

  // Click Nộp bài
  const milestoneCard = page.locator(`div:has-text("${milestoneTitle}")`);
  await milestoneCard.locator('button:has-text("Nộp bài")').click();

  // Upload mock file with PDF signature
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.locator('input[type="file"]').click();
  const fileChooser = await fileChooserPromise;
  // %PDF-1.4 starts with PDF magic bytes (25 50 44 46) which is required by our backend magic number check
  await fileChooser.setFiles({
    name: 'e2e_report.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 mock pdf report structure for e2e tests\n'),
  });

  // Verify successful clean scanning message
  await page.waitForSelector('text=quét mã độc sạch thành công');

  await page.fill('input[placeholder*="lời chào"]', 'Đã hoàn tất nộp bài E2E.');
  
  const submitWorkPromise = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/v1/projects/${projectId}/milestones/${milestoneId}/submit`) &&
      response.request().method() === 'POST'
  );
  await page.click('button:has-text("Nộp bài ngay")');
  const submitWorkResponse = await submitWorkPromise;
  expect(submitWorkResponse.status()).toBe(200);
  console.log('Report submitted successfully by Student');

  // Log out Student
  await page.locator('button[title="Đăng xuất"]').click();
  await page.waitForURL('/auth/login');

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 7: Supervisor Kiều Tuấn Hải reviews submission as Accepted
  // ────────────────────────────────────────────────────────────────────────────
  console.log('Step 7: Supervisor logging in to review submission...');
  await page.fill('input[name="email"]', 'haikt@hust.edu.vn');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL('/dashboard');

  await page.goto('/dashboard/submissions');
  const milestoneCardSup = page.locator(`div:has-text("${milestoneTitle}")`);
  await milestoneCardSup.locator('button:has-text("Đánh giá bản nộp")').click();

  // Fill in review details
  await page.selectOption('select[name="status"]', 'accepted');
  await page.fill('textarea', 'Báo cáo đầy đủ, đạt yêu cầu.');

  const feedbackPromise = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/v1/projects/${projectId}/milestones/${milestoneId}/feedback`) &&
      response.request().method() === 'POST'
  );
  await page.click('button:has-text("Gửi đánh giá")');
  const feedbackResponse = await feedbackPromise;
  expect(feedbackResponse.status()).toBe(200);
  console.log('Supervisor feedback submitted successfully');

  // Log out Supervisor
  await page.locator('button[title="Đăng xuất"]').click();
  await page.waitForURL('/auth/login');

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 8: Setup Committee and Defense Session via API to grade the project
  // ────────────────────────────────────────────────────────────────────────────
  console.log('Step 8: Staff setting up Committee and Defense Session via API...');
  const setupCommitteeRes = await page.evaluate(
    async ({ token, periodId, projectId, groupId }) => {
      const apiBaseUrl = 'http://localhost:5000/api/v1';

      // 1. Fetch lecturers
      const lecturersRes = await fetch(`${apiBaseUrl}/auth/lecturers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const lecturersData = await lecturersRes.json();
      
      const haikt = lecturersData.data.find((l) => l.userId?.email === 'haikt@hust.edu.vn' || l.email === 'haikt@hust.edu.vn');
      const hongnt = lecturersData.data.find((l) => l.userId?.email === 'hongnt@hust.edu.vn' || l.email === 'hongnt@hust.edu.vn');
      const huonglt = lecturersData.data.find((l) => l.userId?.email === 'huonglt@hust.edu.vn' || l.email === 'huonglt@hust.edu.vn');

      if (!haikt || !hongnt || !huonglt) return { error: 'Lecturers for committee not found' };

      // 2. Create Committee (min 3 members)
      const committeePayload = {
        periodId,
        name: `Hội đồng E2E ${Date.now()}`,
        evaluationMode: 'defense',
        members: [
          { lecturerId: haikt._id, role: 'COMMITTEE_MEMBER' },
          { lecturerId: hongnt._id, role: 'COMMITTEE_SECRETARY' },
          { lecturerId: huonglt._id, role: 'COMMITTEE_CHAIR' }, // huonglt is chair (doesn't clash with haikt/supervisor)
        ],
      };

      const committeeRes = await fetch(`${apiBaseUrl}/committees`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(committeePayload),
      });
      const committeeData = await committeeRes.json();
      if (committeeRes.status !== 201) return { error: 'Committee creation failed', status: committeeRes.status };
      const committeeId = committeeData.data._id;

      // 3. Approve Committee
      await fetch(`${apiBaseUrl}/committees/${committeeId}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      // 4. Activate Committee
      await fetch(`${apiBaseUrl}/committees/${committeeId}/activate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      // 5. Schedule Defense Session
      const schedulePayload = {
        projectId,
        committeeId,
        mode: 'offline',
        room: 'Phòng Hội thảo E2E-501',
        defenseDate: new Date().toISOString(),
        startTime: '09:00',
        endTime: '10:00',
        orderNumber: 1,
      };

      const scheduleRes = await fetch(`${apiBaseUrl}/defense-sessions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(schedulePayload),
      });
      const scheduleData = await scheduleRes.json();

      return { status: scheduleRes.status, committeeId, defenseSessionId: scheduleData.data?._id };
    },
    { token: staffToken, periodId, projectId, groupId }
  );

  expect(setupCommitteeRes.status).toBe(201);
  const { defenseSessionId } = setupCommitteeRes;
  console.log(`Committee and Defense Session scheduled successfully: ID = ${defenseSessionId}`);

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 9: Committee Member (Kiều Tuấn Hải) logs in and grades the Project
  // ────────────────────────────────────────────────────────────────────────────
  console.log('Step 9: Committee Member logging in to input score sheet...');
  await page.goto('/auth/login');
  await page.fill('input[name="email"]', 'haikt@hust.edu.vn');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL('/dashboard');

  // Navigate to score sheet page
  await page.goto('/dashboard/scores');
  await page.waitForSelector('text=Chấm điểm Đồ án');

  // Find the defense session card for our topic
  const defenseCard = page.locator('div').filter({ hasText: /Hội đồng E2E/ }).filter({ hasText: 'Nhập phiếu điểm' }).last();
  await defenseCard.locator('button:has-text("Nhập phiếu điểm")').click();

  // Fill scores (C1 max 3, C2 max 4, C3 max 3)
  const inputs = page.locator('form#score-form input[type="number"]');
  await inputs.nth(0).fill('2.5'); // C1
  await inputs.nth(1).fill('3.5'); // C2
  await inputs.nth(2).fill('2.8'); // C3

  await page.fill('form#score-form textarea', 'Sinh viên trình bày tốt, sản phẩm thực tế hoạt động trơn tru.');

  const scorePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/scores/score-sheets') &&
      response.request().method() === 'POST'
  );
  await page.click('button:has-text("Nộp Phiếu Điểm")');
  const scoreResponse = await scorePromise;
  expect(scoreResponse.status()).toBe(201);
  console.log('Committee member successfully graded the project.');

  // Clean up: logout
  await page.locator('button[title="Đăng xuất"]').click();
  await page.waitForURL('/auth/login');

  console.log('E2E workflow completed successfully with all role assertions!');
});
