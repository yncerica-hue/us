import { startCloud } from './cloud.js';

const $=s=>document.querySelector(s);
function h(t,a,...c){const e=document.createElement(t);for(const k in a||{}){const v=a[k];if(k==='class')e.className=v;else if(k==='style')e.style.cssText=v;else if(k==='value'||k==='checked')e[k]=v;else if(k.slice(0,2)==='on')e.addEventListener(k.slice(2),v);else if(v!=null&&v!==false)e.setAttribute(k,v)}for(const x of c.flat(9))if(x!=null&&x!==false)e.append(x.nodeType?x:document.createTextNode(x));return e}
const CATS=['🍜 餐飲','🚇 交通','🛒 日用','🎬 娛樂','✈️ 旅遊','✨ 其他'];
const sum=a=>a.reduce((s,x)=>s+(+x.amt||0),0);
const money=n=>'NT$ '+Math.round(n).toLocaleString('en-US');
const pad=n=>String(n).padStart(2,'0');
const fmt=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const today=()=>fmt(new Date());
const ym=d=>String(d).slice(0,7);
const uid=()=>Math.random().toString(36).slice(2,9);
const DCATS=[['餐飲','吃喝都在這'],['服飾','衣服 飾品 鞋子'],['日用品','日用品 家用品'],['交通','汽機車 各項交通'],['教育運動','運動 教育 學習'],['娛樂','純屬開心的開銷'],['醫療保健','醫療 成藥 保健品'],['交際送禮','交際 應酬 送禮'],['通訊訂閱','通訊 各種APP 訂閱'],['寵物','寵物相關開銷'],['公司代墊','公司先墊款，之後報銷'],['其他／待分類','']];
const norm=d=>{
  const g=d.cfg||{},cats=g.cats||DCATS.map(([n,t])=>({n,t,b:'',life:n!=='公司代墊'}));
  const o={members:d.members||{},tx:[],inc:d.inc||[],ev:d.ev||[],logs:d.logs||{},wishes:d.wishes||[],cfg:{cats,pays:g.pays||['現金','信用卡','LINE Pay','轉帳'],icats:g.icats||['薪資收入','費用撥款','副業收入','補助津貼','其他'],fixed:g.fixed||[]}};
  (d.tx||[]).forEach(x=>{
    if(x.type==='in')o.inc.push({id:x.id,date:x.date,cat:'其他',note:x.note||'',amt:x.amt,who:x.who,nature:'一般收入'});
    else{const c=String(x.cat||'').replace(/^[^\u4e00-\u9fa5A-Za-z]+/,'');o.tx.push(Object.assign({kind:'life'},x,{cat:cats.some(k=>k.n===c)?c:'其他／待分類'}))}
  });
  Object.entries(o.logs).forEach(([dt,v])=>Object.entries(v).forEach(([w,e])=>{if(e&&e.plan){const id='p-'+dt+'-'+w;if(!o.ev.some(x=>x.id===id))o.ev.push({id,date:dt,time:'',title:e.plan,who:w});delete e.plan}}));
  return o;
};
let S=norm({}),me=null,ref=null,tab='money',day=today(),ready=false,pending=false,saveT;
const ids=()=>Object.keys(S.members);
const nm=id=>S.members[id]||'對方';
const col=id=>ids().indexOf(id)===1?'var(--b)':'var(--a)';
const canEdit=()=>ready&&!saving&&!unsaved&&!!S.members[me];
const dotOf=id=>h('i',{class:'dot',style:'background:'+col(id)});

let saving=false,unsaved=false;
async function save(){
  if(!ref||saving||unsaved)return;
  saving=true;ref.status('儲存中…');
  try{await ref.set(JSON.parse(JSON.stringify(S)));ref.status('已儲存至雲端');}
  catch(e){unsaved=true;ref.failed(S,e);}
  finally{saving=false;render();}
}
function commit(){save();render()}
window.addEventListener('beforeunload',e=>{if(saving||unsaved){e.preventDefault();e.returnValue='';}});
function typing(){return /INPUT|TEXTAREA|SELECT/.test((document.activeElement||{}).tagName||'')}
function incoming(){if(typing())pending=true;else render()}
document.addEventListener('focusout',()=>setTimeout(()=>{if(pending&&!typing()){pending=false;render()}},120));

