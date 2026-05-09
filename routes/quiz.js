const express = require('express')
const router = express.Router()
const { requireAuth, requireRole } = require('../middleware/auth')
const Quiz = require('../models/quiz')
const Question = require('../models/question')
const Attempt = require('../models/attempt')
const Answer = require('../models/answer')
const User = require('../models/user')

async function deleteQuizAndRelatedData(quizId) {
  const attempts = await Attempt.find({ quizId })
  for (const a of attempts) {
    await Answer.deleteMany({ attemptId: a._id })
  }
  await Attempt.deleteMany({ quizId })
  await Question.deleteMany({ quizId })
  await Quiz.deleteOne({ _id: quizId })
}

function normalizeQuestionsFromBody(body) {
  const q = body.questions
  if (q == null) return []
  if (Array.isArray(q)) return q.filter(Boolean)
  if (typeof q === 'object') {
    return Object.keys(q)
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => q[k])
      .filter(Boolean)
  }
  return []
}

function normalizeOptionList(opts) {
  if (opts == null) return []
  if (Array.isArray(opts)) return opts
  if (typeof opts === 'object') {
    return Object.keys(opts)
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => opts[k])
  }
  return []
}

function buildMcqOptionsFromInput(optArr, correctIdx) {
  return optArr.map((opt, idx) => ({
    text: (opt && opt.text) ? String(opt.text) : '',
    isCorrect: !Number.isNaN(correctIdx) && correctIdx === idx
  }))
}

function validateMcqPayload(opts, correctIdx) {
  if (opts.length < 2) {
    return 'Multiple-choice questions need at least 2 answer options.'
  }
  const nonempty = opts.filter((o) => o.text.trim().length > 0)
  if (nonempty.length < 2) {
    return 'Multiple-choice questions need at least 2 options with text.'
  }
  if (
    Number.isNaN(correctIdx) ||
    correctIdx < 0 ||
    correctIdx >= opts.length
  ) {
    return 'Select a valid correct answer.'
  }
  if (!opts.some((o) => o.isCorrect)) {
    return 'Select which option is correct.'
  }
  return null
}

async function recalculateAttemptFromAnswers(attempt, quiz) {
  const questions = await Question.find({ quizId: attempt.quizId }).sort({ _id: 1 })
  const answers = await Answer.find({ attemptId: attempt._id })
  const byQ = Object.fromEntries(
    answers.map((a) => [a.questionId.toString(), a])
  )
  let max = 0
  let total = 0
  for (const q of questions) {
    max += q.points || 1
    const a = byQ[q._id.toString()]
    if (a && a.score != null) total += a.score
  }
  attempt.maxScore = max
  attempt.totalScore = total
  attempt.passed =
    max > 0 && (total / max) * 100 >= (quiz.passingScore || 0)
}

router.get('/create', requireAuth, requireRole(['teacher']), (req, res) => {
  res.render('quiz/create', { error: null })
})

router.post('/create', requireAuth, requireRole(['teacher']), async (req, res) => {
  try {
    const { title, description, subject, timeLimit, passingScore, maxAttemptsPerStudent } = req.body
    const attemptsRaw = parseInt(maxAttemptsPerStudent, 10)
    const attemptsAllowed =
      Number.isNaN(attemptsRaw) || attemptsRaw < 1 ? 1 : Math.min(50, attemptsRaw)
    const quiz = new Quiz({
      title,
      description,
      subject,
      timeLimit: parseInt(timeLimit),
      passingScore: parseInt(passingScore),
      maxAttemptsPerStudent: attemptsAllowed,
      createdBy: req.user.id
    })
    await quiz.save()
    res.redirect('/quiz/my-quizzes')
  } catch (err) {
    res.render('quiz/create', { error: 'Failed to create quiz' })
  }
})

router.get('/my-quizzes', requireAuth, requireRole(['teacher']), async (req, res) => {
  try {
    const quizzes = await Quiz.find({ createdBy: req.user.id })
    res.render('quiz/my-quizzes', { quizzes })
  } catch (err) {
    res.render('quiz/my-quizzes', { quizzes: [] })
  }
})

