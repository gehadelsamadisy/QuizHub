const express = require('express')
const mongoose = require('mongoose')
const session = require('express-session')
const MongoStore = require('connect-mongo')
const path = require('path')

const app = express()

mongoose.connect('mongodb://localhost:27017/quizhub')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err))

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static(path.join(__dirname, 'public')))

app.use(session({
  secret: 'quizhub-secret-key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: 'mongodb://localhost:27017/quizhub' }),
  cookie: { maxAge: 1000 * 60 * 60 * 24 }
}))

app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))

app.use((req, res, next) => {
  res.locals.user = req.session.user || null
  next()
})

const authRoutes = require('./routes/auth')
const quizRoutes = require('./routes/quiz')
const userRoutes = require('./routes/user')
const attemptRoutes = require('./routes/attempt')
const adminRoutes = require('./routes/admin')

app.use('/', authRoutes)
app.use('/quiz', quizRoutes)
app.use('/user', userRoutes)
app.use('/attempt', attemptRoutes)
app.use('/admin', adminRoutes)

app.get('/', (req, res) => {
  res.render('home')
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
