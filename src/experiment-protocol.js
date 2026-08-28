export const STUDY_VERSION = 'v13-1'
export const DATA_CLASSES = ['casual', 'training', 'formal']
export const FORMAL_PHASES = ['consent', 'profile', 'training', 'recognition', 'reader', 'complete']
export const VISION_STATUSES = ['sighted', 'low-vision', 'blind', 'undisclosed']
export const BRAILLE_EXPERIENCE = ['none', 'beginner', 'experienced', 'undisclosed']
export const AUDIO_EXPERIENCE = ['none', 'some', 'audiobraille-trained', 'undisclosed']

export function deriveCohort(profile = {}) {
  if ((profile.visionStatus === 'blind' || profile.visionStatus === 'low-vision') && profile.brailleExperience === 'experienced') {
    return 'blind-braille-experienced'
  }
  if (profile.brailleExperience === 'beginner' || profile.brailleExperience === 'experienced') {
    return 'braille-trained'
  }
  if (profile.visionStatus === 'sighted' && profile.brailleExperience === 'none') {
    return 'sighted-braille-naive'
  }
  return 'unclassified'
}

function result(valid, errors = []) {
  return { valid, errors }
}

export function validateParticipantProfile(profile = {}) {
  const errors = []
  if (!VISION_STATUSES.includes(profile.visionStatus)) errors.push('visionStatus')
  if (!BRAILLE_EXPERIENCE.includes(profile.brailleExperience)) errors.push('brailleExperience')
  if (!AUDIO_EXPERIENCE.includes(profile.audioEncodingExperience)) errors.push('audioEncodingExperience')
  return result(errors.length === 0, errors)
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

export function validateFormalRecord(record = {}) {
  const errors = []
  if (record.dataClass !== 'formal') errors.push('dataClass')
  if (record.consentAccepted !== true) errors.push('consentAccepted')
  if (!isNonEmptyString(record.studyVersion)) errors.push('studyVersion')
  if (!isNonEmptyString(record.participantId)) errors.push('participantId')
  if (!isNonEmptyString(record.sessionId)) errors.push('sessionId')
  return result(errors.length === 0, errors)
}
