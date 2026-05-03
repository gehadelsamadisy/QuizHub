const mongoose = require('mongoose')

const quizSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  subject: { type: String, required: true },
  timeLimit: { type: Number, required: true },
  passingScore: { type: Number, required: true },
  status: { type: String, enum: ['draft', 'published', 'closed'], default: 'draft' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
})

module.exports = mongoose.model('Quiz', quizSchema)
