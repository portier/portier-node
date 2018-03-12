const AbstractStore = require('../store')

/**
 * An in-memory store implementation.
 */
class MemoryStore extends AbstractStore {
  constructor () {
    super()

    this.data = Object.create(null)
    this.interval = setInterval(
      () => { this.gc() },
      60 * 1000 // 1 minute
    )
  }

  fetchCached (cacheId, url, cb) {
    this.gc()
    const key = `cache:${cacheId}`
    const obj = this.data[key]
    if (obj) {
      process.nextTick(() => {
        cb(null, obj.data)
      })
      return
    }
    this.fetch(url, (err, { ttl, data }) => {
      if (err) {
        cb(err)
        return
      }
      this.data[key] = { ex: Date.now() + ttl, data }
      cb(null, data)
    })
  }

  createNonce (email, cb) {
    const nonce = this.generateNonce(email)
    const key = `nonce:${nonce}`
    this.data[key] = { ex: Date.now() + this.nonceTtl, email }
    process.nextTick(() => {
      cb(null, nonce)
    })
  }

  consumeNonce (nonce, email, cb) {
    this.gc()
    const key = `nonce:${nonce}`
    const obj = this.data[key]
    delete this.data[key]
    process.nextTick(() => {
      let err
      if (!obj || obj.email !== email) {
        err = Error('Invalid or expired nonce')
      }
      cb(err)
    })
  }

  gc () {
    const now = Date.now()
    Object.keys(this.data).forEach((key) => {
      if (this.data[key].ex <= now) {
        delete this.data[key]
      }
    })
  }

  destroy () {
    if (this.interval !== null) {
      clearInterval(this.interval)
      this.interval = null
    }
  }
}

module.exports = MemoryStore
