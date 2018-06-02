const url = require("url");
const https = require("https");

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
            const responseString = Buffer.concat(responseData).toString("utf8");
            const responseJson = JSON.parse(responseString);
            resolve(responseJson);
          });
        }
      }
    );
    req.on("error", reject);
    req.end();
  });

module.exports = fetch;
