const assert = require('node:assert/strict');
const { defaultState, createEvent, derive, runningScoreCells, getQuarterInk, periodLabel } = require('../app.js');
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
assert.match(runningScore, /<th>A<\/th><th>得点<\/th><th>得点<\/th><th>B<\/th>/);
assert.match(runningScore, /scorer-mark ink-red[^>]*>7<\/span>/);
assert.match(runningScore, /score-slash ink-red/);
assert.match(runningScore, /scorer-mark ink-black[^>]*>7<\/span>/);
assert.match(runningScore, /score-slash ink-black/);
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
assert.deepEqual([1,2,3,4,5,6].map(getQuarterInk), ['red','black','red','black','red','black']);
assert.deepEqual([1,2,3,4,5,6].map(periodLabel), ['1Q','2Q','3Q','4Q','OT','OT2']);
state.period = 5;
const secondOvertime = createPeriodChangeEvent(state, 'period-ot-ot2');
assert.equal(secondOvertime.toPeriod, 6); assert.equal(secondOvertime.toSeconds, 180);
state.period = 3;
const q3Foul = createEvent(state, 'A', home.id, 'PF', 'q3-foul'); state.events.push(q3Foul);
assert.deepEqual(derive(state).stats.A[home.id].personalFouls.slice(-1), [3]);
console.log('Quarter ink and multiple-overtime checks passed');
