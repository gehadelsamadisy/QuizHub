const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || 'quizhub-dev-jwt-secret-change-in-production'
const COOKIE_NAME = 'token'
const COOKIE_MAX_AGE_MS = 1000 * 60 * 60 * 24

function signUserToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  )
}

function verifyUserToken(token) {
  return jwt.verify(token, JWT_SECRET)
}

function getUserFromPayload(payload) {
  return {
    id: payload.sub,
    name: payload.name,
    email: payload.email,
    role: payload.role
  }
}

function cookieOptions() {
  return {
    httpOnly: true,
    maxAge: COOKIE_MAX_AGE_MS,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  }
}

function clearCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/'
  }
}

module.exports = {
  COOKIE_NAME,
  signUserToken,
  verifyUserToken,
  getUserFromPayload,
  cookieOptions,
  clearCookieOptions
}
