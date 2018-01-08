const url = require('url')
const net = require('net')

exports = module.exports = require('./lib/client')
exports.AbstractStore = require('./lib/store')
exports.MemoryStore = require('./lib/stores/memory')
exports.RedisStore = require('./lib/stores/redis')

/**
 * Normalize an email address.
 *
 * This method is useful when comparing user input to an email address
 * returned in a Portier token. It is not necessary to call this before
 * `authenticate`, normalization is already part of the authentication
 * process.
 *
 * @param {string} email
 * @return {string} An empty string on invalid input
 */
exports.normalize = (email) => {
  const localEnd = email.indexOf('@')
  if (localEnd === -1) return ''

  const local = email.slice(0, localEnd).toLowerCase()
  if (local === '') return ''

  const host = url.domainToASCII(email.slice(localEnd + 1))
  if (host === '' || host[0] === '[' || net.isIPv4(host)) return ''

  return `${local}@${host}`
}
