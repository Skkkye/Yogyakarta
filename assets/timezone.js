/* =============================================================
   timezone.js —— 隐藏页 timezone.html
   · 上海／日惹／巴黎／雷克雅未克互相换算，任意一栏可编辑，其余跟着重算
   · 「存住」某个时间点（比如「上海 14:00」）只记锚点城市 + 时:分，
     不记具体日期 —— 每次打开都按当天重新换算，巴黎的夏令时也跟着自动对
   · 24 小时时间轴：同一段 UTC 窗口下四地对齐着看谁醒着
   依赖：assets/site.js（用它的 esc() 和站内导航 PARTS.nav）
   ============================================================= */

const CITIES=[
  { id:"sh",  name:"上海",     country:"中国",   tz:"Asia/Shanghai" },
  { id:"yog", name:"日惹",     country:"印尼",   tz:"Asia/Jakarta" },
  { id:"par", name:"巴黎",     country:"法国",   tz:"Europe/Paris" },
  { id:"rey", name:"雷克雅未克", country:"冰岛",   tz:"Atlantic/Reykjavik" },
];
const WD_ZH=["周日","周一","周二","周三","周四","周五","周六"];
const WD_IDX={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};
const PIN_KEY="jogja.tzpins.v1";

let epoch=Date.now();
let tickHandle=null;
let lastEditedId="sh";

