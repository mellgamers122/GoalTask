const gamesElement = document.querySelector('#games');
const statusElement = document.querySelector('#status');
const updatedElement = document.querySelector('#updated');
const liveCountElement = document.querySelector('#live-count');
const dataModeElement = document.querySelector('#data-mode');
const sectionLabel = document.querySelector('#section-label');
const apiDialog = document.querySelector('#api-dialog');
const apiKeyInput = document.querySelector('#api-key');
const apiFeedback = document.querySelector('#api-feedback');
const serverUrlInput = document.querySelector('#server-url');
const teamsDialog = document.querySelector('#teams-dialog');
const teamOptions = document.querySelector('#team-options');
const teamSearch = document.querySelector('#team-search');
const tabs = document.querySelectorAll('.tab');

let filter = 'all';
let favoriteTeams = JSON.parse(localStorage.getItem('goaltask:favorite-teams') || '[]').map(String);
let games = [];
let news = [];
let newsMode = 'all';
let newsMessage = 'Carregando notícias…';
let previousScores = new Map();
let firstRealLoad = true;
let emptyMessage = 'Nenhuma partida encontrada.';

const score = (value) => value == null ? '–' : value;
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const isFavorite = (id) => favoriteTeams.includes(String(id));
const involvesFavorite = (game) => isFavorite(game.homeId) || isFavorite(game.awayId);
const isToday = (game) => game.utcDate && new Date(game.utcDate).toLocaleDateString('pt-BR') === new Date().toLocaleDateString('pt-BR');

