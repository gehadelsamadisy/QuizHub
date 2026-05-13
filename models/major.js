const mongoose = require('mongoose')

const majorSchema = new mongoose.Schema({
  name: { type: String, required: true }
})

majorSchema.index({ name: 1 }, { unique: true })

module.exports = mongoose.model('Major', majorSchema)
