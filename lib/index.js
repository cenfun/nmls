const fs = require("fs");
const packList = require('npm-packlist');
const ConsoleGrid = require("console-grid");
const CGS = ConsoleGrid.Style;
const consoleGrid = new ConsoleGrid();

class NMLS {

    constructor(root) {
        this.root = root || ".";
        console.log("[nmls] path: " + this.root);
    }

    async start(option) {

        this.option = option || {};

        if (!this.hasNodeModules(this.root)) {
            console.log(CGS.red("[nmls] ERROR: Not found node_modules, or try npm install first."));
            return;
        }

        var moduleName = this.option.m || this.option.module;
        if (moduleName) {
            this.modulePath = this.root + "/node_modules/" + moduleName;
        } else {
            this.modulePath = this.root;
        }

        if (!this.hasPackageJson(this.modulePath)) {
            console.log(CGS.red("[nmls] ERROR: Not found module package.json"));
            return;
        }

        this.moduleJson = this.readJSON(this.modulePath + "/package.json");
        if (!this.moduleJson) {
            console.log(CGS.red("[nmls] ERROR: Failed to read module package.json"));
            return;
        }

        await this.readNodeModules();

    }

    //========================================================================================

    async readNodeModules() {

        console.log("[nmls] generate module info ...");
        this.moduleInfo = await this.generateModuleInfo();

        console.log("[nmls] generate module list ...");
        this.moduleList = {};
        await this.generateModuleList(this.root + "/node_modules");
        this.hideTips();

        //console.log(this.moduleList);

        if (this.modulePath === this.root) {
            //root module use total size/files directly
            this.moduleInfo.dSize = this.moduleInfo.tSize;
            this.moduleInfo.dFiles = this.moduleInfo.tFiles;
            //devDependencies only for root module, sub module should not install devDependencies
            this.moduleInfo.dependenciesInfo = await this.generateDependencies("dependencies");
            this.moduleInfo.devDependenciesInfo = await this.generateDependencies("devDependencies");
        } else {
            //because generateModuleInfo do NOT generate node_modules be ignore
            var mInfo = this.getModuleInfo(this.moduleInfo.name);
            if (mInfo) {
                this.moduleInfo.mSize = mInfo.mSize;
                this.moduleInfo.mFiles = mInfo.mFiles;
            } else {
                console.log("[nmls] WARN: Not found module: " + CGS.yellow(this.moduleInfo.name));
            }
            //calculate dSize and dFiles for sub module
            this.generateSubDependencies(this.moduleInfo, {});
            this.moduleInfo.dependenciesInfo = await this.generateDependencies("dependencies");
        }

        this.showGrid();

    }

    async generateModuleInfo() {

        //get project file list exclude ignore files
        var list = await packList({
            path: this.modulePath
        });

        //console.log(list);

        var mSize = 0;
        for (let filePath of list) {
            var stats = await this.stat(this.modulePath + "/" + filePath);
            if (stats) {
                mSize += stats.size;
            }
        }

        var moduleInfo = {
            path: this.modulePath,
            name: this.moduleJson.name,
            version: this.moduleJson.version,
            dependencies: this.moduleJson.dependencies,
            devDependencies: this.moduleJson.devDependencies,
            mSize: mSize,
            mFiles: list.length,
            dSize: 0,
            dFiles: 0,
            tSize: 0,
            tFiles: 0
        };

        return moduleInfo;

    }

    //========================================================================================

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
                    this.moduleInfo.tSize += subInfo.mSize;
                    this.moduleInfo.tFiles += subInfo.mFiles;

