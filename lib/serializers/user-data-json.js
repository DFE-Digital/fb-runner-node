// Purpose:
// Given a userData object
// serialize to JSON for API use

const CONSTANTS = require('../constants/constants')
const {SERVICE_SLUG} = CONSTANTS

const toJson = (userData) => {
  return {
    service_slug: SERVICE_SLUG,
    submission_id: userData.submissionId,
    submission_data: {
      fullname: userData.fullname,
      email: userData.email
    }
  }
}

module.exports = {
  toJson: toJson
}
