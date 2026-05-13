const mongoose = require('mongoose')

const quizSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  majorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Major', required: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  timeLimit: { type: Number, required: true },
  passingScore: { type: Number, required: true },
  maxAttemptsPerStudent: { type: Number, default: 1, min: 1 },
  status: { type: String, enum: ['draft', 'published', 'closed', 'released'], default: 'draft' },
  gradesReleased: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
})

quizSchema.index({ majorId: 1, subjectId: 1, status: 1 })

module.exports = mongoose.model('Quiz', quizSchema)
