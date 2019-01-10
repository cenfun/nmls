#! /usr/bin/env node

//check node version
var vs = process.versions.node.split(".");
if (vs[0] < 8) {
    console.warn("Requires NodeJS version 8 or higher");
    process.exit(1);
}

var NMLS = require("./index.js");

new NMLS();