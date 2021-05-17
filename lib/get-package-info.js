const Util = require("./util.js");
const getNodeModules = require("./get-node-modules.js");

const getPackageInfo = async (item, ig) => {
    //get project file list exclude ignore files
    const fileList = Util.generateFolderFileList(item.path, (name, relPath) => {
        if (ig.ignores(relPath) || ig.ignores(`${relPath}/`)) {
            return true;
        }
        return false;
    });
    const files = fileList.length;
    item.files = files;

    const size = await Util.generateFileListSize(fileList);
    item.size = size;

    //types handler
    const subs = [];
    const itemDependencies = {};
    const types = ["dependencies", "devDependencies"];
    types.forEach(type => {
        const dep = item[type];
        if (!dep) {
            return;
        }
        const keys = Object.keys(dep);
        if (!keys.length) {
            return;
        }
        const sub = {
            name: type
        };
        Util.initDependenciesInfo(sub, dep, true);
        subs.push(sub);
        Object.assign(itemDependencies, dep);
    });

    Util.initDependenciesInfo(item, itemDependencies);

    item.subs = subs;

    await getNodeModules(item);
    
};


module.exports = getPackageInfo;