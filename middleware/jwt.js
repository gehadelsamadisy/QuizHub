const {
  COOKIE_NAME,
  verifyUserToken,
  getUserFromPayload,
  clearCookieOptions
} = require('../lib/jwt')
const User = require('../models/user')

const attachUser = async (req, res, next) => {
  const token = req.cookies[COOKIE_NAME]
  if (!token) {
    req.user = null
    return next()
  }
  try {
    const payload = verifyUserToken(token)
    const user = await User.findById(payload.sub).lean()
    if (!user || user.isActive === false) {
      res.clearCookie(COOKIE_NAME, clearCookieOptions())
      req.user = null
      return next()
    }
    req.user = getUserFromPayload({
      ...payload,
      role: user.role,
      majorId: user.majorId ? user.majorId.toString() : null,
      registeredSubjects: Array.isArray(user.registeredSubjects)
        ? user.registeredSubjects.map((id) => id.toString())
        : []
    })
  } catch {
    res.clearCookie(COOKIE_NAME, clearCookieOptions())
    req.user = null
  }
  next()
}

module.exports = { attachUser }
