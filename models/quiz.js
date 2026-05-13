const mongoose = require('mongoose')

const quizSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  major: { type: String, required: true },
  subject: { type: String, required: true },
  timeLimit: { type: Number, required: true },
  passingScore: { type: Number, required: true },
  maxAttemptsPerStudent: { type: Number, default: 1, min: 1 },
  status: { type: String, enum: ['draft', 'published', 'closed'], default: 'draft' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
})

module.exports = mongoose.model('Quiz', quizSchema)
