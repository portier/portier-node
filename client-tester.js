#!/usr/bin/env node

import PortierClient from "./dist/index.js";
import { createInterface } from "node:readline";

if (process.argv.length !== 3) {
  console.error("Broker required");
  process.exit(1);
}

const client = new PortierClient({
  broker: process.argv[2],
  redirectUri: "http://imaginary-client.test/fake-verify-route",
});

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

const wrap = (fn) => {
  fn().then(
    (res) => {
      console.log(["ok", ...res].join("\t"));
    },
    (err) => {
      console.log(["err", err.message].join("\t"));
    },
  );
};

rl.on("line", (line) => {
  const cmd = line.split("\t");
  switch (cmd[0]) {
    case "echo":
      wrap(async () => [cmd[1]]);
      break;
    case "auth":
      wrap(async () => {
        const url = await client.authenticate(cmd[1], cmd[2]);
        return [url];
      });
      break;
    case "verify":
      wrap(async () => {
        const { email, state = "" } = await client.verify(cmd[1]);
        return [email, state];
      });
      break;
    default:
      console.error(`invalid command: ${cmd[0]}`);
      process.exit(1);
  }
});

process.stdin.on("end", () => {
  client.destroy();
});
