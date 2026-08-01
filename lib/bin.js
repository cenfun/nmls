#!/usr/bin/env node

const path = require('path');
const { program } = require('commander');
const commanderHelp = require('commander-help');

const NMLS = require('./index.js');

const version = require(path.resolve(__dirname, '../package.json')).version;
program
    .name('nmls')
    .description('An analysis tool to Node Modules List')
    .argument('[name...]', 'name(s) specified')
    .version(version, '-v, --version');

program
    .option('-r, --root <path>', "root path, default value is '.' (current working directory)")
    .option('-p, --prod', 'prod dependencies only (no devDependencies)')
    .option('-f, --files', 'show files info')
    .option('-s, --sort <field>', 'sort field (name/version/size/files/deps/dSize/nested)')
    .option('-a, --asc', 'asc or desc (default)')
    .action(function() {
        const args = Array.from(arguments);
        // remove last one Commander
        args.pop();
        // then options
        const options = args.pop();
        const nmls = new NMLS(options);
        nmls.start.apply(nmls, args).catch(function(err) {
            const msg = (err && err.stack) ? err.stack : err;
            console.error(msg);
            process.exitCode = 1;
        });
    });

// disabled default help
program.helpInformation = function() {
    return '';
};

// custom help
program.on('--help', function() {
    // commander-help is written for old commander (< 8), patch removed internals
    if (!program._helpFlags) {
        program._helpFlags = program._helpOption.flags;
    }
    if (!program._helpDescription) {
        program._helpDescription = program._helpOption.description;
    }
    commanderHelp(program);
});

program.parse();
