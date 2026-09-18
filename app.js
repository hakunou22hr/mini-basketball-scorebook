const STORAGE_KEY = 'mini-basketball-scorebook-v2';
const ACTIONS = {
  FTM: { label: 'FT成功', points: 1 }, FTX: { label: 'FT失敗', points: 0 },
  '2PM': { label: '2P成功', points: 2 }, '2PX': { label: '2P失敗', points: 0 },
  '3PM': { label: '3P成功', points: 3 }, '3PX': { label: '3P失敗', points: 0 },
  OREB: { label: 'オフェンスリバウンド', points: 0 }, DREB: { label: 'ディフェンスリバウンド', points: 0 },
  AST: { label: 'アシスト', points: 0 }, TOV: { label: 'ターンオーバー', points: 0 },
  STL: { label: 'スティール', points: 0 }, BLK: { label: 'ブロック', points: 0 }, PF: { label: 'ファウル', points: 0 },
};

const initialPlayers = () => Array.from({ length: 5 }, (_, i) => ({ id: `p-${i + 1}-${Math.random().toString(36).slice(2)}`, number: String(i + 4), name: `PLAYER ${i + 1}` }));
const defaultState = () => ({ version: 2, period: 1, seconds: 360, running: false, possession: null, selected: null,
  tournament: 'U12 SPRING CUP', gameDate: new Date().toISOString().slice(0, 10), teamAName: 'SKY HAWKS', teamBName: 'RED COMETS',
  playersA: initialPlayers(), playersB: initialPlayers(), events: [], future: [], activeView: 'input' });

function createEvent(state, team, playerId, action, id = `${Date.now()}-${Math.random()}`) {
  if (!ACTIONS[action] || !['A', 'B'].includes(team)) throw new Error('Invalid event');
  const player = state[`players${team}`].find((item) => item.id === playerId);
  if (!player) throw new Error('Player not found');
  return { id, period: state.period, time: formatTime(state.seconds), team, playerId, action };
}

function derive(state) {
  const stats = { A: {}, B: {} }; const scores = { A: 0, B: 0 }; const quarterScores = { A: [0,0,0,0], B: [0,0,0,0] };
  ['A','B'].forEach((team) => state[`players${team}`].forEach((p) => { stats[team][p.id] = { PTS:0, FTM:0, FTA:0, '2PM':0, '2PA':0, '3PM':0, '3PA':0, OREB:0, DREB:0, REB:0, AST:0, TOV:0, STL:0, BLK:0, PF:0 }; }));
  const running = []; const pbp = []; let a = 0; let b = 0;
  state.events.forEach((event) => {
    const s = stats[event.team][event.playerId]; if (!s || !ACTIONS[event.action]) return;
    const points = ACTIONS[event.action].points;
    if (event.action === 'FTM') { s.FTM++; s.FTA++; } if (event.action === 'FTX') s.FTA++;
    if (event.action === '2PM') { s['2PM']++; s['2PA']++; } if (event.action === '2PX') s['2PA']++;
    if (event.action === '3PM') { s['3PM']++; s['3PA']++; } if (event.action === '3PX') s['3PA']++;
    if (['OREB','DREB','AST','TOV','STL','BLK','PF'].includes(event.action)) s[event.action]++;
    s.PTS += points; s.REB = s.OREB + s.DREB; scores[event.team] += points;
    if (event.period <= 4) quarterScores[event.team][event.period - 1] += points;
    if (event.team === 'A') a += points; else b += points;
    const player = state[`players${event.team}`].find((p) => p.id === event.playerId);
    const detail = { ...event, player, label: ACTIONS[event.action].label, points, scoreA: a, scoreB: b };
    pbp.push(detail); if (points) running.push(detail);
  });
  const teamFouls = { A: state.events.filter((e) => e.team === 'A' && e.period === state.period && e.action === 'PF').length, B: state.events.filter((e) => e.team === 'B' && e.period === state.period && e.action === 'PF').length };
  return { stats, scores, quarterScores, running, pbp, teamFouls };
}

function formatTime(seconds) { return `${String(Math.floor(seconds / 60)).padStart(2,'0')}:${String(seconds % 60).padStart(2,'0')}`; }
function periodLabel(period) { return `${period}Q`; }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

if (typeof module !== 'undefined') module.exports = { ACTIONS, defaultState, createEvent, derive, formatTime };

