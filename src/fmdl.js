#!/usr/bin/env node

const downloadCourse = require("./");
const options = require("./options")();

downloadCourse(options);
