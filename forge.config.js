const path = require('node:path');

module.exports = {
  packagerConfig: {
    asar: true,
    icon: path.join(__dirname, 'src', 'assets', 'goaltask.ico'),
    ignore: [
      /^\/\.env$/,
      /^\/work($|\/)/,
      /^\/out($|\/)/,
      /^\/outputs($|\/)/,
      /^\/server($|\/)/,
    ],
    download: {
      cacheRoot: path.join(__dirname, 'work', 'electron-cache'),
    },
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'goaltask',
        setupIcon: path.join(__dirname, 'src', 'assets', 'goaltask.ico'),
        iconUrl: 'https://raw.githubusercontent.com/mellgamers122/GoalTask/main/src/assets/goaltask.ico',
      },
    },
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: { owner: 'mellgamers122', name: 'GoalTask' },
        prerelease: false,
        draft: false,
      },
    },
  ],
};
