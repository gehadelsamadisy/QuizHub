const SUBJECTS_BY_MAJOR = {
  'mechanical-engineering': [
    'thermodynamics',
    'fluid-mechanics',
    'control-systems'
  ],
  'computer-engineering': [
    'algorithms',
    'data-structures',
    'databases',
    'operating-systems',
    'networks',
    'embedded-systems',
    'web-development'
  ],
  'mechatronics-engineering': [
    'embedded-systems',
    'control-systems',
    'machine-learning',
    'networks'
  ]
}

const SUBJECT_LABELS = {
  'algorithms': 'Algorithms',
  'data-structures': 'Data Structures',
  'databases': 'Databases',
  'operating-systems': 'Operating Systems',
  'networks': 'Networks',
  'machine-learning': 'Machine Learning',
  'embedded-systems': 'Embedded Systems',
  'control-systems': 'Control Systems',
  'thermodynamics': 'Thermodynamics',
  'fluid-mechanics': 'Fluid Mechanics',
  'web-development': 'Web Development'
}

function getSubjectsForMajor(major) {
  return SUBJECTS_BY_MAJOR[major] || []
}

function isSubjectValidForMajor(major, subject) {
  return getSubjectsForMajor(major).includes(subject)
}

function validateSubjectsForMajor(major, subjects) {
  if (!major || !Array.isArray(subjects)) {
    return false
  }
  if (subjects.length === 0) {
    return false
  }
  return subjects.every(subject => isSubjectValidForMajor(major, subject))
}

module.exports = {
  SUBJECTS_BY_MAJOR,
  SUBJECT_LABELS,
  getSubjectsForMajor,
  isSubjectValidForMajor,
  validateSubjectsForMajor
}
