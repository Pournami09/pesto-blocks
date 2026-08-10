/**
 * Synonym map for common job application form field labels.
 * Keys are already-normalized labels (lowercase, no artifacts).
 * Values are the canonical form to match against.
 *
 * When a detected label (or a Notion alias) resolves to the same canonical,
 * the two strings are treated as semantically equivalent even if they share
 * few characters, producing a high-confidence match (0.95).
 */
const SYNONYM_MAP = {
  // ---------------------------------------------------------------------------
  // Name fields
  // ---------------------------------------------------------------------------
  'given name': 'first name',
  'forename': 'first name',
  'first': 'first name',
  'family name': 'last name',
  'surname': 'last name',
  'last': 'last name',
  'full name': 'name',
  'legal name': 'name',

  // ---------------------------------------------------------------------------
  // Phone / contact
  // ---------------------------------------------------------------------------
  'mobile': 'phone',
  'cell': 'phone',
  'telephone': 'phone',
  'mobile number': 'phone number',
  'cell number': 'phone number',
  'contact number': 'phone number',
  'telephone number': 'phone number',
  'mobile phone': 'phone number',
  'mobile phone number': 'phone number',
  'phone no': 'phone number',
  'phone #': 'phone number',

  // ---------------------------------------------------------------------------
  // Email
  // ---------------------------------------------------------------------------
  'email address': 'email',
  'e-mail': 'email',
  'e-mail address': 'email',
  'contact email': 'email',
  'work email': 'email',

  // ---------------------------------------------------------------------------
  // LinkedIn
  // ---------------------------------------------------------------------------
  'linkedin': 'linkedin url',
  'linkedin profile': 'linkedin url',
  'linkedin link': 'linkedin url',
  'linkedin profile url': 'linkedin url',
  'linkedin profile link': 'linkedin url',
  'linkedin page': 'linkedin url',

  // ---------------------------------------------------------------------------
  // Resume / CV
  // ---------------------------------------------------------------------------
  'cv': 'resume',
  'curriculum vitae': 'resume',
  'resume/cv': 'resume',
  'cv/resume': 'resume',

  // ---------------------------------------------------------------------------
  // Portfolio / personal site
  // ---------------------------------------------------------------------------
  'portfolio': 'portfolio url',
  'portfolio link': 'portfolio url',
  'portfolio website': 'portfolio url',
  'personal website': 'portfolio url',
  'personal site': 'portfolio url',
  'website': 'portfolio url',
  'personal url': 'portfolio url',
  'github': 'github url',
  'github profile': 'github url',
  'github link': 'github url',

  // ---------------------------------------------------------------------------
  // Salary / compensation
  // ---------------------------------------------------------------------------
  'expected salary': 'desired salary',
  'salary expectation': 'desired salary',
  'salary expectations': 'desired salary',
  'compensation expectation': 'desired salary',
  'compensation expectations': 'desired salary',
  'desired compensation': 'desired salary',
  'expected compensation': 'desired salary',
  'salary requirement': 'desired salary',
  'salary requirements': 'desired salary',
  'target salary': 'desired salary',

  // ---------------------------------------------------------------------------
  // Address
  // ---------------------------------------------------------------------------
  'street address': 'address',
  'mailing address': 'address',
  'home address': 'address',
  'current address': 'address',
  'residential address': 'address',

  // ---------------------------------------------------------------------------
  // Location / city
  // ---------------------------------------------------------------------------
  'current location': 'location',
  'city': 'location',
  'city, state': 'location',
  'city/state': 'location',
  'city, state, country': 'location',
  'where are you located': 'location',
  'where do you live': 'location',

  // ---------------------------------------------------------------------------
  // Work authorization / visa
  // ---------------------------------------------------------------------------
  'work authorization': 'work eligibility',
  'work authorisation': 'work eligibility',
  'authorized to work': 'work eligibility',
  'authorised to work': 'work eligibility',
  'legally authorized to work': 'work eligibility',
  'visa status': 'work eligibility',
  'right to work': 'work eligibility',
  'require sponsorship': 'visa sponsorship',
  'require visa sponsorship': 'visa sponsorship',
  'sponsorship required': 'visa sponsorship',
  'need sponsorship': 'visa sponsorship',
  'do you require sponsorship': 'visa sponsorship',

  // ---------------------------------------------------------------------------
  // Experience
  // ---------------------------------------------------------------------------
  'years of experience': 'experience',
  'years of relevant experience': 'experience',
  'how many years of experience': 'experience',
  'total experience': 'experience',

  // ---------------------------------------------------------------------------
  // Start date / availability
  // ---------------------------------------------------------------------------
  'available start date': 'start date',
  'earliest start date': 'start date',
  'when can you start': 'start date',
  'availability': 'start date',
  'notice period': 'start date',

  // ---------------------------------------------------------------------------
  // Cover letter / motivation
  // ---------------------------------------------------------------------------
  'cover letter': 'cover letter',
  'why do you want to work here': 'cover letter',
  'why are you interested in this role': 'cover letter',
  'why do you want this job': 'cover letter',
  'why are you a good fit': 'cover letter',

  // ---------------------------------------------------------------------------
  // Pronouns / diversity
  // ---------------------------------------------------------------------------
  'pronouns': 'gender pronouns',
  'preferred pronouns': 'gender pronouns',
  'your pronouns': 'gender pronouns',
};

/**
 * Apply synonym normalization to an already-normalized label.
 * Returns the canonical form if a synonym match is found, otherwise returns
 * the original label unchanged.
 *
 * @param {string} normalizedLabel - Already lowercased and stripped label
 * @returns {string}
 */
export function applySynonyms(normalizedLabel) {
  return SYNONYM_MAP[normalizedLabel] ?? normalizedLabel;
}
