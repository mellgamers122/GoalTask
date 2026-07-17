const pulse = document.querySelector('#pulse');
const label = document.querySelector('#label');
const score = document.querySelector('#score');
const minute = document.querySelector('#minute');

window.goalTask.onScoreboardState((game) => {
  if (!game) {
    pulse.className = '';
    label.textContent = '⚽ GoalTask';
    score.textContent = 'Sem jogo agora';
    minute.textContent = '';
    return;
  }
  pulse.className = game.live ? 'live' : '';
  label.textContent = game.live ? 'AO VIVO' : 'PRÓXIMO';
  score.textContent = game.homeScore == null
    ? `${game.home} × ${game.away}`
    : `${game.home} ${game.homeScore}×${game.awayScore} ${game.away}`;
  minute.textContent = game.live ? game.state.replace('AO VIVO', '').replace('·', '').trim() : '';
});

document.querySelector('#bar').addEventListener('click', (event) => {
  if (event.target.id !== 'drag') window.goalTask.openPanel();
});
