var spawn = require("child_process").spawn;
var events = require("events");
var temp = require('temp');
var fs = require('fs');

var EventEmitter = events.EventEmitter;

function jscmd(tmpfile) {
    var src =
        "try { " +
            "Reflect.parse(snarf('" + tmpfile + "')); " +
        "} catch (e) { " +
            "if (e) { " +
                "print(JSON.stringify({ " +
                    "message: e.message, " +
                    "lineNumber: e.lineNumber " +
                "})) " +
            "} " +
            "quit(1); " +
        "}";
    return src;
}

function CheckSyntaxEmitter(getSource, exe) {
    EventEmitter.call(this);

    exe = exe || "js";

    var self = this;

    temp.open("check_syntax", function(err, info) {
        if (err) {
            self.emit("error", err);
            return;
        }
        fs.close(info.fd, function(err) {
            if (err) {
                self.emit("error", err);
                return;
            }
            getSource(info.path, function(err) {
                if (err) {
                    self.emit("error", err);
                    return;
                }
                var script = jscmd(info.path);

                var sm = spawn(exe, ["-e", script]);
                var stdout = "";

                sm.stdout.setEncoding("utf8");
                sm.stdout.on("data", function(str) {
                    stdout += str;
                });
                sm.on("error", function(err) {
                    self.emit("error", err);
                });
                sm.on("exit", function(exitCode) {
                    if (exitCode === 0) {
                        self.emit("passed", true);
                    } else {
                        var error = JSON.parse(stdout);
                        self.emit("error", error.message, error.lineNumber);
                    }
                });
            });
        });
    });
}

CheckSyntaxEmitter.prototype = Object.create(EventEmitter.prototype);

// string[, string="js"] -> CheckSyntaxEmitter
function checkSource(src, exe) {
    return new CheckSyntaxEmitter(function(tmpfile, cb) {
        var tmpStream = fs.createWriteStream(tmpfile, { flags: 'w+', encoding: 'utf8' });
        tmpStream.write("(function(){" + src + "\n})();\n");
        tmpStream.end();
        tmpStream.on("error", cb);
        tmpStream.on("close", cb);
    });
}

// path[, string="js"] -> CheckSyntaxEmitter
function checkFile(path, exe) {
    return new CheckSyntaxEmitter(function(tmpfile, cb) {
        var rs = fs.createReadStream(path, { encoding: 'utf8' });
        var ws = fs.createWriteStream(tmpfile, { flags: 'w+', encoding: 'utf8' });
        ws.write("(function(){");
        rs.pipe(ws, { end: false });
        rs.on("error", err);
        rs.on("end", function(err) {
            if (err) {
                cb(err);
                return;
            }
            ws.write("\n})();\n");
            ws.end();
            ws.on("close", cb);
        });
    });
}

exports.checkSource = checkSource;
exports.checkFile = checkFile;