function header(){
  const names=ids().map(id=>h('span',{class:'pill'},dotOf(id),nm(id)+(id===me?'（我）':'')));
  if(ready&&ids().length<2)names.push(h('span',{class:'pill mute'},'等另一半加入'));
  return h('header',{class:'journal-header'},h('div',{class:'eyebrow'},'OUR LITTLE DAYS · 生活手帳'),h('h1',{'aria-label':'💞 我們的小日子'},'我們的小日子',h('span',{class:'title-mark','aria-hidden':'true'},' ✳︎')),h('p',{class:'intro'},'把平凡的日子，慢慢過成喜歡的樣子。'),h('div',{class:'row wrap'},names),
    h('div',{class:'mute',style:'margin-top:6px'},saving?'儲存中，請稍候…':unsaved?'尚未儲存，請先下載備份並重新載入':ready?'一起記錄，為生活留一點餘裕。':'連線中…'));
}
function joinCard(){
  if(ids().length>=2)return h('section',{class:'sec'},'這個空間已經有兩位成員了，你目前只能瀏覽。');
  const n=h('input',{placeholder:'你的暱稱'});
  return h('section',{class:'sec'},h('h2',{},'先取個暱稱吧'),h('div',{class:'row'},n,h('button',{class:'btn',onclick:()=>{const v=n.value.trim();if(!v)return n.focus();S.members[me]=v;commit()}},'加入')));
}

let sub='sum',mon=today().slice(0,7);
const inM=(a,m)=>a.filter(x=>ym(x.date)===m);
const fixedSum=()=>sum(S.cfg.fixed.filter(f=>f.on));
const edit=(arr,id,fn)=>{const t=arr.find(i=>i.id===id);if(t&&canEdit()){fn(t);commit()}};
const nxt=['待報銷','已送件','已收款'];
const num=v=>Math.round(v).toLocaleString('en-US');
function calc(m){
  const e=inM(S.tx,m),i=inM(S.inc,m),life=e.filter(x=>x.kind==='life');
  const incOK=sum(i.filter(x=>x.nature==='一般收入')),has=e.length+i.length>0,fx=has?fixedSum():0,L=sum(life);
  return{e,i,life,incOK,L,fx,has,bal:incOK-L-fx,pend:sum(i.filter(x=>x.nature==='待確認')),adv:sum(e.filter(x=>x.cat==='公司代墊')),card:sum(e.filter(x=>x.kind==='card'))};
}
const shiftM=n=>{const[y,m]=mon.split('-').map(Number),d=new Date(y,m-1+n,1);mon=d.getFullYear()+'-'+pad(d.getMonth()+1);render()};
const monBar=()=>h('div',{class:'row dn'},h('button',{class:'ghost','aria-label':'上個月',onclick:()=>shiftM(-1)},'‹'),h('div',{class:'dt'},mon.replace('-','年')+'月'),h('button',{class:'ghost','aria-label':'下個月',onclick:()=>shiftM(1)},'›'));
const SUBS=[['sum','總覽'],['exp','支出'],['inc','收入'],['yr','年度'],['set','設定']];
const subNav=()=>h('div',{class:'subnav','aria-label':'記帳分類'},SUBS.map(([k,t])=>h('button',{class:'ghost'+(sub===k?' on':''),onclick:()=>{sub=k;render()}},t)));
const delBtn=fn=>h('button',{class:'x','aria-label':'刪除',onclick:()=>{if(canEdit()){fn();commit()}}},'✕');

