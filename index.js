var fs = require("fs");
var path = require("path");
//var shelljs = require("shelljs");
var numeral = require("numeral");
var JSON5 = require('json5');
var clc = require("cli-color");

class NMLS {

    constructor() {
        this.root = ".";
        console.log("execute path: " + this.root);

        this.init();

    }

    async init() {

        if (!this.hasPackageJson(this.root)) {
            console.log("ERROR: Not found package.json");
            return;
        }

        this.packageJson = this.readJSON(this.root + "/package.json");

        await this.readNodeModules();

    }

    async readNodeModules() {

        if (!this.hasNodeModules(this.root)) {
            console.log("ERROR: Not found node_modules, try npm install first.");
            return;
        }

        this.moduleList = {};

        console.log("generate module info ....");

        var folderPath = this.root;
        var folderName = this.packageJson.name;
        var moduleInfo = await this.generateInfo(folderPath, folderName);
        moduleInfo.sizeText = numeral(moduleInfo.size).format("0.00b");

        this.hideTips();

        console.log(moduleInfo);

        console.log(Object.keys(this.moduleList));

        await this.readDependencies();

    }

    isModuleRoot(folderPath, folderName) {
        if (folderName === this.packageJson.name) {
            return true;
        }

        if (this.hasPackageJson(folderPath)) {
            //filter server folder
            var pPath = path.resolve(folderPath, "../");
            var ppPath = path.resolve(pPath, "../");
            var ppName = path.relative(ppPath, pPath);
            if (ppName === "node_modules") {
                return true;
            } else if (ppName.indexOf("@") === 0) {
                //@folder
                var pppPath = path.resolve(ppPath, "../");
                var pppName = path.relative(pppPath, ppPath);
                if (pppName === "node_modules") {
                    return true;
                }
            }
        }

        return false;
    }

    initModuleInfo(moduleName, moduleInfo) {
        this.showTips("reading module: " + moduleName);

        var modulePath = moduleInfo.folderPath;
        var config = this.readJSON(modulePath + "/package.json");
        var moduleVersion = config.version;
        moduleInfo.version = moduleVersion;

        var existsModule = this.moduleList[moduleName];
        if (existsModule) {
            if (existsModule[moduleVersion]) {
                this.log(clc.green("existing version: " + moduleName + "@" + moduleVersion));
                this.log(existsModule[moduleVersion].folderPath + " => " + moduleInfo.folderPath);
            } else {
                existsModule[moduleVersion] = moduleInfo;
            }
        } else {
            var newModule = {};
            newModule[moduleVersion] = moduleInfo;
            this.moduleList[moduleName] = newModule;
        }
    }

    async generateInfo(folderPath, folderName) {

        var folderInfo = {
            folderName: folderName,
            folderPath: folderPath,
            folderNumber: 1,
            fileNumber: 0,
            size: 0
        };

        var isModule = this.isModuleRoot(folderPath, folderName);
        if (isModule) {
            this.initModuleInfo(folderName, folderInfo);
        }

        var list = await this.readdir(folderPath);
        for (let subName of list) {
            var subPath = folderPath + "/" + subName;
            var info = await this.stat(subPath);
            if (!info) {
                continue;
            }
            if (info.isDirectory()) {
                var subInfo = await this.generateInfo(subPath, subName);
                folderInfo.folderNumber += subInfo.folderNumber;
                folderInfo.fileNumber += subInfo.fileNumber;
                folderInfo.size += subInfo.size;
            } else {
                folderInfo.size += info.size;
                folderInfo.fileNumber += 1;
            }

        }

        return folderInfo;

    }

    //========================================================================================

    readDependencies() {

        // var sh = shelljs.exec("npm list --json", {
        //     silent: true
        // });

        // if (sh.code) {
        //     console.log(sh.stderr);
        //     return;
        // }

        // //console.log(sh.stdout);

        // this.json = JSON.parse(sh.stdout);

        //console.log(this.json);



    }

    //========================================================================================

    hasPackageJson(p) {
        if (fs.existsSync(p + "/package.json")) {
            return true;
        }
        return false;
    }

    hasNodeModules(p) {
        if (fs.existsSync(p + "/node_modules")) {
            return true;
        }
        return false;
    }

    //========================================================================================

    async readdir(p) {
        return new Promise((resolve) => {
            fs.readdir(p, (err, list) => {
                if (err) {
                    console.log("ERROR: fs.readdir: " + p);
                    resolve([]);
                    return;
                }
                resolve(list);
            });
        });
    }

    async stat(p) {
        return new Promise((resolve) => {
            fs.stat(p, (err, stats) => {
                if (err) {
                    console.log("ERROR: fs.stat: " + p);
                    resolve(null);
                    return;
                }
                resolve(stats);
            });
        });
    }

    readFileContent(filePath) {
        var content = null;
        var isExists = fs.existsSync(filePath);
        if (isExists) {
            content = fs.readFileSync(filePath);
            if (Buffer.isBuffer(content)) {
                content = content.toString('utf8');
            }
        }
        return content;
    }

    writeFileContent(filePath, content, force) {
        var isExists = fs.existsSync(filePath);
        if (force || isExists) {
            fs.writeFileSync(filePath, content);
            return true;
        }
        return false;
    }

    readJSON(filePath) {
        //do NOT use require, it has cache
        var content = this.readFileContent(filePath);
        var json = null;
        if (content) {
            json = JSON5.parse(content);
        }
        return json;
    }

    writeJSON(filePath, json, force) {
        var content = this.jsonString(json, 4);
        if (!content) {
            console.log("Invalid JSON object");
            return false;
        }
        //end of line
        var EOL = '\n';
        content += EOL;
        return this.writeFileContent(filePath, content, force);
    }

    jsonString(obj, spaces) {

        if (typeof (obj) === "string") {
            return obj;
        }

        if (!spaces) {
            spaces = 2;
        }

        var str = "";
        try {
            str = JSON.stringify(obj, null, spaces);
        } catch (e) {
            console.log(e);
        }

        return str;
    }

    replace(str, obj, defaultValue) {
        str = str + "";
        if (!obj) {
            return str;
        }

        str = str.replace(/\{([^}]+)\}/g, function (match, key) {

            if (!obj.hasOwnProperty(key)) {
                if (typeof (defaultValue) !== "undefined") {
                    return defaultValue;
                }
                return match;
            }

            var val = obj[key];

            if (typeof (val) === "function") {
                val = val(obj, key);
            }

            if (typeof (val) === "undefined") {
                val = "";
            }

            return val;

        });
        return str;
    }

    //========================================================================================

    log(str) {
        this.hideTips();
        console.log(str);
    }

    showTips(str) {
        str = str + "";
        if (str === this.lastTips) {
            return;
        }
        var stream = process.stderr;
        if (!stream.isTTY) {
            return;
        }
        stream.clearLine();
        stream.cursorTo(0);
        stream.write(str);
        stream.clearLine(1);
        this.lastTips = str;
    }

    hideTips() {
        var stream = process.stderr;
        if (!stream.isTTY) {
            return;
        }
        stream.clearLine();
        stream.cursorTo(0);
    }


}

module.exports = NMLS;