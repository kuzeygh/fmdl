const url = require("url");
const https = require("https");
const fs = require("fs");
const ProgressBar = require("progress");

const downloadFile = ({
  prefix,
  name,
  url: requestUrl,
  headers,
  savePath,
  output = process.stdout
}) =>
  new Promise((resolve, reject) => {
    const req = https.request(
      {
        ...url.parse(requestUrl),
        headers
      },
      res => {
        if (res.statusCode >= 300) {
          reject(res.statusMessage);
        } else {
          if (res.headers["content-length"]) {
            const progressBar = new ProgressBar(
              `${prefix} Downloading ${name} [:bar] :percent :etas`,
              {
                stream: output,
                total: parseInt(res.headers["content-length"]),
                clear: true,
                incomplete: " ",
                complete: "░"
              }
            );

            res.on("data", chunk => {
              progressBar.tick(chunk.length);
            });
          }

          res.pipe(fs.createWriteStream(savePath));
          res.on("end", resolve);
        }
      }
    );
    req.on("error", reject);
    req.end();
  });

module.exports = downloadFile;
