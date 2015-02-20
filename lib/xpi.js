exports.SourceEmitter = require('./xpi-source');
exports.JSEmitter = require('./xpi-js');

var emitter = new exports.JSEmitter("../amo-grep/cache/1865/adblock_plus-2.6.7-sm+tb+fx+an.xpi");

emitter.on('javascript', function(js) {
  console.log(js.fileName + " : " + js.type);
  if (js.type === 'attribute') {
    console.log(js.source);
  }
});
