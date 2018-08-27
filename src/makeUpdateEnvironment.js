const { spawn } = require("child_process");
const { withYellow } = require("./colors");

const makeRunCommand = ({ debug, command }) => (...args) =>
  new Promise((resolve, reject) => {
    const process = spawn(command, args, {
      shell: true,
      stdio: debug ? "inherit" : "ignore"
    });
    process.on("close", code => (code === 0 ? resolve() : reject(code)));
    process.on("error", reject);
  });
const logWarn = (...args) => console.warn(withYellow(...args));

const makeUpdateManual = ({ platform, port, certPath }) => ({
  setup: () => {
    logWarn(`automatic environment setup not supported in ${platform}`);
    logWarn(
      `please manually add ${certPath} as a trusted root cert and set your HTTP proxy to localhost:${port}`
    );
    return Promise.resolve();
  },
  cleanup: () => {
    logWarn(`automatic environment cleanup not supported in ${platform}`);
    logWarn(`please manually disable the HTTP proxy`);
  }
});

const makeUpdateWindows = ({ debug, port, certPath }) => {
  const convertPathToWindows = path => path.replace(/\//g, "\\");
  const windowsCertPath = convertPathToWindows(certPath);
  const windowsSrcFolder = convertPathToWindows(__dirname);
  const updateEnvironment = (...args) =>
    makeRunCommand({ debug, command: "powershell" })(
      "-ExecutionPolicy Bypass",
      `-File ${windowsSrcFolder}\\updateEnvironment.ps1`,
      args.join(" ")
    );
  const commonArgs = debug ? ["-Debug"] : [];

  return {
    setup: () =>
      updateEnvironment(
        `-CertPath "${windowsCertPath}"`,
        `-Port ${port}`,
        "-EnableProxy",
        ...commonArgs
      ),
    cleanup: () => updateEnvironment(...commonArgs)
  };
};

const makeUpdateEnvironment = ({ debug, port, certPath }) => {
  const { platform } = process;

  switch (platform) {
    case "win32":
      return makeUpdateWindows({ debug, port, certPath });
    default:
      return makeUpdateManual({ platform, port, certPath });
  }
};

module.exports = makeUpdateEnvironment;
