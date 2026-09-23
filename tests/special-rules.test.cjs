const test = require('node:test');
const assert = require('node:assert/strict');
const {createEngine} = require('../js/game-engine.js');
const base = () => Array.from({length:8},(_,r)=>Array.from({length:8},(_,c)=>(r+c)%5));
function sparse(cells, extras=[]) {
    const e=createEngine({seed:42});
    const b=Array.from({length:8},()=>Array(8).fill(null));
    cells.forEach(([r,c])=>b[r][c]=2);
    extras.forEach(([r,c,value])=>b[r][c]=value);
    e.setBoard(b); return e;
}
const keys = cells => cells.map(p=>p.r+','+p.c).sort();
const row = r => Array.from({length:8},(_,c)=>({r,c}));
const column = c => Array.from({length:8},(_,r)=>({r,c}));
const square = (r,c) => Array.from({length:3},(_,i)=>Array.from({length:3},(_,j)=>({r:r+i-1,c:c+j-1}))).flat()
    .filter(p=>p.r>=0&&p.r<8&&p.c>=0&&p.c<8);
const union = (...sets) => [...new Set(sets.flat().map(p=>p.r+','+p.c))].sort();

for(const [name,cells,center] of [
    ['T',[[2,2],[2,3],[2,4],[3,3],[4,3]],[2,3]],
    ['L',[[2,2],[3,2],[4,2],[4,3],[4,4]],[4,2]],
    ['cross',[[3,2],[3,3],[3,4],[2,3],[4,3]],[3,3]],
]) {
    for(let rotation=0;rotation<4;rotation++) {
        test(`${name} rotation ${rotation} creates one bomb at the intersection`,()=>{
            const turn=([r,c])=>{for(let i=0;i<rotation;i++)[r,c]=[c,7-r];return [r,c];};
            const shape=cells.map(turn),[r,c]=turn(center),e=sparse(shape);
            const w=e.matchWave([{r:shape[0][0],c:shape[0][1]}]);
            assert.deepEqual(w.generated,[{r,c,special:'bomb'}]);
            assert.deepEqual(e.board[r][c],{color:null,special:'bomb'});
            assert.equal(w.cells.length,4);assert.equal(w.effects.length,0);
        });
    }
}
test('vertical four generates a column clear; direction follows match, not swipe',()=>{
    const e=sparse([[1,3],[2,3],[4,3],[3,2]],[[3,3,1]]);
    const w=e.beginSwap(3,2,3,3);
    assert.deepEqual(w.generated,[{r:3,c:3,special:'column-clear'}]);
    assert.deepEqual(e.board[3][3],{color:2,special:'column-clear'});
});
test('horizontal four from a vertical swipe creates a row clear',()=>{
    const e=sparse([[3,1],[3,2],[3,4],[2,3]],[[3,3,1]]);
    const w=e.beginSwap(2,3,3,3);
    assert.deepEqual(w.generated,[{r:3,c:3,special:'row-clear'}]);
});
test('five-cell bent path without two intersecting triples does not earn a bomb',()=>{
    const e=sparse([[1,1],[1,2],[2,2],[2,3],[3,3]]);
    assert.equal(e.matchWave(),null);
});
test('five-in-a-row outranks a crossing match, producing only one cotton candy',()=>{
    const e=sparse([[3,1],[3,2],[3,3],[3,4],[3,5],[2,3],[4,3]]);
    const w=e.matchWave();assert.equal(w.generated.length,1);
    assert.equal(w.generated[0].special,'color-clear');assert.equal(w.cells.length,6);
});
test('intersecting fours produce one bomb, not two line clears',()=>{
    const e=sparse([[3,1],[3,2],[3,3],[3,4],[1,3],[2,3],[4,3]]);
    const w=e.matchWave();assert.deepEqual(w.generated,[{r:3,c:3,special:'bomb'}]);assert.equal(w.cells.length,6);
});
test('transitive overlapping lines form one reward component',()=>{
    const e=sparse([[1,1],[1,2],[1,3],[2,3],[3,3],[3,4],[3,5]]);
    assert.equal(e.matchWave().generated.length,1);
});
test('adjacent parallel fours are separate components and each earns a line clear',()=>{
    const e=sparse([[2,1],[2,2],[2,3],[2,4],[3,1],[3,2],[3,3],[3,4]]);
    const w=e.matchWave();assert.equal(w.generated.length,2);
    assert.ok(w.generated.every(p=>p.special==='row-clear'));
});
test('existing line clear at intersection activates once and new bomb uses a normal fallback',()=>{
    const e=sparse([[3,2],[3,3],[3,4],[2,3],[4,3]],[[3,3,{color:2,special:'row-clear'}]]);
    const w=e.matchWave([{r:3,c:4}]);
    assert.deepEqual(w.generated,[{r:3,c:4,special:'bomb'}]);
    assert.equal(w.effects.filter(e=>e.special==='row-clear').length,1);
    assert.ok(!keys(w.cells).includes('3,4'));
    assert.ok(w.effects.every(e=>!keys(e.cells).includes('3,4')));
});
test('a line composed entirely of existing specials does not overwrite any of them',()=>{
    const e=sparse([],Array.from({length:4},(_,c)=>[3,c,{color:1,special:'row-clear'}]));
    const w=e.matchWave();assert.equal(w.generated.length,0);assert.equal(w.effects.length,4);
});
test('bombs and cotton are colorless; only line specials participate in normal matches',()=>{
    for(const special of ['bomb','color-clear','row-clear','column-clear']) {
        const e=sparse([],Array.from({length:3},(_,c)=>[0,c,{color:2,special}]));
        assert.equal(e.findMatchGroups().length,special.includes('-clear')&&special!=='color-clear'?1:0);
        assert.equal(e.tileColor(0,0),special==='bomb'||special==='color-clear'?null:2);
    }
});
test('row clear activates at destination without clearing its ordinary swap partner outside the row',()=>{
    const e=createEngine();e.setBoard(base());e.board[3][3]=e.makeTile(0,'row-clear');
    const w=e.beginSwap(3,3,4,3);assert.deepEqual(keys(w.cells),keys(row(4)));
});
test('column clear activates at destination and reaches both board edges',()=>{
    const e=createEngine();e.setBoard(base());e.board[3][3]=e.makeTile(0,'column-clear');
    const w=e.beginSwap(3,3,3,4);assert.deepEqual(keys(w.cells),keys(column(4)));
});
for(const a of ['row-clear','column-clear','bomb']) for(const b of ['row-clear','column-clear','bomb']) {
    test(`${a} plus ${b} clears the exact union from their swapped positions`,()=>{
        const e=createEngine();e.setBoard(base());e.board[3][3]=e.makeTile(0,a);e.board[3][4]=e.makeTile(1,b);
        const footprint=(kind,r,c)=>kind==='row-clear'?row(r):kind==='column-clear'?column(c):square(r,c);
        const w=e.beginSwap(3,3,3,4);
        assert.deepEqual(keys(w.cells),union(footprint(a,3,4),footprint(b,3,3)));
        assert.equal(w.effects.length,2);
    });
}
test('line chains through another line and a bomb exactly once without stopping',()=>{
    const e=createEngine();e.setBoard(base());
    e.board[3][0]=e.makeTile(0,'row-clear');e.board[3][4]=e.makeTile(1,'column-clear');e.board[5][4]=e.makeTile(null,'bomb');
    const w=e.beginSwap(3,0,3,1);
    assert.deepEqual(keys(w.cells),union(row(3),column(4),square(5,4)));
    assert.equal(w.effects.length,3);assert.ok(keys(w.cells).includes('3,7'));
});
test('cotton plus line clears its food type and triggers every existing matching line',()=>{
    const e=createEngine();e.setBoard(base());
    e.board[0][0]=e.makeTile(null,'color-clear');e.board[0][1]=e.makeTile(2,'row-clear');
    e.board[4][4]=e.makeTile(2,'column-clear');
    const w=e.beginSwap(0,0,0,1);
    const food=[];e.board.forEach((r,ri)=>r.forEach((t,ci)=>{if(t.color===2)food.push({r:ri,c:ci});}));
    assert.deepEqual(keys(w.cells),union(food,row(0),column(4),[{r:0,c:1}]));
    assert.equal(w.effects.length,3);assert.equal(w.generated.length,0);
});
test('cotton majority excludes enhanced food; selected type still clears enhanced food',()=>{
    const e=sparse([],[[0,0,{color:null,special:'color-clear'}],[0,1,{color:null,special:'bomb'}],
        [2,2,1],[2,3,1],[5,5,2],[6,0,{color:2,special:'row-clear'}],[6,1,{color:2,special:'row-clear'}],
        [6,2,{color:2,special:'row-clear'}],[7,7,{color:1,special:'column-clear'}]]);
    const w=e.beginSwap(0,0,0,1);
    assert.ok(keys(w.cells).includes('2,2'));assert.ok(keys(w.cells).includes('2,3'));
    assert.ok(w.effects.some(p=>p.r===7&&p.c===7));assert.ok(!keys(w.cells).includes('5,5'));
});
test('forced shuffle preserves line directions, food colors and colorless specials',()=>{
    const e=createEngine({seed:1});e.setBoard(base());
    ['row-clear','column-clear','bomb','color-clear'].forEach((s,i)=>e.board[i][i]=e.makeTile(i,s));
    const original=e.board.flat().filter(t=>t.special);
    assert.equal(e.shuffle(0).rebuilt,true);assert.ok(original.every(t=>e.board.flat().includes(t)));
    assert.equal(e.findMatchGroups().length,0);assert.ok(e.findLegalMove());
});
