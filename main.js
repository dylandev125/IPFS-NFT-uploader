#!/usr/bin/env node
const program = require("commander");
const App = require("./src/App");


async function main() {
    const app = new App();

    await app.uploadFiles();
    await app.uploadMetadata();
}

main();
