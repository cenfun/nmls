# nmls
An analysis tool to Node Modules List

![npm](https://img.shields.io/npm/v/nmls.svg)
![npm](https://img.shields.io/npm/dt/nmls.svg)
![David](https://img.shields.io/david/cenfun/nmls.svg)

# Install
```
npm install nmls -g
```

# Usage
```
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