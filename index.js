const fs = require("fs");
const path = require("path");
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
        this.root = this.formatPath(path.resolve(root || "."));
        output("[nmls] path: " + this.root);
    }

    defaultOption() {
        return {
            sort: "",
            asc: false,
            module: "",
            files: false,
            externalType: "internalDependencies",
            defaultTypes: ["dependencies", "devDependencies", "peerDependencies", "bundledDependencies", "optionalDependencies"]
        };
    }

    initAlias(option) {
        if (!option) {
            return;
        }
        const alias = {
            s: "sort",
            a: "asc",
            m: "module",
            f: "files",
            e: "externalType"
        };
        for (let k in alias) {
            let v = alias[k];
            if (option.hasOwnProperty(k)) {
                option[v] = option[k];
                delete option[k];
            }
        }
        return option;
    }

    //========================================================================================

    async start(option = {}) {
        this.option = Object.assign(this.defaultOption(), this.initAlias(option));

        const projectJson = this.getModuleJson(this.root);
        if (!projectJson) {
            output(CGS.red("[nmls] ERROR: Failed to read package.json"));
            return;
        }

        this.projectIgnore = this.getProjectIgnore(this.root);

        this.projectInfo = await this.generateProjectInfo(projectJson);
        output("[nmls] generated project: " + this.projectInfo.name);

        this.projectNmPath = this.getNodeModulesPath(this.root);
        if (!this.projectNmPath) {
            output(CGS.red("[nmls] ERROR: Not found node_modules, or try npm install first."));
            return;
        }

        const nodeModules = {};
        await this.generateNodeModules(nodeModules, this.projectInfo, this.projectNmPath);
        this.nodeModules = nodeModules;

        //for project total files is all dependencies, without duplicated
        this.projectInfo.dAmount = this.projectInfo.tAmount;
        this.projectInfo.dFiles = this.projectInfo.tFiles;
        this.projectInfo.dSize = this.projectInfo.tSize;
        this.projectInfo.dNested = this.projectInfo.tNested;

        //init nodeModules for all dependencies with duplicated
        this.initNodeModules(nodeModules);

        const total = Object.keys(nodeModules).length;
        const nested = Object.keys(nodeModules).filter(k => k.indexOf("node_modules") !== -1).length;
        const duplications = (nested / total * 100).toFixed(2) + "%";

        output("[nmls] generated node modules: total: " + total.toLocaleString() + " nested: " + nested.toLocaleString() + " duplications: " + duplications);

        //console.log(this.projectInfo);

        await this.showInfo();

    }

    //========================================================================================

    async generateProjectInfo(projectJson) {

        //get project file list exclude ignore files
        const fileList = await this.generateFolderFileList(this.root, this.projectIgnore);
        const files = fileList.length;
        const size = await this.generateFileListSize(fileList);
        const projectInfo = {
            path: "",
            name: projectJson.name,
            version: projectJson.version,
            files: files,
            size: size,
            tAmount: 0,
            tFiles: 0,
            tSize: 0,
            tNested: 0
        };

        //types handler
        const subs = [];
        const projectDependencies = {};
        this.getTypes().forEach(type => {
            let dep = projectJson[type];
            if (dep) {
                const keys = Object.keys(dep);
                if (!keys.length) {
                    return;
                }
                const sub = {
                    type: true,
                    name: type
                };
                this.initDependenciesInfo(sub, dep);
                subs.push(sub);
                Object.assign(projectDependencies, dep);
            }
        });

        this.initDependenciesInfo(projectInfo, projectDependencies);

        projectInfo.subs = subs;
        projectInfo.dLength = Object.keys(projectDependencies).length;
        projectInfo.dLoaded = 0;

        return projectInfo;
    }

    getTypes() {
        if (this.allTypes) {
            return this.allTypes;
        }
        const allTypes = this.option.defaultTypes;
        this.toList(this.option.externalType).forEach(function (item) {
            if (item) {
                item = (item + "").trim();
                if (!allTypes.includes(item)) {
                    allTypes.push(item);
                }
            }
        });
        this.allTypes = allTypes;
        return allTypes;
    }

    getProjectIgnore(projectPath) {
        const ig = ignore();
        ig.add(".git");
        ig.add("node_modules");

        //add ignore from config if has
        const confPath = this.formatPath(path.resolve(projectPath, ".gitignore"));
        const content = this.readFileContent(confPath);
        if (content) {
            const rules = content.split(/\r?\n/);
            rules.forEach((line) => {
                line = line.trim();
                //remove comment line
                if (!/^#|^$/.test(line)) {
                    ig.add(line);
                }
            });
        }
        return ig;
    }

    //========================================================================================

    async generateNodeModules(nodeModules, parent, nmPath) {
        const list = await this.readdir(nmPath);
        if (nmPath === this.projectNmPath) {
            this.projectInfo.dLength = list.length;
        }

        let i = 0;
        for (let item of list) {

            i += 1;
            if (nmPath === this.projectNmPath) {
                this.projectInfo.dLoaded = i;
            }

            const mPath = this.formatPath(path.resolve(nmPath, item));
            const stats = await this.stat(mPath);
            if (!stats) {
                continue;
            }
            //only handle dir and link
            const isDir = stats.isDirectory();
            const isLink = stats.isSymbolicLink();
            if (!isDir && !isLink) {
                //console.log(stats);
                //sometimes has files, like .yarn-integrity
                //output(CGS.red("[nmls] Unknown module: " + mPath));
                continue;
            }

            //@scope folder module
            if (item.indexOf("@") === 0) {
                await this.generateNodeModules(nodeModules, parent, mPath);
                continue;
            }
            await this.generateModuleInfo(nodeModules, parent, mPath, isLink);
        }
    }

    async generateModuleInfo(nodeModules, parent, mPath, isLink) {

        const mJson = this.getModuleJson(mPath);
        //not a valid module, like .bin/.cache
        if (!mJson) {
            //output(CGS.red("[nmls] ERROR: Failed to read module package.json: " + mPath));
            const fileList = await this.generateFolderFileList(mPath);
            const size = await this.generateFileListSize(fileList);
            //console.log(fileList.length);
            parent.tFiles += fileList.length;
            parent.tSize += size;
            return;
        }

        const moduleName = mJson.name;
        this.showProgress(moduleName);

        //link module
        if (isLink) {
            await this.generateLinkModuleInfo(nodeModules, parent, mPath, mJson);
            return;
        }

        //normal module
        await this.generateNormalModuleInfo(nodeModules, parent, mPath, mJson);

    }

    async generateLinkModuleInfo(nodeModules, parent, mPath, mJson) {

        //real path
        const rPath = fs.readlinkSync(mPath);

        //use project ignore
        const fileList = await this.generateFolderFileList(rPath, this.projectIgnore);
        const size = await this.generateFileListSize(fileList);
        const info = {
            path: this.relativePath(mPath, this.projectNmPath),
            name: mJson.name,
            version: mJson.version,
            files: fileList.length,
            size: size
        };
        this.initDependenciesInfo(info, mJson.dependencies);
        nodeModules[info.path] = info;

        parent.tAmount += 1;
        //do NOT append link files to parent
        //no sub node_modules
    }

    async generateNormalModuleInfo(nodeModules, parent, mPath, mJson) {
        const mIgnore = ignore();
        mIgnore.add(this.relativePath(path.resolve(mPath, "node_modules")));
        const fileList = await this.generateFolderFileList(mPath, mIgnore);
        const files = fileList.length;
        const size = await this.generateFileListSize(fileList);
        const info = {
            path: this.relativePath(mPath, this.projectNmPath),
            name: mJson.name,
            version: mJson.version,
            files: files,
            size: size
        };
        this.initDependenciesInfo(info, mJson.dependencies);
        nodeModules[info.path] = info;

        parent.tAmount += 1;
        parent.tFiles += info.files;
        parent.tSize += info.size;
        //if path has node_modules is tNested
        if (info.path.indexOf("node_modules") !== -1) {
            parent.tNested += 1;
        }

        //generate sub node_modules
        const nmPath = this.getNodeModulesPath(mPath);
        if (nmPath) {
            info.tAmount = 0;
            info.tFiles = 0;
            info.tSize = 0;
            info.tNested = 0;
            await this.generateNodeModules(nodeModules, info, nmPath);
            //handler total files
            parent.tAmount += info.tAmount;
            parent.tFiles += info.tFiles;
            parent.tSize += info.tSize;
            parent.tNested += info.tNested;
        }

    }

    initDependenciesInfo(info, ds) {
        const dInfo = {
            dAmount: 0,
            dFiles: 0,
            dSize: 0,
            dNested: 0
        };
        if (ds) {
            const keys = Object.keys(ds);
            if (keys.length) {
                dInfo.dMap = ds;
                if (info.type) {
                    const subs = [];
                    keys.forEach(dn => {
                        const item = {
                            name: dn
                        };
                        subs.push(item);
                    });
                    dInfo.version = "";
                    dInfo.files = "";
                    dInfo.size = "";
                    dInfo.dAmount = "";
                    dInfo.dFiles = "";
                    dInfo.dSize = "";
                    dInfo.dNested = "";
                    dInfo.subs = subs;
                }
            }
        }
        Object.assign(info, dInfo);
    }

    initNodeModules(nodeModules) {
        Object.values(nodeModules).forEach(m => {
            const map = {};
            this.generateModuleMap(m, map);
            //update module dependencies with map
            Object.values(map).forEach(cm => {
                m.dAmount += 1;
                m.dFiles += cm.files;
                m.dSize += cm.size;
                if (cm.path.indexOf("node_modules") !== -1) {
                    m.dNested += 1;
                }
            });
        });
    }

    generateModuleMap(m, map) {
        if (m.dMap) {
            const dList = Object.keys(m.dMap);
            dList.forEach(dn => {
                const cm = this.getModule(m, dn);
                if (!cm) {
                    //output(CGS.red("[nmls] Not found module: " + dn));
                    return;
                }
                //already count
                if (map[cm.path]) {
                    return;
                }
                map[cm.path] = cm;
                this.generateModuleMap(cm, map);
            });
        }
    }

    getModule(parent, dn) {
        //from child first
        let p = parent.path + "/node_modules/" + dn;
        let m = this.nodeModules[p];

        //from parent next
        while (!m) {
            p = this.relativePath(path.resolve(p, "../" + dn), this.projectNmPath);
            if (p.indexOf("../") !== -1) {
                break;
            }
            m = this.nodeModules[p];
        }

        //from root
        if (!m) {
            m = this.nodeModules[dn];
        }

        return m;
    }

    //========================================================================================

    async showInfo() {

        this.moduleList = this.toList(this.option.module);
        if (this.moduleList.length) {
            const subs = [];
            this.moduleList.forEach(m => {
                const mInfo = this.nodeModules[m];
                if (mInfo) {
                    //module subs dependencies
                    const sub = {
                        type: true,
                        name: "dependencies"
                    };
                    this.initDependenciesInfo(sub, mInfo.dMap);
                    if (sub.dMap) {
                        mInfo.subs = [sub];
                    }
                    subs.push(mInfo);
                } else {
                    output(CGS.red("[nmls] ERROR: Not found module: " + m));
                }
            });
            this.projectInfo.subs = subs;
        }

        this.generateDependenciesInfo(this.projectInfo);

        await this.showGrid(this.projectInfo);

    }

    generateDependenciesInfo(parent) {
        if (!parent.subs) {
            return;
        }
        parent.subs.forEach(sub => {
            if (sub.type) {
                this.generateDependenciesInfo(sub);
                return;
            }
            const cm = this.getModule(parent, sub.name);
            if (!cm) {
                return;
            }
            sub.version = cm.version;
            sub.files = cm.files;
            sub.size = cm.size;
            sub.dAmount = cm.dAmount;
            sub.dFiles = cm.dFiles;
            sub.dSize = cm.dSize;
            sub.dNested = cm.dNested;
        });
    }

    //========================================================================================

    async showGrid(info) {

        const showFiles = this.option.files;

        const NF = (v, row) => {
            if (typeof (v) !== "number") {
                return v;
            }
            return v.toLocaleString();
        };

        const BF = (v, row) => {
            if (typeof (v) !== "number") {
                return v;
            }
            return this.toBytes(v);
        };

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
            id: "size",
            name: "Size",
            type: "number",
            formatter: BF
        }, {
            id: "dAmount",
            name: "Deps Amount",
            type: "number",
            maxWidth: 8,
            formatter: NF
        }, {
            id: "dNested",
            name: "Deps Nested",
            type: "number",
            maxWidth: 8,
            formatter: NF
        }, {
            id: "dSize",
            name: "Deps Size",
            type: "number",
            formatter: BF
        }];

        if (showFiles) {
            columns.splice(2, 0, {
                id: "files",
                name: "Files",
                type: "number",
                formatter: NF
            });
            columns.splice(6, 0, {
                id: "dFiles",
                name: "Deps Files",
                type: "number",
                maxWidth: 8,
                formatter: NF
            });
        }

        //option
        var sortField = "";
        var sortColumn = this.getSortColumn(this.option.sort, columns);
        if (sortColumn) {
            sortField = sortColumn.id;
            output("[nmls] sort by: " + sortColumn.name);
        }

        var option = {
            sortField: sortField,
            sortAsc: this.option.asc
        };

        //data
        var data = {
            option: option,
            columns: columns,
            rows: [info]
        };

        consoleGrid.render(data);

    }

    getSortColumn(sort, columns) {
        if (!sort) {
            return null;
        }

        if (sort === true) {
            sort = "dSize";
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

    async generateFolderFileList(p, ig) {
        let fileList = [];
        const list = fs.readdirSync(p);
        for (let name of list) {
            const subPath = this.relativePath(p + "/" + name);
            if (ig) {
                if (ig.ignores(subPath) || ig.ignores(subPath + "/")) {
                    continue;
                }
            }
            const info = fs.statSync(subPath);
            if (info.isDirectory()) {
                const subFileList = await this.generateFolderFileList(subPath, ig);
                fileList = fileList.concat(subFileList);
            } else if (info.isFile()) {
                fileList.push(subPath);
            } else {
                output(CGS.red("[nmls] Unknown file: " + subPath));
            }
        }
        return fileList;
    }

    async generateFileListSize(fileList) {
        let size = 0;
        for (let filePath of fileList) {
            var stats = await this.stat(filePath);
            if (stats) {
                size += stats.size;
            }
        }
        return size;
    }

    getModuleJson(p) {
        const pjp = this.formatPath(path.resolve(p, "package.json"));
        return this.readJSON(pjp);
    }

    getNodeModulesPath(p) {
        const nmp = this.formatPath(path.resolve(p, "node_modules"));
        if (fs.existsSync(nmp)) {
            return nmp;
        }
        return "";
    }

    showProgress(moduleName) {
        let per = 0;
        if (this.projectInfo.dLength) {
            per = this.projectInfo.dLoaded / this.projectInfo.dLength;
        }
        const text = (per * 100).toFixed(2) + "% " + moduleName;
        gauge.show(text, per);
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

    // \ to /
    formatPath(str) {
        if (str) {
            str = str.replace(/\\/g, "/");
        }
        return str;
    }

    relativePath(p, parent) {
        parent = parent || this.root;
        let rp = path.relative(parent, p);
        rp = this.formatPath(rp);
        return rp;
    }

    readFileContent(filePath) {
        let content = null;
        let isExists = fs.existsSync(filePath);
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
        let content = this.readFileContent(filePath);
        let json = null;
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