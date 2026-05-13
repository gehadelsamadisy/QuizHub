const express = require('express')
const router = express.Router()

const { requireAuth, requireRole } = require('../middleware/auth')
const User = require('../models/user')
const Quiz = require('../models/quiz')
const Attempt = require('../models/attempt')
const Answer = require('../models/answer')
const Question = require('../models/question')
const Major = require('../models/major')
const Subject = require('../models/subject')

function normalizeObjectId(value) {
  if (!value) return ''
  // Handle populated objects (have _id property)
  if (value && typeof value === 'object' && value._id) {
    return String(value._id)
  }
  // Handle ObjectId instances or strings
  return String(value)
}

async function deleteQuizAndRelatedData(quizId) {
  const attempts = await Attempt.find({ quizId }).lean()
  for (const attempt of attempts) {
    await Answer.deleteMany({ attemptId: attempt._id })
  }
  await Attempt.deleteMany({ quizId })
  await Question.deleteMany({ quizId })
  await Quiz.deleteOne({ _id: quizId })
}

async function buildAdminDashboard() {
  const [users, quizzes, majors, subjects, totalUsers, totalQuizzes, totalAttempts] =
    await Promise.all([
      User.find().sort({ createdAt: -1 }).populate('majorId', 'name').lean(),
      Quiz.find()
        .sort({ createdAt: -1 })
        .populate('majorId', 'name')
        .populate('subjectId', 'name')
        .populate('createdBy', 'name email role isActive')
        .lean(),
      Major.find().sort({ name: 1 }).lean(),
      Subject.find()
        .sort({ name: 1 })
        .populate('majorId', 'name')
        .lean(),
      User.countDocuments(),
      Quiz.countDocuments(),
      Attempt.countDocuments()
    ])

  const subjectCountByMajor = subjects.reduce((acc, subject) => {
    const majorKey = normalizeObjectId(subject.majorId)
    acc[majorKey] = (acc[majorKey] || 0) + 1
    return acc
  }, {})

  const majorsWithCounts = majors.map((major) => ({
    ...major,
    subjectCount: subjectCountByMajor[normalizeObjectId(major._id)] || 0
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

function redirectWithMessage(res, type, message) {
  return res.redirect(`/admin/users?${type}=${encodeURIComponent(message)}`)
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
    if (normalizeObjectId(req.params.id) === normalizeObjectId(req.user.id)) {
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
  } catch {
    return redirectWithMessage(res, 'error', 'Failed to update user status.')
  }
})

router.post('/majors', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const name = String(req.body.name || '').trim()
    if (!name) {
      return redirectWithMessage(res, 'error', 'Major name is required.')
    }

    await Major.create({ name })
    return redirectWithMessage(res, 'success', `Major "${name}" added.`)
  } catch (err) {
    if (err && err.code === 11000) {
      return redirectWithMessage(res, 'error', 'That major already exists.')
    }
    return redirectWithMessage(res, 'error', 'Failed to add major.')
  }
})

router.post('/majors/:id/delete', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const major = await Major.findById(req.params.id)
    if (!major) {
      return redirectWithMessage(res, 'error', 'Major not found.')
    }

    const subjects = await Subject.find({ majorId: major._id }).lean()
    for (const subject of subjects) {
      const quizzes = await Quiz.find({ subjectId: subject._id }).lean()
      for (const quiz of quizzes) {
        await deleteQuizAndRelatedData(quiz._id)
      }
      await Subject.deleteOne({ _id: subject._id })
    }

    const majorQuizzes = await Quiz.find({ majorId: major._id }).lean()
    for (const quiz of majorQuizzes) {
      await deleteQuizAndRelatedData(quiz._id)
    }

    await Major.deleteOne({ _id: major._id })
    return redirectWithMessage(res, 'success', `Major "${major.name}" removed.`)
  } catch {
    return redirectWithMessage(res, 'error', 'Failed to remove major.')
  }
})

router.post('/subjects', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const name = String(req.body.name || '').trim()
    const majorId = String(req.body.majorId || '').trim()
    if (!name || !majorId) {
      return redirectWithMessage(res, 'error', 'Subject name and major are required.')
    }

    const major = await Major.findById(majorId)
    if (!major) {
      return redirectWithMessage(res, 'error', 'Selected major does not exist.')
    }

    await Subject.create({ name, majorId })
    return redirectWithMessage(res, 'success', `Subject "${name}" added.`)
  } catch (err) {
    if (err && err.code === 11000) {
      return redirectWithMessage(res, 'error', 'That subject already exists for this major.')
    }
    return redirectWithMessage(res, 'error', 'Failed to add subject.')
  }
})

router.post('/subjects/:id/delete', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id)
      .populate('majorId', 'name')
    if (!subject) {
      return redirectWithMessage(res, 'error', 'Subject not found.')
    }

    const quizzes = await Quiz.find({ subjectId: subject._id }).lean()
    for (const quiz of quizzes) {
      await deleteQuizAndRelatedData(quiz._id)
    }

    await Subject.deleteOne({ _id: subject._id })
    return redirectWithMessage(res, 'success', `Subject "${subject.name}" removed.`)
  } catch {
    return redirectWithMessage(res, 'error', 'Failed to remove subject.')
  }
})

module.exports = router
