const { loadEnv } = require('../config/env');

process.env.NODE_ENV = 'test';
loadEnv();

const required = ['DATABASE_URL', 'JWT_SECRET'];
const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(`Missing required test environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

console.log('Test environment is configured.');
