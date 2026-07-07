const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required for Prisma PostgreSQL.');
}

// Trim accidental whitespace/wrapping quotes from hosted environment variable settings.
const connectionString = process.env.DATABASE_URL.trim().replace(/^["']|["']$/g, '').trim();

try {
  const databaseUrl = new URL(connectionString);
  if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol)) {
    throw new Error('Unsupported database protocol.');
  }
} catch (error) {
  throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL.');
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

module.exports = prisma;
