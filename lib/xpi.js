var Zip = require('adm-zip');
var temp = require('temp');
var fs = require('fs');
var path = require('path');
var sm = require('spidermonkey');
var XUL = require('./xul');
var EventEmitter = require('events').EventEmitter;

// FIXME: eliminate all the temp files once adm-zip supports new Zip(buffer)

function unpack(xpi) {
    var scripts = [], overlays = [];

    // The temp library fails to cleanup non-empty directories.
    var tmpfiles = [];

    var workList = [{
        prefix: '',
        zip: xpi
    }];

    try {
        do {
            var workItem = workList.pop(), zip = workItem.zip, prefix = workItem.prefix;
            zip.getEntries().forEach(function(entry) {
                var name = entry.entryName;

                // Skip MacOS metadata subdirectories.
                if (/\/__MACOSX\//.test(name))
                    return;

                if (/\.js(m?)$/.test(name)) {
                    scripts.push({
                        name: prefix + name,
                        contents: entry.getData().toString('utf8')
                    });
                } else if (/\.xul$/.test(name)) {
                    overlays.push({
                        name: prefix + name,
                        contents: entry.getData().toString('utf8')
                    });
                } else if (/\.((xpi)|(zip)|(jar))$/.test(name)) {
                    var tmpdir = temp.mkdirSync();
                    zip.extractEntryTo(name, tmpdir, false, true);

                    var tmpfile = path.join(tmpdir, path.basename(name));
                    tmpfiles.push(tmpfile);

                    workList.push({
                        prefix: prefix + name + "!",
                        zip: new Zip(tmpfile)
                    });
                }
            });
        } while (workList.length > 0);

        return {
            scripts: scripts,
            overlays: overlays
        };
    } finally {
        tmpfiles.forEach(function(tmpfile) {
            fs.unlinkSync(tmpfile);
        });
    }
}

function XPI(input, opts) {
    EventEmitter.call(this);

    opts = opts || {};
    this.checkSyntax = opts.checkSyntax || false;
    this.shell = opts.shell || "js";
    this.strict = opts.strict || false;

    var contents = unpack(new Zip(input));

    var self = this;

    contents.scripts.forEach(this.emitScript.bind(this));
    contents.overlays.forEach(this.emitOverlay.bind(this));
}

XPI.prototype = Object.create(EventEmitter.prototype);

XPI.prototype.checkSource = function checkSource(type, source, path) { //contents, type, path, line) {
    var self = this;
    var check = sm.check(source.contents, this.shell);

    check.on("error", function(err) {
        self.emit("error", err);
    });

    check.on("throw", function(err) {
        var event = self.strict ? "error" : "skipped";
        switch (type) {
          case "file":
            self.emit(event, {
                type: "file",
                path: source.name,
                error: err
            });
            break;

          case "script":
            self.emit(event, {
                type: "script",
                path: path,
                line: source.line,
                error: err
            });
            break;

          case "attribute":
            self.emit(event, {
                type: "attribute",
                path: path,
                line: source.line,
                error: err,
                tag: source.tag,
                eventType: source.eventType
            });
            break;
        }
        // var event = {};
        // event.type = type;
        // event.path = path;
        // if (typeof line !== "undefined") event.line = line;
        // event.error = err;
        // self.emit(self.strict ? "error" : "skipped", event);
    });
    check.on("return", function() {
        var event = self.strict ? "error" : "skipped";
        switch (type) {
          case "file":
            self.emit("script", {
                type: "file",
                path: source.name,
                contents: source.contents
            });
            break;

          case "script":
            self.emit("script", {
                type: "script",
                path: path,
                line: source.line,
                contents: source.contents
            });
            break;

          case "attribute":
            self.emit("script", {
                type: "attribute",
                path: path,
                line: source.line,
                contents: source.contents,
                tag: source.tag,
                eventType: source.eventType
            });
            break;
        }

        // var event = {};
        // event.type = type;
        // event.path = path;
        // if (typeof line !== "undefined") event.line = line;
        // event.contents = contents;
        // // self.emit("script", {
        // //     type: "file",
        // //     path: script.name,
        // //     contents: script.contents
        // // });
    });
};

// { name: string, contents: string } -> void
XPI.prototype.emitScript = function emitScript(script) {
    if (this.checkSyntax) {
        this.checkSource("file", script);
        return;
    }
    var self = this;
    process.nextTick(function() {
        self.emit("script", {
            type: "file",
            path: script.name,
            contents: script.contents
        });
    });
};

// { name: string, contents: string } -> void
XPI.prototype.emitOverlay = function emitOverlay(overlay) {
    var path = overlay.name;
    var xul = new XUL(overlay.contents);
    var self = this;
    xul.on("script", function(script) {
        if (self.checkSyntax) {
            self.checkSource("script", script, path);
            return;
        }
        self.emit("script", {
            type: "script",
            path: path,
            line: script.line,
            contents: script.contents
        });
    });
    xul.on("attribute", function(attribute) {
        if (self.checkSyntax) {
            self.checkSource("attribute", attribute, path);
            return;
        }
        self.emit("script", {
            type: "attribute",
            path: path,
            line: attribute.line,
            contents: attribute.contents,
            tag: attribute.tag,
            eventType: attribute.eventType
        });
    });
    xul.on("end", function() {
        self.emit("end");
    });
    xul.on("error", function(err) {
        self.emit("error", err);
    });
};

module.exports = XPI;

// var contents = unpack(new Zip('./adblock_plus-2.0.3-sm+tb+fn+fx.xpi'));
// contents.scripts.forEach(function(entry) {
//     console.log(entry.name + ": " + entry.contents.length);
// });

// var xpi = new XPI('./adblock_plus-2.0.3-sm+tb+fn+fx.xpi', { checkSyntax: true });
// xpi.on("script", function(script) {
//     var line = "SCRIPT: " + script.path;
//     console.log("SCRIPT: " + script.path + (script.line ? "@" + script.line : ""));
// });
// xpi.on("error", function(err) {
//     console.log("ERROR: " + err);
// });
