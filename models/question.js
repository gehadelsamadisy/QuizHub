const mongoose = require('mongoose')

const optionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  isCorrect: { type: Boolean, default: false }
})

const questionSchema = new mongoose.Schema({
  quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
  text: { type: String, required: true },
  type: { type: String, enum: ['mcq', 'written', 'file_upload'], required: true },
  image: { type: String },
  points: { type: Number, default: 1 },
  options: [optionSchema]
})

module.exports = mongoose.model('Question', questionSchema)
