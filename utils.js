
const tradleUtils = require('@tradle/engine').utils

const utils = module.exports = {
  myIdentifier: function (node, tlsEnabled) {
    const identityInfo = tradleUtils.extend({ keys: node.keys }, node.identityInfo)
    return utils.identifier(identityInfo, tlsEnabled)
  },

  identifier: function (identityInfo, tlsEnabled) {
    const keys = identityInfo.keys || identityInfo.object.pubkeys
    const pk = pubKeyWithPurpose(keys, tlsEnabled ? 'tls' : 'sign')
    return tradleUtils.serializePubKey(pk).toString('hex')
  },

  parseIdentifier: function (identifier) {
    const pubKey = tradleUtils.unserializePubKey(new Buffer(identifier, 'hex'))
    pubKey.pub = new Buffer(pubKey.pub, 'hex')
    return pubKey
  }
}

function pubKeyWithPurpose (keys, purpose) {
  const pk = tradleUtils.find(keys, k => {
    const kPurpose = k.purpose || k.get('purpose')
    return kPurpose === purpose
  })

  return pk.pubKeyString ? pk.toJSON() : tradleUtils.clone(pk)
}
