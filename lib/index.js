const fs = require("fs");
const packList = require('npm-packlist');
const ConsoleGrid = require("console-grid");
const CGS = ConsoleGrid.Style;
const consoleGrid = new ConsoleGrid();

const Gauge = require('gauge');
const gauge = new Gauge();

function output() {
    gauge.disable();
    console.log.apply(console, arguments);
    gauge.enable();
}

class NMLS {

    constructor(root) {
        this.root = root || ".";
        output("[nmls] path: " + this.root);
    }

    async start(option) {

        this.option = option || {};

        this.rootInfo = await this.generateRootInfo();
        if (!this.rootInfo) {
            return;
        }

        //output(this.rootInfo);

        this.moduleInfo = await this.generateModuleInfo();
        if (!this.moduleInfo) {
            return;
        }

        //output(this.moduleInfo);

        await this.generateNodeModules();

        await this.initDependencies();

    }

    //========================================================================================

    async generateRootInfo() {
        output("[nmls] generate root info ...");

        this.rootModulesPath = this.getNodeModulesPath(this.root);

        if (!this.rootModulesPath) {
            output(CGS.red("[nmls] ERROR: Not found node_modules, or try npm install first."));
            return;
        }

        var rootJson = this.getModuleJson(this.root);
        if (!rootJson) {
            output(CGS.red("[nmls] ERROR: Failed to read package.json"));
            return;
        }

        //get project file list exclude ignore files
        var list = await packList({
            path: this.root
        });

        //output(list);

        var mSize = 0;
        for (let filePath of list) {
            var stats = await this.stat(this.root + "/" + filePath);
            if (stats) {
                mSize += stats.size;
            }
        }

        var rootInfo = {
            isRoot: true,
            path: this.root,
            name: rootJson.name,
            version: rootJson.version,
            dependencies: rootJson.dependencies,
            devDependencies: rootJson.devDependencies,
            allDependencies: Object.assign({}, rootJson.dependencies, rootJson.devDependencies),
            mSize: mSize,
            mFiles: list.length,
            dSize: 0,
            dFiles: 0,
            subs: {}
        };

        rootInfo.dLength = Object.keys(rootInfo.allDependencies).length;
        rootInfo.dLoaded = 0;

        return rootInfo;
    }

    showProgress(moduleName) {

        if (this.rootInfo.allDependencies[moduleName]) {
            this.rootInfo.dLoaded += 1;
        }

        var per = 0;
        if (this.rootInfo.dLength) {
            per = this.rootInfo.dLoaded / this.rootInfo.dLength;
        }

        gauge.show(moduleName, per);

    }

    async generateModuleInfo() {

        var moduleName = this.option.m || this.option.module;
        //no module set
        if (!moduleName) {
            return this.rootInfo;
        }

        output("[nmls] generate module info ...");

        var modulePath = this.root + "/node_modules/" + moduleName;
        var moduleJson = this.getModuleJson(modulePath);
        if (!moduleJson) {
            output(CGS.red("[nmls] ERROR: Failed to read module package.json: " + moduleName));
            return;
        }

        var moduleInfo = {
            isRoot: false,
            path: modulePath,
            name: moduleJson.name,
            version: moduleJson.version,
            dependencies: moduleJson.dependencies,
            mSize: 0,
            mFiles: 0,
            dSize: 0,
            dFiles: 0,
            subs: {}
        };

        return moduleInfo;

    }

    //========================================================================================

    async generateNodeModules() {

        output("[nmls] generate module tree ...");

        this.moduleTree = {
            tSize: 0,
            tFiles: 0,
            subs: {}
        };
        await this.generateModuleTree(this.moduleTree, this.rootModulesPath);

    }

    //========================================================================================
    /* eslint-disable max-statements,complexity */
    async generateModuleTree(parent, folderPath, scopeName) {

        var list = await this.readdir(folderPath);
        for (let subName of list) {

            var subPath = folderPath + "/" + subName;
            var stats = await this.stat(subPath);
            if (!stats) {
                continue;
            }

            //files stats
            if (!stats.isDirectory()) {
                parent.tSize += stats.size;
                parent.tFiles += 1;
                continue;
            }

            //@scope folder module
            if (subName.indexOf("@") === 0) {
                await this.generateModuleTree(parent, subPath, subName);
                continue;
            }

            //normal folder module
            var moduleJson = this.getModuleJson(subPath);
            var folderInfo = await this.generateFolderInfo(subPath, moduleJson);

            //show .bin folder info
            if (subName === ".bin") {
                //output(`[nmls] Found .bin: ${folderInfo.mFiles} files, ${folderInfo.mSize} B, ${subPath}`);
                continue;
            }

            //sub module
            parent.tSize += folderInfo.mSize;
            parent.tFiles += folderInfo.mFiles;

            //not a module
            if (!moduleJson) {
                continue;
            }

            //cache module
            var moduleName = scopeName ? scopeName + "/" + subName : subName;
            folderInfo.name = moduleName;
            folderInfo.path = subPath;
            folderInfo.version = moduleJson.version;
            folderInfo.dependencies = moduleJson.dependencies;
            folderInfo.parent = parent;

            //generate local modules
            if (folderInfo.subPath) {

                folderInfo.tSize = 0;
                folderInfo.tFiles = 0;
                folderInfo.subs = {};
                await this.generateModuleTree(folderInfo, folderInfo.subPath);
                parent.tSize += folderInfo.tSize;
                parent.tFiles += folderInfo.tFiles;

            }

            parent.subs[moduleName] = folderInfo;

            this.showProgress(moduleName);

        }

    }
    /* eslint-enable */

