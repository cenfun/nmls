#! /usr/bin/env node

const path = require("path");
const program = require("commander");
const ConsoleGrid = require("console-grid");
const consoleGrid = new ConsoleGrid();
const NMLS = require("./index.js");

//check node version
const vs = process.versions.node.split(".");
if (vs[0] < 10) {
    console.warn("Requires NodeJS v10 or higher");
    process.exit(1);
}

const version = require(path.resolve(__dirname, "../package.json")).version;
program.version(version, "-v, --version");

program
    .option("-r, --root <path>", "project root, default value is '.' (current working directory)")
    .option("-s, --sort <field>", "sort field (name/version/size/dAmount/dNested/dSize/files/dFiles)")
    .option("-a, --asc", "sort by asc")
    .option("-m, --module <name>", "filter modules with name")
    .option("-w, --workspace [name]", "show all packages of workspace, or filter with name")
    .option("-f, --files", "show files columns")
    .action(function(option) {
        new NMLS().start(option);
    });

//disabled default help
program.helpInformation = function() {
    return "";
};

//custom help
program.on("--help", function() {
    const programName = "nmls";
    console.log(` Usage: ${programName} [options]`);
    
    const hsOptions = this.options.map(function(o) {
        return {
            name: ` ${o.flags}`,
            description: o.description
        };
    });
    hsOptions.push({
        name: ` ${this._helpFlags}`,
        description: this._helpDescription
    });
    const rows = [{
        name: programName,
        description: "",
        subs: hsOptions
    }];

    consoleGrid.render({
        option: {
            hideHeaders: false,
            nullPlaceholder: ""
        },
        columns: [{
            id: "name",
            name: "Commands and Options"
        }, {
            id: "description",
            name: "Description",
            maxWidth: 200
        }],
        rows: rows
    });

});

program.parse(process.argv);