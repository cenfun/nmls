//const fs = require("fs");
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
            Util.initProjectSubs(item, this.option.module);
            //copy module info from nodeModules
            Util.generateSubsInfo(item);
        }
       
        //Util.output(list);

        this.showOverview(projectInfo);

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

    showOverview(projectInfo) {
        const total = projectInfo.dAmount;
        const totalStr = EC.cyan(total.toLocaleString());

        const nested = projectInfo.dNested;

        const repetition = nested / total * 100;

        let repetitionStr = `${repetition.toFixed(2)} %`;
        if (repetition > 20) {
            repetitionStr = EC.red(repetitionStr);
        } else if (repetition > 10) {
            repetitionStr = EC.yellow(repetitionStr);
        } else if (repetition > 0) {
            repetitionStr = EC.green(repetitionStr);
        }
        
        Util.output(`[nmls] generated node modules: total: ${totalStr} nested: ${Util.NFC(nested)} (repetition: ${repetitionStr})`);

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