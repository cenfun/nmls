#! /usr/bin/env node

//check node version
var vs = process.versions.node.split(".");
if (vs[0] < 8) {
    console.warn("Requires NodeJS version 8 or higher");
    process.exit(1);
}

var NMLS = require("./index.js");

var path = ".";
var nmls = new NMLS(path);

var option = {};
for (var i = 2, l = process.argv.length; i < l; i++) {
    var item = process.argv[i];
    if (item && item.indexOf("-") === 0) {
        var name = item.replace(/^-+/, "");
        option[name] = process.argv[i + 1];
        i++;

    }
}
//console.log(option);
nmls.start(option).then(() => {
    //console.log("[nmls] done");
});