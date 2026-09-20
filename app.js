async function getJSON(url,opt){const r=await fetch(url,opt);const j=await r.json();if(!r.ok)throw new Error(j.message||'حدث خطأ');return j}
async function load(){try{const d=await getJSON('/api/doctors');document.querySelector('#schedule').innerHTML=d.map(x=>`<div class="day"><h3>${x.day}</h3><p>${x.doctors.join(' · ')}</p><p><b>الأشعة:</b> ${x.radiology}</p></div>`).join('')}catch(e){document.querySelector('#schedule').innerHTML='<div class="day">تعذر تحميل الجدول.</div>'}}load();
document.querySelector('#form').addEventListener('submit',async e=>{e.preventDefault();const msg=document.querySelector('#msg');try{const j=await getJSON('/api/bookings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});msg.textContent='تم تسجيل الطلب بنجاح. رقم الحجز: '+j.id;e.target.reset()}catch(err){msg.textContent=err.message}});
async function loadContent(){
 try{
  const [services,news,stats]=await Promise.all([getJSON('/api/services'),getJSON('/api/news'),getJSON('/api/stats')]);
  const svc=document.querySelector('#services .grid'); if(svc) svc.innerHTML=services.filter(x=>x.active).map(x=>`<article>🦷<h3>${x.title}</h3><p>${x.description}</p></article>`).join('');
  const n=document.createElement('section'); n.className='section'; n.id='news'; n.innerHTML=`<div class="wrap"><h2>آخر الإعلانات</h2><div class="grid">${news.filter(x=>x.active).map(x=>`<article><h3>${x.title}</h3><p>${x.body}</p></article>`).join('')}</div></div>`; document.querySelector('#booking').before(n);
  const vals=[stats.root,stats.conservative,stats.gum,stats.extraction,stats.opg]; document.querySelectorAll('.statgrid b').forEach((e,i)=>{if(vals[i]!=null)e.innerHTML=Number(vals[i]).toLocaleString('en-US')+e.querySelector('small').outerHTML});
 }catch(e){}
} loadContent();
