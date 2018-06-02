# FMDL - Frontend Masters course DownLoader

[![npm version](https://img.shields.io/npm/v/fmdl.svg?style=flat)](https://www.npmjs.com/package/fmdl)

## Usage

### Command Line

Here are the available command line arguments:

| Argument          | Usage           | Default        |
|-------------------|-----------------|----------------|
| courseSlug        | Short name for course to download. The part after `https://frontendmasters.com/courses/` in the course URL | None, required                     |
| cookie            | Used for authentication with `https://frontendmasters.com`                                                 | `FMDL_COOKIE` environment variable |
| resolution        | Vertical resolution for videos. Allowed values: [`1080`, `720`]                                            | `1080`                             |
| fileFormat        | File format for videos. Allowed values: [`webm`, `mp4`]                                                    | `webm`                             |
| downloadFolder    | Location for storing course downloads                                                                      | `Downloads`                        |
| delayBetweenFetch | Milliseconds to wait between calls to `https://api.frontendmasters.com` to avoid temorary rate limit ban   | `8000` (8 seconds)                 |
| output            | Where to write progress/error updates during download process (only supported with programmatic API)       | `process.stdout`                   |
Each argument is passed in the form `--argument=value`. Here is an example:

```console
npx fmdl --courseSlug=testing-react --fileFormat=mp4 --resolution=720 --downloadFolder=/tmp/Courses
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

FMDL is MIT licensed. See [LICENSE](LICENSE.md).