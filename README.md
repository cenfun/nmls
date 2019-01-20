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
nmls --sort dSize
```
# Example
```
[nmls] path: .
[nmls] generate module list ...
┌ ────────────────── ┬ ─────── ┬ ──────── ┬ ────────── ┬ ────────── ┬ ────────── ┐
│                    │         │   Module │ Dependency │     Module │ Dependency │
│  Name              │ Version │    Files │      Files │       Size │       Size │
├ ────────────────── ┼ ─────── ┼ ──────── ┼ ────────── ┼ ────────── ┼ ────────── ┤
│ |- nmls            │ 1.0.3   │        7 │         15 │   20.76 KB │   73.32 KB │
│    |- console-grid │ 1.0.7   │        8 │          0 │   28.18 KB │        0 B │
│    |- ignore       │ 5.0.4   │        7 │          0 │   45.14 KB │        0 B │
└ ────────────────── ┴ ─────── ┴ ──────── ┴ ────────── ┴ ────────── ┴ ────────── ┘
```
