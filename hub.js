
const EventEmitter = require('events').EventEmitter
const querystring = require('querystring')
const reemit = require('re-emitter')
const TLSClient = require('sendy-axolotl')
const Sendy = require('sendy')
const SendyWS = require('sendy-ws')
const newSwitchboard = SendyWS.Switchboard
const WebSocketClient = SendyWS.Client
const tradle = require('@tradle/engine')
const utils = tradle.utils
const debug = require('debug')('tradle:network-utils')
const networkUtils = require('./utils')

module.exports = function createRemoteHub (opts) {
  const node = opts.node
  const tlsEnabled = opts.tls
  const identityInfo = utils.extend({ keys: node.keys }, node.identityInfo)
  const url = opts.url + '?' + querystring.stringify({
    from: networkUtils.identifier(identityInfo)
  })

  const webSocketClient = new WebSocketClient({
    url: url,
    autoConnect: true,
    // for now, till we figure out why binary
    // doesn't work (socket.io parser errors on decode)
    forceBase64: opts.forceBase64
  })

  webSocketClient.on('disconnect', function () {
    switchboard.clients().forEach(function (c) {
      // reset OTR session, restart on connect
      debug('aborting pending sends due to disconnect')
      c.destroy()
    })

    // pause all channels
    node.sender.pause()
  })

  webSocketClient.on('connect', function (recipient) {
    // resume all paused channels
    node.sender.resume()
  })

  const tlsKey = tlsEnabled && utils.find(node.keys, key => {
    return key.get('purpose') === 'tls'
  })

  const switchboard = newSwitchboard({
    identifier: networkUtils.myIdentifier(node),
    unreliable: webSocketClient,
    clientForRecipient: function (recipient) {
      const sendy = new Sendy(opts)
      if (!tlsKey) return sendy

      return new TLSClient({
        key: {
          secretKey: tlsKey.priv,
          publicKey: tlsKey.pub
        },
        client: sendy,
        theirPubKey: new Buffer(networkUtils.parseIdentifier(recipient).pub, 'hex')
      })
    }
  })

  switchboard.on('timeout', function (identifier) {
    switchboard.cancelPending(identifier)
  })

  switchboard.on('message', function (msg, sender) {
    const pubKey = networkUtils.parseIdentifier(sender)
    node.receive(msg, { pubKey })
  })

  const targets = {}
  const ee = new EventEmitter()
  reemit(switchboard, ee, ['error'])

  function addTarget (recipient) {
    targets[recipient] = true
  }

  function hasTarget (recipient) {
    return recipient in targets
  }

  function send (recipient, msg, cb) {
    if (!hasTarget(recipient)) {
      return cb(new Error('target not found'))
    }

    switchboard.send(recipient, msg, cb)
  }

  function destroy () {
    switchboard.destroy()
  }

  return utils.extend(ee, {
    webSocketClient,
    switchboard,
    addTarget,
    hasTarget,
    send,
    destroy
  })
}
