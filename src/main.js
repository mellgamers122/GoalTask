const path = require('node:path');
const fs = require('node:fs');
const {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
  net,
  screen,
  Tray,
} = require('electron');
const { updateElectronApp, UpdateSourceType } = require('update-electron-app');

if (require('electron-squirrel-startup')) app.quit();

let mainWindow;
let tray;
let compactWindow;
let lastScoreboardState = null;
let quitting = false;
const DEFAULT_SERVER_URL = 'https://goaltask-api.guinardo298.workers.dev';

function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || match[1].startsWith('#')) continue;
    const value = match[2].replace(/^(['"])(.*)\1$/, '$2');
    if (!process.env[match[1]]) process.env[match[1]] = value;
  }
}

loadEnvFile();

function settingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function readSettings() {
  try { return JSON.parse(fs.readFileSync(settingsPath(), 'utf8')); }
  catch { return {}; }
}

function writeSettings(changes) {
  const file = settingsPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ ...readSettings(), ...changes }, null, 2), { encoding: 'utf8', mode: 0o600 });
}

function getApiKey() {
  const envKey = (process.env.FOOTBALL_DATA_TOKEN || process.env.FOOTBALL_API_KEY)?.trim();
  if (envKey && envKey.length >= 20 && envKey !== 'coloque_sua_chave_aqui') return envKey;
  try {
    const settings = readSettings();
    return settings.apiKey?.trim() || '';
  } catch {
    return '';
  }
}

function saveApiKey(apiKey) {
  writeSettings({ apiKey });
}

function getServerUrl() {
  return String(readSettings().serverUrl || DEFAULT_SERVER_URL).trim().replace(/\/$/, '');
}

function createTrayIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">
      <circle cx="32" cy="32" r="30" fill="#22c55e"/>
      <circle cx="32" cy="32" r="21" fill="#fff"/>
      <path d="M32 20l9 7-3 11H26l-3-11z" fill="#111827"/>
      <path d="M23 27l-8-2m26 2l8-2M26 38l-5 9m17-9l5 9" stroke="#111827" stroke-width="5"/>
    </svg>`;
  return nativeImage.createFromDataURL(
    `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,
  ).resize({ width: 32, height: 32 });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 580,
    show: false,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#0b1220',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.on('blur', () => mainWindow.hide());
  mainWindow.on('close', (event) => {
    if (!quitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function createCompactWindow() {
  compactWindow = new BrowserWindow({
    width: 285,
    height: 46,
    show: false,
    frame: false,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    backgroundColor: '#101827',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  compactWindow.loadFile(path.join(__dirname, 'compact.html'));
  compactWindow.webContents.on('did-finish-load', () => {
    compactWindow.webContents.send('scoreboard-state', lastScoreboardState);
  });
  compactWindow.setAlwaysOnTop(true, 'floating');
  compactWindow.on('closed', () => { compactWindow = null; });
  compactWindow.on('moved', () => {
    if (!compactWindow) return;
    const [x, y] = compactWindow.getPosition();
    writeSettings({ scoreboardPosition: { x, y } });
  });
  compactWindow.once('ready-to-show', () => {
    positionCompactWindow();
    compactWindow.showInactive();
  });
}

function positionCompactWindow() {
  if (!compactWindow) return;
  const cursor = screen.getCursorScreenPoint();
  const { workArea } = screen.getDisplayNearestPoint(cursor);
  const bounds = compactWindow.getBounds();
  const saved = readSettings().scoreboardPosition;
  const defaultX = workArea.x + workArea.width - bounds.width - 12;
  const defaultY = workArea.y + workArea.height - bounds.height - 8;
  const x = Number.isFinite(saved?.x)
    ? Math.min(Math.max(saved.x, workArea.x), workArea.x + workArea.width - bounds.width)
    : defaultX;
  const y = Number.isFinite(saved?.y)
    ? Math.min(Math.max(saved.y, workArea.y), workArea.y + workArea.height - bounds.height)
    : defaultY;
  compactWindow.setPosition(x, y, false);
}

function positionWindow() {
  const trayBounds = tray.getBounds();
  const windowBounds = mainWindow.getBounds();
  const display = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y });
  const area = display.workArea;
  const x = Math.min(
    Math.max(Math.round(trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2), area.x),
    area.x + area.width - windowBounds.width,
  );
  const y = Math.max(area.y, trayBounds.y - windowBounds.height - 8);
  mainWindow.setPosition(x, y, false);
}

function toggleWindow() {
  if (mainWindow.isVisible()) return mainWindow.hide();
  positionWindow();
  mainWindow.show();
  mainWindow.focus();
}

function createTray() {
  tray = new Tray(createTrayIcon());
  tray.setToolTip('GoalTask — seus jogos na barra');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Abrir GoalTask', click: toggleWindow },
    { label: 'Atualizar placares', click: () => mainWindow.webContents.send('refresh') },
    { type: 'separator' },
    {
      label: 'Sair',
      click: () => {
        quitting = true;
        app.quit();
      },
    },
  ]));
  tray.on('click', toggleWindow);
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.squirrel.goaltask.goaltask');
  createWindow();
  createCompactWindow();
  createTray();
  screen.on('display-metrics-changed', positionCompactWindow);
  if (app.isPackaged) {
    updateElectronApp({
      updateSource: {
        type: UpdateSourceType.ElectronPublicUpdateService,
        repo: 'mellgamers122/GoalTask',
      },
      updateInterval: '1 hour',
      notifyUser: true,
    });
  }
});

