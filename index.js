var fs = require("fs");
var fsPromises = require('fs').promises;
var shelljs = require("shelljs");
var numeral = require("numeral");

class NMLS {

    constructor() {
        this.root = process.cwd();
        console.log("execute path: " + this.root);

        this.npmList();

    }

    npmList() {

        var sh = shelljs.exec("npm list --json", {
            silent: true
        });

        if (sh.code) {
            console.log(sh.stderr);
            return;
        }

        console.log(sh.stdout);

        this.json = JSON.parse(sh.stdout);

        //console.log(this.json);

        this.readNodeModules();

    }

    async readNodeModules() {

        var modulePath = "./node_modules";
        if (!fs.existsSync(modulePath)) {
            console.log("ERROR: Not found node_modules folder, try npm install first.");
            return;
        }

        console.log("start to generate info ....");

        var moduleInfo = await this.generateInfo(modulePath);


        moduleInfo.sizeText = numeral(moduleInfo.size).format("0,0");

        console.log(moduleInfo);

    }

    async generateInfo(modulePath) {

        var moduleInfo = {
            depth: 1,
            folderNumber: 1,
            fileNumber: 0,
            size: 0
        };

        var hasSubFolder = false;
        var maxSubDepth = 1;

        var list = await fsPromises.readdir(modulePath);
        for (let subName of list) {
            var subPath = modulePath + "/" + subName;
            var info = await fsPromises.stat(subPath);
            if (info.isDirectory()) {
                hasSubFolder = true;
                var subInfo = await this.generateInfo(subPath);
                maxSubDepth = Math.max(maxSubDepth, subInfo.depth);
                moduleInfo.folderNumber += subInfo.folderNumber;
                moduleInfo.fileNumber += subInfo.fileNumber;
                moduleInfo.size += subInfo.size;
            } else {
                moduleInfo.size += info.size;
                moduleInfo.fileNumber += 1;
            }

        }

        if (hasSubFolder) {
            moduleInfo.depth += maxSubDepth;
        }

        return moduleInfo;

    }



}

module.exports = NMLS;