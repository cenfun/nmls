//const fs = require("fs");
const path = require("path");
const EC = require("eight-colors");
const ConsoleGrid = require("console-grid");
const defaultOption = require("./options.js");
const Util = require("./util.js");
const findPackages = require("./find-packages.js");
const getPackageInfo = require("./get-package-info.js");

const getSpecifiedModuleList = (moduleListStr) => {
    if (!moduleListStr) {
        return;
    }
    const moduleList = Util.toList(moduleListStr).filter(item => item);
    if (!moduleList.length) {
        return;
    }
    return moduleList;
};

const initProjectSubs = (projectInfo, moduleListStr) => {
    const subs = [];
    const moduleList = getSpecifiedModuleList(moduleListStr);
    if (moduleList) {
        moduleList.forEach(m => {
            subs.push({
                name: m
            });
        });
        projectInfo.subs = subs;
        return;
    }

    //all 
    ["dependencies", "devDependencies"].forEach(type => {
        const dep = projectInfo[type];
        if (!dep) {
            return;
        }
        const keys = Object.keys(dep);
        if (!keys.length) {
            return;
        }
        const sub = {
            isGroup: true,
            parent: projectInfo,
            name: type,
            version: "",
            files: "",
            size: "",
            dAmount: "",
            dFiles: "",
            dSize: "",
            dNested: ""
        };
        sub.subs = keys.map(k => {
            return {
                name: k
            };
        });
        subs.push(sub);
    });

    projectInfo.subs = subs;
    
};

const getModule = (item, mName) => {
    if (item.nodeModules) {
        const m = item.nodeModules[mName];
        if (m) {
            return m;
        }
    }
    if (item.parent) {
        return getModule(item.parent, mName);
    }
};

const generateSubsInfo = (item) => {
    if (!item.subs) {
        return;
    }
    item.subs.forEach(sub => {
        if (sub.isGroup) {
            generateSubsInfo(sub);
            return;
        }
        const m = getModule(item, sub.name);
        if (!m) {
            Util.output(`not found module: ${sub.name}`);
            return;
        }
        sub.version = m.version;
        sub.files = m.files;
        sub.size = m.size;
        
        sub.dAmount = m.dAmount;
        sub.dFiles = m.dFiles;
        sub.dSize = m.dSize;
        sub.dNested = m.dNested;
    });
};
class NMLS {

    async start(option = {}) {
        this.option = Object.assign(defaultOption(), option);

        this.root = Util.formatPath(path.resolve(this.option.root || "."));
        Util.output(`[nmls] root: ${this.root}`);

        const projectJson = Util.getModuleJson(this.root);
        if (!projectJson) {
            Util.output(EC.red(`[nmls] ERROR: Failed to read package.json from: ${this.root}`));
            return;
        }

        const nmPath = Util.getNodeModulesPath(this.root);
        if (!nmPath) {
            Util.output(EC.red("[nmls] ERROR: Not found node_modules folder, or try npm install first."));
            return;
        }

        //ignores
        const ig = Util.getProjectIgnore(this.root);
        
        //module list
        const projectInfo = Util.initModuleJson({
            //root path
            path: "."
        }, projectJson);
        
        const list = [projectInfo];

        if (this.option.workspace) {
            const packages = await findPackages(projectJson.workspaces, this.option);
            if (packages) {
                projectInfo.packages = packages;
                packages.forEach(item => {
                    item.parent = projectInfo;
                    list.push(item);
                });
            }
        }

        for (const item of list) {
            await getPackageInfo(item, ig);
        }

        for (const item of list) {
            //if specified module list
            initProjectSubs(item, this.option.module);
            //copy module info from nodeModules
            generateSubsInfo(item);
        }
       
        //Util.output(list);

        //fs.writeFileSync("nmls.json", JSON.stringify(list, null, 4));


        // const total = Object.keys(nodeModules).length;
        // projectInfo.total = total;

        // const totalStr = EC.cyan(total.toLocaleString());

        // const nested = Object.keys(nodeModules).filter(k => k.indexOf("node_modules") !== -1).length;
        // projectInfo.nested = nested;

        // const repetition = nested / total * 100;
        // projectInfo.repetition = repetition;

        // let repetitionStr = `${repetition.toFixed(2)} %`;
        // if (repetition > 20) {
        //     repetitionStr = EC.red(repetitionStr);
        // } else if (repetition > 10) {
        //     repetitionStr = EC.yellow(repetitionStr);
        // } else if (repetition > 0) {
        //     repetitionStr = EC.green(repetitionStr);
        // }
        
        // Util.output(`[nmls] generated node modules: total: ${totalStr} nested: ${Util.NFC(nested)} (repetition: ${repetitionStr})`);

        // //console.log(projectInfo);


        this.showInfo(list);

        return projectInfo;
    }


    //========================================================================================
   
    showInfo(list) {

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
            rows: list
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

}

module.exports = NMLS;