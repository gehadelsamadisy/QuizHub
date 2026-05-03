const express = require('express')
const router = express.Router()
const { requireAuth, requireRole } = require('../middleware/auth')
const Quiz = require('../models/quiz')
const Question = require('../models/question')

router.get('/create', requireAuth, requireRole(['teacher']), (req, res) => {
  res.render('quiz/create')
})

router.post('/create', requireAuth, requireRole(['teacher']), async (req, res) => {
  try {
    const { title, description, subject, timeLimit, passingScore } = req.body
    const quiz = new Quiz({
      title,
      description,
      subject,
      timeLimit: parseInt(timeLimit),
      passingScore: parseInt(passingScore),
      createdBy: req.session.user.id
    })
    await quiz.save()
    res.redirect('/quiz/my-quizzes')
  } catch (err) {
    res.render('quiz/create', { error: 'Failed to create quiz' })
  }
})

router.get('/my-quizzes', requireAuth, requireRole(['teacher']), async (req, res) => {
  try {
    const quizzes = await Quiz.find({ createdBy: req.session.user.id })
    res.render('quiz/my-quizzes', { quizzes })
  } catch (err) {
    res.render('quiz/my-quizzes', { quizzes: [] })
  }
})

router.get('/:id/add-questions', requireAuth, requireRole(['teacher']), async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id)
    if (!quiz || quiz.createdBy.toString() !== req.session.user.id) {
      return res.redirect('/quiz/my-quizzes')
    }
    res.render('quiz/add-questions', { quiz })
  } catch (err) {
    res.redirect('/quiz/my-quizzes')
  }
})

router.post('/:id/add-questions', requireAuth, requireRole(['teacher']), async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id)
    if (!quiz || quiz.createdBy.toString() !== req.session.user.id) {
      return res.redirect('/quiz/my-quizzes')
    }

    const { questions } = req.body
    for (const q of questions) {
      const question = new Question({
        quizId: quiz._id,
        text: q.text,
        type: q.type,
        points: parseInt(q.points) || 1,
        options: q.options ? q.options.map((opt, idx) => ({
          text: opt.text,
          isCorrect: idx === parseInt(q.correctOption)
        })) : []
      })
      await question.save()
    }

    res.redirect('/quiz/my-quizzes')
  } catch (err) {
    res.render('quiz/add-questions', { quiz, error: 'Failed to add questions' })
  }
})

router.post('/:id/publish', requireAuth, requireRole(['teacher']), async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id)
    if (quiz && quiz.createdBy.toString() === req.session.user.id && quiz.status === 'draft') {
      quiz.status = 'published'
      await quiz.save()
    }
    res.redirect('/quiz/my-quizzes')
  } catch (err) {
    res.redirect('/quiz/my-quizzes')
  }
})

router.get('/browse', requireAuth, requireRole(['student']), async (req, res) => {
  try {
    const { subject } = req.query
    const filter = { status: 'published' }
    if (subject) filter.subject = subject

    const quizzes = await Quiz.find(filter)
    res.render('quiz/browse', { quizzes, subject })
  } catch (err) {
    res.render('quiz/browse', { quizzes: [] })
  }
})

module.exports = router