function moneyView(){
  return h('div',{},subNav(),sub==='yr'?yearV():sub==='set'?setV():h('div',{},monBar(),sub==='sum'?sumV():sub==='exp'?expV():incV()));
}
function sumV(){
  const c=calc(mon);
  const st=(l,v,s)=>h('div',{class:'stat'+(l==='估算結餘'?' balance':'')},h('span',{class:'mute'},l),h('b',{},money(v)),s||null);
  const rows=S.cfg.cats.filter(k=>k.life!==false).map(k=>{
    const s=sum(c.life.filter(x=>x.cat===k.n)),b=parseFloat(k.b),has=b>0,over=s>b;
    return h('div',{class:'tx',style:'display:block'},
      h('div',{class:'row'},h('b',{style:'flex:1'},k.n),h('span',{},money(s)),h('span',{class:'mute'},has?(over?'超支':s===b?'已用完':'預算內'):'未設預算')),
      has&&h('div',{class:'bar',style:'margin:6px 0 2px'},h('i',{style:'width:'+Math.min(100,s/b*100)+'%;background:'+(over?'var(--a)':'var(--ok)')})),
      has&&h('div',{class:'mute'},'預算 '+money(b)+'　'+(over?'超出 ':'剩 ')+money(Math.abs(b-s))+'　用了 '+Math.round(s/b*100)+'%'));
  });
  const per=ids().map(id=>h('div',{class:'stat'},h('div',{class:'row'},dotOf(id),nm(id)),h('div',{class:'mute'},'生活支出 '+money(sum(c.life.filter(x=>x.who===id)))),h('div',{class:'mute'},'計入收入 '+money(sum(c.i.filter(x=>x.who===id&&x.nature==='一般收入'))))));
  return h('div',{},
    h('section',{class:'sec overview'},h('div',{class:'section-heading'},h('h2',{},'這個月的生活'),h('span',{class:'eyebrow'},'MONTHLY NOTES')),h('div',{class:'grid2'},st('計入收入',c.incOK,c.pend?h('span',{class:'mute'},'待確認 '+money(c.pend)):null),st('生活支出',c.L),st('固定支出（預估）',c.fx),st('估算結餘',c.bal)),
      h('div',{class:'mute'},'公司代墊 '+money(c.adv)+'（不算生活支出）；卡費繳款 '+money(c.card)+'（不重複算消費）')),
    h('section',{class:'sec'},h('h2',{},'各分類預算'),rows),
    h('section',{class:'sec'},h('h2',{},'兩個人'),h('div',{class:'grid2'},per)));
}
function expV(){
  const C=S.cfg;
  const date=h('input',{type:'date',value:today()}),amt=h('input',{type:'number',inputmode:'decimal',placeholder:'金額'});
  const cat=h('select',{},C.cats.map(k=>h('option',{},k.n))),pay=h('select',{},C.pays.map(p=>h('option',{},p)));
  const note=h('input',{placeholder:'買了什麼／用途'});
  const kind=h('select',{},h('option',{value:'life'},'生活支出'),h('option',{value:'card'},'信用卡繳款'),h('option',{value:'skip'},'排除支出'));
  const adv=h('select',{style:'display:none'},nxt.map(x=>h('option',{},x)));
  cat.addEventListener('change',()=>{const k=C.cats.find(z=>z.n===cat.value);adv.style.display=k&&k.life===false?'':'none'});
  const add=h('button',{class:'btn full',onclick:()=>{
    if(!canEdit())return;const a=parseFloat(amt.value);if(!(a>0))return amt.focus();if(!note.value.trim())return note.focus();
    const k=C.cats.find(z=>z.n===cat.value),isAdv=k&&k.life===false;
    S.tx.push({id:uid(),date:date.value||today(),amt:a,cat:cat.value,note:note.value.trim(),pay:pay.value,who:me,kind:isAdv?'adv':kind.value,adv:isAdv?adv.value:''});commit()}},'記一筆');
  const open=sum(S.tx.filter(x=>x.kind==='adv'&&x.adv!=='已收款'));
  const list=inM(S.tx,mon).sort((a,b)=>b.date.localeCompare(a.date)).map(x=>h('div',{class:'tx'},dotOf(x.who),
    h('div',{style:'flex:1;min-width:0'},h('div',{},x.note),h('div',{class:'mute'},[x.cat,x.pay,x.date.slice(5),nm(x.who),x.kind==='card'?'卡費':x.kind==='skip'?'排除':''].filter(Boolean).join('　'))),
    x.kind==='adv'&&h('button',{class:'ghost',onclick:()=>edit(S.tx,x.id,t=>{t.adv=nxt[(nxt.indexOf(t.adv)+1)%3]})},x.adv||'待報銷'),
    h('b',{},money(x.amt)),delBtn(()=>{S.tx=S.tx.filter(t=>t.id!==x.id)})));
  return h('div',{},
    h('section',{class:'sec'},h('h2',{},'新增支出'),h('div',{class:'grid2'},date,amt,cat,pay),note,h('div',{class:'grid2'},kind,adv),add),
    open>0&&h('div',{class:'mute',style:'margin:0 4px'},'待核對的公司代墊共 '+money(open)+'，點右側狀態可切換進度。'),
    h('section',{class:'sec'},h('h2',{},'本月支出'),list.length?list:h('div',{class:'mute'},'這個月還沒有支出紀錄。')));
}
function incV(){
  const C=S.cfg;
  const date=h('input',{type:'date',value:today()}),amt=h('input',{type:'number',inputmode:'decimal',placeholder:'金額'});
  const cat=h('select',{},C.icats.map(k=>h('option',{},k))),note=h('input',{placeholder:'收入來源／用途'});
  const nat=h('select',{},['一般收入','報銷回款','待確認'].map(x=>h('option',{},x)));
  const add=h('button',{class:'btn full',onclick:()=>{
    if(!canEdit())return;const a=parseFloat(amt.value);if(!(a>0))return amt.focus();if(!note.value.trim())return note.focus();
    S.inc.push({id:uid(),date:date.value||today(),amt:a,cat:cat.value,note:note.value.trim(),who:me,nature:nat.value});commit()}},'記一筆');
  const list=inM(S.inc,mon).sort((a,b)=>b.date.localeCompare(a.date)).map(x=>h('div',{class:'tx'},dotOf(x.who),
    h('div',{style:'flex:1;min-width:0'},h('div',{},x.note),h('div',{class:'mute'},[x.cat,x.date.slice(5),nm(x.who),x.nature].join('　'))),
    h('b',{style:x.nature==='一般收入'?'color:var(--ok)':''},money(x.amt)),delBtn(()=>{S.inc=S.inc.filter(t=>t.id!==x.id)})));
  return h('div',{},
    h('section',{class:'sec'},h('h2',{},'新增收入'),h('div',{class:'grid2'},date,amt,cat,nat),note,add,h('div',{class:'mute',style:'margin-top:6px'},'只有「一般收入」會計入結餘；報銷回款和待確認不算賺到的錢。')),
    h('section',{class:'sec'},h('h2',{},'本月收入'),list.length?list:h('div',{class:'mute'},'這個月還沒有收入紀錄。')));
}
function yearV(){
  const y=mon.slice(0,4),T=[0,0,0,0],r=(v,b)=>h('td',{style:'text-align:right'},b?h('b',{},num(v)):num(v));
  const rows=[...Array(12)].map((_,i)=>{const c=calc(y+'-'+pad(i+1));if(!c.has)return null;const v=[c.incOK,c.L,c.fx,c.bal];v.forEach((x,j)=>T[j]+=x);return h('tr',{},h('td',{},(i+1)+'月'),v.map(x=>r(x)))}).filter(Boolean);
  return h('div',{},
    h('div',{class:'row dn'},h('button',{class:'ghost','aria-label':'前一年',onclick:()=>{mon=(+y-1)+mon.slice(4);render()}},'‹'),h('div',{class:'dt'},y+' 年'),h('button',{class:'ghost','aria-label':'後一年',onclick:()=>{mon=(+y+1)+mon.slice(4);render()}},'›')),
    h('section',{class:'sec',style:'overflow-x:auto'},rows.length?h('table',{style:'width:100%;border-collapse:collapse'},h('tr',{},['月份','計入收入','生活支出','固定預估','估算結餘'].map((t,i)=>h('th',{class:'mute',style:'font-weight:600;text-align:'+(i?'right':'left')},t))),rows,h('tr',{},h('td',{},h('b',{},'合計')),T.map(v=>r(v,1)))):h('div',{class:'mute'},'這一年還沒有紀錄。')),
    h('div',{class:'mute',style:'margin:0 4px'},'固定支出以目前月額套用在有紀錄的月份；估算結餘不等於銀行餘額。'));
}
function chipEd(title,key){
  const inp=h('input',{placeholder:'新增項目'});
  return h('section',{class:'sec'},h('h2',{},title),
    h('div',{class:'row wrap'},S.cfg[key].map(p=>h('span',{class:'pill'},p,h('button',{class:'x','aria-label':'移除',style:'padding:0 0 0 4px',onclick:()=>{if(canEdit()){S.cfg[key]=S.cfg[key].filter(z=>z!==p);commit()}}},'✕')))),
    h('div',{class:'row',style:'margin-top:8px'},inp,h('button',{class:'btn',onclick:()=>{const v=inp.value.trim();if(v&&canEdit()&&!S.cfg[key].includes(v)){S.cfg[key].push(v);commit()}}},'新增')));
}
function setV(){
  const cn=h('input',{placeholder:'新增分類'}),fn=h('input',{placeholder:'名稱，例如：房租'}),fa=h('input',{type:'number',inputmode:'numeric',placeholder:'每月金額'});
  return h('div',{},
    h('section',{class:'sec'},h('h2',{},'分類與月預算'),h('div',{class:'mute'},'預算留白代表未設預算，不當成 0 元。'),
      S.cfg.cats.map(k=>h('div',{class:'tx'},h('div',{style:'flex:1'},h('div',{},k.n),h('div',{class:'mute'},k.t||(k.life===false?'不算生活支出':''))),
        k.life===false?h('span',{class:'mute'},'不設預算'):h('input',{type:'number',inputmode:'numeric',placeholder:'月預算',value:k.b,style:'width:110px','aria-label':k.n+'月預算',onchange:ev=>{const t=S.cfg.cats.find(z=>z.n===k.n);if(t&&canEdit()){t.b=ev.target.value;save()}}}))),
      h('div',{class:'row',style:'margin-top:8px'},cn,h('button',{class:'btn',onclick:()=>{const v=cn.value.trim();if(v&&canEdit()&&!S.cfg.cats.some(z=>z.n===v)){S.cfg.cats.push({n:v,t:'',b:'',life:true});commit()}}},'新增'))),
    chipEd('付款方式','pays'),chipEd('收入分類','icats'),
    h('section',{class:'sec'},h('h2',{},'固定支出（每月預估）'),h('div',{class:'mute'},'啟用中合計 '+money(fixedSum())+'。同一筆不要再記進支出，避免重複扣。'),
      S.cfg.fixed.map(f=>h('div',{class:'tx'},h('div',{style:'flex:1'},f.n),h('b',{},money(f.amt)),h('button',{class:'ghost',onclick:()=>edit(S.cfg.fixed,f.id,t=>{t.on=!t.on})},f.on?'啟用':'停用'),delBtn(()=>{S.cfg.fixed=S.cfg.fixed.filter(t=>t.id!==f.id)}))),
      h('div',{class:'grid2',style:'margin-top:8px'},fn,fa),
      h('button',{class:'btn full',onclick:()=>{const a=parseFloat(fa.value);if(!canEdit())return;if(!fn.value.trim())return fn.focus();if(!(a>0))return fa.focus();S.cfg.fixed.push({id:uid(),n:fn.value.trim(),amt:a,who:me,on:true});commit()}},'新增固定支出')));
}

