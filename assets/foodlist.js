/* =============================================================
   foodlist.js —— 美食清单页（food.html）：筛选、排序、搜索
   卡片由 food.js 的 FUI.card 生成，这里不拼卡片 HTML。
   ============================================================= */

const $=id=>document.getElementById(id);
const scamRank={"低":0,"中":1,"高":2};
/* 「条件」一行：一个开关一条判断。9/28 是这次行程唯一的周一 */
const FLAGS=[
  ["只看本地菜",d=>d.local],
  ["周一营业（9/28）",d=>opensOn(d,"周一")],
  ["07:00 前开门",d=>d.ot<=700],
  ["22:00 后还开",d=>d.ct>=2200],
  ["素食友好",d=>d.veg],
  ["低踩坑风险",d=>d.scam==="低"]
];
const state={meal:new Set(),area:new Set(),kind:new Set(),tag:new Set(),flag:new Set(),q:"",sort:"total",origin:"",radius:0};

/* 「附近」的起点：只列这次真的会停留的地方 —— 住处 + 行程里那 10 个点，
   顺序和分组按 plan.html 的 D1–D4（景点清单里另外那 20 多个这趟不去，列出来只会碍事）。
   坐标从 spots.js 按 slug 取，多点景点（Mendut 那种）取第一处。改行程就改这张表。 */
const HOME={k:"hotel",n:"酒店",full:"酒店 Marriott（北环路·Pakuwon 旁）",geo:[-7.761629,110.398477],grp:"住处"};
const PLAN=[
  ["taman-sari-water-castle","D1 9/28"],["kotagede","D1 9/28"],
  ["borobudur-sunrise-manohara","D2 9/29"],["bukit-rhema","D2 9/29"],
  ["candi-prambanan","D2 9/29"],["jalan-malioboro","D2 9/29"],
  ["goa-jomblang","D3 9/30"],["bukit-klangon","D3 9/30"],
  ["keraton-ngayogyakarta","D4 10/1"],["pasar-beringharjo","D4 10/1"]
];
const ORIGINS=[HOME].concat(
  typeof SPOTS==="undefined"?[]:PLAN.map(([k,day])=>{
    const x=SPOTS.find(y=>slugOf(y)===k);
    if(!x||!Array.isArray(x.geo)||!x.geo.length) return null;
    return {k,n:x.n,full:x.n,geo:Array.isArray(x.geo[0])?x.geo[0]:x.geo,grp:day};
  }).filter(Boolean));
const originOf=k=>ORIGINS.find(o=>o.k===k)||null;

const STATE_KEY="jogja.food";
function saveState(){
  try{
    sessionStorage.setItem(STATE_KEY,JSON.stringify({
      meal:[...state.meal],area:[...state.area],kind:[...state.kind],tag:[...state.tag],flag:[...state.flag],
      q:state.q,sort:state.sort,origin:state.origin,radius:state.radius
    }));
  }catch(e){}
}
function loadState(){
  try{
    const o=JSON.parse(sessionStorage.getItem(STATE_KEY)||"null"); if(!o) return;
    ["meal","area","kind","tag","flag"].forEach(k=>{ state[k]=new Set(o[k]||[]); });
    state.q=o.q||"";
    if(originOf(o.origin)) state.origin=o.origin;
    state.radius=+o.radius||0;
    if([...$("sortSel").options].some(x=>x.value===o.sort)) state.sort=o.sort;
  }catch(e){}
}

function chipRow(host,items,set){
  host.innerHTML=items.map(v=>`<button class="chip" type="button" aria-pressed="${set.has(v)}">${CHECK}${esc(v)}</button>`).join("");
  host.querySelectorAll(".chip").forEach((b,i)=>{
    const v=items[i];
    b.onclick=()=>{ set.has(v)?set.delete(v):set.add(v); b.setAttribute("aria-pressed",String(set.has(v))); render(); };
  });
}

