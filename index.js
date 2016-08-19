
const EventEmitter = require('events').EventEmitter
const reemit = require('re-emitter')
const utils = require('@tradle/engine').utils
const createRemoteHub = require('./hub')
const networkUtils = require('./utils')

module.exports = exports = createOperator
exports.install = createOperator
utils.extend(exports, networkUtils)

function createOperator (opts) {
  const node = opts.node
  const tls = opts.tls
  const hubsByUrl = {}
  const hubsByRecipient = {}
  const ee = new EventEmitter()

  node._send = function (msg, recipientInfo, cb) {
    send(networkUtils.identifier(recipientInfo), msg, cb)
  }

  function send (recipient, msg, cb) {
    if (!hubsByRecipient[recipient]) {
      return cb(new Error('recipient not found: ' + recipient))
    }

    return hubsByRecipient[recipient].send(recipient, msg, cb)
  }

  function addHost (opts) {
    const url = opts.url
    if (hubsByUrl[url]) return

    opts = utils.extend({ node, tls }, opts)
    const hub = hubsByUrl[url] = createRemoteHub(opts)
    hub.on('destroy', () => {
      delete hubsByUrl[url]
      for (var recipient in hubsByRecipient) {
        if (hubsByRecipient[recipient] === hub) {
          delete hubsByRecipient[recipient]
        }
      }
    })

    reemit(hub, ee, ['error'])
  }

  function addEntry (url, recipient) {
    addHost({ url })
    hubsByUrl[url].addTarget(recipient)
    hubsByRecipient[recipient] = hubsByUrl[url]
  }

  function getHubs () {
    return utils.clone(hubsByUrl)
  }

  return utils.extend(ee, {
    addHost,
    addEntry,
    hubs: getHubs
  })
}
