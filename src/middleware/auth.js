const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');

// Middleware that protects a route.
// Expects the client to send:  Authorization: Bearer <token>
function authenticateToken(req, res, next) {
  // TODO 1: Read the Authorization header from req.headers
  //         If it is missing -> respond 401 { message: '...' }

  // TODO 2: The header looks like "Bearer <token>".
  //         Split it and check that the scheme is exactly "Bearer"
  //         and that a token is present.
  //         If the format is wrong -> respond 401 { message: '...' }

  // TODO 3: Verify the token using jwt.verify(token, JWT_SECRET)
  //         Hint: jwt.verify THROWS if the token is invalid or expired,
  //         so wrap it in try/catch.
  //         If verification fails -> respond 403 { message: '...' }

  // TODO 4: Attach the decoded payload to req.user and call next()

  return res.status(501).json({ message: 'authenticateToken not implemented yet' });
}

module.exports = authenticateToken;
