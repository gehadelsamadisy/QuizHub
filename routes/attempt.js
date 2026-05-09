const express = require('express')
const router = express.Router()
const { requireAuth, requireRole } = require('../middleware/auth')
const Attempt = require('../models/attempt')
const Answer = require('../models/answer')
const Quiz = require('../models/quiz')
const Question = require('../models/question')

function stripQuestionsForTake(questions) {
  return questions.map((q) => {
    const o = q.toObject ? q.toObject() : { ...q }
    if (o.type === 'mcq') {
      o.options = (o.options || []).map((opt) => ({ text: opt.text }))
    }
    return o
  })
}

router.get('/history', requireAuth, requireRole(['student']), async (req, res) => {
  try {
    const attempts = await Attempt.find({ studentId: req.user.id })
      .sort({ submittedAt: -1 })
      .populate('quizId', 'title subject passingScore')
    res.render('attempt/history', { attempts })
  } catch (err) {
    res.render('attempt/history', { attempts: [] })
  }
})

router.get('/:attemptId', requireAuth, requireRole(['student']), async (req, res) => {
  try {
    const attempt = await Attempt.findById(req.params.attemptId)
    if (!attempt || attempt.studentId.toString() !== req.user.id) {
      return res.redirect('/quiz/browse')
    }

    const quiz = await Quiz.findById(attempt.quizId)
    if (!quiz) {
      return res.redirect('/quiz/browse')
    }

    const questions = await Question.find({ quizId: quiz._id }).sort({ _id: 1 })

    if (attempt.submittedAt) {
      const answers = await Answer.find({ attemptId: attempt._id })
      const answerMap = Object.fromEntries(
        answers.map((a) => [a.questionId.toString(), a])
      )
      const resultsLocked = attempt.gradesReleased === false
      return res.render('attempt/result', {
        attempt,
        quiz,
        questions,
        answerMap,
        resultsLocked
      })
    }

    const endsAt = new Date(
      attempt.startedAt.getTime() + quiz.timeLimit * 60 * 1000
    )

    res.render('attempt/take', {
      attempt,
      quiz,
      questions: stripQuestionsForTake(questions),
      endsAt: endsAt.toISOString(),
      error: null
    })
  } catch (err) {
    res.redirect('/quiz/browse')
  }
})

router.post('/:attemptId/submit', requireAuth, requireRole(['student']), async (req, res) => {
  try {
    const attempt = await Attempt.findById(req.params.attemptId)
    if (!attempt || attempt.studentId.toString() !== req.user.id || attempt.submittedAt) {
      return res.redirect('/quiz/browse')
    }

    const quiz = await Quiz.findById(attempt.quizId)
    if (!quiz || quiz.status !== 'published') {
      return res.redirect('/quiz/browse')
    }

    const questions = await Question.find({ quizId: quiz._id }).sort({ _id: 1 })
    const deadline = new Date(
      attempt.startedAt.getTime() + quiz.timeLimit * 60 * 1000
    )
    const lateMs = Date.now() - deadline.getTime()

    if (lateMs > 60 * 1000) {
      const endsAt = deadline.toISOString()
      return res.render('attempt/take', {
        attempt,
        quiz,
        questions: stripQuestionsForTake(questions),
        endsAt,
        error: 'Time expired. Submission not accepted.'
      })
    }

    const mcq = req.body.mcq || {}
    const written = req.body.written || {}

    let totalScore = 0
    let needsManualReview = false

    for (const q of questions) {
      const qid = q._id.toString()

      if (q.type === 'mcq') {
        const correctIdx = (q.options || []).findIndex((o) => o.isCorrect)
        const selectedRaw = mcq[qid]
        const selected =
          selectedRaw === undefined || selectedRaw === ''
            ? null
            : parseInt(selectedRaw, 10)
        const correct =
          selected !== null && !Number.isNaN(selected) && selected === correctIdx
        const score = correct ? q.points : 0
        totalScore += score

        await new Answer({
          attemptId: attempt._id,
          questionId: q._id,
          selectedOption: selected,
          isCorrect: correct,
          score
        }).save()
      } else if (q.type === 'written') {
        needsManualReview = true
        const text = written[qid] != null ? String(written[qid]).trim() : ''
        await new Answer({
          attemptId: attempt._id,
          questionId: q._id,
          textAnswer: text,
          score: 0
        }).save()
      } else if (q.type === 'file_upload') {
        needsManualReview = true
        await new Answer({
          attemptId: attempt._id,
          questionId: q._id,
          score: 0
        }).save()
      }
    }

    const maxScore =
      attempt.maxScore ||
      questions.reduce((s, q) => s + (q.points || 1), 0)

    let passed = false
    if (!needsManualReview) {
      passed =
        maxScore > 0 && (totalScore / maxScore) * 100 >= quiz.passingScore
    }

    attempt.totalScore = totalScore
    attempt.maxScore = maxScore
    attempt.passed = passed
    attempt.submittedAt = new Date()
    attempt.gradingStatus = needsManualReview ? 'pending-review' : 'fully-graded'
    attempt.gradesReleased = needsManualReview ? false : true

    await attempt.save()

    res.redirect(`/attempt/${attempt._id}`)
  } catch (err) {
    res.redirect(`/attempt/${req.params.attemptId}`)
  }
})

module.exports = router
