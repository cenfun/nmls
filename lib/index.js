const fs = require("fs");
const path = require("path");
const ignore = require("ignore");
const EC = require("eight-colors");
const ConsoleGrid = require("console-grid");
const defaultOption = require("./options.js");
const Util = require("./util.js");
class NMLS {

    async start(option = {}) {
        this.option = Object.assign(defaultOption(), option);

        this.root = Util.formatPath(path.resolve(this.option.root || "."));
        Util.output(`[nmls] root: ${this.root}`);

        const projectJson = this.getModuleJson(this.root);
        if (!projectJson) {
            Util.output(EC.red("[nmls] ERROR: Failed to read package.json"));
            return;
        }

        this.projectIgnore = this.getProjectIgnore(this.root);

        this.projectInfo = await this.generateProjectInfo(projectJson);
        Util.output(`[nmls] generated project: ${this.projectInfo.name}`);

        this.projectNmPath = this.getNodeModulesPath(this.root);
        if (!this.projectNmPath) {
            Util.output(EC.red("[nmls] ERROR: Not found node_modules, or try npm install first."));
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
        this.projectInfo.total = total;

        const totalStr = EC.cyan(total.toLocaleString());

        const nested = Object.keys(nodeModules).filter(k => k.indexOf("node_modules") !== -1).length;
        this.projectInfo.nested = nested;

        const repetition = nested / total * 100;
        this.projectInfo.repetition = repetition;

        let repetitionStr = `${repetition.toFixed(2)} %`;
        if (repetition > 20) {
            repetitionStr = EC.red(repetitionStr);
        } else if (repetition > 10) {
            repetitionStr = EC.yellow(repetitionStr);
        } else if (repetition > 0) {
            repetitionStr = EC.green(repetitionStr);
        }
        
        Util.output(`[nmls] generated node modules: total: ${totalStr} nested: ${Util.NFC(nested)} (repetition: ${repetitionStr})`);

        //console.log(this.projectInfo);

        await this.showInfo();

        return this.projectInfo;
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
            const dep = projectJson[type];
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
        Util.toList(this.option.externalType).forEach(function(item) {
            if (item) {
                item = (`${item}`).trim();
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
        const confPath = Util.formatPath(path.resolve(projectPath, ".gitignore"));
        const content = Util.readFileContent(confPath);
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
        const list = await Util.readdir(nmPath);
        if (nmPath === this.projectNmPath) {
            this.projectInfo.dLength = list.length;
        }

        let i = 0;
        for (const item of list) {

            i += 1;
            if (nmPath === this.projectNmPath) {
                this.projectInfo.dLoaded = i;
            }

            const mPath = Util.formatPath(path.resolve(nmPath, item));
            const stats = await Util.stat(mPath);
            if (!stats) {
                continue;
            }
            //only handle dir and link
            const isDir = stats.isDirectory();
            const isLink = stats.isSymbolicLink();
            if (!isDir && !isLink) {
                //console.log(stats);
                //sometimes has files, like .yarn-integrity
                //output(EC.red("[nmls] Unknown module: " + mPath));
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
            //output(EC.red("[nmls] ERROR: Failed to read module package.json: " + mPath));
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
            path: Util.relativePath(mPath, this.projectNmPath),
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
        mIgnore.add(Util.relativePath(path.resolve(mPath, "node_modules")));
        const fileList = await this.generateFolderFileList(mPath, mIgnore);
        const files = fileList.length;
        const size = await this.generateFileListSize(fileList);
        const info = {
            path: Util.relativePath(mPath, this.projectNmPath),
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
                    //output(EC.red("[nmls] Not found module: " + dn));
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
        let p = `${parent.path}/node_modules/${dn}`;
        let m = this.nodeModules[p];

        //from parent next
        while (!m) {
            p = Util.relativePath(path.resolve(p, `../${dn}`), this.projectNmPath);
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

        this.moduleList = Util.toList(this.option.module);
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
                    Util.output(EC.red(`[nmls] ERROR: Not found module: ${m}`));
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
            this.generateDependenciesInfo(sub);
        });
    }

    //========================================================================================

    showGrid(info) {

        const showFiles = this.option.files;

        //columns
        const columns = [{
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
            formatter: Util.BF
        }, {
            id: "dAmount",
            name: "Deps Amount",
            type: "number",
            maxWidth: 8,
            formatter: Util.NF
        }, {
            id: "dNested",
            name: "Deps Nested",
            type: "number",
            maxWidth: 8,
            formatter: Util.NFC
        }, {
            id: "dSize",
            name: "Deps Size",
            type: "number",
            formatter: Util.BF
        }];

        if (showFiles) {
            columns.splice(2, 0, {
                id: "files",
                name: "Files",
                type: "number",
                formatter: Util.NF
            });
            columns.splice(6, 0, {
                id: "dFiles",
                name: "Deps Files",
                type: "number",
                maxWidth: 8,
                formatter: Util.NF
            });
        }

        //option
        let sortField = "";
        const sortColumn = this.getSortColumn(this.option.sort, columns);
        if (sortColumn) {
            sortField = sortColumn.id;
            Util.output(`[nmls] sort by: ${sortColumn.name}`);
        }

        const option = {
            sortField: sortField,
            sortAsc: this.option.asc
        };

        //data
        const data = {
            option: option,
            columns: columns,
            rows: [info]
        };

        const consoleGrid = new ConsoleGrid();
        consoleGrid.render(data);

    }

    getSortColumn(sort, columns) {
        if (!sort) {
            return null;
        }

        if (sort === true) {
            sort = "dSize";
        }

        for (let i = 0, l = columns.length; i < l; i++) {
            const column = columns[i];
            if (sort === column.id) {
                return column;
            }
        }
        return null;
    }

    //========================================================================================

    isPathIgnored(ig, relPath) {
        if (!ig) {
            return false;
        }
        if (path.isAbsolute(relPath)) {
            return false;
        }
        if (ig.ignores(relPath) || ig.ignores(`${relPath}/`)) {
            return true;
        }
        return false;
    }

    async generateFolderFileList(parentPath, ig) {
        let fileList = [];
        const list = fs.readdirSync(parentPath);
        for (const name of list) {
            const absPath = path.resolve(parentPath, name);
            const relPath = Util.relativePath(absPath);
            if (this.isPathIgnored(ig, relPath)) {
                continue;
            }
            const info = fs.statSync(absPath);
            if (info.isDirectory()) {
                const subFileList = await this.generateFolderFileList(absPath, ig);
                fileList = fileList.concat(subFileList);
            } else if (info.isFile()) {
                fileList.push(relPath);
            } else {
                Util.output(EC.red(`[nmls] Unknown file: ${relPath}`));
            }
        }
        return fileList;
    }

    async generateFileListSize(fileList) {
        let size = 0;
        for (const filePath of fileList) {
            const stats = await Util.stat(filePath);
            if (stats) {
                size += stats.size;
            }
        }
        return size;
    }

    getModuleJson(p) {
        const pjp = Util.formatPath(path.resolve(p, "package.json"));
        return Util.readJSON(pjp);
    }

    getNodeModulesPath(p) {
        const nmp = Util.formatPath(path.resolve(p, "node_modules"));
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
        const text = `${(per * 100).toFixed(2)}% ${moduleName}`;
        Util.showProgress(text, per);
    }

}

module.exports = NMLS;