router.get('/browse', requireAuth, requireRole(['student']), async (req, res) => {
  try {
    const { subject, msg } = req.query
    const filter = { status: 'published' }
    if (subject) filter.subject = subject

    const quizzes = await Quiz.find(filter)
    res.render('quiz/browse', { quizzes, subject: subject || '', msg: msg || null })
  } catch (err) {
    res.render('quiz/browse', { quizzes: [], subject: '', msg: null })
  }
})

// Literal /settings/ prefix so this always matches (before generic /:id/... routes).
router.get('/settings/:id', requireAuth, requireRole(['teacher']), async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id)
    if (!quiz || quiz.createdBy.toString() !== req.user.id) {
      return res.redirect('/quiz/my-quizzes')
    }
    res.render('quiz/edit', { quiz, error: null })
  } catch (err) {
    res.redirect('/quiz/my-quizzes')
  }
})

router.post('/settings/:id', requireAuth, requireRole(['teacher']), async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id)
    if (!quiz || quiz.createdBy.toString() !== req.user.id) {
      return res.redirect('/quiz/my-quizzes')
    }
    const { title, description, subject, timeLimit, passingScore, maxAttemptsPerStudent } =
      req.body
    const titleTrim = String(title || '').trim()
    const subjectTrim = String(subject || '').trim()
    if (!titleTrim || !subjectTrim) {
      return res.render('quiz/edit', {
        quiz,
        error: 'Title and subject are required.'
      })
    }
    const attemptsRaw = parseInt(maxAttemptsPerStudent, 10)
    const attemptsAllowed =
      Number.isNaN(attemptsRaw) || attemptsRaw < 1 ? 1 : Math.min(50, attemptsRaw)
    const timeRaw = parseInt(timeLimit, 10)
    const passRaw = parseInt(passingScore, 10)

    quiz.title = titleTrim
    quiz.description = description != null ? String(description) : ''
    quiz.subject = subjectTrim
    quiz.timeLimit = Number.isNaN(timeRaw) || timeRaw < 1 ? quiz.timeLimit : timeRaw
    quiz.passingScore = Number.isNaN(passRaw)
      ? quiz.passingScore
      : Math.min(100, Math.max(0, passRaw))
    quiz.maxAttemptsPerStudent = attemptsAllowed

    await quiz.save()

    const submittedAttempts = await Attempt.find({
      quizId: quiz._id,
      submittedAt: { $exists: true, $ne: null }
    })
    for (const att of submittedAttempts) {
      await recalculateAttemptFromAnswers(att, quiz)
      await att.save()
    }

    res.redirect(`/quiz/${quiz._id}/view`)
  } catch (err) {
    const quiz = await Quiz.findById(req.params.id).catch(() => null)
    if (quiz) {
      res.render('quiz/edit', { quiz, error: 'Failed to save quiz settings.' })
    } else {
      res.redirect('/quiz/my-quizzes')
    }
  }
})

router.get('/:id/submissions', requireAuth, requireRole(['teacher']), async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id)
    if (!quiz || quiz.createdBy.toString() !== req.user.id) {
      return res.redirect('/quiz/my-quizzes')
    }
    const attempts = await Attempt.find({
      quizId: quiz._id,
      submittedAt: { $exists: true, $ne: null }
    })
      .sort({ submittedAt: -1 })
      .populate('studentId', 'name email')
    res.render('quiz/submissions', { quiz, attempts })
  } catch (err) {
    res.redirect('/quiz/my-quizzes')
  }
})

router.get('/:id/submissions/:attemptId', requireAuth, requireRole(['teacher']), async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id)
    if (!quiz || quiz.createdBy.toString() !== req.user.id) {
      return res.redirect('/quiz/my-quizzes')
    }
    const attempt = await Attempt.findById(req.params.attemptId)
    if (!attempt || attempt.quizId.toString() !== quiz._id.toString()) {
      return res.redirect(`/quiz/${quiz._id}/submissions`)
    }
    const student = await User.findById(attempt.studentId).select('name email')
    const questions = await Question.find({ quizId: quiz._id }).sort({ _id: 1 })
    const answers = await Answer.find({ attemptId: attempt._id })
    const answerMap = Object.fromEntries(
      answers.map((a) => [a.questionId.toString(), a])
    )
    res.render('quiz/grade-attempt', {
      quiz,
      attempt,
      student,
      questions,
      answerMap,
      error: null
    })
  } catch (err) {
    res.redirect('/quiz/my-quizzes')
  }
})

