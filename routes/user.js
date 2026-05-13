const express = require('express')
const router = express.Router()

const User = require('../models/user')
const { requireAuth } = require('../middleware/auth')
const { getSubjectsByMajor, validateSubjectsForMajor } = require('../lib/academicData')


// GET /user/profile - View profile
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('majorId').populate('registeredSubjects')

    if (!user) {
      return res.status(404).render('error', {
        message: 'User not found'
      })
    }

    res.render('profile', {
      user,
      success: req.query.success
    })

  } catch (error) {
    console.error('Error fetching user profile:', error)

    res.status(500).render('error', {
      message: 'Internal server error'
    })
  }
})


// GET /user/profile/edit - Edit profile page
router.get('/profile/edit', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('majorId').populate('registeredSubjects')

    if (!user) {
      return res.status(404).render('error', {
        message: 'User not found'
      })
    }

    let availableSubjects = []
    if (user.role === 'student' && user.majorId) {
      availableSubjects = await getSubjectsByMajor(user.majorId._id)
    }

    res.render('edit-profile', {
      user,
      availableSubjects,
      error: null
    })

  } catch (error) {
    console.error('Error loading edit profile page:', error)

    res.status(500).render('error', {
      message: 'Internal server error'
    })
  }
})


// POST /user/profile - Update profile
router.post('/profile', requireAuth, async (req, res) => {
  try {
    const { name, email, registeredSubjects } = req.body
    const user = await User.findById(req.user.id).populate('majorId').populate('registeredSubjects')

    if (!user) {
      return res.status(404).render('error', {
        message: 'User not found'
      })
    }

    // Basic validation
    if (!name || !email) {
      let availableSubjects = []
      if (user.role === 'student' && user.majorId) {
        availableSubjects = await getSubjectsByMajor(user.majorId._id)
      }
      return res.render('edit-profile', {
        user,
        availableSubjects,
        error: 'Name and email are required'
      })
    }

    // Check if email is already used
    const existingUser = await User.findOne({
      email: email.toLowerCase(),
      _id: { $ne: req.user.id }
    })

    if (existingUser) {
      let availableSubjects = []
      if (user.role === 'student' && user.majorId) {
        availableSubjects = await getSubjectsByMajor(user.majorId._id)
      }
      return res.render('edit-profile', {
        user,
        availableSubjects,
        error: 'Email is already in use'
      })
    }

    // Update user basic info
    const updateData = {
      name: name.trim(),
      email: email.toLowerCase().trim()
    }

    // Handle registered subjects for students
    if (user.role === 'student') {
      const subjectArray = Array.isArray(registeredSubjects)
        ? registeredSubjects.filter(s => s && s.length > 0)
        : (registeredSubjects && registeredSubjects.length > 0 ? [registeredSubjects] : [])

      // Validate that all subjects belong to student's major
      if (subjectArray.length > 0) {
        const validSubjects = await validateSubjectsForMajor(user.majorId._id, subjectArray)
        if (!validSubjects) {
          let availableSubjects = await getSubjectsByMajor(user.majorId._id)
          return res.render('edit-profile', {
            user,
            availableSubjects,
            error: 'Invalid subjects selected'
          })
        }
      }

      updateData.registeredSubjects = subjectArray
    }

    // Update user in database
    await User.findByIdAndUpdate(req.user.id, updateData)

    // Update current request user
    req.user.name = name.trim()
    req.user.email = email.toLowerCase().trim()

    res.redirect('/user/profile?success=1')

  } catch (error) {
    console.error('Error updating profile:', error)

    const user = await User.findById(req.user.id).populate('majorId').populate('registeredSubjects')
    let availableSubjects = []
    if (user && user.role === 'student' && user.majorId) {
      availableSubjects = await getSubjectsByMajor(user.majorId._id)
    }

    res.render('edit-profile', {
      user: user || req.user,
      availableSubjects,
      error: 'Failed to update profile'
    })
  }
})

module.exports = router