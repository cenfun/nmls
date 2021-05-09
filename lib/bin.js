#! /usr/bin/env node

//check node version
const vs = process.versions.node.split(".");
if (vs[0] < 10) {
    console.warn("Requires NodeJS v10 or higher");
    process.exit(1);
}

const NMLS = require("./index.js");

const path = ".";
const nmls = new NMLS(path);

const option = {};
for (let i = 2, l = process.argv.length; i < l; i++) {
    const item = process.argv[i];
    if (item && item.indexOf("-") === 0) {
        const name = item.replace(/^-+/, "");
        const value = process.argv[i + 1];
        if (value && value.indexOf("-") !== 0) {
            option[name] = value;
            i++;
        } else {
            option[name] = true;
        }
    }
}
//console.log(option);
nmls.start(option).then(() => {
    //console.log("[nmls] done");
});