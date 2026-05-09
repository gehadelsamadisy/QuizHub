const mongoose = require('mongoose')

const attemptSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
  totalScore: { type: Number, default: 0 },
  maxScore: { type: Number, default: 0 },
  passed: { type: Boolean, default: false },
  gradingStatus: {
    type: String,
    enum: ['in-progress', 'auto-graded', 'pending-review', 'fully-graded'],
    default: 'in-progress'
  },
  startedAt: { type: Date, default: Date.now },
  submittedAt: { type: Date },
  gradesReleased: { type: Boolean, default: false }
})

module.exports = mongoose.model('Attempt', attemptSchema)
