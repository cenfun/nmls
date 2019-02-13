const fs = require("fs");
const ignore = require('ignore');
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

    defaultOption() {
        return {
            sort: "",
            asc: false,
            external: "devDependencies,internalDependencies",
            module: ""
        };
    }

    aliasOption(option) {

        var alias = {
            s: "sort",
            a: "asc",
            e: "external",
            m: "module"
        };

        if (option) {
            for (var k in alias) {
                var v = alias[k];
                if (option.hasOwnProperty(k)) {
                    option[v] = option[k];
                    delete option[k];
                }
            }
        }

        return option;
    }

    async start(option) {

        this.option = Object.assign(this.defaultOption(), this.aliasOption(option));

        this.externalList = this.toList(this.option.external);

        this.rootInfo = await this.generateRootInfo();
        if (!this.rootInfo) {
            return;
        }

        //output(this.rootInfo);

        await this.generateNodeModules();

        this.moduleList = this.toList(this.option.module);
        if (this.moduleList.length) {
            for (let item of this.moduleList) {
                await this.moduleHandler(item);
            }
            return;
        }

        //for root module
        await this.moduleHandler();

    }

    //========================================================================================

    async generateRootInfo() {

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
        var list = await this.getProjectFileList(this.root);

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
            optionalDependencies: rootJson.optionalDependencies,
            mSize: mSize,
            mFiles: list.length,
            dSize: 0,
            dFiles: 0,
            subs: {}
        };

        //external handler
        this.externals = [];
        var allDependencies = Object.assign({}, rootInfo.dependencies);
        this.externalList.forEach(item => {
            var obj = rootJson[item];
            if (obj) {
                rootInfo[item] = obj;
                allDependencies = Object(allDependencies, obj);
                this.externals.push(item);
            }
        });
        rootInfo.allDependencies = allDependencies;

        rootInfo.dLength = Object.keys(allDependencies).length;
        rootInfo.dLoaded = 0;

        output("[nmls] generated root module: " + rootInfo.name);

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

    //========================================================================================

    async generateNodeModules() {

        this.moduleTree = {
            name: this.rootInfo.name,
            path: this.rootInfo.path,
            version: this.rootInfo.version,
            dependencies: this.rootInfo.dependencies,
            devDependencies: this.rootInfo.devDependencies,
            optionalDependencies: this.rootInfo.optionalDependencies,
            mSize: this.rootInfo.mSize,
            mFiles: this.rootInfo.mFiles,
            tSize: 0,
            tFiles: 0,
            subs: {}
        };
        await this.generateModuleTree(this.moduleTree, this.rootModulesPath);

        output("[nmls] generated all node modules");

    }

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
            if (stats.isFile()) {
                parent.tSize += stats.size;
                parent.tFiles += 1;
                continue;
            }

            //only handle dir and link
            var isDir = stats.isDirectory();
            var isLink = stats.isSymbolicLink();

            if (!isDir && !isLink) {
                //console.log(stats);
                continue;
            }

            //.bin folder info
            if (isDir && subName === ".bin") {
                //output(`[nmls] Found .bin: ${subPath}`);
                continue;
            }

            //@scope folder module
            if (isDir && subName.indexOf("@") === 0) {
                await this.generateModuleTree(parent, subPath, subName);
                continue;
            }

            //normal folder module
            var moduleJson = this.getModuleJson(subPath);
            var folderInfo = await this.generateFolderInfo(subPath, moduleJson);

            //sub folder
            if (!isLink) {
                parent.tSize += folderInfo.mSize;
                parent.tFiles += folderInfo.mFiles;
            }

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
            folderInfo.devDependencies = moduleJson.devDependencies;
            folderInfo.optionalDependencies = moduleJson.optionalDependencies;
            folderInfo.parent = parent;

            //generate local modules, exclude link folder
            if (!isLink && folderInfo.subPath) {

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
            var subPath = folderPath + "/" + subName;
            //exclude node_modules if it is a module folder
            if (moduleJson && subName === "node_modules") {
                folderInfo.subPath = subPath;
                continue;
            }
            var stats = await this.stat(subPath);
            if (!stats) {
                continue;
            }

            if (stats.isFile()) {
                folderInfo.mSize += stats.size;
                folderInfo.mFiles += 1;
                continue;
            }

            if (stats.isDirectory()) {
                var subInfo = await this.generateFolderInfo(subPath);
                folderInfo.mSize += subInfo.mSize;
                folderInfo.mFiles += subInfo.mFiles;
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

    async moduleHandler(moduleName) {

        if (moduleName) {
            var moduleInfo = await this.generateModuleInfo(moduleName);
            if (!moduleInfo) {
                return;
            }
            await this.initDependencies(moduleInfo);
            return;
        }

        await this.initDependencies(this.rootInfo);

    }

    async generateModuleInfo(moduleName) {

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

        output("[nmls] generated module: " + CGS.green(moduleName));

        return moduleInfo;

    }

    async initDependencies(moduleInfo) {

        if (moduleInfo.isRoot) {
            //root module use total size/files directly
            moduleInfo.dSize = this.moduleTree.tSize;
            moduleInfo.dFiles = this.moduleTree.tFiles;
            moduleInfo.dependenciesInfo = await this.generateDependencies(moduleInfo, "dependencies");
            //devDependencies only for root module, sub module should not install devDependencies
            for (var item of this.externals) {
                moduleInfo[item + "Info"] = await this.generateDependencies(moduleInfo, item);
            }

        } else {
            //because generateModuleInfo do NOT generate node_modules be ignore
            var info = this.getModuleInfo(moduleInfo.name);
            moduleInfo.mSize = info.mSize;
            moduleInfo.mFiles = info.mFiles;
            //calculate dSize and dFiles for sub module
            //output(info.subs);
            this.generateSubDependencies(moduleInfo, info);
            //module dependencies from current module
            moduleInfo.dependenciesInfo = await this.generateDependencies(moduleInfo, "dependencies", info);
        }

        await this.showGrid(moduleInfo);

    }


    async generateDependencies(m, k, currentModule) {

        var dependencies = m[k];
        if (!dependencies) {
            return;
        }

        var subs = [];
        for (var name in dependencies) {
            //output(name);
            var info = this.getModuleInfo(name, currentModule);
            if (!info) {
                output("[nmls] WARN: Not found module " + CGS.yellow(name) + " for " + m.path);
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
            this.generateSubDependencies(totalInfo, info);

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
                //ignore print optional dependencies
                if (currentModule.optionalDependencies && currentModule.optionalDependencies[subName]) {
                    continue;
                }
                var list = [currentModule.path, totalInfo.name];
                var str = list.join(" => ");
                output("[nmls] WARN: Not found sub module " + CGS.yellow(subName) + " for " + str);
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

    async showGrid(moduleInfo) {

        //project subs
        var subs = [];

        //dependencies rows
        var dependenciesInfo = moduleInfo.dependenciesInfo;
        if (dependenciesInfo) {
            subs.push(dependenciesInfo);
        }

        this.externals.forEach(item => {
            var itemInfo = moduleInfo[item + "Info"];
            if (itemInfo) {
                subs.push(itemInfo);
            }
        });

        //rows
        moduleInfo.subs = subs;
        var rows = [moduleInfo];

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
        var sortColumn = this.getSortColumn(this.option.sort, columns);
        if (sortColumn) {
            sortField = sortColumn.id;
            output("[nmls] sort by: " + sortField + " - " + sortColumn.name);
        }

        var option = {
            sortField: sortField,
            sortAsc: this.option.asc
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

    async getSubFileList(p, ig) {
        var fileList = [];
        var list = fs.readdirSync(p);
        for (let name of list) {
            var subPath = p + "/" + name;
            if (ig.ignores(subPath) || ig.ignores(subPath + "/")) {
                continue;
            }
            var info = fs.statSync(subPath);
            if (info.isDirectory()) {
                gauge.show(subPath);
                await this.delay();
                var subFileList = await this.getSubFileList(subPath, ig);
                fileList = fileList.concat(subFileList);
            } else if (info.isFile()) {
                fileList.push(subPath);
            }
        }
        return fileList;
    }

    async getProjectFileList(projectPath) {

        var fileList = [];

        var confPath = projectPath + "/.gitignore";
        var content = this.readFileContent(confPath);
        if (!content) {
            output("WARN: Fail to read file: " + confPath);
            return fileList;
        }

        var ig = ignore();
        ig.add(".git");

        var rules = content.split(/\r?\n/);
        rules.forEach((line) => {
            line = line.trim();
            //remove comment line
            if (!/^#|^$/.test(line)) {
                ig.add(line);
            }
        });

        var list = fs.readdirSync(projectPath);
        for (let name of list) {
            if (ig.ignores(name) || ig.ignores(name + "/")) {
                continue;
            }
            var info = fs.statSync(name);
            if (info.isDirectory()) {
                var subFileList = await this.getSubFileList(name, ig);
                fileList = fileList.concat(subFileList);
            } else if (info.isFile()) {
                fileList.push(name);
            }
        }

        //output(fileList);

        return fileList;
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
            fs.lstat(p, (err, stats) => {
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

    toList(v) {
        if (Array.isArray(v)) {
            return v;
        }
        if (typeof (v) === "string") {
            return v.split(",");
        }
        if (v) {
            return (v + "").split(",");
        }
        return [];
    }

    delay(ms) {
        return new Promise((resolve) => {
            if (ms) {
                setTimeout(resolve, ms);
            } else {
                setImmediate(resolve);
            }
        });
    }

}

module.exports = NMLS;