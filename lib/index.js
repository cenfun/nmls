const fs = require("fs");
const path = require("path");
const EC = require("eight-colors");
const ConsoleGrid = require("console-grid");
const defaultOption = require("./options.js");
const Util = require("./util.js");
const findPackages = require("./find-packages.js");
const getPackageInfo = require("./get-package-info.js");
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
        Util.initProjectIgnore(this.root);
        
        //module list
        const project = Util.initModuleJson({
            //root path
            path: "."
        }, projectJson);
        
        const list = [project];

        if (this.option.workspace) {
            const packages = await findPackages(projectJson.workspaces, this.option);
            if (packages) {
                packages.forEach(item => {
                    item.parent = project.name;
                    list.push(item);
                });
            }
        }

        for (const item of list) {
            await getPackageInfo(item);
        }

        Util.output(list);

        fs.writeFileSync("nmls.json", JSON.stringify(list, null, 4));


        // await this.showInfo();

        // return this.projectInfo;
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
                    Util.initDependenciesInfo(sub, mInfo.dMap);
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

}

module.exports = NMLS;