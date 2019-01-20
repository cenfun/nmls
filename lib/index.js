var fs = require("fs");
var path = require("path");
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
        if (!this.packageJson) {
            console.log(GS.red("[nmls] ERROR: Failed to read package.json"));
            return;
        }

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

        var projectPath = this.root;
        var projectName = this.packageJson.name;
        var version = this.packageJson.version;
        var dependencies = this.packageJson.dependencies || {};

        var info = await this.generateFolderInfo(this.root, this.ig);
        console.log(info);

        this.projectInfo = {
            path: projectPath,
            name: projectName,
            version: version,
            dependencies: dependencies,
            mSize: info.mSize,
            mFiles: info.mFiles,
            dSize: 0,
            dFiles: 0
        };

        this.moduleList = {};

        //this.moduleList[projectName]

        await this.generateModuleList(projectPath + "/node_modules");
        this.hideTips();

        //console.log(this.moduleList);

        this.initDependencies(dependencies);
        this.drawGrid(dependencies);

    }

    async generateModuleList(folderPath, scope) {

        var list = await this.readdir(folderPath);
        for (let subName of list) {
            var subPath = folderPath + "/" + subName;
            var stats = await this.stat(subPath);
            if (!stats) {
                continue;
            }
            if (stats.isDirectory()) {

                //@scope module
                if (!scope && subName.indexOf("@") === 0) {
                    await this.generateModuleList(subPath, subName);
                } else {

                    var subInfo = await this.generateFolderInfo(subPath);
                    //sub module
                    this.projectInfo.dSize += subInfo.mSize;
                    this.projectInfo.dFiles += subInfo.mFiles;

                    //cache module
                    if (this.hasPackageJson(subPath)) {

                        var moduleName = scope ? scope + "/" + subName : subName;
                        subInfo.name = moduleName;

                        await this.generateModuleInfo(subInfo, subPath);

                        this.moduleList[moduleName] = subInfo;
                        this.showTips("[nmls] reading module: " + moduleName);
                    }

                }

            } else {

                //files stats
                this.projectInfo.dSize += stats.size;
                this.projectInfo.dFiles += 1;

            }

        }

    }

    async generateModuleInfo(subInfo, subPath) {
        subInfo.path = subPath;
        var packageJson = this.readJSON(subPath + "/package.json");
        if (packageJson) {
            subInfo.dependencies = packageJson.dependencies;
            subInfo.version = packageJson.version;
        }
    }

    async generateFolderInfo(folderPath, ig) {
        var folderInfo = {
            mSize: 0,
            mFiles: 0
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

            var stats = await this.stat(subPath);
            if (!stats) {
                continue;
            }
            if (stats.isDirectory()) {
                var subInfo = await this.generateFolderInfo(subPath);
                folderInfo.mSize += subInfo.mSize;
                folderInfo.mFiles += subInfo.mFiles;
            } else {
                folderInfo.mSize += stats.size;
                folderInfo.mFiles += 1;
            }
        }
        return folderInfo;
    }


    //========================================================================================

    initDependencies(dependencies) {

        for (var name in dependencies) {
            //console.log(name);
            var info = this.moduleList[name];
            if (!info) {
                console.log(GS.yellow("[nmls] WARN: Not found module: " + name));
                continue;
            }

            //already generated
            if (typeof (info.dSize) === "number") {
                continue;
            }

            info.dSize = 0;
            info.dFiles = 0;

            //check sub dependencies
            this.initSubDependencies(name, info);

        }

    }

    initSubDependencies(parentName, dInfo) {

        var subInfo = this.moduleList[parentName];
        if (!subInfo) {
            console.log(GS.yellow("[nmls] WARN: Not found sub module: " + name));
            return;
        }

        dInfo.dSize += subInfo.mSize;
        dInfo.dFiles += subInfo.mFiles;

        //already generated all subs dependencies info
        if (typeof (subInfo.dSize) === "number") {
            dInfo.dSize += subInfo.dSize;
            dInfo.dFiles += subInfo.dFiles;
            return;
        }


        //get subs info
        subInfo.dSize = 0;
        subInfo.dFiles = 0;
        var dependencies = subInfo.dependencies;
        if (dependencies) {
            for (var name in dependencies) {
                this.initSubDependencies(name, subInfo);
            }
        }
        dInfo.dSize += subInfo.dSize;
        dInfo.dFiles += subInfo.dFiles;

    }

    drawGrid(dependencies) {

        //rows
        var dRows = [];
        if (dependencies) {
            for (var k in dependencies) {
                var item = this.moduleList[k];
                if (item) {
                    dRows.push(item);
                }
            }
        }
        this.projectInfo.subs = dRows;
        var rows = [this.projectInfo];

        //console.log(dRows);

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
            type: "number",
            maxWidth: 8
        }, {
            id: "dFiles",
            name: "Files of Dependency",
            type: "number",
            maxWidth: 10
        }, {
            id: "mSize",
            name: "Size of Module",
            type: "number",
            maxWidth: 10,
            formatter: (v, row) => {
                return this.toBytes(v);
            }
        }, {
            id: "dSize",
            name: "Size of Dependency",
            type: "number",
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
        return "dSize";
    }


    toBytes(bytes) {

        if (bytes <= 0) {
            return "0";
        }

        var k = 1024;
        if (bytes < k) {
            return `${bytes} B`;
        }
        var m = k * k;
        if (bytes < m) {
            return `${Math.round(bytes / k * 100) / 100} KB`;
        }
        var g = m * k;
        if (bytes < g) {
            var gStr = `${Math.round(bytes / m * 100) / 100} MB`;
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
            var tStr = `${Math.round(bytes / g * 100) / 100} GB`;
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
            try {
                json = JSON.parse(content);
            } catch (e) {
                console.log(e);
            }
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