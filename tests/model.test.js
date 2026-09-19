const assert = require('node:assert/strict');
const fs = require('node:fs');
const { defaultState, createEvent, derive, runningScoreCells, scoreQuarterStack, getQuarterRecordColor, getQuarterInk, periodLabel, participationMark, participationRecordClass } = require('../app.js');
const state = defaultState();
const home = state.playersA[3]; // #7
const away = state.playersB[4]; // #8
state.events.push(createEvent(state, 'A', home.id, '2PM', 'one'));
let data = derive(state);
assert.equal(data.scores.A, 2); assert.equal(data.stats.A[home.id].PTS, 2); assert.equal(data.stats.A[home.id]['2PM'], 1);
assert.equal(data.running.length, 1); assert.equal(data.pbp.length, 1); assert.equal(data.quarterScores.A[0], 2);
state.events.push(createEvent(state, 'B', away.id, '3PM', 'two'));
data = derive(state); assert.equal(data.scores.B, 3); assert.equal(data.stats.B[away.id]['3PM'], 1);
const foul = createEvent(state, 'A', state.playersA[0].id, 'PF', 'three'); state.events.push(foul);
data = derive(state); assert.equal(data.stats.A[state.playersA[0].id].PF, 1); assert.equal(data.teamFouls.A, 1);
state.future.push(state.events.pop()); data = derive(state); assert.equal(data.teamFouls.A, 0);
state.events.push(state.future.pop()); data = derive(state); assert.equal(data.teamFouls.A, 1);
state.period = 2; state.seconds = 360; state.events.push(createEvent(state, 'A', home.id, 'FTM', 'four'));
data = derive(state); assert.deepEqual(data.quarterScores.A, [2,1,0,0,0]); assert.equal(data.scores.A, 3);

// TEST 1: a made basket updates team/player/quarter/running score from one event.
assert.equal(data.running[0].player.number, '7');
assert.equal(data.running[0].scoreA, 2);
// TEST 2: personal and team fouls are derived from that same event stream.
state.period = 1;
state.events.push(createEvent(state, 'B', away.id, 'PF', 'five'));
data = derive(state);
assert.equal(data.stats.B[away.id].PF, 1);
assert.equal(data.teamFoulsByPeriod.B[0], 1);
// Timeout is also undoable event data and retained per period.
state.events.push(createEvent(state, 'A', null, 'TIMEOUT', 'six'));
assert.equal(derive(state).timeouts.A[0], 1);
state.future.push(state.events.pop());
assert.equal(derive(state).timeouts.A[0], 0);
// TEST 3/4: changing quarter retains Q1; removing its score event reverses all totals.
state.period = 2;
assert.equal(derive(state).quarterScores.A[0], 2);
const scoreIndex = state.events.findIndex((event) => event.id === 'one');
const [scoreEvent] = state.events.splice(scoreIndex, 1);
data = derive(state);
assert.equal(data.scores.A, 1); assert.equal(data.stats.A[home.id].PTS, 1); assert.equal(data.running.length, 2); assert.equal(data.quarterScores.A[0], 0);
state.events.splice(scoreIndex, 0, scoreEvent);
assert.equal(derive(state).scores.A, 3);
const runningScore = runningScoreCells(derive(state));
assert.match(runningScore, /<th>A<\/th><th>得点<\/th><th class="team-b-score-number">得点<\/th><th>B<\/th>/);
assert.match(runningScore, /scorer-mark ink-red[^>]*>7<\/span>/);
assert.match(runningScore, /score-slash ink-red/);
assert.match(runningScore, /scorer-mark ink-black[^>]*>7<\/span>/);
assert.match(runningScore, /score-dot ink-black/);
console.log('23 synchronized JBA U12 scorebook model checks passed');

// TIMEOUT uses the common event stream for PBP, scoresheet counts, undo, and redo.
state.period = 2; state.seconds = 204;
const timeout = createEvent(state, 'B', null, 'TIMEOUT', 'timeout-b');
state.events.push(timeout); data = derive(state);
assert.equal(timeout.time, '03:24');
assert.equal(data.timeouts.B[1], 1);
assert.equal(data.pbp.at(-1).label, 'TIMEOUT');
state.future.push(state.events.pop()); assert.equal(derive(state).timeouts.B[1], 0);
state.events.push(state.future.pop()); assert.equal(derive(state).timeouts.B[1], 1);

