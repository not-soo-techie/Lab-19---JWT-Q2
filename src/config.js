// Central configuration for the app.
// DATABASE_URL and JWT_SECRET are read from the .env file.
module.exports = {
  PORT: process.env.PORT || 3000,
  JWT_SECRET: process.env.JWT_SECRET || 'lab19_super_secret_key',
  JWT_EXPIRES_IN: '1h',
  SALT_ROUNDS: 10,
};
