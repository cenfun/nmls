//const fs = require("fs");
const path = require('path');
const EC = require('eight-colors');
const CG = require('console-grid');
const defaultOption = require('./options.js');
const Util = require('./util.js');
const findPackages = require('./find-packages.js');
const getPackageTree = require('./get-package-tree.js');
const getPackageInfo = require('./get-package-info.js');
class NMLS {

    async start(option = {}) {
        this.option = Object.assign(defaultOption(), option);

        this.root = Util.formatPath(path.resolve(this.option.root || '.'));
        Util.log(`[nmls] root: ${this.root}`);

        const projectJson = Util.getModuleJson(this.root);
        if (!projectJson) {
            Util.log(EC.red(`[nmls] ERROR: Failed to read package.json from: ${this.root}`));
            return;
        }

        const nmPath = Util.getNodeModulesPath(this.root);
        if (!nmPath) {
            Util.log(EC.red('[nmls] ERROR: Not found node_modules folder, or try npm install first.'));
            return;
        }

        //ignores
        const ig = Util.getProjectIgnore(this.root);

        //module list
        const projectInfo = Util.initModuleJson({
            //root path
            path: '.'
        }, projectJson);

        let list = [projectInfo];

        const workspaceStr = this.option.workspace;
        //true or string
        if (workspaceStr) {
            const packages = await findPackages(projectJson.workspaces);
            if (packages) {
                projectInfo.packages = packages;
                packages.forEach((item) => {
                    item.parent = projectInfo;
                    list.push(item);
                });
            }
        }

        await this.initList(list, ig);

        const packageList = Util.getSpecifiedList(workspaceStr);
        if (packageList) {
            Util.log(`[nmls] filter packages with: ${workspaceStr}`);
            list = list.filter((item) => {
                for (const s of packageList) {
                    if (item.name === s) {
                        return true;
                    }
                }
                return false;
            });
            if (!list.length) {
                Util.log(EC.red(`[nmls] not found packages with: ${workspaceStr}`));
                return projectInfo;
            }
        }

        this.showOverview(projectInfo);

        this.showInfo(list);

        return projectInfo;
    }

    async initList(list, ig) {
        //generate file tree
        for (const item of list) {
            await getPackageTree(item, ig);
        }

        //generate file info
        for (const item of list) {
            getPackageInfo(item);
        }
    }

    //========================================================================================

    showInfo(list) {

        let rows = list;
        //add border for list
        if (list.length > 1) {
            rows = [];
            list.forEach((item, i) => {
                if (i) {
                    rows.push({
                        innerBorder: true
                    });
                }
                rows.push(item);
            });
        }

        const showFiles = this.option.files;

        //columns
        const columns = [{
            id: 'name',
            name: ' Name',
            maxWidth: 60
        }, {
            id: 'version',
            name: 'Version',
            maxWidth: 10
        }, {
            id: 'size',
            name: 'Size',
            type: 'number',
            formatter: Util.BF
        }, {
            id: 'dAmount',
            name: 'Deps Amount',
            type: 'number',
            maxWidth: 8,
            formatter: Util.NF
        }, {
            id: 'dNested',
            name: 'Deps Nested',
            type: 'number',
            maxWidth: 8,
            formatter: Util.NFC
        }, {
            id: 'dSize',
            name: 'Deps Size',
            type: 'number',
            formatter: Util.BF
        }];

        if (showFiles) {
            columns.splice(2, 0, {
                id: 'files',
                name: 'Files',
                type: 'number',
                formatter: Util.NF
            });
            columns.splice(6, 0, {
                id: 'dFiles',
                name: 'Deps Files',
                type: 'number',
                maxWidth: 8,
                formatter: Util.NF
            });
        }

        //option
        let sortField = '';
        const sortColumn = this.getSortColumn(this.option.sort, columns);
        if (sortColumn) {
            sortField = sortColumn.id;
            Util.log(`[nmls] sort by: ${sortColumn.name}`);
        }

        const option = {
            sortField: sortField,
            sortAsc: this.option.asc
        };

        //data
        const data = {
            option: option,
            columns: columns,
            rows: rows
        };

        CG(data);

    }

    showOverview(projectInfo) {
        const total = projectInfo.dAmount;
        const totalStr = EC.cyan(total.toLocaleString());

        const nested = projectInfo.dNested;
        const nestedStr = Util.NFC(nested);


        // Util.log(Util.BF(projectInfo.dNestedSize));
        // Util.log(Util.BF(projectInfo.dSize));

        const proportion = projectInfo.dNestedSize / projectInfo.dSize * 100;

        let proportionStr = `${proportion.toFixed(2)} %`;
        if (proportion > 20) {
            proportionStr = EC.red(proportionStr);
        } else if (proportion > 10) {
            proportionStr = EC.yellow(proportionStr);
        } else {
            proportionStr = EC.green(proportionStr);
        }

        Util.log(`[nmls] generated node modules: ${totalStr}  (nested: ${nestedStr}  size percentage: ${proportionStr})`);

    }

    getSortColumn(sort, columns) {
        if (!sort) {
            return null;
        }

        if (sort === true) {
            sort = 'dSize';
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
