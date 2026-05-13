const Major = require('../models/major')
const Subject = require('../models/subject')

const initialMajors = [
  { slug: 'mechanical-engineering', name: 'Mechanical Engineering' },
  { slug: 'computer-engineering', name: 'Computer Engineering' },
  { slug: 'mechatronics-engineering', name: 'Mechatronics Engineering' }
]

const initialSubjects = [
  { slug: 'thermodynamics', name: 'Thermodynamics', majorSlug: 'mechanical-engineering' },
  { slug: 'fluid-mechanics', name: 'Fluid Mechanics', majorSlug: 'mechanical-engineering' },
  { slug: 'control-systems', name: 'Control Systems', majorSlug: 'mechanical-engineering' },
  { slug: 'algorithms', name: 'Algorithms', majorSlug: 'computer-engineering' },
  { slug: 'data-structures', name: 'Data Structures', majorSlug: 'computer-engineering' },
  { slug: 'databases', name: 'Databases', majorSlug: 'computer-engineering' },
  { slug: 'operating-systems', name: 'Operating Systems', majorSlug: 'computer-engineering' },
  { slug: 'networks', name: 'Networks', majorSlug: 'computer-engineering' },
  { slug: 'embedded-systems', name: 'Embedded Systems', majorSlug: 'computer-engineering' },
  { slug: 'web-development', name: 'Web Development', majorSlug: 'computer-engineering' },
  { slug: 'embedded-systems', name: 'Embedded Systems', majorSlug: 'mechatronics-engineering' },
  { slug: 'control-systems', name: 'Control Systems', majorSlug: 'mechatronics-engineering' },
  { slug: 'machine-learning', name: 'Machine Learning', majorSlug: 'mechatronics-engineering' },
  { slug: 'networks', name: 'Networks', majorSlug: 'mechatronics-engineering' }
]

async function seedAcademicData() {
  const majorCount = await Major.countDocuments()
  const subjectCount = await Subject.countDocuments()

  if (majorCount === 0) {
    await Major.insertMany(initialMajors)
    console.log('Seeded majors')
  }

  if (subjectCount === 0) {
    await Subject.insertMany(initialSubjects)
    console.log('Seeded subjects')
  }
}

module.exports = { seedAcademicData }
