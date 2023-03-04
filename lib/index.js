const fs = require('fs');
const EC = require('eight-colors');
const CG = require('console-grid');
const ignore = require('ignore');

const Util = require('./util.js');
const defaultOptions = require('./options.js');

const getNmInfo = require('./get-nm-info.js');

class NMLS {

    constructor(options = {}) {
        this.options = {
            ... defaultOptions,
            ... options
        };
    }

    async start(name) {

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

        this.collectDepsInfo(nmInfo);

        this.showOverview(nmInfo);

        if (name) {
            Util.log(`[nmls] name: ${name}`);
        }

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

    // ========================================================================================

    collectDepsInfo(nmInfo) {

        const nmMap = nmInfo.map;

        // collect dep's deps
        Object.values(nmMap).forEach((moduleInfo) => {
            if (moduleInfo.isNested) {
                return;
            }
            this.collectModuleDeps(moduleInfo, nmMap);
        });

        // collect total info
        const nested = {
            modules: 0,
            size: 0,
            files: 0
        };

        Object.values(nmMap).forEach((moduleInfo) => {
            nmInfo.modules += 1;
            nmInfo.size += moduleInfo.size;
            nmInfo.files += moduleInfo.files;

            if (moduleInfo.isNested) {
                nested.modules += 1;
                nested.size += moduleInfo.size;
                nested.files += moduleInfo.files;
            }
        });

        nmInfo.nested = nested;

    }

    collectModuleDeps(moduleInfo, nmMap, devGroup) {
        const groups = this.getModuleGroups(moduleInfo, devGroup);
        if (!groups) {
            return;
        }

        const list = [{
            groups,
            path: moduleInfo.name
        }];

        // flat map, no repeated deps
        const depMap = {};
        this.collectDepChainMap(depMap, nmMap, list);

        Object.values(depMap).forEach((itemInfo) => {
            moduleInfo.deps += 1;
            moduleInfo.dSize += itemInfo.size;
            if (itemInfo.isNested) {
                moduleInfo.nested += 1;
            }
        });
    }

    getModuleGroups(moduleInfo, devGroup) {
        const groups = ['dependencies', 'optionalDependencies'];
        if (devGroup && !this.options.prod) {
            groups.push('devDependencies');
        }
        const list = [];
        groups.forEach((group) => {
            const deps = moduleInfo[group];
            if (!deps) {
                return;
            }
            if (!Object.keys(deps).length) {
                return;
            }
            const optional = group === 'optionalDependencies';
            list.push({
                name: group,
                optional,
                deps
            });
        });
        if (list.length) {
            return list;
        }
    }

    collectDepChainMap(depMap, nmMap, list) {

        if (!list.length) {
            return;
        }

        const item = list.shift();
        item.groups.forEach((group) => {
            Object.keys(group.deps).forEach((depName) => {

                let depPath = `${item.path}/node_modules/${depName}`;
                let depInfo = nmMap[depPath];
                if (!depInfo) {
                    depPath = depName;
                    depInfo = nmMap[depPath];
                }
                if (!depInfo) {

                    if (!group.optional) {
                        Util.log(EC.red(`[nmls] not found module: ${depName}`));
                    }

                    return;
                }

                // skip repeated
                if (depMap[depPath]) {
                    return;
                }

                depMap[depPath] = depInfo;

                const groups = this.getModuleGroups(depInfo);
                if (groups) {
                    list.push({
                        groups,
                        path: depPath
                    });
                }

            });

        });

        this.collectDepChainMap(depMap, nmMap, list);

    }

    // ========================================================================================

    getRootInfo(PJ, nmInfo) {
        const rootInfo = {
            size: 0,
            files: 0,
            deps: 0,
            nested: 0,
            dSize: 0
        };
        Util.setModuleInfo(rootInfo, PJ);

        // root self size and files
        const ig = this.getIgnore(this.root);
        this.forEachRootPath(rootInfo, ig, this.root, '');

        const nmMap = nmInfo.map;
        // root deps
        this.collectModuleDeps(rootInfo, nmMap, true);

        // root subs
        // dependencies group
        const groups = this.getModuleGroups(rootInfo, true);
        groups.forEach((group) => {

            if (!rootInfo.subs) {
                rootInfo.subs = [];
            }

            const groupInfo = {
                name: group.name,
                version: '',
                size: '',
                files: '',
                deps: '',
                nested: '',
                dSize: '',
                subs: []
            };

            rootInfo.subs.push(groupInfo);

            Object.keys(group.deps).forEach((depName) => {
                const mInfo = nmMap[depName];
                if (!mInfo) {
                    Util.log(EC.red(`[nmls] not found module: ${depName}`));
                    return;
                }
                groupInfo.subs.push(mInfo);
            });

        });

        return rootInfo;
    }

    forEachRootPath(info, ig, absP, relP) {
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
                this.forEachRootPath(info, ig, absPath, `${relPath}/`);
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

        const sizeFormatter = (v, row, column) => {
            if (typeof v !== 'number') {
                return v;
            }
            return this.sizeColor(v);
        };

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
            formatter: sizeFormatter
        }, {
            id: 'deps',
            name: 'Deps',
            type: 'number',
            maxWidth: 8,
            formatter: Util.NF
        }, {
            id: 'dSize',
            name: 'Deps Size',
            type: 'number',
            formatter: sizeFormatter
        }, {
            id: 'nested',
            name: 'Nested',
            type: 'number',
            maxWidth: 8,
            formatter: (v) => {
                if (typeof v !== 'number') {
                    return v;
                }
                if (v > 0) {
                    return EC.magenta(Util.NF(v));
                }
                return v;
            }
        }];

        if (this.options.files) {
            columns.splice(columns.findIndex((it) => it.id === 'size'), 0, {
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

        const modulesStr = `node modules: ${EC.cyan(Util.NF(nmInfo.modules))}`;
        let filesStr = '';
        if (this.options.files) {
            filesStr = `  files: ${Util.NF(nmInfo.files)}`;
        }
        const sizeStr = `size: ${this.sizeColor(nmInfo.size)}`;

        Util.log(`[nmls] ${modulesStr}${filesStr}  ${sizeStr}`);

        const nestedInfo = nmInfo.nested;

        const nestedStr = nestedInfo.modules > 0 ? EC.magenta(Util.NF(nestedInfo.modules)) : EC.green(0);
        const modulesNested = `nested: ${nestedStr}`;

        const sizeNested = `${this.sizeColor(nestedInfo.size)} (${Util.PF(nestedInfo.size, nmInfo.size)})`;

        let filesNested = '';
        if (this.options.files) {
            filesNested = `  files: ${Util.NF(nestedInfo.files)}`;
        }

        Util.log(`[nmls] ${modulesNested}${filesNested}  size: ${sizeNested}`);

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

    sizeColor(size, str) {
        str = str || Util.KBF(size);

        const k = 1024;
        const m = k * k;

        if (size > 100 * m) {
            return EC.red(str);
        }

        if (size > 10 * m) {
            return EC.yellow(str);
        }

        if (size > m) {
            return EC.green(str);
        }

        return str;

    }

}

module.exports = NMLS;
