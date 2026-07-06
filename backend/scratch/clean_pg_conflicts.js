process.env.NODE_ENV = process.env.NODE_ENV || 'test';
require('../config/env').loadEnv();
const prisma = require('../config/prisma');

const main = async () => {
  const emails = [
    'hoanganh@hust.edu.vn',
    'namnv@hust.edu.vn',
    'haikt@hust.edu.vn',
    'hongnt@hust.edu.vn',
    'huonglt@hust.edu.vn',
    'admin@st.phenikaa-uni.edu.vn'
  ];

  console.log('Cleaning conflicting users from Postgres...');
  const deleteResult = await prisma.user.deleteMany({
    where: {
      email: {
        in: emails
      }
    }
  });
  console.log(`Deleted ${deleteResult.count} conflicting users.`);
};

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
