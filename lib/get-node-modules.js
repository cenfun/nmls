
const fs = require("fs");
const path = require("path");
const EC = require("eight-colors");
const Util = require("./util.js");

const rootInfo = {};

const showProgress = (moduleName) => {
    let per = 0;
    if (rootInfo.dLength) {
        per = rootInfo.dLoaded / rootInfo.dLength;
    }
    const text = `${(per * 100).toFixed(2)}% ${moduleName}`;
    Util.showProgress(text, per);
};

const generateModuleFileList = (parentPath) => {
    return Util.generateFolderFileList(parentPath, (name) => {
        if (name === "node_modules") {
            return true;
        }
        return false;
    });
};

//=====================================================================================================

//no package.json folder
const generateInvalidModuleInfo = async (parent, mPath) => {
    //output(EC.red("[nmls] ERROR: Failed to read module package.json: " + mPath));
    //no package.json should be no node_modules
    const fileList = Util.generateFolderFileList(mPath);
    const files = fileList.length;
    const size = await Util.generateFileListSize(fileList);
    //console.log(fileList.length);
    parent.dFiles += files;
    parent.dSize += size;
};

//linked module folder
const generateLinkModuleInfo = async (parent, mPath, mJson) => {

    //real path
    const rPath = fs.readlinkSync(mPath);

    //use project ignore
    const fileList = generateModuleFileList(rPath);
    const files = fileList.length;
    const size = await Util.generateFileListSize(fileList);
    const sub = {
        path: Util.relativePath(mPath),
        name: mJson.name,
        version: mJson.version,
        files: files,
        size: size
    };
    Util.initDependenciesInfo(sub, mJson.dependencies);
    parent.nodeModules[sub.name] = sub;

    parent.dAmount += 1;
    parent.dFiles += files;
    parent.dSize += size;
    //do NOT append link sub node_modules to parent

};

//normal module
const generateNormalModuleInfo = async (parent, mPath, mJson) => {
    const fileList = generateModuleFileList(mPath);
    const files = fileList.length;
    const size = await Util.generateFileListSize(fileList);
    const sub = {
        path: Util.relativePath(mPath),
        name: mJson.name,
        version: mJson.version,
        files: files,
        size: size
    };
    Util.initDependenciesInfo(sub, mJson.dependencies);
    parent.nodeModules[sub.name] = sub;

    parent.dAmount += 1;
    parent.dFiles += files;
    parent.dSize += size;

    //generate sub node_modules
    const nmPath = Util.getNodeModulesPath(mPath);
    if (!nmPath) {
        return;
    }
    //if path has multiple node_modules is nested
    parent.dNested += 1;

    sub.nodeModules = {};
    await generateNodeModules(sub, nmPath);

    parent.dAmount += sub.dAmount;
    parent.dFiles += sub.dFiles;
    parent.dSize += sub.dSize;
    parent.dNested += sub.dNested;
};

const generateModuleInfo = async (parent, mPath, isLink) => {

    const mJson = Util.getModuleJson(mPath);
    //invalid module, like .bin/.cache
    if (!mJson) {
        return generateInvalidModuleInfo(parent, mPath);
    }

    showProgress(mJson.name);

    //link module
    if (isLink) {
        return generateLinkModuleInfo(parent, mPath, mJson);
    }

    //normal module
    await generateNormalModuleInfo(parent, mPath, mJson);

};

const generateNodeModules = async (parent, nmPath) => {
    const list = await Util.readdir(nmPath);

    //total num
    if (parent.path === ".") {
        rootInfo.dLength += list.length;
    }

    for (const item of list) {

        //current num
        if (parent.path === ".") {
            rootInfo.dLoaded += 1;
        }

        const mPath = Util.formatPath(path.resolve(nmPath, item));
        const stats = await Util.stat(mPath);
        if (!stats) {
            continue;
        }

        //sometimes has files, like .yarn-integrity/.package-lock.json
        if (stats.isFile()) {
            //Util.output(EC.red(mPath));
            //append to parent files and size
            parent.dFiles += 1;
            parent.dSize += stats.size;
            continue;
        }


        //only handle dir and link
        const isDir = stats.isDirectory();
        const isLink = stats.isSymbolicLink();
        if (!isDir && !isLink) {
            Util.output(EC.red(`[nmls] Unknown module: ${mPath}`));
            continue;
        }

        //@scope folder module
        if (item.indexOf("@") === 0) {
            await generateNodeModules(parent, mPath);
            continue;
        }
        await generateModuleInfo(parent, mPath, isLink);
    }
};

//=======================================================================================================

const getNodeModules = async (item) => {
   
    const nmPath = Util.getNodeModulesPath(item.path);
    if (!nmPath) {
        //maybe no node_modules in some sub package
        return;
    }

    //root info
    if (item.path === ".") {
        rootInfo.dLoaded = 0;
        rootInfo.dLength = 0;
    }

    item.nodeModules = {};
    await generateNodeModules(item, nmPath);

};

module.exports = getNodeModules;