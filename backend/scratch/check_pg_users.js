process.env.NODE_ENV = process.env.NODE_ENV || 'test';
require('../config/env').loadEnv();
const prisma = require('../config/prisma');

const main = async () => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      mongoId: true,
      email: true,
      isDeleted: true
    }
  });
  console.log('Postgres users:', JSON.stringify(users, null, 2));
};

main().catch(console.error).finally(() => prisma.$disconnect());