function setLog(k,v){
  if(!canEdit())return;
  const L=S.logs[day]=S.logs[day]||{};L[me]=Object.assign({},L[me],{[k]:v});commit();
}
function streak(id,key='supp'){
  let n=0,d=new Date(today()+'T00:00:00');const on=x=>((S.logs[fmt(x)]||{})[id]||{})[key];
  if(!on(d))d.setDate(d.getDate()-1);
  while(on(d)){n++;d.setDate(d.getDate()-1)}return n;
}
function checkInSection(key,title,pendingText,doneText){
  const L=S.logs[day]||{},order=ids().includes(me)?[me,...ids().filter(i=>i!==me)]:ids();
  const rows=order.map(id=>{const done=!!(L[id]||{})[key];return h('div',{class:'row',style:'margin:6px 0'},dotOf(id),h('span',{style:'flex:1'},nm(id)+(id===me?'（我）':'')),
    id===me?h('button',{class:'tog'+(done?' on':''),style:'width:auto;margin:0;padding:8px 14px','aria-pressed':String(done),disabled:!canEdit(),onclick:()=>setLog(key,!done)},done?doneText:pendingText):h('span',{class:done?'okline':'mute',style:'margin:0'},done?doneText:'還沒打卡'))});
  const mm=ym(today()),stats=ids().map(id=>{
    const count=Object.entries(S.logs).filter(([d,v])=>ym(d)===mm&&(v[id]||{})[key]).length;
    return h('div',{class:'stat'},h('div',{class:'row'},dotOf(id),nm(id)),h('b',{},'本月 '+count+' 天'),h('span',{class:'mute'},'連續 '+streak(id,key)+' 天'));
  });
  return h('section',{class:'sec'},h('h2',{},title),rows,h('div',{class:'grid2'},stats));
}
let calM=today().slice(0,7);
const eventPeople=e=>e.together?ids():[e.who];
const evOf=d=>S.ev.filter(e=>e.date===d).sort((a,b)=>(a.time||'').localeCompare(b.time||''));
function dayView(){
  const[y,m]=calM.split('-').map(Number),first=new Date(y,m-1,1).getDay(),dim=new Date(y,m,0).getDate();
  const shiftC=n=>{const d=new Date(y,m-1+n,1);calM=d.getFullYear()+'-'+pad(d.getMonth()+1);render()};
  const cells=[...Array(first)].map(()=>h('div'));
  for(let d=1;d<=dim;d++){
    const ds=calM+'-'+pad(d),who=[...new Set(S.ev.filter(e=>e.date===ds).flatMap(eventPeople))];
    cells.push(h('button',{class:'cd'+(ds===day?' sel':'')+(ds===today()?' tod':''),'aria-label':m+'月'+d+'日',onclick:()=>{day=ds;render()}},String(d),h('span',{class:'dots'},who.map(w=>dotOf(w)))));
  }
  const label=new Date(day+'T00:00:00').toLocaleDateString('zh-TW',{month:'long',day:'numeric',weekday:'short'});
  const tm=h('input',{type:'time','aria-label':'時間',style:'width:125px'}),ti=h('input',{placeholder:'行程，例如：晚餐','aria-label':'行程',enterkeyhint:'done'});
  const together=h('input',{type:'checkbox','aria-label':'一起（兩人）',style:'width:auto;margin:0'});
  const addE=()=>{if(!canEdit())return;const v=ti.value.trim();if(!v)return ti.focus();S.ev.push({id:uid(),date:day,time:tm.value,title:v,who:me,together:together.checked});commit()};
  ti.addEventListener('keydown',e=>{if(e.key==='Enter')addE()});
  const evs=evOf(day).map(e=>h('div',{class:'tx'},h('span',{class:'row',style:'gap:3px'},eventPeople(e).map(dotOf)),h('div',{style:'width:54px;font-weight:700'},e.time||'全天'),h('div',{style:'flex:1;min-width:0'},e.title),h('span',{class:'mute'},e.together?'一起':nm(e.who)),delBtn(()=>{S.ev=S.ev.filter(t=>t.id!==e.id)})));
  return h('div',{},
    h('section',{class:'sec'},
      h('div',{class:'row dn'},h('button',{class:'ghost','aria-label':'上個月',onclick:()=>shiftC(-1)},'‹'),h('div',{class:'dt'},y+'年'+m+'月'),h('button',{class:'ghost','aria-label':'下個月',onclick:()=>shiftC(1)},'›'),h('button',{class:'ghost',onclick:()=>{day=today();calM=day.slice(0,7);render()}},'今天')),
      h('div',{class:'cal'},['日','一','二','三','四','五','六'].map(w=>h('div',{class:'mute',style:'text-align:center'},w)),cells)),
    h('section',{class:'sec'},h('h2',{},label),h('div',{class:'row'},tm,ti,h('button',{class:'btn',onclick:addE},'加入')),
      h('label',{class:'row',style:'margin-top:10px'},together,'一起（兩人）',h('span',{class:'mute'},'未勾選為自己')),
      h('div',{style:'margin-top:6px'},evs.length?evs:h('div',{class:'mute'},'這天還沒有行程，輸入時間和內容就能加入（時間可以不填）。'))),
    checkInSection('supp','💊 保健品打卡','💊 吃了嗎？','💊 已吃 ✓'),
    checkInSection('strength','🏋️ 重訓打卡','🏋️ 重訓打卡','🏋️ 已完成 ✓'),
    checkInSection('cardio','🏃 有氧打卡','🏃 有氧打卡','🏃 已完成 ✓'));
}

