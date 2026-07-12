const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');
const { closeAuthHelper, issueAccessToken } = require('./auth-helper');

test.beforeAll(() => {
  execSync('node clean-e2e.js', { cwd: '..' });
});

test.afterAll(async () => {
  await closeAuthHelper();
});

async function authenticateAsStaff(page) {
  const token = await issueAccessToken('huonglt@hust.edu.vn');
  await page.goto('/auth/login');
  await page.evaluate((accessToken) => {
    window.localStorage.setItem('karl_access_token', accessToken);
  }, token);
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: /Lê Thị Hương/i })).toBeVisible();
}

test('staff dashboard navigation matches updated grading workflow', async ({ page }) => {
  await authenticateAsStaff(page);

  await expect(page.getByRole('button', { name: /Học phần/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Tiêu chí đánh giá/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Điểm số/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Phúc khảo/ })).toBeVisible();

  await expect(page.getByText(/Hội đồng/i)).toHaveCount(0);
  await expect(page.getByText(/Bảo vệ/i)).toHaveCount(0);

  await page.goto('/dashboard/periods');
  await expect(page.getByRole('heading', { name: /Quản lý đợt học phần/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Tạo đợt học phần/i })).toBeVisible();

  await page.goto('/dashboard/projects');
  await expect(page.getByRole('heading', { name: /Quản lý Dự án/i })).toBeVisible();
  await expect(page.getByText(/Sẵn sàng chấm|Đang thực hiện|Mới phân công|Đã hoàn thành/)).toBeVisible();

  await page.goto('/dashboard/rubrics');
  await expect(page.getByRole('heading', { name: /Quản lý Tiêu chí Đánh giá/i })).toBeVisible();
  await expect(page.getByText(/GVHD|GV Chấm 2/).first()).toBeVisible();
  await expect(page.getByText(/Hội đồng/i)).toHaveCount(0);

  await page.goto('/dashboard/scores');
  await expect(page.getByRole('heading', { name: /Điểm số|Chấm điểm/ })).toBeVisible();

  await page.goto('/dashboard/appeals');
  await expect(page.getByRole('heading', { name: /Phúc Khảo/i })).toBeVisible();
});

test('TC-23 mobile dashboard is usable at 375px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await authenticateAsStaff(page);

  await expect(page.getByRole('heading', { name: /Chào|Tổng quan|Dashboard/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Thu gọn/i })).toHaveCount(0);

  const menuButton = page.getByRole('button', { name: /menu|mở|điều hướng/i }).first();
  if (await menuButton.count()) {
    await expect(menuButton).toBeVisible();
  }
});