ipcMain.on('notify-goal', (_event, game) => {
  if (Notification.isSupported()) {
    new Notification({
      title: `GOOOL — ${game.scorer}`,
      body: `${game.home} ${game.homeScore} × ${game.awayScore} ${game.away}`,
    }).show();
  }
});

ipcMain.handle('fetch-games', async () => {
  const serverUrl = getServerUrl();
  const apiKey = getApiKey();
  if (!serverUrl && (!apiKey || apiKey === 'coloque_sua_chave_aqui')) {
    return { mode: 'demo', games: [], message: 'Configure o servidor GoalTask ou um token individual.' };
  }

  const today = new Date();
  const from = new Date(today);
  const to = new Date(today);
  from.setDate(from.getDate() - 1);
  to.setDate(to.getDate() + 4);
  const date = (value) => value.toISOString().slice(0, 10);
  const query = new URLSearchParams({ dateFrom: date(from), dateTo: date(to) });

  try {
    const response = serverUrl
      ? await net.fetch(`${serverUrl}/matches`)
      : await net.fetch(`https://api.football-data.org/v4/matches?${query}`, { headers: { 'X-Auth-Token': apiKey } });
    const data = await response.json();
    if (!response.ok) throw new Error(`API respondeu ${response.status}`);

    const liveCodes = new Set(['LIVE', 'IN_PLAY', 'PAUSED']);
    const games = (data.matches || []).map((item) => {
      const live = liveCodes.has(item.status);
      const when = new Intl.DateTimeFormat('pt-BR', {
        weekday: 'short', day: '2-digit', month: '2-digit',
        hour: '2-digit', minute: '2-digit',
      }).format(new Date(item.utcDate));
      const score = item.score?.fullTime || {};
      return {
        id: item.id,
        utcDate: item.utcDate,
        competition: item.competition?.name || 'Competição',
        round: item.stage ? item.stage.replaceAll('_', ' ') : '',
        home: item.homeTeam?.shortName || item.homeTeam?.name || 'A definir',
        away: item.awayTeam?.shortName || item.awayTeam?.name || 'A definir',
        homeId: item.homeTeam?.id || `home-${item.id}`,
        awayId: item.awayTeam?.id || `away-${item.id}`,
        homeScore: score.home,
        awayScore: score.away,
        homeLogo: item.homeTeam?.crest || null,
        awayLogo: item.awayTeam?.crest || null,
        state: live
          ? 'AO VIVO'
          : item.status === 'FINISHED' ? 'ENCERRADO' : when,
        live,
      };
    });
    return { mode: 'live', games };
  } catch (error) {
    return { mode: 'error', games: [], message: `Não foi possível consultar a API: ${error.message}` };
  }
});

ipcMain.handle('configure-server', async (_event, rawUrl) => {
  const serverUrl = String(rawUrl || '').trim().replace(/\/$/, '');
  if (!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(serverUrl)) {
    return { ok: false, message: 'Informe uma URL HTTPS válida, sem caminhos extras.' };
  }
  try {
    const response = await net.fetch(`${serverUrl}/health`);
    const data = await response.json();
    if (!response.ok || data.service !== 'GoalTask API') {
      return { ok: false, message: 'Esse endereço não parece ser um servidor GoalTask.' };
    }
    writeSettings({ serverUrl });
    return { ok: true, message: 'Servidor conectado e salvo.' };
  } catch (error) {
    return { ok: false, message: `Não foi possível conectar: ${error.message}` };
  }
});

ipcMain.handle('configure-api-key', async (_event, rawKey) => {
  const apiKey = String(rawKey || '').trim();
  if (apiKey.length < 20) return { ok: false, message: 'A chave parece curta demais.' };
  try {
    const response = await net.fetch('https://api.football-data.org/v4/competitions', {
      headers: { 'X-Auth-Token': apiKey },
    });
    const data = await response.json();
    if (!response.ok || !Array.isArray(data.competitions)) {
      return { ok: false, message: 'A API recusou essa chave. Gere outra e tente novamente.' };
    }
    saveApiKey(apiKey);
    delete process.env.FOOTBALL_API_KEY;
    delete process.env.FOOTBALL_DATA_TOKEN;
    return { ok: true, message: 'Chave validada e salva.' };
  } catch (error) {
    return { ok: false, message: `Não foi possível validar: ${error.message}` };
  }
});

ipcMain.on('scoreboard-state', (_event, game) => {
  lastScoreboardState = game;
  compactWindow?.webContents.send('scoreboard-state', game);
});

ipcMain.on('open-panel', () => {
  if (!mainWindow.isVisible()) {
    positionWindow();
    mainWindow.show();
  }
  mainWindow.focus();
});

app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => {});
