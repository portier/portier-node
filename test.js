const test = require('tape');
const PortierClient = require('.');

test('normalize', (t) => {
    const valid = [
        { i: 'example.foo+bar@example.com', o: 'example.foo+bar@example.com' },
        { i: 'EXAMPLE.FOO+BAR@EXAMPLE.COM', o: 'example.foo+bar@example.com' },
        { i: 'BJÖRN@göteborg.test', o: 'björn@xn--gteborg-90a.test' }
    ];
    for (const { i, o } of valid) {
        t.equal(PortierClient.normalize(i), o)
    }

    const invalid = [
        'foo',
        'foo@127.0.0.1',
        'foo@[::1]'
    ];
    for (const i of invalid) {
        t.equal(PortierClient.normalize(i), '')
    }

    t.end();
});