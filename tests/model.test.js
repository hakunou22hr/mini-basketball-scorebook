const assert = require('node:assert/strict');
const { defaultState, createEvent, derive } = require('../app.js');
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
console.log('18 synchronized JBA U12 scorebook model checks passed');
