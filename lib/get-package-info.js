const Util = require("./util.js");
const getNodeModules = require("./get-node-modules.js");


const getPackageInfo = async (item) => {
    //get project file list exclude ignore files
    const fileList = await Util.generateFolderFileList(item.path);
    const files = fileList.length;
    item.files = files;

    const size = await Util.generateFileListSize(fileList);
    item.size = size;
    
    Object.assign(item, {
        tAmount: 0,
        tFiles: 0,
        tSize: 0,
        tNested: 0
    });

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
            type: true,
            name: type
        };
        Util.initDependenciesInfo(sub, dep);
        subs.push(sub);
        Object.assign(itemDependencies, dep);
    });

    Util.initDependenciesInfo(item, itemDependencies);

    item.subs = subs;
    item.dLength = Object.keys(itemDependencies).length;
    item.dLoaded = 0;

    await getNodeModules(item);
    
};


module.exports = getPackageInfo;