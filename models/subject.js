const mongoose = require('mongoose')

const subjectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  majorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Major', required: true }
})

subjectSchema.index({ majorId: 1, name: 1 }, { unique: true })

module.exports = mongoose.model('Subject', subjectSchema)
