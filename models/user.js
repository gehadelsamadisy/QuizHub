const mongoose = require('mongoose')
const bcrypt = require('bcrypt')

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'teacher', 'admin'], default: 'student' },
  major: {
    type: String,
    required: function() { return this.role === 'student' }
  },
  registeredSubjects: {
    type: [{ type: String }],
    default: []
  },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
})

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password)
}

module.exports = mongoose.model('User', userSchema)
