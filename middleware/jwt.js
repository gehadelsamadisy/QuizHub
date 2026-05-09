const {
  COOKIE_NAME,
  verifyUserToken,
  getUserFromPayload,
  clearCookieOptions
} = require('../lib/jwt')

const attachUser = (req, res, next) => {
  const token = req.cookies[COOKIE_NAME]
  if (!token) {
    req.user = null
    return next()
  }
  try {
    const payload = verifyUserToken(token)
    req.user = getUserFromPayload(payload)
  } catch {
    res.clearCookie(COOKIE_NAME, clearCookieOptions())
    req.user = null
  }
  next()
}

module.exports = { attachUser }
