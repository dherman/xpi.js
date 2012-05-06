var Zip = require('adm-zip');
var temp = require('temp');
var fs = require('fs');
var path = require('path');
var sm = require('spidermonkey');
var XUL = require('./xul');
var EventEmitter = require('events').EventEmitter;

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

    // synchronization variables :(
    this.scriptsCount = contents.scripts.length;
    this.overlaysCount = contents.overlays.length;
    this.scriptsCompleted = 0;
    this.overlaysCompleted = 0;

    contents.scripts.forEach(this.emitScript.bind(this));
    contents.overlays.forEach(this.emitOverlay.bind(this));
}

XPI.prototype = Object.create(EventEmitter.prototype);

// { name: string, contents: string } -> void
XPI.prototype.emitScript = function emitScript(script) {
    var self = this;
    if (this.checkSyntax) {
        sm.check(script.contents, this.shell)
          .on("error", function(err) {
              self.completeScript();
              self.emit("error", err);
          })
          .on("return", function() {
              self.completeScript();
              self.emit("script", {
                  type: "file",
                  path: script.name,
                  contents: script.contents
              });
          })
          .on("throw", function(err) {
              self.completeScript();
              self.emit(self.strict ? "error" : "skipped", {
                  type: "file",
                  path: script.name,
                  error: err
              });
          });
        return;
    }
    process.nextTick(function() {
        self.completeScript();
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

    // synchronization variables :(
    var remainingChecks = 0;
    var parsingXUL = true;

    function completeCheck() {
        remainingChecks--;
        if (!parsingXUL && (remainingChecks <= 0))
            self.completeOverlay();
    }

    xul.on("script", function(script) {
        if (self.checkSyntax) {
            remainingChecks++;
            sm.check(script.contents, this.shell)
              .on("error", function(err) {
                  completeCheck();
                  self.emit("error", err);
              })
              .on("return", function() {
                  completeCheck();
                  self.emit("script", {
                      type: "script",
                      path: path,
                      line: script.line,
                      contents: script.contents
                  });
              })
              .on("throw", function(err) {
                  completeCheck();
                  self.emit(self.strict ? "error" : "skipped", {
                      type: "script",
                      path: path,
                      line: script.line,
                      error: err
                  });
              });
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
            remainingChecks++;
            sm.check(attribute.contents, self.shell)
              .on("error", function(err) {
                  completeCheck();
                  self.emit("error", err);
              })
              .on("return", function() {
                  completeCheck();
                  self.emit("script", {
                      type: "attribute",
                      path: path,
                      line: attribute.line,
                      contents: attribute.contents,
                      tag: attribute.tag,
                      eventType: attribute.eventType
                  });
              })
              .on("throw", function(err) {
                  completeCheck();
                  self.emit(self.strict ? "error" : "skipped", {
                      type: "attribute",
                      path: path,
                      line: attribute.line,
                      error: err,
                      tag: attribute.tag,
                      eventType: attribute.eventType
                  });
              });
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
        parsingXUL = false;
        if (remainingChecks <= 0)
            self.completeOverlay();
    });
    xul.on("error", function(err) {
        self.emit("error", err);
    });
};

XPI.prototype.completeScript = function completeScript() {
    this.scriptsCompleted++;
    this.checkEnd();
};

XPI.prototype.completeOverlay = function completeOverlay() {
    this.overlaysCompleted++;
    this.checkEnd();
};

XPI.prototype.checkEnd = function checkEnd() {
    if (this.overlaysCompleted === this.overlaysCount &&
        this.scriptsCompleted === this.scriptsCount) {
        var self = this;
        process.nextTick(function() {
            self.emit("end");
        });
    }
};

module.exports = XPI;

// var contents = unpack(new Zip('./adblock_plus-2.0.3-sm+tb+fn+fx.xpi'));
// contents.scripts.forEach(function(entry) {
//     console.log(entry.name + ": " + entry.contents.length);
// });

// var scripts = [];

// var xpi = new XPI('./adblock_plus-1.3.10-fn+fx+sm+tb.xpi', { checkSyntax: true });
// xpi.on("script", function(script) {
//     console.log("SCRIPT: " + script.path + (script.line ? "@" + script.line : "") + ", " + script.contents.length);
//     scripts.push(script);
// });
// xpi.on("error", function(err) {
//     console.log("ERROR: " + err);
// });
// xpi.on("end", function() {
//     console.log("END");
// });
