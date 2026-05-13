const express = require('express')
const router = express.Router()
const User = require('../models/user')
const bcrypt = require('bcrypt')
const { COOKIE_NAME, signUserToken, cookieOptions, clearCookieOptions } = require('../lib/jwt')
const {
  getMajors,
  getSubjectsForForms,
  validateSubjectsForMajor,
  isValidMajor
} = require('../lib/academicData')

async function renderRegisterPage(res, options = {}) {
  const majors = await getMajors()
  const subjects = await getSubjectsForForms()
  res.render('register', {
    majors,
    subjects,
    error: null,
    role: 'student',
    selectedMajor: '',
    selectedSubjects: [],
    ...options
  })
}

router.get('/register', async (req, res) => {
  await renderRegisterPage(res)
})

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, major, registeredSubjects } = req.body
    if (!['student', 'teacher'].includes(role)) {
      throw new Error('Invalid role selected.')
    }
    const hashedPassword = await bcrypt.hash(password, 10)
    const userData = { name, email, password: hashedPassword, role }

    if (role === 'student') {
      const subjectArray = Array.isArray(registeredSubjects)
        ? registeredSubjects
        : [registeredSubjects].filter(Boolean)

      if (!major || subjectArray.length === 0) {
        throw new Error('Student registration requires major and at least one subject.')
      }

      const majorExists = await isValidMajor(major)
      if (!majorExists) {
        throw new Error('Selected major is invalid.')
      }

      const validSubjects = await validateSubjectsForMajor(major, subjectArray)
      if (!validSubjects) {
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
      await renderRegisterPage(res, {
        error: 'Email already exists',
        selectedMajor: req.body.major || '',
        selectedSubjects: Array.isArray(req.body.registeredSubjects)
          ? req.body.registeredSubjects
          : [req.body.registeredSubjects].filter(Boolean)
      })
    } else {
      await renderRegisterPage(res, {
        error: 'Registration failed: ' + err.message,
        selectedMajor: req.body.major || '',
        selectedSubjects: Array.isArray(req.body.registeredSubjects)
          ? req.body.registeredSubjects
          : [req.body.registeredSubjects].filter(Boolean)
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
