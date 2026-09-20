require('dotenv').config();
const express=require('express');
const path=require('path');
const crypto=require('crypto');
const bcrypt=require('bcrypt');
const helmet=require('helmet');
const rateLimit=require('express-rate-limit');
const cookieParser=require('cookie-parser');
const {Pool}=require('pg');

const app=express();
const pool=new Pool({connectionString:process.env.DATABASE_URL});
const sessions=new Map();
const SESSION_TTL=8*60*60*1000;

app.use(helmet({contentSecurityPolicy:false}));
app.use(express.json({limit:'100kb'}));
app.use(cookieParser());
app.use(rateLimit({windowMs:15*60*1000,max:300,standardHeaders:true,legacyHeaders:false}));
app.use(express.static(path.join(__dirname,'public')));

function makeToken(){return crypto.randomBytes(32).toString('hex')}
function currentSession(req){const id=req.cookies.sid,s=id&&sessions.get(id);if(!s)return null;if(Date.now()-s.created>SESSION_TTL){sessions.delete(id);return null}return s}
function requireAuth(req,res,next){const s=currentSession(req);if(!s)return res.status(401).json({message:'تسجيل الدخول مطلوب'});req.session=s;next()}
function requireRole(...roles){return (req,res,next)=>roles.includes(req.session.role)?next():res.status(403).json({message:'ليست لديك صلاحية لهذه العملية'})}
async function audit(s,action,type,id,req){await pool.query('INSERT INTO audit_log(user_id,action,entity_type,entity_id,ip_address) VALUES($1,$2,$3,$4,$5)',[s.userId,action,type,id,req.ip])}

app.get('/api/health',async(req,res)=>{try{await pool.query('SELECT 1');res.json({ok:true})}catch{res.status(503).json({ok:false})}});

