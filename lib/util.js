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

    // bytes
    KBF: function(v) {
        const base = 1024;
        const units = ['', 'K', 'M', 'G', 'T', 'P'];
        const space = ' ';
        const postfix = 'B';
        return Util.KF(v, base, units, space, postfix);
    },

    // views
    KNF: function(v) {
        const base = 1000;
        const units = ['', 'K', 'M', 'B', 'T', 'P'];
        const space = '';
        const postfix = '';
        return Util.KF(v, base, units, space, postfix);
    },

    KF: function(v, base, units, space, postfix) {
        v = Util.toNum(v, true);
        if (v <= 0) {
            return `0${space}${postfix}`;
        }
        for (let i = 0, l = units.length; i < l; i++) {
            const min = Math.pow(base, i);
            const max = Math.pow(base, i + 1);
            if (v > min && v <= max) {
                const unit = units[i];
                if (unit) {
                    const n = v / min;
                    const nl = n.toString().split('.')[0].length;
                    const fl = Math.max(3 - nl, 1);
                    v = n.toFixed(fl);
                }
                v = v + space + unit + postfix;
                break;
            }
        }
        return v;
    }
};

module.exports = Util;
