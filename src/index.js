const fs = require("fs");
const path = require("path");
const url = require("url");
const mkdirp = require("mkdirp");
const delay = require("./delay");
const fetch = require("./fetch");
const downloadFile = require("./downloadFile");

const DEFAULT_FETCH_DELAY = 8000;
const FRONTEND_MASTERS_API_URL = "https://api.frontendmasters.com/v1/kabuki";

const withColor = color => message => `\x1b[1;${color}m${message}\x1b[0m`;
const withRed = withColor(31);
const withGreen = withColor(32);
const withYellow = withColor(33);

const downloadCourse = async ({
  courseSlug,
  cookie = process.env.FMDL_COOKIE,
  resolution = 1080,
  fileFormat = "webm",
  downloadFolder = "Downloads",
  delayBetweenFetch = DEFAULT_FETCH_DELAY,
  output = process.stdout
} = {}) => {
  const logger = message => output.write(`${message}\n`);
  const headers = {
    cookie,
    referer: `https://frontendmasters.com/courses/${courseSlug}`
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

    for (const { index, hash, slug, sourceBase } of lessons) {
      if (!slug) {
        throw `missing slug for ${hash}[${index}]!`;
      }
      if (!sourceBase) {
        throw `missing sourceBase for ${slug}!`;
      }
      const paddedIndex = index.toString().padStart(3, "0");
      const videoPath = path.resolve(
        parentFolder,
        `${paddedIndex}-${slug}.${fileFormat}`
      );
      const prefix = `[${index + 1}/${lessons.length}]`;

      if (fs.existsSync(videoPath)) {
        logger(`${withGreen(prefix)} ${slug} already downloaded, skipping...`);
      } else {
        await delay({
          duration: delayBetweenFetch,
          message: `${withYellow(prefix)} waiting before getting ${slug} url`,
          output
        });
        const { url } = await fetch({
          url: `${sourceBase}/source?r=${resolution}&f=${fileFormat}`,
          headers
        });

        await delay({
          duration: delayBetweenFetch,
          message: `${withYellow(prefix)} waiting before downloading ${slug}`,
          output
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
      }
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
            duration: delayBetweenFetch,
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
