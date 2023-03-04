const fs = require('fs');
const EC = require('eight-colors');
const CG = require('console-grid');
const ignore = require('ignore');

const Util = require('./util.js');
const defaultOptions = require('./options.js');

const getNmInfo = require('./get-nm-info.js');

class NMLS {

    prodGroups = ['dependencies', 'optionalDependencies'];

    constructor(options = {}) {
        this.options = {
            ... defaultOptions,
            ... options
        };
    }

    async start(name) {

        if (name) {
            Util.log(`[nmls] name: ${name}`);
        }

        this.root = Util.resolvePath(this.options.root || '.');
        Util.log(`[nmls] root: ${this.root}`);

        const PJ = Util.getPackageJson(this.root);
        if (!PJ) {
            Util.log(EC.red(`[nmls] ERROR: Failed to read package.json from: ${this.root}`));
            return;
        }

        const nmPath = Util.getNmPath(this.root);
        if (!nmPath) {
            Util.log(EC.red('[nmls] ERROR: Not found node_modules folder, or try npm install first.'));
            return;
        }

        // get node modules info
        const nmInfo = await getNmInfo(nmPath);
        // console.log(nmInfo);

        this.calculateNmInfo(nmInfo);

        this.showOverview(nmInfo);


        // get root info except ignores
        const rootInfo = await this.getRootInfo(PJ, nmInfo);
        // console.log(rootInfo);

        const list = [rootInfo];

        // generate dependencies tree
        // -p
        // -w

        //

        // const workspaceStr = this.options.workspace;
        // //true or string
        // if (workspaceStr) {
        //     const packages = await findPackages(rootJson.workspaces, options);
        //     if (packages) {
        //         projectInfo.packages = packages;
        //         packages.forEach((item) => {
        //             item.parent = projectInfo;
        //             list.push(item);
        //         });
        //     }
        // }

        // await this.initList(list, ig);

        // const packageList = Util.getSpecifiedList(workspaceStr);
        // if (packageList) {
        //     Util.log(`[nmls] filter packages with: ${workspaceStr}`);
        //     list = list.filter((item) => {
        //         for (const s of packageList) {
        //             if (item.name === s) {
        //                 return true;
        //             }
        //         }
        //         return false;
        //     });
        //     if (!list.length) {
        //         Util.log(EC.red(`[nmls] not found packages with: ${workspaceStr}`));
        //         return projectInfo;
        //     }
        // }

        this.showInfo(list);

        return list;
    }

    calculateNmInfo(nmInfo) {

        const nmMap = nmInfo.map;

        // collect dep's deps
        Object.values(nmMap).forEach((info) => {
            if (info.isNested) {
                return;
            }
            // flat map, no repeated deps
            info.map = {};
            this.calculateDepChain(info, nmMap, info.name);
        });

        // collect total info
        const nested = {
            modules: 0,
            size: 0,
            files: 0
        };

        Object.values(nmMap).forEach((info) => {
            nmInfo.modules += 1;
            nmInfo.size += info.size;
            nmInfo.files += info.files;

            if (info.isNested) {
                nested.modules += 1;
                nested.size += info.size;
                nested.files += info.files;
            }
        });

        nmInfo.nested = nested;

    }

    calculateDepChain(mInfo, nmMap, depPath) {

        this.prodGroups.forEach((group) => {
            // const deps = mInfo[group];
            // if (!deps) {
            //     return;
            // }

            // console.log(Object.keys(deps).length);


        });
    }


    getRootInfo(PJ, nmInfo) {
        const rootInfo = {
            size: 0,
            files: 0,
            deps: 0,
            nested: 0,
            dSize: 0
        };
        Util.packageInfoHandler(rootInfo, PJ);

        // root self size and files
        const ig = this.getIgnore(this.root);
        this.forEachRoot(rootInfo, ig, this.root, '');

        // dependencies group
        const groups = [].concat(this.prodGroups);
        if (!this.options.prod) {
            groups.push('devDependencies');
        }

        const nmMap = nmInfo.map;

        groups.forEach((group) => {

            const deps = rootInfo[group];
            if (!deps) {
                return;
            }

            if (!rootInfo.subs) {
                rootInfo.subs = [];
            }

            const groupInfo = {
                name: group,
                version: '',
                size: '',
                files: '',
                deps: '',
                nested: '',
                dSize: '',
                subs: []
            };

            rootInfo.subs.push(groupInfo);

            Object.keys(deps).forEach((depName) => {
                const mInfo = nmMap[depName];
                if (!mInfo) {
                    Util.log(EC.red(`[nmls] Not found module: ${depName}`));
                    return;
                }
                groupInfo.subs.push(mInfo);
            });

        });

        return rootInfo;
    }