app.post('/api/auth/login',async(req,res)=>{
 const {username,password}=req.body||{};
 if(!username||!password)return res.status(400).json({message:'أدخل اسم المستخدم وكلمة المرور'});
 const q=await pool.query('SELECT id,username,password_hash,role,active FROM users WHERE username=$1',[username]);
 const u=q.rows[0];
 if(!u||!u.active||!(await bcrypt.compare(password,u.password_hash)))return res.status(401).json({message:'بيانات الدخول غير صحيحة'});
 const sid=makeToken(),csrf=makeToken();
 sessions.set(sid,{userId:u.id,username:u.username,role:u.role,csrf,created:Date.now()});
 res.cookie('sid',sid,{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',maxAge:SESSION_TTL});
 res.json({user:{username:u.username,role:u.role},csrf});
});
app.post('/api/auth/logout',requireAuth,(req,res)=>{for(const [k,v] of sessions)if(v===req.session)sessions.delete(k);res.clearCookie('sid');res.json({ok:true})});
app.get('/api/auth/me',requireAuth,(req,res)=>res.json({user:{username:req.session.username,role:req.session.role},csrf:req.session.csrf}));

function csrf(req,res,next){if(req.method==='GET')return next();if(req.get('x-csrf-token')!==req.session.csrf)return res.status(403).json({message:'رمز الحماية غير صالح'});next()}

app.get('/api/services',async(req,res)=>{try{const q=await pool.query('SELECT id,title,description FROM services WHERE active=true ORDER BY title');res.json(q.rows)}catch{res.status(500).json({message:'تعذر تحميل الخدمات'})}});
app.get('/api/doctors',async(req,res)=>{try{
 const q=await pool.query(`SELECT id,name,specialty FROM doctors WHERE active=true ORDER BY name`);
 res.json(q.rows)
}catch{res.status(500).json({message:'تعذر تحميل الأطباء'})}});

app.get('/api/news',async(req,res)=>{try{
 const q=await pool.query('SELECT id,title,body,published_at FROM announcements WHERE active=true ORDER BY published_at DESC LIMIT 20');
 res.json(q.rows)
}catch{res.status(500).json({message:'تعذر تحميل الإعلانات'})}});

app.get('/api/statistics',async(req,res)=>{try{
 const q=await pool.query('SELECT year,root_canal,conservative,gum,extraction,opg FROM statistics ORDER BY year DESC');
 res.json(q.rows)
}catch{res.status(500).json({message:'تعذر تحميل الإحصائيات'})}});

app.get('/api/doctor-schedule/:id',async(req,res)=>{try{
 const q=await pool.query(`SELECT weekday,to_char(start_time,'HH24:MI') start_time,to_char(end_time,'HH24:MI') end_time
 FROM schedules WHERE doctor_id=$1 ORDER BY weekday,start_time`,[req.params.id]);
 res.json(q.rows)
}catch{res.status(500).json({message:'تعذر تحميل جدول الطبيب'})}});
app.get('/api/availability',async(req,res)=>{
 const {doctor_id,date}=req.query;
 if(!doctor_id||!date)return res.status(400).json({message:'الطبيب والتاريخ مطلوبان'});
 const q=await pool.query(`SELECT to_char(s.start_time,'HH24:MI') AS time
   FROM schedules s WHERE s.doctor_id=$1
   AND s.weekday=EXTRACT(DOW FROM $2::date)::int
   AND $2::date >= CURRENT_DATE
   AND NOT EXISTS(SELECT 1 FROM bookings b WHERE b.doctor_id=$1 AND b.appointment_date=$2::date
     AND b.appointment_time=s.start_time AND b.status IN ('new','confirmed'))
   ORDER BY s.start_time`,[doctor_id,date]);
 res.json(q.rows.map(x=>x.time));
});
app.post('/api/bookings',async(req,res)=>{
 const {patient_name,phone,service_id,doctor_id,appointment_date,appointment_time,notes}=req.body||{};
 if(!patient_name||!phone||!appointment_date||!appointment_time)return res.status(400).json({message:'يرجى إكمال بيانات الحجز'});
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  const slot=await client.query(`SELECT 1 FROM schedules WHERE doctor_id=$1 AND weekday=EXTRACT(DOW FROM $2::date)::int AND start_time=$3`,[doctor_id,appointment_date,appointment_time]);
  if(!slot.rowCount){await client.query('ROLLBACK');return res.status(400).json({message:'الموعد غير متاح ضمن جدول الطبيب'})}
  const bookingNumber='ZNT-'+Date.now().toString().slice(-9);
  const q=await client.query(`INSERT INTO bookings(booking_number,patient_name,phone,service_id,doctor_id,appointment_date,appointment_time,notes)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING booking_number`,[bookingNumber,String(patient_name).slice(0,120),String(phone).slice(0,30),service_id||null,doctor_id||null,appointment_date,appointment_time,String(notes||'').slice(0,1000)]);
  await client.query('COMMIT');res.status(201).json({message:'تم تسجيل طلب الحجز',booking_number:q.rows[0].booking_number});
 }catch(e){await client.query('ROLLBACK');if(e.code==='23505')return res.status(409).json({message:'هذا الموعد محجوز بالفعل'});res.status(500).json({message:'تعذر تسجيل الحجز'})}finally{client.release()}
});

app.use('/api/admin',requireAuth,csrf);
app.get('/api/admin/bookings',requireRole('admin','medical_affairs','reception'),async(req,res)=>{
 const q=await pool.query(`SELECT b.booking_number,b.patient_name,b.phone,b.appointment_date,b.appointment_time,b.status,
 s.title service,d.name doctor FROM bookings b LEFT JOIN services s ON s.id=b.service_id LEFT JOIN doctors d ON d.id=b.doctor_id ORDER BY b.created_at DESC LIMIT 500`);res.json(q.rows)
});
app.patch('/api/admin/bookings/:id',requireRole('admin','medical_affairs','reception'),async(req,res)=>{
 const allowed=['new','confirmed','completed','cancelled'];if(!allowed.includes(req.body.status))return res.status(400).json({message:'حالة غير صالحة'});
 await pool.query('UPDATE bookings SET status=$1 WHERE booking_number=$2',[req.body.status,req.params.id]);await audit(req.session,'booking_status','booking',req.params.id,req);res.json({ok:true})
});
app.get('/api/admin/services',requireRole('admin','medical_affairs'),async(req,res)=>res.json((await pool.query('SELECT * FROM services ORDER BY title')).rows));
app.post('/api/admin/services',requireRole('admin','medical_affairs'),async(req,res)=>{
 const {id,title,description,active=true}=req.body||{};if(!title)return res.status(400).json({message:'اسم الخدمة مطلوب'});
 if(id)await pool.query('UPDATE services SET title=$1,description=$2,active=$3 WHERE id=$4',[title,description||'',active,id]);
 else await pool.query('INSERT INTO services(title,description,active) VALUES($1,$2,$3)',[title,description||'',active]);
 res.json({ok:true})
});
app.get('/api/admin/announcements',requireRole('admin','medical_affairs'),async(req,res)=>res.json((await pool.query('SELECT * FROM announcements ORDER BY published_at DESC')).rows));
app.post('/api/admin/announcements',requireRole('admin','medical_affairs'),async(req,res)=>{
 const {title,body,active=true}=req.body||{};if(!title||!body)return res.status(400).json({message:'العنوان والنص مطلوبان'});
 await pool.query('INSERT INTO announcements(title,body,active) VALUES($1,$2,$3)',[title,body,active]);res.json({ok:true})
});
app.get('/api/admin/stats',requireRole('admin','medical_affairs'),async(req,res)=>res.json((await pool.query('SELECT * FROM statistics ORDER BY year DESC')).rows));
app.put('/api/admin/stats/:year',requireRole('admin','medical_affairs'),async(req,res)=>{
 const v=req.body||{};await pool.query(`INSERT INTO statistics(year,root_canal,conservative,gum,extraction,opg) VALUES($1,$2,$3,$4,$5,$6)
 ON CONFLICT(year) DO UPDATE SET root_canal=EXCLUDED.root_canal,conservative=EXCLUDED.conservative,gum=EXCLUDED.gum,extraction=EXCLUDED.extraction,opg=EXCLUDED.opg`,
 [req.params.year,Number(v.root_canal)||0,Number(v.conservative)||0,Number(v.gum)||0,Number(v.extraction)||0,Number(v.opg)||0]);res.json({ok:true})
});


app.get('/api/admin/today',requireRole('admin','medical_affairs','reception'),async(req,res)=>{
 const q=await pool.query(`SELECT b.booking_number,b.patient_name,b.phone,b.appointment_date,b.appointment_time,b.status,
 s.title service,d.name doctor FROM bookings b LEFT JOIN services s ON s.id=b.service_id
 LEFT JOIN doctors d ON d.id=b.doctor_id WHERE b.appointment_date=CURRENT_DATE ORDER BY b.appointment_time`);
 res.json(q.rows);
});
app.get('/api/admin/schedules/:doctorId',requireRole('admin','medical_affairs'),async(req,res)=>{
 const q=await pool.query(`SELECT id,weekday,to_char(start_time,'HH24:MI') start_time,to_char(end_time,'HH24:MI') end_time
 FROM schedules WHERE doctor_id=$1 ORDER BY weekday,start_time`,[req.params.doctorId]);res.json(q.rows);
});
app.post('/api/admin/schedules',requireRole('admin','medical_affairs'),async(req,res)=>{
 const {doctor_id,weekday,start_time,end_time}=req.body||{};
 if(doctor_id==null||weekday==null||!start_time||!end_time)return res.status(400).json({message:'بيانات الدوام ناقصة'});
 await pool.query(`INSERT INTO schedules(doctor_id,weekday,start_time,end_time) VALUES($1,$2,$3,$4)`,[doctor_id,weekday,start_time,end_time]);
 await audit(req.session,'schedule_create','schedule',doctor_id,req);res.json({ok:true});
});
app.delete('/api/admin/schedules/:id',requireRole('admin','medical_affairs'),async(req,res)=>{
 await pool.query('DELETE FROM schedules WHERE id=$1',[req.params.id]);await audit(req.session,'schedule_delete','schedule',req.params.id,req);res.json({ok:true});
});

app.use('/admin',express.static(path.join(__dirname,'admin')));
app.get('/admin',(req,res)=>res.sendFile(path.join(__dirname,'admin/index.html')));
app.listen(process.env.PORT||3000,()=>console.log('V7 production server started'));
