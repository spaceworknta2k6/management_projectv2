const path = require('path');

module.paths.push(path.join(__dirname, '..', '..', 'backend', 'node_modules'));

require('../../backend/config/env').loadEnv();
const jwt = require('jsonwebtoken');
const prisma = require('../../backend/config/prisma');
const { getJwtSecret } = require('../../backend/config/jwt');

async function issueAccessToken(email) {
  const user = await prisma.user.findFirst({
    where: { email, isDeleted: false },
    include: { student: true, lecturer: true },
  });

  if (!user) {
    throw new Error(`E2E user not found: ${email}`);
  }

  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      roles: user.roles,
      type: 'access',
    },
    getJwtSecret(),
    { expiresIn: '15m' }
  );
}

async function closeAuthHelper() {
  await prisma.$disconnect();
}

async function authHeaders(email) {
  const token = await issueAccessToken(email);
  return { token, headers: { Authorization: `Bearer ${token}`, Cookie: '' } };
}

module.exports = {
  authHeaders,
  closeAuthHelper,
  issueAccessToken,
};
