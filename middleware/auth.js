const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/login')
  }
  next()
}

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.redirect('/login')
    }
    if (!roles.includes(req.session.user.role)) {
      return res.status(403).render('error', { message: 'Access denied' })
    }
    next()
  }
}

module.exports = { requireAuth, requireRole }
