const assertSafeTestDatabase = () => {
  if (process.env.ALLOW_DB_MUTATING_TESTS === 'true') {
    return;
  }

  const uri = process.env.MONGODB_URI || '';
  let databaseName = '';

  try {
    databaseName = new URL(uri).pathname.replace(/^\//, '').split('?')[0];
  } catch (error) {
    databaseName = '';
  }

  const looksLikeTestDb = /(^|[-_])test($|[-_])|testing/i.test(databaseName);
  if (looksLikeTestDb) {
    return;
  }

  console.warn(
    [
      'Warning: running mutating integration tests on a non-test database.',
      'The suite must preserve core user/admin accounts and only clean test/business workflow data.',
    ].join('\n')
  );
};

module.exports = { assertSafeTestDatabase };
