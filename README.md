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

# more options help
nmls -h
nmls --help
┌─────────────────────────┬─────────────────────────────────────────────────────────────┐
│ Commands/Options        │ Description                                                 │
├─────────────────────────┼─────────────────────────────────────────────────────────────┤
│ ├ nmls                  │ An analysis tool to Node Modules List                       │
│ │ ├  -v, --version      │ output the version number                                   │
│ │ ├  -r, --root <path>  │ root path, default value is '.' (current working directory) │
│ │ ├  -p, --prod         │ prod dependencies only (no devDependencies)                 │
│ │ ├  -f, --files        │ show files info                                             │
│ │ ├  -s, --sort <field> │ sort field (name/version/size/files/deps/dSize/nested)      │
│ │ ├  -a, --asc          │ asc or desc (default)                                       │
│ │ └  -h, --help         │ display help for command                                    │
│ └ nmls [name]           │ specified module name to list                               │
└─────────────────────────┴─────────────────────────────────────────────────────────────┘
```
# Output Example
```
nmls -f
[nmls] root: H:/workspace/nmls
[nmls] node modules: 119  files: 1,674  size: 11.9 MB
[nmls] nested: 4  files: 58  size: 339.4 KB (2.8%)
┌──────────────────────────┬─────────┬───────┬──────────┬──────┬───────────┬────────┐
│  Name                    │ Version │ Files │     Size │ Deps │ Deps Size │ Nested │
├──────────────────────────┼─────────┼───────┼──────────┼──────┼───────────┼────────┤
│ └ nmls                   │ 4.0.0   │     8 │  36.2 KB │  119 │   11.8 MB │      4 │
│   ├ dependencies         │         │       │          │      │           │        │
│   │ ├ commander          │ 10.0.0  │    13 │ 169.6 KB │    0 │       0 B │      0 │
│   │ ├ commander-help     │ 1.0.0   │     4 │  9.37 KB │    2 │   50.7 KB │      0 │
│   │ ├ console-grid       │ 2.0.1   │     6 │  36.9 KB │    0 │       0 B │      0 │
│   │ ├ eight-colors       │ 1.0.2   │     6 │  13.8 KB │    0 │       0 B │      0 │
│   │ ├ gauge              │ 5.0.0   │    18 │  42.1 KB │   11 │  113.1 KB │      0 │
│   │ ├ glob               │ 9.2.1   │    65 │ 290.0 KB │    7 │  808.9 KB │      2 │
│   │ └ ignore             │ 5.2.4   │     6 │  50.0 KB │    0 │       0 B │      0 │
│   └ devDependencies      │         │       │          │      │           │        │
│     ├ eslint             │ 8.35.0  │   400 │  2.73 MB │   97 │   7.61 MB │      2 │
│     └ eslint-config-plus │ 1.0.6   │     9 │  50.5 KB │    0 │       0 B │      0 │
└──────────────────────────┴─────────┴───────┴──────────┴──────┴───────────┴────────┘
```

# Node.js API
```js
const NMLS = require("nmls");
const options = {};
new NMLS(options).start().then((info) => {
    console.log("[nmls] done");
});
```
see [default options](lib/options.js)

## Changelog
see [CHANGELOG.md](CHANGELOG.md)
