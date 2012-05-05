var sax = require("sax");
var fs = require("fs");
var cjson = require("cjson");
var path = require("path");
var EventEmitter = require("events").EventEmitter;

var config = cjson.parse(fs.readFileSync(path.join(__dirname, "xul.cjson"), 'utf8'));

function unescape(s) {
    // FIXME: handle &nnnn; and &xhhhh; entities
    return s.replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&amp;/g, "&")
            .replace(/&apos;/g, "'")
            .replace(/&quot;/g, '"');
}

function XUL(src) {
    EventEmitter.call(this);

    var parser = sax.parser(false, { lowercase: true, noscript: true });
    var self = this;

    // SAX parsing context.
    var context = null;

    // SAX CDATA context.
    var cdata;

    function onText(text) {
        if (context && context.tag === "script") {
            self.emit("script", {
                contents: unescape(text),
                line: context.line
            });
        }
    }

    parser.onerror = function(err) {
        self.emit("error", err);
    };
    parser.onopentag = function(tag) {
        var name = tag.name;
        var attributes = tag.attributes;

        if (name === "script") {
            context = {
                tag: "script",
                previous: context,
                line: parser.line + 1
            };
        } else if (config.inlineEventHandlers.hasOwnProperty(name)) { // FIXME: just include any events?
            var eventTypes = config.inlineEventHandlers[name];
            for (var i = 0, n = eventTypes.length; i < n; i++) {
                var eventType = eventTypes[i];
                if (eventType in attributes) {
                    self.emit("attribute", {
                        tag: name,
                        eventType: eventType.replace(/^on/, ""),
                        contents: unescape(attributes[eventType]),
                        line: parser.line + 1
                    });
                }
            }
        }
    };
    parser.onclosetag = function(tag) {
        if (tag === "script")
            context = context.previous;
    };
    parser.onopencdata = function() {
        cdata = "";
    };
    parser.oncdata = function(text) {
        cdata += text;
    };
    parser.onclosecdata = function() {
        onText(cdata);
    };
    parser.ontext = onText;
    parser.onend = function() {
        self.emit("end");
    };

    // Give the client a chance to register handlers before parsing.
    process.nextTick(function() {
        console.log("WRITE: " + src.substring(0, 10) + "...");
        parser.write(src).close();
    });
}

XUL.prototype = Object.create(EventEmitter.prototype);

module.exports = XUL;
