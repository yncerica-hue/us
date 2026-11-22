import { createClient } from '@supabase/supabase-js';

const el=(tag,text,attrs={})=>Object.assign(document.createElement(tag),attrs,text==null?{}:{textContent:text});
export async function startCloud({onReady,onUpdate,idle}){
 const root=document.querySelector('#cloud'),app=document.querySelector('#app'),nav=document.querySelector('#nav');
 const note=el('p','連線中…',{className:'mute',role:'status'});
 const url=import.meta.env.VITE_SUPABASE_URL,key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key){root.append(el('p','缺少 Supabase 設定，請依 README 設定後重新建置。'));return;}
 const client=createClient(url,key,{global:{fetch:(input,options={})=>fetch(input,{...options,signal:options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)})}});
 let user,room,version,timer,busy=false;
 const errorText=e=>{
  if(e.code==='PGRST202'||e.code==='42P01')return '資料庫尚未初始化，請在 Supabase SQL Editor 執行 supabase/schema.sql。';
  if(e.message?.includes('VERSION_CONFLICT'))return '另一位成員已更新資料。為避免覆蓋，請下載這次的內容後重新載入，再補上變更。';
  if(e.message?.includes('ROOM_UNAVAILABLE'))return '邀請碼無效或空間已滿。';
  if(e.message?.includes('Invalid login credentials'))return 'Email 或密碼不正確，或信箱尚未驗證。';
  return '操作失敗：'+(e.message||'請檢查網路後再試。');
 };
 async function rpc(name,args){const {data,error}=await client.rpc(name,args);if(error)throw error;return data;}
 const button=(text,fn)=>{const b=el('button',text,{className:'btn',type:'button'});b.onclick=()=>run(fn);return b;};
 async function run(fn){if(busy)return;busy=true;root.querySelectorAll('button').forEach(b=>b.disabled=true);note.textContent='處理中…';try{await fn();}catch(e){note.textContent=errorText(e);}finally{busy=false;root.querySelectorAll('button').forEach(b=>b.disabled=false);}}
 function shell(title){root.replaceChildren(el('h1',title),note);}
 function input(label,type='text'){const wrap=el('label',label),i=el('input',null,{type,required:true});wrap.style.display='block';wrap.style.margin='10px 0';wrap.append(i);return [wrap,i];}
 function backup(data){const a=el('a','下載未儲存的資料');const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const u=URL.createObjectURL(blob);a.href=u;a.download='我們的小日子-未儲存備份.json';root.append(a);a.onclick=()=>setTimeout(()=>URL.revokeObjectURL(u),1000);}
 function authScreen(){
  app.hidden=nav.hidden=true;shell('💞 我們的小日子');note.textContent='登入後與另一半共用記帳、行程和願望。';
  const form=el('form'),[ew,email]=input('Email','email'),[pw,password]=input('密碼（至少 8 個字元）','password');
  email.autocomplete='email';password.autocomplete='current-password';password.minLength=8;
  const login=button('登入',()=>authenticate(false)),signup=button('註冊帳號',()=>authenticate(true));
  form.append(ew,pw,login,document.createTextNode(' '),signup);root.append(form);
  form.onsubmit=e=>{e.preventDefault();run(()=>authenticate(false));};
  async function authenticate(signup){
   if(!form.reportValidity())return;
   const credentials={email:email.value.trim(),password:password.value};
   const {data,error}=signup?await client.auth.signUp(credentials):await client.auth.signInWithPassword(credentials);
   if(error)throw error;
   if(data.session){user=data.session.user;await loadRoom();}
   else note.textContent='註冊完成，請到信箱點驗證連結，再回到這裡登入。';
  }
 }
 function accountBar(){root.append(el('div',user.email,{className:'mute'}),button('登出',async()=>{if(!idle()&&room)throw Error('請先處理尚未儲存的內容再登出。');const {error}=await client.auth.signOut();if(error)throw error;location.reload();}));}
 function roomScreen(){
  shell('建立你們的小空間');note.textContent='先填暱稱，建立空間或輸入另一半給你的邀請碼。每個帳號只能加入一個空間。';
  const form=el('form'),[nw,nick]=input('你的暱稱'),[cw,code]=input('邀請碼（加入時填寫）');code.required=false;nick.maxLength=30;code.autocomplete='off';
  form.append(nw,cw,button('建立空間',async()=>{if(!form.reportValidity())return;await rpc('create_space',{nickname:nick.value.trim()});await loadRoom();}),document.createTextNode(' '),button('加入空間',async()=>{if(!form.reportValidity()||!code.value.trim())throw Error('請填寫暱稱與邀請碼。');await rpc('join_space',{invite:code.value.trim(),nickname:nick.value.trim()});await loadRoom();}));
  form.onsubmit=e=>e.preventDefault();root.append(form);accountBar();
 }
 async function loadRoom(){
  clearInterval(timer);const data=await rpc('get_space',{});
  if(!data){room=null;roomScreen();return;}
  room=data.id;version=data.version;shell('💞 雲端共用空間');note.textContent='已載入雲端資料';
  const invite=el('input',null,{value:data.invite_code,readOnly:true,'ariaLabel':'雙人邀請碼'});
  root.append(el('p','邀請碼（只分享給另一半）：',{className:'mute'}),invite);accountBar();
  app.hidden=nav.hidden=false;
  onReady(user.id,{
   status(text){note.textContent=text;},
   async set(state){const result=await rpc('save_space',{space_id:room,expected_version:version,new_state:state});version=result.version;},
   failed(state,e){note.textContent=errorText(e)+' 本次修改尚未存入雲端。';backup(state);root.append(button('重新載入雲端資料',()=>{if(confirm('確定重新載入？未儲存修改將捨棄，請先下載備份。'))location.reload();}));}
  },data.state);
  timer=setInterval(async()=>{
   if(!idle()||busy||document.hidden)return;
   const polledVersion=version;
   try{const next=await rpc('get_space',{});if(!idle()||version!==polledVersion)return;if(!next||next.id!==room)throw Error('空間已變更，請重新登入。');if(next.version!==version){version=next.version;onUpdate(next.state);}note.textContent='已與雲端核對';}
   catch(e){note.textContent=errorText(e)+' 尚未取得最新資料。';}
  },5000);
 }
 shell('💞 我們的小日子');
 try{const {data,error}=await client.auth.getSession();if(error)throw error;if(data.session){user=data.session.user;await loadRoom();}else authScreen();}
 catch(e){note.textContent=errorText(e);root.append(button('重試',()=>location.reload()));}
 client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'&&user){clearInterval(timer);user=null;room=null;authScreen();}});
}
