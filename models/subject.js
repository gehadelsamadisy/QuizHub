const mongoose = require('mongoose')

const subjectSchema = new mongoose.Schema({
  slug: { type: String, required: true },
  name: { type: String, required: true },
  majorSlug: { type: String, required: true }
})

subjectSchema.index({ majorSlug: 1, slug: 1 }, { unique: true })

module.exports = mongoose.model('Subject', subjectSchema)
