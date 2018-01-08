const test = require('tape')
const PortierClient = require('.')

test('normalize', (t) => {
  const valid = [
    { i: 'example.foo+bar@example.com', o: 'example.foo+bar@example.com' },
    { i: 'EXAMPLE.FOO+BAR@EXAMPLE.COM', o: 'example.foo+bar@example.com' },
    // Simple case transformation
    { i: 'BJÖRN@göteborg.test', o: 'björn@xn--gteborg-90a.test' },
    // Special case transformation
    { i: 'İⅢ@İⅢ.example', o: 'i̇ⅲ@xn--iiii-qwc.example' }
  ]
  for (const { i, o } of valid) {
    t.equal(PortierClient.normalize(i), o)
  }

  const invalid = [
    'foo',
    'foo@',
    '@foo.example',
    'foo@127.0.0.1',
    'foo@[::1]'
  ]
  for (const i of invalid) {
    t.equal(PortierClient.normalize(i), '')
  }

  t.end()
})
