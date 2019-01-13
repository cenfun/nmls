var fs = require("fs");
var child_process = require('child_process');
var Grid = require("console-grid");

class NMLS {

    constructor(root) {
        this.root = root || ".";
        console.log("[nmls] root: " + this.root);
    }

    async start() {

        if (!this.hasPackageJson(this.root)) {
            console.log("[nmls] ERROR: Not found package.json");
            return;
        }

        this.packageJson = this.readJSON(this.root + "/package.json");

        await this.readNodeModules();

    }

    async readNodeModules() {

        if (!this.hasNodeModules(this.root)) {
            console.log("[nmls] ERROR: Not found node_modules, try npm install first.");
            return;
        }

        console.log("[nmls] generate module list ...");

        var projectName = this.packageJson.name;
        var projectPath = this.root;

        this.projectInfo = {
            path: projectPath,
            name: projectName,
            version: this.packageJson.version,
            files: 0,
            size: 0
        };
        this.moduleList = {};

        //this.moduleList[projectName]

        await this.generateModuleList(projectPath + "/node_modules");
        this.hideTips();

        //console.log(this.moduleList);

        var tree = await this.getNpmList();

        this.initDependencies(tree.dependencies);

        //console.log(tree);

        Object.keys(this.projectInfo).forEach((k) => {
            console.log(" - " + k + ": " + this.projectInfo[k]);
        });

        this.drawGrid(tree.dependencies);

    }

    async generateModuleList(folderPath, scope) {

        var list = await this.readdir(folderPath);
        for (let subName of list) {
            var subPath = folderPath + "/" + subName;
            var info = await this.stat(subPath);
            if (!info) {
                continue;
            }
            if (info.isDirectory()) {

                //@scope module
                if (!scope && subName.indexOf("@") === 0) {
                    await this.generateModuleList(subPath, subName);
                } else {

                    var subInfo = await this.generateFolderInfo(subPath);
                    this.projectInfo.files += subInfo.files;
                    this.projectInfo.size += subInfo.size;

                    //cache module
                    if (this.hasPackageJson(subPath)) {
                        var moduleName = scope ? scope + "/" + subName : subName;
                        subInfo.path = subPath;
                        subInfo.name = moduleName;
                        this.moduleList[moduleName] = subInfo;
                        this.showTips("[nmls] reading module: " + moduleName);
                    }

                }

            } else {

                this.projectInfo.files += 1;
                this.projectInfo.size += info.size;
            }

        }

    }

    async generateFolderInfo(folderPath) {
        var folderInfo = {
            files: 0,
            size: 0
        };
        var list = await this.readdir(folderPath);
        for (let subName of list) {
            var subPath = folderPath + "/" + subName;
            var info = await this.stat(subPath);
            if (!info) {
                continue;
            }
            if (info.isDirectory()) {
                var subInfo = await this.generateFolderInfo(subPath);
                folderInfo.files += subInfo.files;
                folderInfo.size += subInfo.size;
            } else {
                folderInfo.files += 1;
                folderInfo.size += info.size;
            }
        }
        return folderInfo;
    }


    //========================================================================================

    async getNpmList() {

        console.log(`exec: npm list --json ...`);

        return new Promise((resolve) => {

            child_process.exec('npm list --json', {

                maxBuffer: 5000 * 1024

            }, (error, stdout, stderr) => {

                if (error) {
                    //console.error(`exec "npm list --json" error: ${error}`);
                }

                var json = JSON.parse(stdout);

                resolve(json);

            });

        });

    }

    initDependencies(dependencies) {

        for (var name in dependencies) {
            //console.log(name);
            var info = this.moduleList[name];
            if (info) {
                var item = dependencies[name];
                item.name = name;
                //self folder size, without sub dependencies
                item.path = info.path;
                item.files = info.files;
                item.size = info.size;
                var cache = {};
                //check sub dependencies
                this.initSubDependencies(item, cache);

            } else {
                console.log("ERROR: Not found module info: " + name);
            }

        }

    }

    initSubDependencies(parent, cache) {

        var dependencies = parent.dependencies;
        if (!dependencies) {
            return;
        }

        for (var name in dependencies) {

            //find in node_modules first
            var inPath = parent.path + "/node_modules/" + name;

            if (fs.existsSync(inPath)) {
                //console.log(name, inPath);
                continue;
            }

            if (cache[name]) {
                //console.log(name, "deduped");
                continue;
            }

            //in flat path
            var info = this.moduleList[name];
            if (info) {
                //check sub dependencies
                var item = dependencies[name];
                item.name = name;
                //self folder size, without sub dependencies
                item.path = info.path;
                item.size = info.size;
                item.files = info.files;

                cache[name] = true;

                this.initSubDependencies(item, cache);

                //add to parent
                parent.size += item.size;
                parent.files += item.files;

            } else {
                console.log("ERROR: Not found sub module info: " + name);
            }

        }

    }

    drawGrid(dependencies) {

        var gridData = {
            columns: [{
                id: "name",
                name: " Name",
                color: "green",
                formatter: (v, row) => {
                    var str = " |- ";
                    if (row.space) {
                        str = row.space + str;
                    }
                    return str + v;
                }
            }, {
                id: "version",
                name: "Version"
            }, {
                id: "files",
                name: "Files"
            }, {
                id: "size",
                name: "Size"
            }, {
                id: "bytes",
                name: "Bytes",
                formatter: (v, row) => {
                    return this.toBytes(row.size);
                }
            }],
            rows: [this.projectInfo]
        };

        if (dependencies) {
            for (var k in dependencies) {
                var item = dependencies[k];
                item.space = "   ";
                gridData.rows.push(item);
            }
        }

        var grid = new Grid();
        grid.render(gridData);

    }

    //30:'black', 31:'red', 32:'green', 33:'yellow', 34:'blue', 35:'magenta', 36:'cyan', 37:'white'
    toBytes(bytes) {
        var k = 1024;
        if (bytes < k) {
            return `${bytes}b`;
        }

        var m = k * k;
        if (bytes < m) {
            return `${Math.round(bytes / k * 100) / 100}Kb`;
        }

        var g = m * k;
        if (bytes < g) {

            var gStr = `${Math.round(bytes / m * 100) / 100}Mb`;
            if (bytes < 10 * m) {
                return `\x1b[32m${gStr}\x1b[39m`;
            } else if (bytes < 100 * m) {
                return `\x1b[33m${gStr}\x1b[39m`;
            } else {
                return `\x1b[31m${gStr}\x1b[39m`;
            }

        }

        var t = g * k;
        if (bytes < t) {
            return `\x1b[35m${Math.round(bytes / g * 100) / 100}Gb\x1b[39m`;
        }

        return bytes;

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
            json = JSON.parse(content);
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