    forEachRoot(info, ig, absP, relP) {
        const list = fs.readdirSync(absP, {
            withFileTypes: true
        });

        for (const item of list) {
            const itemName = item.name;
            const absPath = `${absP}/${itemName}`;
            const relPath = `${relP}${itemName}`;

            if (ig.ignores(relPath) || ig.ignores(`${relPath}/`)) {
                continue;
            }

            if (item.isFile()) {
                info.files += 1;
                const stats = fs.statSync(absPath);
                if (stats) {
                    info.size += stats.size;
                }
                continue;
            }

            if (item.isDirectory()) {
                this.forEachRoot(info, ig, absPath, `${relPath}/`);
            }
        }
    }

    getIgnore(p) {
        const ig = ignore();
        ig.add('.git');
        ig.add('node_modules');

        // add ignore from config if has
        const confPath = Util.resolvePath(p, '.gitignore');
        const content = Util.readFileContent(confPath);
        if (content) {
            const rules = content.split(/\r?\n/);
            rules.forEach((line) => {
                line = line.trim();
                // remove comment line
                if (!(/^#|^$/).test(line)) {
                    ig.add(line);
                }
            });
        }
        return ig;
    }

    // ========================================================================================

    showInfo(list) {

        let rows = list;
        // add border for list
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

        // columns
        const columns = [{
            id: 'name',
            name: ' Name',
            maxWidth: 60
        }, {
            id: 'version',
            name: 'Version',
            maxWidth: 15
        }, {
            id: 'size',
            name: 'Size',
            type: 'number',
            formatter: Util.KBF
        }, {
            id: 'deps',
            name: 'Deps',
            type: 'number',
            maxWidth: 8,
            formatter: Util.NF
        }, {
            id: 'nested',
            name: 'Nested',
            type: 'number',
            maxWidth: 8,
            formatter: Util.NFC
        }, {
            id: 'dSize',
            name: 'Deps Size',
            type: 'number',
            formatter: Util.KBF
        }];

        if (this.options.files) {
            columns.splice(2, 0, {
                id: 'files',
                name: 'Files',
                type: 'number',
                formatter: Util.NF
            });
        }

        // options
        let sortField = '';
        const sortColumn = this.getSortColumn(this.options.sort, columns);
        if (sortColumn) {
            sortField = sortColumn.id;
            Util.log(`[nmls] sort by: ${sortColumn.name}`);
        }

        const options = {
            sortField: sortField,
            sortAsc: this.options.asc
        };

        // data
        const data = {
            options: options,
            columns: columns,
            rows: rows
        };

        CG(data);

    }

    showOverview(nmInfo) {

        const modulesStr = `modules: ${EC.cyan(nmInfo.modules.toLocaleString())}`;
        let filesStr = '';
        if (this.options.files) {
            filesStr = `  files: ${EC.cyan(nmInfo.files.toLocaleString())}`;
        }
        const sizeStr = `size: ${Util.KBF(nmInfo.size)}`;

        Util.log(`[nmls] node ${modulesStr}${filesStr}  ${sizeStr}`);

        const nestedInfo = nmInfo.nested;

        const modulesNested = `modules: ${EC.magenta(nestedInfo.modules.toLocaleString())}`;

        const sizeNested = `${Util.KBF(nestedInfo.size)} (${Util.PF(nestedInfo.size, nmInfo.size)})`;

        let filesNested = '';
        if (this.options.files) {
            filesNested = `  files: ${EC.magenta(nestedInfo.files.toLocaleString())}`;
        }

        Util.log(`[nmls] nested ${modulesNested}${filesNested}  size: ${sizeNested}`);

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
