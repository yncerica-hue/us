const {PGlite}=require('@electric-sql/pglite');
const fs=require('fs');const assert=require('node:assert/strict');
async function setup(){const db=new PGlite();await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);await db.exec(fs.readFileSync(require('node:path').join(__dirname,'../supabase/schema.sql'),'utf8'));return db;}
const users=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333'];
async function as(db,user,fn){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);await db.exec('set role authenticated');try{return await fn()}finally{await db.exec('reset role')}}
async function rpc(db,user,name,args={}){return as(db,user,async()=>{const keys=Object.keys(args);const q=`select public.${name}(${keys.map((k,i)=>`${k} => $${i+1}`).join(',')}) as result`;return (await db.query(q,Object.values(args))).rows[0].result;});}
async function test(){const db=await setup();for(const u of users)await db.query('insert into auth.users values ($1)',[u]);
const a=await rpc(db,users[0],'create_space',{nickname:'小花'});assert.equal(await rpc(db,users[1],'get_space'),null);
const b=await rpc(db,users[1],'join_space',{invite:a.invite_code,nickname:'小明'});assert.equal(Object.keys(b.state.members).length,2);
await assert.rejects(rpc(db,users[2],'join_space',{invite:a.invite_code,nickname:'路人'}),/ROOM_UNAVAILABLE/);
await assert.rejects(rpc(db,users[2],'save_space',{space_id:a.id,expected_version:2,new_state:{}}),/FORBIDDEN/);
const state={...b.state,cfg:{cats:[]},tx:[{amt:120}],members:{fake:'冒名'}};
const saved=await rpc(db,users[0],'save_space',{space_id:a.id,expected_version:2,new_state:state});assert.equal(saved.version,3);assert.equal(saved.state.members[users[0]],'小花');assert.equal(saved.state.members.fake,undefined);
await assert.rejects(rpc(db,users[1],'save_space',{space_id:a.id,expected_version:2,new_state:state}),/VERSION_CONFLICT/);
const renamed=await rpc(db,users[0],'update_nickname',{nickname:'  花花  ',expected_version:3});
assert.equal(renamed.version,4);assert.equal(renamed.state.members[users[0]],'花花');assert.equal(renamed.state.members[users[1]],'小明');assert.deepEqual(renamed.state.tx,saved.state.tx);
await assert.rejects(rpc(db,users[0],'update_nickname',{nickname:'不能覆寫',expected_version:3}),/VERSION_CONFLICT/);
for(const nickname of ['', '  ', '名'.repeat(31),null])await assert.rejects(rpc(db,users[0],'update_nickname',{nickname,expected_version:4}),/INVALID_NICKNAME/);
await assert.rejects(rpc(db,users[2],'update_nickname',{nickname:'路人',expected_version:4}),/FORBIDDEN/);
const partnerRenamed=await rpc(db,users[1],'update_nickname',{nickname:'明明',expected_version:4});assert.equal(partnerRenamed.state.members[users[0]],'花花');assert.equal(partnerRenamed.state.members[users[1]],'明明');
await assert.rejects(rpc(db,users[0],'save_space',{space_id:a.id,expected_version:4,new_state:state}),/VERSION_CONFLICT/);
// Existing installations can safely apply the isolated migration more than once.
await db.exec(fs.readFileSync(require('node:path').join(__dirname,'../supabase/account-management.sql'),'utf8'));
assert.equal((await rpc(db,users[0],'get_space')).state.members[users[0]],'花花');
await assert.rejects(as(db,users[0],()=>db.query('select * from public.couple_spaces')),/permission denied/);
await db.exec('set role anon');await assert.rejects(db.query('select public.get_space()'),/permission denied/);await assert.rejects(db.query("select public.update_nickname('匿名',5)"),/permission denied/);await db.exec('reset role');
console.log('PASS SQL: membership isolation, two-person limit, unauthorized writes, server-owned names, optimistic conflict, no direct table access, anonymous RPC denied');await db.close();}
module.exports={setup,users,rpc};if(require.main===module)test().catch(e=>{console.error(e);process.exit(1)});
