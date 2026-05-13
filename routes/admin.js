const express = require('express')
const router = express.Router()

const { requireAuth, requireRole } = require('../middleware/auth')
const User = require('../models/user')
const Quiz = require('../models/quiz')
const Attempt = require('../models/attempt')
const Major = require('../models/major')
const Subject = require('../models/subject')

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function redirectWithMessage(res, type, message) {
  return res.redirect(`/admin/users?${type}=${encodeURIComponent(message)}`)
}

async function buildAdminDashboard() {
  const [users, quizzes, majors, subjects, totalUsers, totalQuizzes, totalAttempts] =
    await Promise.all([
      User.find().sort({ createdAt: -1 }).lean(),
      Quiz.find()
        .sort({ createdAt: -1 })
        .populate('createdBy', 'name email role isActive')
        .lean(),
      Major.find().sort({ name: 1 }).lean(),
      Subject.find().sort({ name: 1 }).lean(),
      User.countDocuments(),
      Quiz.countDocuments(),
      Attempt.countDocuments()
    ])

  const subjectCountByMajor = subjects.reduce((acc, subject) => {
    acc[subject.majorSlug] = (acc[subject.majorSlug] || 0) + 1
    return acc
  }, {})

  const majorsWithCounts = majors.map((major) => ({
    ...major,
    subjectCount: subjectCountByMajor[major.slug] || 0
  }))

  return {
    users,
    quizzes,
    majors: majorsWithCounts,
    subjects,
    stats: {
      totalUsers,
      totalQuizzes,
      totalAttempts
    }
  }
}

async function renderAdminPage(res, options = {}) {
  const data = await buildAdminDashboard()
  return res.render('admin/dashboard', {
    ...data,
    currentUserId: options.currentUserId || null,
    error: null,
    success: null,
    ...options
  })
}

router.get('/', requireAuth, requireRole(['admin']), async (req, res) => {
  return res.redirect('/admin/users')
})

router.get('/users', requireAuth, requireRole(['admin']), async (req, res) => {
  const { error, success } = req.query
  return renderAdminPage(res, {
    currentUserId: req.user.id,
    error: error || null,
    success: success || null
  })
})

router.post('/users/:id/status', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return redirectWithMessage(res, 'error', 'You cannot deactivate your own account.')
    }

    const nextState = String(req.body.nextState || '').toLowerCase()
    if (!['true', 'false'].includes(nextState)) {
      return redirectWithMessage(res, 'error', 'Invalid account status update.')
    }

    const user = await User.findById(req.params.id)
    if (!user) {
      return redirectWithMessage(res, 'error', 'User not found.')
    }

    user.isActive = nextState === 'true'
    await user.save()
    return redirectWithMessage(
      res,
      'success',
      `${user.name} has been ${user.isActive ? 'activated' : 'deactivated'}.`
    )
  } catch (err) {
    return redirectWithMessage(res, 'error', 'Failed to update user status.')
  }
})

router.post('/majors', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const name = String(req.body.name || '').trim()
    const slugInput = String(req.body.slug || '').trim()
    const slug = slugify(slugInput || name)

    if (!name || !slug) {
      return redirectWithMessage(res, 'error', 'Major name is required.')
    }

    await Major.create({ name, slug })
    return redirectWithMessage(res, 'success', `Major "${name}" added.`)
  } catch (err) {
    if (err && err.code === 11000) {
      return redirectWithMessage(res, 'error', 'That major slug already exists.')
    }
    return redirectWithMessage(res, 'error', 'Failed to add major.')
  }
})

router.post('/majors/:slug/delete', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const majorSlug = String(req.params.slug || '').trim()
    const major = await Major.findOne({ slug: majorSlug })
    if (!major) {
      return redirectWithMessage(res, 'error', 'Major not found.')
    }

    await Subject.deleteMany({ majorSlug })
    await Major.deleteOne({ slug: majorSlug })
    return redirectWithMessage(res, 'success', `Major "${major.name}" removed.`)
  } catch (err) {
    return redirectWithMessage(res, 'error', 'Failed to remove major.')
  }
})

router.post('/subjects', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const name = String(req.body.name || '').trim()
    const slugInput = String(req.body.slug || '').trim()
    const majorSlug = String(req.body.majorSlug || '').trim()
    const slug = slugify(slugInput || name)

    if (!name || !slug || !majorSlug) {
      return redirectWithMessage(res, 'error', 'Subject name and major are required.')
    }

    const major = await Major.findOne({ slug: majorSlug })
    if (!major) {
      return redirectWithMessage(res, 'error', 'Selected major does not exist.')
    }

    await Subject.create({ name, slug, majorSlug })
    return redirectWithMessage(res, 'success', `Subject "${name}" added.`)
  } catch (err) {
    if (err && err.code === 11000) {
      return redirectWithMessage(res, 'error', 'That subject slug already exists for this major.')
    }
    return redirectWithMessage(res, 'error', 'Failed to add subject.')
  }
})

router.post('/subjects/:majorSlug/:slug/delete', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const majorSlug = String(req.params.majorSlug || '').trim()
    const slug = String(req.params.slug || '').trim()
    const subject = await Subject.findOne({ majorSlug, slug })
    if (!subject) {
      return redirectWithMessage(res, 'error', 'Subject not found.')
    }

    await Subject.deleteOne({ majorSlug, slug })
    return redirectWithMessage(res, 'success', `Subject "${subject.name}" removed.`)
  } catch (err) {
    return redirectWithMessage(res, 'error', 'Failed to remove subject.')
  }
})

module.exports = router
