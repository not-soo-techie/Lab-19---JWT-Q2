// Runs before every test file.
// Tests use their own SQLite file so they never touch your dev.db
process.env.DATABASE_URL = 'file:./test.db';
