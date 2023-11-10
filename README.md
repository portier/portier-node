# portier-node

A [Portier] client library for Node.js

[portier]: https://portier.github.io/

### Example

```js
import Fastify from "fastify";
import formPlugin from "@fastify/formbody";
import PortierClient from "portier";

const portier = new PortierClient({
  redirectUri: "http://localhost:8000/verify",
});

const app = Fastify();
app.register(formPlugin);

app.get("/", (req, res) => {
  res.type("text/html");
  return `
    <p>Enter your email address:</p>
    <form method="post" action="/auth">
      <input name="email" type="email">
      <button type="submit">Login</button>
    </form>
  `;
});

app.post("/auth", async (req, res) => {
  const authUrl = await portier.authenticate(req.body.email);
  res.redirect(303, authUrl);
});

app.post("/verify", async (req, res) => {
  if (req.body.error) {
    res.type("text/html");
    return `
      <p>Error: ${req.body.error_description}</p>
    `;
  }

  const email = await portier.verify(req.body.id_token);

  res.type("text/html");
  return `
    <p>Verified email address ${email}!</p>
  `;
});

app.listen({ port: 8000 });
```