// A period transition is one undoable event and expands into end/start PBP entries.
const { createPeriodChangeEvent } = require('../app.js');
state.period = 2; state.seconds = 0;
const transition = createPeriodChangeEvent(state, 'period-2-3');
assert.deepEqual({from:transition.fromPeriod,to:transition.toPeriod,seconds:transition.toSeconds},{from:2,to:3,seconds:360});
state.events.push(transition); data = derive(state);
assert.deepEqual(data.pbp.slice(-2).map(event => [event.displayPeriod,event.time,event.label]), [[2,'00:00','2Q終了'],[3,'06:00','3Q開始']]);
assert.deepEqual(data.quarterScores.A, [2,1,0,0,0]);
state.events.pop(); assert.equal(derive(state).pbp.some(event => event.id === 'period-2-3'), false);
state.events.push(transition); assert.equal(derive(state).pbp.filter(event => event.id === 'period-2-3').length, 2);

// Regulation advances at six minutes; 4Q advances to the existing three-minute OT.
state.period = 3; assert.equal(createPeriodChangeEvent(state, 'period-3-4').toSeconds, 360);
state.period = 4;
const overtime = createPeriodChangeEvent(state, 'period-4-ot');
assert.equal(overtime.toPeriod, 5); assert.equal(overtime.toSeconds, 180);
console.log('TIMEOUT and quarter transition checks passed');


// Official ink is shared by running score, player fouls, and team fouls.
assert.deepEqual([1,2,3,4,5,6].map(getQuarterInk), ['red','black','red','black','black','black']);
assert.deepEqual([1,2,3,4,5,6].map(periodLabel), ['1Q','2Q','3Q','4Q','OT','OT2']);
state.period = 5;
const secondOvertime = createPeriodChangeEvent(state, 'period-ot-ot2');
assert.equal(secondOvertime.toPeriod, 6); assert.equal(secondOvertime.toSeconds, 180);
state.period = 3;
const q3Foul = createEvent(state, 'A', home.id, 'PF', 'q3-foul'); state.events.push(q3Foul);
assert.deepEqual(derive(state).stats.A[home.id].personalFouls.slice(-1), [3]);
console.log('Quarter ink and multiple-overtime checks passed');

// JBA U12 running score: only the reached total is marked, using the shot-specific symbol.
const runningState = defaultState();
const scorers = runningState.playersA.slice(0,4);
scorers.forEach((player,index) => { player.number = ['4','5','6','8'][index]; });
runningState.events.push(createEvent(runningState, 'A', scorers[0].id, '2PM', 'run-2-a'));
runningState.events.push(createEvent(runningState, 'A', scorers[1].id, '2PM', 'run-2-b'));
runningState.events.push(createEvent(runningState, 'A', scorers[2].id, '3PM', 'run-3'));
runningState.events.push(createEvent(runningState, 'A', scorers[3].id, 'FTM', 'run-ft'));
let runningHtml = runningScoreCells(derive(runningState));
const runningRow = n => runningHtml.match(/<tr><td>.*?<\/tr>/g)[n-1].match(/<tr><td>(.*?)<\/td><th[^>]*>\d+(.*?)<\/th><th/).slice(1);
assert.equal(runningRow(1)[0], ''); assert.doesNotMatch(runningRow(1)[1], /score-slash|score-dot/);
assert.match(runningRow(2)[0], />4<\/span>/); assert.match(runningRow(2)[1], /score-slash ink-red/);
assert.equal(runningRow(3)[0], ''); assert.doesNotMatch(runningRow(3)[1], /score-slash|score-dot/);
assert.match(runningRow(4)[0], />5<\/span>/); assert.match(runningRow(4)[1], /score-slash ink-red/);
assert.equal(runningRow(5)[0], ''); assert.equal(runningRow(6)[0], '');
assert.match(runningRow(7)[0], /three-point[^>]*>6<\/span>/); assert.match(runningRow(7)[1], /score-slash ink-red/);
assert.match(runningRow(8)[0], />8<\/span>/); assert.match(runningRow(8)[1], /score-dot ink-red/); assert.doesNotMatch(runningRow(8)[1], /score-slash/);

