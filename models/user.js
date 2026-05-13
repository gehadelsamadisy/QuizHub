const mongoose = require('mongoose')
const bcrypt = require('bcrypt')

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'teacher'], default: 'student' },
  major: {
    type: String,
    enum: ['mechanical-engineering', 'computer-engineering', 'mechatronics-engineering'],
    required: function() { return this.role === 'student' }
  },
  registeredSubjects: {
    type: [{
      type: String,
      enum: [
        'algorithms', 'data-structures', 'databases', 'operating-systems', 'networks',
        'machine-learning', 'embedded-systems', 'control-systems', 'thermodynamics',
        'fluid-mechanics', 'web-development'
      ],
      required: function() { return this.role === 'student' }
    }],
    default: []
  },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
})

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password)
}

module.exports = mongoose.model('User', userSchema)
