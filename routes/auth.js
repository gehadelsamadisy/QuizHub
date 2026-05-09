const express = require('express')
const router = express.Router()
const User = require('../models/user')
const bcrypt = require('bcrypt')
const { COOKIE_NAME, signUserToken, cookieOptions, clearCookieOptions } = require('../lib/jwt')

router.get('/register', (req, res) => {
  res.render('register', { error: null })
})

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body
    const hashedPassword = await bcrypt.hash(password, 10)
    const user = new User({ name, email, password: hashedPassword, role })
    await user.save()
    res.redirect('/login')
  } catch (err) {
    if (err.code === 11000) {
      res.render('register', { error: 'Email already exists' })
    } else {
      res.render('register', { error: 'Registration failed: ' + err.message })
    }
  }
})

router.get('/login', (req, res) => {
  res.render('login', { error: null })
})

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    const user = await User.findOne({ email })
    if (!user || !user.isActive) {
      return res.render('login', { error: 'Invalid email or password' })
    }
    const isMatch = await user.comparePassword(password)
    if (!isMatch) {
      return res.render('login', { error: 'Invalid email or password' })
    }
    const token = signUserToken(user)
    res.cookie(COOKIE_NAME, token, cookieOptions())
    res.redirect('/')
  } catch (err) {
    res.render('login', { error: 'Login failed: ' + err.message })
  }
})

router.get('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, clearCookieOptions())
  res.redirect('/login')
})

module.exports = router
