// Test-Hilfsmodul (kein eigenständiger Test): lädt das echte app.js in einem
// vm-Kontext mit DOM-/Storage-/fetch-Stubs. Kein Netzwerk, kein Browser —
// Cloud-Zugriffe laufen ausschließlich gegen das injizierte fetch-Mock.
// Spätere run()-Aufrufe teilen sich die globale lexikalische Umgebung des
// Kontexts und sehen daher auch let/const-Variablen des App-Moduls
// (state, _virgin, sleepFilter, …).
import fs from 'node:fs';
import vm from 'node:vm';

function makeClassList(){
  const set = new Set();
  return {
    add: (...c) => c.forEach(x => set.add(x)),
    remove: (...c) => c.forEach(x => set.delete(x)),
    contains: c => set.has(c),
    toggle: (c, force) => {
      const on = force === undefined ? !set.has(c) : !!force;
      if(on) set.add(c); else set.delete(c);
      return on;
    }
  };
}

function makeElement(){
  return {
    innerHTML:'', textContent:'', value:'', title:'', hidden:false, type:'', tagName:'DIV',
    classList: makeClassList(), style:{}, dataset:{}, onclick:null,
    setAttribute(){}, getAttribute(){ return null; }, focus(){}, click(){}, addEventListener(){},
    closest(){ return null; }, querySelector(){ return null; }, querySelectorAll(){ return []; },
    getBoundingClientRect(){ return {width:0, height:0, left:0, top:0}; },
    appendChild(){},
  };
}

export function loadApp({localStorageData = {}, fetchImpl} = {}){
  const elements = new Map();
  const store = new Map(Object.entries(localStorageData));
  const listeners = {window:{}, document:{}};
  const location = {protocol:'file:', href:'file:///index.html'};
  const sandbox = {
    console, Math, Date, JSON, Intl, URL, Promise, Error, TypeError, RangeError,
    isFinite, parseFloat, parseInt, encodeURIComponent, decodeURIComponent,
    MAP_IMG:'',
    location,
    navigator:{},
    confirm: () => true,
    alert: () => {},
    setTimeout: () => 0, clearTimeout: () => {},
    setInterval: () => 0, clearInterval: () => {},
    fetch: fetchImpl || (async () => { throw new Error('offline (Testbed-Standard: kein Netz)'); }),
    localStorage:{
      getItem: k => store.has(k) ? store.get(k) : null,
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k),
    },
    sessionStorage:{ getItem: () => null, setItem(){}, removeItem(){} },
    document:{
      getElementById(id){ if(!elements.has(id)) elements.set(id, makeElement()); return elements.get(id); },
      querySelector(){ return null; },
      querySelectorAll(){ return []; },
      createElement(){ return makeElement(); },
      addEventListener(name, fn){ listeners.document[name] = fn; },
      documentElement:{ clientWidth:375 },
      hidden:false,
    },
  };
  sandbox.window = {
    addEventListener(name, fn){ listeners.window[name] = fn; },
    scrollTo(){}, innerWidth:375, location,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  const zfeSource = fs.readFileSync(new URL('../zfe-data.js', import.meta.url), 'utf8');
  vm.runInContext(zfeSource, sandbox, {filename:'zfe-data.js'});
  const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  vm.runInContext(source, sandbox, {filename:'app.js'});
  return {
    sandbox, elements, store, listeners,
    // Testcode im App-Kontext ausführen (sieht auch let/const des Moduls).
    run: code => vm.runInContext(code, sandbox),
  };
}
