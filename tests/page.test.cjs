// Run the real page script with a minimal DOM and a controllable clock.
// This checks orchestration, not browser layout or native pointer behavior.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');

function harness(url='file:///E:/game/index.html', legacy='0', options={}) {
    class Element {
        constructor(tag='div') {
            this.tagName=tag;this.children=[];this.dataset={};this.events={};this.style={setProperty(){},removeProperty(){}};
            this.classes=new Set();this.classList={add:(...names)=>names.forEach(n=>this.classes.add(n)),remove:(...names)=>names.forEach(n=>this.classes.delete(n)),contains:n=>this.classes.has(n)};
            this.clientHeight=500;this.offsetWidth=500;this.src='';this.paused=true;this.muted=false;this.textContent='';
        }
        set className(v){this.classes=new Set(v.split(/\s+/).filter(Boolean));}
        get className(){return [...this.classes].join(' ');}
        set innerHTML(v){this.children=[];this.html=v;}
        get innerHTML(){return this.html||'';}
        addEventListener(k,fn){(this.events[k] ||= []).push(fn);}
        appendChild(el){this.children.push(el);el.parent=this;return el;}
        remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);}
        setAttribute(k,v){this[k]=v;}
        getBoundingClientRect(){return {left:Number(this.dataset.col||0)*60,top:Number(this.dataset.row||0)*60,width:60,height:60};}
        querySelector(selector){const m=selector.match(/data-row="(\d+)".*data-col="(\d+)"/);return m?this.children.find(el=>Number(el.dataset.row)===Number(m[1])&&Number(el.dataset.col)===Number(m[2])):null;}
        setPointerCapture(id){this.pointer=id;}
        hasPointerCapture(id){return this.pointer===id;}
        releasePointerCapture(){this.pointer=null;}
        play(){this.paused=false;return Promise.resolve();}
        pause(){this.paused=true;}
    }
    const elements=new Map();for(const m of html.matchAll(/id="([^"]+)"/g))elements.set(m[1],new Element());
    const screens=['home-screen','level-screen','game-screen'].map(id=>{const el=elements.get(id);el.id=id;el.classList.add('screen');return el;});
    screens[0].classList.add('active');
    const document={getElementById:id=>elements.get(id),createElement:tag=>new Element(tag),
        querySelectorAll:s=>s==='.screen'?screens:[],querySelector:s=>s==='.screen.active'?screens.find(el=>el.classList.contains('active')):null};
    let time=0,id=0;const timers=new Map();
    const storage=new Map([['nightmarket-cleared-levels',legacy],['nightmarket-motion',options.motion || 'system']]);
    const media={matches:!!options.systemReduce,addEventListener:(_,fn)=>media.change=fn};
    const context=vm.createContext({document,URL,URLSearchParams,console,Image:class{},
        localStorage:{getItem:k=>{if(options.storageBlocked)throw Error("blocked");return storage.get(k)??null;},setItem:(k,v)=>{if(options.storageBlocked)throw Error("blocked");storage.set(k,v);}},
        setTimeout:(fn,delay)=>{timers.set(++id,{fn,at:time+delay});return id;},clearTimeout:id=>timers.delete(id),
        window:{matchMedia:()=>media,location:{href:url,search:new URL(url).search},addEventListener(){},removeEventListener(){}}});
    for(const m of html.matchAll(/<script(?: src="([^"]+)")?>([\s\S]*?)<\/script>/g)){
        vm.runInContext(m[1]?fs.readFileSync(path.join(__dirname,'..',m[1]),'utf8'):m[2],context,{filename:m[1]||'index.html'});
    }
    const run=code=>vm.runInContext(code,context);
    async function advance(ms) {
        const end=time+ms;
        for(;;){await Promise.resolve();await Promise.resolve();const next=[...timers].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;timers.delete(next[0]);time=next[1].at;next[1].fn();}
        time=end;await Promise.resolve();await Promise.resolve();
    }
    async function drain(){for(let i=0;i<200&&timers.size;i++)await advance(Math.max(1,Math.min(...[...timers.values()].map(t=>t.at))-time));assert.equal(timers.size,0);}
    async function start(level=1){run(`beginLevel(${level})`);await drain();assert.equal(run('isBusy'),false);}
    const fixture=`engine.setBoard(Array.from({length:8},(_,r)=>Array.from({length:8},(_,c)=>(r+c)%5))); engine.board[0][0]=engine.makeTile(0);engine.board[0][1]=engine.makeTile(1);engine.board[0][2]=engine.makeTile(0);engine.board[1][1]=engine.makeTile(0);board=engine.board;renderBoard();`;
    return {run,advance,drain,start,elements,fixture,storage,media};
}

