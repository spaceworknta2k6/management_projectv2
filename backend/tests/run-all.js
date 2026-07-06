/**
 * run-all.js — Episteme Backend Full Integration Test Runner
 *
 * Chạy tuần tự tất cả các bộ kiểm thử tích hợp.
 * Dừng ngay nếu một bộ thất bại, hoặc in báo cáo tổng kết cuối cùng.
 *
 * Sử dụng: node tests/run-all.js
 */

const { spawn } = require('child_process');
const path = require('path');
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
require('../config/env').loadEnv();


// Danh sách các bộ kiểm thử theo thứ tự vòng đời hệ thống
const SUITES = [
  { file: 'db.test.js',                  label: 'Database Connection' },
  { file: 'auth.test.js',                label: 'Authentication & JWT' },
  { file: 'users.test.js',               label: 'User Management & Roles' },
  { file: 'periods-rosters.test.js',     label: 'Periods & Rosters' },
  { file: 'groups-topics.test.js',       label: 'Groups & Topics' },
  { file: 'projects-milestones.test.js', label: 'Projects & Milestones' },
  { file: 'submissions-extensions.test.js', label: 'Submissions & Extensions' },
  { file: 'topic-change-requests.test.js', label: 'Topic Change Requests' },

  { file: 'rubrics-grading.test.js',      label: 'Evaluation Rubrics & Score Verification' },
  { file: 'appeals.test.js',              label: 'Appeals & Grade Publishing' },
  { file: 'files-security.test.js',      label: 'File Security' },
  { file: 'chat.test.js',                label: 'Chat Rooms & Attachments' },
];

const DIVIDER = '='.repeat(70);
const HALF    = '-'.repeat(70);

const runSuite = (file) => new Promise((resolve) => {
  const filePath = path.join(__dirname, file);
  const start = Date.now();

  const child = spawn(process.execPath, [filePath], {
    stdio: 'inherit',   // Live-stream output to terminal
    env: process.env,
    cwd: path.join(__dirname, '..'),
  });

  child.on('close', (code) => {
    resolve({ code, elapsed: Date.now() - start });
  });
});

const pad = (str, len) => str.padEnd(len, ' ');

const main = async () => {
  console.log('\n' + DIVIDER);
  console.log('  🧪 EPISTEME BACKEND — FULL INTEGRATION TEST SUITE');
  console.log(`  Running ${SUITES.length} test suites sequentially...`);
  console.log(DIVIDER + '\n');

  const results = [];
  let aborted = false;

  for (const suite of SUITES) {
    console.log(DIVIDER);
    console.log(`🏃 Running Test Suite: ${suite.file}...`);
    console.log(DIVIDER);

    const { code, elapsed } = await runSuite(suite.file);
    // code 0 = pass, code 1 = fail, code 2 = quota warning (external limit)
    const passed = code === 0;
    const quota  = code === 2;

    results.push({ ...suite, passed, quota, elapsed, code });

    if (!passed && !quota) {
      console.log(`\n❌ SUITE FAILED: ${suite.label} (exit code ${code})`);
      console.log('⛔ Aborting remaining suites to prevent cascading failures.\n');
      aborted = true;
      break;
    }

    if (quota) {
      console.log(`\n⚠️  ${suite.file} QUOTA WARNING — external API limit reached.\n`);
    } else {
      console.log(`\n✅ ${suite.file} PASSED successfully inside ${elapsed}ms.\n`);
    }
  }

  // Summary report
  console.log('\n' + DIVIDER);
  console.log('  📋 INTEGRATION TEST SUMMARY REPORT');
  console.log(DIVIDER);
  console.log(`  ${'Suite'.padEnd(42)} ${'Result'.padEnd(10)} ${'Time'}`);
  console.log('  ' + HALF);

  let totalPassed = 0;
  let totalFailed = 0;
  let totalQuota  = 0;

  for (const r of results) {
    const status = r.passed ? '✅ PASS' : r.quota ? '⚠️ QUOTA' : '❌ FAIL';
    const time   = `${r.elapsed}ms`;
    console.log(`  ${pad(r.label, 42)} ${pad(status, 10)} ${time}`);
    if (r.passed)     totalPassed++;
    else if (r.quota) totalQuota++;
    else              totalFailed++;
  }

  const skipped = SUITES.length - results.length;
  if (skipped > 0) {
    for (const s of SUITES.slice(results.length)) {
      console.log(`  ${pad(s.label, 42)} ${'⏭ SKIP'.padEnd(10)}`);
    }
  }

  console.log('  ' + HALF);
  console.log(`\n  Total: ${totalPassed} passed, ${totalFailed} failed, ${totalQuota} quota-limited, ${skipped} skipped`);

  if (totalFailed === 0 && skipped === 0 && totalQuota === 0) {
    console.log('\n  🎉 ALL INTEGRATION TESTS PASSED — SYSTEM IS FULLY VERIFIED! 🎉');
  } else if (totalFailed === 0 && skipped === 0 && totalQuota > 0) {
    console.log('\n  ✅ ALL CRITICAL TESTS PASSED! (one external API quota warning was reported)');
  } else {
    console.log('\n  ⚠️  Some test suites did not pass. Please review the output above.');
  }

  console.log(DIVIDER + '\n');

  process.exit(totalFailed > 0 || aborted ? 1 : 0);
};

main();
