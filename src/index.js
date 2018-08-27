const path = require("path");
const url = require("url");
const https = require("https");
const querystring = require("querystring");
const fs = require("fs");
const mkdirp = require("mkdirp");
const Proxy = require("http-mitm-proxy");
const { get, omit } = require("lodash/fp");
const getPort = require("./getPort");
const { withGreen, withYellow, withRed } = require("./colors");

const API_HOST = "frontendmasters.com";
const API_PREFIX = "/v1/kabuki";

const isApiHost = host => host.includes(API_HOST);

const courseData = {};
const downloadSignatures = {};
const warnedDownloadUrls = {};

const logForLessonHash = hash => logger => {
  const lessonData = (courseData.lessonData || {})[hash] || {};
  const prefix = `[${lessonData.index + 1}/${courseData.lessonCount}]`;
  console.log(...logger({ ...lessonData, prefix }));
};

const filenameForHash = hash => {
  const { index, slug } = (courseData.lessonData || {})[hash] || {};
  const paddedIndex = (index + 1).toString().padStart(3, "0");
  return `${paddedIndex}-${slug}`;
};

const downloadToBuffer = request =>
  new Promise(resolve => {
    const chunks = [];
    request.onResponseData((_, chunk, callback) => {
      chunks.push(chunk);
      return callback(null, chunk);
    });
    request.onResponseEnd((_, callback) => {
      const body = Buffer.concat(chunks);
      resolve(body);
      return callback();
    });
  });

const writeToFileIfNeeded = (buffer, filePath) =>
  new Promise(resolve => {
    fs.exists(filePath, exists => {
      if (!exists) {
        fs.writeFile(filePath, buffer, error =>
          resolve({ error, wrote: true })
        );
      } else {
        resolve({ error: null, wrote: false });
      }
    });
  });

const courseDataHandler = [
  `${API_PREFIX}/courses/`,
  ({ request, requestPath, courseSlug, courseFolder }) => {
    if (courseSlug !== requestPath) {
      console.error(
        withRed(
          `requested course data for ${requestPath} but the referer was for ${courseSlug}`
        )
      );
    } else {
      mkdirp.sync(courseFolder);
      const courseJsonPath = path.resolve(courseFolder, "course.json");
      downloadToBuffer(request).then(courseDataBuffer => {
        const responseCourseData = JSON.parse(courseDataBuffer);
        courseData.slug = responseCourseData.slug;
        courseData.lessonData = responseCourseData.lessonData;
        courseData.lessonCount = responseCourseData.lessonHashes.length;

        writeToFileIfNeeded(courseDataBuffer, courseJsonPath).then(
          ({ wrote }) => {
            if (wrote) {
              console.log(
                withGreen(
                  `downloaded course data for: ${responseCourseData.title}`
                )
              );
            } else {
              console.log(
                withYellow(
                  `course data already downloaded for: ${
                    responseCourseData.title
                  }`
                )
              );
            }
            console.log(`${courseData.lessonCount} lessons available`);
          }
        );
      });
    }
  }
];

const videoUrlHandler = [
  `${API_PREFIX}/video/`,
  ({ request, requestPath }) => {
    const [hash, source] = requestPath.split("/");
    const { f: extension } = querystring.parse(source);
    const lessonData = (courseData.lessonData || {})[hash];
    if (!lessonData) {
      console.error(withRed(`missing lesson data for ${hash}`));
    } else {
      const { index, slug, title } = lessonData;
      downloadToBuffer(request).then(videoUrlBuffer => {
        const { url: lessonUrl } = JSON.parse(videoUrlBuffer);
        const parsedLessonUrl = url.parse(lessonUrl);
        const { Signature } = querystring.parse(parsedLessonUrl.query);
        downloadSignatures[Signature] = { hash, index, slug, title, extension };
      });
    }
  }
];

