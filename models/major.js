const mongoose = require('mongoose')

const majorSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true },
  name: { type: String, required: true }
})

module.exports = mongoose.model('Major', majorSchema)