test('classic script page bootstraps for file and HTTP URLs',async()=>{
    for(const url of ['file:///E:/game/index.html','http://localhost:8000/index.html?startGame=true']){
        const h=harness(url);if(!url.includes('?'))await h.start();else await h.drain();
        assert.equal(h.elements.get('board').children.length,64);assert.equal(h.run('movesLeft'),20);assert.equal(h.run('isBusy'),false);
    }
});
test('invalid UI swap returns, consumes no step and unlocks input',async()=>{
    const h=harness();await h.start();h.run('engine.setBoard(Array.from({length:8},(_,r)=>Array.from({length:8},(_,c)=>(r+c)%5)));board=engine.board;renderBoard();');
    const before=h.run('JSON.stringify(board)');h.run('swapTilesAndCheck(0,0,0,1)');await h.drain();
    assert.equal(h.run('movesLeft'),20);assert.equal(h.run('score'),0);assert.equal(h.run('isBusy'),false);assert.equal(h.run('JSON.stringify(board)'),before);
});
test('valid UI exchange resolves cascades and consumes exactly one step',async()=>{
    const h=harness();await h.start();h.run(h.fixture);h.run('swapTilesAndCheck(1,1,0,1)');await h.drain();
    assert.equal(h.run('movesLeft'),19);assert.ok(h.run('score')>=30);assert.equal(h.run('isBusy'),false);assert.equal(h.run('engine.findMatchGroups().length'),0);
});
test('drop animation state is removed before the next player move',async()=>{
    const h=harness();await h.start();h.run(h.fixture);
    h.run('engine.setRefill([2,3,4]);swapTilesAndCheck(1,1,0,1)');
    await h.advance(590);
    assert.ok(h.elements.get('board').children.some(el=>el.classList.contains('tile-drop-new')));
    await h.drain();
    assert.equal(h.run('isBusy'),false);
    assert.ok(h.elements.get('board').children.every(el=>
        !el.classList.contains('tile-drop')&&!el.classList.contains('tile-drop-new')));
});
for (const dropClass of ['tile-drop','tile-drop-new']) {
    test(`swap clears residual ${dropClass} on just one participant`,async()=>{
        const h=harness();await h.start();
        h.run('engine.setBoard(Array.from({length:8},(_,r)=>Array.from({length:8},(_,c)=>(r+c)%5)));board=engine.board;renderBoard();');
        const first=h.elements.get('board').children[0],second=h.elements.get('board').children[1];
        first.classList.add(dropClass);
        h.run('swapTilesAndCheck(0,0,0,1)');
        assert.ok(!first.classList.contains(dropClass));
        assert.ok(first.classList.contains('swapping')&&second.classList.contains('swapping'));
        await h.advance(210);
        assert.ok(first.classList.contains('swap-back')&&second.classList.contains('swap-back'));
        await h.drain();
        assert.equal(h.run('movesLeft'),20);assert.equal(h.run('isBusy'),false);
    });
}
for(const delay of [0,210,600]){
    test(`abandon during swap/clear/drop at ${delay}ms cannot mutate new game`,async()=>{
        const h=harness();await h.start();h.run(h.fixture);h.run('swapTilesAndCheck(1,1,0,1)');await h.advance(delay);
        h.run('goHome();beginLevel(1)');const before=h.run('JSON.stringify(board)');await h.drain();
        assert.equal(h.run('JSON.stringify(board)'),before);assert.equal(h.run('score'),0);assert.equal(h.run('movesLeft'),20);assert.equal(h.run('isBusy'),false);assert.equal(h.run('levelOver'),false);
        assert.equal(h.elements.get('result-overlay').classList.contains('show'),false);
    });
}
test('rapid level switching and entry cancellation retain latest level',async()=>{
    const h=harness(undefined,'5');h.run('beginLevel(1);beginLevel(2);goHome();beginLevel(5)');await h.drain();
    assert.equal(h.run('currentLevelId'),5);assert.equal(h.run('movesLeft'),12);assert.equal(h.run('isBusy'),false);
    assert.ok(h.elements.get('bgm-player').src.endsWith('grim_pursuit.mp3'));
});
test('pointer cancellation, non-primary input and duplicate swaps are ignored',async()=>{
    const h=harness();await h.start();h.run(h.fixture);
    h.run(`var tile=boardElement.children[9];var ev={currentTarget:tile,pointerId:1,isPrimary:true,button:0,clientX:60,clientY:60};onPointerDown(ev);onPointerDown({...ev,pointerId:2,isPrimary:false});`);
    assert.equal(h.run('activePointerId'),1);
    h.run('onPointerCancel(ev);onPointerUp({...ev,clientY:0})');assert.equal(h.run('isBusy'),false);assert.equal(h.run('movesLeft'),20);
    h.run('onPointerDown(ev);onPointerUp({...ev,clientY:0});swapTilesAndCheck(1,1,0,1)');await h.drain();
    assert.equal(h.run('movesLeft'),19);assert.equal(h.run('activePointerId'),null);
});
test('last-step win updates old and new progress and enables next level',async()=>{
    const h=harness();await h.start();h.run(h.fixture);h.run('movesLeft=1;score=399;swapTilesAndCheck(1,1,0,1)');await h.drain();
    assert.equal(h.run('movesLeft'),0);assert.equal(h.run('levelOver'),true);assert.equal(h.run('getClearedCount()'),1);
    assert.equal(h.elements.get('result-title').textContent,'通關成功！');assert.equal(h.elements.get('btn-next-level').style.display,'block');
    assert.equal(JSON.parse(h.storage.get('nightmarket-progress')).version,1);
});
test('dead board after refill is shuffled without extra score or move cost',async()=>{
    const h=harness();await h.start();h.run(h.fixture);
    // Controlled refill produces a known dead board after the first real clear.
    h.run(`var realRefill=engine.clearAndRefill;engine.clearAndRefill=function(wave){const drop=realRefill(wave);engine.setBoard(Array.from({length:8},(_,r)=>Array.from({length:8},(_,c)=>(r+c)%5)));return drop;};swapTilesAndCheck(1,1,0,1);`);
    await h.drain();assert.equal(h.run('score'),30);assert.equal(h.run('movesLeft'),19);
    assert.ok(h.run('engine.findLegalMove()'));assert.equal(h.run('engine.findMatchGroups().length'),0);
    assert.ok(h.elements.get('board-status').textContent.includes('已重新洗牌'));
});
test('all levels retain their configured goals, moves and assets',async()=>{
    const h=harness(undefined,'5');
    for(let level=1;level<=5;level++){await h.start(level);assert.equal(h.run('currentLevelId'),level);assert.equal(h.run('movesLeft'),[20,18,16,14,12][level-1]);}
    const assets=h.run('LEVELS.flatMap(lv=>[lv.bg,lv.bgm]).concat(CANDY_TYPES.map(t=>t.img),[ITEM_SPRITE_URL])');
    for(const asset of assets)assert.ok(fs.existsSync(path.join(__dirname,'..',asset)),asset);
});

