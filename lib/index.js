var fs = require("fs");
var path = require("path");
var child_process = require('child_process');
var ignore = require('ignore');
var Grid = require("console-grid");
var GS = Grid.style;

class NMLS {

    constructor(root) {
        this.root = root || ".";
        console.log("[nmls] path: " + this.root);
    }

    async start(option) {

        this.option = option || {};

        if (!this.hasPackageJson(this.root)) {
            console.log(GS.red("[nmls] ERROR: Not found package.json"));
            return;
        }

        this.packageJson = this.readJSON(this.root + "/package.json");

        //init ignore

        this.ig = ignore().add(['.git', '/node_modules']);
        await this.initIgnore();

        await this.readNodeModules();

    }

    async initIgnore() {
        var igPath = this.root + "/.gitignore";
        if (!fs.existsSync(igPath)) {
            return;
        }

        var content = this.readFileContent(igPath);
        if (!content) {
            return;
        }

        var list = content.split(/\r*\n/);
        list.forEach(item => {
            if (item) {
                this.ig.add(item);
                //console.log(item);
            }
        });

    }

    async readNodeModules() {

        if (!this.hasNodeModules(this.root)) {
            console.log(GS.red("[nmls] ERROR: Not found node_modules, try npm install first."));
            return;
        }

        console.log("[nmls] generate module list ...");

        var projectName = this.packageJson.name;
        var projectPath = this.root;

        var info = await this.generateFolderInfo(this.root, this.ig);
        //console.log(info);

        this.projectInfo = {
            path: projectPath,
            name: projectName,
            version: this.packageJson.version,
            mSize: info.size,
            mFiles: info.files,
            size: 0,
            files: 0
        };


        this.moduleList = {};

        //this.moduleList[projectName]

        await this.generateModuleList(projectPath + "/node_modules");
        this.hideTips();

        //console.log(this.moduleList);

        var tree = await this.getNpmList();

        this.initDependencies(tree.dependencies);

        //console.log(tree);

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
                    this.projectInfo.size += subInfo.size;
                    this.projectInfo.files += subInfo.files;

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

                this.projectInfo.size += info.size;
                this.projectInfo.files += 1;

            }

        }

    }

    async generateFolderInfo(folderPath, ig) {
        var folderInfo = {
            size: 0,
            files: 0
        };
        var list = await this.readdir(folderPath);
        for (let subName of list) {
            var subPath = folderPath + "/" + subName;

            if (ig) {
                var ps = path.relative(this.root, subPath);
                if (ig.ignores(ps)) {
                    //console.log(subPath);
                    continue;
                }
            }

            var info = await this.stat(subPath);
            if (!info) {
                continue;
            }
            if (info.isDirectory()) {
                var subInfo = await this.generateFolderInfo(subPath);
                folderInfo.size += subInfo.size;
                folderInfo.files += subInfo.files;
            } else {
                folderInfo.size += info.size;
                folderInfo.files += 1;
            }
        }
        return folderInfo;
    }


    //========================================================================================

    async getNpmList() {

        console.log(`[nmls] exec: npm list --json ...`);

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
                item.path = info.path;

                item.mSize = info.size;
                item.mFiles = info.files;

                item.size = 0;
                item.files = 0;

                var cache = {};
                //check sub dependencies
                this.initSubDependencies(item, cache);

                //console.log(Object.keys(this.moduleList).length);
                //console.log(Object.keys(cache).length);

            } else {
                console.log(GS.yellow("[nmls] WARN: Not found module: " + name));
            }

        }

    }

    initSubDependencies(parent, cache) {

        var dependencies = parent.dependencies;
        if (!dependencies) {
            return;
        }

        for (var name in dependencies) {

            //in flat path
            var info = this.moduleList[name];
            if (!info) {
                console.log(GS.yellow("[nmls] WARN: Not found sub module: " + name));
                continue;
            }

            //check sub dependencies
            var item = dependencies[name];
            item.name = name;
            item.path = info.path;

            item.mSize = info.size;
            item.mFiles = info.files;

            item.size = info.size;
            item.files = info.files;

            this.initSubDependencies(item, cache);

            //add to parent
            parent.size += item.size;
            parent.files += item.files;

        }

    }

    drawGrid(dependencies) {

        //rows
        var dRows = [];
        if (dependencies) {
            for (var k in dependencies) {
                var item = dependencies[k];
                dRows.push(item);
            }
        }
        this.projectInfo.subs = dRows;
        var rows = [this.projectInfo];

        //columns
        var columns = [{
            id: "name",
            name: " Name",
            maxWidth: 60
        }, {
            id: "version",
            name: "Version",
            maxWidth: 10
        }, {
            id: "mFiles",
            name: "Files of Module",
            maxWidth: 8
        }, {
            id: "files",
            name: "Files of Dependency",
            maxWidth: 10
        }, {
            id: "mSize",
            name: "Size of Module",
            maxWidth: 8,
            formatter: (v, row) => {
                return this.toBytes(v);
            }
        }, {
            id: "size",
            name: "Size of Dependency",
            maxWidth: 10,
            formatter: (v, row) => {
                return this.toBytes(v);
            }
        }];

        //option
        var sortField = this.getSortField(columns);
        if (sortField) {
            console.log("[nmls] sort by: " + sortField);
        }
        var sortAsc = false;
        if (this.option.asc) {
            sortAsc = true;
        }
        var option = {
            sortField: sortField,
            sortAsc: sortAsc
        };

        //data
        var data = {
            option: option,
            columns: columns,
            rows: rows
        };

        var grid = new Grid();
        grid.setData(data);
        grid.render();

    }

    getSortField(columns) {
        var sort = this.option.sort || this.option.s;
        if (!sort) {
            return "";
        }
        for (var i = 0, l = columns.length; i < l; i++) {
            if (sort === columns[i].id) {
                return sort;
            }
        }
        return "size";
    }


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
                return GS.green(gStr);
            } else if (bytes < 100 * m) {
                return GS.yellow(gStr);
            } else {
                return GS.red(gStr);
            }
        }
        var t = g * k;
        if (bytes < t) {
            var tStr = `${Math.round(bytes / g * 100) / 100}Gb`;
            return GS.magenta(tStr);
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

    deleteFolder(p) {
        if (fs.existsSync(p)) {
            var files = fs.readdirSync(p);
            files.forEach((file) => {
                var curPath = p + "/" + file;
                if (fs.statSync(curPath).isDirectory()) {
                    this.deleteFolder(curPath);
                } else {
                    fs.unlinkSync(curPath);
                }
            });
            fs.rmdirSync(p);
        }
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