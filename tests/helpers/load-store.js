// Loads app/js/store.js in Node with tiny browser stand-ins; returns {Store, Scenes, Present}
const fs = require('fs'), vm = require('vm');
module.exports = function(){
  const ls = {};
  const ctx = {console, Math, Date, JSON, setTimeout, clearTimeout, Promise, Object, Array, String, Number, isFinite, RegExp, Error,
    location: {protocol: 'file:'}, localStorage: {getItem: k => ls[k] || null, setItem: (k, v) => { ls[k] = v; }},
    document: {addEventListener(){}, hidden: false}, addEventListener(){}, BroadcastChannel: undefined, fetch: () => Promise.reject()};
  ctx.window = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(require('path').join(__dirname, '..', '..', 'app', 'js', 'store.js'), 'utf8'), ctx);
  return {Store: ctx.KCStore, Scenes: ctx.KCScenes, Present: ctx.KCPresent};
};
