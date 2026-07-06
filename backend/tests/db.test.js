process.env.NODE_ENV = process.env.NODE_ENV || 'test';
require('../config/env').loadEnv();

const prisma = require('../config/prisma');

console.log('--- Phase 1: Checking Prisma/PostgreSQL Connection ---');
const verifyDatabase = async () => {
  try {
    await prisma.$connect();
    
    console.log('\n--- Phase 2: Executing Test Query ---');
    const userCount = await prisma.user.count({ where: { isDeleted: false } });
    console.log(`✅ Database query executed successfully! Found ${userCount} users in the database.`);

    console.log('\n--- Phase 3: Graceful Shutdown ---');
    await prisma.$disconnect();
    console.log('✅ Disconnected from PostgreSQL. Verification SUCCESSFUL!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database Connection/Query Verification Failed:', error);
    process.exit(1);
  }
};

verifyDatabase();
