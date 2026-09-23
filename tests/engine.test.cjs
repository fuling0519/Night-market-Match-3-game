const test = require('node:test');
const assert = require('node:assert/strict');
const { createEngine } = require('../js/game-engine.js');
const { createProgressStore } = require('../js/progress-store.js');
const base = (n=8) => Array.from({length:n}, (_,r) => Array.from({length:n}, (_,c) => (r+c)%5));
function fixture(edit = () => {}) { const e=createEngine({seed:42}); const b=base(); edit(b); e.setBoard(b); return e; }
const has = (wave,r,c) => wave.cells.some(p=>p.r===r&&p.c===c);

test('seeded opening and subsequent refills are reproducible and normalized', () => {
    const a=createEngine({seed:123}), b=createEngine({seed:123});
    a.initBoard(); b.initBoard();
    for(let i=0;i<30;i++) {
        assert.deepEqual(a.board,b.board);
        assert.equal(a.findMatchGroups().length,0);
        const move=a.findLegalMove(); assert.ok(move);
        const args=Object.values(move);
        let wa=a.beginSwap(...args), wb=b.beginSwap(...args), waves=0;
        while(wa) { assert.deepEqual(wa,wb); a.clearAndRefill(wa); b.clearAndRefill(wb); wa=a.matchWave(); wb=b.matchWave(); assert.ok(++waves<100); }
        a.ensurePlayable(); b.ensurePlayable();
    }
    assert.ok(a.board.flat().every(t=>typeof t==='object'&&'color' in t&&'special' in t));
});
test('invalid swaps leave state and RNG untouched',()=>{
    const e=fixture(); const before=JSON.stringify(e.board), rng=e.rngState;
    assert.equal(e.beginSwap(0,0,0,1),null);
    assert.equal(e.beginSwap(0,0,3,3),null);
    assert.equal(e.beginSwap(-1,0,0,0),null);
    assert.equal(JSON.stringify(e.board),before); assert.equal(e.rngState,rng);
});
test('three-match via swap clears exactly the matched cells',()=>{
    const e=fixture(b=>{ b[0][0]=0;b[0][1]=1;b[0][2]=0;b[1][1]=0; });
    const w=e.beginSwap(1,1,0,1);
    assert.equal(w.cells.length,3); assert.equal(w.generated.length,0);
    assert.ok([0,1,2].every(c=>has(w,0,c)));
});
for (const [length,special] of [[4,'bomb'],[5,'color-clear'],[6,'color-clear']]) {
    test(`${length}-match creates ${special} at preferred cell`,()=>{
        const e=fixture(b=>{ for(let c=0;c<length;c++) b[3][c]=0; });
        const w=e.matchWave([{r:3,c:1}]);
        assert.equal(e.tileSpecial(3,1),special); assert.ok(!has(w,3,1));
        assert.equal(w.generated.length,1);
        assert.equal(e.tileColor(3,1),special==='bomb'?0:null);
    });
}
test('T intersection clears once and does not create an unsupported special',()=>{
    const e=fixture(b=>{b[3][2]=b[3][3]=b[3][4]=b[2][3]=b[4][3]=0;});
    const w=e.matchWave(); assert.equal(w.cells.length,5);assert.equal(w.generated.length,0);
});
test('new special survives an existing bomb in the same wave',()=>{
    const e=fixture(b=>{b[3][0]=0;b[3][1]={color:0,special:'bomb'};b[3][2]=0;b[3][3]=0;});
    const w=e.matchWave([{r:3,c:2}]);
    assert.equal(e.tileSpecial(3,2),'bomb'); assert.ok(!has(w,3,2));
    e.clearAndRefill(w);assert.ok(e.board.flat().some(t=>t.special==='bomb'));
});
test('bomb detonates at its destination, including at edges',()=>{
    const e=fixture(b=>{b[0][1]={color:2,special:'bomb'};});
    const w=e.beginSwap(0,1,0,0);assert.equal(w.cells.length,4); assert.ok(has(w,1,1));assert.ok(!has(w,0,2));
});
test('double bombs propagate through a third bomb without duplicate cells',()=>{
    const e=fixture(b=>{b[3][3]={color:0,special:'bomb'};b[3][4]={color:1,special:'bomb'};b[3][5]={color:2,special:'bomb'};});
    const w=e.beginSwap(3,3,3,4);
    assert.ok(has(w,3,6)); assert.equal(new Set(w.cells.map(p=>`${p.r},${p.c}`)).size,w.cells.length);
});
test('cotton candies never participate in ordinary matches',()=>{
    const e=fixture(b=>{for(let c=0;c<3;c++) b[0][c]={color:2,special:'color-clear'};});
    assert.equal(e.findMatchGroups().length,0);assert.equal(e.tileColor(0,0),null);
});
test('cotton swap clears the selected type',()=>{
    const e=fixture(b=>{b[0][0]={color:null,special:'color-clear'};});
    const count=e.board.flat().filter(t=>t.color===1).length;
    const w=e.beginSwap(0,0,0,1);assert.equal(w.cells.length,count+1);
    assert.ok(w.cells.every(({r,c})=>e.tileColor(r,c)===1||e.tileSpecial(r,c)==='color-clear'));
});
test('double cotton clears all 64 cells',()=>{
    const e=fixture(b=>{b[0][0]=b[0][1]={color:null,special:'color-clear'};});
    assert.equal(e.beginSwap(0,0,0,1).cells.length,64);
});
test('cotton plus bomb uses the bomb color and explodes',()=>{
    const e=fixture(b=>{b[0][0]={color:null,special:'color-clear'};b[0][1]={color:4,special:'bomb'};});
    const w=e.beginSwap(0,0,0,1); assert.ok(has(w,1,0));assert.ok(has(w,1,1));
    e.board.forEach((row,r)=>row.forEach((t,c)=>{if(t.color===4) assert.ok(has(w,r,c));}));
});
test('collateral cotton chooses most common ordinary food, ties use lowest type',()=>{
    const e=fixture(b=>{b[0][0]={color:3,special:'bomb'};b[0][1]={color:null,special:'color-clear'};});
    const counts=Array(5).fill(0);e.board.flat().forEach(t=>{if(!t.special)counts[t.color]++;});
    const target=counts.indexOf(Math.max(...counts));
    const keys=e.expandSpecialEffects(new Set(['0,0']),{});
    e.board.forEach((row,r)=>row.forEach((t,c)=>{if(t.color===target)assert.ok(keys.has(`${r},${c}`));}));
    const tied=createEngine({size:3,typeCount:3});
    tied.setBoard([[{color:null,special:'color-clear'},0,1],[0,1,2],[2,null,null]]);
    assert.deepEqual([...tied.expandSpecialEffects(new Set(['0,0']),{})].sort(),['0,0','0,1','1,0']);
});
test('gravity preserves ordering and predefined refill sequence',()=>{
    const e=fixture();const old=e.board.map(row=>row[0]);e.setRefill([4,3]);
    const drop=e.clearAndRefill({cells:[{r:5,c:0},{r:7,c:0}]});
    assert.equal(e.tileColor(0,0),4);assert.equal(e.tileColor(1,0),3);
    assert.deepEqual(e.board.slice(2).map(row=>row[0]),old.filter((_,r)=>r!==5&&r!==7));
    assert.equal(drop.newCountByCol[0],2);assert.equal(drop.fallMap['6,0'],2);
});
test('dead board recovers and forced fallback keeps specials',()=>{
    const e=fixture();assert.equal(e.findLegalMove(),null);
    assert.equal(e.ensurePlayable().shuffled,true);assert.ok(e.findLegalMove());assert.equal(e.findMatchGroups().length,0);
    const f=fixture(b=>{b[3][3]={color:2,special:'bomb'};b[5][5]={color:null,special:'color-clear'};});
    const specials=f.board.flat().filter(t=>t.special);
    assert.equal(f.shuffle(0).rebuilt,true);assert.equal(f.findMatchGroups().length,0);assert.ok(f.findLegalMove());
    assert.ok(specials.every(t=>f.board.flat().includes(t)));
});
test('opening invariants for 500 seeds',()=>{
    for(let seed=0;seed<500;seed++){const e=createEngine({seed});e.initBoard();assert.equal(e.findMatchGroups().length,0);assert.ok(e.findLegalMove());}
});
test('one move settlement and final-move victory take precedence',()=>{
    const e=createEngine();assert.deepEqual(e.finishMove(400,1,400),{movesLeft:0,result:'won'});
    assert.deepEqual(e.finishMove(399,1,400),{movesLeft:0,result:'lost'});
    assert.deepEqual(e.finishMove(30,20,400),{movesLeft:19,result:null});
});
test('progress retains legacy unlocks, versions new saves and never regresses',()=>{
    const data=new Map([['nightmarket-cleared-levels','4']]);const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
    const store=createProgressStore(()=>storage);assert.equal(store.read(),4);store.write(2);
    assert.deepEqual(JSON.parse(data.get('nightmarket-progress')),{version:1,clearedLevels:4});
    store.write(5);assert.equal(createProgressStore(()=>storage).read(),5);
});
test('corrupt or unavailable storage cannot interrupt gameplay progress',()=>{
    const storage={getItem:k=>k==='nightmarket-progress'?'{broken':'nonsense',setItem(){throw Error('quota');}};
    const a=createProgressStore(()=>storage);assert.equal(a.read(),0);assert.equal(a.write(3),3);assert.equal(a.read(),3);assert.ok(a.unavailable);
    const b=createProgressStore(()=>{throw Error('denied');});assert.equal(b.read(),0);assert.equal(b.write(1),1);
});