router.post('/:id/submissions/:attemptId', requireAuth, requireRole(['teacher']), async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id)
    if (!quiz || quiz.createdBy.toString() !== req.user.id) {
      return res.redirect('/quiz/my-quizzes')
    }
    const attempt = await Attempt.findById(req.params.attemptId)
    if (!attempt || attempt.quizId.toString() !== quiz._id.toString()) {
      return res.redirect(`/quiz/${quiz._id}/submissions`)
    }

    const questions = await Question.find({ quizId: quiz._id }).sort({ _id: 1 })
    const scores = req.body.scores || {}
    const wantsRelease =
      req.body.releaseGrades === 'on' ||
      req.body.releaseGrades === 'true' ||
      req.body.releaseGrades === '1'

    const manualQuestions = questions.filter(
      (q) => q.type === 'written' || q.type === 'file_upload'
    )

    if (manualQuestions.length === 0) {
      return res.redirect(`/quiz/${quiz._id}/submissions`)
    }

    if (wantsRelease && manualQuestions.length > 0) {
      for (const q of manualQuestions) {
        const raw = scores[q._id.toString()]
        if (raw === undefined || raw === '' || Number.isNaN(parseFloat(raw))) {
          const student = await User.findById(attempt.studentId).select('name email')
          const answers = await Answer.find({ attemptId: attempt._id })
          const answerMap = Object.fromEntries(
            answers.map((a) => [a.questionId.toString(), a])
          )
          return res.render('quiz/grade-attempt', {
            quiz,
            attempt,
            student,
            questions,
            answerMap,
            error:
              'Enter a numeric score for every written/file question before releasing grades.'
          })
        }
      }
    }

    for (const q of manualQuestions) {
      const raw = scores[q._id.toString()]
      const parsed = parseFloat(raw)
      const pts = Number.isNaN(parsed)
        ? 0
        : Math.max(0, Math.min(q.points || 1, parsed))
      await Answer.updateOne(
        { attemptId: attempt._id, questionId: q._id },
        { $set: { score: pts } }
      )
    }

    await recalculateAttemptFromAnswers(attempt, quiz)
    attempt.gradingStatus = 'fully-graded'
    if (wantsRelease) {
      attempt.gradesReleased = true
    }
    await attempt.save()

    res.redirect(`/quiz/${quiz._id}/submissions`)
  } catch (err) {
    res.redirect(`/quiz/${req.params.id}/submissions`)
  }
})

router.get('/:quizId/questions/:questionId/edit', requireAuth, requireRole(['teacher']), async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.quizId)
    if (!quiz || quiz.createdBy.toString() !== req.user.id || quiz.status === 'closed') {
      return res.redirect('/quiz/my-quizzes')
    }
    const question = await Question.findOne({
      _id: req.params.questionId,
      quizId: quiz._id
    })
    if (!question) {
      return res.redirect(`/quiz/${req.params.quizId}/view`)
    }
    let correctIdx = 0
    if (question.type === 'mcq' && question.options && question.options.length) {
      const i = question.options.findIndex((o) => o.isCorrect)
      correctIdx = i >= 0 ? i : 0
    }
    res.render('quiz/edit-question', {
      quiz,
      question,
      correctIdx,
      error: null
    })
  } catch (err) {
    res.redirect('/quiz/my-quizzes')
  }
})

