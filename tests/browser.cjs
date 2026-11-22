const {setup,users,rpc}=require('./database.cjs');
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{const db=await setup();for(const u of users)await db.query('insert into auth.users values ($1)',[u]);
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});let queue=Promise.resolve();const errors=[];
async function pageFor(n){const ctx=await browser.newContext({viewport:{width:390,height:844}});const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
await p.route('https://*.supabase.co/**',route=>{queue=queue.then(async()=>{const req=route.request(),u=new URL(req.url());let body,status=200;try{
if(u.pathname.includes('/auth/v1/token')){const id=users[n],token=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:id,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.test';body={access_token:token,token_type:'bearer',expires_in:3600,refresh_token:'refresh-test',user:{id,email:`user${n}@example.test`,aud:'authenticated',role:'authenticated'}};}
else if(u.pathname.includes('/rest/v1/rpc/'))body=await rpc(db,users[n],u.pathname.split('/').pop(),req.postDataJSON()||{});
else body={};
}catch(e){status=400;body={code:'P0001',message:e.message};}
await route.fulfill({status,json:body,headers:{'access-control-allow-origin':'*'}});}).catch(console.error);return queue;});
await p.goto('http://localhost:4173');await p.getByLabel('Email',{exact:true}).fill(`user${n}@example.test`);await p.getByLabel('密碼（至少 8 個字元）').fill('test-password');await p.getByRole('button',{name:'登入',exact:true}).click();await p.getByLabel('你的暱稱').fill(n?'另一半':'小花');return p;}
const a=await pageFor(0);await a.getByRole('button',{name:'建立空間',exact:true}).click();await a.getByLabel('雙人邀請碼').waitFor();const code=await a.getByLabel('雙人邀請碼').inputValue();
const b=await pageFor(1);await b.getByLabel('邀請碼（加入時填寫）').fill(code);await b.getByRole('button',{name:'加入空間',exact:true}).click();await b.getByText('另一半（我）',{exact:true}).waitFor();
await a.getByRole('banner').getByText('另一半',{exact:true}).waitFor({timeout:12000});
await a.getByRole('button',{name:'支出',exact:true}).click();await a.getByPlaceholder('金額',{exact:true}).fill('120');await a.getByPlaceholder('買了什麼／用途').fill('共享午餐');await a.getByRole('button',{name:'記一筆',exact:true}).click();await a.getByText('已儲存至雲端',{exact:true}).waitFor();
await b.getByRole('button',{name:'支出',exact:true}).click();await b.getByText('共享午餐',{exact:true}).waitFor({timeout:12000});
await b.reload();await b.getByRole('button',{name:'支出',exact:true}).click();await b.getByText('共享午餐',{exact:true}).waitFor();
// Exercise original daily, wish, and income workflows through the cloud adapter.
await a.getByRole('button',{name:'收入',exact:true}).click();await a.getByPlaceholder('金額',{exact:true}).fill('1000');await a.getByPlaceholder('收入來源／用途').fill('薪資');await a.getByRole('button',{name:'記一筆',exact:true}).click();await a.getByText('已儲存至雲端',{exact:true}).waitFor();
await a.getByRole('button',{name:'總覽',exact:true}).click();await a.getByText('NT$ 880',{exact:true}).waitFor();
await a.getByRole('button',{name:'📅 每日',exact:true}).click();
await a.getByLabel('時間',{exact:true}).fill('18:30');await a.getByLabel('行程',{exact:true}).fill('一起散步');await a.getByRole('button',{name:'加入',exact:true}).click();await a.getByText('已儲存至雲端',{exact:true}).waitFor();
const ownRow=a.locator('.tx').filter({hasText:'一起散步'});assert.equal(await ownRow.locator('.dot').count(),1);assert.equal(await a.getByLabel('一起（兩人）',{exact:true}).isChecked(),false);
await a.getByLabel('行程',{exact:true}).fill('共同晚餐');await a.getByLabel('一起（兩人）',{exact:true}).check();await a.getByRole('button',{name:'加入',exact:true}).click();await a.getByText('已儲存至雲端',{exact:true}).waitFor();
const sharedRow=a.locator('.tx').filter({hasText:'共同晚餐'});await sharedRow.getByText('一起',{exact:true}).waitFor();assert.equal(await sharedRow.locator('.dot').count(),2);assert.equal(await a.locator('.cd.sel .dot').count(),2);
assert(await a.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
await b.getByRole('button',{name:'📅 每日',exact:true}).click();await b.getByText('一起散步',{exact:true}).waitFor({timeout:12000});await b.getByText('18:30',{exact:true}).waitFor();await b.getByText('共同晚餐',{exact:true}).waitFor({timeout:12000});assert.equal(await b.locator('.tx').filter({hasText:'共同晚餐'}).locator('.dot').count(),2);await b.getByRole('button',{name:'💰 記帳',exact:true}).click();await b.getByRole('button',{name:'支出',exact:true}).click();
await a.getByRole('button',{name:'下個月',exact:true}).click();await a.getByRole('button',{name:'今天',exact:true}).click();await a.getByText('一起散步',{exact:true}).waitFor();
await a.reload();await a.getByRole('button',{name:'📅 每日',exact:true}).click();await a.getByText('一起散步',{exact:true}).waitFor();await a.locator('.tx').filter({hasText:'共同晚餐'}).getByText('一起',{exact:true}).waitFor();assert.equal(await a.locator('.tx').filter({hasText:'一起散步'}).locator('.dot').count(),1);await a.getByRole('button',{name:'💊 吃了嗎？',exact:true}).click();await a.getByText('已儲存至雲端',{exact:true}).waitFor();
const strength=p=>p.locator('section').filter({has:p.getByRole('heading',{name:'🏋️ 重訓打卡',exact:true})});
const cardio=p=>p.locator('section').filter({has:p.getByRole('heading',{name:'🏃 有氧打卡',exact:true})});
const saved=()=>a.getByText('已儲存至雲端',{exact:true}).waitFor();
await strength(a).getByRole('button',{name:'🏋️ 重訓打卡',exact:true}).click();await saved();await strength(a).getByRole('button',{name:'🏋️ 已完成 ✓',exact:true,pressed:true}).waitFor();assert.equal(await cardio(a).getByRole('button',{pressed:false}).count(),1);
await cardio(a).getByRole('button',{name:'🏃 有氧打卡',exact:true}).click();await saved();
for(const section of [strength(a),cardio(a)]){await section.locator('.stat').filter({hasText:'小花'}).getByText('本月 1 天',{exact:true}).waitFor();await section.locator('.stat').filter({hasText:'小花'}).getByText('連續 1 天',{exact:true}).waitFor();}
await cardio(a).getByRole('button',{pressed:true}).click();await saved();await cardio(a).locator('.stat').filter({hasText:'小花'}).getByText('本月 0 天',{exact:true}).waitFor();assert.equal(await strength(a).getByRole('button',{pressed:true}).count(),1);
await cardio(a).getByRole('button',{pressed:false}).click();await saved();await a.reload();await a.getByRole('button',{name:'📅 每日',exact:true}).click();
assert.equal(await strength(a).getByRole('button',{pressed:true}).count(),1);assert.equal(await cardio(a).getByRole('button',{pressed:true}).count(),1);await a.getByRole('button',{name:'💊 已吃 ✓',exact:true}).waitFor();
await b.getByRole('button',{name:'📅 每日',exact:true}).click();await strength(b).getByText('🏋️ 已完成 ✓',{exact:true}).waitFor({timeout:12000});await cardio(b).getByText('🏃 已完成 ✓',{exact:true}).waitFor({timeout:12000});assert.equal(await strength(b).getByRole('button',{pressed:false}).count(),1);assert.equal(await cardio(b).getByRole('button',{pressed:false}).count(),1);
assert(await a.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await b.getByRole('button',{name:'💰 記帳',exact:true}).click();await b.getByRole('button',{name:'支出',exact:true}).click();
await a.getByRole('button',{name:'🎁 許願',exact:true}).click();await a.getByPlaceholder('想一起完成的事，例如：京都五日遊').fill('一起旅行');await a.getByPlaceholder('目標金額').fill('500');await a.getByRole('button',{name:'許下願望',exact:true}).click();await a.getByText('已儲存至雲端',{exact:true}).waitFor();await a.getByPlaceholder('存入金額').fill('500');await a.getByRole('button',{name:'存進去',exact:true}).click();await a.getByText('已儲存至雲端',{exact:true}).waitFor();await a.getByRole('button',{name:'🎉 我們實現了！',exact:true}).click();await a.getByText('已儲存至雲端',{exact:true}).waitFor();await a.getByText('✅ 已經實現',{exact:true}).waitFor();
// Inject a transport failure; the app must expose backup and never claim saved.
await b.route('**/rest/v1/rpc/save_space',r=>r.fulfill({status:500,json:{message:'test network failure'}}));
await b.getByPlaceholder('金額',{exact:true}).fill('80');await b.getByPlaceholder('買了什麼／用途').fill('未儲存測試');await b.getByRole('button',{name:'記一筆',exact:true}).click();await b.getByRole('link',{name:'下載未儲存的資料',exact:true}).waitFor({timeout:15000});await b.getByText('尚未儲存，請先下載備份並重新載入',{exact:true}).waitFor();
assert(await b.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
const c=await pageFor(2);await c.getByLabel('邀請碼（加入時填寫）').fill(code);await c.getByRole('button',{name:'加入空間',exact:true}).click();await c.getByText('邀請碼無效或空間已滿。',{exact:true}).waitFor();assert(await c.locator('#app').isHidden());
assert.deepEqual(errors,[]);await a.screenshot({path:'/tmp/us-cloud-mobile.png',fullPage:true});
console.log('PASS browser with mocked Auth and PostgreSQL-backed RPCs: login, create, partner join, polling across two contexts, expense sync, reload persistence, income balance, calendar navigation, own/together event labels and calendar dots, timed event sync and reload, independent strength/cardio check-ins, undo, counts, partner sync and reload, wish completion, rejected third member, visible save failure + backup, no horizontal overflow, no JS errors');
await browser.close();await db.close();})().catch(e=>{console.error(e);process.exit(1)});