// A period change closes that period's final scoring event; game end upgrades the final event to double lines.
runningState.events.push(createPeriodChangeEvent(runningState, 'run-q1-end'));
runningHtml = runningScoreCells(derive(runningState));
assert.match(runningRow(8)[0], /score-close-period/); assert.match(runningHtml, /running-score team-a-score-number ink-red score-close score-close-period">8/);
runningState.endTime = '12:34';
runningHtml = runningScoreCells(derive(runningState));
assert.match(runningRow(8)[0], /score-close-game/); assert.match(runningHtml, /running-score team-a-score-number ink-red score-close score-close-game">8/);
assert.match(runningRow(9)[1], /unused-score-slash/);
console.log('JBA U12 running-score notation checks passed');


// Participation records use mini-basketball slash notation, including legacy booleans.
assert.equal(participationMark('in'), '／');
assert.equal(participationMark(true), '／');
assert.equal(participationMark('out'), '＼');
assert.equal(participationMark(null), '');
assert.doesNotMatch(['in', 'out', true].map(participationMark).join(''), /✓/);

// Entry and substitution slashes share the same quarter-color helper as scoring records.
assert.deepEqual([1,2,3,4].map(getQuarterRecordColor), ['red','black','red','black']);
assert.equal(getQuarterInk, getQuarterRecordColor);
assert.deepEqual([1,2,3,4].map(participationRecordClass), [
  'participation-mark ink-red',
  'participation-mark ink-black',
  'participation-mark ink-red',
  'participation-mark ink-black'
]);
assert.deepEqual(['in','out'].flatMap(value => [1,2,3,4].map(quarter => [
  participationMark(value), participationRecordClass(quarter)
])), [
  ['／','participation-mark ink-red'], ['／','participation-mark ink-black'],
  ['／','participation-mark ink-red'], ['／','participation-mark ink-black'],
  ['＼','participation-mark ink-red'], ['＼','participation-mark ink-black'],
  ['＼','participation-mark ink-red'], ['＼','participation-mark ink-black']
]);

// Explicit colgroups keep scorer fields wider than the two score-number fields.
assert.match(runningHtml, /<col class="scorer-col"><col class="score-col"><col class="score-col team-b-score-number"><col class="scorer-col">/);
assert.equal((runningHtml.match(/<table class="run-block">/g)||[]).length, 3);
assert.equal((runningHtml.match(/<th class="team-b-score-number">得点<\/th>/g)||[]).length, 3);
assert.equal((runningHtml.match(/<th class="running-score team-b-score-number/g)||[]).length, 120);
assert.equal((runningHtml.match(/<td>/g)||[]).length, 240);
assert.match(fs.readFileSync(require.resolve('../styles.css'), 'utf8'), /\.run-block \.team-b-score-number\{background:#eee;/);
console.log('Participation notation and running-score proportions checks passed');

// The official header shows four unlabeled regulation lines and preserves overtime data.
const summaryState = defaultState();
const summaryPlayer = summaryState.playersA[0];
['2PM','FTM','3PM','2PM','FTM'].forEach((action,index) => {
  summaryState.period = index + 1;
  summaryState.events.push(createEvent(summaryState, 'A', summaryPlayer.id, action, `summary-${index}`));
});
const summaryData = derive(summaryState);
assert.deepEqual(summaryData.quarterScores.A, [2,1,3,2,1]);
const summaryHtml = scoreQuarterStack(summaryData);
assert.equal((summaryHtml.match(/class="quarter-score-line"/g)||[]).length, 4);
assert.match(summaryHtml, /<strong>2<\/strong><i>－<\/i><strong>0<\/strong>/);
assert.match(summaryHtml, /<span>（延長）<\/span><div class="overtime-score"><strong>1/);
assert.doesNotMatch(summaryHtml, /第[1-4]Q|Quarter|Over time/);

// A quarter that has not started is blank around the dash; a completed 0-0 remains explicit.
const oneQuarterState = defaultState();
oneQuarterState.events.push(createPeriodChangeEvent(oneQuarterState, 'end-q1'));
oneQuarterState.period = 2;
const oneQuarterHtml = scoreQuarterStack(derive(oneQuarterState));
assert.equal(oneQuarterHtml, '<div class="quarter-score-line"><strong>0</strong><i>－</i><strong>0</strong></div><div class="quarter-score-line"><strong></strong><i>－</i><strong></strong></div><div class="quarter-score-line"><strong></strong><i>－</i><strong></strong></div><div class="quarter-score-line"><strong></strong><i>－</i><strong></strong></div><div class="overtime-line"><span>（延長）</span></div>');

// Zoom is isolated on the wrapper/page transform and never changes A4 dimensions.
const html = fs.readFileSync(require.resolve('../index.html'), 'utf8');
const css = fs.readFileSync(require.resolve('../styles.css'), 'utf8');
const js = fs.readFileSync(require.resolve('../app.js'), 'utf8');
assert.match(html, /id="sheetStage" class="paper-stage"><div id="sheetViewport" class="sheet-viewport zoom-fit"><div id="scoreSheet"/);
assert.match(css, /\.sheet-viewport>\.official-sheet\{width:210mm;height:297mm;margin:0;transform:scale\(var\(--sheet-scale\)\);transform-origin:top left\}/);
assert.match(css, /\.run-block col\.scorer-col\{width:38%\}/);
assert.match(css, /\.run-block col\.score-col\{width:12%\}/);
assert.match(css, /\.run-block \.scorer-mark\{[^}]*font-size:8px;[^}]*font-weight:900/);
assert.match(css, /JBA U12 official header: the sole normal-display definition set/);
assert.match(css, /\.official-sheet-header\{[\s\S]*?width:199mm;[\s\S]*?height:42mm;[\s\S]*?grid-template-columns:99mm minmax\(0,1fr\);[\s\S]*?overflow:hidden/);
assert.match(css, /\.header-right\{[^}]*grid-template-rows:14mm 28mm;[^}]*overflow:hidden/);
assert.match(css, /\.match-info\{[^}]*grid-template-rows:7mm 7mm/);
assert.match(css, /\.officials-grid\{[^}]*grid-template-columns:1fr 1fr;grid-template-rows:repeat\(3,1fr\);[^}]*overflow:hidden/);
assert.match(css, /writing-mode:horizontal-tb/);
assert.match(css, /\.officials-grid label\{[^}]*overflow:hidden;[^}]*white-space:nowrap/);
assert.match(css, /\.officials-grid label:last-child\{grid-template-columns:26mm minmax\(0,1fr\)\}/);
assert.match(css, /\.sheet-body\{height:221mm;margin-top:3mm;grid-template-columns:102mm 14mm 76mm/);
assert.match(js, /<section class="official-sheet-header"[^>]*><div class="header-left"><div class="competition-row">/);
assert.match(js, /<div class="header-right"><div class="match-info"><div class="date-time">/);
assert.match(js, /<div class="officials-grid">\$\{metaInput\('crewChief',[\s\S]*?shotClockOperator/);
assert.equal((css.match(/^\.official-sheet-header\{/gm)||[]).length, 1);
assert.equal((css.match(/^\.officials-grid\{/gm)||[]).length, 1);
assert.equal((css.match(/^\.official-score-box\{/gm)||[]).length, 1);
assert.doesNotMatch(css, /^\.(official-meta|officials|official-score)\{/m);
assert.match(js, /<span class="meta-label">\$\{label\}<\/span>/);
assert.match(js, /<div class="official-score-box" aria-label="スコア">/);
assert.match(js, /<div class="score-label-col"><b>スコア<\/b><span>Score<\/span><\/div>/);
assert.match(js, /<div class="team-total"><span>チームA<\/span><strong aria-label="チームA 合計得点">/);
assert.match(js, /<div class="score-quarter-stack" aria-label="クォーター別得点">\$\{scoreQuarterStack\(d\)\}/);
assert.match(js, /<div class="team-total"><span>チームB<\/span><strong aria-label="チームB 合計得点">/);
assert.match(css, /\.official-score-box\{height:32mm;display:grid;grid-template-columns:14mm minmax\(0,1fr\);overflow:hidden\}/);
assert.match(css, /\.score-quarter-stack\{width:28mm;display:grid;grid-template-rows:repeat\(4,5mm\) 6mm/);
assert.match(css, /\.quarter-score-line,\.overtime-score\{display:grid;grid-template-columns:1fr 5mm 1fr/);
assert.doesNotMatch(css, /\.quarter-score-(?:rows|row)\b/);
assert.doesNotMatch(js, /score-periods|score-period-cell|quarterSummaryCells/);
assert.doesNotMatch(css, /\.score-periods|\.score-period-cell/);
assert.match(js, /日付　　年　　月　　日/);
assert.match(js, /applySheetZoom\('fit'\)/);
assert.match(js, /applySheetZoom\('zoom'\)/);
console.log('Quarter-summary and fixed-page zoom checks passed');
