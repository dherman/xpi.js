var XPISourceEmitter = require('./xpi-source');
var XUL = require('./xul');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

util.inherits(XPIJavaScriptEmitter, EventEmitter);

function XPIJavaScriptEmitter(input) {
  var self = this;
  (new XPISourceEmitter(input))
    .on('overlay', function(overlay) {
      (new XUL(overlay.source, overlay.fileName))
        .on('script', function(script) {
          self.emit('javascript', {
            type: 'script',
            fileName: overlay.fileName,
            line: script.line,
            source: script.contents
          });
        })
        .on('attribute', function(attribute) {
          self.emit('javascript', {
            type: 'attribute',
            fileName: overlay.fileName,
            line: attribute.line,
            source: attribute.contents,
            tag: attribute.tag,
            eventType: attribute.eventType
          });
        })
        //.on('end', success)
        .on('error', self.emit.bind(self, 'error'));
    })
    .on('script', function(script) {
      self.emit('javascript', {
        type: 'file',
        fileName: script.fileName,
        source: script.source
      });
    })
    .on('end', self.emit.bind(self, 'end'))
    .on('error', self.emit.bind(self, 'error'));
}

module.exports = XPIJavaScriptEmitter;
