const fs = require("fs");
const path = require("path");
const url = require("url");
const mkdirp = require("mkdirp");
const moment = require("moment");
const delay = require("./delay");
const fetch = require("./fetch");
const downloadFile = require("./downloadFile");

const MINIMUM_FETCH_DELAY = 10000;
const FRONTEND_MASTERS_API_URL = "https://api.frontendmasters.com/v1/kabuki";

const withColor = color => message => `\x1b[1;${color}m${message}\x1b[0m`;
const withRed = withColor(31);
const withGreen = withColor(32);
const withYellow = withColor(33);

const diffMsFromTimestamp = timestamp => {
  const timeFormat = "HH:mm:ss";
  const [fromTime, toTime] = timestamp.split(" - ");
  const timeDiff = moment(toTime, timeFormat).diff(
    moment(fromTime, timeFormat)
  );
  return timeDiff;
};

const downloadCourse = async ({
  courseSlug,
  cookie = process.env.FMDL_COOKIE,
  resolution = 1080,
  fileFormat = "webm",
  downloadFolder = "Downloads",
  delayBetweenFetch = MINIMUM_FETCH_DELAY,
  output = process.stdout
} = {}) => {
  const logger = message => output.write(`${message}\n`);
  const headers = {
    cookie,
    origin: "https://frontendmasters.com",
    authority: "api.frontendmasters.com",
    accept: "application/json, text/*",
    "accept-encoding": "gzip, deflate, br",
    "accept-language": "en-US,en;q=0.9",
    referer: `https://frontendmasters.com/courses/${courseSlug}/`,
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/67.0.3396.79 Safari/537.36"
  };
  try {
    if (!courseSlug) {
      throw "courseSlug is required!";
    }
    if (!cookie) {
      throw "authentication missing! either pass the cookie parameter or set a FMDL_COOKIE environment variable!";
    }
    logger(withYellow(`fetching ${courseSlug} course data...`));
    const courseData = await fetch({
      url: `${FRONTEND_MASTERS_API_URL}/courses/${courseSlug}`,
      headers
    });
    const {
      title,
      lessonHashes,
      lessonSlugs,
      lessonData,
      hasWebVTT,
      resources
    } = courseData;
    const lessons = lessonHashes.map((lessonHash, index) => ({
      index,
      hash: lessonHash,
      slug: lessonSlugs[index],
      ...lessonData[lessonHash]
    }));

    logger(`starting downloads for ${title}...`);
    const parentFolder = path.resolve(downloadFolder, courseSlug);
    mkdirp.sync(parentFolder);

    const courseJsonPath = path.resolve(parentFolder, "course.json");
    fs.writeFileSync(courseJsonPath, JSON.stringify(courseData, null, 2));

    for (const { index, hash, slug, timestamp } of lessons) {
      if (!slug) {
        throw `missing slug for ${hash}[${index}]!`;
      }
      const paddedIndex = index.toString().padStart(3, "0");
      const videoPath = path.resolve(
        parentFolder,
        `${paddedIndex}-${slug}.${fileFormat}`
      );
      const prefix = `[${index + 1}/${lessons.length}]`;

      if (hasWebVTT) {
        const vttPath = path.resolve(
          parentFolder,
          `${paddedIndex}-${slug}.vtt`
        );
        if (fs.existsSync(vttPath)) {
          logger(
            withGreen(`subtitles for ${slug} already downloaded, skipping...`)
          );
        } else {
          const vttUrl = `${FRONTEND_MASTERS_API_URL}/transcripts/${hash}.vtt`;

          await delay({
            duration: Math.random() * delayBetweenFetch,
            message: withYellow(
              `waiting before downloading subtitles for ${slug}`
            ),
            output
          });
          await downloadFile({
            prefix: withYellow(prefix),
            name: `subtitles for ${slug}`,
            url: vttUrl,
            headers,
            savePath: vttPath,
            output
          });
          logger(withGreen(`subtitles for ${slug} downloaded`));
        }
      }

      if (fs.existsSync(videoPath)) {
        logger(`${withGreen(prefix)} ${slug} already downloaded, skipping...`);
      } else {
        await delay({
          duration: Math.random() * delayBetweenFetch,
          message: `${withYellow(prefix)} waiting before getting ${slug} url`,
          output
        });
        const { url } = await fetch({
          url: `${FRONTEND_MASTERS_API_URL}/video/${hash}/source?r=${resolution}&f=${fileFormat}`,
          headers
        });

        await downloadFile({
          prefix: withYellow(prefix),
          name: slug,
          url,
          headers,
          savePath: videoPath,
          output
        });
        logger(`${withGreen(prefix)} ${slug} downloaded`);

        const lengthMs = diffMsFromTimestamp(timestamp);
        const additionalDelay = Math.random() * (lengthMs - delayBetweenFetch);
        const totalDelay = delayBetweenFetch + additionalDelay;
        await delay({
          duration: totalDelay,
          message: `${withYellow(prefix)} waiting after downloading ${slug}`,
          output
        });
      }
    }
    for (const { url: resourceUrl } of resources) {
      const { path: resourcePath } = url.parse(resourceUrl);
      const resourceFile = path.basename(resourcePath);
      if (path.extname(resourceFile)) {
        const resourcePath = path.resolve(parentFolder, resourceFile);
        if (fs.existsSync(resourcePath)) {
          logger(withGreen(`${resourceFile} already downloaded, skipping...`));
        } else {
          await downloadFile({
            name: resourceFile,
            url: resourceUrl,
            headers,
            savePath: resourcePath,
            output
          });
          logger(withGreen(`${resourceFile} downloaded`));
        }
      }
    }

    logger(withGreen(`all done downloading ${title}!`));
  } catch (e) {
    logger(`${withRed("problem during course download:")}\n  ${e}`);
  }
};

module.exports = downloadCourse;
