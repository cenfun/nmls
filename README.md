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
nmls.start().then(() => {
    console.log("[nmls] done");
});
```
# Global Command Usage
```
npm install nmls -g
#go to module folder and run:
nmls
```
# Example
```
[nmls] root: .
[nmls] generate module list ...
[nmls] exec: npm list --json ...
------------------- | ------- | ----- | ----- | -------
 Name               | Version | Files | Size  | Bytes
------------------- | ------- | ----- | ----- | -------
 |- nmls            | 1.0.0   | 6     | 12278 | 11.99Kb
    |- console-grid | 1.0.0   | 6     | 12278 | 11.99Kb
------------------- | ------- | ----- | ----- | -------
```
