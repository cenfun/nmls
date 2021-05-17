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

# filter module with name
nmls -m my-module-name
nmls --module my-module-name

# show workspace
nmls -w
nmls --workspace

# filter workspace packages with name
nmls -w my-workspace-name

# more options help
nmls -h
nmls --help
 Usage: nmls [options]
┌─────────────────────────────┬───────────────────────────────────────────────────────────────────┐
│ Commands and Options        │ Description                                                       │
├─────────────────────────────┼───────────────────────────────────────────────────────────────────┤
│ └ nmls                      │                                                                   │
│   ├  -v, --version          │ output the version number                                         │
│   ├  -r, --root <path>      │ project root, default value is '.' (current working directory)    │
│   ├  -s, --sort <field>     │ sort field (name/version/size/dAmount/dNested/dSize/files/dFiles) │
│   ├  -a, --asc              │ sort by asc                                                       │
│   ├  -m, --module <name>    │ filter modules with name                                          │
│   ├  -w, --workspace [name] │ show all packages of workspace, or filter with name               │
│   ├  -f, --files            │ show files columns                                                │
│   └  -h, --help             │ display help for command                                          │
└─────────────────────────────┴───────────────────────────────────────────────────────────────────┘
```
# Output Example
```
nmls -f
[nmls] root: G:/workspace/nmls
[nmls] generated node modules: total: 134 nested: 23 (repetition: 17.16 %)
┌─────────────────────┬─────────┬───────┬───────────┬──────────┬──────────┬──────────┬───────────┐
│                     │         │       │           │     Deps │     Deps │     Deps │           │
│  Name               │ Version │ Files │      Size │   Amount │   Nested │    Files │ Deps Size │
├─────────────────────┼─────────┼───────┼───────────┼──────────┼──────────┼──────────┼───────────┤
│ └ nmls              │ 2.0.3   │    14 │  37.72 KB │      134 │       23 │    3,124 │  12.99 MB │
│   ├ dependencies    │         │       │           │          │          │          │           │
│   │ ├ commander     │ 7.2.0   │     8 │ 141.32 KB │        0 │        0 │        0 │       0 B │
│   │ ├ console-grid  │ 1.0.17  │     4 │  28.19 KB │        1 │        0 │        3 │   2.36 KB │
│   │ ├ eight-colors  │ 1.0.0   │     3 │   2.36 KB │        0 │        0 │        0 │       0 B │
│   │ ├ gauge         │ 3.0.0   │    19 │  48.15 KB │       10 │        0 │       46 │   70.8 KB │
│   │ ├ glob          │ 7.1.7   │     7 │   54.6 KB │       10 │        0 │       46 │  85.69 KB │
│   │ ├ ignore        │ 5.1.8   │     7 │  48.65 KB │        0 │        0 │        0 │       0 B │
│   │ └ object-assign │ 4.1.1   │     4 │    6.3 KB │        0 │        0 │        0 │       0 B │
│   └ devDependencies │         │       │           │          │          │          │           │
│     └ eslint        │ 7.26.0  │   395 │   2.99 MB │      117 │       23 │    2,638 │   9.66 MB │
└─────────────────────┴─────────┴───────┴───────────┴──────────┴──────────┴──────────┴───────────┘
```

# Node.js API
```js
const NMLS = require("nmls");
const option = {};
new NMLS().start(option).then((info) => {
    console.log("[nmls] done");
});
```
see [default options](./lib/options.js)

## Changelog

* 3.0.0
    * support workspace

* 2.0.3
    * fixed color

* 2.0.2
    * fixed absolute path issue for ignore
