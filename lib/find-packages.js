const glob = require("glob");
const Util = require("./util.js");

const globDirs = (p) => {
    return new Promise(resolve => {
        glob(p, {}, function(err, items) {
            if (err) {
                resolve();
                return;
            }
            resolve(items);
        });
    });
};

const findPackages = async (workspaces, o) => {

    if (!workspaces) {
        return;
    }

    const list = Util.toList(workspaces);
    
    let matchedList = [];
    for (const item of list) {
        const dirs = await globDirs(item);
        if (Util.isList(dirs)) {
            matchedList = matchedList.concat(dirs);
        }
    }

    let packages = [];
    for (const item of matchedList) {
        const stats = await Util.stat(item);
        if (stats && stats.isDirectory()) {
            packages.push({
                path: item
            });
        }
    }

    packages = packages.filter(item => {
        const json = Util.getModuleJson(item.path);
        if (!json) {
            return false;
        }
        Util.initModuleJson(item, json);
        return true;
    });

    if (!packages.length) {
        return;
    }

    return packages;
};

module.exports = findPackages;
