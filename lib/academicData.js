const Major = require('../models/major')
const Subject = require('../models/subject')

async function getMajors() {
  return Major.find().sort('name').lean()
}

async function getSubjects() {
  return Subject.find().sort('name').lean()
}

async function getSubjectsForForms() {
  return getSubjects()
}

async function getSubjectsByMajor(majorSlug) {
  return Subject.find({ majorSlug }).sort('name').lean()
}

async function isValidMajor(majorSlug) {
  return Major.exists({ slug: majorSlug })
}

async function validateSubjectsForMajor(majorSlug, subjectSlugs) {
  if (!Array.isArray(subjectSlugs) || subjectSlugs.length === 0) {
    return false
  }
  const count = await Subject.countDocuments({
    slug: { $in: subjectSlugs },
    majorSlug
  })
  return count === subjectSlugs.length
}

module.exports = {
  getMajors,
  getSubjects,
  getSubjectsForForms,
  getSubjectsByMajor,
  isValidMajor,
  validateSubjectsForMajor
}
