import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../weighted-expenses.js', import.meta.url), 'utf8');

function load(state){
  const context = {
    state,
    window: {},
    document: {
      createElement(){ return {textContent:''}; },
      head:{appendChild(){}},
      getElementById(){ return null; },
      querySelector(){ return null; },
      querySelectorAll(){ return []; },
    },
    setTimeout(){},
    console,
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context);
  return context;
}

const crew = ['a','b','c','d','e','f'].map(id=>({id,name:id.toUpperCase(),color:'#000'}));

test('historic expenses remain equal and unmodified', ()=>{
  const expense={id:'old',amount:120,payer:'a',sharers:['a','b','c']};
  const state={crew,budget:{expenses:[expense]}};
  const before=JSON.stringify(state);
  const app=load(state);
  assert.deepEqual({...app.expenseShares(expense)},{a:40,b:40,c:40});
  const calc=app.budgetCalc();
  assert.equal(calc.bal.a,80);
  assert.equal(calc.bal.b,-40);
  assert.equal(calc.bal.c,-40);
  assert.equal(JSON.stringify(state),before);
  assert.equal('weights' in expense,false);
});

test('weighted split is proportional and cent-exact', ()=>{
  const expense={id:'weighted',amount:200,payer:'a',sharers:['a','b','c','d','e','f'],weights:{d:2,a:1,b:1,c:1,e:1,f:1}};
  const state={crew,budget:{expenses:[expense]}};
  const app=load(state);
  const shares={...app.expenseShares(expense)};
  assert.equal(Object.values(shares).reduce((a,b)=>a+b,0),200);
  assert.equal(shares.d,57.15);
  assert.equal(shares.a,28.57);
  assert.equal(shares.b,28.57);
  assert.equal(shares.c,28.57);
  assert.equal(shares.e,28.57);
  assert.equal(shares.f,28.57);
});

test('equal split resolves unavoidable rounding cents exactly', ()=>{
  const expense={amount:100,payer:'a',sharers:['a','b','c']};
  const app=load({crew,budget:{expenses:[expense]}});
  const shares={...app.expenseShares(expense)};
  assert.deepEqual(shares,{a:33.34,b:33.33,c:33.33});
  assert.equal(Object.values(shares).reduce((a,b)=>a+b,0),100);
});

test('detail view is available without modifying stored expense data', ()=>{
  const expense={id:'detail',date:'2026-07-31T10:00:00.000Z',desc:'Fuel',amount:50,payer:'a',sharers:['a','b']};
  const state={crew,budget:{expenses:[expense]}};
  const before=JSON.stringify(state);
  const app=load(state);
  assert.equal(typeof app.openExpenseDetails,'function');
  assert.equal(JSON.stringify(state),before);
});
