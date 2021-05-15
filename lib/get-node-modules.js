
const fs = require("fs");
const path = require("path");
const EC = require("eight-colors");
const ignore = require("ignore");

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
    const ig = ignore();
    ig.add("node_modules");
    return Util.generateFolderFileList(parentPath, ig);
};

//=====================================================================================================

const generateModuleInfo = async (parent, mPath, isLink) => {

    const mJson = Util.getModuleJson(mPath);
    //not a valid module, like .bin/.cache
    if (!mJson) {
        //output(EC.red("[nmls] ERROR: Failed to read module package.json: " + mPath));
        const fileList = await generateModuleFileList(mPath);
        const size = await Util.generateFileListSize(fileList);
        //console.log(fileList.length);
        parent.tFiles += fileList.length;
        parent.tSize += size;
        return;
    }

    showProgress(mJson.name);

    //link module
    if (isLink) {
        await generateLinkModuleInfo(parent, mPath, mJson);
        return;
    }

    //normal module
    await generateNormalModuleInfo(parent, mPath, mJson);

};

const generateLinkModuleInfo = async (parent, mPath, mJson) => {

    //real path
    const rPath = fs.readlinkSync(mPath);

    //use project ignore
    const fileList = await generateModuleFileList(rPath);
    const size = await Util.generateFileListSize(fileList);
    const info = {
        path: Util.relativePath(mPath),
        name: mJson.name,
        version: mJson.version,
        files: fileList.length,
        size: size
    };
    Util.initDependenciesInfo(info, mJson.dependencies);
    parent.nodeModules[info.name] = info;

    parent.tAmount += 1;
    //do NOT append link files to parent
    //no sub node_modules
};

const generateNormalModuleInfo = async (parent, mPath, mJson) => {
    const fileList = await generateModuleFileList(mPath);
    const files = fileList.length;
    const size = await Util.generateFileListSize(fileList);
    const info = {
        path: Util.relativePath(mPath),
        name: mJson.name,
        version: mJson.version,
        files: files,
        size: size
    };
    Util.initDependenciesInfo(info, mJson.dependencies);
    parent.nodeModules[info.name] = info;

    parent.tAmount += 1;
    parent.tFiles += info.files;
    parent.tSize += info.size;
    //if path has node_modules is tNested
    if (info.path.indexOf("node_modules") !== -1) {
        parent.tNested += 1;
    }

    //generate sub node_modules
    const nmPath = Util.getNodeModulesPath(mPath);
    if (!nmPath) {
        return;
    }

    info.tAmount = 0;
    info.tFiles = 0;
    info.tSize = 0;
    info.tNested = 0;
    info.nodeModules = {};
    await generateNodeModules(info, nmPath);
    //handler total files
    parent.tAmount += info.tAmount;
    parent.tFiles += info.tFiles;
    parent.tSize += info.tSize;
    parent.tNested += info.tNested;

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
        //only handle dir and link
        const isDir = stats.isDirectory();
        const isLink = stats.isSymbolicLink();
        if (!isDir && !isLink) {
            //console.log(stats);
            //sometimes has files, like .yarn-integrity
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

const initNodeModules = (parent) => {
    Object.values(parent.nodeModules).forEach(m => {
        const map = {};
        generateModuleMap(m, map);
        //update module dependencies with map
        Object.values(map).forEach(cm => {
            m.dAmount += 1;
            m.dFiles += cm.files;
            m.dSize += cm.size;
            if (cm.path.indexOf("node_modules") !== -1) {
                m.dNested += 1;
            }
        });
    });
};

const generateModuleMap = (m, map) => {
    if (m.dMap) {
        const dList = Object.keys(m.dMap);
        dList.forEach(dn => {
            const cm = getModule(m, dn);
            if (!cm) {
                //output(EC.red("[nmls] Not found module: " + dn));
                return;
            }
            //already count
            if (map[cm.path]) {
                return;
            }
            map[cm.path] = cm;
            generateModuleMap(cm, map);
        });
    }
};

const getModule = (parent, dn) => {
    //from child first
    let p = `${parent.path}/node_modules/${dn}`;
    let m = nodeModules[p];

    //from parent next
    while (!m) {
        p = Util.relativePath(path.resolve(p, `../${dn}`));
        if (p.indexOf("../") !== -1) {
            break;
        }
        m = nodeModules[p];
    }

    //from root
    if (!m) {
        m = nodeModules[dn];
    }

    return m;
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

    //nodeModules is tree
    //init tree
    

    //for project total files is all dependencies, without duplicated
    // item.dAmount = item.tAmount;
    // item.dFiles = item.tFiles;
    // item.dSize = item.tSize;
    // item.dNested = item.tNested;

    //init nodeModules for all dependencies with duplicated
    //initNodeModules(item);

    // const total = Object.keys(nodeModules).length;
    // projectInfo.total = total;

    // const totalStr = EC.cyan(total.toLocaleString());

    // const nested = Object.keys(nodeModules).filter(k => k.indexOf("node_modules") !== -1).length;
    // projectInfo.nested = nested;

    // const repetition = nested / total * 100;
    // projectInfo.repetition = repetition;

    // let repetitionStr = `${repetition.toFixed(2)} %`;
    // if (repetition > 20) {
    //     repetitionStr = EC.red(repetitionStr);
    // } else if (repetition > 10) {
    //     repetitionStr = EC.yellow(repetitionStr);
    // } else if (repetition > 0) {
    //     repetitionStr = EC.green(repetitionStr);
    // }
        
    // Util.output(`[nmls] generated node modules: total: ${totalStr} nested: ${Util.NFC(nested)} (repetition: ${repetitionStr})`);

    // //console.log(projectInfo);

    
};

module.exports = getNodeModules;