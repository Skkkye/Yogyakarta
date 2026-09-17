/* =============================================================
   foodlist.js —— 美食清单页（food.html）：筛选、排序、搜索
   卡片由 food.js 的 FUI.card 生成，这里不拼卡片 HTML。
   ============================================================= */

const $=id=>document.getElementById(id);
const scamRank={"低":0,"中":1,"高":2};
/* 「条件」一行：一个开关一条判断。9/28 是这次行程唯一的周一 */
const FLAGS=[
  ["周一营业（9/28）",d=>opensOn(d,"周一")],
  ["07:00 前开门",d=>d.ot<=700],
  ["22:00 后还开",d=>d.ct>=2200],
  ["素食友好",d=>d.veg],
  ["低踩坑风险",d=>d.scam==="低"]
];
const state={meal:new Set(),area:new Set(),kind:new Set(),tag:new Set(),flag:new Set(),q:"",sort:"total"};

const STATE_KEY="jogja.food";
function saveState(){
  try{
    sessionStorage.setItem(STATE_KEY,JSON.stringify({
      meal:[...state.meal],area:[...state.area],kind:[...state.kind],tag:[...state.tag],flag:[...state.flag],q:state.q,sort:state.sort
    }));
  }catch(e){}
}
function loadState(){
  try{
    const o=JSON.parse(sessionStorage.getItem(STATE_KEY)||"null"); if(!o) return;
    ["meal","area","kind","tag","flag"].forEach(k=>{ state[k]=new Set(o[k]||[]); });
    state.q=o.q||"";
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
  const rows=FOODS.filter(d=>{
    if(state.meal.size&&!d.meal.some(m=>state.meal.has(m)))return false;
    if(state.area.size&&!state.area.has(d.area))return false;
    if(state.kind.size&&!state.kind.has(d.kind))return false;
    if(state.tag.size&&!d.tags.some(t=>state.tag.has(t)))return false;
    if(flags.some(([,f])=>!f(d)))return false;
    if(q){const hay=(d.n+d.ln+d.intro+d.dish+d.avoid+d.area+d.kind+d.scamNote+d.flavor).toLowerCase();if(!hay.includes(q))return false;}
    return true;
  });
  const S=state.sort;
  rows.sort((a,b)=>{
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
  const active=state.meal.size+state.area.size+state.kind.size+state.tag.size+state.flag.size;
  $("filterCount").textContent=active?` ${active}`:"";
  $("filterToggle").setAttribute("aria-pressed",String(active>0));
  $("empty").hidden=rows.length>0;
  saveState();
}

loadState();
chipRow($("mealFilters"),FOOD_MEALS,state.meal);
chipRow($("areaFilters"),FOOD_AREAS,state.area);
chipRow($("kindFilters"),FOOD_KINDS,state.kind);
chipRow($("tagFilters"),FOOD_TAGS,state.tag);
chipRow($("flagFilters"),FLAGS.map(([k])=>k),state.flag);
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
  state.q="";
  document.querySelectorAll("#ctrlpanel .chip[aria-pressed]").forEach(b=>b.setAttribute("aria-pressed","false"));
  $("q").value="";
  render();
};
$("sortSel").onchange=e=>{state.sort=e.target.value;render();};
$("q").oninput=e=>{state.q=e.target.value;render();};
render();
