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
    sort: "dSize",
    asc: false,
    external: "devDependencies",
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

#show module info
nmls -m console-grid
nmls --module console-grid
```
# Example
```
[nmls] path: .
[nmls] generated root module: nmls
[nmls] generated all node modules
┌────────────────────┬─────────┬──────────┬────────────┬────────────┬────────────┐
│                    │         │   Module │     Module │ Dependency │ Dependency │
│  Name              │ Version │    Files │       Size │      Files │       Size │
├────────────────────┼─────────┼──────────┼────────────┼────────────┼────────────┤
│ └ nmls             │ 1.0.10  │        7 │   28.31 KB │         85 │  199.64 KB │
│   └ dependencies   │         │          │            │            │            │
│     ├ console-grid │ 1.0.10  │        8 │   31.06 KB │          0 │        0 B │
│     ├ gauge        │ 2.7.4   │       19 │   47.83 KB │         51 │   74.59 KB │
│     └ ignore       │ 5.1.1   │        7 │   46.17 KB │          0 │        0 B │
└────────────────────┴─────────┴──────────┴────────────┴────────────┴────────────┘
```
