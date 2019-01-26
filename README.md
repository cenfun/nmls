# nmls
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
    sort: "dSize"
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

#show module info
nmls -m console-grid
nmls --module console-grid
```
# Example
```
[nmls] path: .
[nmls] generate root info ...
[nmls] generate module tree ...
┌ ────────────────── ┬ ─────── ┬ ──────── ┬ ────────── ┬ ────────── ┬ ────────── ┐
│                    │         │   Module │     Module │ Dependency │ Dependency │
│  Name              │ Version │    Files │       Size │      Files │       Size │
├ ────────────────── ┼ ─────── ┼ ──────── ┼ ────────── ┼ ────────── ┼ ────────── ┤
│ └ nmls             │ 1.0.6   │        6 │    23.7 KB │        110 │  243.34 KB │
│   └ dependencies   │         │          │            │            │            │
│     ├ console-grid │ 1.0.9   │        8 │   29.67 KB │          0 │        0 B │
│     ├ gauge        │ 2.7.4   │       19 │   47.83 KB │         51 │   74.59 KB │
│     └ npm-packlist │ 1.2.0   │        4 │   11.87 KB │         28 │   79.39 KB │
└ ────────────────── ┴ ─────── ┴ ──────── ┴ ────────── ┴ ────────── ┴ ────────── ┘
```
