const express = require('express')
const mongoose = require('mongoose')
const cookieParser = require('cookie-parser')
const path = require('path')
const { attachUser } = require('./middleware/jwt')

const app = express()

mongoose.connect('mongodb://localhost:27017/quizhub')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err))

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())
app.use(express.static(path.join(__dirname, 'public')))

app.use(attachUser)

app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))

app.use((req, res, next) => {
  res.locals.user = req.user || null
  next()
})

const authRoutes = require('./routes/auth')
const quizRoutes = require('./routes/quiz')
const attemptRoutes = require('./routes/attempt')

app.use('/', authRoutes)
app.use('/quiz', quizRoutes)
app.use('/attempt', attemptRoutes)

app.get('/', (req, res) => {
  res.render('home')
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
