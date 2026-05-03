const mongoose = require('mongoose')

const answerSchema = new mongoose.Schema({
  attemptId: { type: mongoose.Schema.Types.ObjectId, ref: 'Attempt', required: true },
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
  selectedOption: { type: Number },
  textAnswer: { type: String },
  uploadedFile: { type: String },
  isCorrect: { type: Boolean },
  score: { type: Number, default: 0 }
})

module.exports = mongoose.model('Answer', answerSchema)
