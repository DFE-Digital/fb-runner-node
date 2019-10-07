const express = require('express')
const router = express.Router()
const CONSTANTS = require('../../constants/constants')
const {PORT} = CONSTANTS
const util = require('util')


const fkill = require('fkill')
const puppeteer = require('puppeteer')
const json2csv = require('json2csv').parse
const flatten = require('flat')

const useAsync = require('../use-async/use-async')
const nunjucksConfiguration = require('../nunjucks-configuration/nunjucks-configuration')
const {getInstanceProperty} = require('../../service-data/service-data')
const {format} = require('../../format/format')

const {getController} = require('../../controller/controller')

const jp = require('jsonpath')
const {
  getInstanceController
} = require('../../controller/controller')
const {
  formatProperties
} = require('../../page/page')

const pdfTemplate = require('./pdf-template')

const generateOutput = async (req, res) => {
  const summaryController = getController('page', 'type', 'page.summary')

  const {outputType, outputId, destination, filename} = req.params

  if (outputId !== 'default') {
    throw new Error(404)
  }

  const userData = req.user
  const code = getInstanceProperty('service', 'code')
  const subHeading = getInstanceProperty('service', 'pdfSubHeading')
  const heading = getInstanceProperty('service', 'pdfHeading')
  const submissionId = userData.getUserDataProperty('submissionId')
  const submissionDate = userData.getUserDataProperty('submissionDate')
  let submission = code || ''
  if (submissionId) {
    submission = submission ? `${submission} / ` : ''
    submission += submissionId
  }
  if (submissionDate) {
    const formattedDate = (new Date(submissionDate)).toUTCString()
    submission = submission ? `${submission} / ` : ''
    submission += formattedDate
  }

  if (outputType === 'pdf') {
    let pageInstance = {
      _type: 'output.pdf',
      title: submission,
      sectionHeading: subHeading,
      heading,
      columns: 'full',
      isPdf: true,
      skipRedact: destination === 'team'
    }
    if (summaryController.setContents) {
      pageInstance = summaryController.setContents(pageInstance, userData, res, true)
    }

    const componentInstances = jp.query(pageInstance, '$..[?(@._type)]')
    for await (const componentInstance of componentInstances) {
      const componentInstanceController = getInstanceController(componentInstance)
      if (componentInstanceController.preUpdateContents) {
        await componentInstanceController.preUpdateContents(componentInstance, userData, pageInstance)
      }
    }

    pageInstance = formatProperties(pageInstance, userData)

    let output = await nunjucksConfiguration.renderPage(pageInstance, Object.assign({}, res.locals)) // getPageOutput()

    // console.log(util.inspect(res.locals, {showHidden: false, depth: null}))

    output = output.replace(/<head>/, `<head><base href="http://localhost:${PORT}">`)
    output = output.replace(/<title>.*<\/title>/, `<title>${submission}</title>`)

    const browser = await puppeteer.launch({
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    })

    const browserProcessID = browser.process().pid

    let pdfOutput
    try {
      const page = await browser.newPage()
      await page.setContent(output)

      await page.emulateMedia('screen')
      pdfOutput = await page.pdf({
        scale: 0.75,
        format: 'A4',
        printBackground: true,
        margin: {
          bottom: '1cm'
        },
        displayHeaderFooter: true,
        footerTemplate: pdfTemplate(submission)
      })

      await page.goto('about:blank')
      await page.close()
      await browser.close()
    } catch (err) {
      fkill(browserProcessID).catch(() => {})
      throw err
    }

    // Kill chromium definitively, in the case `browser.close()` fails
    fkill(browserProcessID).catch(() => {})

    // res.setHeader('Content-Length', pdfOutput.length);
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`)
    res.write(pdfOutput)
    res.end()
  } else if (outputType === 'email') {
    let email
    // let fooContents = summaryController.setContents(pageInstance, userData, res, true)
    // console.log(util.inspect(fooContents, {showHidden: false, depth: null}))
    if (destination === 'team') {
      email = getInstanceProperty('service', 'emailTemplateTeam') || 'Please find an application attached'
    } else if (destination === 'user') {
      email = getInstanceProperty('service', 'emailTemplateUser') || 'A copy of your application is attached'
    } else {
      email = 'A copy of the application is attached'
    }
    const formatEmail = (str, markdown = false) => {
      try {
        str = format(str, req.user.getUserData(), {markdown, lang: req.user.contentLang})
      } catch (e) {
        //
      }
      return str
    }
    // ------------------------

    let pageInstance = {
      _type: 'output.pdf',
      title: submission,
      sectionHeading: subHeading,
      heading,
      columns: 'full',
      isPdf: true,
      skipRedact: destination === 'team'
    }
    if (summaryController.setContents) {
      pageInstance = summaryController.setContents(pageInstance, userData, res, true)
    }

    // const componentInstances = jp.query(pageInstance, '$..[?(@._type)]')
    // for await (const componentInstance of componentInstances) {
    //   const componentInstanceController = getInstanceController(componentInstance)
    //   if (componentInstanceController.preUpdateContents) {
    //     await componentInstanceController.preUpdateContents(componentInstance, userData, pageInstance)
    //   }
    // }

    pageInstance = formatProperties(pageInstance, userData)

    console.log('aaabbbccc')
    console.log(util.inspect(pageInstance, {showHidden: false, depth: null}))

    // ------------------------
    email = formatEmail(email)
    res.send(email)






  } else if (outputType === 'json') {
    const jsonData = userData.getOutputData()
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`)
    res.send(JSON.stringify(jsonData, null, 2))
    // res.json(jsonData)
  } else {
    throw new Error(404)
  }
}

// Convenience route to generate output for current user
router.use('/:outputType/:outputId/:destination?/:filename', useAsync(async (req, res) => {
  // Only allow unforwarded requests access
  if (req.get('x-forwarded-host')) {
    throw new Error(404)
  }
  await generateOutput(req, res)
}))

const routesOutput = (options = {}) => {
  return router
}

module.exports = {
  init: routesOutput
}
