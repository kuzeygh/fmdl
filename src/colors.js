const withColor = color => message => `\x1b[1;${color}m${message}\x1b[0m`;

module.exports = {
  withWhite: withColor(37),
  withRed: withColor(31),
  withGreen: withColor(32),
  withYellow: withColor(33)
};
