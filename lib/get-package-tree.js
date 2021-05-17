const Util = require("./util.js");
const getNodeModules = require("./get-node-modules.js");

const getPackageTree = async (item, ig) => {
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

    await getNodeModules(item);
    
};


module.exports = getPackageTree;