function wishView(){
  const t=h('input',{placeholder:'想一起完成的事，例如：京都五日遊'});
  const g=h('input',{type:'number',inputmode:'decimal',min:'0.01',step:'any',placeholder:'目標金額'});
  const e=h('select',{style:'width:80px'},['🍽️','✈️','🎁','🏠','🎬','💍'].map(x=>h('option',{},x)));
  const add=h('button',{class:'btn full',onclick:()=>{
    if(!canEdit())return;const v=t.value.trim(),a=parseFloat(g.value);
    if(!v)return t.focus();if(!Number.isFinite(a)||!(a>0))return g.focus();
    S.wishes.push({id:uid(),title:v,target:a,emoji:e.value,c:[],done:false});commit()}},'許下願望');
  const cards=S.wishes.map((w,index)=>{
    const c=w.c||[],saved=Math.max(0,sum(c)+(Number(w.adjustment)||0)),left=Math.max(0,w.target-saved);
    const percent=w.target>0?saved/w.target*100:0;
    const percentText=Number(percent.toFixed(1))+'%';
    const inp=h('input',{type:'number',inputmode:'decimal',min:'0.01',step:'any',placeholder:'存入金額'});
    const upd=fn=>{const x=S.wishes.find(i=>i.id===w.id);if(x&&canEdit()){fn(x);commit()}};
    const move=direction=>{
      if(!canEdit())return;
      const from=S.wishes.findIndex(x=>x.id===w.id),to=from+direction;
      if(from<0||to<0||to>=S.wishes.length)return;
      [S.wishes[from],S.wishes[to]]=[S.wishes[to],S.wishes[from]];commit();
    };
    const mode=h('select',{'aria-label':w.title+'進度輸入方式'},h('option',{value:'amount'},'累計金額'),h('option',{value:'percent'},'達成百分比'));
    const progress=h('input',{type:'number',inputmode:'decimal',min:'0',step:'any',value:saved,'aria-label':w.title+'已達成進度'});
    mode.addEventListener('change',()=>{progress.value=mode.value==='percent'?Number(percent.toFixed(4)):saved;});
    const updateProgress=()=>{
      if(!progress.reportValidity()||progress.value==='')return progress.focus();
      const value=Number(progress.value),amount=mode.value==='percent'?w.target*value/100:value;
      if(!Number.isFinite(amount)||amount<0)return progress.focus();
      upd(x=>{x.adjustment=amount-sum(x.c||[]);if(amount<x.target)x.done=false;});
    };
    progress.addEventListener('keydown',ev=>{if(ev.key==='Enter'){ev.preventDefault();updateProgress();}});
    return h('section',{class:'sec wish-card','aria-label':w.title},
      h('div',{class:'row'},h('div',{class:'big'},w.emoji),
        h('div',{style:'flex:1;min-width:0'},h('b',{},w.title),h('div',{class:'mute'},money(saved)+' / '+money(w.target)+(w.done?'':saved>=w.target?'，存夠了！':'，還差 '+money(left)))),
        h('button',{class:'x','aria-label':'刪除願望',onclick:()=>{if(canEdit()){S.wishes=S.wishes.filter(i=>i.id!==w.id);commit()}}},'✕')),
      h('div',{class:'row wrap wish-order'},h('button',{class:'ghost',disabled:!canEdit()||index===0,'aria-label':w.title+'上移',onclick:()=>move(-1)},'上移'),h('button',{class:'ghost',disabled:!canEdit()||index===S.wishes.length-1,'aria-label':w.title+'下移',onclick:()=>move(1)},'下移')),
      h('div',{class:'row wish-progress'},h('span',{},'達成進度'),h('b',{},percentText)),
      h('div',{class:'bar',role:'progressbar','aria-label':w.title+'達成進度','aria-valuemin':'0','aria-valuemax':'100','aria-valuenow':Math.min(100,percent),'aria-valuetext':percentText},h('i',{style:'width:'+Math.min(100,percent)+'%;background:var(--ok)'})),
      h('div',{class:'row wrap mute'},h('span',{},'累計存入'),ids().map(id=>h('span',{class:'pill'},dotOf(id),nm(id)+' '+money(sum(c.filter(x=>x.who===id)))))),
      h('form',{class:'wish-update',onsubmit:ev=>{ev.preventDefault();updateProgress();}},h('div',{class:'wish-update-label'},'更新已達成進度'),h('div',{class:'row'},mode,progress),h('button',{class:'ghost full',type:'submit',disabled:!canEdit()},'更新進度')),
      w.done?h('div',{class:'okline'},'✅ 已經實現'):[
        h('div',{class:'row',style:'margin-top:10px'},inp,h('button',{class:'btn',onclick:()=>{const a=parseFloat(inp.value);if(!Number.isFinite(a)||!(a>0))return inp.focus();upd(x=>{(x.c=x.c||[]).push({who:me,amt:a,date:today()})})}},'存進去')),
        saved>=w.target&&h('button',{class:'btn full',style:'background:var(--ok)',onclick:()=>upd(x=>{x.done=true})},'🎉 我們實現了！')]);
  });
  return h('div',{},
    h('section',{class:'sec'},h('h2',{},'許個願'),h('div',{class:'row'},e,t),h('div',{style:'margin-top:8px'},g),add),
    cards.length?cards:h('div',{class:'mute'},'還沒有願望，先許一個吧。'));
}

function render(){
  const app=$('#app');app.replaceChildren(header());
  if(!ready)return;
  app.append(tab==='money'?moneyView():tab==='day'?dayView():wishView());
  document.querySelectorAll('#nav button').forEach(b=>{const active=b.dataset.tab===tab;b.classList.toggle('on',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
}
document.querySelectorAll('#nav button').forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.tab;render()}));

async function init(){
  await startCloud({
    onReady(user,adapter,data){me=user;ref=adapter;S=norm(data);ready=true;unsaved=false;render();},
    onUpdate(data){S=norm(data);incoming();},
    idle(){return ready&&!saving&&!unsaved&&!typing();}
  });
}
init();
