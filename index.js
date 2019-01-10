var fs = require("fs");
var shelljs = require("shelljs");

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

        this.json = JSON.parse(sh.stdout);

        console.log(this.json);

        this.readNodeModules();

    }

    readNodeModules() {

        var modulePath = "./node_modules";
        if (!fs.existsSync(modulePath)) {
            console.log("ERROR: Not found node_modules folder, try npm install first.");
            return;
        }

        this.moduleInfo = {};

        var list = fs.readdirSync(modulePath);
        list.forEach((moduleName) => {
            var info = fs.lstatSync(modulePath + "/" + moduleName);
            if (info.isDirectory()) {
                this.moduleInfo[moduleName] = info;
            }
        });

        console.log(this.moduleInfo);


    }



}

module.exports = NMLS;