function getOffsetMinutes(date,tz){
  const dtf=new Intl.DateTimeFormat("en-US",{timeZone:tz,hourCycle:"h23",
    year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"});
  const p={}; dtf.formatToParts(date).forEach(x=>p[x.type]=x.value);
  const asUTC=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);
  return Math.round((asUTC-date.getTime())/60000);
}
function getAbbrev(date,tz){
  try{
    const part=new Intl.DateTimeFormat("en-US",{timeZone:tz,timeZoneName:"shortOffset",hour:"2-digit"})
      .formatToParts(date).find(x=>x.type==="timeZoneName");
    return part?part.value.replace("GMT","UTC"):"";
  }catch(e){ return ""; }
}
function zonedWallTimeToEpoch(y,mo,d,h,mi,tz){
  let guess=Date.UTC(y,mo-1,d,h,mi,0);
  for(let i=0;i<2;i++){
    const off=getOffsetMinutes(new Date(guess),tz);
    guess=Date.UTC(y,mo-1,d,h,mi,0)-off*60000;
  }
  return guess;
}
function partsInZone(date,tz){
  const dtf=new Intl.DateTimeFormat("en-US",{timeZone:tz,hourCycle:"h23",weekday:"short",
    year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"});
  const p={}; dtf.formatToParts(date).forEach(x=>p[x.type]=x.value);
  return p;
}
const toInputValue=p=>`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;

function loadPins(){
  try{ const raw=localStorage.getItem(PIN_KEY); const v=raw?JSON.parse(raw):[]; return Array.isArray(v)?v:[]; }
  catch(e){ return []; }
}
function savePins(list){ try{ localStorage.setItem(PIN_KEY,JSON.stringify(list)); }catch(e){} }
let pins=loadPins();

/* ---------- 四地对照卡片 ---------- */
const grid=document.getElementById("tzGrid");
const cardEls={};
CITIES.forEach(c=>{
  const card=document.createElement("div");
  card.className="panel tzcard";
  card.innerHTML=`
    <div class="city-row">
      <div><div class="city">${c.name}</div><div class="country">${c.country}</div></div>
      <span class="pill warn" data-role="badge"></span>
    </div>
    <input class="fxin" type="datetime-local" data-id="${c.id}">
    <div class="tzrow"><span class="tzdot" data-role="dot"></span><span data-role="weekday"></span></div>
  `;
  grid.appendChild(card);
  cardEls[c.id]={
    badge:card.querySelector('[data-role="badge"]'),
    input:card.querySelector("input"),
    dot:card.querySelector('[data-role="dot"]'),
    weekday:card.querySelector('[data-role="weekday"]'),
  };
  cardEls[c.id].input.addEventListener("input",e=>setEpochFromCity(c.id,e.target.value));
});

/* ---------- 24 小时时间轴 ---------- */
const tlWrap=document.getElementById("tzTimeline");
const trackEls={};
CITIES.forEach(c=>{
  const row=document.createElement("div");
  row.className="tztrack-row";
  row.innerHTML=`<span class="tzrow-label">${c.name}</span>
    <div class="tzline-wrap">
      <div class="tzline" data-role="line"></div>
      <div class="now" data-role="now"></div>
    </div>`;
  tlWrap.appendChild(row);
  const line=row.querySelector('[data-role="line"]');
  const segs=[];
  for(let h=0;h<24;h++){ const seg=document.createElement("div"); seg.className="seg"; line.appendChild(seg); segs.push(seg); }
  trackEls[c.id]={ segs, now:row.querySelector('[data-role="now"]') };
});
const axisRow=document.createElement("div");
axisRow.className="tztrack-row";
axisRow.innerHTML=`<span class="tzrow-label"></span><div class="tzaxis-track" id="tzAxisTrack"></div>`;
document.getElementById("tzAxis").appendChild(axisRow);
[0,3,6,9,12,15,18,21,24].forEach(h=>{
  const tick=document.createElement("span");
  tick.className="tzaxis-tick";
  tick.style.left=(h/24*100)+"%";
  tick.textContent=(h===24?24:h)+"时";
  document.getElementById("tzAxisTrack").appendChild(tick);
});

function render(){
  const refDate=new Date(epoch);
  const utcDayStart=Date.UTC(refDate.getUTCFullYear(),refDate.getUTCMonth(),refDate.getUTCDate());
  const utcHourFrac=(epoch-utcDayStart)/3600000;

  CITIES.forEach(c=>{
    const p=partsInZone(refDate,c.tz);
    const el=cardEls[c.id];
    if(document.activeElement!==el.input) el.input.value=toInputValue(p);
    el.badge.textContent=getAbbrev(refDate,c.tz);
    const localHour=+p.hour+(+p.minute)/60;
    const isDay=localHour>=6&&localHour<20;
    el.dot.className="tzdot "+(isDay?"tzdot-day":"tzdot-night");
    el.weekday.textContent=WD_ZH[WD_IDX[p.weekday]]+" · "+p.year+"-"+p.month+"-"+p.day;

    const offset=getOffsetMinutes(refDate,c.tz);
    const track=trackEls[c.id];
    for(let h=0;h<24;h++){
      const localH=(((h*60+offset)/60)%24+24)%24;
      track.segs[h].style.background=
        localH>=8&&localH<18 ? "var(--warn)" :
        (localH>=6&&localH<8)||(localH>=18&&localH<20) ? "var(--warn-soft)" : "var(--surface-2)";
    }
    track.now.style.left=(utcHourFrac/24*100)+"%";
  });

  renderPins();
}

function setEpochFromCity(id,value){
  if(!value) return;
  lastEditedId=id;
  const c=CITIES.find(x=>x.id===id);
  const [dp,tp]=value.split("T");
  const [y,mo,d]=dp.split("-").map(Number);
  const [h,mi]=tp.split(":").map(Number);
  epoch=zonedWallTimeToEpoch(y,mo,d,h,mi,c.tz);
  stopTicking();
  render();
}
function stopTicking(){ if(tickHandle){ clearInterval(tickHandle); tickHandle=null; } }
function startTicking(){ stopTicking(); tickHandle=setInterval(()=>{ epoch=Date.now(); render(); },1000); }

document.getElementById("nowBtn").addEventListener("click",()=>{
  epoch=Date.now();
  render();
  startTicking();
});

/* ---------- 常用时间：只存锚点城市 + 时:分，每次打开按当天重算 ---------- */
function pinEpochForToday(pin){
  const c=CITIES.find(x=>x.id===pin.anchorId)||CITIES[0];
  const tp=partsInZone(new Date(),c.tz);
  return zonedWallTimeToEpoch(+tp.year,+tp.month,+tp.day,pin.hour,pin.minute,c.tz);
}
function renderPins(){
  const list=document.getElementById("pinList");
  if(!list) return;
  list.innerHTML="";

  if(pins.length===0){
    const empty=document.createElement("p");
    empty.className="hint";
    empty.textContent="还没存过 —— 先在上面设好时间，再点「存住当前时间」。";
    list.appendChild(empty);
    return;
  }

  pins.forEach(pin=>{
    const anchor=CITIES.find(x=>x.id===pin.anchorId)||CITIES[0];
    const pe=pinEpochForToday(pin);
    const ap=partsInZone(new Date(pe),anchor.tz);
    const anchorDay=Date.UTC(+ap.year,+ap.month-1,+ap.day);

    const chips=CITIES.map(c=>{
      const p=partsInZone(new Date(pe),c.tz);
      const dayUTC=Date.UTC(+p.year,+p.month-1,+p.day);
      const diff=Math.round((dayUTC-anchorDay)/86400000);
      const delta=diff>0?` +${diff}天`:(diff<0?` ${diff}天`:"");
      const cls=c.id===pin.anchorId?"pill ink":"pill txt";
      return `<span class="${cls}">${c.name} ${p.hour}:${p.minute}${delta}</span>`;
    }).join("");

    const row=document.createElement("div");
    row.className="panel tzpin";
    row.innerHTML=`
      <div class="pin-main">
        <div class="pin-title">${esc(pin.label)}</div>
        <div class="chips">${chips}</div>
      </div>
      <div class="actions">
        <button type="button" data-act="load">载入</button>
        <button type="button" data-act="del">删除</button>
      </div>`;
    row.querySelector('[data-act="load"]').addEventListener("click",()=>{
      lastEditedId=pin.anchorId;
      stopTicking();
      epoch=pinEpochForToday(pin);
      render();
    });
    row.querySelector('[data-act="del"]').addEventListener("click",()=>{
      pins=pins.filter(p=>p.id!==pin.id);
      savePins(pins);
      renderPins();
    });
    list.appendChild(row);
  });
}

document.getElementById("pinBtn").addEventListener("click",()=>{
  const anchor=CITIES.find(c=>c.id===lastEditedId)||CITIES[0];
  const p=partsInZone(new Date(epoch),anchor.tz);
  const labelInput=document.getElementById("pinLabel");
  const label=labelInput.value.trim()||`${anchor.name} ${p.hour}:${p.minute}`;
  pins.push({
    id:"p"+Date.now().toString(36)+Math.random().toString(36).slice(2,7),
    label, anchorId:anchor.id, hour:+p.hour, minute:+p.minute,
  });
  savePins(pins);
  labelInput.value="";
  renderPins();
});
document.getElementById("pinLabel").addEventListener("keydown",e=>{
  if(e.key==="Enter") document.getElementById("pinBtn").click();
});

render();
startTicking();
