const gamesElement = document.querySelector('#games');
const statusElement = document.querySelector('#status');
const updatedElement = document.querySelector('#updated');
const liveCountElement = document.querySelector('#live-count');
const dataModeElement = document.querySelector('#data-mode');
const apiDialog = document.querySelector('#api-dialog');
const apiKeyInput = document.querySelector('#api-key');
const apiFeedback = document.querySelector('#api-feedback');
const serverUrlInput = document.querySelector('#server-url');
const tabs = document.querySelectorAll('.tab');
let filter = 'all';
let favorites = JSON.parse(localStorage.getItem('goaltask:favorites') || '[]');
let games = [
  { id: 101, competition: 'Copa do Mundo', home: 'Brasil', away: 'Espanha', homeScore: 2, awayScore: 1, state: "AO VIVO · 72'", live: true },
  { id: 102, competition: 'Copa do Mundo', home: 'Argentina', away: 'França', homeScore: null, awayScore: null, state: 'Hoje · 21:00', live: false },
  { id: 103, competition: 'Brasileirão', home: 'São Paulo', away: 'Flamengo', homeScore: null, awayScore: null, state: 'Domingo · 18:30', live: false },
];
let previousScores = new Map();
let firstRealLoad = true;
let emptyMessage = 'Nenhuma partida encontrada.';

const score = (value) => value == null ? '–' : value;

function render() {
  const visible = filter === 'favorites' ? games.filter((game) => favorites.includes(game.id)) : games;
  liveCountElement.textContent = games.some((game) => game.live) ? `${games.filter((game) => game.live).length} AO VIVO` : '';
  gamesElement.innerHTML = '';
  statusElement.textContent = visible.length
    ? ''
    : filter === 'favorites' ? 'Nenhum jogo favoritado ainda.' : emptyMessage;
  visible.forEach((game) => {
    const card = document.createElement('article');
    card.className = `game${game.live ? ' live' : ''}`;
    card.innerHTML = `
      <button class="favorite ${favorites.includes(game.id) ? 'marked' : ''}" data-id="${game.id}" title="Favoritar">★</button>
      <div class="competition">${game.competition}${game.round ? ` · ${game.round}` : ''}</div>
      <div class="team"><span class="team-name">${game.homeLogo ? `<img class="team-logo" src="${game.homeLogo}" alt="">` : ''}${game.home}</span><span class="score">${score(game.homeScore)}</span></div>
      <div class="team"><span class="team-name">${game.awayLogo ? `<img class="team-logo" src="${game.awayLogo}" alt="">` : ''}${game.away}</span><span class="score">${score(game.awayScore)}</span></div>
      <span class="state${game.live ? ' live' : ''}">${game.state}</span>`;
    gamesElement.appendChild(card);
  });
  document.querySelectorAll('.favorite').forEach((button) => button.addEventListener('click', () => {
    const id = Number(button.dataset.id);
    favorites = favorites.includes(id) ? favorites.filter((item) => item !== id) : [...favorites, id];
    localStorage.setItem('goaltask:favorites', JSON.stringify(favorites));
    render();
  }));
  const compactGame = games.find((game) => game.live && favorites.includes(game.id))
    || games.find((game) => game.live)
    || games.find((game) => favorites.includes(game.id))
    || null;
  window.goalTask.sendScoreboardState(compactGame);
}

async function refresh() {
  statusElement.textContent = 'Buscando partidas…';
  const result = await window.goalTask.fetchGames();

  if (result.mode === 'live') {
    checkGoals(result.games);
    games = result.games;
    dataModeElement.textContent = 'ONLINE';
    dataModeElement.className = 'real';
    emptyMessage = 'Nenhuma partida disponível entre ontem e os próximos quatro dias.';
  } else if (result.mode === 'error') {
    games = [];
    emptyMessage = result.message;
    dataModeElement.textContent = 'ERRO';
    dataModeElement.className = 'error';
    statusElement.textContent = result.message;
  } else {
    dataModeElement.textContent = 'DEMO';
    dataModeElement.className = '';
    emptyMessage = result.message;
  }

  updatedElement.textContent = `Atualizado às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  render();
}

function checkGoals(newGames) {
  for (const game of newGames) {
    const old = previousScores.get(game.id);
    if (!firstRealLoad && old && favorites.includes(game.id)) {
      const homeGoal = (game.homeScore ?? 0) > (old.homeScore ?? 0);
      const awayGoal = (game.awayScore ?? 0) > (old.awayScore ?? 0);
      if (homeGoal || awayGoal) {
        window.goalTask.notifyGoal({ ...game, scorer: homeGoal ? game.home : game.away });
      }
    }
    previousScores.set(game.id, { homeScore: game.homeScore, awayScore: game.awayScore });
  }
  firstRealLoad = false;
}

tabs.forEach((tab) => tab.addEventListener('click', () => {
  tabs.forEach((item) => item.classList.remove('active'));
  tab.classList.add('active');
  filter = tab.dataset.filter;
  render();
}));
document.querySelector('#refresh').addEventListener('click', refresh);
document.querySelector('#settings').addEventListener('click', () => {
  apiKeyInput.value = '';
  apiFeedback.textContent = '';
  apiDialog.showModal();
});
document.querySelector('#save-api').addEventListener('click', async (event) => {
  event.preventDefault();
  apiFeedback.textContent = 'Validando chave…';
  const result = await window.goalTask.configureApiKey(apiKeyInput.value);
  apiFeedback.textContent = result.message;
  if (result.ok) {
    apiKeyInput.value = '';
    setTimeout(() => apiDialog.close(), 500);
    await refresh();
  }
});
document.querySelector('#save-server').addEventListener('click', async () => {
  apiFeedback.textContent = 'Testando servidor…';
  const result = await window.goalTask.configureServer(serverUrlInput.value);
  apiFeedback.textContent = result.message;
  if (result.ok) {
    setTimeout(() => apiDialog.close(), 500);
    await refresh();
  }
});
window.goalTask.onRefresh(refresh);
render();
refresh();
setInterval(refresh, 60_000);
