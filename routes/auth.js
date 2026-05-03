const express = require('express')
const router = express.Router()
const User = require('../models/user')

router.get('/register', (req, res) => {
  res.render('register')
})

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body
    const user = new User({ name, email, password, role })
    await user.save()
    res.redirect('/login')
  } catch (err) {
    res.render('register', { error: 'Email already exists' })
  }
})

router.get('/login', (req, res) => {
  res.render('login')
})

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    const user = await User.findOne({ email })
    if (!user || !user.isActive) {
      return res.render('login', { error: 'Invalid credentials' })
    }
    const isMatch = await user.comparePassword(password)
    if (!isMatch) {
      return res.render('login', { error: 'Invalid credentials' })
    }
    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    }
    res.redirect('/')
  } catch (err) {
    res.render('login', { error: 'Login failed' })
  }
})

router.get('/logout', (req, res) => {
  req.session.destroy()
  res.redirect('/login')
})

module.exports = router
