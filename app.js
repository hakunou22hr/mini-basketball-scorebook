const STORAGE_KEY = 'mini-basketball-scorebook-v1';

const initialPlayers = () => Array.from({ length: 5 }, (_, index) => ({
  number: String(index + 4), name: `PLAYER ${index + 1}`, fouls: 0,
}));

const defaultState = () => ({
  scoreA: 0, scoreB: 0, period: 1, seconds: 360, running: false,
  possession: null, activeRoster: 'A', tournament: 'U12 SPRING CUP',
  gameDate: new Date().toISOString().slice(0, 10), teamAName: 'SKY HAWKS',
  teamBName: 'RED COMETS', playersA: initialPlayers(), playersB: initialPlayers(), events: [],
});

let state = loadState();
let timerId = null;

function loadState() {
  try { return { ...defaultState(), ...JSON.parse(localStorage.getItem(STORAGE_KEY)) }; }
  catch { return defaultState(); }
}

function saveState() {
  const saved = { ...state, running: false };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
}

function formatTime(seconds = state.seconds) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function periodLabel(period = state.period) {
  return period <= 4 ? `${period}Q` : `OT${period - 4}`;
}

function periodSeconds(period = state.period) {
  return period <= 4 ? 360 : 180;
}

function teamName(team) { return state[`team${team}Name`]; }

function recordEvent(event) {
  state.events.unshift({ id: Date.now(), period: state.period, time: formatTime(), ...event });
  state.events = state.events.slice(0, 100);
}

function render() {
  document.querySelector('#scoreA').value = state.scoreA;
  document.querySelector('#scoreB').value = state.scoreB;
  document.querySelector('#period').textContent = periodLabel();
  document.querySelector('#clock').textContent = formatTime();
  document.querySelector('#clockToggle').textContent = state.running ? 'PAUSE' : 'START';
  document.querySelector('#clockReset').textContent = state.period <= 4 ? '6:00 に戻す' : '3:00 に戻す';
  document.querySelector('#teamAName').value = state.teamAName;
  document.querySelector('#teamBName').value = state.teamBName;
  document.querySelector('#tournament').value = state.tournament;
  document.querySelector('#gameDate').value = state.gameDate;
  document.querySelectorAll('[data-points="-1"]').forEach((button) => {
    button.disabled = state[`score${button.dataset.team}`] === 0;
  });
  document.querySelectorAll('[data-possession]').forEach((button) => button.classList.toggle('active', button.dataset.possession === state.possession));
  document.querySelectorAll('[data-roster]').forEach((button) => button.classList.toggle('active', button.dataset.roster === state.activeRoster));
  renderRoster();
  renderEvents();
  saveState();
}

function renderRoster() {
  const players = state[`players${state.activeRoster}`];
  document.querySelector('#roster').innerHTML = players.map((player, index) => `
    <div class="player-row">
      <input class="player-number" data-player-field="number" data-index="${index}" value="${escapeHtml(player.number)}" aria-label="背番号">
      <input data-player-field="name" data-index="${index}" value="${escapeHtml(player.name)}" aria-label="選手名">
      <div class="fouls" aria-label="ファウル数">
        ${[1,2,3,4,5].map((foul) => `<button class="foul-dot ${player.fouls >= foul ? 'active' : ''}" data-foul="${foul}" data-index="${index}">${foul}</button>`).join('')}
      </div>
    </div>`).join('');
}

function renderEvents() {
  const log = document.querySelector('#eventLog');
  document.querySelector('#emptyLog').hidden = state.events.length > 0;
  document.querySelector('#undoButton').disabled = state.events.length === 0;
  log.innerHTML = state.events.map((event) => `<li><time>${periodLabel(event.period)} ${event.time}</time><span>${escapeHtml(event.label)}</span><b>${escapeHtml(event.value || '')}</b></li>`).join('');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[char]);
}

document.querySelectorAll('[data-points]').forEach((button) => button.addEventListener('click', () => {
  const { team } = button.dataset;
  const points = Number(button.dataset.points);
  if (points < 0 && state[`score${team}`] === 0) return;
  state[`score${team}`] = Math.max(0, state[`score${team}`] + points);
  recordEvent({
    type: 'score', team, points,
    label: points > 0 ? `${teamName(team)} が得点` : `${teamName(team)} の得点を訂正`,
    value: points > 0 ? `+${points}` : String(points),
  });
  render();
}));

function changePeriod(delta) {
  const nextPeriod = Math.min(8, Math.max(1, state.period + delta));
  if (nextPeriod === state.period) return;
  state.running = false;
  clearInterval(timerId);
  state.period = nextPeriod;
  state.seconds = periodSeconds(nextPeriod);
  render();
}

document.querySelector('#periodDown').addEventListener('click', () => changePeriod(-1));
document.querySelector('#periodUp').addEventListener('click', () => changePeriod(1));

document.querySelector('#clockToggle').addEventListener('click', () => {
  state.running = !state.running;
  if (state.running) {
    timerId = setInterval(() => {
      state.seconds = Math.max(0, state.seconds - 1);
      if (state.seconds === 0) { state.running = false; clearInterval(timerId); showToast('クォーター終了'); }
      render();
    }, 1000);
  } else { clearInterval(timerId); }
  render();
});

document.querySelector('#clockReset').addEventListener('click', () => { state.running = false; clearInterval(timerId); state.seconds = periodSeconds(); render(); });
document.querySelectorAll('[data-possession]').forEach((button) => button.addEventListener('click', () => { state.possession = button.dataset.possession; render(); }));
document.querySelectorAll('[data-roster]').forEach((button) => button.addEventListener('click', () => { state.activeRoster = button.dataset.roster; render(); }));

document.querySelector('#roster').addEventListener('click', (event) => {
  const button = event.target.closest('[data-foul]');
  if (!button) return;
  const player = state[`players${state.activeRoster}`][button.dataset.index];
  const previous = player.fouls;
  player.fouls = Number(button.dataset.foul) === previous ? previous - 1 : Number(button.dataset.foul);
  if (player.fouls > previous) recordEvent({ type: 'foul', team: state.activeRoster, player: Number(button.dataset.index), previous, label: `${teamName(state.activeRoster)} #${player.number} ${player.name}`, value: `F${player.fouls}` });
  render();
});

document.querySelector('#roster').addEventListener('input', (event) => {
  const input = event.target.closest('[data-player-field]');
  if (!input) return;
  state[`players${state.activeRoster}`][input.dataset.index][input.dataset.playerField] = input.value;
  saveState();
});

document.querySelector('#addPlayer').addEventListener('click', () => {
  const players = state[`players${state.activeRoster}`];
  if (players.length >= 15) return showToast('選手は15名まで登録できます');
  players.push({ number: '', name: 'NEW PLAYER', fouls: 0 }); render();
});

document.querySelector('#undoButton').addEventListener('click', () => {
  const event = state.events.shift();
  if (event?.type === 'score') state[`score${event.team}`] = Math.max(0, state[`score${event.team}`] - event.points);
  if (event?.type === 'foul') state[`players${event.team}`][event.player].fouls = event.previous;
  render();
});

['tournament','gameDate','teamAName','teamBName'].forEach((id) => document.querySelector(`#${id}`).addEventListener('input', (event) => { state[id] = event.target.value; saveState(); }));
document.querySelector('#resetButton').addEventListener('click', () => {
  if (!confirm('この試合のすべての記録をリセットしますか？')) return;
  clearInterval(timerId); state = defaultState(); render(); showToast('試合をリセットしました');
});

function showToast(message) {
  const toast = document.querySelector('#toast'); toast.textContent = message; toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}

render();
