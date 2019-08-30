const test = require('tape')
const proxyquire = require('proxyquire')
const userDataJson = proxyquire('./user-data-json', {
  '../constants/constants': { SERVICE_SLUG: 'service-slug' }
})

test('it includes form name', t => {
  const userData = { }

  const output = userDataJson.toJson(userData);

  t.equal(output.service_slug, 'service-slug')
  t.end()
})

test('it includes the submission id', t => {
  const userData = {
    submissionId: 'submission-guid'
  }

  const output = userDataJson.toJson(userData);

  t.equal(output.submission_id, 'submission-guid')
  t.end()
})

test('it includes the submission data', t => {
  const userData = {
    fullname: 'John Doe',
    email: 'john.doe@example.com'
  }

  const output = userDataJson.toJson(userData);

  t.equal(output.submission_data.fullname, 'John Doe')
  t.equal(output.submission_data.email, 'john.doe@example.com')
  t.end()
})