router.post('/:quizId/questions/:questionId/edit', requireAuth, requireRole(['teacher']), async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.quizId)
    if (!quiz || quiz.createdBy.toString() !== req.user.id || quiz.status === 'closed') {
      return res.redirect('/quiz/my-quizzes')
    }
    const question = await Question.findOne({
      _id: req.params.questionId,
      quizId: quiz._id
    })
    if (!question) {
      return res.redirect(`/quiz/${req.params.quizId}/view`)
    }

    const { text, type, points, correctOption } = req.body
    const optArr = normalizeOptionList(req.body.options)
    const correctIdx = Number.parseInt(String(correctOption), 10)

    const trimmedText = String(text || '').trim()
    if (!trimmedText) {
      let correctIdxDisplay = 0
      if (question.options && question.options.length) {
        const i = question.options.findIndex((o) => o.isCorrect)
        correctIdxDisplay = i >= 0 ? i : 0
      }
      return res.render('quiz/edit-question', {
        quiz,
        question,
        correctIdx: correctIdxDisplay,
        error: 'Question text is required.'
      })
    }
    question.text = trimmedText
    question.type = ['mcq', 'written', 'file_upload'].includes(type) ? type : question.type
    question.points = Math.max(1, parseInt(String(points), 10) || 1)

    if (question.type === 'mcq') {
      const opts = buildMcqOptionsFromInput(optArr, correctIdx)
      const err = validateMcqPayload(opts, correctIdx)
      if (err) {
        let correctIdxDisplay = 0
        if (question.options && question.options.length) {
          const i = question.options.findIndex((o) => o.isCorrect)
          correctIdxDisplay = i >= 0 ? i : 0
        }
        return res.render('quiz/edit-question', {
          quiz,
          question,
          correctIdx: correctIdxDisplay,
          error: err
        })
      }
      question.options = opts
    } else {
      question.options = []
    }

    await question.save()
    res.redirect(`/quiz/${quiz._id}/view`)
  } catch (err) {
    const quiz = await Quiz.findById(req.params.quizId).catch(() => null)
    if (quiz) {
      const question = await Question.findById(req.params.questionId).catch(() => null)
      if (question) {
        let correctIdx = 0
        if (question.type === 'mcq' && question.options && question.options.length) {
          const i = question.options.findIndex((o) => o.isCorrect)
          correctIdx = i >= 0 ? i : 0
        }
        return res.render('quiz/edit-question', {
          quiz,
          question,
          correctIdx,
          error: 'Could not save changes.'
        })
      }
    }
    res.redirect('/quiz/my-quizzes')
  }
})

router.get('/:id/take', requireAuth, requireRole(['student']), async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id)
    if (!quiz || quiz.status !== 'published') {
      const msg = encodeURIComponent('That quiz is not available.')
      return res.redirect(`/quiz/browse?msg=${msg}`)
    }

    const questionCount = await Question.countDocuments({ quizId: quiz._id })
    if (questionCount === 0) {
      const msg = encodeURIComponent('This quiz has no questions yet.')
      return res.redirect(`/quiz/browse?msg=${msg}`)
    }

    const maxAttempts = Math.max(1, quiz.maxAttemptsPerStudent || 1)
    const completedCount = await Attempt.countDocuments({
      studentId: req.user.id,
      quizId: quiz._id,
      submittedAt: { $exists: true, $ne: null }
    })
    if (completedCount >= maxAttempts) {
      const msg = encodeURIComponent(
        `You have used all ${maxAttempts} allowed attempt(s) for this quiz.`
      )
      return res.redirect(`/quiz/browse?msg=${msg}`)
    }

    let attempt = await Attempt.findOne({
      studentId: req.user.id,
      quizId: quiz._id,
      gradingStatus: 'in-progress'
    })

    if (!attempt) {
      const questions = await Question.find({ quizId: quiz._id })
      const maxScore = questions.reduce((s, q) => s + (q.points || 1), 0)
      attempt = new Attempt({
        studentId: req.user.id,
        quizId: quiz._id,
        maxScore,
        gradingStatus: 'in-progress'
      })
      await attempt.save()
    }

    res.redirect(`/attempt/${attempt._id}`)
  } catch (err) {
    const msg = encodeURIComponent('Could not start the quiz. Try again.')
    res.redirect(`/quiz/browse?msg=${msg}`)
  }
})

