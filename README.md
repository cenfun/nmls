# nmls - Node Modules List
An analysis tool to show dependencies detail in node modules folder.

![](https://img.shields.io/npm/v/nmls)
![](https://img.shields.io/npm/dt/nmls)

# CLI Usage
```sh
# Install
npm install nmls -g

# go to project folder and execute:
nmls

# sort by dependency size
nmls -s dSize
nmls --sort dSize

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
│   ├  -f, --files            │ show files columns                                                │
│   └  -h, --help             │ display help for command                                          │
└─────────────────────────────┴───────────────────────────────────────────────────────────────────┘
```
# Output Example
```
nmls -f
[nmls] root: G:/workspace/nmls
[nmls] generated node modules: 135  (nested: 5  size percentage: 1.17 %)
┌──────────────────────────┬─────────┬───────┬───────────┬──────────┬──────────┬──────────┬───────────┐
│                          │         │       │           │     Deps │     Deps │     Deps │           │
│  Name                    │ Version │ Files │      Size │   Amount │   Nested │    Files │ Deps Size │
├──────────────────────────┼─────────┼───────┼───────────┼──────────┼──────────┼──────────┼───────────┤
│ └ nmls                   │ 3.0.3   │    16 │  34.24 KB │      135 │        5 │    1,766 │  11.47 MB │
│   ├ dependencies         │         │       │           │          │          │          │           │
│   │ ├ commander          │ 9.4.0   │    13 │ 165.62 KB │        0 │        0 │        0 │       0 B │
│   │ ├ console-grid       │ 2.0.0   │     5 │   35.1 KB │        0 │        0 │        0 │       0 B │
│   │ ├ eight-colors       │ 1.0.1   │     3 │   3.08 KB │        0 │        0 │        0 │       0 B │
│   │ ├ gauge              │ 4.0.4   │    18 │  42.15 KB │       11 │        0 │       57 │ 113.14 KB │
│   │ ├ glob               │ 8.0.3   │     6 │   53.6 KB │        8 │        2 │       37 │  82.09 KB │
│   │ └ ignore             │ 5.2.0   │     6 │  47.72 KB │        0 │        0 │        0 │       0 B │
│   └ devDependencies      │         │       │           │          │          │          │           │
│     ├ eslint             │ 8.22.0  │   397 │   2.67 MB │      110 │        3 │    1,016 │   6.99 MB │
│     ├ eslint-config-plus │ 1.0.3   │     8 │  49.29 KB │        0 │        0 │        0 │       0 B │
│     └ eslint-plugin-html │ 7.1.0   │    10 │   41.2 KB │        6 │        0 │      214 │   1.21 MB │
└──────────────────────────┴─────────┴───────┴───────────┴──────────┴──────────┴──────────┴───────────┘
```

# Node.js API
```js
const NMLS = require("nmls");
const option = {};
new NMLS().start(option).then((info) => {
    console.log("[nmls] done");
});
```
see [default options](lib/options.js)

## Changelog
see [CHANGELOG.md](CHANGELOG.md)
