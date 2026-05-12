const express = require('express')
const router = express.Router()

const User = require('../models/user')
const { requireAuth } = require('../middleware/auth')


// GET /user/profile - View profile
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)

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
    const user = await User.findById(req.user.id)

    if (!user) {
      return res.status(404).render('error', {
        message: 'User not found'
      })
    }

    res.render('edit-profile', {
      user,
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
    const { name, email } = req.body

    // Basic validation
    if (!name || !email) {
      return res.render('edit-profile', {
        user: req.user,
        error: 'Name and email are required'
      })
    }

    // Check if email is already used
    const existingUser = await User.findOne({
      email: email.toLowerCase(),
      _id: { $ne: req.user.id }
    })

    if (existingUser) {
      return res.render('edit-profile', {
        user: req.user,
        error: 'Email is already in use'
      })
    }

    // Update user
    await User.findByIdAndUpdate(req.user.id, {
      name: name.trim(),
      email: email.toLowerCase().trim()
    })

    // Update current request user
    req.user.name = name.trim()
    req.user.email = email.toLowerCase().trim()

    res.redirect('/user/profile?success=1')

  } catch (error) {
    console.error('Error updating profile:', error)

    res.render('edit-profile', {
      user: req.user,
      error: 'Failed to update profile'
    })
  }
})

module.exports = router