const express = require('express')
const router = express.Router()
const User = require('../models/user')
const bcrypt = require('bcrypt')
const { COOKIE_NAME, signUserToken, cookieOptions, clearCookieOptions } = require('../lib/jwt')
const { SUBJECTS_BY_MAJOR, SUBJECT_LABELS, validateSubjectsForMajor } = require('../lib/subjectMapping')

router.get('/register', (req, res) => {
  res.render('register', {
    error: null,
    subjectsByMajor: JSON.stringify(SUBJECTS_BY_MAJOR),
    subjectLabels: JSON.stringify(SUBJECT_LABELS)
  })
})

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body
    const hashedPassword = await bcrypt.hash(password, 10)
    const userData = { name, email, password: hashedPassword, role }

    if (role === 'student') {
      const { major, registeredSubjects } = req.body
      const subjectArray = Array.isArray(registeredSubjects)
        ? registeredSubjects
        : [registeredSubjects].filter(Boolean)

      if (!major || subjectArray.length === 0) {
        throw new Error('Student registration requires major and at least one subject.')
      }

      if (!validateSubjectsForMajor(major, subjectArray)) {
        throw new Error('Selected subjects do not match the chosen major.')
      }

      userData.major = major
      userData.registeredSubjects = subjectArray
    } else {
      userData.registeredSubjects = []
    }

    const user = new User(userData)
    await user.save()
    res.redirect('/login')
  } catch (err) {
    if (err.code === 11000) {
      res.render('register', {
        error: 'Email already exists',
        subjectsByMajor: JSON.stringify(SUBJECTS_BY_MAJOR),
        subjectLabels: JSON.stringify(SUBJECT_LABELS)
      })
    } else {
      res.render('register', {
        error: 'Registration failed: ' + err.message,
        subjectsByMajor: JSON.stringify(SUBJECTS_BY_MAJOR),
        subjectLabels: JSON.stringify(SUBJECT_LABELS)
      })
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