function render(){
  const q=state.q.toLowerCase();
  const flags=FLAGS.filter(([k])=>state.flag.has(k));
  FOOD_ORIGIN=originOf(state.origin);            /* food.js 的卡片读它来显示距离 */
  const rows=FOODS.filter(d=>{
    if(FOOD_ORIGIN&&state.radius&&foodKm(d,FOOD_ORIGIN)>state.radius)return false;
    if(state.meal.size&&!d.meal.some(m=>state.meal.has(m)))return false;
    if(state.area.size&&!d.areas.some(a=>state.area.has(a)))return false;
    if(state.kind.size&&!state.kind.has(d.kind))return false;
    if(state.tag.size&&!d.tags.some(t=>state.tag.has(t)))return false;
    if(flags.some(([,f])=>!f(d)))return false;
    if(q){const hay=(d.n+d.ln+d.intro+d.dish+(d.avoid||"")+d.areas.join("")+d.br.map(b=>b.n).join("")+d.kind+d.scamNote+d.flavor).toLowerCase();if(!hay.includes(q))return false;}
    return true;
  });
  const S=state.sort;
  rows.sort((a,b)=>{
    if(S==="near")return FOOD_ORIGIN?foodKm(a,FOOD_ORIGIN)-foodKm(b,FOOD_ORIGIN):foodTotal(b)-foodTotal(a);
    if(S==="drive")return a.drive-b.drive;
    if(S==="price")return (a.price??1e9)-(b.price??1e9);
    if(S==="open")return a.ot-b.ot;
    if(S==="total")return foodTotal(b)-foodTotal(a);
    if(S==="google")return (b.g??-1)-(a.g??-1)||(b.gc??0)-(a.gc??0);
    if(S==="gcount")return (b.gc??-1)-(a.gc??-1);
    if(S==="ta")return (b.ta??-1)-(a.ta??-1)||(b.tac??0)-(a.tac??0);
    return b.s[S]-a.s[S]||foodTotal(b)-foodTotal(a);
  });
  $("list").innerHTML=rows.map(d=>FUI.card(d)).join("");
  $("count").textContent=`${rows.length} / ${FOODS.length}`;
  const active=state.meal.size+state.area.size+state.kind.size+state.tag.size+state.flag.size+(FOOD_ORIGIN&&state.radius?1:0);
  $("nearNote").textContent=FOOD_ORIGIN
    ?`直线距离，从「${FOOD_ORIGIN.full}」算起${state.radius?`，只看 ${state.radius} km 以内`:"；半径选「不限」时只是排序和标距离"}。`
    :"选一个起点，就能按直线距离筛 / 排。多分店的品牌按最近的一家算。";
  $("filterCount").textContent=active?` ${active}`:"";
  $("filterToggle").setAttribute("aria-pressed",String(active>0));
  $("empty").hidden=rows.length>0;
  saveState();
}

/* 页首两个计数：品牌数与分店数 */
if($("total")) $("total").textContent=FOODS.length;
if($("brtotal")) $("brtotal").textContent=FOODS.reduce((a,d)=>a+d.br.length,0);

loadState();
chipRow($("mealFilters"),FOOD_MEALS,state.meal);
chipRow($("areaFilters"),FOOD_AREAS,state.area);
chipRow($("kindFilters"),FOOD_KINDS,state.kind);
chipRow($("tagFilters"),FOOD_TAGS,state.tag);
chipRow($("flagFilters"),FLAGS.map(([k])=>k),state.flag);

/* 起点下拉：按景点自己的线路分组，住处放最前 */
(function(){
  const sel=$("originSel"); const grps=[];
  for(const o of ORIGINS){ const g=grps.find(x=>x[0]===o.grp)||(grps.push([o.grp,[]]),grps[grps.length-1]); g[1].push(o); }
  sel.innerHTML='<option value="">不限（不按距离）</option>'+
    grps.map(([g,list])=>`<optgroup label="${esc(g)}">${list.map(o=>`<option value="${o.k}">${esc(o.full)}</option>`).join("")}</optgroup>`).join("");
  sel.value=state.origin;
  $("radiusSel").value=String(state.radius);
})();
$("sortSel").value=state.sort;
$("q").value=state.q;

const wide=window.matchMedia("(min-width:640px)").matches;
function setPanel(open){
  $("ctrlpanel").hidden=!open;
  $("filterToggle").setAttribute("aria-expanded",String(open));
}
setPanel(wide);
document.querySelectorAll("details.alert").forEach(el=>{ el.open=wide; });

$("filterToggle").onclick=()=>setPanel($("ctrlpanel").hidden);
$("clearAll").onclick=()=>{
  ["meal","area","kind","tag","flag"].forEach(k=>state[k].clear());
  state.q=""; state.origin=""; state.radius=0;
  $("originSel").value=""; $("radiusSel").value="0";
  if(state.sort==="near"){ state.sort="total"; $("sortSel").value="total"; }
  document.querySelectorAll("#ctrlpanel .chip[aria-pressed]").forEach(b=>b.setAttribute("aria-pressed","false"));
  $("q").value="";
  render();
};
$("sortSel").onchange=e=>{state.sort=e.target.value;render();};
/* 选了起点就自动切到「离起点最近」；取消起点再切回总分 */
$("originSel").onchange=e=>{
  state.origin=e.target.value;
  if(state.origin&&state.sort!=="near"){ state.sort="near"; $("sortSel").value="near"; }
  if(!state.origin&&state.sort==="near"){ state.sort="total"; $("sortSel").value="total"; }
  render();
};
$("radiusSel").onchange=e=>{state.radius=+e.target.value;render();};
$("q").oninput=e=>{state.q=e.target.value;render();};
render();
