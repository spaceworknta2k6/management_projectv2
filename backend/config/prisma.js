const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required for Prisma PostgreSQL.');
}

// Trim accidental wrapping quotes from hosted environment variable settings.
const connectionString = process.env.DATABASE_URL.replace(/^["']|["']$/g, '');

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

module.exports = prisma;
