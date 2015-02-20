## xpi.js

Unpack Firefox addon [XPI](https://developer.mozilla.org/en/Extension_Packaging) files and extract their JavaScript source code.

## Usage

```javascript
var XPI = require('xpi');

(new XPI.SourceEmitter("./adblock_plus-2.6.7-sm+tb+fx+an.xpi"))
  .on("script", function(script) {
    // extracted a script file (.js or .jsm) from the XPI
  })
  .on("overlay", function(overlay) {
    // extracted a XUL overlay file (.xul) from the XPI
  })
  .on("end", function() {
    // done extracting
  })
  .on("error", function(err) {
    // error occurred
  });

(new XPI.JSEmitter("./adblock_plus-2.6.7-sm+tb+fx+an.xpi"))
  .on("javascript", function(js) {
    // extracted a JS source file or snippet from the XPI
    switch (js.type) {
      case 'file':
        // JS source file
      case 'script':
        // <script> tag from a XUL file
      case 'attribute':
        // inline attribute script from a XUL file
    }
  })
  .on("end", function() {
    // done extracting
  })
  .on("error", function(err) {
    // error occurred
  });
```

## Class: new XPI.SourceEmitter(path)

### Event: 'script'

  * `fileName`: String
  * `source`: String

### Event: 'overlay'

  * `fileName`: String
  * `source`: String


## Class: new XPI.JSEmitter(path)

### Event: 'javascript'

#### js.type === 'file'

  * `fileName`: String
  * `source`: String

#### js.type === 'script'

  * `fileName`: String
  * `source`: String
  * `line`: Number

#### js.type === 'attribute'

  * `fileName`: String
  * `source`: String
  * `line`: Number
  * `tag`: String
  * `eventType`: String


## License

Copyright © 2015 Dave Herman

Licensed under the [MIT License](http://mit-license.org).
