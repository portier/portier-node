# portier-node

A [Portier] client library for Node.js

 [Portier]: https://portier.github.io/

### Example

```js
const express = require('express');
const formParser = require('body-parser').urlencoded({ extended: false });
const PortierClient = require('portier');

const portier = new PortierClient({
    redirectUri: 'http://localhost:8000/verify'
});

const app = express();

app.get('/', (req, res) => {
    res.type('html').end(`
        <p>Enter your email address:</p>
        <form method="post" action="/auth">
            <input name="email" type="email">
            <button type="submit">Login</button>
        </form>
    `);
});

app.post('/auth', formParser, (req, res, next) => {
    portier.authenticate(req.body.email, (err, authUrl) => {
        if (err) return next(err);
        res.redirect(303, authUrl);
    });
});

app.post('/verify', formParser, (req, res, next) => {
    portier.verify(req.body.id_token, (err, email) => {
        if (err) return next(err);
        res.type('html').end(`
            <p>Verified email address ${email}!</p>
        `);
    });
});

app.listen(8000);
```