router.get('/:id/view', requireAuth, requireRole(['teacher']), async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id)
    if (!quiz || quiz.createdBy.toString() !== req.user.id) {
      return res.redirect('/quiz/my-quizzes')
    }
    const questions = await Question.find({ quizId: quiz._id }).sort({ _id: 1 })
    res.render('quiz/view', { quiz, questions })
  } catch (err) {
    res.redirect('/quiz/my-quizzes')
  }
})

router.get('/:id/edit', requireAuth, requireRole(['teacher']), (req, res) => {
  res.redirect(302, `/quiz/settings/${req.params.id}`)
})

router.get('/:id/add-questions', requireAuth, requireRole(['teacher']), async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id)
    if (!quiz || quiz.createdBy.toString() !== req.user.id) {
      return res.redirect('/quiz/my-quizzes')
    }
    if (quiz.status === 'closed') {
      return res.redirect('/quiz/my-quizzes')
    }
    res.render('quiz/add-questions', { quiz, error: null })
  } catch (err) {
    res.redirect('/quiz/my-quizzes')
  }
})

router.post('/:id/add-questions', requireAuth, requireRole(['teacher']), async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id)
    if (!quiz || quiz.createdBy.toString() !== req.user.id) {
      return res.redirect('/quiz/my-quizzes')
    }
    if (quiz.status === 'closed') {
      return res.redirect('/quiz/my-quizzes')
    }

    const questionList = normalizeQuestionsFromBody(req.body)
    if (questionList.length === 0) {
      return res.render('quiz/add-questions', {
        quiz,
        error: 'Add at least one question before saving.'
      })
    }

    for (const q of questionList) {
      const optArr = normalizeOptionList(q.options)
      const correctIdx = Number.parseInt(String(q.correctOption), 10)
      const opts =
        q.type === 'mcq'
          ? buildMcqOptionsFromInput(optArr, correctIdx)
          : []
      if (q.type === 'mcq') {
        const err = validateMcqPayload(opts, correctIdx)
        if (err) {
          return res.render('quiz/add-questions', { quiz, error: err })
        }
      }
      const question = new Question({
        quizId: quiz._id,
        text: q.text,
        type: q.type,
        points: parseInt(q.points, 10) || 1,
        options: opts
      })
      await question.save()
    }

    res.redirect('/quiz/my-quizzes')
  } catch (err) {
    const quiz = await Quiz.findById(req.params.id).catch(() => null)
    if (quiz) {
      res.render('quiz/add-questions', { quiz, error: 'Failed to add questions' })
    } else {
      res.redirect('/quiz/my-quizzes')
    }
  }
})

router.post('/:id/close', requireAuth, requireRole(['teacher']), async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id)
    if (quiz && quiz.createdBy.toString() === req.user.id && quiz.status === 'published') {
      quiz.status = 'closed'
      await quiz.save()
    }
    res.redirect('/quiz/my-quizzes')
  } catch (err) {
    res.redirect('/quiz/my-quizzes')
  }
})

router.post('/:id/reopen', requireAuth, requireRole(['teacher']), async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id)
    if (quiz && quiz.createdBy.toString() === req.user.id && quiz.status === 'closed') {
      quiz.status = 'published'
      await quiz.save()
    }
    res.redirect('/quiz/my-quizzes')
  } catch (err) {
    res.redirect('/quiz/my-quizzes')
  }
})

router.post('/:id/delete', requireAuth, requireRole(['teacher']), async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id)
    if (!quiz || quiz.createdBy.toString() !== req.user.id) {
      return res.redirect('/quiz/my-quizzes')
    }
    await deleteQuizAndRelatedData(quiz._id)
    res.redirect('/quiz/my-quizzes')
  } catch (err) {
    res.redirect('/quiz/my-quizzes')
  }
})

router.post('/:id/publish', requireAuth, requireRole(['teacher']), async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id)
    if (quiz && quiz.createdBy.toString() === req.user.id && quiz.status === 'draft') {
      quiz.status = 'published'
      await quiz.save()
    }
    res.redirect('/quiz/my-quizzes')
  } catch (err) {
    res.redirect('/quiz/my-quizzes')
  }
})

module.exports = router