const downloadToFile = ({
  url: requestUrl,
  headers,
  hash,
  filePath,
  fileType
}) => {
  fs.exists(filePath, exists => {
    if (exists) {
      if (!warnedDownloadUrls[requestUrl]) {
        logForLessonHash(hash)(({ prefix, title }) => [
          withYellow(prefix),
          `skipping ${fileType} for ${title}, already downloaded`
        ]);
        warnedDownloadUrls[requestUrl] = false;
      }
    } else {
      logForLessonHash(hash)(({ prefix, title }) => [
        withYellow(prefix),
        `starting download of ${fileType} for ${title}...`
      ]);
      const req = https.request(
        {
          ...url.parse(`https://${headers.host}${requestUrl}`),
          headers: omit(["range", "accept-encoding"])(headers),
          rejectUnauthorized: false
        },
        res => {
          if (res.statusCode >= 300) {
            console.error(withRed(res.statusMessage));
          } else {
            res.pipe(fs.createWriteStream(filePath));
            res.on("end", () => {
              logForLessonHash(hash)(({ prefix, title }) => [
                withGreen(prefix),
                `finished downloading ${fileType} for ${title}`
              ]);
            });
          }
        }
      );
      req.on("error", error => {
        console.error(withRed(error));
      });
      req.end();
    }
  });
};

const transcriptHandler = [
  `${API_PREFIX}/transcripts/`,
  ({ request, requestPath, courseFolder }) => {
    const [hash, extension] = requestPath.split(".");
    const fileName = filenameForHash(hash);
    const transcriptPath = path.resolve(
      courseFolder,
      `${fileName}.${extension}`
    );

    downloadToFile({
      url: request.proxyToServerRequestOptions.path,
      headers: request.proxyToServerRequestOptions.headers,
      hash,
      filePath: transcriptPath,
      fileType: "transcript"
    });
  }
];

const fallbackHandler = [
  "",
  ({ request, requestPath, courseFolder }) => {
    const parsedPath = url.parse(requestPath);
    const { Signature } = querystring.parse(parsedPath.query);
    if (Signature) {
      const lessonData = downloadSignatures[Signature];
      if (!lessonData) {
        console.error(
          withRed(`missing lesson data for download signature ${Signature}`)
        );
      } else {
        const { hash, extension } = lessonData;
        const fileName = filenameForHash(hash);
        const videoPath = path.resolve(
          courseFolder,
          `${fileName}.${extension}`
        );
        downloadToFile({
          url: request.proxyToServerRequestOptions.path,
          headers: request.proxyToServerRequestOptions.headers,
          hash,
          filePath: videoPath,
          fileType: "video"
        });
      }
    }
  }
];

const handleResponse = ({
  request,
  referer = "/",
  requestPath,
  downloadFolder
}) => {
  const parsedReferer = url.parse(referer);
  const [courseSlug, lessonSlug] = parsedReferer.path
    .replace("/courses/", "")
    .split("/");
  if (courseSlug) {
    const courseFolder = path.resolve(downloadFolder, courseSlug);

    const [pathPrefix, handler = Function.prototype] =
      [
        courseDataHandler,
        videoUrlHandler,
        transcriptHandler,
        fallbackHandler
      ].find(([pathPrefix]) => requestPath.startsWith(pathPrefix)) || [];
    handler({
      request,
      requestPath: requestPath.replace(pathPrefix, ""),
      courseSlug,
      lessonSlug,
      courseFolder
    });
  }
};

const handleRequest = ({ request, downloadFolder }) => {
  const {
    headers: { referer },
    host,
    path: requestPath
  } = request.proxyToServerRequestOptions;

  if (isApiHost(host)) {
    request.onResponse((_, callback) => {
      handleResponse({
        request,
        referer,
        requestPath,
        downloadFolder
      });
      return callback();
    });
  }
};

const setUpProxy = ({ proxy, downloadFolder }) => {
  proxy.use(Proxy.gunzip);

  proxy.onError(function(errorContext, err, errorKind) {
    const url = get("clientToProxyRequest.url")(errorContext) || "";
    if (isApiHost(url)) {
      console.error(withRed(errorKind + " on " + url + ":", err));
    }
  });

  proxy.onRequest((request, callback) => {
    request.proxyToServerRequestOptions.rejectUnauthorized = false;
    handleRequest({ request, downloadFolder });
    return callback();
  });
};

module.exports = ({ downloadFolder = "Downloads", debug } = {}) =>
  getPort().then(port => {
    const proxy = Proxy();
    setUpProxy({ proxy, downloadFolder });
    proxy.listen({ port, silent: !debug, sslCaDir: "ssl", keepAlive: false });
    return { port };
  });
