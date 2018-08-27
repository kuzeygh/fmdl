#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { version } = require("../package.json");
const startProxy = require("./");
const makeUpdateEnvironment = require("./makeUpdateEnvironment");
const options = require("./options")();
const { withWhite, withGreen, withYellow, withRed } = require("./colors");

const CERT_FILE = "ssl/certs/ca.pem";
const parentPath = path.resolve(__dirname, "../");
const certPath = path.resolve(parentPath, CERT_FILE);

console.log(withWhite(`FMDL v${version}`));

startProxy(options).then(({ port }) => {
  console.log(withWhite(`proxy server started on port ${port}`));
  const updateEnvironment = () => {
    const { setup, cleanup } = makeUpdateEnvironment({
      ...options,
      port,
      certPath
    });
    setup()
      .then(() => {
        console.log(withGreen("ready to start downloading..."));

        let exited = false;
        const exit = () => {
          if (!exited) {
            exited = true;
            cleanup();
          }
        };
        process.on("exit", exit);
        process.on("SIGINT", exit);
        process.on("uncaughtException", exit);
      })
      .catch(error => console.error(withRed(error)));
  };
  fs.stat(certPath, error => {
    if (error) {
      console.log(withYellow("generating root cert..."));
      const watcher = fs.watch(parentPath, { recursive: true });
      watcher.on("change", (_, filename) => {
        if (filename.replace(/\\/g, "/") === CERT_FILE) {
          watcher.close();
          updateEnvironment();
        }
      });
    } else {
      updateEnvironment();
    }
  });
});
