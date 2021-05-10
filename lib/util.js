const fs = require("fs");
const path = require("path");
const EC = require("eight-colors");
const Gauge = require("gauge");
const gauge = new Gauge();

const Util = {

    root: process.cwd(),

    output() {
        gauge.disable();
        console.log.apply(console, arguments);
        gauge.enable();
    },

    showProgress(text, per) {
        gauge.show(text, per);
    },

    readdir(p) {
        return new Promise((resolve) => {
            fs.readdir(p, (err, list) => {
                if (err) {
                    Util.output(`[nmls] ERROR: fs.readdir: ${EC.yellow(p)}`);
                    resolve([]);
                    return;
                }
                resolve(list);
            });
        });
    },

    stat(p) {
        return new Promise((resolve) => {
            fs.lstat(p, (err, stats) => {
                if (err) {
                    Util.output(`[nmls] ERROR: fs.stat: ${EC.yellow(p)}`);
                    resolve(null);
                    return;
                }
                resolve(stats);
            });
        });
    },

    // \ to /
    formatPath(str) {
        if (str) {
            str = str.replace(/\\/g, "/");
        }
        return str;
    },

    relativePath(p, parent) {
        parent = parent || Util.root;
        let rp = path.relative(parent, p);
        rp = Util.formatPath(rp);
        return rp;
    },

    readFileContent(filePath) {
        let content = null;
        const isExists = fs.existsSync(filePath);
        if (isExists) {
            content = fs.readFileSync(filePath);
            if (Buffer.isBuffer(content)) {
                content = content.toString("utf8");
            }
        }
        return content;
    },

    readJSON(filePath) {
        //do NOT use require, it has cache
        const content = Util.readFileContent(filePath);
        let json = null;
        if (content) {
            try {
                json = JSON.parse(content);
            } catch (e) {
                Util.output(e);
            }
        }
        return json;
    },

    toList(v) {
        if (Array.isArray(v)) {
            return v;
        }
        if (v) {
            return (`${v}`).split(",");
        }
        return [];
    },

    isList: function(data) {
        if (data && data instanceof Array && data.length > 0) {
            return true;
        }
        return false;
    },

    NF(v, row) {
        if (typeof (v) !== "number") {
            return v;
        }
        return v.toLocaleString();
    },

    NFC(n, row) {
        if (typeof (n) !== "number") {
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

    BF(v, row) {
        if (typeof (v) !== "number") {
            return v;
        }
        return Util.toBytes(v);
    }
};

module.exports = Util;