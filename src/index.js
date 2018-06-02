const fs = require("fs");
const path = require("path");
const mkdirp = require("mkdirp");
const delay = require("./delay");
const fetch = require("./fetch");
const downloadFile = require("./downloadFile");

const DEFAULT_FETCH_DELAY = 8000;

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
    const { title, lessonHashes, lessonSlugs, lessonData } = await fetch({
      url: `https://api.frontendmasters.com/v1/kabuki/courses/${courseSlug}`,
      headers
    });
    const lessons = lessonHashes.map((lessonHash, index) => ({
      index,
      hash: lessonHash,
      slug: lessonSlugs[index],
      ...lessonData[lessonHash]
    }));
    logger(`starting downloads for ${title}...`);

    for (const { index, hash, slug, sourceBase } of lessons) {
      if (!slug) {
        throw `missing slug for ${hash}[${index}]!`;
      }
      if (!sourceBase) {
        throw `missing sourceBase for ${slug}!`;
      }
      const paddedIndex = index.toString().padStart(3, "0");
      const parentFolder = path.resolve(downloadFolder, title);
      mkdirp.sync(parentFolder);
      const savePath = path.resolve(
        parentFolder,
        `${paddedIndex}-${slug}.${fileFormat}`
      );
      const prefix = `[${index + 1}/${lessons.length}]`;

      if (fs.existsSync(savePath)) {
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
          savePath,
          output
        });
        logger(`${withGreen(prefix)} ${slug} downloaded`);
      }
    }

    logger(withGreen(`all done downloading ${title}!`));
  } catch (e) {
    logger(`${withRed("problem during course download:")}\n  ${e}`);
  }
};

module.exports = downloadCourse;