function availableTeams() {
  const teams = new Map();
  for (const game of games) {
    teams.set(String(game.homeId), { id: String(game.homeId), name: game.home, logo: game.homeLogo, competition: game.competition });
    teams.set(String(game.awayId), { id: String(game.awayId), name: game.away, logo: game.awayLogo, competition: game.competition });
  }
  return [...teams.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

function saveFavorites() {
  localStorage.setItem('goaltask:favorite-teams', JSON.stringify(favoriteTeams));
}

function toggleTeam(id) {
  const key = String(id);
  favoriteTeams = isFavorite(key) ? favoriteTeams.filter((item) => item !== key) : [...favoriteTeams, key];
  saveFavorites();
  render();
  renderTeamOptions();
}

function teamLine(game, side) {
  const id = game[`${side}Id`];
  const name = game[side];
  const logo = game[`${side}Logo`];
  const value = game[`${side}Score`];
  return `<div class="team"><span class="team-name">${logo ? `<img class="team-logo" src="${logo}" alt="">` : ''}${name}</span><span class="team-actions"><button class="team-favorite ${isFavorite(id) ? 'marked' : ''}" data-team-id="${id}" title="Favoritar ${name}">★</button><span class="score">${score(value)}</span></span></div>`;
}

function renderFavoriteHeader() {
  if (filter !== 'favorites') return '';
  const selected = availableTeams().filter((team) => isFavorite(team.id));
  return `<div class="favorites-header"><div class="favorite-team-list">${selected.length ? selected.map((team) => `<span class="team-chip">${team.logo ? `<img src="${team.logo}" alt="">` : ''}${team.name}<button data-remove-team="${team.id}" title="Remover">×</button></span>`).join('') : '<span class="favorites-empty">Escolha seus times favoritos.</span>'}</div><button id="choose-teams" class="choose-teams">+ Adicionar times</button></div>`;
}

function timeAgo(value) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (!Number.isFinite(minutes)) return '';
  if (minutes < 60) return `há ${minutes || 1} min`;
  if (minutes < 1440) return `há ${Math.floor(minutes / 60)} h`;
  return `há ${Math.floor(minutes / 1440)} d`;
}

function renderNews() {
  gamesElement.innerHTML = `<div class="news-toolbar"><button class="news-filter ${newsMode === 'all' ? 'active' : ''}" data-news-mode="all">Todas</button><button class="news-filter ${newsMode === 'favorites' ? 'active' : ''}" data-news-mode="favorites">Meus times</button></div>`;
  statusElement.textContent = news.length ? '' : newsMessage;
  for (const item of news) {
    const card = document.createElement('button');
    card.className = 'news-card';
    card.dataset.newsUrl = item.url;
    card.innerHTML = `<span class="news-source">${escapeHtml(item.source)}</span><strong>${escapeHtml(item.title)}</strong><small>${timeAgo(item.publishedAt)}</small>`;
    gamesElement.appendChild(card);
  }
  gamesElement.querySelectorAll('[data-news-mode]').forEach((button) => button.addEventListener('click', async () => {
    newsMode = button.dataset.newsMode;
    await refreshNews();
  }));
  gamesElement.querySelectorAll('[data-news-url]').forEach((button) => button.addEventListener('click', () => window.goalTask.openExternal(button.dataset.newsUrl)));
}

function render() {
  if (filter === 'news') {
    sectionLabel.textContent = 'NOTÍCIAS DE FUTEBOL';
    liveCountElement.textContent = '';
    renderNews();
    return;
  }
  sectionLabel.textContent = filter === 'favorites' ? 'MEUS FAVORITOS' : 'PARTIDAS DO DIA';
  const todayGames = games.filter(isToday);
  const visible = filter === 'favorites' ? games.filter(involvesFavorite) : todayGames;
  const liveToday = todayGames.filter((game) => game.live).length;
  liveCountElement.textContent = liveToday ? `${liveToday} AO VIVO` : '';
  gamesElement.innerHTML = renderFavoriteHeader();
  statusElement.textContent = visible.length ? '' : filter === 'favorites' ? 'Nenhuma partida dos seus times no período disponível.' : emptyMessage;

  for (const game of visible) {
    const card = document.createElement('article');
    card.className = `game${game.live ? ' live' : ''}`;
    card.innerHTML = `<div class="competition">${game.competition}${game.round ? ` · ${game.round}` : ''}</div>${teamLine(game, 'home')}${teamLine(game, 'away')}<span class="state${game.live ? ' live' : ''}">${game.state}</span>`;
    gamesElement.appendChild(card);
  }

  gamesElement.querySelectorAll('[data-team-id]').forEach((button) => button.addEventListener('click', () => toggleTeam(button.dataset.teamId)));
  gamesElement.querySelectorAll('[data-remove-team]').forEach((button) => button.addEventListener('click', () => toggleTeam(button.dataset.removeTeam)));
  document.querySelector('#choose-teams')?.addEventListener('click', () => { teamSearch.value = ''; renderTeamOptions(); teamsDialog.showModal(); });

  const compactGame = games.find((game) => game.live && involvesFavorite(game)) || todayGames.find((game) => game.live) || games.find(involvesFavorite) || null;
  window.goalTask.sendScoreboardState(compactGame);
}

function renderTeamOptions() {
  const query = teamSearch.value.trim().toLocaleLowerCase('pt-BR');
  const teams = availableTeams().filter((team) => !query || `${team.name} ${team.competition}`.toLocaleLowerCase('pt-BR').includes(query));
  teamOptions.innerHTML = teams.length ? teams.map((team) => `<button type="button" class="team-option ${isFavorite(team.id) ? 'selected' : ''}" data-team-id="${team.id}">${team.logo ? `<img src="${team.logo}" alt="">` : ''}<span><b>${team.name}</b><small>${team.competition}</small></span><strong>${isFavorite(team.id) ? '✓' : '+'}</strong></button>`).join('') : '<p>Nenhum time encontrado.</p>';
  teamOptions.querySelectorAll('[data-team-id]').forEach((button) => button.addEventListener('click', () => toggleTeam(button.dataset.teamId)));
}

async function refresh() {
  if (filter === 'news') return refreshNews();
  statusElement.textContent = 'Buscando partidas…';
  const result = await window.goalTask.fetchGames();
  if (result.mode === 'live') {
    checkGoals(result.games);
    games = result.games;
    dataModeElement.textContent = 'ONLINE';
    dataModeElement.className = 'real';
    emptyMessage = 'Nenhuma partida marcada para hoje.';
  } else if (result.mode === 'error') {
    games = [];
    emptyMessage = result.message;
    dataModeElement.textContent = 'ERRO';
    dataModeElement.className = 'error';
  } else {
    dataModeElement.textContent = 'DEMO';
    dataModeElement.className = '';
    emptyMessage = result.message;
  }
  updatedElement.textContent = `Atualizado às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  render();
}

async function refreshNews() {
  newsMessage = 'Buscando notícias…';
  renderNews();
  const selectedNames = newsMode === 'favorites'
    ? availableTeams().filter((team) => isFavorite(team.id)).map((team) => team.name)
    : [];
  if (newsMode === 'favorites' && !selectedNames.length) {
    news = [];
    newsMessage = 'Escolha pelo menos um time na aba Favoritos.';
    renderNews();
    return;
  }
  const result = await window.goalTask.fetchNews(selectedNames);
  news = result.news || [];
  newsMessage = result.mode === 'error' ? result.message : 'Nenhuma notícia encontrada.';
  updatedElement.textContent = `Atualizado às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  renderNews();
}

function checkGoals(newGames) {
  for (const game of newGames) {
    const old = previousScores.get(game.id);
    if (!firstRealLoad && old && involvesFavorite(game)) {
      const homeGoal = (game.homeScore ?? 0) > (old.homeScore ?? 0);
      const awayGoal = (game.awayScore ?? 0) > (old.awayScore ?? 0);
      if (homeGoal || awayGoal) window.goalTask.notifyGoal({ ...game, scorer: homeGoal ? game.home : game.away });
    }
    previousScores.set(game.id, { homeScore: game.homeScore, awayScore: game.awayScore });
  }
  firstRealLoad = false;
}

tabs.forEach((tab) => tab.addEventListener('click', async () => { tabs.forEach((item) => item.classList.remove('active')); tab.classList.add('active'); filter = tab.dataset.filter; render(); if (filter === 'news') await refreshNews(); }));
teamSearch.addEventListener('input', renderTeamOptions);
document.querySelector('#refresh').addEventListener('click', refresh);
document.querySelector('#settings').addEventListener('click', () => { apiKeyInput.value = ''; apiFeedback.textContent = ''; apiDialog.showModal(); });
document.querySelector('#save-api').addEventListener('click', async (event) => { event.preventDefault(); apiFeedback.textContent = 'Validando chave…'; const result = await window.goalTask.configureApiKey(apiKeyInput.value); apiFeedback.textContent = result.message; if (result.ok) { apiKeyInput.value = ''; setTimeout(() => apiDialog.close(), 500); await refresh(); } });
document.querySelector('#save-server').addEventListener('click', async () => { apiFeedback.textContent = 'Testando servidor…'; const result = await window.goalTask.configureServer(serverUrlInput.value); apiFeedback.textContent = result.message; if (result.ok) { setTimeout(() => apiDialog.close(), 500); await refresh(); } });
window.goalTask.onRefresh(refresh);
render();
refresh();
setInterval(refresh, 60_000);