    async generateFolderInfo(folderPath, moduleJson) {
        var folderInfo = {
            mSize: 0,
            mFiles: 0
        };
        var list = await this.readdir(folderPath);
        for (let subName of list) {
            //exclude node_modules if it is a module folder
            if (moduleJson && subName === "node_modules") {
                folderInfo.subPath = folderPath + "/" + subName;
                continue;
            }
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

    getModuleInfo(name, parent) {
        if (!name) {
            return null;
        }

        if (parent) {
            //find from child list
            if (parent.subs) {
                let info = parent.subs[name];
                if (info) {
                    return info;
                }
            }
            //find from parent module list
            while (parent.parent) {
                if (parent.parent.subs) {
                    let info = parent.parent.subs[name];
                    if (info) {
                        return info;
                    }
                }
                parent = parent.parent;
            }
        }
        //find from root list
        return this.moduleTree.subs[name];

    }

    //========================================================================================

    async initDependencies() {

        if (this.moduleInfo.isRoot) {
            //root module use total size/files directly
            this.moduleInfo.dSize = this.moduleTree.tSize;
            this.moduleInfo.dFiles = this.moduleTree.tFiles;
            //devDependencies only for root module, sub module should not install devDependencies
            this.moduleInfo.devDependenciesInfo = await this.generateDependencies(this.moduleInfo, "devDependencies");
        } else {
            //because generateModuleInfo do NOT generate node_modules be ignore
            var info = this.getModuleInfo(this.moduleInfo.name);
            this.moduleInfo.mSize = info.mSize;
            this.moduleInfo.mFiles = info.mFiles;
            //if module has local sub modules
            this.moduleInfo.subs = info.subs;
            this.moduleInfo.parent = info.parent;
            //calculate dSize and dFiles for sub module
            this.generateSubDependencies(this.moduleInfo, info);
        }

        //both for root and module
        this.moduleInfo.dependenciesInfo = await this.generateDependencies(this.moduleInfo, "dependencies");

        this.showGrid();

    }


    async generateDependencies(m, k) {

        var dependencies = m[k];
        if (!dependencies) {
            return;
        }

        var subs = [];
        for (var name in dependencies) {
            //output(name);
            var info = this.getModuleInfo(name);
            if (!info) {
                output("[nmls] WARN: Not found module " + CGS.yellow(name) + " from " + m.path);
                continue;
            }

            var totalInfo = {
                name: name,
                version: info.version,
                mSize: info.mSize,
                mFiles: info.mFiles,
                dSize: 0,
                dFiles: 0
            };

            //check sub dependencies
            this.generateSubDependencies(totalInfo);

            subs.push(totalInfo);

        }

        if (!subs.length) {
            return;
        }

        var dInfo = {
            name: k,
            version: "",
            mSize: "",
            mFiles: "",
            dSize: "",
            dFiles: "",
            subs: subs
        };

        return dInfo;

    }

    /* eslint-disable max-statements,complexity */
    generateSubDependencies(totalInfo, currentModule) {

        if (!currentModule) {
            currentModule = this.getModuleInfo(totalInfo.name);
            if (!currentModule) {
                output("[nmls] WARN: Not found module " + CGS.yellow(totalInfo.name));
                return;
            }
        }

        var dependencies = currentModule.dependencies;
        if (!dependencies) {
            return;
        }

        if (!totalInfo.used) {
            totalInfo.used = {};
        }

        for (var subName in dependencies) {
            var subModule = this.getModuleInfo(subName, currentModule);
            if (!subModule) {
                output("[nmls] WARN: Not found sub module " + CGS.yellow(subName) + " from " + currentModule.path);
                continue;
            }

            if (totalInfo.used[subModule.path]) {
                continue;
            }
            totalInfo.used[subModule.path] = true;

            totalInfo.dSize += subModule.mSize;
            totalInfo.dFiles += subModule.mFiles;

            this.generateSubDependencies(totalInfo, subModule);

        }

    }
    /* eslint-enable */

    //========================================================================================

    showGrid() {

        //project subs
        var subs = [];

        //dependencies rows
        var dependenciesInfo = this.moduleInfo.dependenciesInfo;
        if (dependenciesInfo) {
            subs.push(dependenciesInfo);
        }
        //devDependencies rows
        var devDependenciesInfo = this.moduleInfo.devDependenciesInfo;
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
            output("[nmls] sort by: " + sortField + " - " + sortColumn.name);
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

    getModuleJson(p) {
        return this.readJSON(p + "/package.json");
    }

    getNodeModulesPath(p) {
        var pnm = p + "/node_modules";
        if (fs.existsSync(pnm)) {
            return pnm;
        }
        return "";
    }

    //========================================================================================

    async readdir(p) {
        return new Promise((resolve) => {
            fs.readdir(p, (err, list) => {
                if (err) {
                    output("[nmls] ERROR: fs.readdir: " + CGS.yellow(p));
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
                    output("[nmls] ERROR: fs.stat: " + CGS.yellow(p));
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

    readJSON(filePath) {
        //do NOT use require, it has cache
        var content = this.readFileContent(filePath);
        var json = null;
        if (content) {
            try {
                json = JSON.parse(content);
            } catch (e) {
                output(e);
            }
        }
        return json;
    }

}

module.exports = NMLS;