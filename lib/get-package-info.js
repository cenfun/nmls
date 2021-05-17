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

    item.dAmount = 0;
    item.dFiles = 0;
    item.dSize = 0;
    item.dNested = 0;

    await getNodeModules(item);
    
};


module.exports = getPackageInfo;