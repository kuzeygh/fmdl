# FMDL - Frontend Masters course DownLoader

[![npm version](https://img.shields.io/npm/v/fmdl.svg?style=flat)](https://www.npmjs.com/package/fmdl)

This downloader starts an HTTP proxy server that intercepts course files while playing and saves a copy locally. Setting up the proxy configuartion for your environment is automated for Windows and manual instructions are provided for any other OS.

Confirmed working with `Node.js 8.x`. Has [issues](https://github.com/joeferner/node-http-mitm-proxy/issues/165) running on `Node.js 10.x`.

## Usage

### Command Line

#### Installation

```console
npm i -g fmdl
```

#### Arguments

| Argument       | Usage                                 | Default     |
| -------------- | ------------------------------------- | ----------- |
| downloadFolder | Location for storing course downloads | `Downloads` |
| debug          | Enable extra debugging output         | `false`     |

Each argument is passed in the form `--argument=value`. Here is an example:

```console
fmdl --downloadFolder=/tmp/Courses --debug
```

### API

FMDL offers a programmatic way to integrate running with existing JavaScript code.

You may bring in the `fmdl` API function using `import` if you have support for ES6 syntax:

```js
import fmdl from "fmdl";

fmdl(options);
```

Or using `require`:

```js
const fmdl = require("fmdl");

fmdl(options);
```

The `options` object has the same properties and values as the arguments supported by the command line version.

## License

FMDL is MIT licensed. See [LICENSE](LICENSE.md). This project exists purely for educational/personal use and is not to be used for violating Frontend Master's terms and conditions.
