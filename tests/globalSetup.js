const { execSync } = require('child_process');

// Runs ONCE before the whole test suite.
// Syncs prisma/schema.prisma into test.db (creating it if needed) and
// regenerates Prisma Client. Rows are cleared before each test in auth.test.js.
module.exports = async () => {
  execSync('npx prisma db push', {
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
    stdio: 'inherit',
  });
};
