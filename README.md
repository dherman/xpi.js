## xpi.js

Unpack Firefox addon [XPI](https://developer.mozilla.org/en/Extension_Packaging) files and extract their JavaScript source code.

Requires [node](http://nodejs.org). If you use the `checkSyntax` option, requires an installation of the SpiderMonkey shell in your PATH.

## Usage

```javascript
var XPI = require('xpi');

var xpi = new XPI('./adblock_plus-2.0.3-sm+tb+fn+fx.xpi', options);
xpi.on("script", function(script) {
    // extracted a script from the XPI
});
xpi.on("error", function(err) {
    // an error occurred
});
xpi.on("end", function() {
    // done extracting
});
```

## Arguments

The xpi.js module is a constructor that takes a path to an XPI file and additional options:

  * `checkSyntax` : Set to `true` to check each script to see if SpiderMonkey can parse it. **Default**: `false`
  * `shell` : Executable name for the SpiderMonkey shell. **Default**: `"js"`
  * `strict` : If `true`, causes an error event if any script fails to parse in SpiderMonkey. If `false`, emits a `skipped` event and continues processing. **Default**: `false`

The result of the constructor is an [EventEmitter](http://nodejs.org/api/events.html).

## Events

The XPI event emitter produces the following types of events.

### `"skipped"`

Indicates that a script failed to parse by SpiderMonkey and was skipped. No `script` event will be emitted for this script.

The sole argument is one of the following types of objects:

An individual .js or .jsm file:

  * `type` : `"file"`
  * `path` : the path within the XPI to the skipped file
  * `error` : the parse error

An inline script tag or tag attribute:

  * `type` : `"script"` or `"attribute"`
  * `path` : the path within the XPI to the file containing the skipped script
  * `line` : the line number within the file where the script occurs
  * `error` : the parse error

### `"script"`

A script has been extracted.

The sole argument is one of the following types of objects:

An individual .js or .jsm file:

  * `type` : `"file"`
  * `path` : the path within the XPI to the skipped file
  * `contents` : the script source

An inline script tag or tag attribute:

  * `type` : `"script"` or `"attribute"`
  * `path` : the path within the XPI to the file containing the skipped script
  * `line` : the line number within the file where the script occurs
  * `contents` : the script source

### `"error"`

An error occurred in extracting the source or running the SpiderMonkey shell. The single argument is the error information.

### `"end"`

Script extraction has successfully completed.

## License

Copyright © 2012 Dave Herman

Licensed under the [MIT License](http://mit-license.org).
