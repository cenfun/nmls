# nmls - Node Modules List
An analysis tool to show dependencies detail in node modules folder.

![npm](https://img.shields.io/npm/v/nmls.svg)
![npm](https://img.shields.io/npm/dt/nmls.svg)
![David](https://img.shields.io/david/cenfun/nmls.svg)

# Install
```
npm install nmls
```

# Usage
```
var NMLS = require("nmls");
var path = ".";
var nmls = new NMLS(path);
var option = {
    sort: "dSize",
    asc: false,
    module: ""
};
nmls.start(option).then(() => {
    console.log("[nmls] done");
});
```
# Global Command Usage
```
npm install nmls -g

#go to module folder and run:
nmls

#sort by dependency size
nmls -s dSize
nmls --sort dSize

#sort by asc
nmls -a
nmls --asc

#show module info
nmls -m console-grid
nmls --module console-grid

#show files
nmls -f
nmls --files
```
# Example
```
[nmls] path: C:/workspace/nmls
[nmls] generated project: nmls
[nmls] generated node modules: total: 14 nested: 0 duplications: 0.00%
┌─────────────────────┬─────────┬──────────┬──────────┬──────────┬───────────┐
│                     │         │          │     Deps │     Deps │           │
│  Name               │ Version │     Size │   Amount │   Nested │ Deps Size │
├─────────────────────┼─────────┼──────────┼──────────┼──────────┼───────────┤
│ └ nmls              │ 2.0.1   │ 27.29 KB │       14 │        0 │ 203.42 KB │
│   └ dependencies    │         │          │          │          │           │
│     ├ console-grid  │ 1.0.16  │ 31.03 KB │        0 │        0 │       0 B │
│     ├ gauge         │ 3.0.0   │ 48.15 KB │       10 │        0 │   70.8 KB │
│     ├ ignore        │ 5.1.4   │ 46.67 KB │        0 │        0 │       0 B │
│     └ object-assign │ 4.1.1   │  6.28 KB │        0 │        0 │       0 B │
└─────────────────────┴─────────┴──────────┴──────────┴──────────┴───────────┘
```

## Changelog

* v2.0.2
    * fixed absolute path issue for ignore
