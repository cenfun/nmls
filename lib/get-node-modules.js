
const fs = require('fs');
const path = require('path');
const EC = require('eight-colors');
const Util = require('./util.js');

const rootInfo = {};

const showProgress = (moduleName) => {
    let per = 0;
    if (rootInfo.dLength) {
        per = rootInfo.dLoaded / rootInfo.dLength;
    }
    const text = `${(per * 100).toFixed(2)}% ${moduleName}`;
    Util.showProgress(text, per);
};

const generateModuleFileList = (p) => {
    return Util.generateFolderFileList(p, (name) => {
        if (name === 'node_modules') {
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
        //no dependencies for linked
        //dependencies: mJson.dependencies,
        parent: parent,
        files: files,
        size: size
    };
    parent.nodeModules[sub.name] = sub;
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
        dependencies: mJson.dependencies,
        parent: parent,
        files: files,
        size: size
    };
    parent.nodeModules[sub.name] = sub;

    //generate sub node_modules
    const nmPath = Util.getNodeModulesPath(mPath);
    if (!nmPath) {
        return;
    }

    sub.parent = parent;
    sub.dFiles = 0;
    sub.dSize = 0;
    sub.nodeModules = {};
    await generateNodeModules(sub, nmPath);
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

const updateRootInfo = (parent, num) => {
    if (parent.path === '.') {
        rootInfo.dLength += num;
    }
};

const generateNodeModules = async (parent, nmPath) => {
    const list = await Util.readdir(nmPath);

    //total num
    updateRootInfo(parent, list.length);

    for (const item of list) {

        //current num
        if (parent.path === '.') {
            rootInfo.dLoaded += 1;
        }

        const mPath = Util.formatPath(path.resolve(nmPath, item));
        const stats = await Util.stat(mPath);
        if (!stats) {
            continue;
        }

        //sometimes has files, like .yarn-integrity/.package-lock.json
        if (stats.isFile()) {
            //Util.log(EC.red(mPath));
            //append to parent files and size
            parent.dFiles += 1;
            parent.dSize += stats.size;
            continue;
        }


        //only handle dir and link
        const isDir = stats.isDirectory();
        const isLink = stats.isSymbolicLink();
        if (!isDir && !isLink) {
            Util.log(EC.red(`[nmls] Unknown module: ${mPath}`));
            continue;
        }

        //@scope folder module
        if (item.indexOf('@') === 0) {
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
    if (item.path === '.') {
        rootInfo.dLoaded = 0;
        rootInfo.dLength = 0;
    }

    //for generation files without modules first
    item.dFiles = 0;
    item.dSize = 0;
    item.nodeModules = {};
    await generateNodeModules(item, nmPath);

};

module.exports = getNodeModules;
