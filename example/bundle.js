require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

},{}],2:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],3:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],4:[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i];
    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Split a filename into [root, dir, basename, ext], unix version
// 'root' is just a slash, or nothing.
var splitPathRe =
    /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
var splitPath = function(filename) {
  return splitPathRe.exec(filename).slice(1);
};

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = (i >= 0) ? arguments[i] : process.cwd();

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
  var isAbsolute = exports.isAbsolute(path),
      trailingSlash = substr(path, -1) === '/';

  // Normalize the path
  path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
};

// posix version
exports.isAbsolute = function(path) {
  return path.charAt(0) === '/';
};

// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }
    return p;
  }).join('/'));
};


// path.relative(from, to)
// posix version
exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

exports.sep = '/';
exports.delimiter = ':';

exports.dirname = function(path) {
  var result = splitPath(path),
      root = result[0],
      dir = result[1];

  if (!root && !dir) {
    // No dirname whatsoever
    return '.';
  }

  if (dir) {
    // It has a dirname, strip trailing slash
    dir = dir.substr(0, dir.length - 1);
  }

  return root + dir;
};


exports.basename = function(path, ext) {
  var f = splitPath(path)[2];
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPath(path)[3];
};

function filter (xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// String.prototype.substr - negative index don't work in IE8
var substr = 'ab'.substr(-1) === 'b'
    ? function (str, start, len) { return str.substr(start, len) }
    : function (str, start, len) {
        if (start < 0) start = str.length + start;
        return str.substr(start, len);
    }
;

}).call(this,require("uojqOp"))
},{"uojqOp":5}],5:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],6:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],7:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require("uojqOp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":6,"inherits":3,"uojqOp":5}],8:[function(require,module,exports){
'use strict';

var util = require('util');

function ConnectionMap() {

}

util.inherits(ConnectionMap, Object);

ConnectionMap.prototype.toJSON = function() {
  var json = {};
  var key;
  for (key in this) {
    if (this.hasOwnProperty(key)) {
      for (var i = 0; i < this[key].length; i++) {
        if (!json[key]) {
          json[key] = [];
        }
        json[key][i] = this[key][i].toJSON();
      }
    }
  }
  return json;
};

module.exports = ConnectionMap;

},{"util":7}],9:[function(require,module,exports){
'use strict';

var Packet = require('./packet');

// TODO: created something more flexible to load this on demand
var nodeTypes = {
  xNode: require('./node'),
  polymer: require('./node/polymer')
};
var xLink = require('./link');
var util = require('util');
var uuid = require('uuid').v4;
var Run = require('./run');
var Connector = require('./connector');
var validate = require('./validate');
var DefaultContextProvider = require('../lib/context/defaultProvider');
var IoMapHandler = require('../lib/io/mapHandler');
var DefaultProcessManager = require('../lib/process/defaultManager');
var Loader = require('chix-loader');
var multiSort = require('../lib/multisort');
var EventEmitter = require('events').EventEmitter;
var debug = require('debug')('chix:actor');

var Status = {};
Status.STOPPED = 'stopped';
Status.RUNNING = 'running';

/**
 *
 * Actor
 *
 * The Actor is responsible of managing a flow
 * it links and it's nodes.
 *
 * A node contains the actual programming logic.
 *
 * @api public
 * @author Rob Halff <rob.halff@gmail.com>
 * @constructor
 */
function Actor() {

  EventEmitter.apply(this, arguments);

  this.ioHandler = undefined;
  this.processManager = undefined;
  this.nodes = {};
  this.links = {};
  this.iips = {};
  this.view = [];
  this.status = undefined;

  // default to own id, map can overwrite
  this.id = uuid();

  this.type = 'flow';

  /**
   *
   * Added by default.
   *
   * If others need to be used they should be set before addMap();
   *
   */
  this.setIoHandler(new IoMapHandler());
  this.setProcessManager(new DefaultProcessManager());
  this.setLoader(new Loader());

}

util.inherits(Actor, EventEmitter);

/**
 *
 * Create/instantiate  a node
 *
 * Node at this stage is nothing more then:
 *
 *  { ns: "fs", name: "readFile" }
 *
 * @param {Object} node - Node as defined within a map
 * @param {Object} def  - Node Definition
 *
 * @api public
 */
Actor.prototype.createNode = function(node, def) {

  var self = this;

  if (!def) {
    throw new Error(
      util.format(
        'Failed to get node definition for %s:%s', node.ns, node.name
      )
    );
  }

  if (!node.id) {
    throw Error('Node should have an id');
  }

  if (!def.ports) {
    def.ports = {};
  }

  // merges expose, persist etc, with port definitions.
  // This is not needed with proper inheritance
  for (var type in node.ports) {
    if (node.ports.hasOwnProperty(type) &&
      def.ports.hasOwnProperty(type)
    ) {
      for (var name in node.ports[type]) {
        if (node.ports[type].hasOwnProperty(name) &&
          def.ports[type].hasOwnProperty(name)
        ) {

          for (var property in node.ports[type][name]) {
            if (node.ports[type][name].hasOwnProperty(property)) {
              // add or overwrite it.
              def.ports[type][name][property] =
                node.ports[type][name][property];
            }
          }
        }
      }
    }
  }

  // allow instance to overwrite other node definition data also.
  // probably make much more overwritable, although many
  // should not be overwritten, so maybe just keep it this way.
  if (node.title) {
    def.title = node.title;
  }

  if (node.description) {
    def.description = node.description;
  }

  var identifier = node.title || [
    node.ns, '::', node.name, '-',
    Object.keys(this.nodes).length
  ].join('');

  if (def.type === 'flow') {

    var xFlow = require('./flow'); // solve circular reference.

    validate.flow(def);

    this.nodes[node.id] = new xFlow(
      node.id,
      def,
      identifier,
      this.loader, // single(ton) instance (TODO: di)
      this.ioHandler, // single(ton) instance
      this.processManager // single(ton) instance
    );
    debug('%s: created %s', this.identifier, this.nodes[node.id].identifier);

  }
  else {

    var cls = def.type || 'xNode';

    if (nodeTypes.hasOwnProperty(cls)) {

      validate.nodeDefinition(def);

      this.nodes[node.id] = new nodeTypes[cls](
        node.id,
        def,
        identifier,
        this.ioHandler.CHI
      );

      debug('%s: created %s', this.identifier, this.nodes[node.id].identifier);

      // register and set pid, xFlow/actor adds itself to it (hack)
      this.processManager.register(this.nodes[node.id]);

    }
    else {

      throw Error(
        util.format('Unknown node type: `%s`', cls)
      );

    }

  }

  // add parent to both xflow's and node's
  // not very pure seperation, but it's just very convenient
  this.nodes[node.id].setParent(this);

  if (node.provider) {
    this.nodes[node.id].provider = node.provider;
  }

  // TODO: move this to something more general.
  // not on every node creation.
  if (!this.contextProvider) {
    this.addContextProvider(new DefaultContextProvider());
  }

  this.contextProvider.addContext(
    this.nodes[node.id],
    node.context
  );

  function nodeOutputHandlerActor(event) {
    self.ioHandler.output(event);
  }

  this.nodes[node.id].on('output', nodeOutputHandlerActor);

  this.nodes[node.id].on('freePort', function freePortHandlerActor(event) {

    var links;
    var i;

    debug('%s:%s freePortHandler', self.identifier, event.port);

    // get all current port connections
    links = this.portGetConnections(event.port);

    if (links.length) {

      for (i = 0; i < links.length; i++) {

        var link = links[i];

        // unlock if it was locked
        if (self.ioHandler.queueManager.isLocked(link.ioid)) {
          self.ioHandler.queueManager.unlock(link.ioid);
        }

      }

      if (event.link) {

        // remove the link belonging to this event
        if (event.link.has('dispose')) {

          // TODO: remove cyclic all together, just use core/forEach
          //  this will cause bugs if you send multiple cyclics because
          //  the port is never unplugged..
          if (!event.link.target.has('cyclic')) {
            self.removeLink(event.link);
          }
        }

      }

    }

  });

  this.emit('addNode', {
    node: this.nodes[node.id]
  });

  return this.nodes[node.id];

};

/**
 *
 * Plugs a source into a target node
 *
 *
 * @param {Connector} target
 */
Actor.prototype.plugNode = function(target) {

  return this.getNode(target.id).plug(target);

};

/**
 *
 * Unplugs a port for the node specified.
 *
 * @param {Connector} target
 */
Actor.prototype.unplugNode = function(target) {

  // could be gone, if called from freePort
  // when nodes are being removed.
  if (this.hasNode(target.id)) {
    return this.getNode(target.id).unplug(target);
  }

  return false;

};

/**
 *
 * Holds a Node
 *
 * @param {String} id
 * @api public
 */
Actor.prototype.hold = function(id) {

  this.getNode(id).hold();

  return this;

};

/**
 *
 * Starts the actor
 *
 * @param {Boolean} push
 * @api public
 */
Actor.prototype.start = function(push) {

  this.status = Status.RUNNING;

  debug('%s: start', this.identifier);

  // TODO: this means IIPs should be send after start.
  //       enforce this..
  this.clearIIPs();

  // start all nodes
  // (could also be started during addMap
  // runtime is skipping addMap.
  // so make sure start() is restartable.
  for (var id in this.nodes) {
    if (this.nodes.hasOwnProperty(id)) {
      this.getNode(id).start();
    }
  }

  if (push !== false) {
    this.push();
  }

  // there are many other ways to start
  // so this does not ensure much.
  // however the process manager listens to this.
  // Real determination if something is started or stopped
  // includes the ioHandler.
  // So let's just inform the io handler we are started.

  this.emit('start', {
    node: this
  });

  return this;

};

/**
 *
 * Stops the actor
 *
 * Use a callback to make sure it is stopped.
 *
 * @api public
 */
Actor.prototype.stop = function(cb) {

  var self = this;

  this.status = Status.STOPPED;

  if (this.ioHandler) {

    this.ioHandler.reset(function resetCallbackIoHandler() {

      // close ports opened by iips
      self.clearIIPs();

      self.emit('stop', {
        node: self
      });

      if (cb) {
        cb();
      }

    });

  }

};

Actor.prototype.pause = function() {

  this.status = Status.STOPPED;

  for (var id in this.nodes) {
    if (this.nodes.hasOwnProperty(id)) {
      this.getNode(id).hold();
    }
  }

  return this;

};

/**
 *
 * Resumes the actor
 *
 * All nodes which are on hold will resume again.
 *
 * @api public
 */
Actor.prototype.resume = function() {

  this.status = Status.RUNNING;

  for (var id in this.nodes) {
    if (this.nodes.hasOwnProperty(id)) {
      this.getNode(id).release();
    }
  }

  return this;

};

/**
 *
 * Get the current status
 *
 * @api public
 */
Actor.prototype.getStatus = function() {
  return this.status;
};

/**
 *
 * Create an actor
 *
 * @api public
 */
Actor.create = function(map, loader, ioHandler, processManager) {

  var actor = new Actor();
  loader = loader || new Loader();
  processManager = processManager || new DefaultProcessManager();
  ioHandler = ioHandler || new IoMapHandler();
  actor.addLoader(loader);
  actor.addIoHandler(ioHandler);
  actor.addProcessManager(processManager);
  actor.addMap(map);

  return actor;
};

/**
 *
 * Releases a node if it was on hold
 *
 * @param {String} id
 * @api public
 */
Actor.prototype.release = function(id) {
  return this.getNode(id).release();
};

/**
 *
 * Pushes the Actor
 *
 * Will send :start to all nodes without input
 * and all nodes which have all their input ports
 * filled by context already.
 *
 * @api public
 */
Actor.prototype.push = function() {

  this.status = Status.RUNNING;
  debug('%s: push()', this.identifier);

  for (var id in this.nodes) {
    if (this.nodes.hasOwnProperty(id)) {
      var node = this.getNode(id);
      if (node.isStartable()) {
        var iip = new Connector();
        iip.plug(id, ':start');
        this.sendIIP(iip, '');
      }
      else {
        console.log(node.identifier, ' not startable');
      }
    }
  }

  return this;
};

/**
 *
 * Adds the definition Loader
 *
 * This provides an api to get the required node definitions.
 *
 * The loader should already be init'ed
 *
 * e.g. the remote loader will already have loaded the definitions.
 * and is ready to respond to getNodeDefinition(ns, name, type, provider)
 *
 * e.g. An async loader could do something like this:
 *
 *   loader(flow, function() { actor.addLoader(loader); }
 *
 * With a sync loader it will just look like:
 *
 * actor.addLoader(loader);
 *
 * @api public
 */
Actor.prototype.addLoader = function(loader) {
  this.loader = loader;
  return this;
};

Actor.prototype.setLoader = Actor.prototype.addLoader;

/**
 *
 * Validate and read map
 *
 * @param {Object} map
 * @api public
 *
 */
Actor.prototype.addMap = function(map) {

  debug('%s: addMap()', this.identifier);

  var i;
  var self = this;

  if (typeof map === 'undefined') {
    throw new Error('map is not defined');
  }

  if (map !== Object(map)) {
    throw new Error('addMap expects an object');
  }

  try {
    validate.flow(map);
  }
  catch (e) {
    if (map.title) {
      throw Error(
        util.format('Flow `%s`: %s', map.title, e.message)
      );
    }
    else {
      throw Error(
        util.format('Flow %s:%s: %s', map.ns, map.name, e.message)
      );
    }
  }

  if (map.id) {
    // xFlow contains it, direct actors don't perse
    this.id = map.id;
  }

  // add ourselves (actor/xFlow) to the processmanager
  // this way links can store our id and pid
  // must be done *before* adding our nodes.
  // otherwise our nodes will be registered before ourselves.
  if (!this.pid) { // re-run
    this.processManager.register(this);
  }

  // allow a map to carry it's own definitions
  if (map.nodeDefinitions) {
    this.loader.addNodeDefinitions('@', map.nodeDefinitions);
  }

  // add nodes and links one by one so there is more control
  map.nodes.forEach(function(node) {

    if (!node.id) {
      throw new Error(
        util.format('Node lacks an id: %s:%s', node.ns, node.name)
      );
    }

    // give the node a default provider.
    if (!node.provider) {
      if (map.providers && map.providers.hasOwnProperty('@')) {
        node.provider = map.providers['@'].url;
      }
    }

    var def = self.loader.getNodeDefinition(node, map);
    if (!def) {

      throw new Error(
        util.format(
          'Failed to get node definition for %s:%s', node.ns, node.name
        )
      );
    }

    self.createNode(node, def);

  });

  // this.ensureConnectionNumbering(map);

  if (map.hasOwnProperty('links')) {
    map.links.forEach(function(link) {
      self.addLink(
        self.createLink(link)
      );
    });
  }

  for (i = 0; i < map.nodes.length; i++) {
    this.view.push(map.nodes[i].id);
  }

  /*
    Disabled. Actor.start() does this and xFlow.start()
    will start all their nodes, and then goes recursive.

    // all nodes & links setup, run start method on node
    for (var id in this.nodes) {
      if (this.nodes.hasOwnProperty(id)) {
        this.getNode(id).start();
      }
    }
  */

  return this;

};

/**
 *
 * Used by the process manager to set our id
 *
 */
Actor.prototype.setPid = function(pid) {
  this.pid = pid;
};

/**
 *
 * Adds a node to the map.
 *
 * The object format is like it's defined within a map.
 *
 * Right now this is only used during map loading.
 *
 * For dynamic loading care should be taken to make
 * this node resolvable by the loader.
 *
 * Which means the definition should either be found
 * at the default location defined within the map.
 * Or the node itself should carry provider information.
 *
 * A provider can be defined as:
 *
 *  - url:        https://serve.rhcloud.com/flows/{ns}/{name}
 *  - file:       ./{ns}/{name}
 *  - namespace:  MyNs
 *
 * Namespaces are defined within the map, so MyNs will point to
 * either the full url or filesystem location.
 *
 * Once a map is loaded _all_ nodes will carry the full url individually.
 * The namespace is just their to simplify the json format and for ease
 * of maintainance.
 *
 *
 * @param {Object} node
 * @api public
 *
 */
Actor.prototype.addNode = function(node) {

  this.createNode(node);

  return this;
};

/**
 *
 * Creates a new connection/link
 *
 * Basically takes a plain link object
 * and creates a proper xLink from it.
 *
 * The internal map holds xLinks, whereas
 * the source map is just plain JSON.
 *
 * Structurewise they are almost the same.
 *
 * @param {Object} ln
 * @return {xLink} link
 * @api public
 *
 */
Actor.prototype.createLink = function(ln) {

  return xLink.create(ln);

};

/**
 *
 * Adds a link
 *
 * @param {xLink} link
 */
Actor.prototype.addLink = function(link) {

  debug('%s: addLink()', this.identifier);

  if (link.constructor.name !== 'Link') {
    throw Error('Link must be of type Link');
  }

  if (link.source.id !== this.id) { // Warn: IIP has our own id
    var sourceNode = this.getNode(link.source.id);
    if (!sourceNode.portExists('output', link.source.port)) {
      throw Error(util.format(
        'Source node (%s:%s) does not have an output port named `%s`\n\n' +
        '\tOutput ports available:\t%s\n',
        sourceNode.ns,
        sourceNode.name,
        link.source.port,
        Object.keys(sourceNode.ports.output).join(', ')
      ));
    }
  }

  var targetNode = this.getNode(link.target.id);
  if (link.target.port !== ':start' &&
    !targetNode.portExists('input', link.target.port)
  ) {
    throw Error(
      util.format(
        'Target node (%s:%s) does not have an input port named `%s`\n\n' +
        '\tInput ports available:\t%s\n',
        targetNode.ns,
        targetNode.name,
        link.target.port,
        Object.keys(targetNode.ports.input).join(', ')
      )
    );
  }

  // var targetNode = this.getNode(link.target.id);

  // FIXME: rewriting sync property
  // to contain the process id of the node it's pointing
  // to not just the nodeId defined within the graph
  if (link.target.has('sync')) {
    link.target.set('sync', this.getNode(link.target.get('sync')).pid);
  }

  link.graphId = this.id;
  link.graphPid = this.pid;

  var self = this;

  var dataHandler = function dataHandler(p) {
    if (!this.ioid) {
      throw Error('LINK MISSING IOID');
    }

    self.__input(this, p);
  };

  link.on('data', dataHandler);

  if (link.source.id) {
    if (link.source.id === this.id) {
      link.setSourcePid(this.pid || this.id);
    }
    else {
      link.setSourcePid(this.getNode(link.source.id).pid);
    }
  }

  link.setTargetPid(this.getNode(link.target.id).pid);

  // remember our own links, so we can remove them
  // if it has data it's an iip
  if (undefined !== link.data) {
    this.iips[link.id] = link;
  }
  else {
    this.links[link.id] = link;
  }

  this.ioHandler.connect(link);

  this.plugNode(link.target);

  link.on('change', function changeLink(link) {
    self.emit('changeLink', link);
  });

  // bit inconsistent with event.node
  // should be event.link
  this.emit('addLink', link);

  // this.ensureConnectionNumbering();
  return link;

};

Actor.prototype.getLink = function(id) {
  return this.links[id];
};

Actor.prototype.unlockConnections = function(node) {

  // fix this, flow connections setup is different
  var conns = node.getConnections();
  for (var port in conns) {
    if (conns.hasOwnProperty(port)) {
      for (var i = 0; i < conns[port].length; i++) {
        this.ioHandler.unlock(conns[port][i]);
      }
    }
  }

};

Actor.prototype.__input = function(link, p) {

  var self = this;

  this.ioHandler.lock(link);

  var targetNode = this.getNode(link.target.id);

  var ret = targetNode.fill(link.target, p);

  // breakpoint
  if (util.isError(ret)) {

    // `hard reject`
    // set node in error state and output error to ioManager
    targetNode.error(ret);

    debug('%s: reject %s', this.identifier, ret);
    self.ioHandler.reject(ret, link, p);

  }
  else if (ret === false) {

    // something should unlock.
    // having this reject unlock it is too much free form.

    debug('%s: soft reject re-queue', this.identifier);
    // `soft reject`
    self.ioHandler.reject(ret, link, p);

  }
  else {
    // would like to unlock all

    // unlock *all* queues targeting this node.
    // the IOHandler can do this.
    debug('%s: unlock all queues', this.identifier);
    self.unlockConnections(targetNode);

    self.ioHandler.accept(link, p);
  }

};

Actor.prototype.clearIIP = function(link) {

  var id;
  var oldLink;

  for (id in this.iips) {

    if (this.iips.hasOwnProperty(id)) {

      oldLink = this.iips[id];

      // source is always us so do not have to check it.
      if ((
          oldLink.source.port === ':iip' ||
          oldLink.target.port === link.target.port ||
          oldLink.target.port === ':start' // huge uglyness
        ) &&
        oldLink.target.id === link.target.id) {

        this.unplugNode(oldLink.target);

        this.ioHandler.disconnect(oldLink);

        delete this.iips[oldLink.id];

        // TODO: just rename this to clearIIP
        this.emit('removeIIP', oldLink);

      }

    }
  }

};

/**
 *
 * Clear IIPs
 *
 * If target is specified, only those iips will be cleared.
 *
 */
Actor.prototype.clearIIPs = function(target) {

  var id;
  var iip;
  for (id in this.iips) {
    if (this.iips.hasOwnProperty(id)) {
      iip = this.iips[id];
      if (!target ||
        (target.id === iip.target.id && target.port === iip.target.port)) {
        this.clearIIP(this.iips[id]);
      }
    }
  }
};

/**
 *
 * Renames a node
 *
 * Renames the id of a node.
 * This should not rename the real id.
 *
 * @param {string} nodeId
 * @param {function} cb
 * @api public
 */
Actor.prototype.renameNode = function(/*nodeId, cb*/) {

};

/**
 *
 * Removes a node
 *
 * @param {string} nodeId
 * @param {function} cb
 * @api public
 */
Actor.prototype.removeNode = function(nodeId, cb) {

  var id;
  var ln;
  var self = this;
  for (id in this.links) {
    if (this.links.hasOwnProperty(id)) {

      ln = this.links[id];

      if (ln.source.id === nodeId ||
        ln.target.id === nodeId) {
        this.removeLink(ln);
      }

    }

  }

  // should wait for IO, especially there is a chance
  // system events are still spitting.

  // register and set pid
  this.processManager.unregister(this.getNode(nodeId),
    function unregisterHandlerActor() {

      var oldNode = self.getNode(nodeId).export();

      delete self.nodes[nodeId];

      self.emit('removeNode', {
        node: oldNode
      });

      if (cb) {
        cb();
      }

    });

};

Actor.prototype.removeNodes = function() {

  this.clear();

};

Actor.prototype.setMeta = function(nodeId, key, value) {

  var node = this.getNode(nodeId);

  node.setMeta(key, value);

  this.emit('metadata', {
    id: this.id,
    node: node.export()
  });

};

/**
 *
 * Removes link
 *
 * @param {Link} ln
 * @api public
 *
 */
Actor.prototype.removeLink = function(ln) {

  // we should be able to find a link without id.
  var link;
  var what = 'links';

  link = this.links[ln.id];
  if (!link) {
    link = this.iips[ln.id];
    if (!link) {
      //throw Error('Cannot find link');
      // TODO: Seems to happen with ip directly to subgraph (non-fatal)
      console.warn('FIXME: cannot find link');
      return;
    }
    what = 'iips';
  }

  this.unplugNode(link.target);

  this.ioHandler.disconnect(link);

  // io handler could do this.
  // removelink on the top-level actor/graph
  // is not very useful

  var oldLink = this[what][link.id];

  delete this[what][link.id];

  this.emit('removeLink', oldLink);

  return this;

};

/**
 *
 * Adds a port
 *
 * NOT IMPLEMENTED
 *
 * @api public
 */
Actor.prototype.addPort = function() {

  return this;

};

/**
 *
 * Removes a port
 *
 * NOT IMPLEMENTED
 *
 * @api public
 */
Actor.prototype.removePort = function() {

  return this;

};

/**
 *
 * Resets this instance so it can be re-used
 *
 * Note: The registered loader is left untouched.
 *
 * @api public
 *
 */
Actor.prototype.reset = function() {

  var id;

  for (id in this.nodes) {
    if (this.nodes.hasOwnProperty(id)) {
      this.getNode(id).reset();
    }
  }

  // if nothing has started yet
  // there is no ioHandler
  if (this.ioHandler) {
    this.ioHandler.reset();
  }

  return this;

};

Actor.prototype.clear = function(cb) {

  if (!cb) {
    throw Error('clear expects a callback');
  }

  var self = this;
  var nodeId;
  var cnt = 0;
  var total = Object.keys(this.nodes).length;

  if (total === 0) {
    cb();
  }

  function removeNodeHandler() {
      cnt++;
      if (cnt === total) {
        self.nodes = {};
        cb();
      }
    }
    // remove node will automatically remove all links
  for (nodeId in this.nodes) {
    if (this.nodes.hasOwnProperty(nodeId)) {
      // will remove links also.
      this.removeNode(nodeId, removeNodeHandler);
    }
  }

};

/**
 *
 * Add IO Handler.
 *
 * The IO Handler handles all the input and output.
 *
 * @param {IOHandler} handler
 * @api public
 *
 */
Actor.prototype.addIoHandler = function(handler) {

  this.ioHandler = handler;

  return this;

};

Actor.prototype.setIoHandler = Actor.prototype.addIoHandler;

/**
 *
 * Add Process Manager.
 *
 * The Process Manager holds all processes.
 *
 * @param {Object} manager
 * @api public
 *
 */
Actor.prototype.addProcessManager = function(manager) {

  this.processManager = manager;

  return this;

};

Actor.prototype.setProcessManager = Actor.prototype.addProcessManager;

/**
 *
 * Add a new context provider.
 *
 * A context provider pre-processes the raw context
 *
 * This is useful for example when using the command line.
 * All nodes which do not have context set can be asked for context.
 *
 * E.g. database credentials could be prompted for after which all
 *      input is fullfilled and the flow will start to run.
 *
 * @param {ContextProvider} provider
 * @api private
 *
 */
Actor.prototype.addContextProvider = function(provider) {
  this.contextProvider = provider;

  return this;

};

Actor.prototype.setContextProvider = Actor.prototype.addContextProvider;

/**
 *
 * Explains what input and output ports are
 * available for interaction.
 *
 */
Actor.prototype.help = function() {

};

/**
 *
 * Send IIPs
 *
 * Optionally with `options` for the port:
 *
 * e.g. { persist: true }
 *
 * Optionally with `source` information
 *
 * e.g. { index: 1 } // index for array port
 *
 * @param {Object} iips
 * @api public
 */
Actor.prototype.sendIIPs = function(iips) {

  var self = this;

  var links = [];

  iips.forEach(function(iip) {

    var xLink = self.createLink({
      source: {
        id: self.id, // we are the sender
        port: ':iip'
      },
      target: iip.target
    });

    // dispose after fill
    xLink.set('dispose', true);

    if (iip.data === undefined) {
      throw Error('IIP data is `undefined`');
    }

    xLink.data = iip.data;

    links.push(xLink);

  });

  links.forEach(function(iip) {

    // TODO: this doesn't happen anymore it's always a link.
    // make sure settings are always set also.
    if (iip.target.constructor.name !== 'Connector') {
      var target = new Connector();
      target.plug(iip.target.id, iip.target.port);
      for (var key in iip.target.setting) {
        if (iip.target.setting.hasOwnProperty(key)) {
          target.set(key, iip.target.setting[key]);
        }
      }
      iip.target = target;
    }

    if (!self.id) {
      throw Error('Actor must contain an id');
    }

    self.addLink(iip);

  });

  links.forEach(function(link) {

    self.ioHandler.emit('send', link);

    var p = new Packet(JSON.parse(JSON.stringify(link.data)));

    // a bit too direct, ioHandler should do this..
    self.ioHandler.queueManager.queue(link.ioid, p);

    // remove data bit.
    delete link.data;
  });

  return links;

};

/*
 * Send a single IIP to a port.
 *
 * Note: If multiple IIPs have to be send use sendIIPs instead.
 *
 * Source is mainly for testing, but essentially it allows you
 * to imposter a sender as long as you send along the right
 * id and source port name.
 *
 * Source is also used to set an index[] for array ports.
 * However, if you send multiple iips for an array port
 * they should be send as a group using sendIIPs
 *
 * This is because they should be added in reverse order.
 * Otherwise the process will start too early.
 *
 * @param {Connector} target
 * @param {Object} data
 * @api public
 */
Actor.prototype.sendIIP = function(target, data) {

  if (!this.id) {
    throw Error('Actor must contain an id');
  }

  if (undefined === data) {
    throw Error('Refused to send IIP without data');
  }

  var ln = {
    source: {
      id: this.id, // we are the sender
      pid: this.pid,
      port: ':iip'
    },
    target: target
  };

  var xLink = this.createLink(ln);
  xLink.data = data;

  // dispose after fill
  xLink.set('dispose', true);

  // makes use of xLink.data
  this.addLink(xLink);

  this.ioHandler.emit('send', xLink);

  var p = new Packet(JSON.parse(JSON.stringify(xLink.data)));

  this.ioHandler.queueManager.queue(xLink.ioid, p);

  // remove data bit.
  delete xLink.data;

  return xLink;

};

/**
 *
 * Retrieve a node by it's process id
 *
 * @param {String} pid - Process ID
 * @return {Object} node
 * @api public
 */
Actor.prototype.getNodeByPid = function(pid) {

  var id;
  var node;

  for (id in this.nodes) {
    if (this.nodes.hasOwnProperty(id)) {
      node = this.getNode(id);
      if (node.pid === pid) {
        return node;
      }
    }
  }

  return;
};

/**
 *
 * Get all node ids this node depends on.
 *
 * @param {String} nodeId
 * @return {Array} nodes
 * @api public
 */
Actor.prototype.getAncestorIds = function(nodeId) {

  var self = this;

  var pids = this.ioHandler.getAncestorPids(
    this.getNode(nodeId).pid
  );

  var ids = [];
  pids.forEach(function(pid) {
    ids.push(self.getNodeByPid(pid).id);
  });
  return ids;

};

/**
 *
 * Get the entire node branch this node depends on
 *
 * @param {String} nodeId
 * @return {Array} nodes
 * @api public
 */
Actor.prototype.getAncestorNodes = function(nodeId) {
  var i;
  var nodes = [];
  var ids = this.getAncestorIds(nodeId);

  for (i = 0; i < ids.length; i++) {
    nodes.push(this.getNode(ids[i]));
  }

  return nodes;
};

/**
 *
 * Get all node ids that target this node.
 *
 * @param {String} nodeId
 * @return {Array} ids
 * @api public
 */
Actor.prototype.getSourceIds = function(nodeId) {

  var self = this;
  var ids = [];

  var pids = this.ioHandler.getSourcePids(
    this.getNode(nodeId).pid
  );

  pids.forEach(function(pid) {
    var node = self.getNodeByPid(pid);
    if (node) { // iips will not be found
      ids.push(node.id);
    }
  });
  return ids;

};

/**
 *
 * Get all nodes that target this node.
 *
 * @param {String} nodeId
 * @return {Array} nodes
 * @api public
 */
Actor.prototype.getSourceNodes = function(nodeId) {

  var i;
  var nodes = [];
  var ids = this.getSourceIds(nodeId);

  for (i = 0; i < ids.length; i++) {
    nodes.push(this.getNode(ids[i]));
  }

  return nodes;

};

/**
 *
 * Get all nodes that use this node as a source .
 *
 * @param {String} nodeId
 * @return {Array} ids
 * @api public
 */
Actor.prototype.getTargetIds = function(nodeId) {

  var self = this;

  var pids = this.ioHandler.getTargetPids(
    this.getNode(nodeId).pid
  );

  var ids = [];
  pids.forEach(function(pid) {
    ids.push(self.getNodeByPid(pid).id);
  });
  return ids;

};

/**
 *
 * Use is a generic way of creating a new instance of self
 * And only act upon a subset of our map.
 *
 *
 */
Actor.prototype.use = function( /*name, context*/ ) {

  throw Error('TODO: reimplement actions');
  /*
    var i;
    var action;
    var map = {};
    var sub = new this.constructor();

    // Use this handlers events also on the action.
    sub._events = this._events;

    // Find our action
    if (!this.map.actions) {
      throw new Error('This flow has no actions');
    }

    if (!this.map.actions.hasOwnProperty(name)) {
      throw new Error('Action not found');
    }

    action = this.map.actions[name];

    // Create a reduced map
    map.env = this.map.env;
    map.title =  action.title;
    map.description = action.description;
    map.ports = this.map.ports;
    map.nodes = [];
    map.links = [];

    for (i = 0; i < this.map.nodes.length; i++) {
      if (action.nodes.indexOf(this.map.nodes[i].id) >= 0) {
        map.nodes.push(this.map.nodes[i]);
      }
    }

    for (i = 0; i < this.map.links.length; i++) {
      if (
        action.nodes.indexOf(this.map.links[i].source.id) >= 0 &&
        action.nodes.indexOf(this.map.links[i].target.id) >= 0) {
        map.links.push(this.map.links[i]);
      }
    }

    // re-use the loader
    sub.addLoader(this.loader);

    // add the nodes to our newly instantiated Actor
    sub.addMap(map);

    // hack to autostart it during run()
    // this only makes sense with actions.
    // TODO: doesn work anymore
    // sub.trigger = action.nodes[0];

    return sub;
  */

};

/**
 *
 * Run the current flow
 *
 * The flow starts by providing the ports with their context.
 *
 * Nodes which have all their ports filled by context will run immediatly.
 *
 * Others will wait until their unfilled ports are filled by connections.
 *
 * Internally the node will be set to a `contextGiven` state.
 * It's a method to tell the node we expect it to have enough
 * information to start running.
 *
 * If a port is not required and context was given and there are
 * no connections on it, it will not block the node from running.
 *
 * If a map has actions defined, run expects an action name to run.
 *
 * Combinations:
 *
 *   - run()
 *     run flow without callback
 *
 *   - run(callback)
 *     run with callback
 *
 *   - action('actionName').run()
 *     run action without callback
 *
 *   - action('actionName').run(callback)
 *     run action with callback
 *
 * The callback will receive the output of the (last) node(s)
 * Determined by which output ports are exposed.
 *
 * If we pass the exposed output, it can contain output from anywhere.
 *
 * If a callback is defined but there are no exposed output ports.
 * The callback will never fire.
 *
 * @api public
 */
Actor.prototype.run = function(callback) {

  return new Run(this, callback);

};
/**
 *
 * Need to do it like this, we want the new sub actor
 * to be returned to place events on etc.
 *
 * Otherwise it's hidden within the actor itself
 *
 * Usage: Actor.action('action').run(callback);
 *
 */
Actor.prototype.action = function(action, context) {

  var sub = this.use(action, context);
  return sub;

};

/**
 *
 * Get all nodes.
 *
 * TODO: unnecessary method
 *
 * @return {Object} nodes
 * @api public
 *
 */
Actor.prototype.getNodes = function() {

  return this.nodes;

};

/**
 *
 * Check if this node exists
 *
 * @param {String} id
 * @return {Object} node
 * @api public
 */
Actor.prototype.hasNode = function(id) {

  return this.nodes.hasOwnProperty(id);

};

/**
 *
 * Get a node by it's id.
 *
 * @param {String} id
 * @return {Object} node
 * @api public
 */
Actor.prototype.getNode = function(id) {

  if (this.nodes.hasOwnProperty(id)) {
    return this.nodes[id];
  }
  else {
    throw new Error(util.format('Node %s does not exist', id));
  }

};

/**
 *
 * JSON Status report about the nodes.
 *
 * Mainly meant to debug after shutdown.
 *
 * Should handle all stuff one can think of
 * why `it` doesn't work.
 *
 */
Actor.prototype.report = function() {

  var link;
  var node;
  var id;
  var size;
  var qm = this.ioHandler.queueManager;

  var report = {
    ok: true,
    flow: this.id,
    nodes: [],
    queues: []
  };

  for (id in this.nodes) {
    if (this.nodes.hasOwnProperty(id)) {
      node = this.nodes[id];
      if (node.status !== 'complete') {
        report.ok = false;
        report.nodes.push({
          node: node.report()
        });
      }
    }
  }

  for (id in this.links) {
    if (this.links.hasOwnProperty(id)) {
      link = this.links[id];
      if (qm.hasQueue(link.ioid)) {
        size = qm.size(link.ioid);
        report.ok = false;
        report.queues.push({
          link: link.toJSON(),
          port: link.target.port,
          // super weird, will be undefined if called here.
          // size: qm.size(link.ioid),
          size: size,
          node: this.getNode(link.target.id).report()
        });
      }
    }
  }

  return report;

};

/**
 *
 * If there are multiple connections to one port
 * the connections are numbered.
 *
 * If there is a index specified by using the
 * [] property, it will be considered.
 *
 * If it's not specified although there are
 * multiple connections to one port, it will be added.
 *
 * The sort takes care of adding connections where
 * [] is undefined to be placed last.
 *
 * The second loop makes sure they are correctly numbered.
 *
 * If connections are defined like:
 *
 *   undefined, [4],undefined, [3],[2]
 *
 * The corrected result will be:
 *
 * [2]        -> [0]
 * [3]        -> [1]
 * [4]        -> [2]
 * undefined  -> [3]
 * undefined  -> [4]
 *
 * Ports which only have one connection will be left unmodified.
 *
 */
Actor.prototype.ensureConnectionNumbering = function(map) {

  var c = 0;
  var i;
  var link;
  var last = {};
  var node;

  // first sort so order of appearance of
  // target.in is correct
  //
  // FIX: seems like multisort is messing up the array.
  // target suddenly has unknown input ports...
  if (map.links.length) {
    multiSort(map.links, ['target', 'in', 'index']);
  }

  for (i = 0; i < map.links.length; i++) {

    link = map.links[i];

    // Weird, the full node is not build yet here?
    // so have to look at the nodeDefinitions ns and name _is_
    // known at this point.
    node = this.nodes[link.target.id];

    if (this.nodeDefinitions[node.ns][node.name]
      .ports.input[link.target.port].type === 'array') {

      if (last.target.id === link.target.id &&
        last.target.port === link.target.port) {
        last.index = c++;
        link.index = c;
      }
      else {
        c = 0; // reset
      }
      last = link;

    }
  }

};

Actor.prototype.hasParent = function() {
  return false;
};

module.exports = Actor;

},{"../lib/context/defaultProvider":11,"../lib/io/mapHandler":14,"../lib/multisort":16,"../lib/process/defaultManager":23,"./connector":10,"./flow":12,"./link":15,"./node":17,"./node/polymer":19,"./packet":20,"./run":25,"./validate":29,"chix-loader":37,"debug":38,"events":2,"util":7,"uuid":50}],10:[function(require,module,exports){
'use strict';

var util    = require('util');
var Setting = require('./setting');

/**
 *
 * Connector
 *
 * The thing you plug into a port.
 *
 * Contains information about port and an optional
 * action to perform within the node (subgraph)
 *
 * Can also contains port specific settings.
 *
 * An xLink has a source and a target connector.
 *
 * ................... xLink ....................
 *
 *  -------------------.    .------------------
 * | Source Connector -------  Target Connector |
 *  ------------------'     `------------------
 *
 * When a link is plugged into a node, we do so
 * by plugging the target connector.
 *
 * @constructor
 * @public
 *
 */
function Connector(settings) {
  Setting.apply(this, [settings]);
  this.wire = undefined;
}

util.inherits(Connector, Setting);

/**
 *
 * Plug
 *
 * TODO: plug is not the correct name
 *
 * @param {String} id - TODO: not sure which id, from the node I pressume..
 * @param {String} port
 * @param {String} action
 */
Connector.prototype.plug = function(id, port, action) {
  this.id     = id;
  this.port   = port;
  if (action) {
    this.action = action;
  }
};

/**
 *
 * Create
 *
 * Creates a connector
 *
 * @param {String} id - TODO: not sure which id, from the node I pressume..
 * @param {String} port
 * @param {Object} settings
 * @param {String} action
 */
Connector.create = function(id, port, settings, action) {

  var c = new Connector(settings);
  c.plug(id, port, action);
  return c;

};

/**
 *
 * Register process id this connector handles.
 *
 */
Connector.prototype.setPid = function(pid) {
  this.pid = pid;
};

Connector.prototype.toJSON = function() {

  var ret = {
    id: this.id,
    port: this.port
  };

  if (this.setting) {
    ret.setting = JSON.parse(JSON.stringify(this.setting));
  }

  if (this.action) {
    ret.action = this.action;
  }

  return ret;

};

module.exports = Connector;

},{"./setting":28,"util":7}],11:[function(require,module,exports){
'use strict';

/**
 *
 * Default Context Provider
 *
 * @constructor
 * @public
 */
function DefaultProvider() {

}

DefaultProvider.prototype.addContext = function(node, defaultContext) {

  if (typeof defaultContext !== 'undefined') {
    node.addContext(defaultContext);
  }

};

module.exports = DefaultProvider;

},{}],12:[function(require,module,exports){
'use strict';

var Packet = require('./packet');
var util = require('util');
var xLink = require('./link');
var validate = require('./validate');
var Actor = require('./actor');
var Connections = require('./ConnectionMap');
var debug = require('debug')('chix:flow');

/**
 *
 * This FlowNode extends the Actor.
 *
 * What it mainly does is delegate what it it asked to do
 * To the nodes from the actor.
 *
 * External Interface is not really needed anymore.
 *
 * Because the flow has ports just like a normal node
 *
 * @constructor
 * @public
 *
 */
function Flow(id, map, identifier, loader, ioHandler, processManager) {

  var self = this;

  if (!id) {
    throw Error('xFlow requires an id');
  }

  if (!map) {
    throw Error('xFlow requires a map');
  }

  // Call the super's constructor
  Actor.apply(this, arguments);

  if (loader) {
    this.loader = loader;
  }
  if (ioHandler) {
    this.ioHandler = ioHandler;
  }

  if (processManager) {
    this.processManager = processManager;
  }

  // External vs Internal links
  this.linkMap = {};

  // indicates whether this is an action instance.
  this.actionName = undefined;

  // TODO: trying to solve provider issue
  this.provider = map.provider;

  this.providers = map.providers;

  this.actions = {};

  // initialize both input and output ports might
  // one of them be empty.
  if (!map.ports) {
    map.ports = {};
  }
  if (!map.ports.output) {
    map.ports.output = {};
  }
  if (!map.ports.input) {
    map.ports.input = {};
  }

  /*
    // make available always.
    node.ports.output['error'] = {
      title: 'Error',
      type: 'object'
    };
  */

  this.id = id;

  this.name = map.name;

  this.type = 'flow';

  this.title = map.title;

  this.description = map.description;

  this.ns = map.ns;

  this.active = false;

  this.metadata = map.metadata || {};

  this.identifier = identifier || [
    map.ns,
    ':',
    map.name
  ].join('');

  this.ports = JSON.parse(
    JSON.stringify(map.ports)
  );

  // Need to think about how to implement this for flows
  // this.ports.output[':complete'] = { type: 'any' };

  this.runCount = 0;

  this.inPorts = Object.keys(
    this.ports.input
  );

  this.outPorts = Object.keys(
    this.ports.output
  );

  //this.filled = 0;

  this.chi = undefined;

  this._interval = 100;

  // this.context = {};

  this.nodeTimeout = map.nodeTimeout || 3000;

  this.inputTimeout = typeof map.inputTimeout === 'undefined' ?
    3000 :
    map.inputTimeout;

  this._hold = false; // whether this node is on hold.

  this._inputTimeout = null;

  this._openPorts = [];

  this._connections = new Connections();

  this._forks = [];

  debug('%s: addMap', this.identifier);
  this.addMap(map);

  this.fork = function() {

    var Fork = function Fork() {
      this.nodes = {};
      //this.context = {};

      // same ioHandler, tricky..
      // this.ioHandler = undefined;
    };

    // Pre-filled baseActor is our prototype
    Fork.prototype = this.baseActor;

    var FActor = new Fork();

    // Remember all forks for maintainance
    self._forks.push(FActor);

    // Each fork should have their own event handlers.
    self.listenForOutput(FActor);

    return FActor;

  };

  this.listenForOutput();

  this.initPortOptions = function() {

    // Init port options.
    for (var port in self.ports.input) {
      if (self.ports.input.hasOwnProperty(port)) {

        // This flow's port
        var thisPort = self.ports.input[port];

        // set port option
        if (thisPort.options) {
          for (var opt in thisPort.options) {
            if (thisPort.options.hasOwnProperty(opt)) {
              self.setPortOption(
                'input',
                port,
                opt,
                thisPort.options[opt]);
            }
          }
        }

      }
    }
  };

  // Too late?
  this.setup();

  this.setStatus('created');

}

util.inherits(Flow, Actor);

Flow.prototype.action = function(action) {

  if (!this.actions.hasOwnProperty(action)) {

    throw Error('this.action should return something with the action map');
    /*
        var ActionActor = this.action(action);

        // ActionActor.map.ports = this.ports;

        // not sure what to do with the id and identifier.
        // I think they should stay the same, for now.
        //
        this.actions[action] = new Flow(
          this.id,
          // ActionActor, // BROKEN
          map, // action definition should be here
          this.identifier + '::' + action
        );

        // a bit loose this.
        this.actions[action].actionName = action;

        //this.actions[action].ports = this.ports;
    */

  }

  return this.actions[action];

};

Flow.prototype.setup = function() {

  this.initPortOptions();

};

/**
 *
 * For forking it is relevant when this addContext is done.
 * Probably this addContext should be done on baseActor.
 * So subsequent forks will have the updated context.
 * Yeah, baseActor is the fingerprint, currentActor is the
 * current one, this._actors is the array of instantiated forks.
 *
 */
Flow.prototype.addContext = function(context) {

  debug('%s: addContext', this.identifier);
  var port;
  for (port in context) {

    if (context.hasOwnProperty(port)) {

      var portDef = this.getPortDefinition(port, 'input');

      if (context.hasOwnProperty(port)) {
        this.getNode(portDef.nodeId)
          .setContextProperty(portDef.name, context[port]);

        // Maybe too easy, but see if it works.
        // Reset when all are filled, then fork.
        //this.filled++;

      }

    }
  }
};

Flow.prototype.setContextProperty = function(port, data) {

  var portDef = this.getPortDefinition(port, 'input');
  this.getNode(portDef.nodeId).setContextProperty(portDef.name, data);

};

Flow.prototype.clearContextProperty = function(port) {

  var portDef = this.getPortDefinition(port, 'input');
  this.getNode(portDef.nodeId).clearContextProperty(portDef.name);

};

Flow.prototype._delay = 0;

Flow.prototype.inputPortAvailable = function(target) {

  if (target.action && !this.isAction()) {

    return this.action(target.action).inputPortAvailable(target);

  }
  else {

    // little bit too much :start hacking..
    // probably causes the :start problem with clock
    if (target.port === ':start') {

      return true;

    }
    else {

      var portDef = this.getPortDefinition(target.port, 'input');

      if (!this.linkMap.hasOwnProperty(target.wire.id)) {
        throw Error('Cannot find internal link within linkMap');
      }

      return this.getNode(portDef.nodeId)
        .inputPortAvailable(this.linkMap[target.wire.id].target);

    }

  }
};

// TODO: both flow & node can inherit this stuff

Flow.prototype.getStatus = function() {

  return this.status;

};

Flow.prototype.setStatus = function(status) {

  this.status = status;
  this.event(':statusUpdate', {
    node: this.export(),
    status: this.status
  });

};

Flow.prototype.error = function(node, err) {

  var error = util.isError(err) ? err : Error(err);

  // TODO: better to have full (custom) error objects
  var eobj = {
    node: node.export(),
    msg: err
  };

  // Update our own status, this should status be resolved
  // Create a shell? yep..
  node.setStatus('error');

  // Used for in graph sending
  node.event(':error', eobj);

  // Used by Process Manager or whoever handles the node
  node.emit('error', eobj);

  return error;
};

Flow.prototype.fill = function(target, p) {

  debug('%s:%s fill', this.identifier, target.port);

  if (target.action && !this.isAction()) {

    // NOTE: action does not take fork into account?
    // test this later. it should be in the context of the currentActor.
    return this.action(target.action).fill(target, p);

  }
  else {

    if (target.port === ':start') {

      // :start is pushing the actor, so exposing a :start
      // port does not make much sense.
      this.event(':start', {
        node: this.export()
      });

      this.setStatus('started');
      debug('%s::start this.push()', this.identifier);
      this.push();
      return true;

    }
    else {

      // delegate this to the node this port belongs to.
      var portDef = this.getPortDefinition(target.port, 'input');

      var node = this.getNode(portDef.nodeId);

      if (!this.linkMap.hasOwnProperty(target.wire.id)) {
        throw Error('link not found within linkMap');
      }

      var err = node.fill(this.linkMap[target.wire.id].target, p);

      if (util.isError(err)) {

        Flow.error(this, err);

        return err;

      }
      else {

        this.event(':start', {
          node: this.export()
        });

        //this.filled++;
/*
        // fishy, also, is filled used at all for flow?
        // filled is irrelevant for flow.
        if (this.filled === this._connections.size) {

          // do not fork for now
          // this.currentActor = this.fork();
          // this.currentActor.run();

          this.filled = 0;

        }
*/

        return true;

      }

    }

  }

};

Flow.prototype.setMetadata = function(metadata) {
  this.metadata = metadata;
};

Flow.prototype.setMeta = function(key, value) {
  this.metadata[key] = value;
};

/**
 *
 * Checks whether the port exists at the node
 * this Flow is relaying for.
 *
 * @param {String} type
 * @param {String} port
 */
Flow.prototype.portExists = function(type, port) {

  // this returns whether this port exists for _us_
  // it only considers the exposed ports.
  var portDef = this.getPortDefinition(port, type);
  return this.getNode(portDef.nodeId).portExists(type, portDef.name);

};

/**
 *
 * Checks whether the port is open at the node
 * this Flow is relaying for.
 *
 * @param {String} port
 */
Flow.prototype.portIsOpen = function(port) {

  // the port open logic is about _our_ open and exposed ports.
  // yet ofcourse it should check the real node.
  // so also delegate.
  var portDef = this.getPortDefinition(port, 'input');
  // Todo there is no real true false in portIsOpen?
  // it will fail hard.
  return this.getNode(portDef.nodeId).portIsOpen(portDef.name);

};

/**
 *
 * Get _this_ Flow's port definition.
 *
 * The definition contains the _real_ portname
 * of the node _this_ port is relaying for.
 *
 * @param {String} port
 */

// JIKES, if we only need the ports we are all good..
Flow.prototype.getPortDefinition = function(port, type) {
  // uhm ok, we also need to add the start port
  if (this.ports[type].hasOwnProperty(port)) {
    return this.ports[type][port];
  }
  else {
    throw new Error(
      util.format(
        'Unable to find exported port definition for %s port `%s` (%s:%s)\n' +
        '\tAvailable ports: %s',
        type,
        port,
        this.ns,
        this.name,
        Object.keys(this.ports.input).toString()
      )
    );
  }
};

Flow.prototype.getPort = function(type, name) {
  return this.getPortDefinition(name, type);
};

/**
 *
 * Get the port option at the node
 * this flow is relaying for.
 *
 * @param {String} type
 * @param {String} port
 * @param {String} option
 */
Flow.prototype.getPortOption = function(type, port, option) {

  // Exposed ports can also have options set.
  // if this is _our_ port (it is exposed)
  // just delegate this to the real node.
  var portDef = this.getPortDefinition(port, type);
  // Todo there is no real true false in portIsOpen?
  // it will fail hard.
  return this.getNode(portDef.nodeId).getPortOption(type, portDef.name, option);
};

/**
 *
 * Sets an input port option.
 *
 * The node schema for instance can specifiy whether a port is persistent.
 *
 * At the moment a connection can override these values.
 * It's a way of saying I give you this once so take care of it.
 *
 * Ok, with forks running this should eventually be much smarter.
 * If there are long running flows, all instances should have their
 * ports updated.
 *
 * Not sure when setPortOption is called, if it is called during 'runtime'
 * there is no problem and we could just set it on the current Actor.
 * I could also just already fix it and update baseActor and all _actors.
 * which would be sufficient.
 *
 * Anyway, this._actors is nice, however what to do with other forking methods.
 * Nevermind first do this.
 *
 */
Flow.prototype.setPortOption = function(type, port, opt, value) {
  var portDef = this.getPortDefinition(port, type);
  this.getNode(portDef.nodeId).setPortOption(type, portDef.name, opt, value);
};

Flow.prototype.openPort = function(port) {
  if (this._openPorts.indexOf(port) === -1) {
    this._openPorts.push(port);
  }
};

Flow.prototype.isAction = function() {

  return !!this.actionName;

};

// TODO: implement
//Flow.prototype.unplug = function(target) {
Flow.prototype.unplug = function(target) {

  if (target.action && !this.isAction()) {

    this.action(target.action).unplug(target);

  }
  else {

    // unplug logic

  }

};

/**
 *
 * Set port to open state
 *
 * This is a problem, xFlow has it's ports opened.
 * However this also means baseActor and all the forks
 * Should have their ports opened.
 *
 * Ok, not a problem, only that addition of the :start port
 * is a problem. Again not sure at what point plug()
 * is called. I think during setup, but later on also
 * in realtime. anyway for now I do not care so much about
 * realtime. Doesn't make sense most of the time.
 *
 * @param {Connector} target
 * @public
 */
Flow.prototype.plug = function(target) {

  if (target.action && !this.isAction()) {

    this.action(target.action).plug(target);

  }
  else {

    if (target.port === ':start') {
      this.addPort('input', ':start', {
        type: 'any'
      });
    }

    // delegate this to the real node
    // only if this is one of _our_ exposed nodes.
    //var portDef = this.getPortDefinition(target.port, 'input');
    var portDef = this.getPortDefinition(target.port, 'input');

    // start is not an internal port, we will do a push on the internal
    // actor and he may figure it out..
    //if (target.port !== ':start') {
    if (target.port !== ':start') {

      // The Node we are gating for
      var internalNode = this.getNode(portDef.nodeId);

      var xlink = new xLink();
      // just define our node as the source, and the external port
      xlink.setSource(this.id, target.port, {}, target.action);
      xlink.setTarget(target.id, portDef.name, {}, target.action);

      for (var k in target.setting) {
        if (target.setting.hasOwnProperty(k)) {
          xlink.target.set(k, target.setting[k]);
        }
      }

      // fixed settings
      if (portDef.hasOwnProperty('setting')) {
        for (k in portDef.setting) {
          if (portDef.setting.hasOwnProperty(k)) {
            xlink.target.set(k, portDef.setting[k]);
          }
        }
      }

      internalNode.plug(xlink.target);

      // Copy the port type, delayed type setting, :start is only known after
      // the port is opened...
      this.ports.input[target.port].type =
        internalNode.ports.input[xlink.target.port].type;

      // we add our internalLink as reference to our link.
      // a bit of a hack, it's not known by the definition of
      // Link itself
      target.wire.internalLink = xlink;

      // outer/inner mapping
      this.linkMap[target.wire.id] = xlink;

    }
    else {
      // what to do with start port?
    }

    // use same logic for our own ports
    if (!this._connections.hasOwnProperty(target.port)) {
      this._connections[target.port] = [];
    }

    this._connections[target.port].push(target.wire);

    this.openPort(target.port);

  }

};

Flow.prototype.exposePort = function(type, nodeId, port, name) {

  var p;
  var node = this.getNode(nodeId);

  if (node.ports[type]) {
    for (p in node.ports[type]) {

      if (node.ports[type].hasOwnProperty(p)) {

        if (p === port) {

          // not sure, is this all info?
          this.addPort(type, name, {
            nodeId: nodeId,
            name: port
          });

          continue;
        }
      }
    }
  }

  this.emit('addPort', {
    node: this.export(),
    port: name
  });

};

Flow.prototype.removePort = function(type, name) {

  if (this.ports[type][name]) {

    delete this.ports[type][name];

    this.emit('removePort', {
      node: this.export(),
      port: name
    });

  }

};

Flow.prototype.renamePort = function(type, from, to) {

  var id;

  if (this.ports[type][from]) {

    this.ports[type][to] = JSON.parse(
      JSON.stringify(this.ports[type][from])
    );

    // update links pointing to us.
    // updates ioHandler also because it holds
    // references to these links
    // TODO: pid/id warning...
    // renaming will only update this instance.
    // accidently these links will make each instance
    // point to the new ports, however not each instance
    // has it's port renamed..
    // For rename it's better to stop the graph
    // update the definition itself then start it again
    // Because for instance the io handler will still send
    // to old ports.
    for (id in this.links) {
      if (type === 'input' &&
        this.links[id].target.id === this.id &&
        this.links[id].target.port === from) {

        this.links[id].target.port = to;

      }
      else if (type === 'output' &&
        this.links[id].source.id === this.id &&
        this.links[id].source.port === from) {

        this.links[id].source.port = to;
      }
    }

    delete this.ports[type][from];

    this.emit('renamePort', {
      node: this.export(),
      from: from,
      to: to
    });

  }

};

Flow.prototype.addPort = function(type, name, def) {

  // add it to known ports
  if (!this.ports[type]) {
    this.ports[type] = {};
  }

  this.ports[type][name] = def;

  if (type === 'input') {
    this.inPorts = Object.keys(this.ports[type]);
  }
  else {
    this.outPorts = Object.keys(this.ports[type]);
  }
};

/**
 *
 * Close the port of the node we are relaying for
 * and also close our own port.
 *
 * @param {String} port
 */
Flow.prototype.closePort = function(port) {
  // delegate this to the real node
  // only if this is one of _our_ exposed nodes.
  var portDef = this.getPortDefinition(port, 'input');

  if (port !== ':start') {

    this.getNode(portDef.nodeId).closePort(portDef.name);
    // this._forks.forEach(function(fork) {
    //  fork.getNode(portDef.nodeId).closePort(portDef.name);
    //});
  }

  if (this.ports.input[port]) {
    this._openPorts.splice(
      this._openPorts.indexOf(port), 1
    );
  }

  this._connections[port].pop();

};

Flow.prototype.hasConnections = function() {
  return this._openPorts.length;
};

/**
 *
 * Puts this flow on hold.
 *
 * NOT IMPLEMENTED YET
 *
 * This should stop each and every fork.
 *
 */
Flow.prototype.hold = function() {

  // implement later, holds input for _this_ flow
  this._hold = true;
  this.stop();
  /*
  this._forks.forEach(function(fork) {
    fork.stop();
  });
  */
};

/**
 *
 * Releases the node if it was on hold
 *
 * This should resume each and every fork.
 *
 * @public
 */
Flow.prototype.release = function() {

  // TODO: these are all just on the actor, not sure Flow also needs it.

  this._hold = false;
  this.resume();
  /*
  this._forks.forEach(function(fork) {
    fork.resume();
  });
  */
};

/**
 *
 * Complete function
 *
 * @public
 */
Flow.prototype.complete = function() {

  // todo: check this.ready stuff logic.
  this.ready = false;
  this.active = false;

};

Flow.prototype.portHasConnection = function(port, link) {
  if (this._connections.hasOwnProperty(port)) {
    return this._connections[port].indexOf(link) >= 0;
  }
  else {
    return false;
  }
};

Flow.prototype.portHasConnections = function(port) {
  if (this._connections.hasOwnProperty(port)) {
    return this._connections[port].length >= 0;
  }
  else {
    return false;
  }
};

Flow.prototype.portGetConnections = function(port) {
  return this._connections[port];
};

/**
 *
 * Listen for output on 'our' ports
 *
 * The internal Actor will actually listen just like the normal actor.
 *
 * @public
 */
Flow.prototype.listenForOutput = function() {

  var port;
  var internalPort;
  var self = this;

  // not really used yet, but this would envolve just
  // commanding all nodes to shutdown,
  // which will be a simple loop.
  // baseActor loop doesn't make much sense but ah well.
  //
  function outputHandler(port, internalPort) {
    return function internalPortHandlerFlow(data) {
      if (internalPort === data.port) {

        debug('%s:%s output', self.identifier, port);
        self.sendPortOutput(port, data.out);

        // there is no real way to say a graph has executed.
        // So just consider each output as an execution.
        // TODO: a bit expensive
        self.event(':executed', {
          node: self.export()
        });

      }
    };
  }

  function freePortHandler(externalPort, internalPort) {

    return function freePortHandlerFlow(event) {

      if (internalPort === event.port) {

        if (self._connections.hasOwnProperty(externalPort)) {

          var extLink;
          var conns = self._connections[externalPort];
          for (var i = 0; i < conns.length; i++) {
            if (conns[i].internalLink === event.link) {
              extLink = conns[i];
              break; // yeay..
            }
          }

          if (!extLink) {
            throw Error('Cannot determine outer link');
          }
          else {
            debug('%s:%s :freePort', self.identifier, externalPort);
            self.event(':freePort', {
              node: self.export(),
              link: extLink,
              port: externalPort
            });

            self.emit('freePort', {
              node: self.export(),
              link: extLink,
              port: externalPort
            });
          }

        }
        else {
          // no connections.
        }

      }
    };
  }

  var internalNode;
  if (this.ports.output) {
    for (port in this.ports.output) {
      if (this.ports.output.hasOwnProperty(port)) {
        internalPort = this.ports.output[port];
        // These bypass the IOHandler, but that's ok, they
        // are just external internal port mappings.
        internalNode = this.getNode(internalPort.nodeId);
        internalNode.on('output', outputHandler(port, internalPort.name));
      }
    }
  }

  if (this.ports.input) {
    for (port in this.ports.input) {
      if (this.ports.input.hasOwnProperty(port)) {
        internalPort = this.ports.input[port];
        // These bypass the IOHandler, but that's ok, they
        // are just external internal port mappings.
        internalNode = this.getNode(internalPort.nodeId);
        internalNode.on('freePort', freePortHandler(port, internalPort.name));
      }
    }
  }
};

/**
 *
 * Runs the shutdown method of the blackbox
 *
 * NOT IMPLEMENTED
 *
 * @public
 */
Flow.prototype.shutdown = function() {

  // not really used yet, but this would envolve just
  // commanding all nodes to shutdown,
  // which will be a simple loop.
};

/**
 *
 * Return a serializable export of this flow.
 *
 * @public
 */
Flow.prototype.export = function() {

  return {

    id: this.id,
    pid: this.pid,
    ns: this.ns,
    name: this.name,
    identifier: this.identifier,
    ports: this.ports,
    // cycles: this.cycles,
    inPorts: this.inPorts,
    outPorts: this.outPorts,
    //filled: this.filled,
    // context: this.context,
    active: this.active,
    provider: this.provider,
    // input: this._filteredInput(),
    openPorts: this._openPorts,
    // nodeTimeout: this.nodeTimeout,
    // inputTimeout: this.inputTimeout
  };

};

/**
 *
 * Export this modified instance to a nodedefinition.
 *
 * @public
 */
Flow.prototype.toJSON = function() {

  var def = {
    id: this.id,
    ns: this.ns,
    name: this.name,
    title: this.title,
    type: this.type,
    description: this.description,
    // should not be the full nodes
    nodes: [],
    links: [],
    ports: this.ports,
    providers: this.providers
  };

  for (var name in this.nodes) {
    if (this.nodes.hasOwnProperty(name)) {
      def.nodes.push(this.nodes[name].toJSON());
    }
  }

  for (var id in this.links) {
    if (this.links.hasOwnProperty(id)) {
      def.links.push(this.links[id].toJSON());
    }
  }

  validate.flow(def);

  return def;

};

Flow.prototype.isStartable = function() {

  // err ok, how to determine this.
  // a flow is always startable?
  // ok for now it is..
  // it should'nt though..
  return true;

};

Flow.prototype.event = function(port, output) {
  var p = new Packet(output);
  this.sendPortOutput(port, p);
};

Flow.prototype.sendPortOutput = function(port, p) {

  // important identifies from what action this output came.
  // used by connections to determine if it should consume
  // the output.

  var out = {
    node: this.export(),
    port: port,
    out: p
  };

  if (this.isAction()) {
    out.action = self.action;
  }

  this.emit('output', out);

};

Flow.prototype.destroy = function() {

  // just ask all nodes to destroy themselves
  // and finally do the same with self
  for (var id in this.nodes) {
    if (this.nodes.hasOwnProperty(id)) {
      this.nodes.destroy();
    }
  }

};

Flow.prototype.setPid = function(pid) {

  this.pid = pid;

};

/**
 *
 * Create an xFlow
 *
 * Some kind of logic as the actor
 *
 * @api public
 */
Flow.create = function(map, loader, ioHandler, processManager) {

  var actor = new Flow(
    map.id,
    map,
    map.ns + ':' + map.name,
    loader,
    ioHandler,
    processManager
  );

  return actor;
};

Flow.prototype.reset = function() {

  this.runCount = 0;
  //this.filled = 0;

  // ask all our nodes to reset.
  // TODO: will be done double if the IO manager
  // also ask all nodes to reset itself.
  for (var id in this.nodes) {
    if (this.nodes.hasOwnProperty(id)) {
      this.nodes.reset();
    }
  }

};

/**
 *
 * Helper function to make the flow an npm module itself.
 *
 * Usage:
 *
 *   Ok, here is the clash...
 *   xFlow needs way to much information to initialize.
 *   It should have the same interface as actor.
 *
 *   var xflow = new xFlow:create(map, loader);
 *   xflow.addMap(map);
 *
 *   module.exports = xflow.expose;
 *
 *   ---
 *
 *   var flow = require('my-flow');
 *
 *   flow({
 *     in: 'some_data',
 *     in2: 'other_data'
 *   }, {
 *     out: function(data) {
 *       // do something with data..
 *     }
 *   });
 *
 * Ok, then what about the actions.
 *
 */
Flow.prototype.expose = function(input, output) {

  var iips = [];
  var key;
  var self = this;
  if (this.hasOwnProperty('ports')) {

    if (this.ports.hasOwnProperty('input')) {

      for (key in input) {

        if (input.hasOwnProperty(key)) {

          var iip;
          var inputPorts = this.ports.input;

          if (inputPorts.hasOwnProperty(key)) {

            iip = {
              target: {
                id: inputPorts[key].nodeId,
                port: inputPorts[key].name,
              },
              data: input[key]
            };

            iips.push(iip);

            // Within the exposed ports these should
            // already be set if they must be used.
            // (implement that) they are not properties
            // a caller should set.
            //
            // target.settings,
            // target.action

          }
          else {

            throw Error(util.format('No such input port %s', key));

          }

        }

      }

    }
    else {
      throw Error('The map provided does not have any input ports available');
    }

    if (output) {

      var cb = output;

      if (this.ports.hasOwnProperty('output')) {

        /////// setup callbacks
        this.on('output', function output(data) {
          if (data.node.id === self.id && cb.hasOwnProperty(data.port)) {
            cb[data.port](data.out);
          }
        });

      }
      else {
        throw Error(
          'The map provided does not have any output ports available'
        );
      }

    }

  }
  else {
    throw Error('The map provided does not have any ports available');
  }

  // start it all
  if (iips.length) {
    this.sendIIPs(iips);
  }

  this.push();

  return this;

};

Flow.prototype.getConnections = function() {
  return this._connections;
};

/**
 *
 * Adds the parent Actor.
 *
 * For now this is only used to copy the events.
 *
 * It causes all nested actors to report to the root
 * actor's listeners.
 *
 * Rather important, otherwise you would
 * only get the events from the first root Actor/Flow
 *
 * @param {Object} actor
 */
Flow.prototype.setParent = function(actor) {
  this.parent = actor;
};

Flow.prototype.getParent = function() {
  return this.parent;
};

Flow.prototype.hasParent = function() {
  return !!this.parent;
};

module.exports = Flow;

},{"./ConnectionMap":8,"./actor":9,"./link":15,"./packet":20,"./validate":29,"debug":38,"util":7}],13:[function(require,module,exports){
'use strict';

var util = require('util');

/**
 *
 * Handles the index
 *
 * @param {Link} link
 * @param {Packet} p
 * @api public
 */
module.exports = function handleIndex(link, p) {
  // TODO: data should be better defined and a typed object
  var index = link.source.get('index');
  if (/^\d+/.test(index)) {
    // numeric
    if (Array.isArray(p.data)) {
      if (index < p.data.length) {
        // new remember index.
        p.index = index;
        return p.data[index];
      }
      else {
        throw new Error(
          util.format(
            'index[] out-of-bounds on array output port `%s`',
            link.source.port
          )
        );
      }
    }
    else {
      throw new Error(
        util.format(
          'Got index[] on array output port `%s`, ' +
          'but data is not of the array type',
          link.source.port
        )
      );
    }
  }
  else {
    if (typeof p.data === 'object') {
      if (p.data.hasOwnProperty(index)) {
        // new remember index.
        p.index = index;
        return p.data[index];
      }
      else {
        // maybe do not fail hard and just send to the error port.
        console.log(p.data);
        throw new Error(
          util.format(
            'Property `%s` not found on object output port `%s`',
            index,
            link.source.port
          )
        );
      }
    }
    else {
      throw new Error(
        util.format(
          'Got index[] on non-object output port %s',
          link.source.port
        )
      );
    }
  }
};

},{"util":7}],14:[function(require,module,exports){
'use strict';
var Packet = require('../packet');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var CHI = require('chix-chi');
var uuid = require('uuid').v4;
var handleIndex = require('./indexHandler');
var isPlainObject = require('is-plain-object');
var DefaultQueueManager = require('../queue/defaultManager');
var debug = require('debug')('chix:io');

function cloneData(p, type) {
  /* function type does not mean the data itself is directly
   * a function, it can also be a plain object holding
   * functions. so what is specified is leading.
   */
  if (type === 'function') {
    return;
  }
  if (typeof p.data === 'object' && isPlainObject(p.data)) {
    p.data = JSON.parse(JSON.stringify(p.data));
  }
}

/**
 *
 * This is the IoMap Handler
 *
 * It should know:
 *
 *  - the connections.
 *  - address of the source UUID + port name
 *  - address of the target UUID + port name
 *  - relevant source & target connection settings.
 *
 * Connection settings can overlap with port settings.
 * Connection settings take precedence over port settings,
 * althought this is not set in stone.
 *
 * @constructor
 * @public
 *
 **/

function IoMapHandler() {
  this.CHI = new CHI();
  // todo: create maps from each of these and wrap them in a connections map
  // so all there wil be is this.connections.
  // connections.byTarget, connections.bySource etc.
  this.targetMap = {};
  this.connections = {};
  this.sourceMap = {};
  this.syncedTargetMap = {};
  this.pointerPorts = {};
  this._shutdown = false;
  this.addQueueManager(
    new DefaultQueueManager(this.receiveFromQueue.bind(this))
  );
  this.addCHI(this.CHI);
}

util.inherits(IoMapHandler, EventEmitter);

IoMapHandler.prototype.addCHI = function(CHI) {
  this.CHI = CHI;
  this.CHI.on('begingroup', this.beginGroup.bind(this));
  this.CHI.on('endgroup', this.sendGroup.bind(this));
  this.CHI.on('collected', this.collected.bind(this));
  this.CHI.on('synced', this.sendSynced.bind(this));
};

/**
 *
 * Connects ports together using the link information provided.
 *
 *  @param {xLink} link
 * @api public
 */
IoMapHandler.prototype.connect = function(link) {
  if (!link.source) {
    throw Error('Link requires a source');
  }
  if (!link.source.pid) {
    link.source.pid = link.source.id;
  }
  // TODO: quick fix, which never works..
  // ioHandler is the only one assigning these..
  // a link with ioid set should be rejected..
  if (!link.ioid) {
    link.ioid = uuid();
  }
  if (!link.target) {
    throw Error('Link requires a target');
  }
  if (!link.target.pid) {
    link.target.pid = link.target.id;
  }
  // register the connection
  this.connections[link.ioid] = link;
  if (!this.targetMap[link.source.pid]) {
    this.targetMap[link.source.pid] = [];
  }
  this.targetMap[link.source.pid].push(link);
  if (!this.sourceMap[link.target.pid]) {
    this.sourceMap[link.target.pid] = [];
  }
  this.sourceMap[link.target.pid].push(link);
  // build the syncedTargetMap, it contains a port array
  // (the group that wants a sync with some originId
  if (link.target.has('sync')) {
    if (!this.syncedTargetMap[link.target.pid]) {
      this.syncedTargetMap[link.target.pid] = {};
    }
    if (!this.syncedTargetMap[link.target.pid][link.target.get('sync')]) {
      this.syncedTargetMap[link.target.pid][link.target.get('sync')] = [];
    }
    this.syncedTargetMap[link.target.pid][link.target.get('sync')]
      .push(link.target.port);
    debug(
      '%s: syncing source port `%s` with target port %s',
      link.ioid, link.target.get('sync'), link.target.port
    );
  }
  if (link.source.get('pointer')) {
    if (!this.pointerPorts[link.source.pid]) {
      this.pointerPorts[link.source.pid] = [];
    }
    this.pointerPorts[link.source.pid].push(link.source.port);
    debug('%s: added pointer port `%s`', link.ioid, link.source.port);
  }

  debug('%s: link connected', link.ioid);

  this.emit('connect', link);
};

// TODO: ugly, source & target map
// should be one central place of registration.
// now a link is in two places.
IoMapHandler.prototype.get = function(link) {
  if (this.sourceMap[link.target.pid]) {
    return this.sourceMap[link.target.pid];
  }
};

IoMapHandler.prototype.lock = function(link) {
  debug('%s: lock', link.ioid);
  this.queueManager.lock(link.ioid);
};

IoMapHandler.prototype.unlock = function(link) {
  debug('%s: unlock', link.ioid);
  this.queueManager.unlock(link.ioid);
};

IoMapHandler.prototype.accept = function(link /*, p*/ ) {
  debug('%s: accept', link.ioid);
  // update the fill count.
  // normally belongs to a Port Object.
  link.fills++;
  // re-open queue for this link.
  if (this.queueManager.isLocked(link.ioid)) {
    // freePort will do this now.
    this.queueManager.unlock(link.ioid);
  }
};

IoMapHandler.prototype.reject = function(err, link, p) {
  // update the reject count.
  // normally belongs to a Port Object.
  link.rejects++;
  this.queueManager.lock(link.ioid);
  // Do not put it back in queue if there was a *real* error
  // Default error is `false`, which is just a normal reject.
  if (util.isError(err)) {
    debug('%s: reject (error)', link.ioid);
    // stays locked.
  }
  else {
    // put it back in queue.
    debug('%s: reject (requeue)', link.ioid);
    this.queueManager.unshift(link.ioid, p);
    // unlock again
    // stay locked, untill unlocked
    // IMPORTANT! unlock logic must just work
    // otherwise it goes beserk.
    // this.queueManager.unlock(link.ioid);
    // The process manager is listening for the node
    // which is already in error state
    // this.emit('error', err);
  }
};

/**
 *
 *  Disconnects a link
 *
 *  @param {xLink} link
 */
IoMapHandler.prototype.disconnect = function(link) {
  var src;
  var tgt;
  // unregister the connection
  if (this.connections.hasOwnProperty(link.ioid)) {
    delete this.connections[link.ioid];
  }
  else {
    throw Error('Cannot disconnect an unknown connection');
  }
  if (this.targetMap[link.source.pid]) {
    src = this.targetMap[link.source.pid];
    src.splice(src.indexOf(link), 1);
    if (src.length === 0) {
      delete this.targetMap[link.source.pid];
    }
  }
  if (this.sourceMap[link.target.pid]) {
    tgt = this.sourceMap[link.target.pid];
    tgt.splice(tgt.indexOf(link), 1);
    if (tgt.length === 0) {
      delete this.sourceMap[link.target.pid];
    }
  }
  if (this.syncedTargetMap[link.target.pid]) {
    tgt = this.syncedTargetMap[link.target.pid];
    tgt.splice(src.indexOf(link.target.port), 1);
    if (tgt.length === 0) {
      delete this.syncedTargetMap[link.target.pid];
    }
  }
  if (this.pointerPorts[link.source.pid]) {
    src = this.pointerPorts[link.source.pid];
    src.splice(src.indexOf(link.source.port), 1);
    if (src.length === 0) {
      delete this.pointerPorts[link.source.pid];
    }
  }
  debug('%s: disconnected', link.ioid);
  // prevents iip bug, where iip is still queued.
  // disconnect does not correctly take queueing into account.
  delete link.ioid;

  // used by actor to close ports
  this.emit('disconnect', link);
};

/**
 *
 * Get all node ids that target this node.
 *
 * TODO: return .id's not .pid ah well..
 *
 * @param {String} pid
 * @return {Array}
 * @api public
 */
IoMapHandler.prototype.getSourcePids = function(pid) {
  var i;
  var src;
  var ids = [];
  if (this.sourceMap.hasOwnProperty(pid)) {
    for (i = 0; i < this.sourceMap[pid].length; i++) {
      src = this.sourceMap[pid][i].source;
      if (ids.indexOf(src.pid) === -1) {
        ids.push(src.pid);
      }
    }
  }
  return ids;
};

/**
 *
 * Get all nodes that use this node as a source .
 *
 * @param {String} pid
 * @return {Array}
 * @api public
 */
IoMapHandler.prototype.getTargetPids = function(pid) {
  var i;
  var ids = [];
  if (this.targetMap.hasOwnProperty(pid)) {
    for (i = 0; i < this.targetMap[pid].length; i++) {
      ids.push(this.targetMap[pid][i].target.pid);
    }
  }
  return ids;
};

/**
 *
 * Get all node ids this node depends on.
 *
 * @param {String} pid
 * @return {Array}
 * @api public
 */
IoMapHandler.prototype.getAncestorPids = function(pid) {
  var i;
  var ids = [];
  var aIds = [];
  var u = [];
  aIds = ids = this.getSourcePids(pid);
  for (i = 0; i < ids.length; i++) {
    aIds = aIds.concat(this.getAncestorPids(ids[i]));
  }
  for (i = 0; i < aIds.length; i++) {
    if (u.indexOf(aIds[i]) === -1) {
      u.push(aIds[i]);
    }
  }
  return u;
};
IoMapHandler.prototype.reset = function(cb) {
  var self = this;
  this._shutdown = true;
  this.queueManager.reset(function() {
    // All writes should stop, queuemanager resets.
    // or maybe should wait for queuemanager to be empty.
    if (cb) {
      cb();
    }
    self._shutdown = false;
  });
};

IoMapHandler.prototype.receiveFromQueue = function(ioid, p) {
  debug('%s: receive from queue', ioid);
  if (this.connections.hasOwnProperty(ioid)) {
    this.send(this.connections[ioid], p);
  }
};

/**
 *
 * The method to provide input to this io handler.
 *
 * @param {Link} link
 * @param {Packet} p
 *
 */
IoMapHandler.prototype.send = function(link, p) {
  if (link.source.has('pointer')) { // is just a boolean
    debug('%s: handling pointer', link.ioid);
    var identifier;
    var pp;
    // THIS IS NOT THE PLACE TO CLONE, but let's try it.
    // WILL BREAK ANYWAY WITH references.
    //
    // Ok, what is _the_ location to clone.
    //
    // A package going different routes must clone.
    //
    // p = p.clone();
    // Create an identifier
    pp = this.getPointerPorts(link.source.pid);
    pp.unshift(link.source.pid);
    identifier = pp.join('-');
    // The source node+port are pointed to.
    // The packet has it's chi updated with the
    // source.pid as key and an assigned item id as value
    //
    this.CHI.pointer(
      link.source.pid,
      link.source.port,
      p,
      identifier
    );
  }
  if (link.target.has('sync')) {
    debug('%s: handling sync port', link.ioid);
    var syncPorts = this.getSyncedTargetPorts(link.target);
    this.CHI.sync(
      //link.target,
      link,
      link.target.get('sync'), // originId
      // TODO: should just only accept the packet
      p,
      syncPorts
    );
    // always return, react on CHI.on('synced')
    return;
  }
  this.__sendData(link, p);
};

/**
 *
 * The method to provide input to this io handler.
 *
 * Ok, what misses here is info on how to find the actor
 * Who needs the information
 *
 *
 * Actor:
 *
 *  ioHandler.listenTo(Object.keys(this.nodes),
 *
 * @param {Connector} target
 * @param {object} input
 * @param {object} chi
 * @private
 */

/*
 *
 * Send Data
 *
 * @param {xLink} link - Link to write to
 * @param {Any} data - The input data
 * @private
 */
IoMapHandler.prototype.__sendData = function(link, p) {
  if (this._shutdown) {
    // TODO:: probably does not both have to be dropped
    // during __sendData *and* during output
    this.drop(p, link);
  }
  else {
    var data;
    if (link.target.has('cyclic') &&
      Array.isArray(p.data) // second time it's not an array anymore
    ) {
      debug('%s: cycling', link.ioid);
      // grouping
      // The counter part will be 'collect'
      var g = this.CHI.group();
      if (p.data.length === 0) {
        return false;
      }
      // make a copy otherwise if output goes to several ports
      // it will receive a popped version.
      //
      // Ok, this has to be removed and source ports should set as cyclic.
      // Not target ports.
      data = JSON.parse(JSON.stringify(p.data));
      var i;
      for (i = 0; i < data.length; i++) {
        // create new packet
        var newp = new Packet(data[i]);
        // this is a copy taking place..
        newp.set('chi', p.chi ? JSON.parse(JSON.stringify(p.chi)) : {});
        g.item(newp.chi);
        this.queueManager.queue(link.ioid, newp);
      }
      // we are done grouping now.
      g.done();
      return; // RETURN
    }
    var cp = p; // current packet
    // too bad cannot check the receiver type.
    // TODO: maybe have p.type() so the packet can tell it's content type.
    // plain object is a bit harder though would have to introduce
    // PLAIN_OBJECT type or something
    // The packet itself should tell what it is,
    // not checking p.data externally like this.
    /*
    if (typeof cp.data === 'object' && isPlainObject(cp.data)) {
      cp.data = JSON.parse(JSON.stringify(cp.data));
    }
    */
    cloneData(cp, 'function');
    // TODO: not sure if index should stay within the packet.
    if (link.source.has('index') && !cp.hasOwnProperty('index')) {
      //if (link.source.has('index')) {
      // above already cloned if possible.
      // what is not cloned is CHI, so could cause a problem..
      cp.chi = JSON.parse(JSON.stringify(cp.chi));
      cp = p.clone(false); // important!
      if (undefined === cp.data[link.source.get('index')]) {
        // this is allowed now for async array ports.
        // the component will only send one index at a time.
        // this is useful for routing.
        // maybe only enable this with a certain setting on the port later on.
        debug('%s: INDEX UNDEFINED %s', link.ioid, link.source, cp.data);
        // does this stop the loop, because it should not.
        return; // nop
      }
      else {
        cp.data = handleIndex(link, cp);
      }
    }
    // TODO: probably just remove this emit. (chix-runtime is using it)
    this.emit('data', {
      link: link,
      data: cp.data // only emit the data
    });

    debug('%s: writing packet', link.ioid);

    link.write(cp);
    this.emit('receive', link);
  }
};

/**
 *
 * Handles the output of every node.
 *
 * This comes directly from the Actor, whom got it from the node.
 *
 * The emit should maybe come from the link write.
 *
 * If there is chi it will be passed along.
 *
 * @param {NodeEvent} event
 * @api public
 */
IoMapHandler.prototype.output = function(event) {
  // used by monitors
  this.emit('output', event);
  this.receive(event.node, event.port, event.out, event.action);
};

/**
 *
 * Monitor event types
 *
 * Optionally provided with a pid.
 *
 */
IoMapHandler.prototype.monitor = function(eventType, pid, cb) {
  this.__monitor(eventType, pid, cb, 'on');
};

IoMapHandler.prototype.monitorOnce = function(eventType, pid, cb) {
  this.__monitor(eventType, pid, cb, 'once');
};

IoMapHandler.prototype.__monitor = function(eventType, pid, cb, how) {
  debug('start monitoring %s', eventType);
  if (!cb) {
    cb = pid;
    pid = undefined;
  }
  var monitor = (function(pid, eventType, cb) {
    return function monitorCallback(event) {
      if (event.port === eventType) {
        if (!pid || event.node.pid === pid) {
          cb(event.out);
        }
      }
    };
  })(pid, eventType, cb);
  this[how]('output', monitor);
};

/**
 *
 * Handles the output of every node.
 *
 * If there is chi it will be passed along.
 *
 * @param {Object} dat
 * @private
 */

/*
 *  source.id
 *  source.port
 *  action should be in the source?
 *
 *  action is target information, but is the only setting used..
 *  so just have the third parameter be action for now.
 *
 *  source is the full source node.
 **/
//  this.receive(dat.node, dat.port, dat.out, dat.action);
IoMapHandler.prototype.receive = function(source, port, p, action) {
  var i;
  // If the output of this node has any target nodes
  if (this.targetMap.hasOwnProperty(source.pid)) {
    // If there are any target nodes defined
    if (this.targetMap[source.pid].length) {
      // Iterate those targets
      for (i = 0; i < this.targetMap[source.pid].length; i++) {
        // Process this link
        var xlink = this.targetMap[source.pid][i];
        // If the link is about this source port
        if (port === xlink.source.port) {
          // did this output came from an action
          // if so, is it an action we are listening for.
          if (!action || xlink.source.action === action) {
            if (xlink.source.get('collect')) {
              debug('%s: collecting packets', xlink.ioid);
              this.CHI.collect(xlink, p);
              continue; // will be handled by event
            }
            //var noQueue = xlink.target.has('noqueue');
            var noQueue = false;
            this.emit('send', xlink);
            // queue must always be used otherwise persist
            // will not work..
            if (noQueue) {
              // must be sure, really no queue, also not after input.
              this.send(xlink, p);
            }
            else {
              debug('%s: queueing', xlink.ioid);
              this.queueManager.queue(xlink.ioid, p);
            }
          }
        }
      }
    }
  }
};

// collected is about the link
// a group is collected for that link
// and is thus always an array.
// this means the target should be used to re-send
// the collected input.
// the group information is actually not interesting.
// we only know we want the data from the last group.
// and use it.
IoMapHandler.prototype.collected = function( /*target, p*/ ) {
  /*
  data.data
  data.link
  */
};

IoMapHandler.prototype.beginGroup = function( /*group*/ ) {};
IoMapHandler.prototype.sendGroup = function( /*group, data*/ ) {
  /*
  data.data
  data.link
  */
};

/**
 *
 * Add Queue Manager.
 *
 * @param {QueueManager} qm
 * @api private
 *
 */
IoMapHandler.prototype.addQueueManager = function(qm) {
  this.queueManager = qm;
};

IoMapHandler.prototype.getSyncedTargetPorts = function(target) {
  var originId = target.get('sync');
  if (!this.syncedTargetMap.hasOwnProperty(target.pid)) {
    throw new Error(util.format('Unkown sync: `%s`', target.pid));
  }
  if (!this.syncedTargetMap[target.pid].hasOwnProperty(originId)) {
    throw new Error(util.format('Unkown sync with: `%s`', originId));
  }
  // returns the ports array, those who wanna sync with originId
  return this.syncedTargetMap[target.pid][originId];
};

IoMapHandler.prototype.getPointerPorts = function(originId) {
  if (this.pointerPorts.hasOwnProperty(originId)) {
    return this.pointerPorts[originId];
  }
  else {
    throw new Error(util.format('%s has no pointer ports', originId));
  }
};

/**
 *
 * Send synchronized input
 *
 * TODO: Input is synced here then we
 *   throw it into the input sender.
 *   They probably stay synced, but
 *   it's not enforced anywhere after this.
 *
 * @param {string} targetId
 * @param {object} data
 */
IoMapHandler.prototype.sendSynced = function(targetId, data) {
  for (var targetPort in data) {
    if (data.hasOwnProperty(targetPort)) {
      var synced = data[targetPort];
      // opens all queues, a it radical..
      this.queueManager.flushAll();
      // keep in sync, do not use setImmediate
      debug('%s: sendSynced', synced.link.ioid);
      this.__sendData(synced.link, synced.p);
    }
  }
};

IoMapHandler.prototype.drop = function(packet, origin) {
  // TODO: drop data/packet gracefully
  debug('IoMapHandler: Dropping packet %s %s', packet, origin);
  this.emit('drop', packet);
};

module.exports = IoMapHandler;

},{"../packet":20,"../queue/defaultManager":24,"./indexHandler":13,"chix-chi":32,"debug":38,"events":2,"is-plain-object":43,"util":7,"uuid":50}],15:[function(require,module,exports){
'use strict';

var util = require('util');
var uuid = require('uuid').v4;
var Connector = require('./connector');
var Setting = require('./setting');
var validate = require('./validate');

/**
 *
 * xLink
 *
 *
 * Settings:
 *
 *   - ttl
 *   - expire
 *   - dispose: true
 *
 * Just need something to indicate it's an iip.
 *
 * @constructor
 * @public
 */
function Link(id, ioid) {

  this.fills = 0;
  this.writes = 0;
  this.rejects = 0;
  this.id = id === undefined ? uuid() : id;
  this.ioid = ioid || uuid();
  this.metadata = {};

}

util.inherits(Link, Setting);

Link.create = function(ln) {

  ln = ln || {};

  var link = new Link(ln.id, ln.ioid);

  if (ln.source || ln.target) {
    link.build(ln);
  }

  return link;

};

Link.prototype.build = function(ln) {

  if (!ln.source) {
    throw Error('Create link expects a source');
  }

  if (!ln.target) {
    throw Error('Create link expects a target');
  }

  validate.link(ln);

  this.setSource(
    ln.source.id,
    ln.source.port,
    ln.source.setting,
    ln.source.action
  );

  if (ln.metadata) {
    this.setMetadata(ln.metadata);
  } else {
    this.setMetadata({});
  }

  this.setTarget(
    ln.target.id,
    ln.target.port,
    ln.target.setting,
    ln.target.action
  );

};

/**
 *
 * Set target
 *
 * @param {String} targetId
 * @param {String} port
 * @param {Object} settings
 * @param {String} action
 * @public
 */
Link.prototype.setTarget = function(targetId, port, settings, action) {

  this.target = new Connector(settings);
  this.target.wire = this;
  this.target.plug(targetId, port, action);

};

Link.prototype.write = function(p) {

  this.writes++;

  // just re-emit
  this.emit('data', p);

};

/**
 *
 * Set Source
 *
 * @param {Object} sourceId
 * @param {String} port
 * @param {Object} settings
 * @param {String} action
 * @public
 */
Link.prototype.setSource = function(sourceId, port, settings, action) {

  this.source = new Connector(settings);
  this.source.wire = this;
  this.source.plug(sourceId, port, action);

};

/**
 *
 * Setting of pid's is delayed.
 * I would like them to be available during plug.
 * but whatever.
 *
 */

Link.prototype.setSourcePid = function(pid) {
  this.source.setPid(pid);
};

Link.prototype.setTargetPid = function(pid) {
  this.target.setPid(pid);
};

Link.prototype.setMetadata = function(metadata) {
  this.metadata = metadata;
};

Link.prototype.setMeta = function(key, val) {
  this.metadata[key] = val;
};

/**
 *
 * Set Title
 *
 * @param {String} title
 * @public
 */
Link.prototype.setTitle = function(title) {

  this.setMeta('title', title);

  this.emit('change', this, 'metadata', this.metadata);

};

Link.prototype.clear = function() {

  this.fills = 0;
  this.writes = 0;
  this.rejects = 0;

  this.emit('clear', this);

};

/**
 *
 * Update link by passing it a full object.
 *
 * Will only emit one change event.
 *
 */
Link.prototype.update = function(ln) {

  this.build(ln);

  this.emit('change', this);

};

Link.prototype.toJSON = function() {

  // TODO: use schema validation for toJSON
  if (!this.hasOwnProperty('source')) {
    console.log(this);
    throw Error('Link should have a source property');
  }
  if (!this.hasOwnProperty('target')) {
    throw Error('Link should have a target property');
  }

  var link = {
    id: this.id,
    source: this.source.toJSON(),
    target: this.target.toJSON()
  };

  if (this.metadata) {
    link.metadata = this.metadata;
  }

  if (this.fills) {
    link.fills = this.fills;
  }

  if (this.rejects) {
    link.rejects = this.rejects;
  }

  if (this.writes) {
    link.writes = this.writes;
  }

  if (this.data !== undefined) {
    link.data = JSON.parse(JSON.stringify(this.data));
  }

  return link;
};

module.exports = Link;

},{"./connector":10,"./setting":28,"./validate":29,"util":7,"uuid":50}],16:[function(require,module,exports){
'use strict';

/**
 * Function to sort multidimensional array
 *
 * Simplified version of:
 *
 *   https://coderwall.com/p/5fu9xw
 *
 * @param {array} a
 * @param {array} b
 * @param {array} columns List of columns to sort
 * @param {array} orderBy List of directions (ASC, DESC)
 * @param {array} index
 * @returns {array}
 */
function multisortRecursive(a, b, columns, orderBy, index) {
  var direction = orderBy[index] === 'DESC' ? 1 : 0;

  var x = a[columns[index]];
  var y = b[columns[index]];

  if (x < y) {
    return direction === 0 ? -1 : 1;
  }

  if (x === y)  {
    return columns.length - 1 > index ?
      multisortRecursive(a, b, columns, orderBy, index + 1) : 0;
  }

  return direction === 0 ? 1 : -1;
}

module.exports = function(arr, columns, orderBy) {

  var x;
  if (typeof columns === 'undefined') {
    columns = [];
    for (x = 0; x < arr[0].length; x++) {
      columns.push(x);
    }
  }

  if (typeof orderBy === 'undefined') {
    orderBy = [];
    for (x = 0; x < arr[0].length; x++) {
      orderBy.push('ASC');
    }
  }

  return arr.sort(function(a, b) {
    return multisortRecursive(a, b, columns, orderBy, 0);
  });
};

},{}],17:[function(require,module,exports){
'use strict';

/* jshint -W040 */

var Packet = require('./packet');
var Connector = require('./connector');
var util = require('util');
var NodeBox = require('./sandbox/node');
var PortBox = require('./sandbox/port');
var BaseNode = require('./node/interface');
var Port = require('./port');
var debug = require('debug')('chix:node');
var portFiller = require('./port/filler');

// Running within vm is also possible and api should stay
// compatible with that, but disable for now.
// vm = require('vm'),

/**
 * Error Event.
 *
 * @event Node#error
 * @type {object}
 * @property {object} node - An export of this node
 * @property {string} msg - The error message
 */

/**
 * Executed Event.
 *
 * @event Node#executed
 * @type {object}
 * @property {object} node - An export of this node
 */

/**
 * Context Update event.
 *
 * @event Node#contextUpdate
 */

/**
 * Output Event.
 *
 * Fired multiple times on output
 *
 * Once for every output port.
 *
 * @event Node#output
 * @type {object}
 * @property {object} node - An export of this node
 * @property {string} port - The output port
 * @property {string} out - A (reference) to the output
 */

/**
 *
 * Node
 *
 * TODO:
 *   do not copy all those properties extend the node object itself.
 *   however, do not forget the difference between a nodeDefinition
 *   and a node.
 *
 *   node contains the process definition, which is the node
 *   definition merged with the instance configuration.
 *
 * @author Rob Halff <rob.halff@gmail.com>
 * @param {String} id
 * @param {Object} node
 * @param {String} identifier
 * @param {CHI} CHI
 * @constructor
 * @public
 */
function xNode(id, node, identifier, CHI) {

  if (!(this instanceof xNode)) {
    return new xNode(id, node, identifier, CHI);
  }

  // detection of async is still needed.
  // Really should all just be different classes.
  // Problem now, we have to run the nodebox to
  // determine async, which is a super hacky way.
  this.async = node.type === 'async' ? true : false;
  this.async = node.async ? true : this.async;

  xNode.super_.apply(this, [id, node, identifier, CHI]);

  this.type = 'node';

  this.state = {};

  // remember def for .compile()
  this.def = node;

  /**
   *
   * Indicates whether this instance is active.
   *
   * This works together with the active state
   * of the sandbox.
   *
   * When a blackbox sends async output done()
   * should be used to inform us it is done.
   *
   * @member {Boolean} active
   * @public
   */
  this.active = false;

  /**
   *
   * Indicates whether this node expects async input.
   *
   * Async input listening is done by:
   *
   *   on.input.<port-name> = function() {}
   *
   * Any node can send async output.
   *
   * Async nodes are handled differently, their function body
   * is only executed once, during startup.
   *
   * I think the port input function can be handled the same
   * as a normal function body, we'll just have several
   * functions to execute based on what input port is targeted.
   *
   * The common state is represented in the `state` object.
   * This is the only variable which is accessible to all ports
   * and during startup.
   *
   */
  this.nodebox = new NodeBox();

  // done() is added to the nodebox
  this.nodebox.set('done', this.complete.bind(this));
  this.nodebox.set('cb', this._asyncOutput.bind(this));
  this.nodebox.set('state', this.state);

  this._setup();

  /** @member {Mixed} chi */
  this.chi = {};

  /** delay interval */
  this.interval = 100;

  /** @member {Object} input */
  this.input = {};

  /** @member {Object} context */
  this.context = {};

  /** @member {Object} dependencies */
  this.dependencies = node.dependencies || {};

  /** @member {Array} expose */
  this.expose = node.expose;

  /** @member {String} fn */
  this.fn = node.fn;

  /**
   * @member {Numeric} nodeTimeout
   * @default 3000
   */
  this.nodeTimeout = node.nodeTimeout || 3000;

  /**
   *
   * inputTimeout in milliseconds
   *
   * If inputTimeout === `false` there will be no timeout
   *
   * @member {Mixed} inputTimeout
   * @default 3000
   */
  this.inputTimeout = typeof node.inputTimeout === 'undefined' ?
    3000 : node.inputTimeout;

  /** @private */
  this.__halted = false; // was halted by a hold

  /** @private */
  this._inputTimeout = null;

  // Solving yet another `design` problem
  // object containing the current connections in use
  // will be reset during free Port.
  // Also belongs to the port objects.
  this._activeConnections = {};

  this.status = 'init';

  // setup the core
  this._fillCore();

  // If this node is async, run it once
  // all ports will be setup and sandbox state will be filled.
  if (this._isPreloaded()) {

    // still need to add the precompiled function
    if (this.fn) {
      //this.nodebox.fill(this.fn);
      // not tested..
      this.nodebox.fill(this.fn);
    }

    if (this.async) {
      // how about nodebox.state?
      // state is now in the definition itself..
      // this should really also be a deep copy.
      this.nodebox.state = node.state;
      this._loadAsync();
    }

  }
  else {

    this.nodebox.compile(this.fn);

    if (this.async) {

      // This collects the port definitions they
      // attach to `on`
      this.nodebox.run();

      this._loadAsync();
    }
  }

}

util.inherits(xNode, BaseNode);

// TODO: this generic, however options does not exists anymore, it's settings
xNode.prototype._setup = function() {

  for (var port in this.ports.input) {
    if (this.ports.input.hasOwnProperty(port)) {
      if (this.ports.input[port].options) {
        for (var opt in this.ports.input[port].options) {
          if (this.ports.input[port].options.hasOwnProperty(opt)) {
            this.setPortOption(
              'input',
              port,
              opt,
              this.ports.input[port].options[opt]);
          }
        }
      }
    }
  }

};

xNode.prototype.start = function() {

  var sb;

  if (this.status === 'created') {

    this.setStatus('started');
    debug('%s: running on start', this.identifier);
    if (this.nodebox.on.start) {
      // Run onStart functionality first
      if (typeof this.nodebox.on.start === 'function') {
        sb = this._createPortBox(this.nodebox.on.start);
      } else {
        sb = this._createPortBox(this.nodebox.on.start.toString());
      }
      sb.run(this);
      this.nodebox.state = this.state = sb.state;
    }

    this.emit('started', {
      node: this.export()
    });

  }

};

xNode.prototype.hasData = function(port) {
  return undefined !== this.input[port];
};

xNode.prototype.fill = function(target, data, settings) {

  var p = data instanceof Packet ? data : new Packet(data);

  // allow for simple api
  if (typeof target === 'string') {
    var port = target;
    target = new Connector(settings || {});
    target.plug(this.id, port);
    // target.set('dispose', true); should be on wire
    if (settings) {
      target.set('persist', true);
    }
    this.plug(target);
  }

  var ret = this._receive(target, p);

  debug('%s:%s receive  %s', this.identifier, target.port, ret);

  if (ret !== true) { // Error or `false`
    if (this.ports.input.hasOwnProperty(target.port)) {
      this.ports.input[target.port].rejects++;
      this.ports.input[target.port].lastError = ret;
    }
  }

  return ret;

};

/**
 * Usage of `$`
 *
 * Idea is to do the reverse of super() all extending `classes`
 * only have $ methods.
 *
 * @param {type} port
 * @param {type} data
 * @returns {undefined}
 * @shielded
 */
xNode.prototype.$setContextProperty = function(port, data) {
  debug('%s:%s set context', this.identifier, port);
  this.context[port] = data;
};

xNode.prototype.clearContextProperty = function(port) {

  debug('%s:%s clear context', this.identifier, port);

  delete this.context[port];

  this.event(':contextClear', {
    node: this,
    port: port
  });
};

/**
 *
 * Starts the node
 *
 * TODO: dependencies are always the same, only input is different.
 * dependencies must be created during createScript.
 * also they must be wrapped within a function.
 * otherwise you cannot overwrite window and document etc.
 * ...Maybe statewise it's a good thing, dependencies are re-required.
 *
 * FIXME: this method does too much on it's own.
 *
 * Note: start is totally unprotected, it assumes the input is validated
 * and all required ports are filled.
 * Start should never really be called directly, the node starts when
 * input is ready.
 *
 * @param {Function} fn
 * @param {String} name
 * @fires Node#error
 * @fires Node#require
 * @fires Node#expose
 * @private
 */
xNode.prototype._delay = 0;

xNode.prototype.__start = function() {

  if (this.active) {
    // try again, note: this is different from input queueing..
    // used for longer running processes.
    debug('%s: node still active delaying', this.identifier);
    this._delay = this._delay + this.interval;
    setTimeout(this.start.bind(this), 500 + this._delay);
    return false;
  }

  // set active state.
  this.active = true;

  // Note: moved to the beginning.
  this.runCount++;

  if (!this.async) {
    if (this.nodebox.on) {
      if (this.nodebox.on.shutdown) {
        debug('%s: running shutdown', this.identifier);
        this.shutdown();
      }
    }
  }

  this.nodebox.input = this.input;

  // difference in notation, TODO: explain these constructions.
  // done before compile.
  // this.nodebox.output = this.async ? this._asyncOutput.bind(this) : {};

  this._runOnce();

};

/**
 *
 * Runs the node
 *
 * @fires Node#nodeTimeout
 * @fires Node#start
 * @fires Node#executed
 * @private
 */
xNode.prototype._runOnce = function() {

  var t = setTimeout(function() {

    debug('%s: node timeout', this.identifier);

    /**
     * Timeout Event.
     *
     * @event Node#nodeTimeout
     * @type {object}
     * @property {object} node - An export of this node
     */
    this.event(':nodeTimeout', {
      node: this.export()
    });

  }.bind(this), this.nodeTimeout);

  /**
   * Start Event.
   *
   * @event Node#start
   * @type {object}
   * @property {object} node - An export of this node
   */
  this.event(':start', {
    node: this.export()
  });

  //this.nodebox.runInNewContext(this.sandbox);
  //
  // ok, this depends on what is the code whether it's running or not...
  // that's why async should be definied per port.
  this.setStatus('running');

  this.nodebox.run();
  this.state = this.nodebox.state;

  debug('%s: nodebox executed', this.identifier);

  this.emit('executed', {
    node: this
  });
  this.event(':executed', {
    node: this
  });

  clearTimeout(t);

  this._output(this.nodebox.output);
};

/**
 *
 * Fills the core of this node with functionality.
 *
 * @fires Node#fillCore
 * @private
 */
xNode.prototype._fillCore = function() {

  debug('%s: fill core', this.identifier);

  /**
   * Fill Core Event.
   *
   * @event Node#fillCore
   * @type {object}
   * @property {object} node - An export of this node
   * @property {function} fn - The function being installed
   * @property {string} fn - The name of the function
   */
  this.event(':fillCore', {
    node: this.export(),
    fn: this.fn,
    name: this.name
  });

  this.nodebox.require(this.dependencies.npm);
  this.nodebox.expose(this.expose, this.CHI);

  this.nodebox.set('output', this.async ? this._asyncOutput.bind(this) : {});

  this.setStatus('created');

};

/**
 *
 * Executes the async variant
 *
 * state is the only variable which will persist.
 *
 * @param {string} fn - Portbox Function Body
 * @returns {PortBox}
 * @private
 */
xNode.prototype._createPortBox = function(fn, name) {

  debug('%s: creating portbox `%s`', this.identifier, name);

  var portbox = new PortBox(name);
  portbox.set('state', this.nodebox.state);
  portbox.set('output', this._asyncOutput.bind(this));

  // also absorbes already required.
  portbox.require(this.dependencies.npm, true);
  portbox.expose(this.expose, this.CHI);

  if (typeof fn !== 'function') {
    fn = fn.slice(
      fn.indexOf('{') + 1,
      fn.lastIndexOf('}')
    );
    portbox.compile(fn);
  } else {
    portbox.fill(fn);
  }

  return portbox;

};

/**
 *
 * Test whether this is a preloaded node.
 *
 * @private
 */
xNode.prototype._isPreloaded = function() {

  var ret;

  if (typeof this.fn === 'function') {
    return true;
  }

  for (var port in this.ports.input) {
    if (this.ports.input.hasOwnProperty(port)) {
      ret = !!this.ports.input[port].fn;
      if (ret) {
        return true;
      }
    }
  }

  return false;

};

/**
 *
 * @private
 */
xNode.prototype._loadAsync = function() {

  for (var port in this.ports.input) {

    if (this.ports.input.hasOwnProperty(port)) {

      // If there is a port function defined for this port
      // it means it's async
      if (this.nodebox.on.input.hasOwnProperty(port)) {

        this.ports.input[port].fn = this._createPortBox(
          this.nodebox.on.input[port].toString(), ('__' + port + '__')
          .toUpperCase()
        );

        this.async = true;
        this.ports.input[port].async = true;

      } else if (this.ports.input[port].fn) {

        // pre-compiled
        this.ports.input[port].fn = this._createPortBox(
          this.ports.input[port].fn, ('__' + port + '__').toUpperCase()
        );

        this.async = true;
        this.ports.input[port].async = true;

      }
      else {

        // It is a sync port

      }

    }
  }

  this.setStatus('created');

  // could just act on general status change event, who uses this?
  this.emit('created', {
    node: this.export()
  });

  this.state = this.nodebox.state;

};

/**
 *
 * Generic Callback wrapper
 *
 * Will collect the arguments and pass them on to the next node
 *
 * So technically the next node is the callback.
 *
 * Parameters are defined on the output as ports.
 *
 * Each callback argument must be defined as output port in the callee's schema
 *
 * e.g.
 *
 *  node style callback:
 *
 *  ports.output: { err: ..., result: ... }
 *
 *  connect style callback:
 *
 *  ports.output: { req: ..., res: ..., next: ... }
 *
 * The order of appearance of arguments must match those of the ports within
 * the json schema.
 *
 * TODO: Within the schema you must define the correct type otherwise output
 * will be refused
 *
 *
 * @private
 */
xNode.prototype._callbackWrapper = function() {

  var i;
  var obj = {};
  var ports;

  ports = this.outPorts;

  for (i = 0; i < arguments.length; i++) {

    if (!ports[i]) {

      // TODO: eventemitter expects a new Error()
      // not the object I send
      // Not sure what to do here, it's not really fatal.
      this.event(':error', {
        msg: Error(
          util.format('Unexpected extra port of type %s',
            typeof arguments[i] === 'object' ?
            arguments[i].constructor.name : typeof arguments[i]
          )
        )
      });

    }
    else {

      obj[ports[i]] = arguments[i];

    }
  }

  this._output(obj);

};

/**
 *
 * Execute the delegated callback for this node.
 *
 * [fs, 'readFile', '/etc/passwd']
 *
 * will execute:
 *
 * fs['readFile']('/etc/passwd', this.callbackWrapper);
 *
 * @param {Object} output
 * @fires Node#branching
 * @private
 */
xNode.prototype._delegate = function(output) {

  var fn = output.splice(0, 1).pop();
  var method = output.splice(0, 1).pop();

  output.push(this._callbackWrapper.bind(this));
  fn[method].apply(fn, output);
};

/**
 *
 * This node handles the output of the `blackbox`
 *
 * It is specific to the API of the internal Chix node function.
 *
 * out = { port1: data, port2: data }
 * out = [fs.readFile, arg1, arg2 ]
 *
 * Upon output the input will be freed.
 *
 * @param {Object} output
 * @param {Object} chi
 * @fires Node#output
 * @private
 */
xNode.prototype._asyncOutput = function(output, chi) {

  var port;

  // Ok, delegate and object output has
  // synchronous output on _all_ ports
  // however we do not know if we we're called from
  // the function type of output..
  for (port in output) {
    if (output.hasOwnProperty(port)) {
      this.sendPortOutput(port, output[port], chi);
    }
  }

};

/**
 *
 * Output
 *
 * Directs the output to the correct handler.
 *
 * If output is a function it is handled by asyncOutput.
 *
 * If it's an array, it means it's the shorthand variant
 *
 * e.g. output = [fs, 'readFile']
 *
 * This will be handled by the delegate() method.
 *
 * Otherwise it is a normal output object containing the output for the ports.
 *
 * e.g. { out1: ...,  out2: ...,  error: ... } etc.
 *
 * TODO: not sure if this should always call complete.
 *
 * @param {Object} output
 * @private
 */
xNode.prototype._output = function(output) {

  var port;

  if (typeof output === 'function') {
    output.call(this, this._asyncOutput.bind(this));
    return;
  }

  if (Array.isArray(output)) {
    this._delegate(output);
    return;
  }

  for (port in output) {
    if (output.hasOwnProperty(port)) {
      this.sendPortOutput(port, output[port]);
    }
  }

  this.complete();

};

/**
 *
 * @param {string} port
 * @private
 */

xNode.prototype._runPortBox = function(port) {

  var sb = this.ports.input[port].fn;
  // fill in the values

  this.event(':start', {
    node: this.export()
  });

  sb.set('data', this.input[port]);
  sb.set('x', this.chi);
  sb.set('state', this.state);
  // sb.set('source', source); is not used I hope
  sb.set('input', this.input); // add all (sync) input.

  this.setStatus('running');

  var ret = sb.run(this);

  this.nodebox.state = this.state = sb.state;

  if (ret === false) {
    // if ret === false input should be revoked and re-queued.
    // which means it must look like we didn't accept the packet in
    // the first place.

    // this.setStatus('idle');
    var d = this.input[port];

    // freePort somehow doesn't work
    // only the below + unlock during unshift works.
    // but has the danger of creating an infinite loop.
    // if rejection is always false.
    delete this.input[port];
    delete this._activeConnections[port];

    this.event(':portReject', {
      node: this.export(),
      port: port,
      data: d // TODO: other portReject emits full packet instead of data.
    });

    return false;
  }

  // todo portbox itself should probably also
  // maintain it's runcount, this one is cumulative
  this.runCount++;

  debug('%s:%s() executed', this.identifier, port);

  this.emit('executed', {
    node: this,
    port: port
  });

  this.event(':executed', {
    node: this,
    port: port
  });

};

/**
*
* Contains much of the port's logic, this should be abstracted out
* into port objects.
*
* For now just add extra functionality overhere.
*
* TODO:
*  - Detect if the input port is defined as Array.
*  - If it is an array, detect what is it's behaviour
*
* Behaviours:
*  - Multiple non-array ports are connected: wait until all have send
*    their input and release the array of data.
*  - One port is connect of the type Array, just accept it and run
*  - Multiple array ports give input/are connected... same as the above
*  Arrays will be handled one by one.
*  - So basically, if we receive an array, we process it.
*  If it is not we will join multiple connections.
*  - If there is only one port connected and it is not of an array type
*    We will just sit there and wait forever,
*    because we cannot make an array out of it.
* - I think the rules should be simple, if you want it more complex,
*   just solve it within the flow by adding extra nodes.
*   What a port does must be understandable.  So that's why it's also good if
*   you can specify different kind of port behaviour.
*   So if you do not like a certain kind of behaviour, just select another one.
*   Yet all should be simple to grasp. You could also explain an array as being
*   a port that expects multiple.
*
*   The filled concept stays the same, the only thing changing is when we
*   consider something to be filled.
*
*   So.. where is the port type information.
*
// TODO: once a connection overwrites a setting.
// it will not be put back, this is a choice.
// at what point do we set persistent from a link btw?
//
// TODO: has become a bit of a weird method now.
*/

xNode.prototype.handlePortSettings = function(port) {
  if (this.ports.input.hasOwnProperty(port)) {}
};

/**
 * Fill one of our ports.
 *
 * First the input data will be validated. A port
 * will only be filled if the data is of the correct type
 * or even structure.
 *
 * The following events will be emitted:
 *
 *   - `portFill`
 *   - `inputTimeout`
 *   - `clearTimeout` (TODO: remove this)
 *
 * FIXME:
 *  - options are set and overwritten on portFill
 *    which is probably undesired in most cases.
 *
 *  - portFill is the one who triggers the start of a node
 *    it's probably better to trigger an inputReady event.
 *    and start the node based on that.
 *
 * @param {Connector} target
 * @param {Packet} p
 * @returns {Node.error.error|Boolean}
 * #private
 */
xNode.prototype._fillPort = function(target, p) {

  var res;

  // this is too early, defaults do not get filled this way.
  if (this.ports.input[target.port].async === true &&
    !this._allConnectedSyncFilled()) {

    this.event(':portReject', {
      node: this.export(),
      port: target.port,
      data: p
    });

    // do not accept
    return false;
  }

  if (undefined === p.data) {
    return Error('data may not be `undefined`');
  }

  // Not used
  //this.handlePortSettings(target.port);

  // PACKET WRITE, TEST THIS
  p.data = this._handleFunctionType(target.port, p.data);

  res = this._validateInput(target.port, p.data);

  if (util.isError(res)) {

    return res;

  }
  else {

    // todo: this logic must be externalized.
    // node doesn't know about persist
    if (!target.has('persist')) {

      try {

        // CHI MERGING check this.
        // Or is this to early, can we still get a reject?
        this.CHI.merge(this.chi, p.chi);
      }
      catch (e) {
        // this means chi was not cleared,
        // yet the input which caused the chi setting
        // freed the port, so how is this possible.
        return this.error(util.format(
          '%s: chi item overlap during fill of port `%s`\n' +
          'chi arriving:\n%s\nchi already collected:\n%s',
          this.identifier,
          target.port,
          JSON.stringify(p.chi),
          JSON.stringify(this.chi)
        ));
      }

    }

    // this.filled++;

    if (!this._inputTimeout &&
      this.inputTimeout &&
      //!this.getPortOption('input', port, 'persist')
      !target.has('persist')
    ) {

      this._inputTimeout = setTimeout(function() {

        /**
         * Input Timeout Event.
         *
         * Occurs when there is an input timeout for this node.
         *
         * This depends on the inputTimeout property of the node.
         * If inputTimeout is false, this event will never occur.
         *
         * @event Node#inputTimeout
         * @type {object}
         * @property {object} node - An export of this node
         */
        this.event(':inputTimeout', {
          node: this.export()
        });

      }.bind(this), this.inputTimeout);
    }

    // used during free port to find back our connections.
    // Should belong to the port object (non existant yet)
    if (target.wire) { // direct node.fill() does not have it

      // does not really happen can be removed..
      if (this._activeConnections[target.port]) {
        throw Error('There still is a connection active');
      }
      else {
        this._activeConnections[target.port] = target.wire;
      }
    }

    // set input port data
    // this could be changed to still contain the Packet.
    this._fillInputPort(target.port, p.data);

    /**
     * Port Fill Event.
     *
     * Occurs when a port is filled with data
     *
     * At this point the data is already validated
     *
     * @event Node#portFill
     * @type {object}
     * @property {object} node - An export of this node
     * @property {string} port - Name of the port
     */
    //this.event(':portFill', {
    //todo: not all events are useful to send as output
    //TODO: just _do_ emit both
    this.emit('portFill', {
      node: this.export(),
      link: target.wire,
      port: target.port
    });

    this.event(':portFill', {
      node: this.export(),
      link: target.wire,
      port: target.port
    });

    var ret = this._readyOrNot();
    return ret;

  }

};

/**
 *
 * @param {string} port
 * @param {Mixed} value
 * @private
 */
xNode.prototype._fillInputPort = function(port, value) {

  debug('%s:%s fill', this.identifier, port);

  this.input[port] = value;

  // increment fill counter
  this.ports.input[port].fills++;

};

/* Unused?
xNode.prototype.syncFilled = function() {

  var port;

  for (port in this.input) {
    if (!this.ports.input[port].async &&
       typeof this.input[port] === 'undefined') {
      return false;
    }
  }

  return true;

};

xNode.prototype.syncFilledCount = function() {

  var port;

  var cnt = 0;
  for (port in this.input) {
    if (!this.ports.input[port].async &&
       typeof this.input[port] !== 'undefined') {
      cnt++;
    }
  }

  return cnt;

};
*/

/***
 *
 * Async problem.
 *
 * start() -> isStartable()
 *
 * If links are not connected yet, this logic will not work.
 * However, how to know we are complete.
 * addnode addnode addlink addlink etk
 *
 *
 *
 */
// ok, nice, multiple ip's will not be possible?, yep..
xNode.prototype.isStartable = function() {

  if (this.hasConnections()) {
    // should never happen with IIPs so fix that bug first
    return false;
  }

  var fillable = 0;
  for (var port in this.ports.input) {
    // null is possible..
    if (this.ports.input[port].default !== undefined) {
      fillable++;
    }
    else if (this.context[port]) {
      fillable++;
    }
    else if (port === ':start') {
      fillable++;
      //} else if (!this.ports.input[port].required) {
    }
    else if (this.ports.input[port].required === false) {
      fillable++;
    }
  }

  return fillable === this.inPorts.length;

};

/**
 *
 * Determines whether we are ready to go.
 * And starts the node accordingly.
 *
 * TODO: it's probably not so smart to consider default
 * it means we can never send an IIP to a port with a default.
 * Because the default will already trigger the node to run.
 *
 * @private
 */
xNode.prototype._readyOrNot = function() {

  // all connected ports are filled.
  if (this._allConnectedSyncFilled()) {

    if (this._inputTimeout) {
      clearTimeout(this._inputTimeout);
    }

    // Check context/defaults etc. and fill it
    var ret = portFiller.fill(
      this.ports.input,
      this.input,
      this.context
    );

    // TODO: if all are async, just skip all the above
    // async must be as free flow as possible.
    if (util.isError(ret)) {

      debug('%s: filler error `%s`', this.identifier, ret);

      return ret;

    }
    else {

      // temp for debug
      //this.ready = true;

      // todo better to check for ready..
      if (this.status !== 'hold') {

        if (this.async) {

          // really have no clue why these must run together
          // and why I try to support 4 different ways of writing
          // a component and sqeeze it into one class.

          var async_ran = 0;
          for (var port in this.ports.input) {

            // run all async which have input.
            // persistent async will have input etc.
            if ((this.ports.input[port].async ||
              this.ports.input[port].fn) &&
              this.input[port] !== undefined) {

              ret = this._runPortBox(port);

              if (ret === false) {
                // revoke input
                if (async_ran > 0) {
                  // only problem now is the multpile async ports.
                  //
                  throw Error('Input revoked, yet one async already ran');
                }

                debug('%s:%s() revoked input', this.identifier, port);

                return Port.INPUT_REVOKED;
              }

              async_ran++;

            }
          }

          if (async_ran > 0) {
            this.freeInput();
          }

        }
        else { // not async

          if (Object.keys(this.input).length !== this.inPorts.length) {

            //return this.error(util.format(
            return Error(util.format(
              'Input does not match, Input: %s, InPorts: %s',
              Object.keys(this.input).toString(),
              this.inPorts.toString()
            ));

          }
          else {

            this.setStatus('running');
            this.__start();

          }

        }

      }
      else {
        this.__halted = true;
      }

    }

    return true;
  }

  // OK, this false has nothing to do with fill return codes..
  // yet above for async I treat false as a failed fill.
  // console.log('SYNC NOT FILLED!', ret, this.identifier);
  //return false;
  return true;

};

/**
 *
 * Frees the input
 *
 * After a node has run the input ports are freed,
 * removing their reference.
 *
 * Exceptions:
 *
 *  - If the port is set to persistent, it will keep it's
 *    reference to the variable and stay filled.
 *
 * NOTE: at the moment a port doesn't have a filled state.
 *  we only count how many ports are filled to determine
 *  if we are ready to run.
 *
 * if a node is still in active state it's input can also not
 * be freed... at the moment it will do so, which is bad.
 *
 * @public
 */
xNode.prototype.freeInput = function() {

  var i;

  // this.filled = 0;

  // Reset this.chi.
  // must be before freePort otherwise chi will overlap
  this.chi = {};

  var port;

  var freed = [];
  for (i = 0; i < this.inPorts.length; i++) {

    port = this.inPorts[i];

    // TODO: don't call freeInput in the first place if undefined
    if (this.input[port] !== undefined) {
      this.freePort(port);
      freed.push(port);
    }
  }

};

xNode.prototype.$portIsFilled = function(port) {
  return this.input.hasOwnProperty(port);
};

xNode.prototype.clearInput = function(port) {
  delete this.input[port];
};

xNode.prototype.freePort = function(port) {

  var persist = this.getPortOption('input', port, 'persist');
  if (persist) {
    // persist, chi, hmz, seeze to exist.
    // but wouldn't matter much, with peristent ports.
    // TODO: this.filled is not used anymore.
    debug('%s:%s persisting', this.identifier, port);

    // indexes are persisted per index.
    if (Array.isArray(persist)) {
      for (var k in this.input[port]) {
        if (persist.indexOf(k) === -1) {
          debug('%s:%s[%s] persisting', this.identifier, port, k);
          // remove
          delete this.input[port][k];
        }
      }
    }

  }
  else {

    // this also removes context and default..
    this.clearInput(port);

    debug('%s:%s :freePort event', this.identifier, port);
    this.event(':freePort', {
      node: this.export(),
      link: this._activeConnections[port], // can be undefined, ok
      port: port
    });

    this.emit('freePort', {
      node: this.export(),
      link: this._activeConnections[port],
      port: port
    });

    // delete reference to active connection (if there was one)
    // delete this._activeConnections[port];
    this._activeConnections[port] = null;
  }

};

/**
 *
 * Checks whether all required ports are filled
 *
 * Used to determine if this node should start running.
 *
 * @public
 */
xNode.prototype.allConnectedFilled = function() {
  for (var port in this.openPorts) {
    if (this.input[port] === undefined) {
      return Node.ALL_CONNECTED_NOT_FILLED;
    }
  }
  return true;
};

xNode.SYNC_NOT_FILLED = false;
xNode.ALL_CONNECTED_NOT_FILLED = false;

/**
 *
 * @private
 */
xNode.prototype._allConnectedSyncFilled = function() {

  for (var i = 0; i < this.openPorts.length; i++) {
    var port = this.openPorts[i];

    // .async test can be removed, .fn is enough
    if (!this.ports.input[port].async ||
      !this.ports.input[port].fn) {

      if (this.ports.input[port].indexed) {
        if (/object/i.test(this.ports.input[port].type)) {
          return this._objectPortIsFilled(port);
        }
        else {
          return this._arrayPortIsFilled(port);
        }
      }
      else if (this.input[port] === undefined) {
        return xNode.SYNC_NOT_FILLED;
      }
    }
  }

  return true;
};

/**
 *
 * Wires a source port to one of our ports
 *
 * target is the target object of the connection.
 * which consist of a source and target object.
 *
 * So in this calink.se the target is _our_ port.
 *
 * If a connection is made to the virtual `:start` port
 * it will be created automatically if it does not exist already.
 *
 * The port will be set to the open state and the connection
 * will be registered.
 *
 * A port can have multiple connections.
 *
 * TODO: the idea was to also keep track of
 *       what sources are connected.
 *
 * @private
 */
xNode.prototype._initStartPort = function() {
  // add it to known ports
  if (!this.portExists('input', ':start')) {
    debug('%s:%s initialized', this.identifier, ':start');
    this.addPort('input', ':start', {
      type: 'any',
      rejects: 0,
      fills: 0
    });
  }
};

/**
 *
 * Holds all input until release is called
 *
 * @public
 */
xNode.prototype.hold = function() {
  this.setStatus('hold');
};

/**
 *
 * Releases the node if it was on hold
 *
 * @public
 */
xNode.prototype.release = function() {

  this.setStatus('ready');

  if (this.__halted) {
    this.__halted = false;
  }
  return this._readyOrNot();
};

xNode.prototype.isHalted = function() {
  return this.__halted;
};

/**
 *
 * Node completion
 *
 * Sends an empty string to the :complete port.
 * Each node automatically has one of those available.
 *
 * Emits the complete event and frees all input ports.
 *
 * @private
 */
xNode.prototype.complete = function() {

  this.active = false;

  // uses this.event() now.
  // this.sendPortOutput(':complete', '', this.chi);

  /**
   * Complete Event.
   *
   * The node has completed.
   *
   * TODO: a node can set itself as being active
   * active must be taken into account before calling
   * a node complete. As long as a node is active
   * it is not complete.
   *
   * @event Node#complete
   * @type {object}
   * @property {object} node - An export of this node
   */

  this.freeInput();

  this.setStatus('complete');

  this.event(':complete', {
    node: this.export()
  });

};

/**
 *
 * Runs the shutdown method of the blackbox
 *
 * An asynchronous node can define a shutdown function:
 *
 *   on.shutdown = function() {
 *
 *     // do shutdown stuff
 *
 *   }
 *
 * When a network shuts down, this function will be called.
 * To make sure all nodes shutdown gracefully.
 *
 * e.g. A node starting a http server can use this
 *      method to shutdown the server.
 *
 * @param {function} cb
 * @returns {undefined}
 * @public
 */
xNode.prototype.shutdown = function(cb) {
  if (this.nodebox.on && this.nodebox.on.shutdown) {

    // TODO: nodes now do nothing with the callback, they should..
    // otherwise we will hang
    this.nodebox.on.shutdown(cb);

    // TODO: send the nodebox, or just the node export?
    this.event(':shutdown', this.nodebox);

  }
  else {
    if (cb) {
      cb();
    }
  }
};

/**
 *
 * Cleanup
 *
 * @public
 */
xNode.prototype.destroy = function() {
  for (var i = 0; i < xNode.events.length; i++) {
    this.removeAllListeners(xNode.events[i]);
  }
};

/**
 *
 * Live reset, connections, etc. stay alive.
 *
 */
xNode.prototype.reset = function() {

  debug('%s: reset', this.identifier);

  // clear persistence
  this.persist = {};

  // clear any input
  this.freeInput();

  // reset status
  // note: also will retrigger the .start thing on nodebox.
  this.status = 'created';

  // reset any internal state.
  this.state = {};

  this.runCount = 0;

};

module.exports = xNode;

},{"./connector":10,"./node/interface":18,"./packet":20,"./port":21,"./port/filler":22,"./sandbox/node":26,"./sandbox/port":27,"debug":38,"util":7}],18:[function(require,module,exports){
'use strict';

/* jshint -W040 */

var EventEmitter = require('events').EventEmitter;
var util = require('util');
var X = require('chix-chi');
var Port = require('../port');
var Packet = require('../packet');
var validate = require('../validate');
var Connections = require('../ConnectionMap');
var debug = require('debug')('chix:inode');

function INode(id, node, identifier, CHI) {

  if (!(this instanceof INode)) {
    return new INode(id, node, identifier, CHI);
  }

  this.pid = null;

  this.provider = node.provider;

  /**
   * @member {String} status
   * @public
   */
  this.status = 'unknown';

  /**
   * @member {String} id
   * @public
   */
  this.id = id;

  /**
   * @member {String} name
   * @public
   */
  this.name = node.name;

  /**
   * @member {String} ns
   * @public
   */
  this.ns = node.ns;

  /**
   * @member {String} title
   * @public
   */
  this.title = node.title;

  /**
   * @member {String} description
   * @public
   */
  this.description = node.description;

  /**
   * @member {Object} metadata
   * @public
   */
  this.metadata = node.metadata || {};

  /**
   * @member {String} identifier
   * @public
   */
  this.identifier = identifier || node.ns + ':' + node.name;

  if (!node.hasOwnProperty('ports')) {
    throw Error('INodeDefinition does not declare any ports');
  }

  if (!node.ports.output) {
    node.ports.output = {};
  }

  if (!node.ports.input) {
    node.ports.input = {};
  }

  if (CHI && CHI.constructor.name !== 'CHI') {
    throw Error('CHI should be instance of CHI');
  }

  this.CHI = CHI || new X();

  // let the node `interface` instantiate all port objects.
  // each extended will already have port object setup.

  /**
   *
   * Ports which are opened by openPort.
   *
   * The Actor opens each port when it connects to it.
   *
   * Also for IIPs the port will have to be opened first.
   *
   * @private
   **/
  this.openPorts = [];

  /**
   *
   * Will keep a list of connections to each port.
   *
   */
  this._connections = new Connections();

  /** @member {Object} ports */
  this.ports = this._clonePorts(node.ports);

  // how many times this node has run
  /** @member {Numeric} runCount */
  this.runCount = 0;

  // how many times this node gave port output
  /** @member {Numeric} outputCount */
  this.outputCount = 0;

  /** @member {Array} inPorts */
  Object.defineProperty(this, 'inPorts', {
    enumerable: true,
    get: function() {
      return Object.keys(this.ports.input);
    }
  });

  /** @member {Array} outPorts */
  Object.defineProperty(this, 'outPorts', {
    enumerable: true,
    get: function() {
      return Object.keys(this.ports.output);
    }
  });

  /** @member {Numeric} filled */
  Object.defineProperty(this, 'filled', {
    enumerable: true,
    configurable: false,
    get: function() {
      return Object.keys(this.input).length;
    }
  });

  // Always add complete port, :start port will be added
  // dynamicaly
  this.ports.output[':complete'] = {
    type: 'any'
  };

  var key;
  // TODO: should just be proper port objects.
  for (key in this.ports.input) {
    if (this.ports.input.hasOwnProperty(key)) {
      this.ports.input[key].fills = 0;
      this.ports.input[key].rejects = 0;
    }
  }

  for (key in this.ports.output) {
    if (this.ports.output.hasOwnProperty(key)) {
      this.ports.output[key].fills = 0;
    }
  }

}

util.inherits(INode, EventEmitter);

/**
 *
 * Create a Node
 *
 * @api public
 */
INode.create = function(id, def, identifier, CHI) {
  return new INode(id, def, identifier, CHI);
};

INode.prototype.getPid = function() {
  return this.pid;
};

INode.prototype._clonePorts = function(ports) {
  var type;
  var port;
  var copy = JSON.parse(JSON.stringify(ports));

  // keep fn in tact.
  // all same `instances` share this function.
  for (type in ports) {
    if (ports.hasOwnProperty(type)) {
      for (port in ports[type]) {
        if (ports[type].hasOwnProperty(port)) {
          if (ports[type][port].fn) {
            copy[type][port].fn = ports[type][port].fn;
            this.async = true; // TODO: remove the need of this flagging.
          }
        }
      }
    }
  }

  return copy;
};

/**
 *
 * @param {type} pid
 * @public
 */
INode.prototype.setPid = function(pid) {
  this.pid = pid;
};

/**
 *
 * Set Title
 *
 * Used to set the title of a node *within* a graph.
 * This property overwrites the setting of the node definition
 * and is returned during toJSON()
 *
 * @param {string} title
 * @public
 */
INode.prototype.setTitle = function(title) {
  this.title = title;
};

/**
 *
 * Set Description
 *
 * Used to set the description of a node *within* a graph.
 * This property overwrites the setting of the node definition
 * and is returned during toJSON()
 *
 * @param {string} description
 * @public
 */
INode.prototype.setDescription = function(description) {
  this.description = description;
};

/**
 *
 * Set metadata
 *
 * Currently:
 *
 *   x: x position hint for display
 *   y: y position hint for display
 *
 * These values are returned during toJSON()
 *
 * @param {object} metadata
 * @public
 */
INode.prototype.setMetadata = function(metadata) {
  for (var k in metadata) {
    if (metadata.hasOwnProperty(k)) {
      this.setMeta(k, metadata[k]);
    }
  }
};

/**
 *
 * Returns the node representation to be stored along
 * with the graph.
 *
 * This is not the full definition of the node itself.
 *
 * The full definition can be found using the ns/name pair
 * along with the provider property.
 *
 */
INode.prototype.toJSON = function() {

  var self = this;

  var json = {
    id: this.id,
    ns: this.ns,
    name: this.name
  };

  [
    'title',
    'description',
    'metadata',
    'provider'
  ].forEach(function(prop) {
    if (self[prop]) {
      if (typeof self[prop] !== 'object' ||
        Object.keys(self[prop]).length > 0) {
        json[prop] = self[prop];
      }
    }
  });

  return json;

};

/**
 *
 * @returns {Object}
 * @public
 */

INode.prototype.report = function() {

  return {
    id: this.id,
    identifier: this.identifier,
    title: this.title,
    filled: this.filled,
    runCount: this.runCount,
    outputCount: this.outputCount,
    status: this.status,
    input: this._filteredInput(),
    context: this.context,
    ports: this.ports,
    state: this.state,
    openPorts: this.openPorts,
    connections: this._connections.toJSON()
  };

};

/**
 *
 * @param {string} key
 * @param {any} value
 */
INode.prototype.setMeta = function(key, value) {
  this.metadata[key] = value;
};

/**
 *
 * Set node status.
 *
 * This is unused at the moment.
 *
 * Should probably contain states like:
 *
 *  - Hold
 *  - Complete
 *  - Ready
 *  - Error
 *  - Timeout
 *  - etc.
 *
 * Maybe something like Idle could also be implemented.
 * This would probably only make sense if there are persistent ports
 * which hold a reference to an instance upon which we can call methods.
 *
 * Such an `idle` state would indicate the node is ready to accept new
 * input.
 *
 * @param {String} status
 * @private
 */
INode.prototype.setStatus = function(status) {

  this.status = status;

  /**
   * Status Update Event.
   *
   * Fired multiple times on output
   *
   * Once for every output port.
   *
   * @event INode#statusUpdate
   * @type {object}
   * @property {object} node - An export of this node
   * @property {string} status - The status
   */
  this.event(':statusUpdate', {
    node: this.export(),
    status: this.status
  });

};

/**
 *
 * Get the current node status.
 *
 * This is unused at the moment.
 *
 * @public
 */
INode.prototype.getStatus = function() {

  return this.status;

};

INode.prototype.getParent = function() {
  return this.parent;
};

INode.prototype.setParent = function(node) {
  this.parent = node;
};

INode.prototype.hasParent = function() {
  return !!this.parent;
};

INode.events = [
  ':closePort',
  ':contextUpdate',
  ':contextClear',
  ':complete',
  ':error',
  ':executed',
  ':expose',
  ':fillCore',
  ':freePort',
  ':index',
  ':inputTimeout',
  ':inputValidated',
  ':nodeTimeout',
  ':openPort',
  ':output',
  ':plug',
  ':unplug',
  ':portFill',
  ':portReject',
  ':require',
  ':statusUpdate',
  ':start',
  ':shutdown'
];

/**
 *
 * @param {string} port
 * @param {Mixed} data
 * @private
 */
INode.prototype._handleFunctionType = function(port, data) {
  var portObj = this.getPort('input', port);
  // convert function if it's not already a function
  if (portObj.type === 'function' &&
    typeof data === 'string') {
    // args, can be used as a hint for named parms
    // if there are no arg names defined, use arguments
    var args = portObj.args ? portObj.args : [];
    data = new Function(args, data);
  }

  return data;
};

/**
 *
 * Fills the port.
 *
 * Does the same as fillPort, however it also checks:
 *
 *   - port availability
 *   - port settings
 *
 * FIXME: fill & fillPort can just be merged probably.
 *
 * @param {Object} target
 * @public
 */
INode.prototype.handleLinkSettings = function(target) {

  // FIX: hold is not handled anywhere as setting anymore
  if (target.has('hold')) {
    this.hold();
  }
  else if (target.has('persist')) {
    // FIX ME: has become a weird construction now
    //
    // THIS IS NOW BROKEN, on purpose.. :-)
    var index = target.get('index');

    // specialized case, make this more clear.
    // persist can be a boolean, or it becomes an array of
    // indexes to persist.
    if (index) {
      if (!Array.isArray(this.ports.input[target.port].persist)) {
        this.ports.input[target.port].persist = [];
      }
      this.ports.input[target.port].persist.push(index);
    }
    else {
      this.ports.input[target.port].persist = true;
    }
  }
};

INode.prototype._receive = function(target, p) {

  if (this.status === 'error') {
    return new Error('Port fill refused process is in error state');
  }

  if (!this.portExists('input', target.port)) {

    return new Error(util.format(
      'Process %s has no input port named `%s`\n\n' +
      '\tInput ports available:\n\n\t%s',
      this.identifier,
      target.port,
      this._portsAvailable()
    ));

  }

  if (!this.portIsOpen(target.port)) {
    return Error(util.format(
      'Trying to send to a closed port open it first: %s',
      target.port
    ));
  }

  // should probably moved somewhere later
  this.handleLinkSettings(target);

  var type = this.ports.input[target.port].type;

  if (type === 'array' && target.has('index')) {
    return this._handleArrayPort(target, p);
  }

  if (type === 'object' && target.has('index')) {
    return this._handleObjectPort(target, p);
  }

  // queue manager could just act on the false return
  // instead of checking inputPortAvailable by itself
  var ret = this.inputPortAvailable(target);
  if (!ret || util.isError(ret)) {

    /**
     * Port Reject Event.
     *
     * Fired when input on a port is rejected.
     *
     * @event INode#portReject
     * @type {object}
     * @property {object} node - An export of this node
     * @property {string} port - Name of the port this rejection occured
     */
    this.event(':portReject', {
      node: this.export(),
      port: target.port,
      data: p
    });

    return ret;

  }
  else {

    ret = this._fillPort(target, p);
    return ret;

  }

};

/**
 *
 * Handles an Array port
 *
 * [0,1,2]
 *
 * When sending IIPs the following can also happen:
 * [undefined, undefined, 2]
 * IIPs in this way must be send as a group.
 * That group will be added in reverse order.
 * This way 2 will create an array of length 3
 * This is important because we will check the length
 * whether we are ready to go.
 *
 * If 0 was added first, the length will be 1 and
 * it seems like we are ready to go, then 1 comes
 * and finds the process is already running..
 *
 * [undefined, undefined, 2]
 *
 * Connections:
 * [undefined, undefined, 2]
 *
 * @param {Connector} target
 * @param {Packet} p
 * @private
 */
INode.prototype._handleArrayPort = function(target, p) {

  // start building the array.
  if (target.has('index')) {

    // Marked the port as being indexed
    this.ports.input[target.port].indexed = true;

    // we have an index.
    // ok, one problem, with async, this.input
    // is never really filled...
    // look at that, will cause dangling data.
    if (!this.input[target.port]) {
      this.input[target.port] = [];
    }

    if (typeof this.input[target.port][target.get('index')] !== 'undefined') {
      // input not available, it will be queued.
      // (queue manager also stores [])
      return Port.INDEX_NOT_AVAILABLE;
    }
    else {

      this.event(':index', {
        node: this.export(),
        port: target.port,
        index: target.get('index')
      });

      this.input[target.port][target.get('index')] = p.data;
    }

    // it should at least be our length
    if (this._arrayPortIsFilled(target.port)) {

      // packet writing, CHECK THIS.
      p.data = this.input[target.port]; // the array we've created.

      // Unmark the port as being indexed
      delete this.ports.input[target.port].indexed;

      // ok, above all return true or false
      // this one is either returning true or an error.
      return this._fillPort(target, p);

    }
    else {

      // input length less than known connections length.
      return Port.AWAITING_INDEX;
    }

  }
  else {

    throw Error(util.format(
      '%s: `%s` value arriving at Array port `%s`, but no index[] is set',
      this.identifier,
      typeof p.data,
      target.port
    ));

  }
};

/**
 *
 * Handles an Object port
 *
 * @param {String} port
 * @param {Object} data
 * @param {Object} chi
 * @param {Object} source
 * @private
 */
// todo, the name of the variable should be target not source.
// source is only handled during output.
INode.prototype._handleObjectPort = function(target, p) {

  // start building the array.
  if (target.has('index')) {

    // we have a key.

    // Marked the port as being indexed
    this.ports.input[target.port].indexed = true;

    // Initialize empty object
    if (!this.input[target.port]) {
      this.input[target.port] = {};
    }

    // input not available, it will be queued.
    // (queue manager also stores [])
    if (typeof this.input[target.port][target.get('index')] !== 'undefined') {
      return false;
    }
    else {

      this.event(':index', {
        node: this.export(),
        port: target.port,
        index: target.get('index')
      });

      // define the key
      this.input[target.port][target.get('index')] = p.data;
    }

    // it should at least be our length
    //
    // Bug:
    //
    // This check is not executed when another port triggers
    // execution. the input object is filled, so it will
    // start anyway.
    //
    if (this._objectPortIsFilled(target.port)) {

      // PACKET WRITING CHECK THIS.
      p.data = this.input[target.port];

      // Unmark the port as being indexed
      delete this.ports.input[target.port].indexed;

      return this._fillPort(target, p);

    }
    else {
      // input length less than known connections length.
      return Port.AWAITING_INDEX;
    }

  }
  else {

    throw Error(util.format(
      '%s: `%s` value arriving at Object port `%s`, but no index[] is set',
      this.identifier,
      typeof p.data,
      target.port
    ));

  }
};

/**
 *
 * @param {string} port
 * @private
 */
INode.prototype._arrayPortIsFilled = function(port) {

  // Not even initialized
  if (typeof this.input[port] === undefined) {
    return false;
  }

  if (this.input[port].length < this._connections[port].length) {
    return false;
  }

  // Make sure we do not have undefined (unfulfilled ports)
  // (Should not really happen)
  for (var i = 0; i < this.input[port].length; i++) {
    if (this.input[port][i] === undefined) {
      return false;
    }
  }

  // Extra check for weird condition
  if (this.input[port].length > this._connections[port].length) {

    this.error(util.format(
      '%s: Array length out-of-bounds for port',
      this.identifier,
      port
    ));

    return false;

  }

  return true;

};

/**
 *
 * @param {string} port
 * @private
 */
INode.prototype._objectPortIsFilled = function(port) {

  // Not even initialized
  if (typeof this.input[port] === undefined) {
    return false;
  }

  // Not all connections have provided input yet
  if (Object.keys(this.input[port]).length < this._connections[port].length) {
    return false;
  }

  // Make sure we do not have undefined (unfulfilled ports)
  // (Should not really happen)
  for (var key in this.input[port]) {
    if (this.input[port][key] === undefined) {
      return false;
    }
  }

  // Extra check for weird condition
  if (Object.keys(this.input[port]).length > this._connections[port].length) {

    this.error(util.format(
      '%s: Object keys length out-of-bounds for port `%s`',
      this.identifier,
      port
    ));

    return false;

  }

  return true;

};

/**
 *
 * @param {string} port
 * @param {Mixed} data
 * @private
 */
INode.prototype._validateInput = function(port, data) {

  if (!this.ports.input.hasOwnProperty(port)) {

    var msg = Error(util.format('no such port: **%s**', port));

    return Error(msg);
  }

  if (!validate.data(this.ports.input[port].type, data)) {

    // TODO: emit these errors, with error constants
    var expected = this.ports.input[port].type;
    var real = Object.prototype.toString.call(data).match(/\s(\w+)/)[1];

    if (data && typeof data === 'object' &&
      data.constructor.name === 'Object') {
      var tmp = Object.getPrototypeOf(data).constructor.name;

      if (tmp) {
        // not sure, sometimes there is no name?
        // in witch case all you can do is type your name as being an 'object'
        real = tmp;
      }
    }

    return Error(util.format(
      'Expected `%s` got `%s` on port `%s`',
      expected, real, port));
  }

  /**
   * Input Validated Event.
   *
   * Occurs when a port was succesfully validated
   *
   * @event INode#inputValidated
   * @type {object}
   * @property {object} node - An export of this node
   * @property {string} port - Name of the port
   */
  this.event(':inputValidated', {
    node: this.export(),
    port: port
  });

  return true;
};

INode.prototype.sendPortOutput = function(port, output, chi) {

  if (!chi) {
    chi = {};
  }

  this.CHI.merge(chi, this.chi, false);

  if (output === undefined) {
    throw Error(
      util.format(
        '%s: Undefined output is not allowed `%s`', this.identifier, port
      )
    );
  }

  if (port === 'error' && output === null) {

    // allow nodes to send null error, but don't trigger it as output.

  }
  else {

    if (this.ports.output.hasOwnProperty(port) ||
      INode.events.indexOf(port) !== -1 // system events
    ) {

      if (this.ports.output.hasOwnProperty(port)) {
        this.ports.output[port].fills++;
        this.outputCount++;
      }

      // so basically all output is a new packet.
      // with chi sustained or enriched.
      var p = new Packet(output);
      p.set('chi', chi);

      debug('%s:%s output', this.identifier, port);

      this.emit('output', {
        node: this.export(),
        port: port,
        out: p
      });

    }
    else {
      throw Error(this.identifier + ': no such output port ' + port);
    }

  }

};

/**
 *
 * Validate a single value
 *
 * TODO: Object (and function) validation could be expanded
 * to match an expected object structure, this information
 * is already available.
 *
 * @param {String} type
 * @param {Object} data
 * @private
 */

/**
 *
 * Does both send events through output ports
 * and emits them.
 *
 * Not sure whether sending the chi is really necessary..
 *
 * @param {string} eventName
 * @param {Packet} p
 * @protected
 */
INode.prototype.event = function(eventName, p) {

  // event ports are prefixed with `:`
  this.sendPortOutput(eventName, p);

};

/**
 *
 * Could be used to externally set a node into error state
 *
 * INode.error(node, Error('you are bad');
 *
 * @param {Error} err
 * @returns {Error}
 */
INode.prototype.error = function(err) {

  var error = util.isError(err) ? err : Error(err);

  // Update our own status
  this.setStatus('error');

  // TODO: better to have full (custom) error objects
  var eobj = {
    //node: node.export(),
    node: this, // do not export so soon.
    msg: err
  };

  // Used for in graph sending
  this.event(':error', eobj);

  // Used by Process Manager or whoever handles the node
  this.emit('error', eobj);

  return error;
};

/**
 *
 * Add context.
 *
 * Must be set in one go.
 *
 * @param {Object} context
 * @public
 */
INode.prototype.addContext = function(context) {
  var port;
  for (port in context) {
    if (context.hasOwnProperty(port)) {
      this.setContextProperty(port, context[port]);
    }
  }
};

/**
 *
 * Do a lightweight export of this node.
 *
 * Used in emit's to give node information
 *
 *
 * @return {Object}
 * @public
 */
INode.prototype.export = function() {

  return {

    id: this.id,
    ns: this.ns,
    name: this.name,
    title: this.title,
    pid: this.pid,
    identifier: this.identifier,
    ports: this.ports,
    cycles: this.cycles,
    inPorts: this.inPorts,
    outPorts: this.outPorts,
    filled: this.filled,
    context: this.context,
    require: this.require,
    status: this.status,
    runCount: this.runCount,
    expose: this.expose,
    active: this.active,
    metadata: this.metadata,
    provider: this.provider,
    input: this._filteredInput(),
    openPorts: this.openPorts,
    nodeTimeout: this.nodeTimeout,
    inputTimeout: this.inputTimeout
  };

};

/**
 *
 * Set context to a port.
 *
 * Can be changed during runtime, but will never trigger
 * a start.
 *
 * Adding the whole context in one go could trigger a start.
 *
 * Packet wise thise content is anonymous.
 *
 * @param {String} port
 * @param {Mixed} data
 * @fires INode#contextUpdate
 * @private
 */
INode.prototype.setContextProperty = function(port, data) {

  if (port === ':start') {
    this.initStartPort();
  }

  var res = this._validateInput(port, data);

  if (util.isError(res)) {

    this.event(':error', {
      node: this.export(),
      msg: Error('setContextProperty: ' + res.message)
    });

  }
  else {

    data = this._handleFunctionType(port, data);

    this.$setContextProperty(port, data);

    this.event(':contextUpdate', {
      node: this,
      port: port,
      data: data
    });

  }
};

INode.prototype.setContext = INode.prototype.setContextProperty;

/**
 *
 * Filters the input for export.
 *
 * Leaving out everything defined as a function
 *
 * Note: depends on the stage of emit whether this value contains anything
 *
 * @return {Object} Filtered Input
 * @private
 */
INode.prototype._filteredInput = function() {
  var port;
  var type;
  var input = {};

  for (port in this.input) {
    if (this.portExists('input', port)) {
      type = this.ports.input[port].type;

      if (type === 'string' ||
        type === 'number' ||
        type === 'enum' ||
        type === 'boolean') {
        input[port] = this.input[port];
      }
      else {
        // can't think of anything better right now
        input[port] = Object.prototype.toString.call(this.input[port]);
      }

    }
    else {

      // faulty but used during export so we want to know
      input[port] = this.input[port];

    }
  }

  return input;
};

// TODO: these port function only make sense for a graph
//       or a dynamic node.

INode.prototype.addPort = function(type, port, def) {
  if (!this.portExists(type, port)) {
    this.ports[type][port] = def;
    return true;
  }
  else {
    return Error('Port already exists');
  }
};

INode.prototype.removePort = function(type, port) {
  if (this.portExists(type, port)) {
    delete this.ports[type][port];
    if (type === 'input') {
      this.clearInput(port);
      this.clearContextProperty(port);
      return true;
    }
  }
  else {
    //return Error(this, 'No such port');
    return Error('No such port');
  }
};

INode.prototype.renamePort = function(type, from, to) {
  if (this.portExists(type, from)) {
    this.ports[type][to] = this.ports[type][from];
    delete this.ports[type][from];
    return true;
  }
  else {
    //return Error(this, 'No such port');
    return Error('No such port');
  }
};

INode.prototype.getPort = function(type, name) {
  if (this.ports.hasOwnProperty(type) &&
    this.ports[type].hasOwnProperty(name)) {
    return this.ports[type][name];
  }
  else {
    throw new Error('Port `' + name + '` does not exist');
  }
};

INode.prototype.getPortOption = function(type, name, opt) {
  var port = this.getPort(type, name);
  if (port.hasOwnProperty(opt)) {
    return port[opt];
  }
  else {
    return undefined;
  }
};

INode.prototype.portExists = function(type, port) {
  return (this.ports[type] && this.ports[type].hasOwnProperty(port)) ||
    (type === 'output' && INode.events.indexOf(port) >= 0);
};

/**
 *
 *
 * @param {String} port
 * @public
 */
INode.prototype.openPort = function(port) {

  if (this.portExists('input', port)) {

    if (this.openPorts.indexOf(port) === -1) {

      this.openPorts.push(port);

      this.event(':openPort', {
        node: this.export(),
        port: port,
        connections: this._connections.hasOwnProperty(port) ?
          this._connections[port].length : // enough info for now
          0 // set by context
      });

    }

    // opening twice is allowed.
    return true;

  }
  else {

    // TODO: make these error codes, used many times, etc.
    return Error(util.format('no such port: **%s**', port));

  }

};

/**
 *
 * @param {string} port
 * @returns {Boolean}
 */
INode.prototype.closePort = function(port) {

  if (this.portExists('input', port)) {

    this.openPorts.splice(this.openPorts.indexOf(port), 1);

    this.event(':closePort', {
      node: this.export(),
      port: port
    });

    return true;

  }
  else {

    // TODO: make these error codes, used many times, etc.
    //return Error(this, util.format('no such port: **%s**', port));
    return Error(util.format('no such port: **%s**', port));

  }

};

/**
 * Whether a port is currently opened
 *
 * @param {String} port
 * @return {Boolean}
 * @private
 */
INode.prototype.portIsOpen = function(port) {
  return this.openPorts.indexOf(port) >= 0;
};

/**
 *
 * Checks whether the input port is available
 *
 * @param {Connector}  target
 * @public
 */
INode.prototype.inputPortAvailable = function(target) {

  if (target.has('index')) {

    if (this.ports.input[target.port].type !== 'array' &&
      this.ports.input[target.port].type !== 'object') {

      return Error([
        this.identifier,
        'Unexpected Index[] information on non array port:',
        target.port
      ].join(' '));
    }

    // not defined yet
    if (!this.input.hasOwnProperty(target.port)) {
      return Port.AVAILABLE;
    }

    // only available if [] is not already filled.
    if (this.input[target.port][target.get('index')] !== undefined) {
      return Port.INDEX_NOT_AVAILABLE;
    }

    if (this.input.length === this._connections[target.port].length) {
      return Port.ARRAY_PORT_FULL;
    }

    return Port.INDEX_AVAILABLE;

  }

  var ret = !this.$portIsFilled(target.port) ?
    Port.AVAILABLE : Port.UNAVAILABLE;
  return ret;

};

/**
 *
 * @param {Connector} target
 * @returns {Boolean}
 * @public
 */
INode.prototype.plug = function(target) {

  if (target.port === ':start') {
    this._initStartPort();
  }

  if (this.portExists('input', target.port)) {

    if (!this._connections[target.port]) {
      this._connections[target.port] = [];
    }

    // direct node fill does not have it.
    if (target.wire) {
      this._connections[target.port].push(target.wire);
    }

    this.event(':plug', {
      node: this.export(),
      port: target.port,
      connections: this._connections[target.port].length
    });

    this.openPort(target.port);

    return true;

  }
  else {

    // problem of whoever tries to attach
    return Error(util.format(
      'Process `%s` has no input port named `%s`\n\n\t' +
      'Input ports available: %s\n\n\t',
      this.identifier,
      target.port,
      this._portsAvailable()
    ));

  }

};

INode.prototype._portsAvailable = function() {
  var ports = [];
  var self = this;
  Object.keys(this.ports.input).forEach(function(port) {
    if (
      (!self.ports.input[port].hasOwnProperty('required') ||
        self.ports.input[port].required === true) &&
      !self.ports.input[port].hasOwnProperty('default')) {
      ports.push(port + '*');
    }
    else {
      ports.push(port);
    }
  });
  return ports.join(', ');
};

/**
 *
 * Determine whether this node has any connections
 *
 * FIX this.
 *
 * @return {Boolean}
 * @public
 */
INode.prototype.hasConnections = function() {
  //return this.openPorts.length;
  var port;
  for (port in this._connections) {
    if (this._connections[port] &&
      this._connections[port].length) {
      return true;
    }
  }

  return false;
};

/**
 *
 * Unplugs a connection from a port
 *
 * Will decrease the amount of connections to a port.
 *
 * TODO: make sure we remove the exact target
 *       right now it just uses pop()
 *
 * @param {Connector} target
 * @public
 */
INode.prototype.unplug = function(target) {

  if (this.portExists('input', target.port)) {

    // direct node fill does not have it
    if (target.wire) {

      if (!this._connections[target.port] ||
        !this._connections[target.port].length) {
        return this.error('No such connection');
      }

      var pos = this._connections[target.port].indexOf(target.wire);
      if (pos === -1) {
        // problem of whoever tries to unplug it
        //return Error(this, 'Link is not connected to this port');
        return Error('Link is not connected to this port');
      }

      this._connections[target.port].splice(pos, 1);
    }

    this.event(':unplug', {
      node: this.export(),
      port: target.port,
      connections: this._connections[target.port].length
    });

    // ok port should only be closed if there are no connections to it
    if (!this.portHasConnections(target.port)) {
      this.closePort(target.port);
    }

    // if this is the :start port also remove it from inports
    // this port is re-added next time during open port
    // TODO: figure out what happens with multiple connections to a :start port
    // because that's also possible, when true connections are made to it,
    // not iip onces,
    if (target.port === ':start' &&
      target.wire.source.port === ':iip' && // start always has a wire.
      this._connections[target.port].length === 0) {
      this.removePort('input', ':start');
    }

    return true;

  }
  else {

    // :start is dynamic, maybe the throw below is no necessary at all
    // no harm in unplugging something non-existent
    if (target.port !== ':start') {

      // problem of whoever tries to unplug
      return Error(util.format(
        'Process `%s` has no input port named `%s`\n\n\t' +
        'Input ports available: \n\n\t%s',
        this.identifier,
        target.port,
        this._portsAvailable()
      ));

    }

  }

};

INode.prototype.start = function() {
  throw Error('INode needs to implement start()');
};

/**
 *
 * Sets an input port option.
 *
 * The node schema for instance can specifiy whether a port is persistent.
 *
 * At the moment a connection can override these values.
 * It's a way of saying I give you this once so take care of it.
 *
 * @param {string} type
 * @param {string} name
 * @param {string} opt
 * @param {any} value
 * @returns {undefined}
 */
INode.prototype.setPortOption = function(type, name, opt, value) {
  var port = this.getPort(type, name);
  port[opt] = value;
};

INode.prototype.setPortOptions = function(type, options) {
  var opt;
  var port;
  for (port in options) {
    if (options.hasOwnProperty(port)) {
      for (opt in options[port]) {
        if (options[port].hasOwnProperty(opt)) {
          if (options.hasOwnProperty(opt)) {
            this.setPortOption(type, port, opt, options[opt]);
          }
        }
      }
    }
  }
};

// Connection Stuff, should be in the Port object
INode.prototype.portHasConnection = function(port, link) {
  return this._connections[port] && this._connections[port].indexOf(link) >= 0;
};
INode.prototype.portHasConnections = function(port) {
  return !!(this._connections[port] && this._connections[port].length > 0);
};

INode.prototype.portGetConnections = function(port) {
  return this._connections[port] || [];
};

INode.prototype.getConnections = function() {
  return this._connections;
};

module.exports = INode;

},{"../ConnectionMap":8,"../packet":20,"../port":21,"../validate":29,"chix-chi":32,"debug":38,"events":2,"util":7}],19:[function(require,module,exports){
'use strict';

/* global document */

var util = require('util');
var Packet = require('../packet');
var xNode = require('./interface');

/**
 *
 * This whole context, default thing is handled differently here.
 * They only make sense on startup as defaults.
 *
 * Since all they are is attributes.
 *
 * For non attribute input ports context & default make no sense.
 * so are ignored.
 *
 * @param {type} id
 * @param {type} node
 * @param {type} identifier
 * @param {type} CHI
 * @returns {PolymerNode}
 */

function PolymerNode(id, node, identifier, CHI) {

  // not sure where to call this yet.
  PolymerNode.super_.apply(this, arguments);

  var self = this;

  this.id = id;

  this.ns = node.ns;
  this.name = node.name;

  this.type = 'polymer';

  this.identifier = identifier;

  this.chi = {};

  this.CHI = CHI;

  /* wanna use this with a Polymer node? */
  this.input = {};

  var da = this.id.split('');
  da.forEach(function(v, i, arr) {
    if (/[A-Z]/.test(v)) {
      arr.splice(i, 1, (i > 0 ? '-' : '') + v.toLowerCase());
    }
  });

  this.elementId = da.join('');

  // TODO: will I use this.ports?
  // for required, default, type etc I still need it.

  /**
   *
   * Problem here is I use uuid's
   * This can be solved by not generating them.
   *
   **/
  this.wc = document.getElementById(this.elementId);
  if (!this.wc) {
    // automatically create the element
    console.log('creating', this.name);
    this.wc = document.createElement(this.name);
    this.wc.setAttribute('id', this.elementId);
    document.querySelector('body').appendChild(this.wc);
  }

  if (!this.wc) {
    throw Error('Polymer Web Component could not be found');
  }

  // TODO: do some basic check whether this really is a polymer element

  // there should be dynamic stuff for e.g. on-tap
  // Ok it's also clear .fbp graphs become just as nested
  // as the components itself, other wise it will not work.
  // one graph means one component.
  // Also if there are then template variable they need to be described.
  // blargh. :-)
  // Ok but these node definitions are so they are selectable within
  // the .fbp that's kinda solved.
  // I should not try to do to much logic for the UI itself.
  // that's not necessary and undoable.
  // So the best example is chix-configurator and the reason I've
  // created it in the first place.
  /*
  Problem a component is composite, defines properties.

  Graph is composite defines external ports.

  Fbpx Graph !== Composite Webcomponent.

  However I treat the composite component as a node Definition.
  So then I have the problem of the same component.
  representing a nodeDefinion but also a graph.

  Which would almost indicate a webcomponent is always also
  a graph, which could be possible, because a graph is also
  a nodeDefinition in chix.

  err, it is possible, but a bit complex.

  which means a polymerNode is closer to xFlow then to xNode.

  */
  function sendPortOutput(port) {
    return function(ev) {
      self.emit('output', {
        node: self.export(),
        port: port,
        out: new Packet(ev)
      });
    };
  }

  if (Object.keys(node.ports.output).length) {
    for (var port in node.ports.output) {
      if (node.ports.output.hasOwnProperty(port)) {
        this.wc.addEventListener(port, sendPortOutput(port));
      }
    }
  }

  this.status = 'ready';

}

util.inherits(PolymerNode, xNode);

PolymerNode.prototype.start = function() {
  /* nothing to do really */
  return true;
};

/**
 *
 * Must do the same kind of logic as xNode
 * Therefor having Ports at this point would be handy
 * Let's at least start by putting those methods in the `interface`.
 */
PolymerNode.prototype.fill = function(target, p) {

  /* input can be an attribute, or one of our methods */
  if (typeof this.wc[target.port] === 'function') {
    this.wc[target.port](p.data);
  }
  else {
    // must be an attribute
    this.wc.setAttribute(target.port, p.data);
  }

};

PolymerNode.prototype.$portIsFilled = function( /*port*/ ) {
  //return this.input.hasOwnProperty(port);
  return false;
};

/**
 *
 * Holds all input until release is called
 *
 * @public
 */
PolymerNode.prototype.hold = function() {
  this.setStatus('hold');
};

/**
 *
 * Releases the node if it was on hold
 *
 * @public
 */
PolymerNode.prototype.release = function() {

  this.setStatus('ready');

  if (this.__halted) {
    this.__halted = false;
    // not much to do
  }
};

module.exports = PolymerNode;

},{"../packet":20,"./interface":18,"util":7}],20:[function(require,module,exports){
'use strict';

/**
 *
 * A packet wraps the data.
 *
 * Enabling tracking and adding metadata
 *
 * Filters are not really creating new packets.
 * But modify the data.
 *
 * Maybe use getters and setters?
 *
 * var p = new Packet(data);
 *
 * drop(p);
 *
 * Packet containing it's own map of source & target.
 * Could be possible, only what will happen on split.
 *
 */
var nr = 10000000000;
function Packet(data, n, c) {

  this.data = data;
  this.chi = {};
  this.nr = n ? n : nr++;
  this.c = c ? c : 0; // clone version
  this.owner = undefined;

  // probably too much info for a basic packet.
  // this.created_at =
  // this.updated_at =

}

Packet.prototype.read = function() {
  return this.data;
};

Packet.prototype.write = function(data) {
  this.data = data;
};

// clone can only take place on plain object data.

/**
 * Clone the current packet
 *
 * In case of non plain objects it's mostly desired
 * not to clone the data itself, however do create a *new*
 * packet with the other cloned information.
 *
 * To enable this set cloneData to true.
 *
 * @param {Boolean} cloneData Whether or not to clone the data.
 */
Packet.prototype.clone = function(cloneData) {
  var p = new Packet(
    cloneData === undefined ?
    JSON.parse(JSON.stringify(this.data)) :
    this.data,
    this.nr,
    ++this.c
  );
  p.set('chi', JSON.parse(JSON.stringify(this.chi)));
  return p;
};

Packet.prototype.set = function(prop, val) {
  this[prop] = val;
};

Packet.prototype.get = function(prop) {
  return this[prop];
};

Packet.prototype.del = function(prop) {
  delete this[prop];
};

Packet.prototype.has = function(prop) {
  return this.hasOwnProperty(prop);
};

module.exports = Packet;

},{}],21:[function(require,module,exports){
'use strict';

/**
 *
 * Port
 *
 * Distinct between input & output port
 * Most methods are for input ports.
 *
 * @example
 *
 *  var port = new Port();
 *  port.receive(p);
 *  port.receive(p); // rejected
 *  port.read();
 *  port.read();
 *  port.receive(p);
 *
 */
function Port() {

  //if (!(this instanceof Port)) return new Port(options);

  // important to just name it input for refactor.
	// eventually can be renamed to something else.
  //
	// node.input[port] becomes node.getPort(port).input
  //
  this.input = undefined;

  this._open = false;

  // If async the value will pass right through a.k.a. non-blocking
	// If there are multiple async ports, the code implementation
	// consequently must be a state machine.
	// async + sync is still possible. One async port is just one
	// function call and thus not a state machine.
  this.async = false;
  this._connections = [];

}

// Important to make clear for debugging
// during port fill the message comes back.
// these names though are confusing.
// I want these to be like Errors but not errors.

// requeue
Port.INPUT_REVOKED       = false; // removed by a portbox
Port.NOT_FILLED          = false; // ??

// ok there is a mixture of functionality here.
// Port.AVAILABLE for example is just a return code for availability
// and does not indicate whether the port was filled.
/*
  Port.AVAILABLE;
  Port.INDEX_NOT_AVAILABLE;
  Port.ARRAY_PORT_FULL;
  Port.INDEX_AVAILABLE;
 Port.AVAILABLE : Port.UNAVAILABLE;
*/

// success

// used in input port available
Port.AVAILABLE           = true; // non index port was set
Port.UNAVAILABLE         = false; // not an index port but input is already set
Port.INDEX_AVAILABLE     = true; // index was set
Port.INDEX_NOT_AVAILABLE = false; // index already filled
// could be the same as index not available,
// this just tells it's full and will be processed
Port.ARRAY_PORT_FULL     = false;

// index was set, but waiting others to be filled
Port.AWAITING_INDEX      = true;

// this is a weird return code,
// because it's probably not about the filled port itself
Port.CONTEXT_SET         = true;
Port.PERSISTED_SET       = true; // idem
Port.DEFAULT_SET         = true; // idem
Port.NOT_REQUIRED        = true; // idem
Port.FILLED              = true; // port was filled.

/**
 *
 * Used from within a component to receive the port data
 *
 */
Port.prototype.receive = function() {
};

/**
 *
 * Used from within a component to close the port
 *
 * A component receives an open port.
 * When the port closes it's ready to be filled.
 * This also means there are two sides on a port
 * Open for input and open for output to the component.
 *
 */
Port.prototype.close = function() {
  this._open = false;
};

Port.prototype.open = function() {
  this._open = true;
};

// TODO: after refactor these will end up elsewhere
Port.prototype.hasConnection = function(link) {
  return this._connections && this._connections.indexOf(link) >= 0;
};
Port.prototype.hasConnections = function() {
  return this._connections.length > 0;
};

Port.prototype.getConnections = function() {
  return this._connections;
};

// this seems to be a wrong check?
// ah no, no property means not filled.
// but this is just wrong. array port for example is not filled, if it's set.
// it's being taken care of, but only causes more code to be necessary
Port.prototype.isFilled = function() {
  return this.input !== undefined;
};

Port.prototype.clearInput = function() {
  this.input = undefined;
};

Port.prototype.isAvailable = function() {
};

// Node freePort
Port.prototype.free = function() {

  var persist = this.getOption('persist');
  if (persist) {
    // persist, chi, hmz, seeze to exist.
    // but wouldn't matter much, with peristent ports.
    // TODO: this.filled is not used anymore.

    // indexes are persisted per index.
    if (Array.isArray(persist)) {
      for (var k in this.input) {
        if (persist.indexOf(k) === -1) {
          // remove
          delete this.input[k];
        }
      }
    }

  } else {

    // not sure, activeConnections could stay a node thing.

    // this also removes context and default..
    this.clearInput();

    this.event(':freePort', {
      node: this.export(),
      link: this._activeConnections,
      port: this.name
    });

    this.emit('freePort', {
      node: this.export(),
      link: this._activeConnections,
      port: this.name
    });

    // delete reference to active connection (if there was one)
    delete this._activeConnections;
  }

};

//Node.prototype.getPortOption = function(type, name, opt) {

// could become this.setting[opt], but that will change things too much
Port.prototype.getOption = function(opt) {
  if (this.hasOwnProperty(opt)) {
    return this[opt];
  } else {
    return undefined;
  }
};

/**
 *
 * Sets an input port option.
 *
 * The node schema for instance can specifiy whether a port is persistent.
 *
 * At the moment a connection can override these values.
 * It's a way of saying I give you this once so take care of it.
 *
 */
//Node.prototype.setPortOption = function(type, name, opt, value) {
Port.prototype.setOption = function(opt, value) {
  this[opt] = value;
};

//Node.prototype.setPortOptions = function(type, options) {
Port.prototype.setOptions = function(options) {
  var opt;
  var port;
  for (port in options) {
    if (options.hasOwnProperty(port)) {
      for (opt in options[port]) {
        if (options[port].hasOwnProperty(opt)) {
          if (options.hasOwnProperty(opt)) {
            this.setOption(opt, options[opt]);
          }
        }
      }
    }
  }
};

module.exports = Port;

},{}],22:[function(require,module,exports){
'use strict';

var Port = require('../port');
var util = require('util');

var portFill;

module.exports = portFill = exports;

exports.fill = function(ports, input, context) {

  var ret;

  for (var port in ports) {
    if (ports.hasOwnProperty(port)) {
      ret = portFill.defaulter(
        port,
        ports,
        input,
        context
      );
      if (util.isError(ret)) {
        return ret;
      }
    }
  }

  return true;

};

exports.check = function(obj, key, input, context, persist) {
  var ret;

  if (obj[key].properties) { //
    var init;

    if (!input[key]) {
      input[key] = {};
      init = true;
    }

    for (var k in obj[key].properties) {
      if (obj[key].properties.hasOwnProperty(k)) {

        ret = !portFill.check(
          obj[key].properties,
          k,
          input[key],
          context ? context[key] : {},
          persist ? persist[key] : {}
        );

        if (!ret) {

          // use this again, just return the value
          // this will have checked the nested schema definitions.
          // return ret;
          /*
                  throw new Error([
                    this.identifier + ': Cannot determine input for property:',
                    key + '[' + k + ']'
                  ].join(' '));
          */
        }
      }
    }

    if (!Object.keys(input[key]).length && init) {
      // remove empty object again
      delete input[key]; // er ref will not work probably.
    }

    // not sure, but at least should be true.
    return Port.FILLED;

  }
  else {

    // check whether input was defined for this port
    if (!input.hasOwnProperty(key)) {
      // if there is context, use that.
      if (context && context.hasOwnProperty(key)) {
        input[key] = context[key];
        return Port.CONTEXT_SET;
        // check the existance of default (a value of null is also valid)
      }
      else if (persist && persist.hasOwnProperty(key)) {
        input[key] = persist[key];
        return Port.PERSISTED_SET;
      }
      else if (obj[key].hasOwnProperty('default')) {
        input[key] = obj[key].default;
        return Port.DEFAULT_SET;
      }
      else if (obj[key].required === false) {
        // filled but empty let the node handle it.
        input[key] = null;
        return Port.NOT_REQUIRED;
      }
      else {
        return Port.NOT_FILLED;
      }

    }
    else {
      return Port.FILLED;
    }

  }
};

// also fill the defaults one level deep..
/**
 *
 * @param {string} port
 * @private
 */
exports.defaulter = function(port, ports, input, context) {
  if (!portFill.check(
      ports,
      port,
      input,
      context
    ) && !ports[port].async) {

    if (port[0] !== ':') {
      return Port.SYNC_PORTS_UNFULFILLED;
      /*
            // fail hard
            return Error(util.format(
              '%s: Cannot determine input for port `%s`',
              this.identifier,
              port
            ));
      */

    }

  }
};

},{"../port":21,"util":7}],23:[function(require,module,exports){
(function (process){
'use strict';

var util = require('util');
var uuid = require('uuid').v4;
var EventEmitter = require('events').EventEmitter;

var onExit = [];
if (process.on) { // old browserify
  process.on('exit', function onExitHandlerProcessManager() {
    onExit.forEach(function(instance) {

      var key;
      var process;
      var report;
      var reports = {};

      for (key in instance.processes) {
        if (instance.processes.hasOwnProperty(key)) {
          process = instance.processes[key];
          if (process.type === 'flow') {
            report = process.report();
            if (!report.ok) {
              reports[key] = report;
            }
          }
        }
      }

      if (Object.keys(reports).length) {
        instance.emit('report', reports);
      }

    });
  });
}

/**
 *
 * Default Process Manager
 *
 * @constructor
 * @public
 *
 */
function ProcessManager() {

  this.processes = {};

  onExit.push(this);

}

util.inherits(ProcessManager, EventEmitter);

ProcessManager.prototype.getMainGraph = function() {
  return this.getMainGraphs().pop();
};

ProcessManager.prototype.getMainGraphs = function() {

  var main = [];
  var key;
  var p;

  for (key in this.processes) {
    if (this.processes.hasOwnProperty(key)) {
      p = this.processes[key];
      if (p.type === 'flow' && !p.hasParent()) {
        main.push(p);
      }
    }
  }

  return main;

};

ProcessManager.prototype.onProcessStartHandler = function(event) {
  this.emit('startProcess', event.node);
};
ProcessManager.prototype.onProcessStopHandler = function(event) {
  this.emit('stopProcess', event.node);
};
ProcessManager.prototype.register = function(node) {

  if (node.pid) {
    throw new Error('Refusing to add node with existing process id');
  }

  var pid = uuid();
  node.setPid(pid);
  this.processes[pid] = node;

  // Note: at the moment only subgraphs emit the start event.
  // and only subgraphs can be stopped, this is good I think.
  // The process manager itself holds *all* nodes.
  // Start is a push on the actor.
  // However, when we start a network we only care about
  // the push on the main actor, not the subgraphs.
  // So this is something to think about when you listen
  // for startProcess.
  // Maybe for single stop and start of nodes the actor should be used
  // and the actor emits the stop & start events, with the node info
  // To stop a node: this.get(graphId).hold(nodeId);
  // Ok you just do not stop single nodes, you hold them.
  // Stop a node and your network is borked.
  this.processes[pid].on('start', this.onProcessStartHandler.bind(this));
  this.processes[pid].on('stop', this.onProcessStopHandler.bind(this));

  // Process manager handles all errors.
  // or in fact, ok we have to add a errorHandler ourselfes also
  // but the process manager will be able to do maintainance?
  node.on('error', this.processErrorHandler.bind(this));

  // pid is in node.pid
  this.emit('addProcess', node);

};

/**
 *
 * Process Error Handler.
 *
 * The only errors we receive come from the nodes themselves.
 * It's also garanteed if we receive an error the process itself
 * Is already within an error state.
 *
 */
ProcessManager.prototype.processErrorHandler = function(event) {

  if (event.node.status !== 'error') {
    console.log('STATUS', event.node.status);
    throw Error('Process is not within error state', event.node.status);
  }

  // Emit it, humans must solve this.
  this.emit('error', event);

};

ProcessManager.prototype.changePid = function(from, to) {

  if (this.processes.hasOwnProperty(from)) {
    this.processes[to] = this.processes[from];
    delete this.processes[from];
  }
  else {
    throw Error('Process id not found');
  }

  this.emit('changePid', {
    from: from,
    to: to
  });

};

// TODO: improve start, stop, hold, release logic..
ProcessManager.prototype.start = function(node) {

  // allow by pid and by node object
  var pid = typeof node === 'object' ? node.pid : node;

  if (this.processes.hasOwnProperty(pid)) {
    if (this.processes[pid].type === 'flow') {
      this.processes[pid].start();
    }
    else {
      this.processes[pid].release();
    }
  }
  else {
    throw Error('Process id not found');
  }
};

ProcessManager.prototype.stop = function(node, cb) {

  // allow by pid and by node object
  var pid = typeof node === 'object' ? node.pid : node;

  if (this.processes.hasOwnProperty(pid)) {
    if (this.processes[pid].type === 'flow') {
      this.processes[pid].stop(cb);
    }
    else {
      this.processes[pid].hold(cb);
    }
  }
  else {
    throw Error('Process id not found');
  }
};

// TODO: just deleting is not enough.
// links also contains the pids
// on remove process those links should also be removed.
ProcessManager.prototype.unregister = function(node, cb) {

  var self = this;

  if (!node.pid) {
    throw new Error('Process id not found');
  }

  function onUnregister(node, cb) {

    /*
    node.removeListener('start', self.onProcessStartHandler);
    node.removeListener('stop', self.onProcessStopHandler);
    node.removeListener('error', self.processErrorHandler);
    */

    node.removeAllListeners('start');
    node.removeAllListeners('stop');
    node.removeAllListeners('error');

    delete self.processes[node.pid];

    // remove pid
    delete node.pid;

    // todo maybe normal nodes should also use stop + cb?
    if (cb) {
      cb(node);
    }

    self.emit('removeProcess', node);

  }

  if (this.processes[node.pid].type === 'flow') {

    // wait for `subnet` to be finished
    self.stop(node, onUnregister.bind(this, node, cb));

  }
  else {

    node.shutdown(onUnregister.bind(this, node, cb));

  }

};

/**
 *
 * Get Process
 * Either by id or it's pid.
 *
 */
ProcessManager.prototype.get = function(pid) {

  return this.processes[pid];

};

/**
 *
 * Using the same subgraph id for processes can work for a while.
 *
 * This method makes it possible to find graphs by id.
 *
 * Will throw an error if there is a process id conflict.
 *
 * If a containing actor is passed as second parameter
 * the uniqueness of the node is garanteed.
 *
 */
ProcessManager.prototype.getById = function(id, actor) {
  return this.findBy('id', id, actor);
};

ProcessManager.prototype.findBy = function(prop, value, actor) {
  var found;
  var process;
  var node;
  for (process in this.processes) {
    if (this.processes.hasOwnProperty(process)) {
      node = this.processes[process];
      if (node[prop] === value &&
        (!actor || actor.hasNode(node.id))) {
        if (found) {
          console.log(this.processes);
          throw Error(
            'conflict: multiple ' + prop + 's matching ' + value
          );
        }
        found = node;
      }
    }
  }
  return found;
};

ProcessManager.prototype.filterByStatus = function(status) {
  return this.filterBy('status', status);
};

ProcessManager.prototype.filterBy = function(prop, value) {

  var id;
  var filtered = [];

  for (id in this.processes) {
    if (this.processes.hasOwnProperty(id)) {
      if (this.processes[id][prop] === value) {
        filtered.push(this.processes[id]);
      }
    }
  }

  return filtered;

};

module.exports = ProcessManager;

}).call(this,require("uojqOp"))
},{"events":2,"uojqOp":5,"util":7,"uuid":50}],24:[function(require,module,exports){
'use strict';

var util = require('util');
var debug = require('debug')('chix:queue');

function Queue() {
  this.lock = false;
  this.queue = [];
  this.pounders = 0;
}

/**
 *
 * Default Queue Manager
 *
 * @constructor
 * @public
 *
 */
function QueueManager(dataHandler) {

  this.queues = {};
  this._shutdown = false;

  this.locks = {}; /* node locks */

  this.pounders = 0; /* cumulative count */

  Object.defineProperty(this, 'inQueue', {
    enumerable: true,
    get: function() {
      // snapshot of queueLength
      var id;
      var inQ = 0;
      for (id in this.queues) {
        if (this.queues.hasOwnProperty(id)) {
          inQ += this.queues[id].queue.length;
        }
      }
      return inQ;
    }
  });

  this.onData(dataHandler);
}

QueueManager.prototype.onData = function(handler) {
  this.sendData = handler;
};

QueueManager.prototype.pounder = function() {

  var self = this.self;
  if (!self.queues.hasOwnProperty(this.id)) {
    throw Error('Unclean shutdown: Pounding on non-exist substance');
  }

  var queue = self.queues[this.id];
  queue.pounders--;
  self.pounders--;

  var inQueue = queue.queue.length;
  if (inQueue === 0) {
    throw Error('nothing in queue this should not happen!');
  }

  var p = self.pick(this.id);

  if (self._shutdown) {

    self.drop('queued', this.id, p);

  }
  else if (self.isLocked(this.id)) {
    self.unshift(this.id, p);

  }
  else {
    debug('%s:%s.%s send data', this.id, p.nr, p.c);
    self.sendData(this.id, p);
  }

};

QueueManager.prototype.getQueue = function(id) {

  if (this.queues.hasOwnProperty(id)) {
    return this.queues[id];
  }

  throw Error(util.format('queue id: `%s` is unmanaged', id));

};

QueueManager.prototype.pound = function(id) {

  if (!id) {
    throw Error('no id!');
  }

  this.getQueue(id).pounders++;
  this.pounders++;

  setTimeout(
    this.pounder.bind({
      id: id,
      self: this
    }), 0
  );

};

QueueManager.prototype.get = function(id) {
  return this.getQueue(id).queue;
};

/**
 *
 * Queue data for the link given
 *
 * @param {string} id
 * @param {Packet} p
 * @public
 */
QueueManager.prototype.queue = function(id, p) {

  if (p.constructor.name !== 'Packet') {
    throw Error('not an instance of Packet');
  }

  if (this._shutdown) {
    this.drop('queue', id, p);
  }
  else {

    this.init(id);
    this.getQueue(id).queue.push(p);

    // as many pounds as there are items within queue.
    // the callback is just picking the last item not per se
    // the item we have just put within queue.
    this.pound(id);

  }

};

QueueManager.prototype.init = function(id) {
  if (!this.queues.hasOwnProperty(id)) {
    this.queues[id] = new Queue();
  }
};

QueueManager.prototype.unshift = function(id, p) {

  var queue = this.getQueue(id);
  queue.queue.unshift(p);

};

/**
 *
 * Pick an item from the queue.
 *
 * @param {id} id
 * @public
 */
QueueManager.prototype.pick = function(id) {
  if (this.hasQueue(id)) {
    return this.queues[id].queue.shift();
  }
};

/**
 *
 * Determine whether there is a queue for this link.
 *
 * @param {string} id
 * @public
 */
QueueManager.prototype.hasQueue = function(id) {
  return this.queues[id] && this.queues[id].queue.length > 0;
};

QueueManager.prototype.isManaged = function(id) {
  return this.queues.hasOwnProperty(id);
};

QueueManager.prototype.size = function(id) {
  return this.getQueue(id).queue.length;
};

/**
 *
 * Reset this queue manager
 *
 * @public
 */
QueueManager.prototype.reset = function(cb) {

  var self = this;
  var retries;
  var countdown;

  this._shutdown = true;

  // all unlocked
  this.unlockAll();

  countdown = retries = 10; // 1000;

  var func = function ShutdownQueManager() {

    if (countdown === 0) {
      debug('Failed to stop queue after %s cycles', retries);
    }

    if (self.inQueue === 0 || countdown === 0) {

      self.queues = {};

      self._shutdown = false;

      if (cb) {
        cb();
      }

    }
    else {

      countdown--;
      setTimeout(func, 0);

    }

  };

  // put ourselves at the back of all unlocks.
  setTimeout(func, 0);

};

QueueManager.prototype.isLocked = function(id) {
  // means whether it has queue length..
  if (!this.isManaged(id)) {
    return false;
  }
  var q = this.getQueue(id);
  return q.lock;
};

QueueManager.prototype.lock = function(id) {
  debug('%s: lock', id);
  this.init(id);
  var q = this.getQueue(id);
  q.lock = true;

};

QueueManager.prototype.flushAll = function() {
  debug('flush all');
  var id;
  for (id in this.queues) {
    if (this.queues.hasOwnProperty(id)) {
      this.flush(id);
    }
  }
};

QueueManager.prototype.purgeAll = function() {
  debug('purge all');
  var id;
  for (id in this.queues) {
    if (this.queues.hasOwnProperty(id)) {
      this.purge(this.queues[id]);
    }
  }
};

QueueManager.prototype.purge = function(q) {
  debug('%s: purge', q.id);
  while (q.queue.length) {
    this.drop('purge', q.queue.pop());
  }
};

QueueManager.prototype.unlockAll = function() {
  debug('unlock all');
  var id;
  for (id in this.queues) {
    if (this.queues.hasOwnProperty(id)) {
      this.unlock(id);
    }
  }
};

QueueManager.prototype.unlock = function(id) {
  debug('%s: unlock', id);
  if (this.isLocked(id)) {
    this.flush(id);
  }
};

QueueManager.prototype.flush = function(id) {

  debug('%s: flush', id);
  var i;
  var q = this.getQueue(id);

  // first determine current length
  var currentLength = (q.queue.length - q.pounders);

  q.lock = false;

  for (i = 0; i < currentLength; i++) {
    this.pound(id);
  }
};

// not sure, maybe make only the ioHandler responsible for this?
QueueManager.prototype.drop = function(type) {
  debug('dropping packet: %s %s', type, this.inQueue);
};

/**
 *
 * Used to get all queues which have queues.
 * Maybe I should just remove queues.
 * But queues reappear so quickly it's not
 * worth removing it.
 *
 * Something to fix later, in that case this.queues
 * would always be queues which have items.
 *
 * Anyway for debugging it's also much easier
 * because there will not be a zillion empty queues.
 *
 * Usage:
 *
 * if (qm.inQueue()) {
 *   var queued = qm.getQueued();
 * }
 *
 */
QueueManager.prototype.getQueues = function() {

  var id;
  var queued = {};
  for (id in this.queues) {
    if (this.queues.hasOwnProperty(id)) {
      if (this.queues[id].queue.length > 0) {
        queued[id] = this.queues[id];
      }
    }
  }
  return queued;
};

module.exports = QueueManager;

},{"debug":38,"util":7}],25:[function(require,module,exports){
'use strict';

var DefaultContextProvider = require('./context/defaultProvider');

/**
 *
 * We will run inside an instance.
 *
 * At the moment the run context is purely the callback.
 * TODO: which fails hard
 *
 */
function Run(actor, callback) {

  var iId;

  this.actor = actor;

  // Used with callback handling
  // Keeps track of the number of exposed output ports
  this.outputPorts = [];

  // data we will give to the callback
  this.output = {};
  this.outputCount = 0;

  this.callback = callback;

  if (!actor.contextProvider) {
    actor.contextProvider = new DefaultContextProvider();
  }

  for (iId in actor.nodes) {
    if (actor.nodes.hasOwnProperty(iId)) {

      // Als deze node in onze view zit
      if (actor.view.indexOf(iId) >= 0) {

        if (
          this.callback &&
          actor.nodes[iId].ports &&
          actor.nodes[iId].ports.output
          ) {

          for (var key in actor.nodes[iId].ports.output) {
            // this is related to actions.
            // not sure If I want to keep that..
            // Anyway expose is gone, so this is never
            // called now.
            //
            // expose bestaat niet meer, de integrerende flow
            // krijgt gewoon de poorten nu.
            if (actor.nodes[iId].ports.output[key].expose) {
              this.outputPorts.push(key);
            }
          }

          actor.nodes[iId].on(
            'output',
            this.handleOutput.bind(this)
          );

        }
      }

    }

  }

  if (this.callback && !this.outputPorts.length) {

    throw new Error('No exposed output ports available for callback');

  }

  if (actor.trigger) {
    actor.sendIIP(actor.trigger, '');
  }

}

Run.prototype.handleOutput = function(data) {

  if (this.outputPorts.indexOf(data.port) >= 0) {

    if (!this.output.hasOwnProperty(data.node.id)) {
      this.output[data.node.id] = {};
    }

    this.output[data.node.id][data.port] = data.out;

    this.outputCount++;

    if (this.outputPorts.length === this.outputCount) {

      this.outputCount = 0; // reset

      this.callback.apply(this.actor, [this.output]);

      this.output = {};

    }

  }

};

module.exports = Run;

},{"./context/defaultProvider":11}],26:[function(require,module,exports){
(function (process,global){
'use strict';

var IOBox = require('iobox');
var util = require('util');
var path = require('path');

// taken from underscore.string.js
function _underscored(str) {
  // also underscore dot
  return str
    .replace(/([a-z\d])([A-Z]+)/g, '$1_$2')
    .replace(/[\.\-\s]+/g, '_')
    .toLowerCase();
}

/**
 *
 * NodeBox
 *
 * @constructor
 * @public
 *
 */
function NodeBox(name) {

  if (!(this instanceof NodeBox)) {
    return new NodeBox(name);
  }

  IOBox.apply(this, arguments);

  this.name = name || 'NodeBox';

  this.define();

}

util.inherits(NodeBox, IOBox);

NodeBox.prototype.define = function() {

  // Define the structure
  this.addArg('input', {});
  this.addArg('output', {});
  this.addArg('state', {});
  this.addArg('done', null);
  this.addArg('cb', null);
  //this.addArg('console', console);

  this.addArg('on', {
    input: {}
  }); // dynamic construction

  // what to return from the function
  this.addReturn('output');
  this.addReturn('state');
  this.addReturn('on');
};

/**
 *
 * Add requires to the sandbox.
 *
 * xNode should use check = true and then have
 * a try catch block.
 *
 * @param {Object} requires
 * @param {Boolean} check
 */
NodeBox.prototype.require = function(requires, check) {

  // Ok, the generic sandbox should do the same logic
  // for adding the requires but should not check if
  // they are available.
  var key;
  var ukey;

  // 'myrequire': '<version'
  for (key in requires) {

    if (requires.hasOwnProperty(key)) {

      // only take last part e.g. chix-flow/SomeThing-> some_thing
      ukey = _underscored(key.split('/').pop());

      this.emit('require', {
        require: key
      });

      if (check !== false) {

        if (typeof requires[key] !== 'string') {

          // assume it's already required.
          // the npm installed versions use this.
          // e.g. nodule-template
          this.addArg(ukey, requires[key]);

        }
        else {

          try {

            this.addArg(ukey, require(key));

          }
          catch (e) {

            // last resort, used by cli
            var p = path.resolve(
              process.cwd(),
              'node_modules',
              key
            );

            this.addArg(ukey, require(p));
          }

        }

      }
      else {

        // just register it, used for generate
        this.addArg(ukey, undefined);

      }
    }
  }
};

NodeBox.prototype.expose = function(expose, CHI) {

  var i;
  // created to allow window to be exposed to a node.
  // only meant to be used for dom nodes.
  var g = typeof window === 'undefined' ? global : window;

  if (expose) {

    for (i = 0; i < expose.length; i++) {

      this.emit('expose', {
        expose: expose[i]
      });

      if (expose[i] === 'window') {
        this.addArg('win', window);
      }
      else if (expose[i] === 'chi') {
        this.addArg('chi', CHI);
      }
      else if (expose[i] === 'self') {
        this.addArg('self', this);
      }
      else {
        // Do not re-expose anything already going in
        if (!this.args.hasOwnProperty(expose[i])) {
          this.addArg(expose[i], g[expose[i]]);
        }
      }
    }

  }
};

NodeBox.prototype.compile = function(fn) {

  return IOBox.prototype.compile.call(
    this, fn, true // return as object
  );

};

/**
 *
 * Runs the sandbox.
 *
 */
NodeBox.prototype.run = function(bind) {

  var k;
  var res = IOBox.prototype.run.apply(this, [bind]);
  var ret;

  // puts the result back into our args/state
  // TODO: I do not think this is needed?

  for (k in res) {
    if (k === 'return') {
      ret = res['return'];
    }
    else if (res.hasOwnProperty(k)) {
      this.set(k, res[k]);
    }
  }
  return ret; // original return value
};

module.exports = NodeBox;

}).call(this,require("uojqOp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"iobox":42,"path":4,"uojqOp":5,"util":7}],27:[function(require,module,exports){
'use strict';

var NodeBox = require('./node');
var util = require('util');

/**
 *
 * PortBox
 *
 * @constructor
 * @public
 *
 */
function PortBox(name) {

  if (!(this instanceof PortBox)) {
    return new PortBox(name);
  }

  NodeBox.apply(this, arguments);

  this.name = name || 'PortBox';

}

util.inherits(PortBox, NodeBox);

PortBox.prototype.define = function() {
  // Define the structure
  this.addArg('data', null);
  this.addArg('x', {}); // not sure, _is_ used but set later
  this.addArg('source', null); // not sure..
  this.addArg('state', {});
  this.addArg('input', {});
  this.addArg('output', null); // output function should be set manually

  // what to return from the function.
  this.addReturn('state');
};

module.exports = PortBox;

},{"./node":26,"util":7}],28:[function(require,module,exports){
'use strict';

var util = require('util');
var EventEmitter = require('events').EventEmitter;

/**
 *
 * Setting
 *
 * Both used by Connector and xLink
 *
 * @constructor
 * @public
 *
 */
function Setting(settings) {

  for (var key in settings) {
    if (settings.hasOwnProperty(key)) {
      this.set(key, settings[key]);
    }
  }
}

util.inherits(Setting, EventEmitter);

/**
 *
 * Set
 *
 * Sets a setting
 *
 * @param {String} name
 * @param {Any} val
 */
Setting.prototype.set = function(name, val) {
  if (undefined !== val) {
    if (!this.setting) {
      this.setting = {};
    }
    this.setting[name] = val;

    this.emit('change', this, 'setting', this.setting);
  }
};

/**
 *
 * Get
 *
 * Returns the setting or undefined.
 *
 * @returns {Any}
 */
Setting.prototype.get = function(name) {
  return this.setting ? this.setting[name] : undefined;
};

/**
 *
 * Delete a setting
 *
 * @returns {Any}
 */
Setting.prototype.del = function(name) {
  if (this.setting && this.setting.hasOwnProperty(name)) {
    delete this.setting[name];
  }
};

/**
 *
 * Check whether a setting is set.
 *
 * @returns {Any}
 */
Setting.prototype.has = function(name) {
  return this.setting && this.setting.hasOwnProperty(name);
};

module.exports = Setting;

},{"events":2,"util":7}],29:[function(require,module,exports){
'use strict';

var jsongate = require('json-gate');
var mSjson = require('../schemas/map.json');
var nDjson = require('../schemas/node.json');
var ljson = require('../schemas/link.json');
var mapSchema = jsongate.createSchema(mSjson);
var nodeSchema = jsongate.createSchema(nDjson);
var linkSchema = jsongate.createSchema(ljson);
var isPlainObject = require('is-plain-object');
var instanceOf = require('instance-of');

function ValidationError(message, id, obj) {
  this.message = message;
  this.id = id;
  this.obj = obj;
  this.name = 'ValidationError';
}

/**
 *
 * Check if we are not adding a (rotten) flow. Where there are id's which
 * overlap other ids in other flows.
 *
 * This shouldn't happen but just perform this check always.
 *
 */
function _checkIds(flow, nodeDefinitions) {

  var i;
  var knownIds = [];
  var nodes = {};
  var node;
  var link;
  var source;
  var target;

  if (flow.nodes.length > 0 && !nodeDefinitions) {
    throw new Error('Cannot validate without nodeDefinitions');
  }

  // we will not add the flow, we will show a warning and stop adding the
  // flow.
  for (i = 0; i < flow.nodes.length; i++) {

    node = flow.nodes[i];

    // nodeDefinition should be loaded
    if (!node.ns) {
      throw new ValidationError(
          'NodeDefinition without namespace: ' + node.name
          );
    }
    if (!nodeDefinitions[node.ns]) {
      throw new ValidationError(
          'Cannot find nodeDefinition namespace: ' + node.ns
          );
    }
    if (!nodeDefinitions[node.ns][node.name]) {
      throw new ValidationError(
          'Cannot find nodeDefinition name ' + node.ns + ' ' + node.name
          );
    }

    knownIds.push(node.id);
    nodes[node.id] = node;

    //_checkPortDefinitions(nodeDefinitions[node.ns][node.name]);
  }

  for (i = 0; i < flow.links.length; i++) {

    link = flow.links[i];

    // links should not point to non-existing nodes.
    if (knownIds.indexOf(link.source.id) === -1) {
      throw new ValidationError(
        'Source node does not exist ' + link.source.id
      );
    }
    if (knownIds.indexOf(link.target.id) === -1) {
      throw new ValidationError(
        'Target node does not exist ' + link.target.id
      );
    }

    // check if what is specified as port.out is an input port on the target
    source = nodes[link.source.id];
    target = nodes[link.target.id];

    // allow :start
    if (link.source.port[0] !== ':' &&
        !nodeDefinitions[source.ns][source.name]
        .ports.output[link.source.port]) {
      throw new ValidationError([
          'Process',
          link.source.id,
          'has no output port named',
          link.source.port,
          '\n\n\tOutput ports available:',
          '\n\n\t',
          Object.keys(
            nodeDefinitions[source.ns][source.name].ports.output
            ).join(', ')
          ].join(' '));
    }

    if (link.target.port[0] !== ':' &&
        !nodeDefinitions[target.ns][target.name]
        .ports.input[link.target.port]) {
      throw new ValidationError([
          'Process',
          link.target.id,
          'has no input port named',
          link.target.port,
          '\n\n\tInput ports available:',
          '\n\n\t',
          Object.keys(
            nodeDefinitions[target.ns][target.name].ports.input
            ).join(', ')
          ].join(' '));
    }

  }

  return true;

}

/**
 *
 * Validates a nodeDefinition
 *
 */
function validateNodeDefinition(nodeDef) {

  nodeSchema.validate(nodeDef);

  // _checkIds(flow, nodeDefinitions);

  // make sure the id's are correct

}

function validateLink(ln) {
  linkSchema.validate(ln);
}

/**
 *
 * Validates the flow
 *
 */
function validateFlow(flow) {

  mapSchema.validate(flow);

  // _checkIds(flow, nodeDefinitions);

  // make sure the id's are correct

}

function validateData(type, data) {

  switch (type) {

    case 'string':
      return typeof data === 'string';

    case 'array':
      return Object.prototype.toString.call(data) === '[object Array]';

    case 'integer':
    case 'number':
      return Object.prototype.toString.call(data) === '[object Number]';

    case 'null':
      type = type.charAt(0).toUpperCase() + type.slice(1);
      return Object.prototype.toString.call(data) === '[object ' + type + ']';

    case 'boolean':
    case 'bool':
      return data === true || data === false || data === 0 || data === 1;

    case 'any':
      return true;
    case 'object':
      if (isPlainObject(data)) {
        return true;
      }
      // TODO: not sure if I meant to return all objects as valid objects.
      return instanceOf(data, type);
    case 'function':
      return true;

    default:
      return instanceOf(data, type);
  }

}

module.exports = {
  data: validateData,
  flow: validateFlow,
  link: validateLink,
  nodeDefinition: validateNodeDefinition,
  nodeDefinitions: _checkIds
};

},{"../schemas/link.json":51,"../schemas/map.json":52,"../schemas/node.json":53,"instance-of":41,"is-plain-object":43,"json-gate":46}],"chix-flow":[function(require,module,exports){
module.exports=require('jXAsbI');
},{}],"jXAsbI":[function(require,module,exports){
'use strict';

var xNode = require('./lib/node');
var xFlow = require('./lib/flow');
var xLink = require('./lib/link');
var Actor = require('./lib/actor');
var mapSchema = require('./schemas/map.json');
var nodeSchema = require('./schemas/node.json');
var stageSchema = require('./schemas/stage.json');
var Validate = require('./lib/validate');

module.exports = {
  Node: xNode,
  Flow: xFlow,
  Link: xLink,
  Actor: Actor,
  Validate: Validate,
  Schema: {
    Map: mapSchema,
    Node: nodeSchema,
    Stage: stageSchema
  }
};

},{"./lib/actor":9,"./lib/flow":12,"./lib/link":15,"./lib/node":17,"./lib/validate":29,"./schemas/map.json":52,"./schemas/node.json":53,"./schemas/stage.json":54}],32:[function(require,module,exports){
'use strict';

var util         = require('util');
var Store        = require('./store');
var Group        = require('./group');
var PortSyncer   = require('./portSyncer');
var PortPointer  = require('./portPointer');
var EventEmitter = require('events').EventEmitter;

function CHI() {

  if (!(this instanceof CHI)) return new CHI();

  this.groups   = new Store(); // for groups
  this.pointers = new Store(); // for 'pointers'
  this._sync    = new Store(); // for 'syncing'

  this.queue = {};
}

util.inherits(CHI, EventEmitter);

/**
 *
 * Creates a new group/collection
 *
 */
CHI.prototype.group = function(port, cb) {
  // Generates new groupID
  var g = new Group(port, cb);

  this.groups.set(g.gid(), g);
  this.emit('begingroup', g);

  return g;
};

/**
 *
 * Simple way to give a unique common id to the data
 * at the output ports which want to be synced later on.
 *
 *  *in indicates we want to take along the common id of
 *  the other ports also pointing to the process.
 *
 *  Later this can be used with input ports that have
 *  been set to `sync` with the output originating from
 *  a process they specify.
 *
 * @param {String} nodeId
 * @param {String} port      The current port
 * @param {Object} chi
 * @param {Array}  syncPorts Array of port names to sync
 */
CHI.prototype.pointer = function(sourceId, port, p, identifier) {

  if(p.chi.hasOwnProperty(sourceId)) {
    return;
    /*
    throw new Error(
      'item already set'
    );
    */
  }

  var pp = this.pointers.get(sourceId);

  if(!pp) {
    pp = new PortPointer(identifier);
    this.pointers.set(sourceId, pp);
  }

  // will give the correct id, based on the ports queue
  var itemId = pp.add(port);

  // send along with the chi.
  // note: is within the same space as the groups.
  //
  // The packet now remembers the item id given by this node.
  // The Port Pointer which is created per node, stores this
  // item id.
  //
  // The only job of the PortPointer is assigning unique
  // itemIds, ids which are incremented.
  //
  // Then this.pointers keeps track of these PortPointers
  // per node.
  //
  // So what we end up with is a node tagging each and every
  // node who wanted a pointer and keeping track of
  // what ids were assigned. The collection name *is* a PortPointer
  //
  // Then now, how is the match then actually made?
  //
  // Ah... going different routes, that what this was about.
  // The origin is *one* output event *one* item.
  //
  // Then traveling different paths we ask for port sync.
  //
  // This sync is then based on this id, there became different
  // packets carrying this same item id.
  //
  // So probably the problem is cloning, I just have send
  // the chi along and copied that, so everywhere where that's
  // taking place a clone should take place.
  //
  // If I'll look at how sync works, there is probably
  // not a lot which could go wrong. it's the cloning not taking
  // place. I think something get's overwritten constantly.
  // ending up with the last `contents`
  //
  // De packet data keeps changing which is ok, but the chi
  // changes along with it or something.
  p.chi[sourceId] = itemId;

};

CHI.prototype.sync = function(link, originId, p, syncPorts) {

  var ps = this._sync.get(link.target.pid);
  if(!ps) {
    ps = new PortSyncer(originId, syncPorts);
    this._sync.set(link.target.pid, ps);
  }

  //var ret = ps.add(link, data, chi);
  //
  // This returns whatever is synced
  // And somehow this doesn't give us correct syncing.
  var ret = ps.add(link, p);
  if(ret !== undefined) {
    // what do we get returned?
    this.emit('synced', link.target.pid, ret);
  }

  // chi, need not be removed it could be re-used.
};

//CHI.prototype.collect = function(link, output, chi) {
CHI.prototype.collect = function(link, p) {

  var idx, mx = -1, self = this;

  // ok this is actually hard to determine.
  for(var gid in p.chi) {
    if(p.chi.hasOwnProperty(gid)) {
      // determine last group
      idx = this.groups.order.indexOf(gid);
      mx = idx > mx ? idx : mx;
    }
  }

  if(mx === -1) {
    throw Error('Could not match group');
  }

  gid = this.groups.order[mx];

  if(!this.queue.hasOwnProperty(link.ioid)) {
    this.queue[link.ioid] = {};
  }

  if(!Array.isArray(this.queue[link.ioid][gid])) {
    this.queue[link.ioid][gid] = [];
    this.groups.get(gid).on('complete', function() {
      //self.readySend(link, gid, chi);
      self.readySend(link, gid, p);
    });
  }

  // only push the data, last packet is re-used
  // to write the data back.
  this.queue[link.ioid][gid].push(p.data);

  //this.readySend(link, gid, chi);
  this.readySend(link, gid, p);

};

// TODO: should not work on link here..
//CHI.prototype.readySend = function(link, gid, chi) {
CHI.prototype.readySend = function(link, gid, p) {

  // get group
  var group = this.groups.get(gid);

  if(
     // if group is complete
     group.complete &&
     // if queue length matches the group length
     this.queue[link.ioid][gid].length === group.length
     ) {

    // Important: group seizes to exist for _this_ path.
    delete p.chi[gid];

    // Reusing last collected packet to write the group data
    p.write(this.queue[link.ioid][gid]);
    link.write(p);

    // reset
    this.queue[link.ioid][gid] = [];

    /* Not sure..
      delete output.chi[gid];        // remove it for our requester
      // group still exists for other paths.
      delete this.store[gid];        // remove from the store
      this.groupOrder.splice(mx, 1); // remove from the groupOrder.
    */
  }

};

// TODO: could just accept a packet and merge it.
CHI.prototype.merge = function (newChi, oldChi, unique) {

  // nothing to merge
  if(Object.keys(oldChi).length) {

    for(var c in oldChi) {
      if(oldChi.hasOwnProperty(c)) {

        if(newChi.hasOwnProperty(c) &&
          newChi[c] !== oldChi[c]
          ) {

          // problem here is, you are overwriting itemId's
          // Test, not sure if this should never happen.
          // When we merge that *is* what is happening no?
          if(unique) {
            throw new Error('refuse to overwrite chi item');
          }
        } else {
          newChi[c] = oldChi[c];
        }
      }
    }
  }
};

module.exports = CHI;

},{"./group":33,"./portPointer":34,"./portSyncer":35,"./store":36,"events":2,"util":7}],33:[function(require,module,exports){
'use strict';

var util = require('util'),
  uuid = require('uuid').v4,
  EventEmitter = require('events').EventEmitter;

/**
 *
 * Simple grouping.
 *
 * Group can be used from within blackbox.
 *
 * Or is used during cyclic and collect mode.
 *
 * During cyclic mode it can be considered virtual grouping.
 *
 * The virtual group will be recollected during collect mode.
 *
 * For now this will be simple, there can only be one collector
 * and the group will seize too exists once it's collected.
 *
 */
function Group(port, cb) {
  if(arguments.length !== 2) {
    throw new Error('Not enough arguments');
  }

  // these are undefined in virtual mode
  this.cb = cb;
  this.port = port;

  var prefix = 'gid-';
  prefix    += port ? port : '';

  this.info = {
    gid: Group.gid(prefix + '-'),
    complete: false,
    items: []
  };

  Object.defineProperty(this, 'length', {
    get: function() {
      return this.info.items.length;
    }
  });

  Object.defineProperty(this, 'complete', {
    get: function() {
      return this.info.complete;
    }
  });

  /**
   *
   * Used to collect incomming data.
   * Until everything from this group is received.
   *
   */
  this.store = [];

  // send out the group info
  // Ok this will not work with the virtual ones
  // there is no port to send to.
  this.send();
}

util.inherits(Group, EventEmitter);

// allow (tests) to overwrite them
Group.gid    = function(prefix) { return prefix + uuid(); };
Group.itemId = uuid;

/**
 *
 * Generates a new itemId and returns
 * The group and itemId
 *
 * Used like this:
 *
 *  cb({
 *    match: match
 *  }, g.item());
 *
 * The item id is send across 'the wire' and we
 * maintain the total group info overhere.
 *
 * [<gid>] = itemId
 * [<gid>] = itemId
 *
 * Which is a bit too magical, so that must change.
 *
 */
Group.prototype.item = function(obj) {

  // auto merging, could be a bit risky
  // no idea if item is ever called without obj?
  obj = obj || {};
  if(obj.hasOwnProperty(this.info.gid)) {
    throw Error('Object is already within group');
  }

  var id = Group.itemId();

  // This is an ordered array
  this.info.items.push(id);

  obj[this.info.gid] = id;
  return obj;
};

/**
 *
 *
 */
Group.prototype.collect = function(packet) {

  this.store.push(packet);

};

Group.prototype.done = function() {
  // ok, now the send should take place.
  // so this triggers the whole output handling
  // of the node, which is what we want.
  // this is the asyncOutput btw..
  this.info.complete = true;
  // check here if something want's this group.
  // or just emit to CHI and let that class check it.
  this.send();

  this.emit('complete', this);

};

// TODO: remove done..
Group.prototype.end = Group.prototype.done;

/***
 *
 * Sends the output using the callback of the
 * node who requested the group.
 *
 * In case of grouping during cyclic mode, for now,
 * there is nothing to send to. In which case
 * the callback is empty.
 *
 */
Group.prototype.send = function() {

  // only send out if we have a callback.
  if(this.cb) {
    var out = {};
    out[this.port] = {
      gid: this.info.gid,
      complete: !!this.info.complete, // loose reference
      items: this.info.items
    };
    this.cb(out);
  }

};

Group.prototype.items = function() {
  return this.info.items;
};

Group.prototype.gid = function() {
  return this.info.gid;
};

module.exports = Group;

},{"events":2,"util":7,"uuid":50}],34:[function(require,module,exports){
'use strict';

var uuid = require('uuid').v4;

/**
 *
 * The PortPointer initializes
 * each source with the same unique
 * itemId.
 *
 * These are then increased per port.
 * So their id's stay in sync.
 *
 * This does give the restriction both
 * ports should give an equal amount of output.
 *
 * Which is err. pretty errorprone :-)
 * Or at least it depends per node, whether it is.
 */
function PortPointer(identifier) {

  // little more unique than just a number.
  this.id = PortPointer.uid(identifier ? identifier + '-' : '');

  // the idea of this counter is increment
  this.counter = 0;

  //this.cols = cols;

  this.store = {};
}

PortPointer.uid = function(prefix) {
  return prefix + uuid().split('-')[0];
};

/**
 *
 * Should take care of having what come out of the ports
 * have the correct same id's
 *
 */
PortPointer.prototype.add = function(port) {

  if(!this.store.hasOwnProperty(port)) {
    this.store[port] = [this.counter];
  }

  // not just taking store[port].length, don't want to reset during flush
  var nr = this.store[port][this.store[port].length - 1];
  this.store[port].push(++nr);

  // At some point we actually do not care about the id's anymore.
  // that's when all ports have the same id. fix that later.

  return this.id + '-' + nr;

};

module.exports = PortPointer;

},{"uuid":50}],35:[function(require,module,exports){
'use strict';

////
//
// Ok a syncArray is made per nodeId.
// So this is with that scope.
//
// chi: {
//   <nodeId>: <uuid>
// }
//
// We keep on serving as a gate for the
// synced ports here.
//
function PortSyncer(originId, syncPorts) {

  this.syncPorts = syncPorts;
  this.originId  = originId;

  this.store = {};

}

/**
 *
 * Should take care of having what come out of the ports
 * have the correct same id's
 *
 * If we send the data, we can remove it from our store..
 *
 */
//PortSyncer.prototype.add = function(link, data, chi) {
PortSyncer.prototype.add = function(link, p) {

  if(!p.chi.hasOwnProperty(this.originId)) {
    // that's a fail
    throw new Error([
      'Origin Node',
      this.originId,
      'not found within chi'
    ].join(' '));

  }

  if(this.syncPorts.indexOf(link.target.port) === -1) {
    throw new Error([
      'Refuse to handle data for unknown port:',
      link.target.port
      ].join('')
    );
  }

  // <originId>: <itemId>
  // Read back the item id the PortPointer for this node gave us
  var itemId = p.chi[this.originId];

  // if there is no store yet for this item id, create one
  if(!this.store.hasOwnProperty(itemId)) {
    // Create an object for the sync group
    // To contain the data per port.
    this.store[itemId] = {};
  }

  // store this port's data.
  this.store[itemId][link.target.port] = { link: link, p: p };

  // Ok the case of pointing twice with a port
  // using several links is not covered yet..

  // if we have synced all ports, both have added their data
  // then we are ready to send it back.
  // This is done by CHI.sync based on what is returned here.
  // So.. THE reason why we get wrong merged content can only
  // be if some `chi` has stored the wrong item id.
  // And this can only happen, during merging.
  // However merging does this check, so it does not happen
  // during CHI.merge. If it doesn't happen during CHI.merge
  // We have reference somewhere, where there shouldn't be
  // a reference. we re-use a packet.
  // Nice, so where does that take place.
  // and how to prevent it. at least where itemid is set
  // there should be a check whether it's already set.
  if(Object.keys(this.store[itemId]).length === this.syncPorts.length) {

    // return { in1: <data>, in2: <data> }
    // the synced stuff.
    var dat = this.store[itemId];

    // we will never see this itemId again
    delete this.store[itemId];

    return dat;

  } else {

    // not ready yet.
    return undefined;
  }

};

module.exports = PortSyncer;

},{}],36:[function(require,module,exports){
'use strict';

function Store() {
  this.store = {};
  this.order = [];

  Object.defineProperty(this, 'length', {
    get: function() {
      return this.order.length;
    }
  });
}

Store.prototype.set = function(id, obj) {
  this.store[id] = obj;
  this.order.push(id);
};

Store.prototype.get = function(id) {
  return this.store[id];
};

Store.prototype.del = function(id) {
  this.order.splice(this.order.indexOf(id), 1);
  delete this.store[id];
};

Store.prototype.items = function() {
  return this.store;
};

Store.prototype.pop = function() {
  var id  = this.order.pop();
  var ret = this.store[id];
  delete this.store[id];
  return ret;
};

Store.prototype.shift = function() {
  var id  = this.order.shift();
  var ret = this.store[id];
  delete this.store[id];
  return ret;
};

Store.prototype.isEmpty = function() {
  return Object.keys(this.store).length === 0 &&
    this.order.length === 0;
};

module.exports = Store;

},{}],37:[function(require,module,exports){
'use strict';

var EventEmitter = require('events').EventEmitter;
var util = require('util');

/**
 *
 * Loader
 *
 * This is the base loader class
 * Ít can be used to implement a definition loader
 * for Chix
 *
 * @api public
 * @author Rob Halff <rob.halff@gmail.com>
 * @constructor
 */
function Loader() {

  this.dependencies = {};

  /**
   *
   * Format:
   *
   * Keeps track of all known nodeDefinitions.
   *
   * {
   *  'http://....': { // url in this case is the identifier
   *
   *    fs: {
   *       readFile:  <definition>
   *       writeFile: <definition>
   *    }
   *
   *  }
   *
   * }
   *
   */
  this.nodeDefinitions = {};

}

util.inherits(Loader, EventEmitter);

/**
 *
 * This is the main method all child classes should implement.
 *
 * @param {Object} graphs
 * @param {Function} callback
 * @api public
 */
Loader.prototype.load = function(graphs, callback /*, update dependencies*/) {

  return callback(
    new Error([
      this.constructor.name,
      'must implement a load method'
    ].join(' ')
    )
  );

};

/**
 *
 * Add node definitions
 *
 * Used to `statically` add nodeDefinitions.
 *
 * @param {String} identifier
 * @param {Object} nodeDefs
 * @api public
 */
Loader.prototype.addNodeDefinitions = function(identifier, nodeDefs) {

  var ns;
  var name;
  var i;

  if (Array.isArray(nodeDefs)) {

    for (i = 0; i < nodeDefs.length; i++) {
      this.addNodeDefinition(identifier, nodeDefs[i]);
    }

  } else {

    for (ns in nodeDefs) {
      if (nodeDefs.hasOwnProperty(ns)) {
        for (name in nodeDefs[ns]) {
          if (nodeDefs[ns].hasOwnProperty(name)) {
            this.addNodeDefinition(identifier, nodeDefs[ns][name]);
          }
        }
      }
    }

  }
};

/**
 *
 * Add a node definition
 *
 * @param {String} identifier
 * @param {Object} nodeDef
 * @api public
 */
Loader.prototype.addNodeDefinition = function(identifier, nodeDef) {

  if (!nodeDef.hasOwnProperty('ns')) {
    throw new Error([
      'Nodefinition for',
      identifier,
      'lacks an ns property'
    ].join(' '));
  }

  if (!nodeDef.hasOwnProperty('name')) {
    throw new Error([
      'Nodefinition for',
      identifier,
      'lacks an name property'
    ].join(' '));
  }

  // store the provider url along with the nodeDefinition
  // Needed for fetching back from storage.
  nodeDef.provider = identifier;

  if (nodeDef.type !== 'flow') {

    // Do normal nodeDefinition stuff
    this.dependencies = this._parseDependencies(this.dependencies, nodeDef);

  } else {
    // also setting default provider here?
    // check this later, if addNodeDefinition(s) is used
    // there will otherwise be no default provider.
    // where is default provider, in chix-loader-remote.. err..
    // I think addNodefinition(s) should set it maybe
    // It's also a bit weird, because if you only add them manually
    // there ain't really an url or path.
    if (!nodeDef.providers || Object.keys(nodeDef.providers).length === 0) {
      nodeDef.providers = {
        '@': {
          url: identifier
        }
      };
    }
  }

  if (!this.nodeDefinitions.hasOwnProperty(identifier)) {
    this.nodeDefinitions[identifier] = {};
  }

  if (!this.nodeDefinitions[identifier].hasOwnProperty(nodeDef.ns)) {
    this.nodeDefinitions[identifier][nodeDef.ns] = {};
  }

  if (!this.nodeDefinitions[identifier][nodeDef.ns]
    .hasOwnProperty([nodeDef.name])) {
    this.nodeDefinitions[identifier][nodeDef.ns][nodeDef.name] = nodeDef;
  }

};

Loader.prototype._parseDependencies = function(dependencies, nodeDef) {
  var r;
  var type;

  if (nodeDef.require) {
    throw Error(
      nodeDef.ns + '/' + nodeDef.name +
      ': nodeDef.require is DEPRECATED, use nodeDef.dependencies'
    );
  }

  if (nodeDef.dependencies) {
    for (type in nodeDef.dependencies) {
      if (nodeDef.dependencies.hasOwnProperty(type)) {

        for (r in nodeDef.dependencies[type]) {

          if (nodeDef.dependencies[type].hasOwnProperty(r)) {

            if (type === 'npm') {
              if (nodeDef.dependencies.npm[r] !== 'builtin') {
                // translate to require string, bower should do the same
                //
                // I think this should be delayed, to when the actual
                // require takes place.
                /*
                requireString = r + '@' + nodeDef.dependencies.npm[r];
                if (requires.indexOf(requireString) === -1) {
                  requires.push(requireString);
                }
                */
                if (!dependencies.hasOwnProperty('npm')) {
                  dependencies.npm = {};
                }

                // TODO: check for duplicates and pick the latest one.
                dependencies.npm[r] = nodeDef.dependencies.npm[r];

              }
            } else if (type === 'bower') {

              if (!dependencies.hasOwnProperty('bower')) {
                dependencies.bower = {};
              }

              // TODO: check for duplicates and pick the latest one.
              dependencies.bower[r] = nodeDef.dependencies.bower[r];

            } else {

              throw Error('Unkown package manager:' + type);

            }

          }

        }

      }
    }
  }
  return dependencies;
};

Loader.prototype.saveNodeDefinition = function() {

  throw new Error([
    this.constructor.name,
    'must implement a save method'
  ].join(' '));

};

/**
 *
 * Ok now it becomes intresting.
 *
 * We will read the definition and are going to detect whether this
 * definition is about a flow, if it is about a flow.
 * We are also going to load those definitions, unless we already
 * have that definition ofcourse.
 *
 * This way we only have to provide the actor with ourselves.
 * The loader. The loader will then already know about all the
 * node definitions it needs. This keeps the actor simpler.
 * All it has to do is .getNodeDefinition() wherever in
 * the hierarchy it is.
 *
 */

/**
 *
 * Check whether we have the definition
 *
 * @param {String} providerUrl
 * @param {String} ns
 * @param {String} name
 * @api public
 */
Loader.prototype.hasNodeDefinition = function(providerUrl, ns, name) {
  return this.nodeDefinitions.hasOwnProperty(providerUrl) &&
    this.nodeDefinitions[providerUrl].hasOwnProperty(ns) &&
    this.nodeDefinitions[providerUrl][ns].hasOwnProperty(name);

};

/**
 *
 * Easier method to just get an already loaded definition
 * TODO: Unrafel getNodeDefinition and make it simpler
 *
 * Anyway, this is the way, we do not want to keep a store of id's
 * in the loader also, so getById can go also.
 */
Loader.prototype.getNodeDefinitionFrom = function(provider, ns, name) {

  if (this.hasNodeDefinition(provider, ns, name)) {
    return this.nodeDefinitions[provider][ns][name];
  }

};

/**
 *
 * Loads the NodeDefinition for a node.
 *
 * In order to do so each node must know the provider url
 * it was loaded from.
 *
 * This is normally not stored directly into flows,
 * but the flow is saved with the namespaces in used.
 *
 * TODO: this really should just be (provider, name, ns, version)
 * Else use the load method.
 *
 * ah this is the exact same as loadDefnition only without callback.
 *
 */
Loader.prototype.getNodeDefinition = function(node, map) {

  var def = this.loadNodeDefinition(node, map);

  // merge the schema of the internal node.
  if (node.type === 'flow') {
    this._mergeSchema(def); // in place
  }

  return def;

};

// this is still the map so nodes are an array
// saves us from having to maintain a nodes list.
// making this mergeSchema more self-reliant
Loader.prototype.findNodeWithinGraph = function(nodeId, graph) {

  for (var i = 0; i < graph.nodes.length; i++) {
    if (nodeId === graph.nodes[i].id) {
      // ok that's the node, but still it needs to be resolved
      // we need to get it's definition
      return graph.nodes[i];
    }
  }

  throw Error('Could not find internal node within graph');

};

Loader.prototype._mergeSchema = function(graph) {
  for (var type in graph.ports) {
    if (graph.ports.hasOwnProperty(type)) {
      for (var port in graph.ports[type]) {
        if (graph.ports[type].hasOwnProperty(port)) {
          var externalPort = graph.ports[type][port];
          if (externalPort.hasOwnProperty('nodeId')) {
            var internalDef = this.getNodeDefinition(
              this.findNodeWithinGraph(externalPort.nodeId, graph),
              graph
            );
            var copy    = JSON.parse(
              JSON.stringify(internalDef.ports[type][externalPort.name])
            );
            copy.title  = externalPort.title;
            copy.name   = externalPort.name;
            copy.nodeId = externalPort.nodeId;
            graph.ports[type][port] = copy;
          } else {
            // not pointing to an internal node. :start etc.
          }
        }
      }
    }
  }
};

/***
 *
 * Recursivly returns the requires.
 *
 * Assumes the map, node is already loaded.
 *
 * Note: Will break if node.provider is an url already.
 *
 * @private
 */
Loader.prototype._collectDependencies = function(dependencies, def) {

  var self = this;
  def.nodes.forEach(function(node) {
    var provider;

    // Just makes this a simple function, used in several locations.
    if (/:\/\//.test(node.provider)) {
      provider = node.provider;
    } else {
      var da = node.provider ? node.provider : '@';
      provider = def.providers[da].url || def.providers[da].path;
    }

    var nDef = self.nodeDefinitions[provider][node.ns][node.name];
    if (node.type === 'flow') {
      dependencies = self._collectDependencies(dependencies, nDef);
    } else {
      dependencies = self._parseDependencies(dependencies, nDef);
    }
  });

  return dependencies;

};

/**
 *
 * Get the dependencies for a certain provider.
 *
 * @param {Object} def
 * @private
 */
Loader.prototype._loadDependencies = function(def) {

  var dependencies = {};

  if (def.type === 'flow') {
    dependencies = this._collectDependencies(dependencies, def);
    return dependencies;
  } else {
    dependencies = this._parseDependencies(dependencies, def);
    return dependencies;
  }

};

// Loader itself only expects preloaded nodes.
// There is no actual load going on.
// Remote loader does implement loading.
Loader.prototype.loadNode = function(providerDef, cb) {

  var provider = providerDef.providerLocation;
  var ns       = providerDef.ns;
  var name     = providerDef.name;
  if (this.nodeDefinitions[provider] &&
    this.nodeDefinitions[provider].hasOwnProperty(ns) &&
    this.nodeDefinitions[provider][ns].hasOwnProperty(name)) {

    cb(null, {
      nodeDef: this.nodeDefinitions[provider][ns][name]
    });

  } else {

    cb(
      Error(
        util.format('Could not load node %s/%s from %s', ns, name, provider)
      )
    );

  }

};

Loader.prototype.loadNodeDefinitionFrom =
  function(provider, ns, name, callback) {

  var self = this;

  // I want cumulative dependencies.
  // Instead of only knowing all dependencies known
  // or only the dependency from the current node.
  // self.load could send this within the callback
  // and then also remember the dependency from this single node.
  // for self.load it's the second argument of the callback.
  var dependencies = {};

  this.loadNode({
    ns: ns,
    name: name,
    url: provider.replace('{ns}', ns).replace('{name}', name),
    providerLocation: provider
  }, function(err, res) {

    if (err) {
      throw err;
    }

    var nodeDef = res.nodeDef;
    // res.providerLocation

    dependencies = self._parseDependencies(dependencies, nodeDef);

    // quick hacking
    if (!self.nodeDefinitions[provider]) {
      self.nodeDefinitions[provider] = {};
    }
    if (!self.nodeDefinitions[provider].hasOwnProperty(ns)) {
      self.nodeDefinitions[provider][ns] = {};
    }
    self.nodeDefinitions[provider][ns][name] = nodeDef;

    if (nodeDef.type === 'flow') {

      self.load(nodeDef, function(/*err, ret*/) {
        callback(
          self.nodeDefinitions[provider][ns][name],
          self._loadDependencies(
            self.nodeDefinitions[provider][ns][name]
          )
        );
      }, false, dependencies);

    } else {
      callback(
        self.nodeDefinitions[provider][ns][name],
        self._loadDependencies(
          self.nodeDefinitions[provider][ns][name]
        )
      );
    }

  });

};

// Ok this, seems weird, it is loading the map?
// I give it a node which has either a provider as short key
// or the full url, the map is needed to resolve that.
// but then I start loading the full map.
// which seems weird, to say the least.
Loader.prototype.loadNodeDefinition = function(node, map, callback) {

  var location;
  var provider;
  var self = this;

  if (node.provider && node.provider.indexOf('://') >= 0) {
    // it's already an url
    location = node.provider;

  } else if (!node.provider && (!map || !map.providers)) {
    // for direct additions (only @ is possible)
    location = '@';

  } else {

    if (!map) {

      throw Error(
        'loadNodeDefinition needs a map or a node with a full provider url'
      );

    }

    if (node.provider) {
      // 'x': ..
      provider = map.providers[node.provider];
    } else {
      provider = map.providers['@'];
    }

    // fix: find provider by path or url, has to do with provider
    // already resolved (sub.sub.graphs)
    if (!provider) {
      for (var key in map.providers) {
        if (map.providers[key].url === node.provider ||
          map.providers[key].path === node.provider) {
          provider = map.providers[key];
        }
      }
      if (!provider) {
        throw Error('unable to find provider');
      }
    }

    if (provider.hasOwnProperty('path')) {

      location = provider.path;

    } else if (provider.hasOwnProperty('url')) {

      location = provider.url;

    } else {
      throw new Error('Do not know how to handle provider');
    }

    // Remember the provider, this is important to call getDefinition
    // at a later stage, see actor.addMap and createNode.
    // createNode is called without a map.
    // not perfect this, so redo this later.
    // when empty maps are added, createNode should also be
    // able to figure out where it's definitions are.
    // this means the map should be preloaded.
    // This preload should be done with an URL not with @
    // The along with that getNodeDefinitionFrom(providerUrl)
    // should be used. providerUrl is the only way subgraphs
    // are indexed correctly '@' by itself is not unique enough
    // to serve as a provider key. it is for single graphs but
    // is not useable anything beyond that.
    // Also however when a graph is saved the expanded
    // urls should be translated back into short form (fix that)
    // by looking up the provider within providers and putting
    // the key back where now the expanded url is.
    node.provider = location;

  }

  if (!this.nodeDefinitions.hasOwnProperty(location) ||
    !this.nodeDefinitions[location].hasOwnProperty(node.ns) ||
    !this.nodeDefinitions[location][node.ns].hasOwnProperty(node.name)) {

    if (!callback) {
      return false;
    } else {
      // not sure.. node has a full url.
      // but it's not loaded, then we ask to load the full map.
      // which works if provider is x but not if it's already expanded.
      //
      this.load(map, function() {
        callback(self.nodeDefinitions[location][node.ns][node.name]);
      });
    }

  } else {

    if (callback) {
      callback(this.nodeDefinitions[location][node.ns][node.name]);
    } else {
      return this.nodeDefinitions[location][node.ns][node.name];
    }

  }

};

/**
 *
 * Get dependencies for the type given.
 *
 * type is either `npm` or `bower`
 *
 * If no type is given will return all dependencies.
 *
 * Note: this method changed in behavior, used to be
 *  what _loadDependencies is now. which used to be getRequires()...
 *
 * @param {string} type
 * @public
 */
Loader.prototype.getDependencies = function(type) {
  if (type) {
    if (this.dependencies.hasOwnProperty(type)) {
      return this.dependencies[type];
    } else {
      return {};
    }
  } else {
    return this.dependencies;
  }
};

/**
 *
 * Checks whether there are any dependencies.
 *
 * Type can be `npm` or `bower`
 *
 * If no type is given it will tell whether there are *any* dependencies
 *
 * @param {string} type
 * @public
 **/
Loader.prototype.hasDependencies = function(type) {

  if (type) {
    if (this.dependencies.hasOwnProperty(type)) {
      return Object.keys(this.dependencies[type]).length;
    }
  } else {
    for (type in this.dependencies) {
      if (this.dependencies.hasOwnProperty(type)) {
        if (this.hasDependencies(type)) {
          return true;
        }
      }
    }
  }
  return false;
};

/**
 *
 * Get Nodedefinitions
 *
 * Optionally with a provider url so it returns only the node definitions
 * at that provider.
 *
 * @param {String} provider (Optional)
 */
Loader.prototype.getNodeDefinitions = function(provider) {

  if (provider) {
    return this.nodeDefinitions[provider];
  } else {
    return this.nodeDefinitions;
  }

};

module.exports = Loader;

},{"events":2,"util":7}],38:[function(require,module,exports){

/**
 * This is the web browser implementation of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = require('./debug');
exports.log = log;
exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;

/**
 * Use chrome.storage.local if we are in an app
 */

var storage;

if (typeof chrome !== 'undefined' && typeof chrome.storage !== 'undefined')
  storage = chrome.storage.local;
else
  storage = window.localStorage;

/**
 * Colors.
 */

exports.colors = [
  'lightseagreen',
  'forestgreen',
  'goldenrod',
  'dodgerblue',
  'darkorchid',
  'crimson'
];

/**
 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
 * and the Firebug extension (any Firefox version) are known
 * to support "%c" CSS customizations.
 *
 * TODO: add a `localStorage` variable to explicitly enable/disable colors
 */

function useColors() {
  // is webkit? http://stackoverflow.com/a/16459606/376773
  return ('WebkitAppearance' in document.documentElement.style) ||
    // is firebug? http://stackoverflow.com/a/398120/376773
    (window.console && (console.firebug || (console.exception && console.table))) ||
    // is firefox >= v31?
    // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
    (navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31);
}

/**
 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
 */

exports.formatters.j = function(v) {
  return JSON.stringify(v);
};


/**
 * Colorize log arguments if enabled.
 *
 * @api public
 */

function formatArgs() {
  var args = arguments;
  var useColors = this.useColors;

  args[0] = (useColors ? '%c' : '')
    + this.namespace
    + (useColors ? ' %c' : ' ')
    + args[0]
    + (useColors ? '%c ' : ' ')
    + '+' + exports.humanize(this.diff);

  if (!useColors) return args;

  var c = 'color: ' + this.color;
  args = [args[0], c, 'color: inherit'].concat(Array.prototype.slice.call(args, 1));

  // the final "%c" is somewhat tricky, because there could be other
  // arguments passed either before or after the %c, so we need to
  // figure out the correct index to insert the CSS into
  var index = 0;
  var lastC = 0;
  args[0].replace(/%[a-z%]/g, function(match) {
    if ('%%' === match) return;
    index++;
    if ('%c' === match) {
      // we only are interested in the *last* %c
      // (the user may have provided their own)
      lastC = index;
    }
  });

  args.splice(lastC, 0, c);
  return args;
}

/**
 * Invokes `console.log()` when available.
 * No-op when `console.log` is not a "function".
 *
 * @api public
 */

function log() {
  // this hackery is required for IE8/9, where
  // the `console.log` function doesn't have 'apply'
  return 'object' === typeof console
    && console.log
    && Function.prototype.apply.call(console.log, console, arguments);
}

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */

function save(namespaces) {
  try {
    if (null == namespaces) {
      storage.removeItem('debug');
    } else {
      storage.debug = namespaces;
    }
  } catch(e) {}
}

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */

function load() {
  var r;
  try {
    r = storage.debug;
  } catch(e) {}
  return r;
}

/**
 * Enable namespaces listed in `localStorage.debug` initially.
 */

exports.enable(load());

},{"./debug":39}],39:[function(require,module,exports){

/**
 * This is the common logic for both the Node.js and web browser
 * implementations of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = debug;
exports.coerce = coerce;
exports.disable = disable;
exports.enable = enable;
exports.enabled = enabled;
exports.humanize = require('ms');

/**
 * The currently active debug mode names, and names to skip.
 */

exports.names = [];
exports.skips = [];

/**
 * Map of special "%n" handling functions, for the debug "format" argument.
 *
 * Valid key names are a single, lowercased letter, i.e. "n".
 */

exports.formatters = {};

/**
 * Previously assigned color.
 */

var prevColor = 0;

/**
 * Previous log timestamp.
 */

var prevTime;

/**
 * Select a color.
 *
 * @return {Number}
 * @api private
 */

function selectColor() {
  return exports.colors[prevColor++ % exports.colors.length];
}

/**
 * Create a debugger with the given `namespace`.
 *
 * @param {String} namespace
 * @return {Function}
 * @api public
 */

function debug(namespace) {

  // define the `disabled` version
  function disabled() {
  }
  disabled.enabled = false;

  // define the `enabled` version
  function enabled() {

    var self = enabled;

    // set `diff` timestamp
    var curr = +new Date();
    var ms = curr - (prevTime || curr);
    self.diff = ms;
    self.prev = prevTime;
    self.curr = curr;
    prevTime = curr;

    // add the `color` if not set
    if (null == self.useColors) self.useColors = exports.useColors();
    if (null == self.color && self.useColors) self.color = selectColor();

    var args = Array.prototype.slice.call(arguments);

    args[0] = exports.coerce(args[0]);

    if ('string' !== typeof args[0]) {
      // anything else let's inspect with %o
      args = ['%o'].concat(args);
    }

    // apply any `formatters` transformations
    var index = 0;
    args[0] = args[0].replace(/%([a-z%])/g, function(match, format) {
      // if we encounter an escaped % then don't increase the array index
      if (match === '%%') return match;
      index++;
      var formatter = exports.formatters[format];
      if ('function' === typeof formatter) {
        var val = args[index];
        match = formatter.call(self, val);

        // now we need to remove `args[index]` since it's inlined in the `format`
        args.splice(index, 1);
        index--;
      }
      return match;
    });

    if ('function' === typeof exports.formatArgs) {
      args = exports.formatArgs.apply(self, args);
    }
    var logFn = enabled.log || exports.log || console.log.bind(console);
    logFn.apply(self, args);
  }
  enabled.enabled = true;

  var fn = exports.enabled(namespace) ? enabled : disabled;

  fn.namespace = namespace;

  return fn;
}

/**
 * Enables a debug mode by namespaces. This can include modes
 * separated by a colon and wildcards.
 *
 * @param {String} namespaces
 * @api public
 */

function enable(namespaces) {
  exports.save(namespaces);

  var split = (namespaces || '').split(/[\s,]+/);
  var len = split.length;

  for (var i = 0; i < len; i++) {
    if (!split[i]) continue; // ignore empty strings
    namespaces = split[i].replace(/\*/g, '.*?');
    if (namespaces[0] === '-') {
      exports.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
    } else {
      exports.names.push(new RegExp('^' + namespaces + '$'));
    }
  }
}

/**
 * Disable debug output.
 *
 * @api public
 */

function disable() {
  exports.enable('');
}

/**
 * Returns true if the given mode name is enabled, false otherwise.
 *
 * @param {String} name
 * @return {Boolean}
 * @api public
 */

function enabled(name) {
  var i, len;
  for (i = 0, len = exports.skips.length; i < len; i++) {
    if (exports.skips[i].test(name)) {
      return false;
    }
  }
  for (i = 0, len = exports.names.length; i < len; i++) {
    if (exports.names[i].test(name)) {
      return true;
    }
  }
  return false;
}

/**
 * Coerce `val`.
 *
 * @param {Mixed} val
 * @return {Mixed}
 * @api private
 */

function coerce(val) {
  if (val instanceof Error) return val.stack || val.message;
  return val;
}

},{"ms":40}],40:[function(require,module,exports){
/**
 * Helpers.
 */

var s = 1000;
var m = s * 60;
var h = m * 60;
var d = h * 24;
var y = d * 365.25;

/**
 * Parse or format the given `val`.
 *
 * Options:
 *
 *  - `long` verbose formatting [false]
 *
 * @param {String|Number} val
 * @param {Object} options
 * @return {String|Number}
 * @api public
 */

module.exports = function(val, options){
  options = options || {};
  if ('string' == typeof val) return parse(val);
  return options.long
    ? long(val)
    : short(val);
};

/**
 * Parse the given `str` and return milliseconds.
 *
 * @param {String} str
 * @return {Number}
 * @api private
 */

function parse(str) {
  var match = /^((?:\d+)?\.?\d+) *(ms|seconds?|s|minutes?|m|hours?|h|days?|d|years?|y)?$/i.exec(str);
  if (!match) return;
  var n = parseFloat(match[1]);
  var type = (match[2] || 'ms').toLowerCase();
  switch (type) {
    case 'years':
    case 'year':
    case 'y':
      return n * y;
    case 'days':
    case 'day':
    case 'd':
      return n * d;
    case 'hours':
    case 'hour':
    case 'h':
      return n * h;
    case 'minutes':
    case 'minute':
    case 'm':
      return n * m;
    case 'seconds':
    case 'second':
    case 's':
      return n * s;
    case 'ms':
      return n;
  }
}

/**
 * Short format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function short(ms) {
  if (ms >= d) return Math.round(ms / d) + 'd';
  if (ms >= h) return Math.round(ms / h) + 'h';
  if (ms >= m) return Math.round(ms / m) + 'm';
  if (ms >= s) return Math.round(ms / s) + 's';
  return ms + 'ms';
}

/**
 * Long format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function long(ms) {
  return plural(ms, d, 'day')
    || plural(ms, h, 'hour')
    || plural(ms, m, 'minute')
    || plural(ms, s, 'second')
    || ms + ' ms';
}

/**
 * Pluralization helper.
 */

function plural(ms, n, name) {
  if (ms < n) return;
  if (ms < n * 1.5) return Math.floor(ms / n) + ' ' + name;
  return Math.ceil(ms / n) + ' ' + name + 's';
}

},{}],41:[function(require,module,exports){
module.exports = function InstanceOf(obj, type) {
  if(obj === null) return false;
  if(type === 'array') type = 'Array';
  var t = typeof obj;
  if(t === 'object') {
    if(type.toLowerCase() === t) return true; // Object === object
    if(obj.constructor.name === type) return true;
    if(obj.constructor.toString().match(/function (\w*)/)[1] === type) return true;
    return InstanceOf(Object.getPrototypeOf(obj), type);
  } else {
    return t === type;
  }
};

},{}],42:[function(require,module,exports){
'use strict';

var util = require('util');
var EventEmitter = require('events').EventEmitter;

/**
 *
 * IO Box
 *
 * @param {String} name
 */
var IOBox = function (name, args, returns) {

  if (!(this instanceof IOBox)) {
    return new IOBox(name, args, returns);
  }

  EventEmitter.apply(this, arguments);

  this.name = name || 'UNNAMED';

  // to ensure correct order
  this._keys = [];

  args = args || [];
  returns = returns || [];

  this.setup(args, returns);

};

util.inherits(IOBox, EventEmitter);

/**
 *
 * Setup
 *
 * @param {Array} args
 * @param {Array} returns
 */
IOBox.prototype.setup = function (args, returns) {

  var i;

  this.args = {};
  this.returns = [];
  this.fn = undefined;

  // setup the empty input arguments object
  for (i = 0; i < args.length; i++) {
    this.addArg(args[i], undefined);
  }

  for (i = 0; i < returns.length; i++) {
    this.addReturn(returns[i]);
  }
};

/**
 *
 * Used to access the properties at the top level,
 * but still be able to get all relevant arguments
 * at once using this.args
 *
 * @param {String} key
 * @param {Mixed} initial
 */
IOBox.prototype.addArg = function (key, initial) {

  Object.defineProperty(this, key, {
    set: function (val) {
      this.args[key] = val;
    },
    get: function () {
      return this.args[key];
    }
  });

  this._keys.push(key);

  this[key] = initial; // can be undefined

};

IOBox.prototype.addReturn = function (r) {
  if (this.returns.indexOf(r) === -1) {
    if (this._keys.indexOf(r) !== -1) {
      this.returns.push(r);
    }
    else {
      throw Error([
        'Output `',
        r,
        '` is not one of',
        this._keys.join(', ')
      ].join(' '));
    }
  }
};

/**
 *
 * Sets a property of the sandbox.
 * Because the keys determine what arguments will
 * be generated for the function, it is important
 * we keep some kind of control over what is set.
 *
 * @param {String} key
 * @param {Mixed} value
 *
 */
IOBox.prototype.set = function (key, value) {

  if (this.args.hasOwnProperty(key)) {
    this.args[key] = value;
  }
  else {
    throw new Error([
      'Will not set unknown property',
      key
    ].join(' '));
  }
};

/**
 *
 * Compiles and returns the generated function.
 *
 * @param {String} fn
 * @param {Boolean} asObject
 * @return {String}
 */
IOBox.prototype.compile = function (fn, asObject) {

  if (!this.code) {
    this.generate(fn ? fn.trim() : fn, asObject);
  }

  this.fn = new Function(this.code)();

  return this.fn;

};

/**
 *
 * Fill with a precompiled function
 *
 * Return type in this case is determined by compiled function
 *
 * @param {String} fn
 * @return {String}
 */
IOBox.prototype.fill = function (fn) {

  // argument signature check?

  this.fn = fn;

  return this.fn;

};

/**
 *
 * Wraps the function in yet another function
 *
 * This way it's possible to get the original return.
 *
 * @param {String} fn
 * @return {String}
 */
IOBox.prototype._returnWrap = function (fn) {
  return ['function() {', fn, '}.call(this)'].join('\n');
};
/**
 *
 * Clear generated code
 */
IOBox.prototype.clear = function () {
  this.code = null;
};

/**
 *
 * Generates the function.
 *
 * This can be used directly
 *
 * @param {String} fn
 * @param {Boolean} asObject
 * @return {String}
 */
IOBox.prototype.generate = function (fn, asObject) {

  this.code = [
    'return function ',
    this.name,
    '(',
    this._keys.join(','),
    ') {\n',
    'var r = ', // r goes to 'return'
    this._returnWrap(fn),
    '; return ',
    asObject ? this._asObject() : this._asArray(),
    '; }'
  ].join('');

  return this.code;
};

/**
 *
 * Return output as array.
 *
 * @return {String}
 */
IOBox.prototype._asArray = function () {
  return '[' + this.returns.join(',') + ',r]';
};

/**
 *
 * Return output as object.
 *
 * @return {String}
 */
IOBox.prototype._asObject = function () {
  var ret = [];
  for (var i = 0; i < this.returns.length; i++) {
    ret.push(this.returns[i] + ':' + this.returns[i]);
  }
  ret.push('return:' + 'r');

  return '{' + ret.join(',') + '}';
};

/**
 *
 * Renders the function to string.
 *
 * @return {String}
 */
IOBox.prototype.toString = function () {
  if (this.fn) return this.fn.toString();
  return this.fn;
};

/**
 *
 * Runs the generated function
 *
 * @param {Mixed} bind   Context to bind to the function
 * @return {Mixed}
 */
IOBox.prototype.run = function (bind) {

  var v = [];
  var k;

  for (k in this.args) {
    if (this.args.hasOwnProperty(k)) {
      v[this._keys.indexOf(k)] = this.args[k];
    }
    else {
      throw new Error('unknown input ' + k);
    }
  }

  // returns the output, format depends on the `compile` step
  return this.fn.apply(bind, v);

};

module.exports = IOBox;

},{"events":2,"util":7}],43:[function(require,module,exports){
/*!
 * is-plain-object <https://github.com/jonschlinkert/is-plain-object>
 *
 * Copyright (c) 2014 Jon Schlinkert, contributors.
 * Licensed under the MIT License
 */

'use strict';

module.exports = function isPlainObject(o) {
  return !!o && typeof o === 'object' && o.constructor === Object;
};
},{}],44:[function(require,module,exports){
exports.getType = function (obj) {
	switch (Object.prototype.toString.call(obj)) {
		case '[object String]':
			return 'string';
		case '[object Number]':
			return (obj % 1 === 0) ? 'integer' : 'number';
		case '[object Boolean]':
			return 'boolean';
		case '[object Object]':
			return 'object';
		case '[object Array]':
			return 'array';
		case '[object Null]':
			return 'null';
		default:
			return 'undefined';
	}
}

exports.prettyType = function(type) {
	switch (type) {
		case 'string':
		case 'number':
		case 'boolean':
			return 'a ' + type;
		case 'integer':
		case 'object':
		case 'array':
			return 'an ' + type;
		case 'null':
			return 'null';
		case 'any':
			return 'any type';
		case 'undefined':
			return 'undefined';
		default:
			if (typeof type === 'object') {
				return 'a schema'
			} else {
				return type;
			}
	}
}


exports.isOfType = function (obj, type) {
	switch (type) {
		case 'string':
		case 'number':
		case 'boolean':
		case 'object':
		case 'array':
		case 'null':
			type = type.charAt(0).toUpperCase() + type.slice(1);
			return Object.prototype.toString.call(obj) === '[object ' + type + ']';
		case 'integer':
			return Object.prototype.toString.call(obj) === '[object Number]' && obj % 1 === 0;
		case 'any':
		default:
			return true;
	}
}

exports.getName = function (names) {
	return names.length === 0 ? '' : ' property \'' + names.join('.') + '\'';
};

exports.deepEquals = function (obj1, obj2) {
	var p;

	if (Object.prototype.toString.call(obj1) !== Object.prototype.toString.call(obj2)) {
		return false;
	}

	switch (typeof obj1) {
		case 'object':
			if (obj1.toString() !== obj2.toString()) {
				return false;
			}
			for (p in obj1) {
				if (!(p in obj2)) {
					return false;
				}
				if (!exports.deepEquals(obj1[p], obj2[p])) {
					return false;
				}
			}
			for (p in obj2) {
				if (!(p in obj1)) {
					return false;
				}
			}
			return true;
		case 'function':
			return obj1[p].toString() === obj2[p].toString();
		default:
			return obj1 === obj2;
	}
};

},{}],45:[function(require,module,exports){
var RE_0_TO_100 = '([1-9]?[0-9]|100)';
var RE_0_TO_255 = '([1-9]?[0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])';

function validateFormatUtcMillisec(obj) {
	return obj >= 0;
}

function validateFormatRegExp(obj) {
	try {
		var re = RegExp(obj);
		return true;
	} catch(err) {
		return false;
	}
}

var COLORS = ['aqua', 'black', 'blue', 'fuchsia', 'gray', 'green', 'lime', 'maroon', 'navy', 'olive', 'orange', 'purple', 'red', 'silver', 'teal', 'white', 'yellow'];
var colorsReHex3 = /^#[0-9A-Fa-f]{3}$/; // #rgb
var colorsReHex6 = /^#[0-9A-Fa-f]{6}$/; // #rrggbb
var colorsReRgbNum = RegExp('^rgb\\(\\s*' + RE_0_TO_255 + '(\\s*,\\s*' + RE_0_TO_255 + '\\s*){2}\\)$'); // rgb(255, 0, 128)
var colorsReRgbPerc = RegExp('^rgb\\(\\s*' + RE_0_TO_100 + '%(\\s*,\\s*' + RE_0_TO_100 + '%\\s*){2}\\)$'); // rgb(100%, 0%, 50%)

function validateFormatColor(obj) {
	return COLORS.indexOf(obj) !== -1 || obj.match(colorsReHex3) || obj.match(colorsReHex6)
		|| obj.match(colorsReRgbNum) || obj.match(colorsReRgbPerc);
}

var phoneReNational = /^(\(\d+\)|\d+)( \d+)*$/;
var phoneReInternational = /^\+\d+( \d+)*$/;

function validateFormatPhone(obj) {
	return obj.match(phoneReNational) || obj.match(phoneReInternational);
}

var formats = {
	'date-time': { // ISO 8601 (YYYY-MM-DDThh:mm:ssZ in UTC time)
		types: ['string'],
		regex: /^\d{4}-\d{2}-\d{2}T[0-2]\d:[0-5]\d:[0-5]\d([.,]\d+)?Z$/
	},
	'date': { // YYYY-MM-DD
		types: ['string'],
		regex: /^\d{4}-\d{2}-\d{2}$/
	},
	'time': { // hh:mm:ss
		types: ['string'],
		regex: /^[0-2]\d:[0-5]\d:[0-5]\d$/
	},
	'utc-millisec': {
		types: ['number', 'integer'],
		func: validateFormatUtcMillisec
	},
	'regex': { // ECMA 262/Perl 5
		types: ['string'],
		func: validateFormatRegExp
	},
	'color': { // W3C.CR-CSS21-20070719
		types: ['string'],
		func: validateFormatColor
	},
	/* TODO: support style
		* style - A string containing a CSS style definition, based on CSS 2.1 [W3C.CR-CSS21-20070719].
		Example: `'color: red; background-color:#FFF'`.

	'style': { // W3C.CR-CSS21-20070719
		types: ['string'],
		func: validateFormatStyle
	},*/
   	'phone': { // E.123
		types: ['string'],
		func: validateFormatPhone
	},
	'uri': {
		types: ['string'],
		regex: RegExp("^([a-z][a-z0-9+.-]*):(?://(?:((?:[a-z0-9-._~!$&'()*+,;=:]|%[0-9A-F]{2})*)@)?((?:[a-z0-9-._~!$&'()*+,;=]|%[0-9A-F]{2})*)(?::(\\d*))?(/(?:[a-z0-9-._~!$&'()*+,;=:@/]|%[0-9A-F]{2})*)?|(/?(?:[a-z0-9-._~!$&'()*+,;=:@]|%[0-9A-F]{2})+(?:[a-z0-9-._~!$&'()*+,;=:@/]|%[0-9A-F]{2})*)?)(?:\\?((?:[a-z0-9-._~!$&'()*+,;=:/?@]|%[0-9A-F]{2})*))?(?:#((?:[a-z0-9-._~!$&'()*+,;=:/?@]|%[0-9A-F]{2})*))?$", 'i')
	},
	'email': {
		types: ['string'],
		regex: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i
	},
	'ip-address': {
		types: ['string'],
		regex: RegExp('^' + RE_0_TO_255 + '(\\.' + RE_0_TO_255 + '){3}$')
	},
	'ipv6': {
		types: ['string'],
		regex: /^((?=.*::)(?!.*::.+::)(::)?([\dA-F]{1,4}:(:|\b)|){5}|([\dA-F]{1,4}:){6})((([\dA-F]{1,4}((?!\3)::|:\b|$))|(?!\2\3)){2}|(((2[0-4]|1\d|[1-9])?\d|25[0-5])\.?\b){4})$/i
	},
	'host-name': {
		types: ['string'],
		regex: /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$/
	}
};

exports.formats = formats;

},{}],46:[function(require,module,exports){
var validateSchema = require('./valid-schema'),
	validateObject = require('./valid-object');

var Schema = function(schema) {
	this.schema = schema;
	validateSchema(schema);

	this.validate = function(obj, done) {
		validateObject(obj, schema, done);
	}
}

module.exports.createSchema = function (schema) {
	return new Schema(schema);
}

},{"./valid-object":47,"./valid-schema":48}],47:[function(require,module,exports){
var formats = require('./formats').formats;
var common = require('./common'),
	getType = common.getType,
	prettyType = common.prettyType,
	isOfType = common.isOfType,
	getName = common.getName,
	deepEquals = common.deepEquals;

function throwInvalidValue(names, value, expected) {
	throw new Error('JSON object' + getName(names) + ' is ' + value + ' when it should be ' + expected);
}

function throwInvalidAttributeValue(names, attribFullName, value, expected) {
	throw new Error('JSON object' + getName(names) + ': ' + attribFullName + ' is ' + value + ' when it should be ' + expected);
}

function throwInvalidType(names, value, expected) {
	throw new Error('JSON object' + getName(names) + ' is ' + prettyType(getType(value)) + ' when it should be ' + expected);
}

function throwInvalidDisallow(names, value, expected) {
	throw new Error('JSON object' + getName(names) + ' is ' + prettyType(getType(value)) + ' when it should not be ' + expected);
}

function validateRequired(obj, schema, names) {
	//console.log('***', names, 'validateRequired');
	if (schema.required) {
		if (obj === undefined) {
			throw new Error('JSON object' + getName(names) + ' is required');
		}
	}
}

function applyDefault(obj, schema, names) {
	//console.log('***', names, 'applyDefault');
	if (schema.default !== undefined) {
		obj = schema.default;
	}

	return obj;
}

function validateType(obj, schema, names) {
	//console.log('***', names, 'validateType');
	if (schema.type !== undefined) {
		switch (getType(schema.type)) {
			case 'string':
				// simple type
				if (!isOfType(obj, schema.type)) {
					throwInvalidType(names, obj, prettyType(schema.type));
				}
				break;
			case 'array':
				// union type
				for (var i = 0; i < schema.type.length; ++i) {
					switch (getType(schema.type[i])) {
						case 'string':
							// simple type (inside union type)
							if (isOfType(obj, schema.type[i])) {
								return; // success
							}
							break;
						case 'object':
							// schema (inside union type)
							try {
								return validateSchema(obj, schema.type[i], names);
							} catch(err) {
								// validation failed
								// TOOD: consider propagating error message upwards
							}
							break;
					}
				}
				throwInvalidType(names, obj, 'either ' + schema.type.map(prettyType).join(' or '));
				break;
		}
	}
}

function validateDisallow(obj, schema, names) {
	//console.log('***', names, 'validateDisallow');
	if (schema.disallow !== undefined) {
		switch (getType(schema.disallow)) {
			case 'string':
				// simple type
				if (isOfType(obj, schema.disallow)) {
					throwInvalidDisallow(names, obj, prettyType(schema.disallow));
				}
				break;
			case 'array':
				// union type
				for (var i = 0; i < schema.disallow.length; ++i) {
					switch (getType(schema.disallow[i])) {
						case 'string':
							// simple type (inside union type)
							if (isOfType(obj, schema.disallow[i])) {
								throwInvalidType(names, obj, 'neither ' + schema.disallow.map(prettyType).join(' nor '));
							}
							break;
						case 'object':
							// schema (inside union type)
							try {
								validateSchema(obj, schema.disallow[i], names);
							} catch(err) {
								// validation failed
								continue;
							}
							throwInvalidType(names, obj, 'neither ' + schema.disallow.map(prettyType).join(' nor '));
							// TOOD: consider propagating error message upwards
							break;
					}
				}
				break;
		}
	}
}

function validateEnum(obj, schema, names) {
	//console.log('***', names, 'validateEnum');
	if (schema['enum'] !== undefined) {
		for (var i = 0; i < schema['enum'].length; ++i) {
			if (deepEquals(obj, schema['enum'][i])) {
				return;
			}
		}
		throw new Error('JSON object' + getName(names) + ' is not in enum');
	}
}

function validateArray(obj, schema, names) {
	//console.log('***', names, 'validateArray');
	var i, j;

	if (schema.minItems !== undefined) {
		if (obj.length < schema.minItems) {
			throwInvalidAttributeValue(names, 'number of items', obj.length, 'at least ' + schema.minItems);
		}
	}

	if (schema.maxItems !== undefined) {
		if (obj.length > schema.maxItems) {
			throwInvalidAttributeValue(names, 'number of items', obj.length, 'at most ' + schema.maxItems);
		}
	}

	if (schema.items !== undefined) {
		switch (getType(schema.items)) {
			case 'object':
				// all the items in the array MUST be valid according to the schema
				for (i = 0; i < obj.length; ++i) {
					obj[i] = validateSchema(obj[i], schema.items, names.concat([ '['+i+']' ]));
				}
				break;
			case 'array':
				// each position in the instance array MUST conform to the schema in the corresponding position for this array
				var numChecks = Math.min(obj.length, schema.items.length);
				for (i = 0; i < numChecks; ++i) {
					obj[i] = validateSchema(obj[i], schema.items[i], names.concat([ '['+i+']' ]));
				}
				if (obj.length > schema.items.length) {
					if (schema.additionalItems !== undefined) {
						if (schema.additionalItems === false) {
							throwInvalidAttributeValue(names, 'number of items', obj.length, 'at most ' + schema.items.length + ' - the length of schema items');
						}
						for (; i < obj.length; ++i) {
							obj[i] = validateSchema(obj[i], schema.additionalItems, names.concat([ '['+i+']' ]));
						}
					}
				}
				break;
		}
	}

	if (schema.uniqueItems !== undefined) {
		for (i = 0; i < obj.length - 1; ++i) {
			for (j = i + 1; j < obj.length; ++j) {
				if (deepEquals(obj[i], obj[j])) {
					throw new Error('JSON object' + getName(names) + ' items are not unique: element ' + i + ' equals element ' + j);
				}
			}
		}
	}
}

function validateObject(obj, schema, names) {
	//console.log('***', names, 'validateObject');
	var prop, property;
	if (schema.properties !== undefined) {
		for (property in schema.properties) {
			prop = validateSchema(obj[property], schema.properties[property], names.concat([property]));
			if (prop === undefined) {
				delete obj[property];
			} else {
				obj[property] = prop;
			}
		}
	}

	var matchingProperties = {};
	if (schema.patternProperties !== undefined) {
		for (var reStr in schema.patternProperties) {
			var re = RegExp(reStr);
			for (property in obj) {
				if (property.match(re)) {
					matchingProperties[property] = true;
					prop = validateSchema(obj[property], schema.patternProperties[reStr], names.concat(['patternProperties./' + property + '/']));
					if (prop === undefined) {
						delete obj[property];
					} else {
						obj[property] = prop;
					}
				}
			}
		}
	}

	if (schema.additionalProperties !== undefined) {
		for (property in obj) {
			if (schema.properties !== undefined && property in schema.properties) {
				continue;
			}
			if (property in matchingProperties) {
				continue;
			}
			// additional
			if (schema.additionalProperties === false) {
				throw new Error('JSON object' + getName(names.concat([property])) + ' is not explicitly defined and therefore not allowed');
			}
			obj[property] = validateSchema(obj[property], schema.additionalProperties, names.concat([property]));
		}
	}

	if (schema.dependencies !== undefined) {
		for (property in schema.dependencies) {
			switch (getType(schema.dependencies[property])) {
				case 'string':
					// simple dependency
					if (property in obj && !(schema.dependencies[property] in obj)) {
						throw new Error('JSON object' + getName(names.concat([schema.dependencies[property]])) + ' is required by property \'' + property + '\'');
					}
					break;
				case 'array':
					// simple dependency tuple
					for (var i = 0; i < schema.dependencies[property].length; ++i) {
						if (property in obj && !(schema.dependencies[property][i] in obj)) {
							throw new Error('JSON object' + getName(names.concat([schema.dependencies[property][i]])) + ' is required by property \'' + property + '\'');
						}
					}
					break;
				case 'object':
					// schema dependency
					validateSchema(obj, schema.dependencies[property], names.concat([ '[dependencies.'+property+']' ]));
					break;
			}
		}
	}
}

function validateNumber(obj, schema, names) {
	//console.log('***', names, 'validateNumber');

	if (schema.minimum !== undefined) {
		if (schema.exclusiveMinimum ? obj <= schema.minimum : obj < schema.minimum) {
			throwInvalidValue(names, obj, (schema.exclusiveMinimum ? 'greater than' : 'at least') + ' ' + schema.minimum);
		}
	}

	if (schema.maximum !== undefined) {
		if (schema.exclusiveMaximum ? obj >= schema.maximum : obj > schema.maximum) {
			throwInvalidValue(names, obj, (schema.exclusiveMaximum ? 'less than' : 'at most') + ' ' + schema.maximum);
		}
	}

	if (schema.divisibleBy !== undefined) {
		if (!isOfType(obj / schema.divisibleBy, 'integer')) {
			throwInvalidValue(names, obj, 'divisible by ' + schema.divisibleBy);
		}
	}
}

function validateString(obj, schema, names) {
	//console.log('***', names, 'validateString');

	if (schema.minLength !== undefined) {
		if (obj.length < schema.minLength) {
			throwInvalidAttributeValue(names, 'length', obj.length, 'at least ' + schema.minLength);
		}
	}

	if (schema.maxLength !== undefined) {
		if (obj.length > schema.maxLength) {
			throwInvalidAttributeValue(names, 'length', obj.length, 'at most ' + schema.maxLength);
		}
	}

	if (schema.pattern !== undefined) {
		if (!obj.match(RegExp(schema.pattern))) {
			throw new Error('JSON object' + getName(names) + ' does not match pattern');
		}
	}
}

function validateFormat(obj, schema, names) {
	//console.log('***', names, 'validateFormat');
	if (schema.format !== undefined) {
		var format = formats[schema.format];
		if (format !== undefined) {
			var conforms = true;
			if (format.regex) {
				conforms = obj.match(format.regex);
			} else if (format.func) {
				conforms = format.func(obj);
			}
			if (!conforms) {
				throw new Error('JSON object' + getName(names) + ' does not conform to the \'' + schema.format + '\' format');
			}
		}
	}
}

function validateItem(obj, schema, names) {
	//console.log('***', names, 'validateItem');
	switch (getType(obj)) {
		case 'number':
		case 'integer':
			validateNumber(obj, schema, names);
			break;
		case 'string':
			validateString(obj, schema, names);
			break;
	}

	validateFormat(obj, schema, names);
}

function validateSchema(obj, schema, names) {
	//console.log('***', names, 'validateSchema');

	validateRequired(obj, schema, names);
	if (obj === undefined) {
		obj = applyDefault(obj, schema, names);
	}
	if (obj !== undefined) {
		validateType(obj, schema, names);
		validateDisallow(obj, schema, names);
		validateEnum(obj, schema, names);

		switch (getType(obj)) {
			case 'object':
				validateObject(obj, schema, names);
				break;
			case 'array':
				validateArray(obj, schema, names);
				break;
			default:
				validateItem(obj, schema, names);
		}
	}

	return obj;
}

// Two operation modes:
// * Synchronous - done callback is not provided. will return nothing or throw error
// * Asynchronous - done callback is provided. will not throw error.
//        will call callback with error as first parameter and object as second
// Schema is expected to be validated.
module.exports = function(obj, schema, done) {
	try {
		validateSchema(obj, schema, []);
	} catch(err) {
		if (done) {
			done(err);
			return;
		} else {
			throw err;
		}
	} 

	if (done) {
		done(null, obj);
	}
};

},{"./common":44,"./formats":45}],48:[function(require,module,exports){
var formats = require('./formats').formats;
var common = require('./common'),
	getType = common.getType,
	prettyType = common.prettyType,
	isOfType = common.isOfType,
	getName = common.getName,
	validateObjectVsSchema = require('./valid-object');

function throwInvalidType(names, attribFullName, value, expected) {
	throw new Error('Schema' + getName(names) + ': ' + attribFullName + ' is ' + prettyType(getType(value)) + ' when it should be ' + expected);
}

function assertType(schema, attribName, expectedType, names) {
	if (schema[attribName] !== undefined) {
		if (!isOfType(schema[attribName], expectedType)) {
			throwInvalidType(names, '\'' + attribName + '\' attribute', schema[attribName], prettyType(expectedType));
		}
	}
}

function validateRequired(schema, names) {
	assertType(schema, 'required', 'boolean', names);
}

function validateDefault(schema, names) {
	if (schema.default !== undefined) {
		try {
			validateObjectVsSchema(schema.default, schema);
		} catch(err) {
			throw new Error('Schema' + getName(names) + ': \'default\' attribute value is not valid according to the schema: ' + err.message);
		}
	}
}

function validateType(schema, names) {
	if (schema.type !== undefined) {
		switch (getType(schema.type)) {
			case 'string':
				// simple type - nothing to validate
				break;
			case 'array':
				// union type
				if (schema.type.length < 2) {
					throw new Error('Schema' + getName(names) + ': \'type\' attribute union length is ' + schema.type.length + ' when it should be at least 2');
				}
				for (var i = 0; i < schema.type.length; ++i) {
					switch (getType(schema.type[i])) {
						case 'string':
							// simple type (inside union type) - nothing to validate
							break;
						case 'object':
							// schema (inside union type)
							try {
								validateSchema(schema.type[i], []);
							} catch(err) {
								throw new Error('Schema' + getName(names) + ': \'type\' attribute union element ' + i + ' is not a valid schema: ' + err.message);
							}
							break;
						default:
							throwInvalidType(names, '\'type\' attribute union element ' + i, schema.type[i], 'either an object (schema) or a string');
					}
				}
				break;
			default:
				throwInvalidType(names, '\'type\' attribute', schema.type, 'either a string or an array');
		}
	}
}

function validateDisallow(schema, names) {
	if (schema.disallow !== undefined) {
		switch (getType(schema.disallow)) {
			case 'string':
				// simple type - nothing to validate
				break;
			case 'array':
				// union type
				if (schema.disallow.length < 2) {
					throw new Error('Schema' + getName(names) + ': \'disallow\' attribute union length is ' + schema.disallow.length + ' when it should be at least 2');
				}
				for (var i = 0; i < schema.disallow.length; ++i) {
					switch (getType(schema.disallow[i])) {
						case 'string':
							// simple type (inside union type) - nothing to validate
							break;
						case 'object':
							// schema (inside union type)
							try {
								validateSchema(schema.disallow[i], []);
							} catch(err) {
								throw new Error('Schema' + getName(names) + ': \'disallow\' attribute union element ' + i + ' is not a valid schema: ' + err.message);
							}
							break;
						default:
							throwInvalidType(names, '\'disallow\' attribute union element ' + i, schema.disallow[i], 'either an object (schema) or a string');
					}
				}
				break;
			default:
				throwInvalidType(names, '\'disallow\' attribute', schema.disallow, 'either a string or an array');
		}
	}
}

function validateEnum(schema, names) {
	assertType(schema, 'enum', 'array', names);
}

function validateArray(schema, names) {
	assertType(schema, 'minItems', 'integer', names);
	assertType(schema, 'maxItems', 'integer', names);

	if (schema.items !== undefined) {
		var i;
		switch (getType(schema.items)) {
			case 'object':
				// all the items in the array MUST be valid according to the schema
				try {
					validateSchema(schema.items, []);
				} catch(err) {
					throw new Error('Schema' + getName(names) + ': \'items\' attribute is not a valid schema: ' + err.message);
				}
				break;
			case 'array':
				// each position in the instance array MUST conform to the schema in the corresponding position for this array
				for (i = 0; i < schema.items.length; ++i) {
					try {
						validateSchema(schema.items[i], []);
					} catch(err) {
						throw new Error('Schema' + getName(names) + ': \'items\' attribute element ' + i + ' is not a valid schema: ' + err.message);
					}
				}
				break;
			default:
				throwInvalidType(names, '\'items\' attribute', schema.items, 'either an object (schema) or an array');
		}
	}

	if (schema.additionalItems !== undefined) {
		if (schema.additionalItems === false) {
			// ok
		} else if (!isOfType(schema.additionalItems, 'object')) {
			throwInvalidType(names, '\'additionalItems\' attribute', schema.additionalItems, 'either an object (schema) or false');
		} else {
			try {
				validateSchema(schema.additionalItems, []);
			} catch(err) {
				throw new Error('Schema' + getName(names) + ': \'additionalItems\' attribute is not a valid schema: ' + err.message);
			}
		}
	}

	assertType(schema, 'uniqueItems', 'boolean', names);
}

function validateObject(schema, names) {
	assertType(schema, 'properties', 'object', names);
	if (schema.properties !== undefined) {
		for (var property in schema.properties) {
			validateSchema(schema.properties[property], names.concat([property]));
		}
	}

	assertType(schema, 'patternProperties', 'object', names);
	if (schema.patternProperties !== undefined) {
		for (var reStr in schema.patternProperties) {
			validateSchema(schema.patternProperties[reStr], names.concat(['patternProperties./' + reStr + '/']));
		}
	}

	if (schema.additionalProperties !== undefined) {
		if (schema.additionalProperties === false) {
			// ok
		} else if (!isOfType(schema.additionalProperties, 'object')) {
			throwInvalidType(names, '\'additionalProperties\' attribute', schema.additionalProperties, 'either an object (schema) or false');
		} else {
			try {
				validateSchema(schema.additionalProperties, []);
			} catch(err) {
				throw new Error('Schema' + getName(names) + ': \'additionalProperties\' attribute is not a valid schema: ' + err.message);
			}
		}
	}

	assertType(schema, 'dependencies', 'object', names);
	if (schema.dependencies !== undefined) {
		for (var property in schema.dependencies) {
			switch (getType(schema.dependencies[property])) {
				case 'string':
					// simple dependency - nothing to validate
					break;
				case 'array':
					// simple dependency tuple
					for (var i = 0; i < schema.dependencies[property].length; ++i) {
						if (isOfType(schema.dependencies[property][i], 'string')) {
							// simple dependency (inside array) - nothing to validate
						} else {
							throwInvalidType(names, '\'dependencies\' attribute: value of property \'' + property + '\' element ' + i, schema.dependencies[property][i], 'a string');
						}
					}
					break;
				case 'object':
					// schema dependency
					try {
						validateSchema(schema.dependencies[property], []);
					} catch(err) {
						throw new Error('Schema' + getName(names) + ': \'dependencies\' attribute: value of property \'' + property + '\' is not a valid schema: ' + err.message);
					}
					break;
				default:
					throwInvalidType(names, '\'dependencies\' attribute: value of property \'' + property + '\'', schema.dependencies[property], 'either a string, an array or an object (schema)');
			}
		}
	}
}

function validateNumber(schema, names) {
	assertType(schema, 'minimum', 'number', names);
	assertType(schema, 'exclusiveMinimum', 'boolean', names);
	assertType(schema, 'maximum', 'number', names);
	assertType(schema, 'exclusiveMaximum', 'boolean', names);
	assertType(schema, 'divisibleBy', 'number', names);
	if (schema.divisibleBy !== undefined) {
		if (schema.divisibleBy === 0) {
			throw new Error('Schema' + getName(names) + ': \'divisibleBy\' attribute must not be 0');
		}
	}
};

function validateString(schema, names) {
	assertType(schema, 'minLength', 'integer', names);
	assertType(schema, 'maxLength', 'integer', names);
	assertType(schema, 'pattern', 'string', names);
}

function validateFormat(schema, names) {
	assertType(schema, 'format', 'string', names);

	if (schema.format !== undefined) {
		if (schema.format in formats) {
			if (formats[schema.format].types.indexOf(schema.type) === -1) {
				throw new Error('Schema' + getName(names) + ': \'type\' attribute does not conform to the \'' + schema.format + '\' format');
			}
		}
	}
}

function validateItem(schema, names) {
	validateNumber(schema, names);
	validateString(schema, names);
	validateFormat(schema, names);
}

function validateSchema(schema, names) {
	if (!isOfType(schema, 'object')) {
		throw new Error('Schema' + getName(names) + ' is ' + prettyType(getType(schema)) + ' when it should be an object');
	}
	validateRequired(schema, names);
	validateType(schema, names);
	validateDisallow(schema, names);
	validateEnum(schema, names);
	validateObject(schema, names);
	validateArray(schema, names);
	validateItem(schema, names);
	// defaults are applied last after schema is validated
	validateDefault(schema, names);
}

module.exports = function(schema) {
	if (schema === undefined) {
		throw new Error('Schema is undefined');
	}

	// validate schema parameters for object root
	if (!isOfType(schema, 'object')) {
		throw new Error('Schema is ' + prettyType(getType(schema)) + ' when it should be an object');
	}

	validateSchema(schema, []);
};

},{"./common":44,"./formats":45,"./valid-object":47}],49:[function(require,module,exports){
(function (global){

var rng;

if (global.crypto && crypto.getRandomValues) {
  // WHATWG crypto-based RNG - http://wiki.whatwg.org/wiki/Crypto
  // Moderately fast, high quality
  var _rnds8 = new Uint8Array(16);
  rng = function whatwgRNG() {
    crypto.getRandomValues(_rnds8);
    return _rnds8;
  };
}

if (!rng) {
  // Math.random()-based (RNG)
  //
  // If all else fails, use Math.random().  It's fast, but is of unspecified
  // quality.
  var  _rnds = new Array(16);
  rng = function() {
    for (var i = 0, r; i < 16; i++) {
      if ((i & 0x03) === 0) r = Math.random() * 0x100000000;
      _rnds[i] = r >>> ((i & 0x03) << 3) & 0xff;
    }

    return _rnds;
  };
}

module.exports = rng;


}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],50:[function(require,module,exports){
//     uuid.js
//
//     Copyright (c) 2010-2012 Robert Kieffer
//     MIT License - http://opensource.org/licenses/mit-license.php

// Unique ID creation requires a high quality random # generator.  We feature
// detect to determine the best RNG source, normalizing to a function that
// returns 128-bits of randomness, since that's what's usually required
var _rng = require('./rng');

// Maps for number <-> hex string conversion
var _byteToHex = [];
var _hexToByte = {};
for (var i = 0; i < 256; i++) {
  _byteToHex[i] = (i + 0x100).toString(16).substr(1);
  _hexToByte[_byteToHex[i]] = i;
}

// **`parse()` - Parse a UUID into it's component bytes**
function parse(s, buf, offset) {
  var i = (buf && offset) || 0, ii = 0;

  buf = buf || [];
  s.toLowerCase().replace(/[0-9a-f]{2}/g, function(oct) {
    if (ii < 16) { // Don't overflow!
      buf[i + ii++] = _hexToByte[oct];
    }
  });

  // Zero out remaining bytes if string was short
  while (ii < 16) {
    buf[i + ii++] = 0;
  }

  return buf;
}

// **`unparse()` - Convert UUID byte array (ala parse()) into a string**
function unparse(buf, offset) {
  var i = offset || 0, bth = _byteToHex;
  return  bth[buf[i++]] + bth[buf[i++]] +
          bth[buf[i++]] + bth[buf[i++]] + '-' +
          bth[buf[i++]] + bth[buf[i++]] + '-' +
          bth[buf[i++]] + bth[buf[i++]] + '-' +
          bth[buf[i++]] + bth[buf[i++]] + '-' +
          bth[buf[i++]] + bth[buf[i++]] +
          bth[buf[i++]] + bth[buf[i++]] +
          bth[buf[i++]] + bth[buf[i++]];
}

// **`v1()` - Generate time-based UUID**
//
// Inspired by https://github.com/LiosK/UUID.js
// and http://docs.python.org/library/uuid.html

// random #'s we need to init node and clockseq
var _seedBytes = _rng();

// Per 4.5, create and 48-bit node id, (47 random bits + multicast bit = 1)
var _nodeId = [
  _seedBytes[0] | 0x01,
  _seedBytes[1], _seedBytes[2], _seedBytes[3], _seedBytes[4], _seedBytes[5]
];

// Per 4.2.2, randomize (14 bit) clockseq
var _clockseq = (_seedBytes[6] << 8 | _seedBytes[7]) & 0x3fff;

// Previous uuid creation time
var _lastMSecs = 0, _lastNSecs = 0;

// See https://github.com/broofa/node-uuid for API details
function v1(options, buf, offset) {
  var i = buf && offset || 0;
  var b = buf || [];

  options = options || {};

  var clockseq = options.clockseq !== undefined ? options.clockseq : _clockseq;

  // UUID timestamps are 100 nano-second units since the Gregorian epoch,
  // (1582-10-15 00:00).  JSNumbers aren't precise enough for this, so
  // time is handled internally as 'msecs' (integer milliseconds) and 'nsecs'
  // (100-nanoseconds offset from msecs) since unix epoch, 1970-01-01 00:00.
  var msecs = options.msecs !== undefined ? options.msecs : new Date().getTime();

  // Per 4.2.1.2, use count of uuid's generated during the current clock
  // cycle to simulate higher resolution clock
  var nsecs = options.nsecs !== undefined ? options.nsecs : _lastNSecs + 1;

  // Time since last uuid creation (in msecs)
  var dt = (msecs - _lastMSecs) + (nsecs - _lastNSecs)/10000;

  // Per 4.2.1.2, Bump clockseq on clock regression
  if (dt < 0 && options.clockseq === undefined) {
    clockseq = clockseq + 1 & 0x3fff;
  }

  // Reset nsecs if clock regresses (new clockseq) or we've moved onto a new
  // time interval
  if ((dt < 0 || msecs > _lastMSecs) && options.nsecs === undefined) {
    nsecs = 0;
  }

  // Per 4.2.1.2 Throw error if too many uuids are requested
  if (nsecs >= 10000) {
    throw new Error('uuid.v1(): Can\'t create more than 10M uuids/sec');
  }

  _lastMSecs = msecs;
  _lastNSecs = nsecs;
  _clockseq = clockseq;

  // Per 4.1.4 - Convert from unix epoch to Gregorian epoch
  msecs += 12219292800000;

  // `time_low`
  var tl = ((msecs & 0xfffffff) * 10000 + nsecs) % 0x100000000;
  b[i++] = tl >>> 24 & 0xff;
  b[i++] = tl >>> 16 & 0xff;
  b[i++] = tl >>> 8 & 0xff;
  b[i++] = tl & 0xff;

  // `time_mid`
  var tmh = (msecs / 0x100000000 * 10000) & 0xfffffff;
  b[i++] = tmh >>> 8 & 0xff;
  b[i++] = tmh & 0xff;

  // `time_high_and_version`
  b[i++] = tmh >>> 24 & 0xf | 0x10; // include version
  b[i++] = tmh >>> 16 & 0xff;

  // `clock_seq_hi_and_reserved` (Per 4.2.2 - include variant)
  b[i++] = clockseq >>> 8 | 0x80;

  // `clock_seq_low`
  b[i++] = clockseq & 0xff;

  // `node`
  var node = options.node || _nodeId;
  for (var n = 0; n < 6; n++) {
    b[i + n] = node[n];
  }

  return buf ? buf : unparse(b);
}

// **`v4()` - Generate random UUID**

// See https://github.com/broofa/node-uuid for API details
function v4(options, buf, offset) {
  // Deprecated - 'format' argument, as supported in v1.2
  var i = buf && offset || 0;

  if (typeof(options) == 'string') {
    buf = options == 'binary' ? new Array(16) : null;
    options = null;
  }
  options = options || {};

  var rnds = options.random || (options.rng || _rng)();

  // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`
  rnds[6] = (rnds[6] & 0x0f) | 0x40;
  rnds[8] = (rnds[8] & 0x3f) | 0x80;

  // Copy bytes to buffer, if provided
  if (buf) {
    for (var ii = 0; ii < 16; ii++) {
      buf[i + ii] = rnds[ii];
    }
  }

  return buf || unparse(rnds);
}

// Export public API
var uuid = v4;
uuid.v1 = v1;
uuid.v4 = v4;
uuid.parse = parse;
uuid.unparse = unparse;

module.exports = uuid;

},{"./rng":49}],51:[function(require,module,exports){
module.exports={
  "type": "object",
  "title": "Chiχ Link",
  "properties": {
    "id": {
      "type": "string",
      "required": false
    },
    "source": {
      "type": "object",
      "required": true,
      "properties": {
        "id": {
          "type": "string",
          "required": true
        },
        "port": {
          "type": "string",
          "required": true
        },
        "index": {
          "type": ["string", "number"],
          "required": false
        },
        "settings": {
          "type": "object"
        }
      }
    },
    "target": {
      "type": "object",
      "required": true,
      "properties": {
        "id": {
          "type": "string",
          "required": true
        },
        "port": {
          "type": "string",
          "required": true
        },
        "index": {
          "type": ["string", "number"],
          "required": false
        },
        "settings": {
          "type": "object",
          "properties": {
            "persist": {
              "type": "boolean"
            },
            "sync": {
              "type": "string"
            },
            "cyclic": {
              "type": "boolean"
            }
          }
        }
      }
    },
    "settings": {
      "type": "object",
      "properties": {
        "dispose": {
          "type": "boolean"
        }
      }
    },
    "metadata": {
      "type": "object"
    }
  },
  "additionalProperties": false
}

},{}],52:[function(require,module,exports){
module.exports={
  "type":"object",
  "title":"Chiχ Map",
  "collectionName": "flows",
  "properties":{
    "id": {
      "type":"string",
      "required": false
    },
    "type": {
      "type":"string",
      "required": true
    },
    "env": {
      "type":"string",
      "required": false
    },
    "ns": {
      "type":"string",
      "required": false
    },
    "name": {
      "type":"string",
      "required": false
    },
    "title": {
      "type":"string",
      "required": false
    },
    "description": {
      "type":"string"
    },
    "provider": {
      "type":"string"
    },
    "providers": {
      "type":"object"
    },
    "keywords": {
      "type":"array"
    },
    "nodeDefinitions": {
      "type": "object"
    },
    "ports": {
      "type":"object",
      "properties": {
        "input": {
          "type":"object"
        },
        "output": {
          "type":"object"
        }
      }
    },
    "nodes": {
      "type":"array",
      "title":"Nodes",
      "required": true,
      "items": {
        "type": "object",
        "title": "Node",
        "properties":{
          "id": {
            "type":"string",
            "required": true
          },
          "ns": {
            "type":"string",
            "required": true
          },
          "name": {
            "type":"string",
            "required": true
          },
          "version": {
            "type":"string",
            "required": false
          },
          "context": {
            "type":"object",
            "required": false
          }
        }
      }
    },
    "links": {
      "type":"array",
      "title":"Links",
      "required": false,
      "items": {
        "type": "object",
        "title": "Link",
        "properties":{
          "id": {
            "type":"string",
            "required": false
          },
          "source": {
            "type":"object",
            "required": true,
             "properties":{
               "id": {
                 "type": "string",
                 "required": true
               },
               "port": {
                 "type": "string",
                 "required": true
               },
               "index": {
                 "type": ["string","number"],
                 "required": false
               }
             }
          },
          "target": {
            "type":"object",
            "required": true,
             "properties":{
               "id": {
                 "type": "string",
                 "required": true
               },
               "port": {
                 "type": "string",
                 "required": true
               },
               "index": {
                 "type": ["string","number"],
                 "required": false
               }
             }
          },
          "settings": {
            "persist": {
              "type":"boolean",
              "required": false
            },
            "cyclic": {
              "type":"boolean",
              "required": false
            }
          }
        }
      }
    }
  },
  "additionalProperties": false
}

},{}],53:[function(require,module,exports){
module.exports={
  "type":"object",
  "title":"Chiχ Nodes",
  "properties":{
    "title": {
      "type":"string",
      "required": false
    },
    "description": {
      "type":"string",
      "required": false
    },
    "_id": {
      "type":"string"
    },
    "name": {
      "type":"string",
      "required": true
    },
    "ns": {
      "type":"string",
      "required": true
    },
    "state": {
      "type":"any"
    },
    "phrases": {
      "type":"object"
    },
    "env": {
      "type":"string",
      "enum": ["server","browser","polymer","phonegap"]
    },
    "async": {
      "type":"boolean",
      "required": false
    },
    "dependencies": {
      "type":"object",
      "required": false
    },
    "provider": {
      "required": false,
      "type":"string"
    },
    "providers": {
      "required": false,
      "type":"object"
    },
    "expose": {
      "type":"array",
      "required": false
    },
    "fn": {
      "type":"string",
      "required": false
    },
    "ports": {
      "type":"object",
      "required": true,
      "properties":{
        "input": {
          "type":"object"
        },
        "output": {
          "type":"object"
        },
        "event": {
          "type":"object"
        }
      }
    },
    "type": {
      "enum":["node","flow","provider","data","polymer"],
      "required": false
    }
  },
  "additionalProperties": false
}

},{}],54:[function(require,module,exports){
module.exports={
  "type":"object",
  "title":"Chiχ Stage",
  "properties":{
    "id": {
      "type":"string",
      "required": false
    },
    "env": {
      "type":"string",
      "required": false
    },
    "title": {
      "type":"string",
      "required": true
    },
    "description": {
      "type":"string",
      "required": true
    },
    "actors": {
      "type":"array",
      "title":"Actors",
      "required": true,
      "items": {
        "type": "object",
        "title": "Actor",
        "properties":{
          "id": {
            "type":"string",
            "required": true
          },
          "ns": {
            "type":"string",
            "required": true
          },
          "name": {
            "type":"string",
            "required": true
          },
          "version": {
            "type":"string",
            "required": false
          },
          "context": {
            "type":"object",
            "required": false
          }
        }
      }
    },
    "links": {
      "type":"array",
      "title":"Links",
      "required": true,
      "items": {
        "type": "object",
        "title": "Link",
        "properties":{
          "id": {
            "type":"string",
            "required": false
          },
          "source": {
            "type":"string",
            "required": true
          },
          "target": {
            "type":"string",
            "required": true
          },
          "out": {
            "type":"string",
            "required": false
          },
          "in": {
            "type":"string",
            "required": false
          },
          "settings": {
            "persist": {
              "type":"boolean",
              "required": false
            },
            "cyclic": {
              "type":"boolean",
              "required": false
            }
          }
        }
      }
    }
  }
}

},{}],55:[function(require,module,exports){
'use strict';

/**
 *
 * Ok, this should be a general listener interface.
 *
 * One who will use it is the Actor.
 * But I want to be able to do the same for e.g. Loader.
 *
 * They will all be in chix-monitor-*
 *
 * npmlog =  Listener(instance, options);
 *
 * The return is just in case you want to do other stuff.
 *
 * e.g. fbpx wants to add this to npmlog:
 *
 * Logger.level = program.verbose ? 'verbose' : program.debug;
 *
 */
// function NpmLogActorMonitor(actor, opts) {
module.exports = function NpmLogActorMonitor(Logger, actor) {

   // TODO: just make an NpmLogIOMonitor.
   var ioHandler = actor.ioHandler;

   actor.on('removeLink', function(event) {
     Logger.debug(
       event.node ? event.node.identifier : 'Some Actor',
       'removed link'
     );
   });

   // Ok emiting each and every output I don't like for the IOHandler.
   // but whatever can change it later.
   ioHandler.on('output', function(data) {

     // I don't like this data.out.port thing vs data.port
     switch(data.port) {

        case ':plug':
         Logger.debug(
           data.node.identifier,
           'port %s plugged (%d)',
           data.out.read().port,
           data.out.read().connections);
        break;

        case ':unplug':
         Logger.debug(
           data.node.identifier,
           'port %s unplugged (%d)',
           data.out.read().port,
           data.out.read().connections);
        break;

        case ':portFill':
         Logger.info(
           data.node.identifier,
           'port %s filled with data',
           data.out.read().port);
        break;

        case ':contextUpdate':
         Logger.info(
           data.node.identifier,
           'port %s filled with context',
           data.out.read().port);
        break;

        case ':inputValidated':
          Logger.debug(data.node.identifier, 'input validated');
        break;

        case ':start':
          Logger.info(data.node.identifier, 'START');
        break;

        case ':freePort':
          Logger.debug(data.node.identifier, 'free port %s', data.out.read().port);
        break;

/*
       case ':queue':
         Logger.debug(
           data.node,
           'queue: %s',
           data.port
         );
       break;
*/

       case ':openPort':
         Logger.info(
           data.node.identifier,
           'opened port %s (%d)',
           data.out.read().port,
           data.out.read().connections
           );
       break;

       case ':closePort':
         Logger.info(
           data.node.identifier,
           'closed port %s',
           data.out.read().port
           );
       break;

       case ':index':
         Logger.info(
           data.node.identifier,
           '[%s] set on port `%s`',
           data.out.read().index,
           data.out.read().port
           );
       break;

       case ':nodeComplete':
         // console.log('nodeComplete', data);
         Logger.info(data.node.identifier, 'completed');
       break;

       case ':portReject':
         Logger.debug(
           data.node.identifier,
           'rejected input on port %s',
           data.out.read().port
         );
       break;

       case ':inputRequired':
         Logger.error(
           data.node.identifier,
           'input required on port %s',
           data.out.read().port);
       break;

       case ':error':
         Logger.error(
           data.node.identifier,
           data.out.read().msg
         );
       break;

       case ':nodeTimeout':
         Logger.error(
           data.node.identifier,
           'node timeout'
         );
       break;

       case ':executed':
         Logger.info(
           data.node.identifier,
           'EXECUTED'
         );
       break;

       case ':inputTimeout':
         Logger.info(
           data.node.identifier,
           'input timeout, got %s need %s',
           Object.keys(data.node.input).join(', '),
           data.node.openPorts.join(', '));
       break;

       default:
         // TODO: if the above misses a system port it will be reported
         //       as default normal output.
         Logger.info(data.node.identifier, 'output on port %s', data.port);
       break;

     }

   });

   return Logger;

};

},{}],56:[function(require,module,exports){
'use strict';

/**
 *
 * NpmLog monitor for the Loader
 *
 */
module.exports = function NpmLogLoaderMonitor(Logger, loader) {

  loader.on('loadUrl', function(data) {
    Logger.info( 'loadUrl', data.url);
  });

  loader.on('loadFile', function(data) {
    Logger.info( 'loadFile', data.path);
  });

  loader.on('loadCache', function(data) {
    Logger.debug( 'cache', 'loaded cache file %s', data.file);
  });

  loader.on('purgeCache', function(data) {
    Logger.debug( 'cache', 'purged cache file %s', data.file);
  });

  loader.on('writeCache', function(data) {
    Logger.debug( 'cache', 'wrote cache file %s', data.file);
  });

  return Logger;

};

},{}],"chix-monitor-npmlog":[function(require,module,exports){
module.exports=require('HNG52E');
},{}],"HNG52E":[function(require,module,exports){
exports.Actor = require('./lib/actor');
exports.Loader = require('./lib/loader');

},{"./lib/actor":55,"./lib/loader":56}],59:[function(require,module,exports){
"use strict";
/*globals Handlebars: true */
var Handlebars = require("./handlebars.runtime")["default"];

// Compiler imports
var AST = require("./handlebars/compiler/ast")["default"];
var Parser = require("./handlebars/compiler/base").parser;
var parse = require("./handlebars/compiler/base").parse;
var Compiler = require("./handlebars/compiler/compiler").Compiler;
var compile = require("./handlebars/compiler/compiler").compile;
var precompile = require("./handlebars/compiler/compiler").precompile;
var JavaScriptCompiler = require("./handlebars/compiler/javascript-compiler")["default"];

var _create = Handlebars.create;
var create = function() {
  var hb = _create();

  hb.compile = function(input, options) {
    return compile(input, options, hb);
  };
  hb.precompile = function (input, options) {
    return precompile(input, options, hb);
  };

  hb.AST = AST;
  hb.Compiler = Compiler;
  hb.JavaScriptCompiler = JavaScriptCompiler;
  hb.Parser = Parser;
  hb.parse = parse;

  return hb;
};

Handlebars = create();
Handlebars.create = create;

Handlebars['default'] = Handlebars;

exports["default"] = Handlebars;
},{"./handlebars.runtime":60,"./handlebars/compiler/ast":62,"./handlebars/compiler/base":63,"./handlebars/compiler/compiler":64,"./handlebars/compiler/javascript-compiler":66}],60:[function(require,module,exports){
"use strict";
/*globals Handlebars: true */
var base = require("./handlebars/base");

// Each of these augment the Handlebars object. No need to setup here.
// (This is done to easily share code between commonjs and browse envs)
var SafeString = require("./handlebars/safe-string")["default"];
var Exception = require("./handlebars/exception")["default"];
var Utils = require("./handlebars/utils");
var runtime = require("./handlebars/runtime");

// For compatibility and usage outside of module systems, make the Handlebars object a namespace
var create = function() {
  var hb = new base.HandlebarsEnvironment();

  Utils.extend(hb, base);
  hb.SafeString = SafeString;
  hb.Exception = Exception;
  hb.Utils = Utils;
  hb.escapeExpression = Utils.escapeExpression;

  hb.VM = runtime;
  hb.template = function(spec) {
    return runtime.template(spec, hb);
  };

  return hb;
};

var Handlebars = create();
Handlebars.create = create;

Handlebars['default'] = Handlebars;

exports["default"] = Handlebars;
},{"./handlebars/base":61,"./handlebars/exception":70,"./handlebars/runtime":71,"./handlebars/safe-string":72,"./handlebars/utils":73}],61:[function(require,module,exports){
"use strict";
var Utils = require("./utils");
var Exception = require("./exception")["default"];

var VERSION = "2.0.0";
exports.VERSION = VERSION;var COMPILER_REVISION = 6;
exports.COMPILER_REVISION = COMPILER_REVISION;
var REVISION_CHANGES = {
  1: '<= 1.0.rc.2', // 1.0.rc.2 is actually rev2 but doesn't report it
  2: '== 1.0.0-rc.3',
  3: '== 1.0.0-rc.4',
  4: '== 1.x.x',
  5: '== 2.0.0-alpha.x',
  6: '>= 2.0.0-beta.1'
};
exports.REVISION_CHANGES = REVISION_CHANGES;
var isArray = Utils.isArray,
    isFunction = Utils.isFunction,
    toString = Utils.toString,
    objectType = '[object Object]';

function HandlebarsEnvironment(helpers, partials) {
  this.helpers = helpers || {};
  this.partials = partials || {};

  registerDefaultHelpers(this);
}

exports.HandlebarsEnvironment = HandlebarsEnvironment;HandlebarsEnvironment.prototype = {
  constructor: HandlebarsEnvironment,

  logger: logger,
  log: log,

  registerHelper: function(name, fn) {
    if (toString.call(name) === objectType) {
      if (fn) { throw new Exception('Arg not supported with multiple helpers'); }
      Utils.extend(this.helpers, name);
    } else {
      this.helpers[name] = fn;
    }
  },
  unregisterHelper: function(name) {
    delete this.helpers[name];
  },

  registerPartial: function(name, partial) {
    if (toString.call(name) === objectType) {
      Utils.extend(this.partials,  name);
    } else {
      this.partials[name] = partial;
    }
  },
  unregisterPartial: function(name) {
    delete this.partials[name];
  }
};

function registerDefaultHelpers(instance) {
  instance.registerHelper('helperMissing', function(/* [args, ]options */) {
    if(arguments.length === 1) {
      // A missing field in a {{foo}} constuct.
      return undefined;
    } else {
      // Someone is actually trying to call something, blow up.
      throw new Exception("Missing helper: '" + arguments[arguments.length-1].name + "'");
    }
  });

  instance.registerHelper('blockHelperMissing', function(context, options) {
    var inverse = options.inverse,
        fn = options.fn;

    if(context === true) {
      return fn(this);
    } else if(context === false || context == null) {
      return inverse(this);
    } else if (isArray(context)) {
      if(context.length > 0) {
        if (options.ids) {
          options.ids = [options.name];
        }

        return instance.helpers.each(context, options);
      } else {
        return inverse(this);
      }
    } else {
      if (options.data && options.ids) {
        var data = createFrame(options.data);
        data.contextPath = Utils.appendContextPath(options.data.contextPath, options.name);
        options = {data: data};
      }

      return fn(context, options);
    }
  });

  instance.registerHelper('each', function(context, options) {
    if (!options) {
      throw new Exception('Must pass iterator to #each');
    }

    var fn = options.fn, inverse = options.inverse;
    var i = 0, ret = "", data;

    var contextPath;
    if (options.data && options.ids) {
      contextPath = Utils.appendContextPath(options.data.contextPath, options.ids[0]) + '.';
    }

    if (isFunction(context)) { context = context.call(this); }

    if (options.data) {
      data = createFrame(options.data);
    }

    if(context && typeof context === 'object') {
      if (isArray(context)) {
        for(var j = context.length; i<j; i++) {
          if (data) {
            data.index = i;
            data.first = (i === 0);
            data.last  = (i === (context.length-1));

            if (contextPath) {
              data.contextPath = contextPath + i;
            }
          }
          ret = ret + fn(context[i], { data: data });
        }
      } else {
        for(var key in context) {
          if(context.hasOwnProperty(key)) {
            if(data) {
              data.key = key;
              data.index = i;
              data.first = (i === 0);

              if (contextPath) {
                data.contextPath = contextPath + key;
              }
            }
            ret = ret + fn(context[key], {data: data});
            i++;
          }
        }
      }
    }

    if(i === 0){
      ret = inverse(this);
    }

    return ret;
  });

  instance.registerHelper('if', function(conditional, options) {
    if (isFunction(conditional)) { conditional = conditional.call(this); }

    // Default behavior is to render the positive path if the value is truthy and not empty.
    // The `includeZero` option may be set to treat the condtional as purely not empty based on the
    // behavior of isEmpty. Effectively this determines if 0 is handled by the positive path or negative.
    if ((!options.hash.includeZero && !conditional) || Utils.isEmpty(conditional)) {
      return options.inverse(this);
    } else {
      return options.fn(this);
    }
  });

  instance.registerHelper('unless', function(conditional, options) {
    return instance.helpers['if'].call(this, conditional, {fn: options.inverse, inverse: options.fn, hash: options.hash});
  });

  instance.registerHelper('with', function(context, options) {
    if (isFunction(context)) { context = context.call(this); }

    var fn = options.fn;

    if (!Utils.isEmpty(context)) {
      if (options.data && options.ids) {
        var data = createFrame(options.data);
        data.contextPath = Utils.appendContextPath(options.data.contextPath, options.ids[0]);
        options = {data:data};
      }

      return fn(context, options);
    } else {
      return options.inverse(this);
    }
  });

  instance.registerHelper('log', function(message, options) {
    var level = options.data && options.data.level != null ? parseInt(options.data.level, 10) : 1;
    instance.log(level, message);
  });

  instance.registerHelper('lookup', function(obj, field) {
    return obj && obj[field];
  });
}

var logger = {
  methodMap: { 0: 'debug', 1: 'info', 2: 'warn', 3: 'error' },

  // State enum
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  level: 3,

  // can be overridden in the host environment
  log: function(level, message) {
    if (logger.level <= level) {
      var method = logger.methodMap[level];
      if (typeof console !== 'undefined' && console[method]) {
        console[method].call(console, message);
      }
    }
  }
};
exports.logger = logger;
var log = logger.log;
exports.log = log;
var createFrame = function(object) {
  var frame = Utils.extend({}, object);
  frame._parent = object;
  return frame;
};
exports.createFrame = createFrame;
},{"./exception":70,"./utils":73}],62:[function(require,module,exports){
"use strict";
var Exception = require("../exception")["default"];

function LocationInfo(locInfo) {
  locInfo = locInfo || {};
  this.firstLine   = locInfo.first_line;
  this.firstColumn = locInfo.first_column;
  this.lastColumn  = locInfo.last_column;
  this.lastLine    = locInfo.last_line;
}

var AST = {
  ProgramNode: function(statements, strip, locInfo) {
    LocationInfo.call(this, locInfo);
    this.type = "program";
    this.statements = statements;
    this.strip = strip;
  },

  MustacheNode: function(rawParams, hash, open, strip, locInfo) {
    LocationInfo.call(this, locInfo);
    this.type = "mustache";
    this.strip = strip;

    // Open may be a string parsed from the parser or a passed boolean flag
    if (open != null && open.charAt) {
      // Must use charAt to support IE pre-10
      var escapeFlag = open.charAt(3) || open.charAt(2);
      this.escaped = escapeFlag !== '{' && escapeFlag !== '&';
    } else {
      this.escaped = !!open;
    }

    if (rawParams instanceof AST.SexprNode) {
      this.sexpr = rawParams;
    } else {
      // Support old AST API
      this.sexpr = new AST.SexprNode(rawParams, hash);
    }

    // Support old AST API that stored this info in MustacheNode
    this.id = this.sexpr.id;
    this.params = this.sexpr.params;
    this.hash = this.sexpr.hash;
    this.eligibleHelper = this.sexpr.eligibleHelper;
    this.isHelper = this.sexpr.isHelper;
  },

  SexprNode: function(rawParams, hash, locInfo) {
    LocationInfo.call(this, locInfo);

    this.type = "sexpr";
    this.hash = hash;

    var id = this.id = rawParams[0];
    var params = this.params = rawParams.slice(1);

    // a mustache is definitely a helper if:
    // * it is an eligible helper, and
    // * it has at least one parameter or hash segment
    this.isHelper = !!(params.length || hash);

    // a mustache is an eligible helper if:
    // * its id is simple (a single part, not `this` or `..`)
    this.eligibleHelper = this.isHelper || id.isSimple;

    // if a mustache is an eligible helper but not a definite
    // helper, it is ambiguous, and will be resolved in a later
    // pass or at runtime.
  },

  PartialNode: function(partialName, context, hash, strip, locInfo) {
    LocationInfo.call(this, locInfo);
    this.type         = "partial";
    this.partialName  = partialName;
    this.context      = context;
    this.hash = hash;
    this.strip = strip;

    this.strip.inlineStandalone = true;
  },

  BlockNode: function(mustache, program, inverse, strip, locInfo) {
    LocationInfo.call(this, locInfo);

    this.type = 'block';
    this.mustache = mustache;
    this.program  = program;
    this.inverse  = inverse;
    this.strip = strip;

    if (inverse && !program) {
      this.isInverse = true;
    }
  },

  RawBlockNode: function(mustache, content, close, locInfo) {
    LocationInfo.call(this, locInfo);

    if (mustache.sexpr.id.original !== close) {
      throw new Exception(mustache.sexpr.id.original + " doesn't match " + close, this);
    }

    content = new AST.ContentNode(content, locInfo);

    this.type = 'block';
    this.mustache = mustache;
    this.program = new AST.ProgramNode([content], {}, locInfo);
  },

  ContentNode: function(string, locInfo) {
    LocationInfo.call(this, locInfo);
    this.type = "content";
    this.original = this.string = string;
  },

  HashNode: function(pairs, locInfo) {
    LocationInfo.call(this, locInfo);
    this.type = "hash";
    this.pairs = pairs;
  },

  IdNode: function(parts, locInfo) {
    LocationInfo.call(this, locInfo);
    this.type = "ID";

    var original = "",
        dig = [],
        depth = 0,
        depthString = '';

    for(var i=0,l=parts.length; i<l; i++) {
      var part = parts[i].part;
      original += (parts[i].separator || '') + part;

      if (part === ".." || part === "." || part === "this") {
        if (dig.length > 0) {
          throw new Exception("Invalid path: " + original, this);
        } else if (part === "..") {
          depth++;
          depthString += '../';
        } else {
          this.isScoped = true;
        }
      } else {
        dig.push(part);
      }
    }

    this.original = original;
    this.parts    = dig;
    this.string   = dig.join('.');
    this.depth    = depth;
    this.idName   = depthString + this.string;

    // an ID is simple if it only has one part, and that part is not
    // `..` or `this`.
    this.isSimple = parts.length === 1 && !this.isScoped && depth === 0;

    this.stringModeValue = this.string;
  },

  PartialNameNode: function(name, locInfo) {
    LocationInfo.call(this, locInfo);
    this.type = "PARTIAL_NAME";
    this.name = name.original;
  },

  DataNode: function(id, locInfo) {
    LocationInfo.call(this, locInfo);
    this.type = "DATA";
    this.id = id;
    this.stringModeValue = id.stringModeValue;
    this.idName = '@' + id.stringModeValue;
  },

  StringNode: function(string, locInfo) {
    LocationInfo.call(this, locInfo);
    this.type = "STRING";
    this.original =
      this.string =
      this.stringModeValue = string;
  },

  NumberNode: function(number, locInfo) {
    LocationInfo.call(this, locInfo);
    this.type = "NUMBER";
    this.original =
      this.number = number;
    this.stringModeValue = Number(number);
  },

  BooleanNode: function(bool, locInfo) {
    LocationInfo.call(this, locInfo);
    this.type = "BOOLEAN";
    this.bool = bool;
    this.stringModeValue = bool === "true";
  },

  CommentNode: function(comment, locInfo) {
    LocationInfo.call(this, locInfo);
    this.type = "comment";
    this.comment = comment;

    this.strip = {
      inlineStandalone: true
    };
  }
};


// Must be exported as an object rather than the root of the module as the jison lexer
// most modify the object to operate properly.
exports["default"] = AST;
},{"../exception":70}],63:[function(require,module,exports){
"use strict";
var parser = require("./parser")["default"];
var AST = require("./ast")["default"];
var Helpers = require("./helpers");
var extend = require("../utils").extend;

exports.parser = parser;

var yy = {};
extend(yy, Helpers, AST);

function parse(input) {
  // Just return if an already-compile AST was passed in.
  if (input.constructor === AST.ProgramNode) { return input; }

  parser.yy = yy;

  return parser.parse(input);
}

exports.parse = parse;
},{"../utils":73,"./ast":62,"./helpers":65,"./parser":67}],64:[function(require,module,exports){
"use strict";
var Exception = require("../exception")["default"];
var isArray = require("../utils").isArray;

var slice = [].slice;

function Compiler() {}

exports.Compiler = Compiler;// the foundHelper register will disambiguate helper lookup from finding a
// function in a context. This is necessary for mustache compatibility, which
// requires that context functions in blocks are evaluated by blockHelperMissing,
// and then proceed as if the resulting value was provided to blockHelperMissing.

Compiler.prototype = {
  compiler: Compiler,

  equals: function(other) {
    var len = this.opcodes.length;
    if (other.opcodes.length !== len) {
      return false;
    }

    for (var i = 0; i < len; i++) {
      var opcode = this.opcodes[i],
          otherOpcode = other.opcodes[i];
      if (opcode.opcode !== otherOpcode.opcode || !argEquals(opcode.args, otherOpcode.args)) {
        return false;
      }
    }

    // We know that length is the same between the two arrays because they are directly tied
    // to the opcode behavior above.
    len = this.children.length;
    for (i = 0; i < len; i++) {
      if (!this.children[i].equals(other.children[i])) {
        return false;
      }
    }

    return true;
  },

  guid: 0,

  compile: function(program, options) {
    this.opcodes = [];
    this.children = [];
    this.depths = {list: []};
    this.options = options;
    this.stringParams = options.stringParams;
    this.trackIds = options.trackIds;

    // These changes will propagate to the other compiler components
    var knownHelpers = this.options.knownHelpers;
    this.options.knownHelpers = {
      'helperMissing': true,
      'blockHelperMissing': true,
      'each': true,
      'if': true,
      'unless': true,
      'with': true,
      'log': true,
      'lookup': true
    };
    if (knownHelpers) {
      for (var name in knownHelpers) {
        this.options.knownHelpers[name] = knownHelpers[name];
      }
    }

    return this.accept(program);
  },

  accept: function(node) {
    return this[node.type](node);
  },

  program: function(program) {
    var statements = program.statements;

    for(var i=0, l=statements.length; i<l; i++) {
      this.accept(statements[i]);
    }
    this.isSimple = l === 1;

    this.depths.list = this.depths.list.sort(function(a, b) {
      return a - b;
    });

    return this;
  },

  compileProgram: function(program) {
    var result = new this.compiler().compile(program, this.options);
    var guid = this.guid++, depth;

    this.usePartial = this.usePartial || result.usePartial;

    this.children[guid] = result;

    for(var i=0, l=result.depths.list.length; i<l; i++) {
      depth = result.depths.list[i];

      if(depth < 2) { continue; }
      else { this.addDepth(depth - 1); }
    }

    return guid;
  },

  block: function(block) {
    var mustache = block.mustache,
        program = block.program,
        inverse = block.inverse;

    if (program) {
      program = this.compileProgram(program);
    }

    if (inverse) {
      inverse = this.compileProgram(inverse);
    }

    var sexpr = mustache.sexpr;
    var type = this.classifySexpr(sexpr);

    if (type === "helper") {
      this.helperSexpr(sexpr, program, inverse);
    } else if (type === "simple") {
      this.simpleSexpr(sexpr);

      // now that the simple mustache is resolved, we need to
      // evaluate it by executing `blockHelperMissing`
      this.opcode('pushProgram', program);
      this.opcode('pushProgram', inverse);
      this.opcode('emptyHash');
      this.opcode('blockValue', sexpr.id.original);
    } else {
      this.ambiguousSexpr(sexpr, program, inverse);

      // now that the simple mustache is resolved, we need to
      // evaluate it by executing `blockHelperMissing`
      this.opcode('pushProgram', program);
      this.opcode('pushProgram', inverse);
      this.opcode('emptyHash');
      this.opcode('ambiguousBlockValue');
    }

    this.opcode('append');
  },

  hash: function(hash) {
    var pairs = hash.pairs, i, l;

    this.opcode('pushHash');

    for(i=0, l=pairs.length; i<l; i++) {
      this.pushParam(pairs[i][1]);
    }
    while(i--) {
      this.opcode('assignToHash', pairs[i][0]);
    }
    this.opcode('popHash');
  },

  partial: function(partial) {
    var partialName = partial.partialName;
    this.usePartial = true;

    if (partial.hash) {
      this.accept(partial.hash);
    } else {
      this.opcode('push', 'undefined');
    }

    if (partial.context) {
      this.accept(partial.context);
    } else {
      this.opcode('getContext', 0);
      this.opcode('pushContext');
    }

    this.opcode('invokePartial', partialName.name, partial.indent || '');
    this.opcode('append');
  },

  content: function(content) {
    if (content.string) {
      this.opcode('appendContent', content.string);
    }
  },

  mustache: function(mustache) {
    this.sexpr(mustache.sexpr);

    if(mustache.escaped && !this.options.noEscape) {
      this.opcode('appendEscaped');
    } else {
      this.opcode('append');
    }
  },

  ambiguousSexpr: function(sexpr, program, inverse) {
    var id = sexpr.id,
        name = id.parts[0],
        isBlock = program != null || inverse != null;

    this.opcode('getContext', id.depth);

    this.opcode('pushProgram', program);
    this.opcode('pushProgram', inverse);

    this.ID(id);

    this.opcode('invokeAmbiguous', name, isBlock);
  },

  simpleSexpr: function(sexpr) {
    var id = sexpr.id;

    if (id.type === 'DATA') {
      this.DATA(id);
    } else if (id.parts.length) {
      this.ID(id);
    } else {
      // Simplified ID for `this`
      this.addDepth(id.depth);
      this.opcode('getContext', id.depth);
      this.opcode('pushContext');
    }

    this.opcode('resolvePossibleLambda');
  },

  helperSexpr: function(sexpr, program, inverse) {
    var params = this.setupFullMustacheParams(sexpr, program, inverse),
        id = sexpr.id,
        name = id.parts[0];

    if (this.options.knownHelpers[name]) {
      this.opcode('invokeKnownHelper', params.length, name);
    } else if (this.options.knownHelpersOnly) {
      throw new Exception("You specified knownHelpersOnly, but used the unknown helper " + name, sexpr);
    } else {
      id.falsy = true;

      this.ID(id);
      this.opcode('invokeHelper', params.length, id.original, id.isSimple);
    }
  },

  sexpr: function(sexpr) {
    var type = this.classifySexpr(sexpr);

    if (type === "simple") {
      this.simpleSexpr(sexpr);
    } else if (type === "helper") {
      this.helperSexpr(sexpr);
    } else {
      this.ambiguousSexpr(sexpr);
    }
  },

  ID: function(id) {
    this.addDepth(id.depth);
    this.opcode('getContext', id.depth);

    var name = id.parts[0];
    if (!name) {
      // Context reference, i.e. `{{foo .}}` or `{{foo ..}}`
      this.opcode('pushContext');
    } else {
      this.opcode('lookupOnContext', id.parts, id.falsy, id.isScoped);
    }
  },

  DATA: function(data) {
    this.options.data = true;
    this.opcode('lookupData', data.id.depth, data.id.parts);
  },

  STRING: function(string) {
    this.opcode('pushString', string.string);
  },

  NUMBER: function(number) {
    this.opcode('pushLiteral', number.number);
  },

  BOOLEAN: function(bool) {
    this.opcode('pushLiteral', bool.bool);
  },

  comment: function() {},

  // HELPERS
  opcode: function(name) {
    this.opcodes.push({ opcode: name, args: slice.call(arguments, 1) });
  },

  addDepth: function(depth) {
    if(depth === 0) { return; }

    if(!this.depths[depth]) {
      this.depths[depth] = true;
      this.depths.list.push(depth);
    }
  },

  classifySexpr: function(sexpr) {
    var isHelper   = sexpr.isHelper;
    var isEligible = sexpr.eligibleHelper;
    var options    = this.options;

    // if ambiguous, we can possibly resolve the ambiguity now
    // An eligible helper is one that does not have a complex path, i.e. `this.foo`, `../foo` etc.
    if (isEligible && !isHelper) {
      var name = sexpr.id.parts[0];

      if (options.knownHelpers[name]) {
        isHelper = true;
      } else if (options.knownHelpersOnly) {
        isEligible = false;
      }
    }

    if (isHelper) { return "helper"; }
    else if (isEligible) { return "ambiguous"; }
    else { return "simple"; }
  },

  pushParams: function(params) {
    for(var i=0, l=params.length; i<l; i++) {
      this.pushParam(params[i]);
    }
  },

  pushParam: function(val) {
    if (this.stringParams) {
      if(val.depth) {
        this.addDepth(val.depth);
      }
      this.opcode('getContext', val.depth || 0);
      this.opcode('pushStringParam', val.stringModeValue, val.type);

      if (val.type === 'sexpr') {
        // Subexpressions get evaluated and passed in
        // in string params mode.
        this.sexpr(val);
      }
    } else {
      if (this.trackIds) {
        this.opcode('pushId', val.type, val.idName || val.stringModeValue);
      }
      this.accept(val);
    }
  },

  setupFullMustacheParams: function(sexpr, program, inverse) {
    var params = sexpr.params;
    this.pushParams(params);

    this.opcode('pushProgram', program);
    this.opcode('pushProgram', inverse);

    if (sexpr.hash) {
      this.hash(sexpr.hash);
    } else {
      this.opcode('emptyHash');
    }

    return params;
  }
};

function precompile(input, options, env) {
  if (input == null || (typeof input !== 'string' && input.constructor !== env.AST.ProgramNode)) {
    throw new Exception("You must pass a string or Handlebars AST to Handlebars.precompile. You passed " + input);
  }

  options = options || {};
  if (!('data' in options)) {
    options.data = true;
  }
  if (options.compat) {
    options.useDepths = true;
  }

  var ast = env.parse(input);
  var environment = new env.Compiler().compile(ast, options);
  return new env.JavaScriptCompiler().compile(environment, options);
}

exports.precompile = precompile;function compile(input, options, env) {
  if (input == null || (typeof input !== 'string' && input.constructor !== env.AST.ProgramNode)) {
    throw new Exception("You must pass a string or Handlebars AST to Handlebars.compile. You passed " + input);
  }

  options = options || {};

  if (!('data' in options)) {
    options.data = true;
  }
  if (options.compat) {
    options.useDepths = true;
  }

  var compiled;

  function compileInput() {
    var ast = env.parse(input);
    var environment = new env.Compiler().compile(ast, options);
    var templateSpec = new env.JavaScriptCompiler().compile(environment, options, undefined, true);
    return env.template(templateSpec);
  }

  // Template is only compiled on first use and cached after that point.
  var ret = function(context, options) {
    if (!compiled) {
      compiled = compileInput();
    }
    return compiled.call(this, context, options);
  };
  ret._setup = function(options) {
    if (!compiled) {
      compiled = compileInput();
    }
    return compiled._setup(options);
  };
  ret._child = function(i, data, depths) {
    if (!compiled) {
      compiled = compileInput();
    }
    return compiled._child(i, data, depths);
  };
  return ret;
}

exports.compile = compile;function argEquals(a, b) {
  if (a === b) {
    return true;
  }

  if (isArray(a) && isArray(b) && a.length === b.length) {
    for (var i = 0; i < a.length; i++) {
      if (!argEquals(a[i], b[i])) {
        return false;
      }
    }
    return true;
  }
}
},{"../exception":70,"../utils":73}],65:[function(require,module,exports){
"use strict";
var Exception = require("../exception")["default"];

function stripFlags(open, close) {
  return {
    left: open.charAt(2) === '~',
    right: close.charAt(close.length-3) === '~'
  };
}

exports.stripFlags = stripFlags;
function prepareBlock(mustache, program, inverseAndProgram, close, inverted, locInfo) {
  /*jshint -W040 */
  if (mustache.sexpr.id.original !== close.path.original) {
    throw new Exception(mustache.sexpr.id.original + ' doesn\'t match ' + close.path.original, mustache);
  }

  var inverse = inverseAndProgram && inverseAndProgram.program;

  var strip = {
    left: mustache.strip.left,
    right: close.strip.right,

    // Determine the standalone candiacy. Basically flag our content as being possibly standalone
    // so our parent can determine if we actually are standalone
    openStandalone: isNextWhitespace(program.statements),
    closeStandalone: isPrevWhitespace((inverse || program).statements)
  };

  if (mustache.strip.right) {
    omitRight(program.statements, null, true);
  }

  if (inverse) {
    var inverseStrip = inverseAndProgram.strip;

    if (inverseStrip.left) {
      omitLeft(program.statements, null, true);
    }
    if (inverseStrip.right) {
      omitRight(inverse.statements, null, true);
    }
    if (close.strip.left) {
      omitLeft(inverse.statements, null, true);
    }

    // Find standalone else statments
    if (isPrevWhitespace(program.statements)
        && isNextWhitespace(inverse.statements)) {

      omitLeft(program.statements);
      omitRight(inverse.statements);
    }
  } else {
    if (close.strip.left) {
      omitLeft(program.statements, null, true);
    }
  }

  if (inverted) {
    return new this.BlockNode(mustache, inverse, program, strip, locInfo);
  } else {
    return new this.BlockNode(mustache, program, inverse, strip, locInfo);
  }
}

exports.prepareBlock = prepareBlock;
function prepareProgram(statements, isRoot) {
  for (var i = 0, l = statements.length; i < l; i++) {
    var current = statements[i],
        strip = current.strip;

    if (!strip) {
      continue;
    }

    var _isPrevWhitespace = isPrevWhitespace(statements, i, isRoot, current.type === 'partial'),
        _isNextWhitespace = isNextWhitespace(statements, i, isRoot),

        openStandalone = strip.openStandalone && _isPrevWhitespace,
        closeStandalone = strip.closeStandalone && _isNextWhitespace,
        inlineStandalone = strip.inlineStandalone && _isPrevWhitespace && _isNextWhitespace;

    if (strip.right) {
      omitRight(statements, i, true);
    }
    if (strip.left) {
      omitLeft(statements, i, true);
    }

    if (inlineStandalone) {
      omitRight(statements, i);

      if (omitLeft(statements, i)) {
        // If we are on a standalone node, save the indent info for partials
        if (current.type === 'partial') {
          current.indent = (/([ \t]+$)/).exec(statements[i-1].original) ? RegExp.$1 : '';
        }
      }
    }
    if (openStandalone) {
      omitRight((current.program || current.inverse).statements);

      // Strip out the previous content node if it's whitespace only
      omitLeft(statements, i);
    }
    if (closeStandalone) {
      // Always strip the next node
      omitRight(statements, i);

      omitLeft((current.inverse || current.program).statements);
    }
  }

  return statements;
}

exports.prepareProgram = prepareProgram;function isPrevWhitespace(statements, i, isRoot) {
  if (i === undefined) {
    i = statements.length;
  }

  // Nodes that end with newlines are considered whitespace (but are special
  // cased for strip operations)
  var prev = statements[i-1],
      sibling = statements[i-2];
  if (!prev) {
    return isRoot;
  }

  if (prev.type === 'content') {
    return (sibling || !isRoot ? (/\r?\n\s*?$/) : (/(^|\r?\n)\s*?$/)).test(prev.original);
  }
}
function isNextWhitespace(statements, i, isRoot) {
  if (i === undefined) {
    i = -1;
  }

  var next = statements[i+1],
      sibling = statements[i+2];
  if (!next) {
    return isRoot;
  }

  if (next.type === 'content') {
    return (sibling || !isRoot ? (/^\s*?\r?\n/) : (/^\s*?(\r?\n|$)/)).test(next.original);
  }
}

// Marks the node to the right of the position as omitted.
// I.e. {{foo}}' ' will mark the ' ' node as omitted.
//
// If i is undefined, then the first child will be marked as such.
//
// If mulitple is truthy then all whitespace will be stripped out until non-whitespace
// content is met.
function omitRight(statements, i, multiple) {
  var current = statements[i == null ? 0 : i + 1];
  if (!current || current.type !== 'content' || (!multiple && current.rightStripped)) {
    return;
  }

  var original = current.string;
  current.string = current.string.replace(multiple ? (/^\s+/) : (/^[ \t]*\r?\n?/), '');
  current.rightStripped = current.string !== original;
}

// Marks the node to the left of the position as omitted.
// I.e. ' '{{foo}} will mark the ' ' node as omitted.
//
// If i is undefined then the last child will be marked as such.
//
// If mulitple is truthy then all whitespace will be stripped out until non-whitespace
// content is met.
function omitLeft(statements, i, multiple) {
  var current = statements[i == null ? statements.length - 1 : i - 1];
  if (!current || current.type !== 'content' || (!multiple && current.leftStripped)) {
    return;
  }

  // We omit the last node if it's whitespace only and not preceeded by a non-content node.
  var original = current.string;
  current.string = current.string.replace(multiple ? (/\s+$/) : (/[ \t]+$/), '');
  current.leftStripped = current.string !== original;
  return current.leftStripped;
}
},{"../exception":70}],66:[function(require,module,exports){
"use strict";
var COMPILER_REVISION = require("../base").COMPILER_REVISION;
var REVISION_CHANGES = require("../base").REVISION_CHANGES;
var Exception = require("../exception")["default"];

function Literal(value) {
  this.value = value;
}

function JavaScriptCompiler() {}

JavaScriptCompiler.prototype = {
  // PUBLIC API: You can override these methods in a subclass to provide
  // alternative compiled forms for name lookup and buffering semantics
  nameLookup: function(parent, name /* , type*/) {
    if (JavaScriptCompiler.isValidJavaScriptVariableName(name)) {
      return parent + "." + name;
    } else {
      return parent + "['" + name + "']";
    }
  },
  depthedLookup: function(name) {
    this.aliases.lookup = 'this.lookup';

    return 'lookup(depths, "' + name + '")';
  },

  compilerInfo: function() {
    var revision = COMPILER_REVISION,
        versions = REVISION_CHANGES[revision];
    return [revision, versions];
  },

  appendToBuffer: function(string) {
    if (this.environment.isSimple) {
      return "return " + string + ";";
    } else {
      return {
        appendToBuffer: true,
        content: string,
        toString: function() { return "buffer += " + string + ";"; }
      };
    }
  },

  initializeBuffer: function() {
    return this.quotedString("");
  },

  namespace: "Handlebars",
  // END PUBLIC API

  compile: function(environment, options, context, asObject) {
    this.environment = environment;
    this.options = options;
    this.stringParams = this.options.stringParams;
    this.trackIds = this.options.trackIds;
    this.precompile = !asObject;

    this.name = this.environment.name;
    this.isChild = !!context;
    this.context = context || {
      programs: [],
      environments: []
    };

    this.preamble();

    this.stackSlot = 0;
    this.stackVars = [];
    this.aliases = {};
    this.registers = { list: [] };
    this.hashes = [];
    this.compileStack = [];
    this.inlineStack = [];

    this.compileChildren(environment, options);

    this.useDepths = this.useDepths || environment.depths.list.length || this.options.compat;

    var opcodes = environment.opcodes,
        opcode,
        i,
        l;

    for (i = 0, l = opcodes.length; i < l; i++) {
      opcode = opcodes[i];

      this[opcode.opcode].apply(this, opcode.args);
    }

    // Flush any trailing content that might be pending.
    this.pushSource('');

    /* istanbul ignore next */
    if (this.stackSlot || this.inlineStack.length || this.compileStack.length) {
      throw new Exception('Compile completed with content left on stack');
    }

    var fn = this.createFunctionContext(asObject);
    if (!this.isChild) {
      var ret = {
        compiler: this.compilerInfo(),
        main: fn
      };
      var programs = this.context.programs;
      for (i = 0, l = programs.length; i < l; i++) {
        if (programs[i]) {
          ret[i] = programs[i];
        }
      }

      if (this.environment.usePartial) {
        ret.usePartial = true;
      }
      if (this.options.data) {
        ret.useData = true;
      }
      if (this.useDepths) {
        ret.useDepths = true;
      }
      if (this.options.compat) {
        ret.compat = true;
      }

      if (!asObject) {
        ret.compiler = JSON.stringify(ret.compiler);
        ret = this.objectLiteral(ret);
      }

      return ret;
    } else {
      return fn;
    }
  },

  preamble: function() {
    // track the last context pushed into place to allow skipping the
    // getContext opcode when it would be a noop
    this.lastContext = 0;
    this.source = [];
  },

  createFunctionContext: function(asObject) {
    var varDeclarations = '';

    var locals = this.stackVars.concat(this.registers.list);
    if(locals.length > 0) {
      varDeclarations += ", " + locals.join(", ");
    }

    // Generate minimizer alias mappings
    for (var alias in this.aliases) {
      if (this.aliases.hasOwnProperty(alias)) {
        varDeclarations += ', ' + alias + '=' + this.aliases[alias];
      }
    }

    var params = ["depth0", "helpers", "partials", "data"];

    if (this.useDepths) {
      params.push('depths');
    }

    // Perform a second pass over the output to merge content when possible
    var source = this.mergeSource(varDeclarations);

    if (asObject) {
      params.push(source);

      return Function.apply(this, params);
    } else {
      return 'function(' + params.join(',') + ') {\n  ' + source + '}';
    }
  },
  mergeSource: function(varDeclarations) {
    var source = '',
        buffer,
        appendOnly = !this.forceBuffer,
        appendFirst;

    for (var i = 0, len = this.source.length; i < len; i++) {
      var line = this.source[i];
      if (line.appendToBuffer) {
        if (buffer) {
          buffer = buffer + '\n    + ' + line.content;
        } else {
          buffer = line.content;
        }
      } else {
        if (buffer) {
          if (!source) {
            appendFirst = true;
            source = buffer + ';\n  ';
          } else {
            source += 'buffer += ' + buffer + ';\n  ';
          }
          buffer = undefined;
        }
        source += line + '\n  ';

        if (!this.environment.isSimple) {
          appendOnly = false;
        }
      }
    }

    if (appendOnly) {
      if (buffer || !source) {
        source += 'return ' + (buffer || '""') + ';\n';
      }
    } else {
      varDeclarations += ", buffer = " + (appendFirst ? '' : this.initializeBuffer());
      if (buffer) {
        source += 'return buffer + ' + buffer + ';\n';
      } else {
        source += 'return buffer;\n';
      }
    }

    if (varDeclarations) {
      source = 'var ' + varDeclarations.substring(2) + (appendFirst ? '' : ';\n  ') + source;
    }

    return source;
  },

  // [blockValue]
  //
  // On stack, before: hash, inverse, program, value
  // On stack, after: return value of blockHelperMissing
  //
  // The purpose of this opcode is to take a block of the form
  // `{{#this.foo}}...{{/this.foo}}`, resolve the value of `foo`, and
  // replace it on the stack with the result of properly
  // invoking blockHelperMissing.
  blockValue: function(name) {
    this.aliases.blockHelperMissing = 'helpers.blockHelperMissing';

    var params = [this.contextName(0)];
    this.setupParams(name, 0, params);

    var blockName = this.popStack();
    params.splice(1, 0, blockName);

    this.push('blockHelperMissing.call(' + params.join(', ') + ')');
  },

  // [ambiguousBlockValue]
  //
  // On stack, before: hash, inverse, program, value
  // Compiler value, before: lastHelper=value of last found helper, if any
  // On stack, after, if no lastHelper: same as [blockValue]
  // On stack, after, if lastHelper: value
  ambiguousBlockValue: function() {
    this.aliases.blockHelperMissing = 'helpers.blockHelperMissing';

    // We're being a bit cheeky and reusing the options value from the prior exec
    var params = [this.contextName(0)];
    this.setupParams('', 0, params, true);

    this.flushInline();

    var current = this.topStack();
    params.splice(1, 0, current);

    this.pushSource("if (!" + this.lastHelper + ") { " + current + " = blockHelperMissing.call(" + params.join(", ") + "); }");
  },

  // [appendContent]
  //
  // On stack, before: ...
  // On stack, after: ...
  //
  // Appends the string value of `content` to the current buffer
  appendContent: function(content) {
    if (this.pendingContent) {
      content = this.pendingContent + content;
    }

    this.pendingContent = content;
  },

  // [append]
  //
  // On stack, before: value, ...
  // On stack, after: ...
  //
  // Coerces `value` to a String and appends it to the current buffer.
  //
  // If `value` is truthy, or 0, it is coerced into a string and appended
  // Otherwise, the empty string is appended
  append: function() {
    // Force anything that is inlined onto the stack so we don't have duplication
    // when we examine local
    this.flushInline();
    var local = this.popStack();
    this.pushSource('if (' + local + ' != null) { ' + this.appendToBuffer(local) + ' }');
    if (this.environment.isSimple) {
      this.pushSource("else { " + this.appendToBuffer("''") + " }");
    }
  },

  // [appendEscaped]
  //
  // On stack, before: value, ...
  // On stack, after: ...
  //
  // Escape `value` and append it to the buffer
  appendEscaped: function() {
    this.aliases.escapeExpression = 'this.escapeExpression';

    this.pushSource(this.appendToBuffer("escapeExpression(" + this.popStack() + ")"));
  },

  // [getContext]
  //
  // On stack, before: ...
  // On stack, after: ...
  // Compiler value, after: lastContext=depth
  //
  // Set the value of the `lastContext` compiler value to the depth
  getContext: function(depth) {
    this.lastContext = depth;
  },

  // [pushContext]
  //
  // On stack, before: ...
  // On stack, after: currentContext, ...
  //
  // Pushes the value of the current context onto the stack.
  pushContext: function() {
    this.pushStackLiteral(this.contextName(this.lastContext));
  },

  // [lookupOnContext]
  //
  // On stack, before: ...
  // On stack, after: currentContext[name], ...
  //
  // Looks up the value of `name` on the current context and pushes
  // it onto the stack.
  lookupOnContext: function(parts, falsy, scoped) {
    /*jshint -W083 */
    var i = 0,
        len = parts.length;

    if (!scoped && this.options.compat && !this.lastContext) {
      // The depthed query is expected to handle the undefined logic for the root level that
      // is implemented below, so we evaluate that directly in compat mode
      this.push(this.depthedLookup(parts[i++]));
    } else {
      this.pushContext();
    }

    for (; i < len; i++) {
      this.replaceStack(function(current) {
        var lookup = this.nameLookup(current, parts[i], 'context');
        // We want to ensure that zero and false are handled properly if the context (falsy flag)
        // needs to have the special handling for these values.
        if (!falsy) {
          return ' != null ? ' + lookup + ' : ' + current;
        } else {
          // Otherwise we can use generic falsy handling
          return ' && ' + lookup;
        }
      });
    }
  },

  // [lookupData]
  //
  // On stack, before: ...
  // On stack, after: data, ...
  //
  // Push the data lookup operator
  lookupData: function(depth, parts) {
    /*jshint -W083 */
    if (!depth) {
      this.pushStackLiteral('data');
    } else {
      this.pushStackLiteral('this.data(data, ' + depth + ')');
    }

    var len = parts.length;
    for (var i = 0; i < len; i++) {
      this.replaceStack(function(current) {
        return ' && ' + this.nameLookup(current, parts[i], 'data');
      });
    }
  },

  // [resolvePossibleLambda]
  //
  // On stack, before: value, ...
  // On stack, after: resolved value, ...
  //
  // If the `value` is a lambda, replace it on the stack by
  // the return value of the lambda
  resolvePossibleLambda: function() {
    this.aliases.lambda = 'this.lambda';

    this.push('lambda(' + this.popStack() + ', ' + this.contextName(0) + ')');
  },

  // [pushStringParam]
  //
  // On stack, before: ...
  // On stack, after: string, currentContext, ...
  //
  // This opcode is designed for use in string mode, which
  // provides the string value of a parameter along with its
  // depth rather than resolving it immediately.
  pushStringParam: function(string, type) {
    this.pushContext();
    this.pushString(type);

    // If it's a subexpression, the string result
    // will be pushed after this opcode.
    if (type !== 'sexpr') {
      if (typeof string === 'string') {
        this.pushString(string);
      } else {
        this.pushStackLiteral(string);
      }
    }
  },

  emptyHash: function() {
    this.pushStackLiteral('{}');

    if (this.trackIds) {
      this.push('{}'); // hashIds
    }
    if (this.stringParams) {
      this.push('{}'); // hashContexts
      this.push('{}'); // hashTypes
    }
  },
  pushHash: function() {
    if (this.hash) {
      this.hashes.push(this.hash);
    }
    this.hash = {values: [], types: [], contexts: [], ids: []};
  },
  popHash: function() {
    var hash = this.hash;
    this.hash = this.hashes.pop();

    if (this.trackIds) {
      this.push('{' + hash.ids.join(',') + '}');
    }
    if (this.stringParams) {
      this.push('{' + hash.contexts.join(',') + '}');
      this.push('{' + hash.types.join(',') + '}');
    }

    this.push('{\n    ' + hash.values.join(',\n    ') + '\n  }');
  },

  // [pushString]
  //
  // On stack, before: ...
  // On stack, after: quotedString(string), ...
  //
  // Push a quoted version of `string` onto the stack
  pushString: function(string) {
    this.pushStackLiteral(this.quotedString(string));
  },

  // [push]
  //
  // On stack, before: ...
  // On stack, after: expr, ...
  //
  // Push an expression onto the stack
  push: function(expr) {
    this.inlineStack.push(expr);
    return expr;
  },

  // [pushLiteral]
  //
  // On stack, before: ...
  // On stack, after: value, ...
  //
  // Pushes a value onto the stack. This operation prevents
  // the compiler from creating a temporary variable to hold
  // it.
  pushLiteral: function(value) {
    this.pushStackLiteral(value);
  },

  // [pushProgram]
  //
  // On stack, before: ...
  // On stack, after: program(guid), ...
  //
  // Push a program expression onto the stack. This takes
  // a compile-time guid and converts it into a runtime-accessible
  // expression.
  pushProgram: function(guid) {
    if (guid != null) {
      this.pushStackLiteral(this.programExpression(guid));
    } else {
      this.pushStackLiteral(null);
    }
  },

  // [invokeHelper]
  //
  // On stack, before: hash, inverse, program, params..., ...
  // On stack, after: result of helper invocation
  //
  // Pops off the helper's parameters, invokes the helper,
  // and pushes the helper's return value onto the stack.
  //
  // If the helper is not found, `helperMissing` is called.
  invokeHelper: function(paramSize, name, isSimple) {
    this.aliases.helperMissing = 'helpers.helperMissing';

    var nonHelper = this.popStack();
    var helper = this.setupHelper(paramSize, name);

    var lookup = (isSimple ? helper.name + ' || ' : '') + nonHelper + ' || helperMissing';
    this.push('((' + lookup + ').call(' + helper.callParams + '))');
  },

  // [invokeKnownHelper]
  //
  // On stack, before: hash, inverse, program, params..., ...
  // On stack, after: result of helper invocation
  //
  // This operation is used when the helper is known to exist,
  // so a `helperMissing` fallback is not required.
  invokeKnownHelper: function(paramSize, name) {
    var helper = this.setupHelper(paramSize, name);
    this.push(helper.name + ".call(" + helper.callParams + ")");
  },

  // [invokeAmbiguous]
  //
  // On stack, before: hash, inverse, program, params..., ...
  // On stack, after: result of disambiguation
  //
  // This operation is used when an expression like `{{foo}}`
  // is provided, but we don't know at compile-time whether it
  // is a helper or a path.
  //
  // This operation emits more code than the other options,
  // and can be avoided by passing the `knownHelpers` and
  // `knownHelpersOnly` flags at compile-time.
  invokeAmbiguous: function(name, helperCall) {
    this.aliases.functionType = '"function"';
    this.aliases.helperMissing = 'helpers.helperMissing';
    this.useRegister('helper');

    var nonHelper = this.popStack();

    this.emptyHash();
    var helper = this.setupHelper(0, name, helperCall);

    var helperName = this.lastHelper = this.nameLookup('helpers', name, 'helper');

    this.push(
      '((helper = (helper = ' + helperName + ' || ' + nonHelper + ') != null ? helper : helperMissing'
        + (helper.paramsInit ? '),(' + helper.paramsInit : '') + '),'
      + '(typeof helper === functionType ? helper.call(' + helper.callParams + ') : helper))');
  },

  // [invokePartial]
  //
  // On stack, before: context, ...
  // On stack after: result of partial invocation
  //
  // This operation pops off a context, invokes a partial with that context,
  // and pushes the result of the invocation back.
  invokePartial: function(name, indent) {
    var params = [this.nameLookup('partials', name, 'partial'), "'" + indent + "'", "'" + name + "'", this.popStack(), this.popStack(), "helpers", "partials"];

    if (this.options.data) {
      params.push("data");
    } else if (this.options.compat) {
      params.push('undefined');
    }
    if (this.options.compat) {
      params.push('depths');
    }

    this.push("this.invokePartial(" + params.join(", ") + ")");
  },

  // [assignToHash]
  //
  // On stack, before: value, ..., hash, ...
  // On stack, after: ..., hash, ...
  //
  // Pops a value off the stack and assigns it to the current hash
  assignToHash: function(key) {
    var value = this.popStack(),
        context,
        type,
        id;

    if (this.trackIds) {
      id = this.popStack();
    }
    if (this.stringParams) {
      type = this.popStack();
      context = this.popStack();
    }

    var hash = this.hash;
    if (context) {
      hash.contexts.push("'" + key + "': " + context);
    }
    if (type) {
      hash.types.push("'" + key + "': " + type);
    }
    if (id) {
      hash.ids.push("'" + key + "': " + id);
    }
    hash.values.push("'" + key + "': (" + value + ")");
  },

  pushId: function(type, name) {
    if (type === 'ID' || type === 'DATA') {
      this.pushString(name);
    } else if (type === 'sexpr') {
      this.pushStackLiteral('true');
    } else {
      this.pushStackLiteral('null');
    }
  },

  // HELPERS

  compiler: JavaScriptCompiler,

  compileChildren: function(environment, options) {
    var children = environment.children, child, compiler;

    for(var i=0, l=children.length; i<l; i++) {
      child = children[i];
      compiler = new this.compiler();

      var index = this.matchExistingProgram(child);

      if (index == null) {
        this.context.programs.push('');     // Placeholder to prevent name conflicts for nested children
        index = this.context.programs.length;
        child.index = index;
        child.name = 'program' + index;
        this.context.programs[index] = compiler.compile(child, options, this.context, !this.precompile);
        this.context.environments[index] = child;

        this.useDepths = this.useDepths || compiler.useDepths;
      } else {
        child.index = index;
        child.name = 'program' + index;
      }
    }
  },
  matchExistingProgram: function(child) {
    for (var i = 0, len = this.context.environments.length; i < len; i++) {
      var environment = this.context.environments[i];
      if (environment && environment.equals(child)) {
        return i;
      }
    }
  },

  programExpression: function(guid) {
    var child = this.environment.children[guid],
        depths = child.depths.list,
        useDepths = this.useDepths,
        depth;

    var programParams = [child.index, 'data'];

    if (useDepths) {
      programParams.push('depths');
    }

    return 'this.program(' + programParams.join(', ') + ')';
  },

  useRegister: function(name) {
    if(!this.registers[name]) {
      this.registers[name] = true;
      this.registers.list.push(name);
    }
  },

  pushStackLiteral: function(item) {
    return this.push(new Literal(item));
  },

  pushSource: function(source) {
    if (this.pendingContent) {
      this.source.push(this.appendToBuffer(this.quotedString(this.pendingContent)));
      this.pendingContent = undefined;
    }

    if (source) {
      this.source.push(source);
    }
  },

  pushStack: function(item) {
    this.flushInline();

    var stack = this.incrStack();
    this.pushSource(stack + " = " + item + ";");
    this.compileStack.push(stack);
    return stack;
  },

  replaceStack: function(callback) {
    var prefix = '',
        inline = this.isInline(),
        stack,
        createdStack,
        usedLiteral;

    /* istanbul ignore next */
    if (!this.isInline()) {
      throw new Exception('replaceStack on non-inline');
    }

    // We want to merge the inline statement into the replacement statement via ','
    var top = this.popStack(true);

    if (top instanceof Literal) {
      // Literals do not need to be inlined
      prefix = stack = top.value;
      usedLiteral = true;
    } else {
      // Get or create the current stack name for use by the inline
      createdStack = !this.stackSlot;
      var name = !createdStack ? this.topStackName() : this.incrStack();

      prefix = '(' + this.push(name) + ' = ' + top + ')';
      stack = this.topStack();
    }

    var item = callback.call(this, stack);

    if (!usedLiteral) {
      this.popStack();
    }
    if (createdStack) {
      this.stackSlot--;
    }
    this.push('(' + prefix + item + ')');
  },

  incrStack: function() {
    this.stackSlot++;
    if(this.stackSlot > this.stackVars.length) { this.stackVars.push("stack" + this.stackSlot); }
    return this.topStackName();
  },
  topStackName: function() {
    return "stack" + this.stackSlot;
  },
  flushInline: function() {
    var inlineStack = this.inlineStack;
    if (inlineStack.length) {
      this.inlineStack = [];
      for (var i = 0, len = inlineStack.length; i < len; i++) {
        var entry = inlineStack[i];
        if (entry instanceof Literal) {
          this.compileStack.push(entry);
        } else {
          this.pushStack(entry);
        }
      }
    }
  },
  isInline: function() {
    return this.inlineStack.length;
  },

  popStack: function(wrapped) {
    var inline = this.isInline(),
        item = (inline ? this.inlineStack : this.compileStack).pop();

    if (!wrapped && (item instanceof Literal)) {
      return item.value;
    } else {
      if (!inline) {
        /* istanbul ignore next */
        if (!this.stackSlot) {
          throw new Exception('Invalid stack pop');
        }
        this.stackSlot--;
      }
      return item;
    }
  },

  topStack: function() {
    var stack = (this.isInline() ? this.inlineStack : this.compileStack),
        item = stack[stack.length - 1];

    if (item instanceof Literal) {
      return item.value;
    } else {
      return item;
    }
  },

  contextName: function(context) {
    if (this.useDepths && context) {
      return 'depths[' + context + ']';
    } else {
      return 'depth' + context;
    }
  },

  quotedString: function(str) {
    return '"' + str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\u2028/g, '\\u2028')   // Per Ecma-262 7.3 + 7.8.4
      .replace(/\u2029/g, '\\u2029') + '"';
  },

  objectLiteral: function(obj) {
    var pairs = [];

    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        pairs.push(this.quotedString(key) + ':' + obj[key]);
      }
    }

    return '{' + pairs.join(',') + '}';
  },

  setupHelper: function(paramSize, name, blockHelper) {
    var params = [],
        paramsInit = this.setupParams(name, paramSize, params, blockHelper);
    var foundHelper = this.nameLookup('helpers', name, 'helper');

    return {
      params: params,
      paramsInit: paramsInit,
      name: foundHelper,
      callParams: [this.contextName(0)].concat(params).join(", ")
    };
  },

  setupOptions: function(helper, paramSize, params) {
    var options = {}, contexts = [], types = [], ids = [], param, inverse, program;

    options.name = this.quotedString(helper);
    options.hash = this.popStack();

    if (this.trackIds) {
      options.hashIds = this.popStack();
    }
    if (this.stringParams) {
      options.hashTypes = this.popStack();
      options.hashContexts = this.popStack();
    }

    inverse = this.popStack();
    program = this.popStack();

    // Avoid setting fn and inverse if neither are set. This allows
    // helpers to do a check for `if (options.fn)`
    if (program || inverse) {
      if (!program) {
        program = 'this.noop';
      }

      if (!inverse) {
        inverse = 'this.noop';
      }

      options.fn = program;
      options.inverse = inverse;
    }

    // The parameters go on to the stack in order (making sure that they are evaluated in order)
    // so we need to pop them off the stack in reverse order
    var i = paramSize;
    while (i--) {
      param = this.popStack();
      params[i] = param;

      if (this.trackIds) {
        ids[i] = this.popStack();
      }
      if (this.stringParams) {
        types[i] = this.popStack();
        contexts[i] = this.popStack();
      }
    }

    if (this.trackIds) {
      options.ids = "[" + ids.join(",") + "]";
    }
    if (this.stringParams) {
      options.types = "[" + types.join(",") + "]";
      options.contexts = "[" + contexts.join(",") + "]";
    }

    if (this.options.data) {
      options.data = "data";
    }

    return options;
  },

  // the params and contexts arguments are passed in arrays
  // to fill in
  setupParams: function(helperName, paramSize, params, useRegister) {
    var options = this.objectLiteral(this.setupOptions(helperName, paramSize, params));

    if (useRegister) {
      this.useRegister('options');
      params.push('options');
      return 'options=' + options;
    } else {
      params.push(options);
      return '';
    }
  }
};

var reservedWords = (
  "break else new var" +
  " case finally return void" +
  " catch for switch while" +
  " continue function this with" +
  " default if throw" +
  " delete in try" +
  " do instanceof typeof" +
  " abstract enum int short" +
  " boolean export interface static" +
  " byte extends long super" +
  " char final native synchronized" +
  " class float package throws" +
  " const goto private transient" +
  " debugger implements protected volatile" +
  " double import public let yield"
).split(" ");

var compilerWords = JavaScriptCompiler.RESERVED_WORDS = {};

for(var i=0, l=reservedWords.length; i<l; i++) {
  compilerWords[reservedWords[i]] = true;
}

JavaScriptCompiler.isValidJavaScriptVariableName = function(name) {
  return !JavaScriptCompiler.RESERVED_WORDS[name] && /^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(name);
};

exports["default"] = JavaScriptCompiler;
},{"../base":61,"../exception":70}],67:[function(require,module,exports){
"use strict";
/* jshint ignore:start */
/* istanbul ignore next */
/* Jison generated parser */
var handlebars = (function(){
var parser = {trace: function trace() { },
yy: {},
symbols_: {"error":2,"root":3,"program":4,"EOF":5,"program_repetition0":6,"statement":7,"mustache":8,"block":9,"rawBlock":10,"partial":11,"CONTENT":12,"COMMENT":13,"openRawBlock":14,"END_RAW_BLOCK":15,"OPEN_RAW_BLOCK":16,"sexpr":17,"CLOSE_RAW_BLOCK":18,"openBlock":19,"block_option0":20,"closeBlock":21,"openInverse":22,"block_option1":23,"OPEN_BLOCK":24,"CLOSE":25,"OPEN_INVERSE":26,"inverseAndProgram":27,"INVERSE":28,"OPEN_ENDBLOCK":29,"path":30,"OPEN":31,"OPEN_UNESCAPED":32,"CLOSE_UNESCAPED":33,"OPEN_PARTIAL":34,"partialName":35,"param":36,"partial_option0":37,"partial_option1":38,"sexpr_repetition0":39,"sexpr_option0":40,"dataName":41,"STRING":42,"NUMBER":43,"BOOLEAN":44,"OPEN_SEXPR":45,"CLOSE_SEXPR":46,"hash":47,"hash_repetition_plus0":48,"hashSegment":49,"ID":50,"EQUALS":51,"DATA":52,"pathSegments":53,"SEP":54,"$accept":0,"$end":1},
terminals_: {2:"error",5:"EOF",12:"CONTENT",13:"COMMENT",15:"END_RAW_BLOCK",16:"OPEN_RAW_BLOCK",18:"CLOSE_RAW_BLOCK",24:"OPEN_BLOCK",25:"CLOSE",26:"OPEN_INVERSE",28:"INVERSE",29:"OPEN_ENDBLOCK",31:"OPEN",32:"OPEN_UNESCAPED",33:"CLOSE_UNESCAPED",34:"OPEN_PARTIAL",42:"STRING",43:"NUMBER",44:"BOOLEAN",45:"OPEN_SEXPR",46:"CLOSE_SEXPR",50:"ID",51:"EQUALS",52:"DATA",54:"SEP"},
productions_: [0,[3,2],[4,1],[7,1],[7,1],[7,1],[7,1],[7,1],[7,1],[10,3],[14,3],[9,4],[9,4],[19,3],[22,3],[27,2],[21,3],[8,3],[8,3],[11,5],[11,4],[17,3],[17,1],[36,1],[36,1],[36,1],[36,1],[36,1],[36,3],[47,1],[49,3],[35,1],[35,1],[35,1],[41,2],[30,1],[53,3],[53,1],[6,0],[6,2],[20,0],[20,1],[23,0],[23,1],[37,0],[37,1],[38,0],[38,1],[39,0],[39,2],[40,0],[40,1],[48,1],[48,2]],
performAction: function anonymous(yytext,yyleng,yylineno,yy,yystate,$$,_$) {

var $0 = $$.length - 1;
switch (yystate) {
case 1: yy.prepareProgram($$[$0-1].statements, true); return $$[$0-1]; 
break;
case 2:this.$ = new yy.ProgramNode(yy.prepareProgram($$[$0]), {}, this._$);
break;
case 3:this.$ = $$[$0];
break;
case 4:this.$ = $$[$0];
break;
case 5:this.$ = $$[$0];
break;
case 6:this.$ = $$[$0];
break;
case 7:this.$ = new yy.ContentNode($$[$0], this._$);
break;
case 8:this.$ = new yy.CommentNode($$[$0], this._$);
break;
case 9:this.$ = new yy.RawBlockNode($$[$0-2], $$[$0-1], $$[$0], this._$);
break;
case 10:this.$ = new yy.MustacheNode($$[$0-1], null, '', '', this._$);
break;
case 11:this.$ = yy.prepareBlock($$[$0-3], $$[$0-2], $$[$0-1], $$[$0], false, this._$);
break;
case 12:this.$ = yy.prepareBlock($$[$0-3], $$[$0-2], $$[$0-1], $$[$0], true, this._$);
break;
case 13:this.$ = new yy.MustacheNode($$[$0-1], null, $$[$0-2], yy.stripFlags($$[$0-2], $$[$0]), this._$);
break;
case 14:this.$ = new yy.MustacheNode($$[$0-1], null, $$[$0-2], yy.stripFlags($$[$0-2], $$[$0]), this._$);
break;
case 15:this.$ = { strip: yy.stripFlags($$[$0-1], $$[$0-1]), program: $$[$0] };
break;
case 16:this.$ = {path: $$[$0-1], strip: yy.stripFlags($$[$0-2], $$[$0])};
break;
case 17:this.$ = new yy.MustacheNode($$[$0-1], null, $$[$0-2], yy.stripFlags($$[$0-2], $$[$0]), this._$);
break;
case 18:this.$ = new yy.MustacheNode($$[$0-1], null, $$[$0-2], yy.stripFlags($$[$0-2], $$[$0]), this._$);
break;
case 19:this.$ = new yy.PartialNode($$[$0-3], $$[$0-2], $$[$0-1], yy.stripFlags($$[$0-4], $$[$0]), this._$);
break;
case 20:this.$ = new yy.PartialNode($$[$0-2], undefined, $$[$0-1], yy.stripFlags($$[$0-3], $$[$0]), this._$);
break;
case 21:this.$ = new yy.SexprNode([$$[$0-2]].concat($$[$0-1]), $$[$0], this._$);
break;
case 22:this.$ = new yy.SexprNode([$$[$0]], null, this._$);
break;
case 23:this.$ = $$[$0];
break;
case 24:this.$ = new yy.StringNode($$[$0], this._$);
break;
case 25:this.$ = new yy.NumberNode($$[$0], this._$);
break;
case 26:this.$ = new yy.BooleanNode($$[$0], this._$);
break;
case 27:this.$ = $$[$0];
break;
case 28:$$[$0-1].isHelper = true; this.$ = $$[$0-1];
break;
case 29:this.$ = new yy.HashNode($$[$0], this._$);
break;
case 30:this.$ = [$$[$0-2], $$[$0]];
break;
case 31:this.$ = new yy.PartialNameNode($$[$0], this._$);
break;
case 32:this.$ = new yy.PartialNameNode(new yy.StringNode($$[$0], this._$), this._$);
break;
case 33:this.$ = new yy.PartialNameNode(new yy.NumberNode($$[$0], this._$));
break;
case 34:this.$ = new yy.DataNode($$[$0], this._$);
break;
case 35:this.$ = new yy.IdNode($$[$0], this._$);
break;
case 36: $$[$0-2].push({part: $$[$0], separator: $$[$0-1]}); this.$ = $$[$0-2]; 
break;
case 37:this.$ = [{part: $$[$0]}];
break;
case 38:this.$ = [];
break;
case 39:$$[$0-1].push($$[$0]);
break;
case 48:this.$ = [];
break;
case 49:$$[$0-1].push($$[$0]);
break;
case 52:this.$ = [$$[$0]];
break;
case 53:$$[$0-1].push($$[$0]);
break;
}
},
table: [{3:1,4:2,5:[2,38],6:3,12:[2,38],13:[2,38],16:[2,38],24:[2,38],26:[2,38],31:[2,38],32:[2,38],34:[2,38]},{1:[3]},{5:[1,4]},{5:[2,2],7:5,8:6,9:7,10:8,11:9,12:[1,10],13:[1,11],14:16,16:[1,20],19:14,22:15,24:[1,18],26:[1,19],28:[2,2],29:[2,2],31:[1,12],32:[1,13],34:[1,17]},{1:[2,1]},{5:[2,39],12:[2,39],13:[2,39],16:[2,39],24:[2,39],26:[2,39],28:[2,39],29:[2,39],31:[2,39],32:[2,39],34:[2,39]},{5:[2,3],12:[2,3],13:[2,3],16:[2,3],24:[2,3],26:[2,3],28:[2,3],29:[2,3],31:[2,3],32:[2,3],34:[2,3]},{5:[2,4],12:[2,4],13:[2,4],16:[2,4],24:[2,4],26:[2,4],28:[2,4],29:[2,4],31:[2,4],32:[2,4],34:[2,4]},{5:[2,5],12:[2,5],13:[2,5],16:[2,5],24:[2,5],26:[2,5],28:[2,5],29:[2,5],31:[2,5],32:[2,5],34:[2,5]},{5:[2,6],12:[2,6],13:[2,6],16:[2,6],24:[2,6],26:[2,6],28:[2,6],29:[2,6],31:[2,6],32:[2,6],34:[2,6]},{5:[2,7],12:[2,7],13:[2,7],16:[2,7],24:[2,7],26:[2,7],28:[2,7],29:[2,7],31:[2,7],32:[2,7],34:[2,7]},{5:[2,8],12:[2,8],13:[2,8],16:[2,8],24:[2,8],26:[2,8],28:[2,8],29:[2,8],31:[2,8],32:[2,8],34:[2,8]},{17:21,30:22,41:23,50:[1,26],52:[1,25],53:24},{17:27,30:22,41:23,50:[1,26],52:[1,25],53:24},{4:28,6:3,12:[2,38],13:[2,38],16:[2,38],24:[2,38],26:[2,38],28:[2,38],29:[2,38],31:[2,38],32:[2,38],34:[2,38]},{4:29,6:3,12:[2,38],13:[2,38],16:[2,38],24:[2,38],26:[2,38],28:[2,38],29:[2,38],31:[2,38],32:[2,38],34:[2,38]},{12:[1,30]},{30:32,35:31,42:[1,33],43:[1,34],50:[1,26],53:24},{17:35,30:22,41:23,50:[1,26],52:[1,25],53:24},{17:36,30:22,41:23,50:[1,26],52:[1,25],53:24},{17:37,30:22,41:23,50:[1,26],52:[1,25],53:24},{25:[1,38]},{18:[2,48],25:[2,48],33:[2,48],39:39,42:[2,48],43:[2,48],44:[2,48],45:[2,48],46:[2,48],50:[2,48],52:[2,48]},{18:[2,22],25:[2,22],33:[2,22],46:[2,22]},{18:[2,35],25:[2,35],33:[2,35],42:[2,35],43:[2,35],44:[2,35],45:[2,35],46:[2,35],50:[2,35],52:[2,35],54:[1,40]},{30:41,50:[1,26],53:24},{18:[2,37],25:[2,37],33:[2,37],42:[2,37],43:[2,37],44:[2,37],45:[2,37],46:[2,37],50:[2,37],52:[2,37],54:[2,37]},{33:[1,42]},{20:43,27:44,28:[1,45],29:[2,40]},{23:46,27:47,28:[1,45],29:[2,42]},{15:[1,48]},{25:[2,46],30:51,36:49,38:50,41:55,42:[1,52],43:[1,53],44:[1,54],45:[1,56],47:57,48:58,49:60,50:[1,59],52:[1,25],53:24},{25:[2,31],42:[2,31],43:[2,31],44:[2,31],45:[2,31],50:[2,31],52:[2,31]},{25:[2,32],42:[2,32],43:[2,32],44:[2,32],45:[2,32],50:[2,32],52:[2,32]},{25:[2,33],42:[2,33],43:[2,33],44:[2,33],45:[2,33],50:[2,33],52:[2,33]},{25:[1,61]},{25:[1,62]},{18:[1,63]},{5:[2,17],12:[2,17],13:[2,17],16:[2,17],24:[2,17],26:[2,17],28:[2,17],29:[2,17],31:[2,17],32:[2,17],34:[2,17]},{18:[2,50],25:[2,50],30:51,33:[2,50],36:65,40:64,41:55,42:[1,52],43:[1,53],44:[1,54],45:[1,56],46:[2,50],47:66,48:58,49:60,50:[1,59],52:[1,25],53:24},{50:[1,67]},{18:[2,34],25:[2,34],33:[2,34],42:[2,34],43:[2,34],44:[2,34],45:[2,34],46:[2,34],50:[2,34],52:[2,34]},{5:[2,18],12:[2,18],13:[2,18],16:[2,18],24:[2,18],26:[2,18],28:[2,18],29:[2,18],31:[2,18],32:[2,18],34:[2,18]},{21:68,29:[1,69]},{29:[2,41]},{4:70,6:3,12:[2,38],13:[2,38],16:[2,38],24:[2,38],26:[2,38],29:[2,38],31:[2,38],32:[2,38],34:[2,38]},{21:71,29:[1,69]},{29:[2,43]},{5:[2,9],12:[2,9],13:[2,9],16:[2,9],24:[2,9],26:[2,9],28:[2,9],29:[2,9],31:[2,9],32:[2,9],34:[2,9]},{25:[2,44],37:72,47:73,48:58,49:60,50:[1,74]},{25:[1,75]},{18:[2,23],25:[2,23],33:[2,23],42:[2,23],43:[2,23],44:[2,23],45:[2,23],46:[2,23],50:[2,23],52:[2,23]},{18:[2,24],25:[2,24],33:[2,24],42:[2,24],43:[2,24],44:[2,24],45:[2,24],46:[2,24],50:[2,24],52:[2,24]},{18:[2,25],25:[2,25],33:[2,25],42:[2,25],43:[2,25],44:[2,25],45:[2,25],46:[2,25],50:[2,25],52:[2,25]},{18:[2,26],25:[2,26],33:[2,26],42:[2,26],43:[2,26],44:[2,26],45:[2,26],46:[2,26],50:[2,26],52:[2,26]},{18:[2,27],25:[2,27],33:[2,27],42:[2,27],43:[2,27],44:[2,27],45:[2,27],46:[2,27],50:[2,27],52:[2,27]},{17:76,30:22,41:23,50:[1,26],52:[1,25],53:24},{25:[2,47]},{18:[2,29],25:[2,29],33:[2,29],46:[2,29],49:77,50:[1,74]},{18:[2,37],25:[2,37],33:[2,37],42:[2,37],43:[2,37],44:[2,37],45:[2,37],46:[2,37],50:[2,37],51:[1,78],52:[2,37],54:[2,37]},{18:[2,52],25:[2,52],33:[2,52],46:[2,52],50:[2,52]},{12:[2,13],13:[2,13],16:[2,13],24:[2,13],26:[2,13],28:[2,13],29:[2,13],31:[2,13],32:[2,13],34:[2,13]},{12:[2,14],13:[2,14],16:[2,14],24:[2,14],26:[2,14],28:[2,14],29:[2,14],31:[2,14],32:[2,14],34:[2,14]},{12:[2,10]},{18:[2,21],25:[2,21],33:[2,21],46:[2,21]},{18:[2,49],25:[2,49],33:[2,49],42:[2,49],43:[2,49],44:[2,49],45:[2,49],46:[2,49],50:[2,49],52:[2,49]},{18:[2,51],25:[2,51],33:[2,51],46:[2,51]},{18:[2,36],25:[2,36],33:[2,36],42:[2,36],43:[2,36],44:[2,36],45:[2,36],46:[2,36],50:[2,36],52:[2,36],54:[2,36]},{5:[2,11],12:[2,11],13:[2,11],16:[2,11],24:[2,11],26:[2,11],28:[2,11],29:[2,11],31:[2,11],32:[2,11],34:[2,11]},{30:79,50:[1,26],53:24},{29:[2,15]},{5:[2,12],12:[2,12],13:[2,12],16:[2,12],24:[2,12],26:[2,12],28:[2,12],29:[2,12],31:[2,12],32:[2,12],34:[2,12]},{25:[1,80]},{25:[2,45]},{51:[1,78]},{5:[2,20],12:[2,20],13:[2,20],16:[2,20],24:[2,20],26:[2,20],28:[2,20],29:[2,20],31:[2,20],32:[2,20],34:[2,20]},{46:[1,81]},{18:[2,53],25:[2,53],33:[2,53],46:[2,53],50:[2,53]},{30:51,36:82,41:55,42:[1,52],43:[1,53],44:[1,54],45:[1,56],50:[1,26],52:[1,25],53:24},{25:[1,83]},{5:[2,19],12:[2,19],13:[2,19],16:[2,19],24:[2,19],26:[2,19],28:[2,19],29:[2,19],31:[2,19],32:[2,19],34:[2,19]},{18:[2,28],25:[2,28],33:[2,28],42:[2,28],43:[2,28],44:[2,28],45:[2,28],46:[2,28],50:[2,28],52:[2,28]},{18:[2,30],25:[2,30],33:[2,30],46:[2,30],50:[2,30]},{5:[2,16],12:[2,16],13:[2,16],16:[2,16],24:[2,16],26:[2,16],28:[2,16],29:[2,16],31:[2,16],32:[2,16],34:[2,16]}],
defaultActions: {4:[2,1],44:[2,41],47:[2,43],57:[2,47],63:[2,10],70:[2,15],73:[2,45]},
parseError: function parseError(str, hash) {
    throw new Error(str);
},
parse: function parse(input) {
    var self = this, stack = [0], vstack = [null], lstack = [], table = this.table, yytext = "", yylineno = 0, yyleng = 0, recovering = 0, TERROR = 2, EOF = 1;
    this.lexer.setInput(input);
    this.lexer.yy = this.yy;
    this.yy.lexer = this.lexer;
    this.yy.parser = this;
    if (typeof this.lexer.yylloc == "undefined")
        this.lexer.yylloc = {};
    var yyloc = this.lexer.yylloc;
    lstack.push(yyloc);
    var ranges = this.lexer.options && this.lexer.options.ranges;
    if (typeof this.yy.parseError === "function")
        this.parseError = this.yy.parseError;
    function popStack(n) {
        stack.length = stack.length - 2 * n;
        vstack.length = vstack.length - n;
        lstack.length = lstack.length - n;
    }
    function lex() {
        var token;
        token = self.lexer.lex() || 1;
        if (typeof token !== "number") {
            token = self.symbols_[token] || token;
        }
        return token;
    }
    var symbol, preErrorSymbol, state, action, a, r, yyval = {}, p, len, newState, expected;
    while (true) {
        state = stack[stack.length - 1];
        if (this.defaultActions[state]) {
            action = this.defaultActions[state];
        } else {
            if (symbol === null || typeof symbol == "undefined") {
                symbol = lex();
            }
            action = table[state] && table[state][symbol];
        }
        if (typeof action === "undefined" || !action.length || !action[0]) {
            var errStr = "";
            if (!recovering) {
                expected = [];
                for (p in table[state])
                    if (this.terminals_[p] && p > 2) {
                        expected.push("'" + this.terminals_[p] + "'");
                    }
                if (this.lexer.showPosition) {
                    errStr = "Parse error on line " + (yylineno + 1) + ":\n" + this.lexer.showPosition() + "\nExpecting " + expected.join(", ") + ", got '" + (this.terminals_[symbol] || symbol) + "'";
                } else {
                    errStr = "Parse error on line " + (yylineno + 1) + ": Unexpected " + (symbol == 1?"end of input":"'" + (this.terminals_[symbol] || symbol) + "'");
                }
                this.parseError(errStr, {text: this.lexer.match, token: this.terminals_[symbol] || symbol, line: this.lexer.yylineno, loc: yyloc, expected: expected});
            }
        }
        if (action[0] instanceof Array && action.length > 1) {
            throw new Error("Parse Error: multiple actions possible at state: " + state + ", token: " + symbol);
        }
        switch (action[0]) {
        case 1:
            stack.push(symbol);
            vstack.push(this.lexer.yytext);
            lstack.push(this.lexer.yylloc);
            stack.push(action[1]);
            symbol = null;
            if (!preErrorSymbol) {
                yyleng = this.lexer.yyleng;
                yytext = this.lexer.yytext;
                yylineno = this.lexer.yylineno;
                yyloc = this.lexer.yylloc;
                if (recovering > 0)
                    recovering--;
            } else {
                symbol = preErrorSymbol;
                preErrorSymbol = null;
            }
            break;
        case 2:
            len = this.productions_[action[1]][1];
            yyval.$ = vstack[vstack.length - len];
            yyval._$ = {first_line: lstack[lstack.length - (len || 1)].first_line, last_line: lstack[lstack.length - 1].last_line, first_column: lstack[lstack.length - (len || 1)].first_column, last_column: lstack[lstack.length - 1].last_column};
            if (ranges) {
                yyval._$.range = [lstack[lstack.length - (len || 1)].range[0], lstack[lstack.length - 1].range[1]];
            }
            r = this.performAction.call(yyval, yytext, yyleng, yylineno, this.yy, action[1], vstack, lstack);
            if (typeof r !== "undefined") {
                return r;
            }
            if (len) {
                stack = stack.slice(0, -1 * len * 2);
                vstack = vstack.slice(0, -1 * len);
                lstack = lstack.slice(0, -1 * len);
            }
            stack.push(this.productions_[action[1]][0]);
            vstack.push(yyval.$);
            lstack.push(yyval._$);
            newState = table[stack[stack.length - 2]][stack[stack.length - 1]];
            stack.push(newState);
            break;
        case 3:
            return true;
        }
    }
    return true;
}
};
/* Jison generated lexer */
var lexer = (function(){
var lexer = ({EOF:1,
parseError:function parseError(str, hash) {
        if (this.yy.parser) {
            this.yy.parser.parseError(str, hash);
        } else {
            throw new Error(str);
        }
    },
setInput:function (input) {
        this._input = input;
        this._more = this._less = this.done = false;
        this.yylineno = this.yyleng = 0;
        this.yytext = this.matched = this.match = '';
        this.conditionStack = ['INITIAL'];
        this.yylloc = {first_line:1,first_column:0,last_line:1,last_column:0};
        if (this.options.ranges) this.yylloc.range = [0,0];
        this.offset = 0;
        return this;
    },
input:function () {
        var ch = this._input[0];
        this.yytext += ch;
        this.yyleng++;
        this.offset++;
        this.match += ch;
        this.matched += ch;
        var lines = ch.match(/(?:\r\n?|\n).*/g);
        if (lines) {
            this.yylineno++;
            this.yylloc.last_line++;
        } else {
            this.yylloc.last_column++;
        }
        if (this.options.ranges) this.yylloc.range[1]++;

        this._input = this._input.slice(1);
        return ch;
    },
unput:function (ch) {
        var len = ch.length;
        var lines = ch.split(/(?:\r\n?|\n)/g);

        this._input = ch + this._input;
        this.yytext = this.yytext.substr(0, this.yytext.length-len-1);
        //this.yyleng -= len;
        this.offset -= len;
        var oldLines = this.match.split(/(?:\r\n?|\n)/g);
        this.match = this.match.substr(0, this.match.length-1);
        this.matched = this.matched.substr(0, this.matched.length-1);

        if (lines.length-1) this.yylineno -= lines.length-1;
        var r = this.yylloc.range;

        this.yylloc = {first_line: this.yylloc.first_line,
          last_line: this.yylineno+1,
          first_column: this.yylloc.first_column,
          last_column: lines ?
              (lines.length === oldLines.length ? this.yylloc.first_column : 0) + oldLines[oldLines.length - lines.length].length - lines[0].length:
              this.yylloc.first_column - len
          };

        if (this.options.ranges) {
            this.yylloc.range = [r[0], r[0] + this.yyleng - len];
        }
        return this;
    },
more:function () {
        this._more = true;
        return this;
    },
less:function (n) {
        this.unput(this.match.slice(n));
    },
pastInput:function () {
        var past = this.matched.substr(0, this.matched.length - this.match.length);
        return (past.length > 20 ? '...':'') + past.substr(-20).replace(/\n/g, "");
    },
upcomingInput:function () {
        var next = this.match;
        if (next.length < 20) {
            next += this._input.substr(0, 20-next.length);
        }
        return (next.substr(0,20)+(next.length > 20 ? '...':'')).replace(/\n/g, "");
    },
showPosition:function () {
        var pre = this.pastInput();
        var c = new Array(pre.length + 1).join("-");
        return pre + this.upcomingInput() + "\n" + c+"^";
    },
next:function () {
        if (this.done) {
            return this.EOF;
        }
        if (!this._input) this.done = true;

        var token,
            match,
            tempMatch,
            index,
            col,
            lines;
        if (!this._more) {
            this.yytext = '';
            this.match = '';
        }
        var rules = this._currentRules();
        for (var i=0;i < rules.length; i++) {
            tempMatch = this._input.match(this.rules[rules[i]]);
            if (tempMatch && (!match || tempMatch[0].length > match[0].length)) {
                match = tempMatch;
                index = i;
                if (!this.options.flex) break;
            }
        }
        if (match) {
            lines = match[0].match(/(?:\r\n?|\n).*/g);
            if (lines) this.yylineno += lines.length;
            this.yylloc = {first_line: this.yylloc.last_line,
                           last_line: this.yylineno+1,
                           first_column: this.yylloc.last_column,
                           last_column: lines ? lines[lines.length-1].length-lines[lines.length-1].match(/\r?\n?/)[0].length : this.yylloc.last_column + match[0].length};
            this.yytext += match[0];
            this.match += match[0];
            this.matches = match;
            this.yyleng = this.yytext.length;
            if (this.options.ranges) {
                this.yylloc.range = [this.offset, this.offset += this.yyleng];
            }
            this._more = false;
            this._input = this._input.slice(match[0].length);
            this.matched += match[0];
            token = this.performAction.call(this, this.yy, this, rules[index],this.conditionStack[this.conditionStack.length-1]);
            if (this.done && this._input) this.done = false;
            if (token) return token;
            else return;
        }
        if (this._input === "") {
            return this.EOF;
        } else {
            return this.parseError('Lexical error on line '+(this.yylineno+1)+'. Unrecognized text.\n'+this.showPosition(),
                    {text: "", token: null, line: this.yylineno});
        }
    },
lex:function lex() {
        var r = this.next();
        if (typeof r !== 'undefined') {
            return r;
        } else {
            return this.lex();
        }
    },
begin:function begin(condition) {
        this.conditionStack.push(condition);
    },
popState:function popState() {
        return this.conditionStack.pop();
    },
_currentRules:function _currentRules() {
        return this.conditions[this.conditionStack[this.conditionStack.length-1]].rules;
    },
topState:function () {
        return this.conditionStack[this.conditionStack.length-2];
    },
pushState:function begin(condition) {
        this.begin(condition);
    }});
lexer.options = {};
lexer.performAction = function anonymous(yy,yy_,$avoiding_name_collisions,YY_START) {


function strip(start, end) {
  return yy_.yytext = yy_.yytext.substr(start, yy_.yyleng-end);
}


var YYSTATE=YY_START
switch($avoiding_name_collisions) {
case 0:
                                   if(yy_.yytext.slice(-2) === "\\\\") {
                                     strip(0,1);
                                     this.begin("mu");
                                   } else if(yy_.yytext.slice(-1) === "\\") {
                                     strip(0,1);
                                     this.begin("emu");
                                   } else {
                                     this.begin("mu");
                                   }
                                   if(yy_.yytext) return 12;
                                 
break;
case 1:return 12;
break;
case 2:
                                   this.popState();
                                   return 12;
                                 
break;
case 3:
                                  yy_.yytext = yy_.yytext.substr(5, yy_.yyleng-9);
                                  this.popState();
                                  return 15;
                                 
break;
case 4: return 12; 
break;
case 5:strip(0,4); this.popState(); return 13;
break;
case 6:return 45;
break;
case 7:return 46;
break;
case 8: return 16; 
break;
case 9:
                                  this.popState();
                                  this.begin('raw');
                                  return 18;
                                 
break;
case 10:return 34;
break;
case 11:return 24;
break;
case 12:return 29;
break;
case 13:this.popState(); return 28;
break;
case 14:this.popState(); return 28;
break;
case 15:return 26;
break;
case 16:return 26;
break;
case 17:return 32;
break;
case 18:return 31;
break;
case 19:this.popState(); this.begin('com');
break;
case 20:strip(3,5); this.popState(); return 13;
break;
case 21:return 31;
break;
case 22:return 51;
break;
case 23:return 50;
break;
case 24:return 50;
break;
case 25:return 54;
break;
case 26:// ignore whitespace
break;
case 27:this.popState(); return 33;
break;
case 28:this.popState(); return 25;
break;
case 29:yy_.yytext = strip(1,2).replace(/\\"/g,'"'); return 42;
break;
case 30:yy_.yytext = strip(1,2).replace(/\\'/g,"'"); return 42;
break;
case 31:return 52;
break;
case 32:return 44;
break;
case 33:return 44;
break;
case 34:return 43;
break;
case 35:return 50;
break;
case 36:yy_.yytext = strip(1,2); return 50;
break;
case 37:return 'INVALID';
break;
case 38:return 5;
break;
}
};
lexer.rules = [/^(?:[^\x00]*?(?=(\{\{)))/,/^(?:[^\x00]+)/,/^(?:[^\x00]{2,}?(?=(\{\{|\\\{\{|\\\\\{\{|$)))/,/^(?:\{\{\{\{\/[^\s!"#%-,\.\/;->@\[-\^`\{-~]+(?=[=}\s\/.])\}\}\}\})/,/^(?:[^\x00]*?(?=(\{\{\{\{\/)))/,/^(?:[\s\S]*?--\}\})/,/^(?:\()/,/^(?:\))/,/^(?:\{\{\{\{)/,/^(?:\}\}\}\})/,/^(?:\{\{(~)?>)/,/^(?:\{\{(~)?#)/,/^(?:\{\{(~)?\/)/,/^(?:\{\{(~)?\^\s*(~)?\}\})/,/^(?:\{\{(~)?\s*else\s*(~)?\}\})/,/^(?:\{\{(~)?\^)/,/^(?:\{\{(~)?\s*else\b)/,/^(?:\{\{(~)?\{)/,/^(?:\{\{(~)?&)/,/^(?:\{\{!--)/,/^(?:\{\{![\s\S]*?\}\})/,/^(?:\{\{(~)?)/,/^(?:=)/,/^(?:\.\.)/,/^(?:\.(?=([=~}\s\/.)])))/,/^(?:[\/.])/,/^(?:\s+)/,/^(?:\}(~)?\}\})/,/^(?:(~)?\}\})/,/^(?:"(\\["]|[^"])*")/,/^(?:'(\\[']|[^'])*')/,/^(?:@)/,/^(?:true(?=([~}\s)])))/,/^(?:false(?=([~}\s)])))/,/^(?:-?[0-9]+(?:\.[0-9]+)?(?=([~}\s)])))/,/^(?:([^\s!"#%-,\.\/;->@\[-\^`\{-~]+(?=([=~}\s\/.)]))))/,/^(?:\[[^\]]*\])/,/^(?:.)/,/^(?:$)/];
lexer.conditions = {"mu":{"rules":[6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38],"inclusive":false},"emu":{"rules":[2],"inclusive":false},"com":{"rules":[5],"inclusive":false},"raw":{"rules":[3,4],"inclusive":false},"INITIAL":{"rules":[0,1,38],"inclusive":true}};
return lexer;})()
parser.lexer = lexer;
function Parser () { this.yy = {}; }Parser.prototype = parser;parser.Parser = Parser;
return new Parser;
})();exports["default"] = handlebars;
/* jshint ignore:end */
},{}],68:[function(require,module,exports){
"use strict";
var Visitor = require("./visitor")["default"];

function print(ast) {
  return new PrintVisitor().accept(ast);
}

exports.print = print;function PrintVisitor() {
  this.padding = 0;
}

exports.PrintVisitor = PrintVisitor;PrintVisitor.prototype = new Visitor();

PrintVisitor.prototype.pad = function(string) {
  var out = "";

  for(var i=0,l=this.padding; i<l; i++) {
    out = out + "  ";
  }

  out = out + string + "\n";
  return out;
};

PrintVisitor.prototype.program = function(program) {
  var out = "",
      statements = program.statements,
      i, l;

  for(i=0, l=statements.length; i<l; i++) {
    out = out + this.accept(statements[i]);
  }

  this.padding--;

  return out;
};

PrintVisitor.prototype.block = function(block) {
  var out = "";

  out = out + this.pad("BLOCK:");
  this.padding++;
  out = out + this.accept(block.mustache);
  if (block.program) {
    out = out + this.pad("PROGRAM:");
    this.padding++;
    out = out + this.accept(block.program);
    this.padding--;
  }
  if (block.inverse) {
    if (block.program) { this.padding++; }
    out = out + this.pad("{{^}}");
    this.padding++;
    out = out + this.accept(block.inverse);
    this.padding--;
    if (block.program) { this.padding--; }
  }
  this.padding--;

  return out;
};

PrintVisitor.prototype.sexpr = function(sexpr) {
  var params = sexpr.params, paramStrings = [], hash;

  for(var i=0, l=params.length; i<l; i++) {
    paramStrings.push(this.accept(params[i]));
  }

  params = "[" + paramStrings.join(", ") + "]";

  hash = sexpr.hash ? " " + this.accept(sexpr.hash) : "";

  return this.accept(sexpr.id) + " " + params + hash;
};

PrintVisitor.prototype.mustache = function(mustache) {
  return this.pad("{{ " + this.accept(mustache.sexpr) + " }}");
};

PrintVisitor.prototype.partial = function(partial) {
  var content = this.accept(partial.partialName);
  if(partial.context) {
    content += " " + this.accept(partial.context);
  }
  if (partial.hash) {
    content += " " + this.accept(partial.hash);
  }
  return this.pad("{{> " + content + " }}");
};

PrintVisitor.prototype.hash = function(hash) {
  var pairs = hash.pairs;
  var joinedPairs = [], left, right;

  for(var i=0, l=pairs.length; i<l; i++) {
    left = pairs[i][0];
    right = this.accept(pairs[i][1]);
    joinedPairs.push( left + "=" + right );
  }

  return "HASH{" + joinedPairs.join(", ") + "}";
};

PrintVisitor.prototype.STRING = function(string) {
  return '"' + string.string + '"';
};

PrintVisitor.prototype.NUMBER = function(number) {
  return "NUMBER{" + number.number + "}";
};

PrintVisitor.prototype.BOOLEAN = function(bool) {
  return "BOOLEAN{" + bool.bool + "}";
};

PrintVisitor.prototype.ID = function(id) {
  var path = id.parts.join("/");
  if(id.parts.length > 1) {
    return "PATH:" + path;
  } else {
    return "ID:" + path;
  }
};

PrintVisitor.prototype.PARTIAL_NAME = function(partialName) {
    return "PARTIAL:" + partialName.name;
};

PrintVisitor.prototype.DATA = function(data) {
  return "@" + this.accept(data.id);
};

PrintVisitor.prototype.content = function(content) {
  return this.pad("CONTENT[ '" + content.string + "' ]");
};

PrintVisitor.prototype.comment = function(comment) {
  return this.pad("{{! '" + comment.comment + "' }}");
};
},{"./visitor":69}],69:[function(require,module,exports){
"use strict";
function Visitor() {}

Visitor.prototype = {
  constructor: Visitor,

  accept: function(object) {
    return this[object.type](object);
  }
};

exports["default"] = Visitor;
},{}],70:[function(require,module,exports){
"use strict";

var errorProps = ['description', 'fileName', 'lineNumber', 'message', 'name', 'number', 'stack'];

function Exception(message, node) {
  var line;
  if (node && node.firstLine) {
    line = node.firstLine;

    message += ' - ' + line + ':' + node.firstColumn;
  }

  var tmp = Error.prototype.constructor.call(this, message);

  // Unfortunately errors are not enumerable in Chrome (at least), so `for prop in tmp` doesn't work.
  for (var idx = 0; idx < errorProps.length; idx++) {
    this[errorProps[idx]] = tmp[errorProps[idx]];
  }

  if (line) {
    this.lineNumber = line;
    this.column = node.firstColumn;
  }
}

Exception.prototype = new Error();

exports["default"] = Exception;
},{}],71:[function(require,module,exports){
"use strict";
var Utils = require("./utils");
var Exception = require("./exception")["default"];
var COMPILER_REVISION = require("./base").COMPILER_REVISION;
var REVISION_CHANGES = require("./base").REVISION_CHANGES;
var createFrame = require("./base").createFrame;

function checkRevision(compilerInfo) {
  var compilerRevision = compilerInfo && compilerInfo[0] || 1,
      currentRevision = COMPILER_REVISION;

  if (compilerRevision !== currentRevision) {
    if (compilerRevision < currentRevision) {
      var runtimeVersions = REVISION_CHANGES[currentRevision],
          compilerVersions = REVISION_CHANGES[compilerRevision];
      throw new Exception("Template was precompiled with an older version of Handlebars than the current runtime. "+
            "Please update your precompiler to a newer version ("+runtimeVersions+") or downgrade your runtime to an older version ("+compilerVersions+").");
    } else {
      // Use the embedded version info since the runtime doesn't know about this revision yet
      throw new Exception("Template was precompiled with a newer version of Handlebars than the current runtime. "+
            "Please update your runtime to a newer version ("+compilerInfo[1]+").");
    }
  }
}

exports.checkRevision = checkRevision;// TODO: Remove this line and break up compilePartial

function template(templateSpec, env) {
  /* istanbul ignore next */
  if (!env) {
    throw new Exception("No environment passed to template");
  }
  if (!templateSpec || !templateSpec.main) {
    throw new Exception('Unknown template object: ' + typeof templateSpec);
  }

  // Note: Using env.VM references rather than local var references throughout this section to allow
  // for external users to override these as psuedo-supported APIs.
  env.VM.checkRevision(templateSpec.compiler);

  var invokePartialWrapper = function(partial, indent, name, context, hash, helpers, partials, data, depths) {
    if (hash) {
      context = Utils.extend({}, context, hash);
    }

    var result = env.VM.invokePartial.call(this, partial, name, context, helpers, partials, data, depths);

    if (result == null && env.compile) {
      var options = { helpers: helpers, partials: partials, data: data, depths: depths };
      partials[name] = env.compile(partial, { data: data !== undefined, compat: templateSpec.compat }, env);
      result = partials[name](context, options);
    }
    if (result != null) {
      if (indent) {
        var lines = result.split('\n');
        for (var i = 0, l = lines.length; i < l; i++) {
          if (!lines[i] && i + 1 === l) {
            break;
          }

          lines[i] = indent + lines[i];
        }
        result = lines.join('\n');
      }
      return result;
    } else {
      throw new Exception("The partial " + name + " could not be compiled when running in runtime-only mode");
    }
  };

  // Just add water
  var container = {
    lookup: function(depths, name) {
      var len = depths.length;
      for (var i = 0; i < len; i++) {
        if (depths[i] && depths[i][name] != null) {
          return depths[i][name];
        }
      }
    },
    lambda: function(current, context) {
      return typeof current === 'function' ? current.call(context) : current;
    },

    escapeExpression: Utils.escapeExpression,
    invokePartial: invokePartialWrapper,

    fn: function(i) {
      return templateSpec[i];
    },

    programs: [],
    program: function(i, data, depths) {
      var programWrapper = this.programs[i],
          fn = this.fn(i);
      if (data || depths) {
        programWrapper = program(this, i, fn, data, depths);
      } else if (!programWrapper) {
        programWrapper = this.programs[i] = program(this, i, fn);
      }
      return programWrapper;
    },

    data: function(data, depth) {
      while (data && depth--) {
        data = data._parent;
      }
      return data;
    },
    merge: function(param, common) {
      var ret = param || common;

      if (param && common && (param !== common)) {
        ret = Utils.extend({}, common, param);
      }

      return ret;
    },

    noop: env.VM.noop,
    compilerInfo: templateSpec.compiler
  };

  var ret = function(context, options) {
    options = options || {};
    var data = options.data;

    ret._setup(options);
    if (!options.partial && templateSpec.useData) {
      data = initData(context, data);
    }
    var depths;
    if (templateSpec.useDepths) {
      depths = options.depths ? [context].concat(options.depths) : [context];
    }

    return templateSpec.main.call(container, context, container.helpers, container.partials, data, depths);
  };
  ret.isTop = true;

  ret._setup = function(options) {
    if (!options.partial) {
      container.helpers = container.merge(options.helpers, env.helpers);

      if (templateSpec.usePartial) {
        container.partials = container.merge(options.partials, env.partials);
      }
    } else {
      container.helpers = options.helpers;
      container.partials = options.partials;
    }
  };

  ret._child = function(i, data, depths) {
    if (templateSpec.useDepths && !depths) {
      throw new Exception('must pass parent depths');
    }

    return program(container, i, templateSpec[i], data, depths);
  };
  return ret;
}

exports.template = template;function program(container, i, fn, data, depths) {
  var prog = function(context, options) {
    options = options || {};

    return fn.call(container, context, container.helpers, container.partials, options.data || data, depths && [context].concat(depths));
  };
  prog.program = i;
  prog.depth = depths ? depths.length : 0;
  return prog;
}

exports.program = program;function invokePartial(partial, name, context, helpers, partials, data, depths) {
  var options = { partial: true, helpers: helpers, partials: partials, data: data, depths: depths };

  if(partial === undefined) {
    throw new Exception("The partial " + name + " could not be found");
  } else if(partial instanceof Function) {
    return partial(context, options);
  }
}

exports.invokePartial = invokePartial;function noop() { return ""; }

exports.noop = noop;function initData(context, data) {
  if (!data || !('root' in data)) {
    data = data ? createFrame(data) : {};
    data.root = context;
  }
  return data;
}
},{"./base":61,"./exception":70,"./utils":73}],72:[function(require,module,exports){
"use strict";
// Build out our basic SafeString type
function SafeString(string) {
  this.string = string;
}

SafeString.prototype.toString = function() {
  return "" + this.string;
};

exports["default"] = SafeString;
},{}],73:[function(require,module,exports){
"use strict";
/*jshint -W004 */
var SafeString = require("./safe-string")["default"];

var escape = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "`": "&#x60;"
};

var badChars = /[&<>"'`]/g;
var possible = /[&<>"'`]/;

function escapeChar(chr) {
  return escape[chr];
}

function extend(obj /* , ...source */) {
  for (var i = 1; i < arguments.length; i++) {
    for (var key in arguments[i]) {
      if (Object.prototype.hasOwnProperty.call(arguments[i], key)) {
        obj[key] = arguments[i][key];
      }
    }
  }

  return obj;
}

exports.extend = extend;var toString = Object.prototype.toString;
exports.toString = toString;
// Sourced from lodash
// https://github.com/bestiejs/lodash/blob/master/LICENSE.txt
var isFunction = function(value) {
  return typeof value === 'function';
};
// fallback for older versions of Chrome and Safari
/* istanbul ignore next */
if (isFunction(/x/)) {
  isFunction = function(value) {
    return typeof value === 'function' && toString.call(value) === '[object Function]';
  };
}
var isFunction;
exports.isFunction = isFunction;
/* istanbul ignore next */
var isArray = Array.isArray || function(value) {
  return (value && typeof value === 'object') ? toString.call(value) === '[object Array]' : false;
};
exports.isArray = isArray;

function escapeExpression(string) {
  // don't escape SafeStrings, since they're already safe
  if (string instanceof SafeString) {
    return string.toString();
  } else if (string == null) {
    return "";
  } else if (!string) {
    return string + '';
  }

  // Force a string conversion as this will be done by the append regardless and
  // the regex test will do this transparently behind the scenes, causing issues if
  // an object's to string has escaped characters in it.
  string = "" + string;

  if(!possible.test(string)) { return string; }
  return string.replace(badChars, escapeChar);
}

exports.escapeExpression = escapeExpression;function isEmpty(value) {
  if (!value && value !== 0) {
    return true;
  } else if (isArray(value) && value.length === 0) {
    return true;
  } else {
    return false;
  }
}

exports.isEmpty = isEmpty;function appendContextPath(contextPath, id) {
  return (contextPath ? contextPath + '.' : '') + id;
}

exports.appendContextPath = appendContextPath;
},{"./safe-string":72}],"handlebars":[function(require,module,exports){
module.exports=require('7MzhPZ');
},{}],"7MzhPZ":[function(require,module,exports){
// USAGE:
// var handlebars = require('handlebars');

// var local = handlebars.create();

var handlebars = require('../dist/cjs/handlebars')["default"];

handlebars.Visitor = require('../dist/cjs/handlebars/compiler/visitor')["default"];

var printer = require('../dist/cjs/handlebars/compiler/printer');
handlebars.PrintVisitor = printer.PrintVisitor;
handlebars.print = printer.print;

module.exports = handlebars;

// Publish a Node.js require() handler for .handlebars and .hbs files
/* istanbul ignore else */
if (typeof require !== 'undefined' && require.extensions) {
  var extension = function(module, filename) {
    var fs = require("fs");
    var templateString = fs.readFileSync(filename, "utf8");
    module.exports = handlebars.compile(templateString);
  };
  require.extensions[".handlebars"] = extension;
  require.extensions[".hbs"] = extension;
}

},{"../dist/cjs/handlebars":59,"../dist/cjs/handlebars/compiler/printer":68,"../dist/cjs/handlebars/compiler/visitor":69,"fs":1}],"router-lib":[function(require,module,exports){
module.exports=require('ifsK7d');
},{}],"ifsK7d":[function(require,module,exports){
module.exports = {
  router: require('./router'),
  helpers: require('./lib/helpers'),
  browser: require('./lib/browser'),
  Route: require('./lib/Route'),
  Matcher: require('./lib/Matcher'),
  Params: require('./lib/Params'),
  Query: require('./lib/Query')
};

},{"./lib/Matcher":78,"./lib/Params":79,"./lib/Query":80,"./lib/Route":81,"./lib/browser":82,"./lib/helpers":83,"./router":87}],78:[function(require,module,exports){
var regexpFromPath = require('path-to-regexp');
var helpers = require('./helpers');

var Matcher = {};

Matcher.fromPaths = function(paths) {
  return helpers.map(Matcher.fromPath, paths);
};

Matcher.fromPath = function(path) {
  var keys = [];
  var regexp = regexpFromPath(path, keys);
  return {
    path: path,
    regexp: regexp,
    keys: keys
  };
};

Matcher.matchWithRegexp = function(matchers, pattern) {
  return helpers.reduce(function(match, matcher) {
    if (match) {
      return match;
    }
    var regexp = matcher.regexp;
    if (regexp.test(pattern)) {
      return matcher;
    }
    return null;
  }, null, matchers);
};

Matcher.matchWithPath = function(matchers, path) {
  return helpers.reduce(function(match, matcher) {
    if (match) {
      return match;
    }
    if (matcher.path === path) {
      return matcher;
    }
    return null;
  }, null, matchers);
};

module.exports = Matcher;

},{"./helpers":83,"path-to-regexp":85}],79:[function(require,module,exports){
var helpers = require('./helpers');
var browser = require('./browser');

var Params = {};

Params.injectIntoPath = function(path, params) {
  var pattern = path;
  var paramNames = helpers.properties(params);
  helpers.each(function(name) {
    pattern = pattern.replace(':' + name, browser.uriEncode(params[name]));
  }, paramNames);
  return pattern;
};

Params.fromMatchedPattern = function(matcher, pattern) {
  var values = matcher.regexp.exec(pattern);
  if (!values) {
    return null;
  }
  values = helpers.slice(values, 1);
  var params = helpers.reduce(function(acc, key, index) {
    acc[key.name] = browser.uriDecode(values[index]);
    return acc;
  }, {}, matcher.keys);
  if (!helpers.properties(params).length) {
    return null;
  }
  return params;
};

module.exports = Params;

},{"./browser":82,"./helpers":83}],80:[function(require,module,exports){
var qs = require('qs');

var Query = {};

Query._regexp = /\?(.+)/;

Query.stringify = function(query) {
  return qs.stringify(query);
};

Query.parse = function(queryString) {
  return qs.parse(queryString);
};

Query.uriWithoutQueryString = function(uri) {
  return uri.replace(Query._regexp, '');
};

Query.fromUri = function(uri) {
  var queryString = Query._queryStringFromUri(uri);
  if (!queryString) {
    return null;
  }
  return Query.parse(queryString);
};

Query._queryStringFromUri = function(uri) {
  var match = uri.match(Query._regexp);
  return match && match[1];
};

module.exports = Query;

},{"qs":86}],81:[function(require,module,exports){
var Params = require('./Params');
var Query = require('./Query');

var Route = {};

Route.toUri = function(route) {
  var uri = Route._injectParams(route);

  var query = route.query;
  if (query) {
    uri = uri + '?' + Query.stringify(query);
  }

  return uri;
};

Route._injectParams = function(route) {
  var path = route.path;
  if (!path) {
    throw new Error('Can\'t build URI pattern from route without a "path" property');
  }
  var params = route.params || {};
  return Params.injectIntoPath(path, params);
};

Route.fromMatchedUri = function(matcher, uri) {
  var pattern = Query.uriWithoutQueryString(uri);
  var params = Params.fromMatchedPattern(matcher, pattern);
  var query = Query.fromUri(uri);

  var route = {path: matcher.path};
  if (params) {
    route.params = params;
  }
  if (query) {
    route.query = query;
  }

  return route;
};

module.exports = Route;

},{"./Params":79,"./Query":80}],82:[function(require,module,exports){
var helpers = require('./helpers');

var browser = {};

browser.on = function(eventName, handler, context) {
  window.addEventListener(eventName, helpers.bind(handler, context), false);
};

browser.uriEncode = function(str) {
  return encodeURIComponent(str);
};

browser.uriDecode = function(str) {
  return decodeURIComponent(str);
};

browser.setUri = function(uri) {
  location.hash = uri;
};

browser.replaceUri = function(uri) {
  location.replace('#' + uri);
};

browser.getCurrentUri = function () {
  return location.hash.replace('#', '');
};

module.exports = browser;

},{"./helpers":83}],83:[function(require,module,exports){
var fn = require('fn.js');

var helpers = {};

helpers.slice = function(array) {
  var args = Array.prototype.slice.call(arguments, 1);
  return Array.prototype.slice.apply(array, args);
};

helpers.bind = function(func, context) {
  return function() {
    func.apply(context, Array.prototype.slice.call(arguments));
  };
};

helpers.map = fn.map;

helpers.reduce = fn.reduce;

helpers.each = fn.each;

helpers.properties = fn.properties;

module.exports = helpers;

},{"fn.js":84}],84:[function(require,module,exports){
(function(root, factory) {
	if (typeof define === 'function' && define.amd) {
		define(factory);
	} else if (typeof exports === 'object') {
		module.exports = factory(require, exports, module);
	} else {
		root.fn = factory();
	}
}(this, function(require, exports, module) {
'use strict';

var fn = { };

fn.toArray = function (collection) {
	return [ ].slice.call(collection);
};

fn.cloneArray = fn.toArray;

fn.op = {
	'+': function (value1, value2) {
		return value1 + value2;
	},
	'-': function (value1, value2) {
		return value1 - value2;
	},
	'*': function (value1, value2) {
		return value1 * value2;
	},
	'/': function (value1, value2) {
		return value1 / value2;
	},
	'==': function (value1, value2) {
		/*eslint-disable eqeqeq */
		return value1 == value2;
		/*eslint-enable eqeqeq */
	},
	'===': function (value1, value2) {
		return value1 === value2;
	}
};

fn.type = function (value) {
	// If the value is null or undefined, return the stringified name,
	// otherwise get the [[Class]] and compare to the relevant part of the value
	return value == null ?
		'' + value :
		{ }.toString.call(value).slice(8, -1).toLowerCase();
};

fn.is = function (type, value) {
	return type === fn.type(value);
};

fn.apply = function (handler, args) {
	return handler.apply(null, args);
};

fn.concat = function () {
	var args = fn.toArray(arguments);
	var first = args[ 0 ];

	if (!fn.is('array', first) && !fn.is('string', first)) {
		first = args.length ? [ first ] : [ ];
	}

	return first.concat.apply(first, args.slice(1));
};

fn.partial = function () {
	var args = fn.toArray(arguments);
	var handler = args[ 0 ];
	var partialArgs = args.slice(1);

	return function () {
		return fn.apply(handler, fn.concat(partialArgs, fn.toArray(arguments)) );
	};
};

fn.identity = function (arg) {
	return arg;
};

var currier = function makeCurry(rightward) {
	return function (handler, arity) {
		if (handler.curried) {
			return handler;
		}

		arity = arity || handler.length;

		var curry = function curry() {
			var args = fn.toArray(arguments);

			if (args.length >= arity) {
				var transform = rightward ? 'reverse' : 'identity';
				return fn.apply(handler, fn[ transform ](args));
			}

			var inner = function () {
				return fn.apply(curry, args.concat(fn.toArray(arguments)));
			};

			inner.curried = true;

			return inner;
		};

		curry.curried = true;

		return curry;
	};
};

fn.curry = currier(false);

fn.curryRight = currier(true);

fn.properties = function (object) {
	var accumulator = [ ];

	for (var property in object) {
		if (object.hasOwnProperty(property)) {
			accumulator.push(property);
		}
	}

	return accumulator;
};

fn.each = function (handler, collection, params) {
	for (var index = 0, collectionLength = collection.length; index < collectionLength; index++) {
		fn.apply(handler, fn.concat([ collection[ index ], index, collection ], params));
	}
};

fn.reduce = function (handler, accumulator, collection, params) {
	fn.each(function (value, index) {
		accumulator = fn.apply(handler, fn.concat([ accumulator, value, index ], params));
	}, collection);

	return accumulator;
};

fn.filter = function (expression, collection) {
	return fn.reduce(function (accumulator, item, index) {
		expression(item, index) && accumulator.push(item);
		return accumulator;
	}, [ ], collection);
};

fn.op[ '++' ] = fn.partial(fn.op[ '+' ], 1);
fn.op[ '--' ] = fn.partial(fn.op[ '+' ], -1);

fn.map = function (handler, collection, params) {
	return fn.reduce(function (accumulator, value, index) {
		accumulator.push( fn.apply(handler, fn.concat([ value, index, collection ], params)) );
		return accumulator;
	}, [ ], collection);
};

fn.reverse = function (collection) {
	return fn.cloneArray(collection).reverse();
};

fn.pipeline = function () {
	var functions = fn.toArray(arguments);

	return function () {
		return fn.reduce(function (args, func) {
			return [ fn.apply(func, args) ];
		}, fn.toArray(arguments), functions)[ 0 ];
	};
};

fn.compose = function () {
	return fn.apply(fn.pipeline, fn.reverse(arguments));
};

fn.prop = fn.curry(function (name, object) {
	return object[ name ];
});

fn.merge = function () {
	return fn.reduce(function (accumulator, value) {
		fn.each(function (property) {
			accumulator[ property ] = value[ property ];
		}, fn.properties(value));

		return accumulator;
	}, { }, fn.toArray(arguments));
};

fn.memoize = function memoize(handler, serializer) {
	var cache = { };

	return function () {
		var args = fn.toArray(arguments);
		var key = serializer ? serializer(args) : memoize.serialize(args);

		return key in cache ?
			cache[ key ] :
			cache[ key ] = fn.apply(handler, args);
	};
};

fn.memoize.serialize = function (values) {
	return fn.type(values[ 0 ]) + '|' + JSON.stringify(values[ 0 ]);
};

fn.flip = function (handler) {
	return function () {
		return fn.apply(handler, fn.reverse(arguments));
	};
};

fn.delay = function (handler, msDelay) {
	return setTimeout(handler, msDelay);
};

fn.delayFor = fn.flip(fn.delay);

fn.delayed = function (handler, msDelay) {
	return function () {
		return fn.delay(fn.partial(handler, fn.toArray(arguments)), msDelay);
	};
};

fn.delayedFor = fn.flip(fn.delayed);

fn.async = fn.compose(fn.partial(fn.delayedFor, 0));

fn.throttle = function (handler, msDelay) {
	var throttling;

	return function () {
		var args = fn.toArray(arguments);

		if (throttling) {
			return;
		}

		throttling = fn.delay(function () {
			throttling = false;

			fn.apply(handler, args);
		}, msDelay);
	};
};

fn.debounce = function (handler, msDelay) {
	var debouncing;

	return function () {
		var args = fn.toArray(arguments);

		if (debouncing) {
			clearTimeout(debouncing);
		}

		debouncing = fn.delay(function () {
			debouncing = false;

			fn.apply(handler, args);
		}, msDelay);
	};
};

return fn;
}));
},{}],85:[function(require,module,exports){
/**
 * Expose `pathtoRegexp`.
 */
module.exports = pathtoRegexp;

/**
 * The main path matching regexp utility.
 *
 * @type {RegExp}
 */
var PATH_REGEXP = new RegExp([
  // Match already escaped characters that would otherwise incorrectly appear
  // in future matches. This allows the user to escape special characters that
  // shouldn't be transformed.
  '(\\\\.)',
  // Match Express-style parameters and un-named parameters with a prefix
  // and optional suffixes. Matches appear as:
  //
  // "/:test(\\d+)?" => ["/", "test", "\d+", undefined, "?"]
  // "/route(\\d+)" => [undefined, undefined, undefined, "\d+", undefined]
  '([\\/.])?(?:\\:(\\w+)(?:\\(((?:\\\\.|[^)])*)\\))?|\\(((?:\\\\.|[^)])*)\\))([+*?])?',
  // Match regexp special characters that should always be escaped.
  '([.+*?=^!:${}()[\\]|\\/])'
].join('|'), 'g');

/**
 * Escape the capturing group by escaping special characters and meaning.
 *
 * @param  {String} group
 * @return {String}
 */
function escapeGroup (group) {
  return group.replace(/([=!:$\/()])/g, '\\$1');
}

/**
 * Attach the keys as a property of the regexp.
 *
 * @param  {RegExp} re
 * @param  {Array}  keys
 * @return {RegExp}
 */
var attachKeys = function (re, keys) {
  re.keys = keys;

  return re;
};

/**
 * Normalize the given path string, returning a regular expression.
 *
 * An empty array should be passed in, which will contain the placeholder key
 * names. For example `/user/:id` will then contain `["id"]`.
 *
 * @param  {(String|RegExp|Array)} path
 * @param  {Array}                 keys
 * @param  {Object}                options
 * @return {RegExp}
 */
function pathtoRegexp (path, keys, options) {
  if (keys && !Array.isArray(keys)) {
    options = keys;
    keys = null;
  }

  keys = keys || [];
  options = options || {};

  var strict = options.strict;
  var end = options.end !== false;
  var flags = options.sensitive ? '' : 'i';
  var index = 0;

  if (path instanceof RegExp) {
    // Match all capturing groups of a regexp.
    var groups = path.source.match(/\((?!\?)/g) || [];

    // Map all the matches to their numeric keys and push into the keys.
    keys.push.apply(keys, groups.map(function (match, index) {
      return {
        name:      index,
        delimiter: null,
        optional:  false,
        repeat:    false
      };
    }));

    // Return the source back to the user.
    return attachKeys(path, keys);
  }

  if (Array.isArray(path)) {
    // Map array parts into regexps and return their source. We also pass
    // the same keys and options instance into every generation to get
    // consistent matching groups before we join the sources together.
    path = path.map(function (value) {
      return pathtoRegexp(value, keys, options).source;
    });

    // Generate a new regexp instance by joining all the parts together.
    return attachKeys(new RegExp('(?:' + path.join('|') + ')', flags), keys);
  }

  // Alter the path string into a usable regexp.
  path = path.replace(PATH_REGEXP, function (match, escaped, prefix, key, capture, group, suffix, escape) {
    // Avoiding re-escaping escaped characters.
    if (escaped) {
      return escaped;
    }

    // Escape regexp special characters.
    if (escape) {
      return '\\' + escape;
    }

    var repeat   = suffix === '+' || suffix === '*';
    var optional = suffix === '?' || suffix === '*';

    keys.push({
      name:      key || index++,
      delimiter: prefix || '/',
      optional:  optional,
      repeat:    repeat
    });

    // Escape the prefix character.
    prefix = prefix ? '\\' + prefix : '';

    // Match using the custom capturing group, or fallback to capturing
    // everything up to the next slash (or next period if the param was
    // prefixed with a period).
    capture = escapeGroup(capture || group || '[^' + (prefix || '\\/') + ']+?');

    // Allow parameters to be repeated more than once.
    if (repeat) {
      capture = capture + '(?:' + prefix + capture + ')*';
    }

    // Allow a parameter to be optional.
    if (optional) {
      return '(?:' + prefix + '(' + capture + '))?';
    }

    // Basic parameter support.
    return prefix + '(' + capture + ')';
  });

  // Check whether the path ends in a slash as it alters some match behaviour.
  var endsWithSlash = path[path.length - 1] === '/';

  // In non-strict mode we allow an optional trailing slash in the match. If
  // the path to match already ended with a slash, we need to remove it for
  // consistency. The slash is only valid at the very end of a path match, not
  // anywhere in the middle. This is important for non-ending mode, otherwise
  // "/test/" will match "/test//route".
  if (!strict) {
    path = (endsWithSlash ? path.slice(0, -2) : path) + '(?:\\/(?=$))?';
  }

  // In non-ending mode, we need prompt the capturing groups to match as much
  // as possible by using a positive lookahead for the end or next path segment.
  if (!end) {
    path += strict && endsWithSlash ? '' : '(?=\\/|$)';
  }

  return attachKeys(new RegExp('^' + path + (end ? '$' : ''), flags), keys);
};

},{}],86:[function(require,module,exports){
/**
 * Object#toString() ref for stringify().
 */

var toString = Object.prototype.toString;

/**
 * Object#hasOwnProperty ref
 */

var hasOwnProperty = Object.prototype.hasOwnProperty;

/**
 * Array#indexOf shim.
 */

var indexOf = typeof Array.prototype.indexOf === 'function'
  ? function(arr, el) { return arr.indexOf(el); }
  : function(arr, el) {
      for (var i = 0; i < arr.length; i++) {
        if (arr[i] === el) return i;
      }
      return -1;
    };

/**
 * Array.isArray shim.
 */

var isArray = Array.isArray || function(arr) {
  return toString.call(arr) == '[object Array]';
};

/**
 * Object.keys shim.
 */

var objectKeys = Object.keys || function(obj) {
  var ret = [];
  for (var key in obj) {
    if (obj.hasOwnProperty(key)) {
      ret.push(key);
    }
  }
  return ret;
};

/**
 * Array#forEach shim.
 */

var forEach = typeof Array.prototype.forEach === 'function'
  ? function(arr, fn) { return arr.forEach(fn); }
  : function(arr, fn) {
      for (var i = 0; i < arr.length; i++) fn(arr[i]);
    };

/**
 * Array#reduce shim.
 */

var reduce = function(arr, fn, initial) {
  if (typeof arr.reduce === 'function') return arr.reduce(fn, initial);
  var res = initial;
  for (var i = 0; i < arr.length; i++) res = fn(res, arr[i]);
  return res;
};

/**
 * Cache non-integer test regexp.
 */

var isint = /^[0-9]+$/;

function promote(parent, key) {
  if (parent[key].length == 0) return parent[key] = {}
  var t = {};
  for (var i in parent[key]) {
    if (hasOwnProperty.call(parent[key], i)) {
      t[i] = parent[key][i];
    }
  }
  parent[key] = t;
  return t;
}

function parse(parts, parent, key, val) {
  var part = parts.shift();
  
  // illegal
  if (Object.getOwnPropertyDescriptor(Object.prototype, key)) return;
  
  // end
  if (!part) {
    if (isArray(parent[key])) {
      parent[key].push(val);
    } else if ('object' == typeof parent[key]) {
      parent[key] = val;
    } else if ('undefined' == typeof parent[key]) {
      parent[key] = val;
    } else {
      parent[key] = [parent[key], val];
    }
    // array
  } else {
    var obj = parent[key] = parent[key] || [];
    if (']' == part) {
      if (isArray(obj)) {
        if ('' != val) obj.push(val);
      } else if ('object' == typeof obj) {
        obj[objectKeys(obj).length] = val;
      } else {
        obj = parent[key] = [parent[key], val];
      }
      // prop
    } else if (~indexOf(part, ']')) {
      part = part.substr(0, part.length - 1);
      if (!isint.test(part) && isArray(obj)) obj = promote(parent, key);
      parse(parts, obj, part, val);
      // key
    } else {
      if (!isint.test(part) && isArray(obj)) obj = promote(parent, key);
      parse(parts, obj, part, val);
    }
  }
}

/**
 * Merge parent key/val pair.
 */

function merge(parent, key, val){
  if (~indexOf(key, ']')) {
    var parts = key.split('[')
      , len = parts.length
      , last = len - 1;
    parse(parts, parent, 'base', val);
    // optimize
  } else {
    if (!isint.test(key) && isArray(parent.base)) {
      var t = {};
      for (var k in parent.base) t[k] = parent.base[k];
      parent.base = t;
    }
    set(parent.base, key, val);
  }

  return parent;
}

/**
 * Compact sparse arrays.
 */

function compact(obj) {
  if ('object' != typeof obj) return obj;

  if (isArray(obj)) {
    var ret = [];

    for (var i in obj) {
      if (hasOwnProperty.call(obj, i)) {
        ret.push(obj[i]);
      }
    }

    return ret;
  }

  for (var key in obj) {
    obj[key] = compact(obj[key]);
  }

  return obj;
}

/**
 * Parse the given obj.
 */

function parseObject(obj){
  var ret = { base: {} };

  forEach(objectKeys(obj), function(name){
    merge(ret, name, obj[name]);
  });

  return compact(ret.base);
}

/**
 * Parse the given str.
 */

function parseString(str){
  var ret = reduce(String(str).split('&'), function(ret, pair){
    var eql = indexOf(pair, '=')
      , brace = lastBraceInKey(pair)
      , key = pair.substr(0, brace || eql)
      , val = pair.substr(brace || eql, pair.length)
      , val = val.substr(indexOf(val, '=') + 1, val.length);

    // ?foo
    if ('' == key) key = pair, val = '';
    if ('' == key) return ret;

    return merge(ret, decode(key), decode(val));
  }, { base: {} }).base;

  return compact(ret);
}

/**
 * Parse the given query `str` or `obj`, returning an object.
 *
 * @param {String} str | {Object} obj
 * @return {Object}
 * @api public
 */

exports.parse = function(str){
  if (null == str || '' == str) return {};
  return 'object' == typeof str
    ? parseObject(str)
    : parseString(str);
};

/**
 * Turn the given `obj` into a query string
 *
 * @param {Object} obj
 * @return {String}
 * @api public
 */

var stringify = exports.stringify = function(obj, prefix) {
  if (isArray(obj)) {
    return stringifyArray(obj, prefix);
  } else if ('[object Object]' == toString.call(obj)) {
    return stringifyObject(obj, prefix);
  } else if ('string' == typeof obj) {
    return stringifyString(obj, prefix);
  } else {
    return prefix + '=' + encodeURIComponent(String(obj));
  }
};

/**
 * Stringify the given `str`.
 *
 * @param {String} str
 * @param {String} prefix
 * @return {String}
 * @api private
 */

function stringifyString(str, prefix) {
  if (!prefix) throw new TypeError('stringify expects an object');
  return prefix + '=' + encodeURIComponent(str);
}

/**
 * Stringify the given `arr`.
 *
 * @param {Array} arr
 * @param {String} prefix
 * @return {String}
 * @api private
 */

function stringifyArray(arr, prefix) {
  var ret = [];
  if (!prefix) throw new TypeError('stringify expects an object');
  for (var i = 0; i < arr.length; i++) {
    ret.push(stringify(arr[i], prefix + '[' + i + ']'));
  }
  return ret.join('&');
}

/**
 * Stringify the given `obj`.
 *
 * @param {Object} obj
 * @param {String} prefix
 * @return {String}
 * @api private
 */

function stringifyObject(obj, prefix) {
  var ret = []
    , keys = objectKeys(obj)
    , key;

  for (var i = 0, len = keys.length; i < len; ++i) {
    key = keys[i];
    if ('' == key) continue;
    if (null == obj[key]) {
      ret.push(encodeURIComponent(key) + '=');
    } else {
      ret.push(stringify(obj[key], prefix
        ? prefix + '[' + encodeURIComponent(key) + ']'
        : encodeURIComponent(key)));
    }
  }

  return ret.join('&');
}

/**
 * Set `obj`'s `key` to `val` respecting
 * the weird and wonderful syntax of a qs,
 * where "foo=bar&foo=baz" becomes an array.
 *
 * @param {Object} obj
 * @param {String} key
 * @param {String} val
 * @api private
 */

function set(obj, key, val) {
  var v = obj[key];
  if (Object.getOwnPropertyDescriptor(Object.prototype, key)) return;
  if (undefined === v) {
    obj[key] = val;
  } else if (isArray(v)) {
    v.push(val);
  } else {
    obj[key] = [v, val];
  }
}

/**
 * Locate last brace in `str` within the key.
 *
 * @param {String} str
 * @return {Number}
 * @api private
 */

function lastBraceInKey(str) {
  var len = str.length
    , brace
    , c;
  for (var i = 0; i < len; ++i) {
    c = str[i];
    if (']' == c) brace = false;
    if ('[' == c) brace = true;
    if ('=' == c && !brace) return i;
  }
}

/**
 * Decode `str`.
 *
 * @param {String} str
 * @return {String}
 * @api private
 */

function decode(str) {
  try {
    return decodeURIComponent(str.replace(/\+/g, ' '));
  } catch (err) {
    return str;
  }
}

},{}],87:[function(require,module,exports){
var browser = require('./lib/browser');
var Route = require('./lib/Route');
var Matcher = require('./lib/Matcher');
var Query = require('./lib/Query');

var router = {
  _matcher: [],
  _onChangeHandler: function() {},

  setMatchedPaths: function(paths) {
    this._matchers = Matcher.fromPaths(paths);
    return this;
  },

  setOnChangeHandler: function(handler) {
    this._onChangeHandler = handler;
    return this;
  },

  start: function() {
    this._addEventListeners();
    this._onUriChange();
  },

  isRouteMatched: function(route) {
    if (!route) {
      return false;
    }
    var path = route.path;
    return Boolean(Matcher.matchWithPath(this._matchers, path));
  },

  _skipNextOnChangeHandler: false,

  updateBrowserUri: function(route, options) {
    options = options || {};
    var currentUri = browser.getCurrentUri();
    var newUri = this.uriFromRoute(route);

    if (newUri === currentUri) {
      // Will not fire browser's hash change handler
      // and there is no need to update anyway
      return;
    }

    // Will fire browser's hash change handler,
    // but we just want to do a "silent" update
    this._skipNextOnChangeHandler = true;

    if (options.replace) {
      browser.replaceUri(newUri);
    }
    else {
      browser.setUri(newUri);
    }
  },

  uriFromRoute: function(route) {
    return Route.toUri(route);
  },

  _addEventListeners: function() {
    browser.on('hashchange', this._onUriChange, this);
  },

  _onUriChange: function() {
    if (this._skipNextOnChangeHandler) {
      this._skipNextOnChangeHandler = false;
      return;
    }

    var uri = browser.getCurrentUri();

    if (!(uri && uri.length)) {
      uri = '/';
      browser.replaceUri(uri);
      return;
    }

    var route = null;
    var pattern = Query.uriWithoutQueryString(uri);
    var matcher = Matcher.matchWithRegexp(this._matchers, pattern);
    if (matcher) {
      route = Route.fromMatchedUri(matcher, uri);
    }

    this._onChangeHandler(uri, route);
  }
};

module.exports = router;

},{"./lib/Matcher":78,"./lib/Query":80,"./lib/Route":81,"./lib/browser":82}],"example":[function(require,module,exports){
module.exports=require('Gnmk1g');
},{}],"Gnmk1g":[function(require,module,exports){
var Loader = function() {

  // will be replaced with the json.
  this.dependencies = {"npm":{"router-lib":"0.x.x","handlebars":"latest"}};
  //this.nodes = ;
  this.nodeDefinitions = {"https://serve-chix.rhcloud.com/nodes/{ns}/{name}":{"router":{"client":{"_id":"54876bdfab54be2e930fbd67","name":"client","ns":"router","description":"Client Side Router, to simplify usage outputs an object keyed by route","async":true,"dependencies":{"npm":{"router-lib":"0.x.x"}},"phrases":{"active":"Routing"},"ports":{"input":{"routes":{"title":"Routes","type":"array","async":true}},"output":{"out":{"title":"Route","type":"object","additionalProperties":true}}},"fn":"on.input.routes = function(data) {\n  var router = router_lib.router;\n  router.setMatchedPaths(data);\n  router.setOnChangeHandler(function(uri, route) {\n    if (route) {\n      var ret = {out: {}};\n      ret.out[route.path] = route;\n      output(ret);\n    } else {\n      output({ error: new Error('URI was not matched') });\n    }\n  });\n};\n","provider":"https://serve-chix.rhcloud.com/nodes/{ns}/{name}"}},"template":{"handlebars":{"_id":"52ea878d1905561c7aa3bdbc","name":"handlebars","ns":"template","description":"Handlebars Template engine","phrases":{"active":"Compiling handlebars template"},"ports":{"input":{"body":{"type":"string","format":"html","title":"Template body","description":"The body of the handlebars template","required":true},"vars":{"type":"object","title":"Input variables","description":"the input variables for this template","default":{}},"handlebars":{"type":"function","title":"Handlebars","default":null}},"output":{"out":{"title":"HTML","type":"string"}}},"dependencies":{"npm":{"handlebars":"latest"}},"fn":"var hb = input.handlebars || handlebars;\nvar tpl = hb.compile(input.body);\noutput = {\n  out: tpl(input.vars)\n}\n","provider":"https://serve-chix.rhcloud.com/nodes/{ns}/{name}"}},"console":{"log":{"_id":"52645993df5da0102500004e","name":"log","ns":"console","description":"Console log","async":true,"phrases":{"active":"Logging to console"},"ports":{"input":{"msg":{"type":"any","title":"Log message","description":"Logs a message to the console","async":true,"required":true}},"output":{"out":{"type":"any","title":"Log message"}}},"fn":"on.input.msg = function() {\n  console.log(data);\n  output( { out: data });\n}\n","provider":"https://serve-chix.rhcloud.com/nodes/{ns}/{name}"}}}};

};

Loader.prototype.hasNodeDefinition = function(nodeId) {

  return !!this.nodes[nodeId];

};

Loader.prototype.getNodeDefinition = function(node, map) {

  if (!this.nodeDefinitions[node.provider]) {

    // needed for subgraphs
    if (map.providers && map.providers[node.provider]) {
      node.provider = map.providers[node.provider].path ||
        map.providers[node.provider].url;
    } else if (map.providers && map.providers['@']) {
      node.provider = map.providers['@'].path ||
        map.providers['@'].url;
    } else {
      throw new Error('Node Provider not found for ' + node.name);
    }
  }

  return this.nodeDefinitions[node.provider][node.ns][node.name];

};

var Flow = require('chix-flow').Flow;
var loader = new Loader();

var map = {"type":"flow","nodes":[{"id":"Router","title":"Router","ns":"router","name":"client"},{"id":"TabbedView","title":"TabbedView","ns":"template","name":"handlebars"},{"id":"Log","title":"Log","ns":"console","name":"log"}],"links":[{"source":{"id":"Router","port":"out"},"target":{"id":"Log","port":"msg"},"metadata":{"title":"Router out -> msg Log"}}],"title":"Router example","ns":"router","name":"example","id":"RouterExample","providers":{"@":{"url":"https://serve-chix.rhcloud.com/nodes/{ns}/{name}"}}};

var actor;
window.Actor = actor = Flow.create(map, loader);

var monitor = require('chix-monitor-npmlog').Actor;
monitor(console, actor);

function onDeviceReady() {
actor.run();
actor.push();
actor.sendIIPs([{"source":{"id":"RouterExample","port":":iip"},"target":{"id":"Router","port":"routes"},"metadata":{"title":"Router example :iip -> routes Router"},"data":["/one","/two","/trees","/tree/:id"]}]);

};

if (navigator.userAgent.match(/(iPhone|iPod|iPad|Android|BlackBerry|IEMobile)/)) {
  document.addEventListener("deviceready", onDeviceReady, false);
} else {
  document.addEventListener("DOMContentLoaded" , onDeviceReady); //this is the browser
}

// for entry it doesn't really matter what is the module.
// as long as this module is loaded.
module.exports = actor;

},{"chix-flow":"jXAsbI","chix-monitor-npmlog":"HNG52E"}]},{},["Gnmk1g"])