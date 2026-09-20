const $=id=>document.getElementById(id);
const state={services:[],doctors:[]};
async function get(url){let r=await fetch(url),j=await r.json();if(!r.ok)throw Error(j.message||'تعذر تحميل البيانات');return j}
async function init(){
 try{
  state.services=await get('/api/services'); state.doctors=await get('/api/doctors');
  $('service_id').innerHTML='<option value="">اختر الخدمة</option>'+state.services.map(x=>`<option value="${x.id}">${esc(x.title)}</option>`).join('');
  $('doctor_id').innerHTML='<option value="">اختر الطبيب</option>'+state.doctors.map(x=>`<option value="${x.id}">${esc(x.name)}${x.specialty?' — '+esc(x.specialty):''}</option>`).join('');
  $('serviceCards').innerHTML=state.services.map(x=>`<div class="service"><b>🦷 ${esc(x.title)}</b><p>${esc(x.description||'')}</p></div>`).join('')||'<p>لا توجد خدمات منشورة حاليًا.</p>';
  $('doctorCards').innerHTML=state.doctors.map(x=>`<div class="doctor"><b>د. ${esc(x.name)}</b><span>${esc(x.specialty||'طب أسنان')}</span></div>`).join('')||'<p>لا توجد بيانات.</p>';
  let d=new Date(); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); $('appointment_date').min=d.toISOString().slice(0,10);
 }catch(e){$('msg').textContent=e.message;$('msg').className='error'}
}
async function availability(){
 if(!$('doctor_id').value||!$('appointment_date').value)return;
 try{let q=new URLSearchParams({doctor_id:$('doctor_id').value,date:$('appointment_date').value});let times=await get('/api/availability?'+q);
 $('appointment_time').innerHTML=times.length?'<option value="">اختر الوقت</option>'+times.map(t=>`<option value="${t}">${t}</option>`).join(''):'<option value="">لا توجد أوقات متاحة لهذا اليوم</option>';
 }catch(e){$('appointment_time').innerHTML='<option value="">تعذر تحميل الأوقات</option>'}
}
$('doctor_id').addEventListener('change',availability);$('appointment_date').addEventListener('change',availability);
$('bookingForm').addEventListener('submit',async e=>{
 e.preventDefault();$('msg').textContent='جاري تسجيل الحجز...';$('msg').className='';
 let body={patient_name:$('patient_name').value.trim(),phone:$('phone').value.trim(),service_id:$('service_id').value,doctor_id:$('doctor_id').value,appointment_date:$('appointment_date').value,appointment_time:$('appointment_time').value,notes:$('notes').value.trim()};
 try{let r=await fetch('/api/bookings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});let j=await r.json();if(!r.ok)throw Error(j.message||'تعذر الحجز');$('bookingNo').textContent=j.booking_number;$('booking').hidden=true;$('confirmation').hidden=false;window.scrollTo({top:0,behavior:'smooth'});}
 catch(err){$('msg').textContent=err.message;$('msg').className='error'}
});
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
init();