if (typeof document !== 'undefined') {
  let state = loadState(); let timerId = null; let recognition = null;
  function loadState() { try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); return saved?.version === 2 ? { ...defaultState(), ...saved, running:false } : defaultState(); } catch { return defaultState(); } }
  function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, running:false })); }
  function addEvent(team, playerId, action) { state.events.push(createEvent(state, team, playerId, action)); state.future = []; render(); }
  function selectedPlayer() { return state.selected && state[`players${state.selected.team}`].find((p) => p.id === state.selected.playerId); }

  function render() {
    const data = derive(state); const player = selectedPlayer();
    byId('scoreA').value = data.scores.A; byId('scoreB').value = data.scores.B; byId('period').textContent = periodLabel(state.period); byId('clock').textContent = formatTime(state.seconds);
    byId('clockToggle').textContent = state.running ? 'PAUSE' : 'START';
    ['teamAName','teamBName','tournament','gameDate'].forEach((id) => { if (document.activeElement !== byId(id)) byId(id).value = state[id]; });
    byId('homeRosterTitle').textContent = state.teamAName; byId('awayRosterTitle').textContent = state.teamBName;
    byId('teamFoulA').value = data.teamFouls.A; byId('teamFoulB').value = data.teamFouls.B;
    byId('selectionPrompt').innerHTML = player ? `<small>SELECTED PLAYER</small><strong>${state.selected.team === 'A' ? 'HOME' : 'AWAY'} #${escapeHtml(player.number)} ${escapeHtml(player.name)}</strong>` : '<small>SELECTED PLAYER</small><strong>選手を選択してください</strong>';
    document.querySelectorAll('[data-action]').forEach((b) => b.disabled = !player); byId('undoButton').disabled = !state.events.length; byId('redoButton').disabled = !state.future.length;
    document.querySelectorAll('[data-possession]').forEach((b) => b.classList.toggle('active', b.dataset.possession === state.possession));
    document.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === state.activeView));
    document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === `${state.activeView}View`));
    renderRoster('A', data); renderRoster('B', data); renderStats(data); renderSheet(data); renderPbp(data); saveState();
  }
  function renderRoster(team, data) { byId(`roster${team}`).innerHTML = state[`players${team}`].map((p, i) => `<div class="player-row ${state.selected?.playerId === p.id ? 'selected' : ''}" data-select-player="${p.id}" data-team="${team}"><input data-player-field="number" data-team="${team}" data-index="${i}" value="${escapeHtml(p.number)}" aria-label="背番号"><input data-player-field="name" data-team="${team}" data-index="${i}" value="${escapeHtml(p.name)}" aria-label="選手名"><b>${data.stats[team][p.id].PF}</b></div>`).join(''); }
  function statTable(team, data) { return `<section class="stat-card"><h2><i>${team === 'A' ? 'HOME' : 'AWAY'}</i> ${escapeHtml(state[`team${team}Name`])}</h2><div class="table-wrap"><table><thead><tr><th>NO.</th><th>PLAYER</th>${['PTS','FTM/A','2PM/A','3PM/A','OREB','DREB','REB','AST','TOV','STL','BLK','PF'].map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${state[`players${team}`].map(p=>{const s=data.stats[team][p.id];return `<tr><td>${escapeHtml(p.number)}</td><td>${escapeHtml(p.name)}</td><td>${s.PTS}</td><td>${s.FTM}/${s.FTA}</td><td>${s['2PM']}/${s['2PA']}</td><td>${s['3PM']}/${s['3PA']}</td>${['OREB','DREB','REB','AST','TOV','STL','BLK','PF'].map(k=>`<td>${s[k]}</td>`).join('')}</tr>`}).join('')}</tbody></table></div></section>`; }
  function renderStats(data) { byId('statsContent').innerHTML = statTable('A',data)+statTable('B',data); }
  function sheetTeam(team,data) { return `<section class="sheet-team"><h2>${team==='A'?'HOME':'AWAY'} · ${escapeHtml(state[`team${team}Name`])}</h2><table><thead><tr><th>NO.</th><th>PLAYER</th><th>PF</th><th>1Q</th><th>2Q</th><th>3Q</th><th>4Q</th><th>TOTAL</th></tr></thead><tbody>${state[`players${team}`].map(p=>{const ps=data.stats[team][p.id];const qs=[1,2,3,4].map(q=>state.events.filter(e=>e.team===team&&e.playerId===p.id&&e.period===q).reduce((n,e)=>n+ACTIONS[e.action].points,0));return `<tr><td>${escapeHtml(p.number)}</td><td>${escapeHtml(p.name)}</td><td>${ps.PF}</td>${qs.map(x=>`<td>${x}</td>`).join('')}<td>${ps.PTS}</td></tr>`}).join('')}<tr class="total"><td colspan="3">TEAM SCORE</td>${data.quarterScores[team].map(x=>`<td>${x}</td>`).join('')}<td>${data.scores[team]}</td></tr></tbody></table></section>`; }
  function renderSheet(data) { byId('scoreSheet').innerHTML = `<header class="sheet-header"><div><small>MINI-BASKETBALL SCOREBOOK / U12</small><h1>${escapeHtml(state.tournament)}</h1><p>${escapeHtml(state.gameDate)}</p></div><div class="sheet-final"><b>${data.scores.A}</b><span>FINAL</span><b>${data.scores.B}</b></div></header>${sheetTeam('A',data)}${sheetTeam('B',data)}<section class="running"><h2>RUNNING SCORE</h2>${data.running.length?data.running.map(e=>`<div><time>${periodLabel(e.period)} ${e.time}</time><b>${e.team==='A'?'HOME':'AWAY'} #${escapeHtml(e.player.number)} ${escapeHtml(e.player.name)}</b><span>+${e.points}</span><strong>${e.scoreA} - ${e.scoreB}</strong></div>`).join(''):'<p>得点記録はありません</p>'}</section>`; }
  function renderPbp(data) { byId('pbpContent').innerHTML = data.pbp.length ? [...data.pbp].reverse().map(e=>`<article><time>${periodLabel(e.period)}<b>${e.time}</b></time><span class="team-badge ${e.team}">${e.team==='A'?'HOME':'AWAY'}</span><div><strong>#${escapeHtml(e.player.number)} ${escapeHtml(e.player.name)}</strong><small>${e.label}</small></div><output>${e.scoreA} - ${e.scoreB}</output></article>`).join('') : '<div class="empty">まだ記録がありません</div>'; }
  function byId(id) { return document.getElementById(id); }
  function showToast(message) { const t=byId('toast'); t.textContent=message;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200); }

  document.addEventListener('click', (event) => {
    const tab=event.target.closest('[data-view]'); if(tab){state.activeView=tab.dataset.view;render();return;}
    const row=event.target.closest('[data-select-player]'); if(row && !event.target.matches('input')){state.selected={team:row.dataset.team,playerId:row.dataset.selectPlayer};render();return;}
    const action=event.target.closest('[data-action]'); if(action && selectedPlayer()){addEvent(state.selected.team,state.selected.playerId,action.dataset.action);return;}
    const add=event.target.closest('[data-add-player]'); if(add){const list=state[`players${add.dataset.addPlayer}`];if(list.length>=15)return showToast('選手は15名まで登録できます');list.push({id:`p-${Date.now()}-${Math.random()}`,number:'',name:'NEW PLAYER'});render();}
  });
  document.addEventListener('input',(event)=>{const f=event.target.dataset.playerField;if(f){state[`players${event.target.dataset.team}`][Number(event.target.dataset.index)][f]=event.target.value;saveState();return;}if(['tournament','gameDate','teamAName','teamBName'].includes(event.target.id)){state[event.target.id]=event.target.value;render();}});
  byId('undoButton').onclick=()=>{if(state.events.length){state.future.push(state.events.pop());render();}}; byId('redoButton').onclick=()=>{if(state.future.length){state.events.push(state.future.pop());render();}};
  function changePeriod(delta){const next=Math.max(1,Math.min(4,state.period+delta));if(next===state.period)return;state.running=false;clearInterval(timerId);state.period=next;state.seconds=360;render();}
  byId('periodDown').onclick=()=>changePeriod(-1);byId('periodUp').onclick=()=>changePeriod(1);
  byId('clockToggle').onclick=()=>{state.running=!state.running;if(state.running)timerId=setInterval(()=>{state.seconds=Math.max(0,state.seconds-1);if(!state.seconds){state.running=false;clearInterval(timerId);showToast('クォーター終了');}render();},1000);else clearInterval(timerId);render();};
  byId('clockReset').onclick=()=>{state.running=false;clearInterval(timerId);state.seconds=360;render();}; document.querySelectorAll('[data-possession]').forEach(b=>b.onclick=()=>{state.possession=b.dataset.possession;render();});
  byId('resetButton').onclick=()=>{if(confirm('この試合のすべての記録をリセットしますか？')){clearInterval(timerId);state=defaultState();render();showToast('試合をリセットしました');}}; byId('printButton').onclick=()=>window.print();
  function parseVoice(text){const normalized=text.replace(/\s/g,'').replace(/[０-９]/g,c=>String.fromCharCode(c.charCodeAt(0)-65248));const n=normalized.match(/(\d+)番/)?.[1];const map=[[/ディフェンスリバウンド|DREB/i,'DREB'],[/オフェンスリバウンド|OREB/i,'OREB'],[/アシスト/,'AST'],[/ターンオーバー/,'TOV'],[/スティール/,'STL'],[/ブロック/,'BLK'],[/ファウル/,'PF'],[/3点/,'3PM'],[/2点/,'2PM'],[/1点|フリースロー/,'FTM']];const action=map.find(([r])=>r.test(normalized))?.[1];if(!n||!action)return null;let team=state.selected?.team;let player=team&&state[`players${team}`].find(p=>p.number===n);if(!player){const hits=['A','B'].flatMap(t=>state[`players${t}`].filter(p=>p.number===n).map(p=>({team:t,player:p})));if(hits.length===1)({team,player}=hits[0]);}return player?{team,playerId:player.id,action}:null;}
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;if(SpeechRecognition){recognition=new SpeechRecognition();recognition.lang='ja-JP';recognition.interimResults=false;recognition.onresult=e=>{const text=e.results[0][0].transcript;const parsed=parseVoice(text);byId('voiceStatus').textContent=`認識: ${text}`;if(parsed){state.selected={team:parsed.team,playerId:parsed.playerId};addEvent(parsed.team,parsed.playerId,parsed.action);}else showToast('選手番号またはプレイを認識できませんでした');};recognition.onerror=()=>showToast('音声を認識できませんでした');}else byId('voiceButton').disabled=true;
  byId('voiceButton').onclick=()=>{if(recognition){byId('voiceStatus').textContent='聞き取り中…';recognition.start();}};
  render();
}
