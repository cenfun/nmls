const fs = require('fs');
const path = require('path');
const EC = require('eight-colors');
const cliProgress = require('cli-progress');

// progress state, keep for restart after console output
const progressState = {
    total: 0,
    loaded: 0,
    module: ''
};

const bar = new cliProgress.SingleBar({
    format: '{bar} {percentage}% | {value}/{total} | {module}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true,
    autopadding: true,
    clearOnComplete: true,
    gracefulExit: true
});

const truncate = (str, max) => {
    // count by code points, not bytes, so CJK module names truncate correctly
    if ([... str].length > max) {
        return `${[... str].slice(0, max - 1).join('')}…`;
    }
    return str;
};

const Util = {

    root: process.cwd(),

    log() {
        // pause the progress bar for clean console output
        if (bar.isActive) {
            bar.stop();
        }
        console.log.apply(console, arguments);
        // resume the progress bar
        if (progressState.total > 0 && progressState.loaded < progressState.total) {
            bar.start(progressState.total, progressState.loaded, {
                module: progressState.module
            });
        }
    },

    // total may grow dynamically while scanning nested node_modules
    setProgressTotal(total) {
        progressState.total = total;
        if (bar.isActive) {
            bar.setTotal(total);
        }
    },

    showProgress(loaded, module) {
        progressState.loaded = loaded;
        progressState.module = module;
        if (bar.isActive) {
            bar.update(loaded, {
                module: truncate(module, 30)
            });
        } else if (progressState.total > 0) {
            bar.start(progressState.total, loaded, {
                module: truncate(module, 30)
            });
        }
    },

    endProgress() {
        if (bar.isActive) {
            bar.stop();
        }
        progressState.total = 0;
        progressState.loaded = 0;
        progressState.module = '';
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

    setModuleInfo(info, PJ) {
        // copy module info, files for link: get include ignore
        ['name', 'version', 'dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'].forEach((k) => {
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

    // bytes
    KBF: function(v) {
        const base = 1024;
        const units = ['', 'K', 'M', 'G', 'T', 'P'];
        const space = ' ';
        const postfix = 'B';
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
            // include min boundary so 1024 -> 1.00 KB, 1048576 -> 1.00 MB
            if (v >= min && v < max) {
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
