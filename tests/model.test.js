const assert = require('node:assert/strict');
const { defaultState, createEvent, derive } = require('../app.js');
const state = defaultState();
const home = state.playersA[1]; // #5
const away = state.playersB[3]; // #7
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
data = derive(state); assert.deepEqual(data.quarterScores.A, [2,1,0,0]); assert.equal(data.scores.A, 3);
console.log('8 synchronized scorebook model checks passed');
