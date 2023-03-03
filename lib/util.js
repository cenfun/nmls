const fs = require('fs');
const path = require('path');
const EC = require('eight-colors');
const Gauge = require('gauge');
const gauge = new Gauge();

const Util = {

    root: process.cwd(),

    log() {
        gauge.disable();
        console.log.apply(console, arguments);
        gauge.enable();
    },

    showProgress(text, per) {
        gauge.show(text, per);
    },


    getSpecifiedList: (str) => {
        if (typeof (str) === 'string') {
            const list = Util.strToList(str);
            if (Util.isList(list)) {
                return list;
            }
        }
    },

    strToList(v) {
        if (Array.isArray(v)) {
            return v;
        }
        if (v) {
            return (`${v}`).split(',').map((item) => item.trim()).filter((item) => item);
        }
        return [];
    },

    getPackageJson(p) {
        const pjp = Util.resolvePath(p, 'package.json');
        return Util.readJSON(pjp);
    },

    packageInfoHandler(info, PJ) {
        // copy module info
        ['name', 'version', 'dependencies', 'devDependencies', 'optionalDependencies'].forEach((k) => {
            info[k] = PJ[k];
        });
    },

    getNmPath(p) {
        const nmp = Util.resolvePath(p, 'node_modules');
        if (fs.existsSync(nmp)) {
            return nmp;
        }
        return '';
    },

    stat(p) {
        return new Promise((resolve) => {
            fs.stat(p, (err, stats) => {
                if (err) {
                    Util.log(`[nmls] ERROR: fs.stat: ${EC.yellow(p)}`);
                    resolve();
                    return;
                }
                resolve(stats);
            });
        });
    },


    readFileContent(filePath) {
        if (fs.existsSync(filePath)) {
            return fs.readFileSync(filePath).toString('utf8');
        }
    },


    readJSON(filePath) {
        // do NOT use require, it has cache
        const content = Util.readFileContent(filePath);
        let json = null;
        if (content) {
            try {
                json = JSON.parse(content);
            } catch (e) {
                Util.log(e);
            }
        }
        return json;
    },

    resolvePath() {
        const p = path.resolve.apply(path, arguments);
        return p.replace(/\\/g, '/');
    },

    relativePath(p, to) {
        const rp = path.relative(to || Util.root, p);
        return rp.replace(/\\/g, '/');
    },

    toNum: function(num, toInt) {
        if (typeof (num) !== 'number') {
            num = parseFloat(num);
        }
        if (isNaN(num)) {
            num = 0;
        }
        if (toInt) {
            num = Math.round(num);
        }
        return num;
    },

    isList: function(data) {
        if (data && data instanceof Array && data.length > 0) {
            return true;
        }
        return false;
    },

    NF(v, row) {
        if (typeof (v) !== 'number') {
            return v;
        }
        return v.toLocaleString();
    },

    // percent
    PF: function(v, t = 1, digits = 1) {
        v = Util.toNum(v);
        t = Util.toNum(t);
        let per = 0;
        if (t) {
            per = v / t;
        }
        return `${(per * 100).toFixed(digits)}%`;
    },

    NFC(n, row) {
        if (typeof (n) !== 'number') {
            return n;
        }
        let v = n.toLocaleString();
        if (n > 10) {
            v = EC.red(v);
        } else if (n > 5) {
            v = EC.yellow(v);
        } else if (n > 0) {
            v = EC.green(v);
        }

        return v;
    },

    toBytes(bytes) {

        bytes = Math.max(bytes, 0);

        const k = 1024;
        if (bytes < k) {
            return `${bytes} B`;
        }
        const m = k * k;
        if (bytes < m) {
            return `${Math.round(bytes / k * 100) / 100} KB`;
        }
        const g = m * k;
        if (bytes < g) {
            const gStr = `${Math.round(bytes / m * 100) / 100} MB`;
            if (bytes < 10 * m) {
                return EC.green(gStr);
            } else if (bytes < 100 * m) {
                return EC.yellow(gStr);
            }
            return EC.red(gStr);

        }
        const t = g * k;
        if (bytes < t) {
            const tStr = `${Math.round(bytes / g * 100) / 100} GB`;
            return EC.magenta(tStr);
        }

        return bytes;
    },

    BF(v) {
        if (typeof (v) !== 'number') {
            return v;
        }
        return Util.toBytes(v);
    }
};

module.exports = Util;
