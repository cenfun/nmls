const Util = require("./util.js");

const getModule = (item, mName) => {
    if (item.nodeModules) {
        const m = item.nodeModules[mName];
        if (m) {
            return m;
        }
    }
    if (item.parent) {
        const m = getModule(item.parent, mName);
        if (m) {
            return m;
        }
    }
    Util.output(`not found module: ${mName}`);
};

//========================================================================================

const initSubs = (parent) => {
    const list = [];
    Util.forEachDependencies(parent, function(keys, type) {
        const sub = {
            isGroup: true,
            parent: parent,
            name: type,
            version: "",
            files: "",
            size: "",
            dAmount: "",
            dFiles: "",
            dSize: "",
            dNested: ""
        };
        sub.subs = keys.map(k => {
            return {
                name: k
            };
        });
        list.push(sub);
    });
    parent.subs = list;
};

//========================================================================================

const generateFlatMap = (item, map) => {
    Util.forEachDependencies(item, function(keys) {
        keys.forEach(k => {
            const m = getModule(item, k);
            if (!m) {
                return;
            }
            if (map[m.path]) {
                return;
            }
            map[m.path] = m;
            generateFlatMap(m, map);
        });
    });
};

const generateSelfInfo = (item) => {
    
    const map = {};
    generateFlatMap(item, map);

    const deps = Object.values(map);

    item.dAmount = deps.length;
    item.dFiles = item.dFiles || 0;
    item.dSize = item.dSize || 0;
    item.dNested = 0;

    deps.forEach(d => {
        item.dFiles += d.files;
        item.dSize += d.size;
        const matched = d.path.match(/node_modules/g);
        if (matched && matched.length > 1) {
            item.dNested += 1;
            //Util.output(d.path);
        }
    });

};

//========================================================================================


const generateSubsInfo = (item) => {
    if (!item.subs) {
        return;
    }
    item.subs.forEach(sub => {
        if (sub.isGroup) {
            generateSubsInfo(sub);
            return;
        }
        const m = getModule(item, sub.name);
        if (!m) {
            return;
        }
        sub.version = m.version;
        sub.dependencies = m.dependencies;
        sub.files = m.files;
        sub.size = m.size;
        sub.nodeModules = m.nodeModules;
        sub.parent = m.parent;

        //package or module
        generateSelfInfo(sub);
       
    });
};

//========================================================================================


const getPackageInfo = (item) => {

    initSubs(item);

    generateSelfInfo(item);
    generateSubsInfo(item);
    
};


module.exports = getPackageInfo;