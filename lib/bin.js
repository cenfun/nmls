#!/usr/bin/env node

const path = require('path');
const program = require('commander');
const CG = require('console-grid');
const NMLS = require('./index.js');

// check node version
const vs = process.versions.node.split('.');
if (vs[0] < 14) {
    console.warn('Requires NodeJS v14 or higher');
    process.exit(1);
}

const version = require(path.resolve(__dirname, '../package.json')).version;
program.version(version, '-v, --version');

program
    .option('-r, --root <path>', "project root, default value is '.' (current working directory)")
    .option('-w, --workspaces [name]', 'show workspaces, or filter with name')
    .option('-p, --prod', 'prod dependencies only (no devDependencies)')
    .option('-f, --files', 'show files columns')
    .option('-s, --sort <field>', 'sort field (name/version/size/files/deps/nested/dSize)')
    .option('-a, --asc', 'sort by asc')
    .action(function(options) {
        new NMLS().start(options);
    });

// disabled default help
program.helpInformation = function() {
    return '';
};

// custom help
program.on('--help', function() {
    const programName = 'nmls';
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
        description: '',
        subs: hsOptions
    }];

    CG({
        options: {
            nullPlaceholder: ''
        },
        columns: [{
            id: 'name',
            name: 'Commands and Options'
        }, {
            id: 'description',
            name: 'Description',
            maxWidth: 200
        }],
        rows: rows
    });

});

program.parse(process.argv);
