
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
    const info = {
        size: 0,
        files: 0,
        deps: 0,
        nested: 0,
        dSize: 0,
        isNested: Boolean(isNested)
    };
    Util.packageInfoHandler(info, PJ);

    const relPath = Util.relativePath(mPath, nmInfo.nmPath);
    nmInfo.map[relPath] = info;

    // nested node_modules
    const nmPath = Util.getNmPath(mPath);

    showProgress(info.name);

    await dirInfoHandler(info, mPath, nmPath);

    if (nmPath) {
        await forEachNm(nmInfo, nmPath, true);
    }

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

        }

        // TODO link
        // item.isSymbolicLink()

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
