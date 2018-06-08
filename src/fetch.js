const url = require("url");
const https = require("https");
const zlib = require("zlib");

const fetch = ({ url: requestUrl, headers }) =>
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
          const responseData = [];
          res.on("data", chunk => {
            responseData.push(chunk);
          });
          res.on("end", () => {
            const reponseBody = Buffer.concat(responseData);
            if (res.headers["content-encoding"] == "gzip") {
              zlib.gunzip(reponseBody, (err, unzipped) => {
                const responseJson = JSON.parse(unzipped);
                resolve(responseJson);
              });
            } else {
              const responseString = reponseBody.toString("utf8");
              const responseJson = JSON.parse(responseString);
              resolve(responseJson);
            }
          });
        }
      }
    );
    req.on("error", reject);
    req.end();
  });

module.exports = fetch;
