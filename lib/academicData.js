const Major = require('../models/major')
const Subject = require('../models/subject')

async function getMajors() {
  return Major.find().sort('name').lean()
}

async function getSubjects() {
  return Subject.find().sort('name').lean()
}

async function getSubjectsByMajor(majorId) {
  return Subject.find({ majorId }).sort('name').lean()
}

async function isValidMajor(majorId) {
  return Major.exists({ _id: majorId })
}

async function validateSubjectsForMajor(majorId, subjectIds) {
  if (!Array.isArray(subjectIds) || subjectIds.length === 0) {
    return false
  }
  const count = await Subject.countDocuments({
    _id: { $in: subjectIds },
    majorId
  })
  return count === subjectIds.length
}

module.exports = {
  getMajors,
  getSubjects,
  getSubjectsByMajor,
  isValidMajor,
  validateSubjectsForMajor
}
