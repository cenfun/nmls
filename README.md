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

#show module info
nmls -m console-grid
nmls --module console-grid
```
# Example
```
[nmls] path: C:/workspace/nmls
[nmls] generated project: nmls
[nmls] generated node modules
┌────────────────────┬─────────┬──────────┬──────────────┬──────────────┐
│                    │         │          │ Dependencies │ Dependencies │
│  Name              │ Version │     Size │       Amount │         Size │
├────────────────────┼─────────┼──────────┼──────────────┼──────────────┤
│ └ nmls             │ 2.0.0   │ 26.81 KB │           15 │    200.13 KB │
│   └ dependencies   │         │          │              │              │
│     ├ console-grid │ 1.0.16  │ 31.03 KB │            0 │          0 B │
│     ├ gauge        │ 2.7.4   │ 47.84 KB │           12 │     74.59 KB │
│     └ ignore       │ 5.1.4   │ 46.67 KB │            0 │          0 B │
└────────────────────┴─────────┴──────────┴──────────────┴──────────────┘
```
