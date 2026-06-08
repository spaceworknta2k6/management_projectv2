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

  console.error(
    [
      'Refusing to run mutating integration tests on a non-test database.',
      'Use a database name containing "test", or set ALLOW_DB_MUTATING_TESTS=true only when you intentionally accept data deletion.',
    ].join('\n')
  );
  process.exit(1);
};

module.exports = { assertSafeTestDatabase };
