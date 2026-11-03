const { PrismaClient } = require('@prisma/client');

// A single PrismaClient instance shared by the whole app.
// Import it wherever you need to talk to the database:
//   const prisma = require('./db/prisma');
const prisma = new PrismaClient();

module.exports = prisma;
