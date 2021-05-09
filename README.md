# nmls - Node Modules List
An analysis tool to show dependencies detail in node modules folder.

![npm](https://img.shields.io/npm/v/nmls.svg)
![npm](https://img.shields.io/npm/dt/nmls.svg)
![David](https://img.shields.io/david/cenfun/nmls.svg)

# CLI Usage
```sh
# Install
npm install nmls -g

# go to project folder and execute:
nmls

# sort by dependency size
nmls -s dSize
nmls --sort dSize

# sort by asc
nmls -a
nmls --asc

# show module info
nmls -m console-grid
nmls --module console-grid

# more options
nmls -h
nmls --help
┌──────────────────────────┬───────────────────────────────────────────────────────────────────┐
│ Commands and Options     │ Description                                                       │
├──────────────────────────┼───────────────────────────────────────────────────────────────────┤
│ └ nmls                   │                                                                   │
│   ├  -v, --version       │ output the version number                                         │
│   ├  -r, --root <path>   │ project root, default value is '.' (current working directory)    │
│   ├  -s, --sort <field>  │ sort field (name/version/size/dAmount/dNested/dSize/files/dFiles) │
│   ├  -a, --asc           │ sort by asc                                                       │
│   ├  -m, --module <name> │ single module info                                                │
│   ├  -f, --files         │ show files columns                                                │
│   └  -h, --help          │ display help for command                                          │
└──────────────────────────┴───────────────────────────────────────────────────────────────────┘
```
# Output Example
```
[nmls] root: G:/workspace/nmls
[nmls] generated project: nmls
[nmls] generated node modules: total: 134 nested: 23 (repetition: 17.16 %)
┌─────────────────────┬─────────┬───────────┬──────────┬──────────┬───────────┐
│                     │         │           │     Deps │     Deps │           │
│  Name               │ Version │      Size │   Amount │   Nested │ Deps Size │
├─────────────────────┼─────────┼───────────┼──────────┼──────────┼───────────┤
│ └ nmls              │ 2.0.3   │  34.29 KB │      134 │       23 │     13 MB │
│   ├ dependencies    │         │           │          │          │           │
│   │ ├ commander     │ 7.2.0   │ 141.32 KB │        0 │        0 │       0 B │
│   │ ├ console-grid  │ 1.0.17  │  28.19 KB │        1 │        0 │   2.36 KB │
│   │ ├ eight-colors  │ 1.0.0   │   2.36 KB │        0 │        0 │       0 B │
│   │ ├ gauge         │ 3.0.0   │  48.15 KB │       10 │        0 │   70.8 KB │
│   │ ├ ignore        │ 5.1.8   │  48.65 KB │        0 │        0 │       0 B │
│   │ └ object-assign │ 4.1.1   │    6.3 KB │        0 │        0 │       0 B │
│   └ devDependencies │         │           │          │          │           │
│     └ eslint        │ 7.26.0  │   2.99 MB │      110 │       13 │   9.53 MB │
└─────────────────────┴─────────┴───────────┴──────────┴──────────┴───────────┘
```

# Node.js API
```js
var NMLS = require("nmls");
var nmls = new NMLS();
var option = {};
nmls.start(option).then((info) => {
    console.log("[nmls] done");
});
```
see [default options](./lib/options.js)

## Changelog

* v2.0.3
    * fixed color

* v2.0.2
    * fixed absolute path issue for ignore
