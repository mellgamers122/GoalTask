const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('goalTask', {
  fetchGames: () => ipcRenderer.invoke('fetch-games'),
  configureApiKey: (apiKey) => ipcRenderer.invoke('configure-api-key', apiKey),
  configureServer: (serverUrl) => ipcRenderer.invoke('configure-server', serverUrl),
  sendScoreboardState: (game) => ipcRenderer.send('scoreboard-state', game),
  onScoreboardState: (callback) => ipcRenderer.on('scoreboard-state', (_event, game) => callback(game)),
  openPanel: () => ipcRenderer.send('open-panel'),
  notifyGoal: (game) => ipcRenderer.send('notify-goal', game),
  onRefresh: (callback) => ipcRenderer.on('refresh', callback),
});
