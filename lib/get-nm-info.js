
const fs = require('fs');
const Util = require('./util.js');

const progressInfo = {
    loaded: 0,
    total: 0
};

const showProgress = (moduleName) => {
    let per = 0;
    if (progressInfo.total) {
        per = progressInfo.loaded / progressInfo.total;
    }
    const text = `${(per * 100).toFixed(2)}% ${moduleName}`;
    Util.showProgress(text, per);
};


// =====================================================================================================

const parseModule = async (nmInfo, mPath, PJ, isNested) => {
    const moduleInfo = {
        size: 0,
        files: 0,
        deps: 0,
        nested: 0,
        dSize: 0,
        isNested: Boolean(isNested)
    };
    Util.setModuleInfo(moduleInfo, PJ);

    const relPath = Util.relativePath(mPath, nmInfo.nmPath);
    moduleInfo.path = relPath;
    nmInfo.map[relPath] = moduleInfo;

    // nested node_modules
    const nmPath = Util.getNmPath(mPath);

    showProgress(moduleInfo.name);

    await dirInfoHandler(moduleInfo, mPath, nmPath);

    if (nmPath) {
        await forEachNm(nmInfo, nmPath, true);
    }

};

const parseLink = (nmInfo, mPath, PJ) => {
    const linkInfo = {
        size: 0,
        files: 0,
        deps: 0,
        nested: 0,
        dSize: 0,
        isLink: true
    };
    Util.setModuleInfo(linkInfo, PJ);

    // real path
    const realPath = fs.readlinkSync(mPath);
    // console.log(realPath);
    linkInfo.realPath = realPath;

    const relPath = Util.relativePath(mPath, nmInfo.nmPath);
    linkInfo.path = relPath;

    nmInfo.map[relPath] = linkInfo;
};

// =====================================================================================================

const dirInfoHandler = async (info, dir, nmPath) => {
    const list = fs.readdirSync(dir, {
        withFileTypes: true
    });

    for (const item of list) {
        const itemName = item.name;
        const itemPath = `${dir}/${itemName}`;

        if (item.isFile()) {
            await fileInfoHandler(info, itemPath);
            continue;
        }

        if (item.isDirectory()) {

            // if has node_modules path, only current level, ignore children
            if (nmPath && itemName === 'node_modules') {
                continue;
            }

            await dirInfoHandler(info, itemPath);
        }
    }

};

const fileInfoHandler = async (info, p) => {
    info.files += 1;
    const stats = await Util.stat(p);
    if (stats) {
        info.size += stats.size;
    }
};

// =====================================================================================================

const forEachNsNm = async (nmInfo, nsPath, isNested) => {
    const list = fs.readdirSync(nsPath, {
        withFileTypes: true
    });

    for (const item of list) {
        const itemName = item.name;
        const itemPath = `${nsPath}/${itemName}`;

        if (item.isFile()) {
            await fileInfoHandler(nmInfo, itemPath);
            continue;
        }
        if (item.isDirectory()) {

            const PJ = Util.getPackageJson(itemPath);
            if (PJ) {
                await parseModule(nmInfo, itemPath, PJ, isNested);
                continue;
            }

            // other folder
            await dirInfoHandler(nmInfo, itemPath);

        }
    }
};

// forEach item in node_modules
const forEachNm = async (nmInfo, nmPath, isNested) => {

    const list = fs.readdirSync(nmPath, {
        withFileTypes: true
    });

    progressInfo.total += list.length;

    for (const item of list) {

        const itemName = item.name;
        const itemPath = `${nmPath}/${itemName}`;
        progressInfo.loaded += 1;

        // .package-lock.json
        if (item.isFile()) {
            await fileInfoHandler(nmInfo, itemPath);
            continue;
        }
        if (item.isDirectory()) {

            if (itemName.startsWith('@')) {
                await forEachNsNm(nmInfo, itemPath, isNested);
                continue;
            }

            const PJ = Util.getPackageJson(itemPath);
            if (PJ) {
                await parseModule(nmInfo, itemPath, PJ, isNested);
                continue;
            }

            // other folder like .bin .cache
            await dirInfoHandler(nmInfo, itemPath);
            continue;
        }

        if (item.isSymbolicLink()) {
            const PJ = Util.getPackageJson(itemPath);
            if (PJ) {
                parseLink(nmInfo, itemPath, PJ);
            }
        }

    }

};


const getNmInfo = async (nmPath) => {

    const nmInfo = {
        // module path => info
        map: {},

        // for rel path
        nmPath,

        modules: 0,
        size: 0,
        files: 0
    };

    await forEachNm(nmInfo, nmPath);

    return nmInfo;
};

module.exports = getNmInfo;
