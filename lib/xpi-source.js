var EventEmitter = require('events').EventEmitter;
var runzip = require('runzip');
var concatStream = require('concat-stream');
var util = require('util');

util.inherits(XPISourceEmitter, EventEmitter);

var __MACOSX = /\/__MACOSX\//;

function isXPI(entry) {
  return !__MACOSX.test(entry.fileName) &&
         /\.(zip|jar|xpi)$/.test(entry.fileName);
}

function XPISourceEmitter(input) {
  EventEmitter.call(this);

  var self = this;

  function failure(err) {
    self.emit('error', err);
  }

  function success(type, entry) {
    return concatStream(function(buffer) {
      self.emit(type, {
        fileName: entry.fileName,
        source: buffer.toString('utf8')
      });
    });
  }

  runzip.open(input, { filter: isXPI }, function(err, zipfile) {
    if (err) return failure(err);
    zipfile
      .on('entry', function(entry) {
        // skip entries in MACOS metadata folders
        if (__MACOSX.test(entry.fileName)) return;
        
        if (/\.js(m?)$/.test(entry.fileName)) {
          entry.openReadStream(function(err, readStream) {
            if (err) return failure(err);
            readStream.on('error', failure)
                      .pipe(success('script', entry));
          });
        } else if (/\.xul$/.test(entry.fileName)) {
          entry.openReadStream(function(err, readStream) {
            if (err) return failure(err);
            readStream.on('error', failure)
                      .pipe(success('overlay', entry));
          });
        }
      })
      .on('end', self.emit.bind(self))
      .on('error', failure);
  });
}

module.exports = XPISourceEmitter;
