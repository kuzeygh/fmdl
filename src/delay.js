const ProgressBar = require("progress");

const DELAY_TICK = 1000 / 60;

const delay = ({ duration, message = "Waiting", output = process.stdout }) =>
  new Promise(resolve => {
    let delayedFor = 0;
    const progressBar = new ProgressBar(`${message}... [:bar] :etas`, {
      stream: output,
      total: duration,
      clear: true,
      incomplete: " "
    });
    const interval = setInterval(() => {
      delayedFor += DELAY_TICK;
      progressBar.tick(DELAY_TICK);
      if (delayedFor >= duration) {
        clearInterval(interval);
        resolve();
      }
    }, DELAY_TICK);
  });

module.exports = delay;