test('P2 preview equals actual special wave without consuming board, RNG or refill', () => {
    const {createEngine}=require('../js/game-engine.js');
    for (const pair of [['bomb',null],['bomb','bomb'],['color-clear',null],['color-clear','bomb'],['color-clear','color-clear']]) {
        const e=createEngine({seed:75}); e.initBoard();
        e.board[0][0]=e.makeTile(1,pair[0]);e.board[0][1]=e.makeTile(2,pair[1]);
        e.board[1][1]=e.makeTile(3,'bomb');e.board[2][1]=e.makeTile(null,'color-clear');
        e.setRefill([0,1,2,3,4]);
        const control=createEngine({seed:e.rngState});control.setBoard(e.board);control.setRefill([0,1,2,3,4]);
        const before=JSON.stringify(e.board),rng=e.rngState;
        const preview=e.previewSwap(0,0,0,1);
        assert.equal(JSON.stringify(e.board),before);assert.equal(e.rngState,rng);
        assert.deepEqual(e.previewSwap(0,0,0,1),preview);
        const actual=e.beginSwap(0,0,0,1);assert.deepEqual(actual,preview);
        const cleared=new Set(actual.cells.map(p=>p.r+','+p.c));
        assert.equal(new Set(actual.effects.map(p=>p.r+','+p.c)).size,actual.effects.length);
        for(const effect of actual.effects)for(const p of effect.cells)assert.ok(cleared.has(p.r+','+p.c));
        e.clearAndRefill(actual);control.clearAndRefill(control.beginSwap(0,0,0,1));assert.deepEqual(e.board,control.board);assert.equal(e.rngState,control.rngState);
    }
});
test('P2 tiles preserve bomb food and give cotton its own silhouette',async()=>{
    const h=harness();await h.start();h.run('engine.board[0][0]=engine.makeTile(2,"bomb");engine.board[0][1]=engine.makeTile(null,"color-clear");renderBoard()');
    const [bomb,cotton]=h.elements.get('board').children;
    assert.equal(bomb.children.length,4);assert.ok(bomb.children[1].src.endsWith('item-tofu.webp'));
    assert.ok(bomb.title.includes('臭豆腐'));assert.ok(cotton.children[1].src.endsWith('item-marshmallow.webp'));
});
test('P2 drag previews both special-source and special-destination swaps, then clears on cancel',async()=>{
    const h=harness();await h.start();h.run('engine.board[0][1]=engine.makeTile(2,"bomb");renderBoard();');
    const before=h.run('JSON.stringify(engine.board)');
    h.run('var ev={currentTarget:boardElement.children[0],pointerId:8,isPrimary:true,button:0,clientX:0,clientY:0};onPointerDown(ev);onPointerMove({...ev,clientX:40})');
    const layer=h.elements.get('special-fx-layer');assert.ok(layer.children.length>0);
    const targets=layer.children.filter(x=>x.className==='effect-cell target').map(x=>x.dataset.row+','+x.dataset.col).sort();
    assert.deepEqual(targets,JSON.parse(h.run('JSON.stringify(engine.previewSwap(0,0,0,1).cells.map(p=>p.r+","+p.c).sort())')));
    assert.equal(h.run('JSON.stringify(engine.board)'),before);assert.equal(h.run('movesLeft'),20);
    h.run('onPointerMove({...ev,clientX:-40})');assert.equal(layer.children.length,0);
    h.run('onPointerMove({...ev,clientX:40});onPointerCancel(ev)');assert.equal(layer.children.length,0);
});
test('P2 all-board effects and decorative particles are bounded and cleared before next move',async()=>{
    const h=harness();await h.start();h.run('engine.board[0][0]=engine.makeTile(null,"color-clear");engine.board[0][1]=engine.makeTile(null,"color-clear");renderBoard();swapTilesAndCheck(0,0,0,1)');
    await h.advance(210);
    const layer=h.elements.get('special-fx-layer');
    assert.equal(layer.children.filter(x=>x.className==='effect-cell target').length,64);
    assert.ok(layer.children.filter(x=>x.className==='effect-line').length<=64);
    assert.ok(h.elements.get('fx-layer').children.filter(x=>x.className.startsWith('fx-particle')).length<=72);
    await h.drain();assert.equal(layer.children.length,0);assert.equal(h.elements.get('fx-layer').children.length,0);
});
test('P2 leaving during special activation removes effects without touching the new session',async()=>{
    const h=harness();await h.start();h.run('engine.board[0][0]=engine.makeTile(0,"bomb");swapTilesAndCheck(0,0,0,1)');await h.advance(210);
    assert.ok(h.elements.get('special-fx-layer').children.length);
    h.run('goHome();beginLevel(1)');await h.drain();assert.equal(h.elements.get('special-fx-layer').children.length,0);assert.equal(h.run('score'),0);
});
test('P2 reduced motion retains generation and activation markers, skips particles and persists choice',async()=>{
    const h=harness();await h.start();const select=h.elements.get('motion-setting');select.value='reduce';select.events.change[0]();
    assert.equal(h.storage.get('nightmarket-motion'),'reduce');assert.equal(h.run('reducedMotion()'),true);
    h.run('showSpecialEffects({cells:[{r:0,c:0}],effects:[{r:0,c:0,special:"bomb",cells:[{r:0,c:0}]}],generated:[{r:1,c:1}]},false);spawnParticles([{r:0,c:0}]);');
    const layer=h.elements.get('special-fx-layer');assert.ok(layer.children.some(x=>x.className==='effect-cell generated'));assert.ok(layer.children.some(x=>x.className==='effect-cell bomb-source'));
    assert.equal(h.elements.get('fx-layer').children.length,0);
});

test('P2 follows live OS motion changes and survives blocked preference storage',async()=>{
    const h=harness(undefined,'0',{systemReduce:true});await h.start();assert.equal(h.run('reducedMotion()'),true);
    h.media.matches=false;h.media.change();assert.equal(h.run('reducedMotion()'),false);
    h.media.matches=true;h.media.change();assert.ok(h.elements.get('game-screen').classList.contains('reduce-motion'));
    const restored=harness(undefined,'0',{motion:'reduce'});assert.equal(restored.run('reducedMotion()'),true);
    const blocked=harness(undefined,'0',{storageBlocked:true});await blocked.start();
    const select=blocked.elements.get('motion-setting');select.value='reduce';select.events.change[0]();assert.equal(blocked.run('reducedMotion()'),true);
});