                    //cache module
                    if (this.hasPackageJson(subPath)) {

                        var moduleName = scope ? scope + "/" + subName : subName;
                        subInfo.name = moduleName;

                        await this.generateSubModuleInfo(subInfo, subPath);

                        this.setModuleInfo(moduleName, subInfo);

                        this.showTips("[nmls] reading module: " + moduleName);
                    }

                }

            } else {

                //files stats
                this.moduleInfo.tSize += stats.size;
                this.moduleInfo.tFiles += 1;

            }

        }

    }

    async generateSubModuleInfo(subInfo, subPath) {
        subInfo.path = subPath;
        var moduleJson = this.readJSON(subPath + "/package.json");
        if (moduleJson) {
            subInfo.dependencies = moduleJson.dependencies;
            subInfo.version = moduleJson.version;
        }
    }

    async generateFolderInfo(folderPath) {
        var folderInfo = {
            mSize: 0,
            mFiles: 0
        };
        var list = await this.readdir(folderPath);
        for (let subName of list) {
            var subPath = folderPath + "/" + subName;
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

    async generateDependencies(key) {

        var dInfo = {
            name: key,
            version: "",
            mSize: "",
            mFiles: "",
            dSize: "",
            dFiles: ""
        };

        var dependencies = this.moduleInfo[key];
        if (!dependencies) {
            return dInfo;
        }

        for (var name in dependencies) {
            //console.log(name);
            var info = this.getModuleInfo(name);
            if (!info) {
                console.log("[nmls] WARN: Not found module: " + CGS.yellow(name));
                continue;
            }

            //already generated
            if (typeof (info.dSize) === "number") {
                continue;
            }

            info.dSize = 0;
            info.dFiles = 0;

            //check sub dependencies
            this.generateSubDependencies(info, {});

        }

        return dInfo;

    }

    generateSubDependencies(parentInfo, used) {

        var dependencies = parentInfo.dependencies;
        if (!dependencies) {
            return;
        }

        for (var subName in dependencies) {

            //check in relative node_modules folder first
            var localPath = parentInfo.path + "/node_modules/" + subName;
            if (fs.existsSync(localPath)) {
                //console.log("local: " + subName);
                var localInfo = {
                    name: subName,
                    path: localPath,
                    dSize: 0,
                    dFiles: 0
                };
                this.generateLocalDependencies(localInfo, used);
                parentInfo.dSize += localInfo.dSize;
                parentInfo.dFiles += localInfo.dFiles;
                continue;
            }

            if (used[subName]) {
                continue;
            }

            var subInfo = this.getModuleInfo(subName);
            if (!subInfo) {
                console.log("[nmls] WARN: Not found sub module: " + CGS.yellow(subName) + " which depends by " + parentInfo.name);
                continue;
            }

            used[subName] = true;

            parentInfo.dSize += subInfo.mSize;
            parentInfo.dFiles += subInfo.mFiles;

            //already generated all subs dependencies info
            if (typeof (subInfo.dSize) === "number") {
                parentInfo.dSize += subInfo.dSize;
                parentInfo.dFiles += subInfo.dFiles;
                //console.log("already: " + subName);
                continue;
            }

            //get subs info
            subInfo.dSize = 0;
            subInfo.dFiles = 0;

            this.generateSubDependencies(subInfo, used);

            parentInfo.dSize += subInfo.dSize;
            parentInfo.dFiles += subInfo.dFiles;

        }


    }

    generateLocalDependencies(localInfo, used) {
        var moduleJson = this.readJSON(localInfo.path + "/package.json");
        if (moduleJson) {
            localInfo.dependencies = moduleJson.dependencies;
            this.generateSubDependencies(localInfo, used);
        }
    }

    //========================================================================================

    getDependenciesInfo(key) {
        var dependenciesInfo = this.moduleInfo[key + "Info"];
        if (!dependenciesInfo) {
            return null;
        }
        var subs = [];
        var dependencies = this.moduleInfo[key];
        for (var k in dependencies) {
            var info = this.getModuleInfo(k);
            if (info) {
                subs.push(info);
            }
        }
        if (!subs.length) {
            return null;
        }
        dependenciesInfo.subs = subs;
        return dependenciesInfo;
    }

    showGrid() {

        //project subs
        var subs = [];

        //dependencies rows
        var dependenciesInfo = this.getDependenciesInfo("dependencies");
        if (dependenciesInfo) {
            subs.push(dependenciesInfo);
        }
        //devDependencies rows
        var devDependenciesInfo = this.getDependenciesInfo("devDependencies");
        if (devDependenciesInfo) {
            subs.push(devDependenciesInfo);
        }

        //rows
        this.moduleInfo.subs = subs;
        var rows = [this.moduleInfo];

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
            name: "Module Files",
            type: "number",
            maxWidth: 8
        }, {
            id: "mSize",
            name: "Module Size",
            type: "number",
            maxWidth: 10,
            formatter: (v, row) => {
                if (typeof (v) !== "number") {
                    return v;
                }
                return this.toBytes(v);
            }
        }, {
            id: "dFiles",
            name: "Dependency Files",
            type: "number",
            maxWidth: 10
        }, {
            id: "dSize",
            name: "Dependency Size",
            type: "number",
            maxWidth: 10,
            formatter: (v, row) => {
                if (typeof (v) !== "number") {
                    return v;
                }
                return this.toBytes(v);
            }
        }];

        //option
        var sortField = "";
        var sort = this.option.s || this.option.sort;
        var sortColumn = this.getSortColumn(sort, columns);
        if (sortColumn) {
            sortField = sortColumn.id;
            console.log("[nmls] sort by: " + sortField + " - " + sortColumn.name);
        }
        var sortAsc = false;
        if (this.option.a || this.option.asc) {
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

        consoleGrid.render(data);

    }

    getSortColumn(sort, columns) {
        if (!sort) {
            return null;
        }

        if (sort === true) {
            sort = "mSize";
        }

        for (var i = 0, l = columns.length; i < l; i++) {
            var column = columns[i];
            if (sort === column.id) {
                return column;
            }
        }
        return null;
    }


    toBytes(bytes) {

        bytes = Math.max(bytes, 0);

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
                return CGS.green(gStr);
            } else if (bytes < 100 * m) {
                return CGS.yellow(gStr);
            } else {
                return CGS.red(gStr);
            }
        }
        var t = g * k;
        if (bytes < t) {
            var tStr = `${Math.round(bytes / g * 100) / 100} GB`;
            return CGS.magenta(tStr);
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

    setModuleInfo(name, info) {
        if (!name || !info) {
            return this;
        }
        this.moduleList[name] = info;
    }

    getModuleInfo(name) {
        if (!name) {
            return null;
        }
        return this.moduleList[name];
    }

    //========================================================================================

    async readdir(p) {
        return new Promise((resolve) => {
            fs.readdir(p, (err, list) => {
                if (err) {
                    console.log("[nmls] ERROR: fs.readdir: " + CGS.yellow(p));
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
                    console.log("[nmls] ERROR: fs.stat: " + CGS.yellow(p));
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