const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto'),url=require('url');
const ROOT=__dirname, DB=path.join(ROOT,'data/db.json'); const sessions=new Map();
const ADMIN_USER=process.env.ADMIN_USER||'admin'; const ADMIN_HASH=process.env.ADMIN_PASSWORD_SHA256||crypto.createHash('sha256').update('ChangeMe123!').digest('hex');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript','.json':'application/json'};
function db(){return JSON.parse(fs.readFileSync(DB,'utf8'))} function save(x){fs.writeFileSync(DB,JSON.stringify(x,null,2))}
function json(res,s,o){res.writeHead(s,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(o))}
function cookie(req,n){let m=(req.headers.cookie||'').match(new RegExp('(?:^|; )'+n+'=([^;]+)'));return m&&decodeURIComponent(m[1])}
function auth(req){let s=sessions.get(cookie(req,'sid'));return s}
function body(req){return new Promise((ok,bad)=>{let x='';req.on('data',c=>{x+=c;if(x.length>1e6)bad(Error('body too large'))});req.on('end',()=>{try{ok(JSON.parse(x||'{}'))}catch(e){bad(e)}})})}
function csrfOK(req,b){return auth(req)&&b.csrf&&b.csrf===auth(req).csrf}
function sendFile(res,file){if(!fs.existsSync(file))return json(res,404,{message:'غير موجود'});res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'text/plain'});fs.createReadStream(file).pipe(res)}
const server=http.createServer(async(req,res)=>{
 try{
  const u=new URL(req.url,'http://localhost'); const p=u.pathname;
  if(p==='/api/login'&&req.method==='POST'){let b=await body(req);let h=crypto.createHash('sha256').update(String(b.password||'')).digest('hex');if(b.username!==ADMIN_USER||!crypto.timingSafeEqual(Buffer.from(h),Buffer.from(ADMIN_HASH)))return json(res,401,{message:'بيانات الدخول غير صحيحة'});let sid=crypto.randomBytes(32).toString('hex'),csrf=crypto.randomBytes(24).toString('hex');sessions.set(sid,{csrf,created:Date.now()});res.setHeader('Set-Cookie',`sid=${sid}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`);return json(res,200,{csrf})}
  if(p==='/api/logout'&&req.method==='POST'){sessions.delete(cookie(req,'sid'));res.setHeader('Set-Cookie','sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return json(res,200,{ok:true})}
  if(p==='/api/doctors'&&req.method==='GET')return json(res,200,db().doctors);
  if(p==='/api/bookings'&&req.method==='POST'){let b=await body(req);if(!b.name||!b.phone||!b.date)return json(res,400,{message:'يرجى إكمال البيانات المطلوبة'});let d=db(),id='ZNT-'+Date.now().toString().slice(-8);d.bookings.unshift({id,name:String(b.name).slice(0,80),phone:String(b.phone).slice(0,20),service:String(b.service||'').slice(0,50),date:String(b.date).slice(0,20),status:'جديد',createdAt:new Date().toISOString()});save(d);return json(res,201,{id,message:'تم تسجيل طلب الحجز'})}
  if(p.startsWith('/api/admin/')){if(!auth(req))return json(res,401,{message:'تسجيل الدخول مطلوب'});if(req.method!=='GET'){let b=await body(req);if(!csrfOK(req,b))return json(res,403,{message:'CSRF token غير صالح'})}
    if(p==='/api/admin/me')return json(res,200,{csrf:auth(req).csrf,user:ADMIN_USER});
    if(p==='/api/admin/bookings'&&req.method==='GET')return json(res,200,db().bookings);
    if(p==='/api/admin/bookings/status'&&req.method==='POST'){let b=await body(req),d=db(),x=d.bookings.find(v=>v.id===b.id);if(!x)return json(res,404,{message:'الحجز غير موجود'});x.status=String(b.status).slice(0,30);save(d);return json(res,200,{ok:true})}

    if(p==='/api/admin/services'&&req.method==='GET')return json(res,200,db().services||[]);
    if(p==='/api/admin/services'&&req.method==='POST'){let b=await body(req),d=db();if(!b.title)return json(res,400,{message:'عنوان الخدمة مطلوب'});let x={id:String(b.id||Date.now()),title:String(b.title).slice(0,80),description:String(b.description||'').slice(0,300),active:b.active!==false};let i=d.services.findIndex(v=>v.id===x.id);if(i>=0)d.services[i]=x;else d.services.push(x);save(d);return json(res,200,{ok:true})}
    if(p==='/api/admin/news'&&req.method==='GET')return json(res,200,db().news||[]);
    if(p==='/api/admin/news'&&req.method==='POST'){let b=await body(req),d=db();if(!b.title)return json(res,400,{message:'عنوان الإعلان مطلوب'});let x={id:Number(b.id||Date.now()),title:String(b.title).slice(0,120),body:String(b.body||'').slice(0,500),active:b.active!==false};let i=d.news.findIndex(v=>v.id===x.id);if(i>=0)d.news[i]=x;else d.news.unshift(x);save(d);return json(res,200,{ok:true})}
    if(p==='/api/admin/stats'&&req.method==='GET')return json(res,200,db().stats||{});
    if(p==='/api/admin/stats'&&req.method==='POST'){let b=await body(req),d=db();for(const k of ['year','root','conservative','gum','extraction','opg'])if(b[k]!==undefined)d.stats[k]=Math.max(0,Number(b[k])||0);save(d);return json(res,200,{ok:true})}
    if(p==='/api/admin/doctors'&&req.method==='GET')return json(res,200,db().doctors);
    if(p==='/api/admin/doctors'&&req.method==='POST'){let b=await body(req),d=db();if(!b.day||!Array.isArray(b.doctors))return json(res,400,{message:'بيانات غير صالحة'});let x=d.doctors.find(v=>v.day===b.day);if(x){x.doctors=b.doctors.map(String);x.radiology=String(b.radiology||'')}else d.doctors.push({day:String(b.day),doctors:b.doctors.map(String),radiology:String(b.radiology||'')});save(d);return json(res,200,{ok:true})}
  }
  if(p==='/api/services'&&req.method==='GET')return json(res,200,db().services||[]);
  if(p==='/api/news'&&req.method==='GET')return json(res,200,db().news||[]);
  if(p==='/api/stats'&&req.method==='GET')return json(res,200,db().stats||{});
  let file=p==='/ '?'/public/index.html':p; if(p==='/')file='/public/index.html'; else if(p==='/admin/'||p==='/admin')file='/admin/index.html'; else if(p.startsWith('/admin/'))file=p; else if(p.startsWith('/public/'))file=p; else file='/public'+p;
  return sendFile(res,path.join(ROOT,file))
 }catch(e){json(res,500,{message:'خطأ في الخادم'})}
});
server.listen(process.env.PORT||3000,()=>console.log('Portal V4 running on port '+(process.env.PORT||3000)));