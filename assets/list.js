/* =============================================================
   list.js —— 景点清单页（spots.html）：筛选、排序、搜索
   卡片长什么样由 site.js 的 UI.card 决定，这里不拼卡片 HTML。
   ============================================================= */

/* 旧链接 spots.html#<slug>（原来的浮窗深链）转到详情页 */
(function(){
  const s=decodeURIComponent(location.hash.slice(1));
  const d=s&&spotBySlug(s);
  if(d) location.replace(spotHref(d));
})();

const $=id=>document.getElementById(id);
const scamRank={"低":0,"中":1,"高":2};
const state={corr:new Set(),type:new Set(),tag:new Set(),q:"",sort:"total",lowScam:false};

/* 筛选条件存 sessionStorage：进详情页再返回时条件还在，关掉标签页就清空 */
const STATE_KEY="jogja.list";
function saveState(){
  try{
    sessionStorage.setItem(STATE_KEY,JSON.stringify({
      corr:[...state.corr],type:[...state.type],tag:[...state.tag],q:state.q,sort:state.sort,lowScam:state.lowScam
    }));
  }catch(e){}
}
function loadState(){
  try{
    const o=JSON.parse(sessionStorage.getItem(STATE_KEY)||"null"); if(!o) return;
    ["corr","type","tag"].forEach(k=>{ state[k]=new Set(o[k]||[]); });
    state.q=o.q||"";
    state.lowScam=!!o.lowScam;
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
  const rows=SPOTS.filter(d=>{
    if(state.corr.size&&!state.corr.has(d.c))return false;
    if(state.type.size&&!state.type.has(d.t))return false;
    if(state.tag.size&&!d.tags.some(t=>state.tag.has(t)))return false;
    if(state.lowScam&&d.scam!=="低")return false;
    if(q){const hay=(d.n+d.ln+d.intro+d.avoid+d.c+d.t+d.scamNote+(d.pick?d.pick.h+d.pick.t:"")).toLowerCase();if(!hay.includes(q))return false;}
    return true;
  });
  const S=state.sort;
  rows.sort((a,b)=>{
    if(S==="drive")return a.drive-b.drive;
    if(S==="price")return a.price-b.price;
    if(S==="scam")return scamRank[a.scam]-scamRank[b.scam]||total(b)-total(a);
    if(S==="total")return total(b)-total(a);
    if(S==="google")return (b.g??-1)-(a.g??-1)||(b.gc??0)-(a.gc??0);
    if(S==="gcount")return (b.gc??-1)-(a.gc??-1);
    return b.s[S]-a.s[S]||total(b)-total(a);
  });
  $("list").innerHTML=rows.map(d=>UI.card(d)).join("");
  $("count").textContent=`${rows.length} / ${SPOTS.length}`;
  const active=state.corr.size+state.type.size+state.tag.size+(state.lowScam?1:0);
  $("filterCount").textContent=active?` ${active}`:"";
  $("filterToggle").setAttribute("aria-pressed",String(active>0));
  $("empty").hidden=rows.length>0;
  saveState();
}

loadState();
chipRow($("corrFilters"),CORRIDORS,state.corr);
chipRow($("typeFilters"),TYPES,state.type);
chipRow($("tagFilters"),TAGS,state.tag);
$("sortSel").value=state.sort;
$("q").value=state.q;
$("lowScam").setAttribute("aria-pressed",String(state.lowScam));

/* 筛选面板与三条警示：手机上默认收起，宽屏默认展开 */
const wide=window.matchMedia("(min-width:640px)").matches;
function setPanel(open){
  $("ctrlpanel").hidden=!open;
  $("filterToggle").setAttribute("aria-expanded",String(open));
}
setPanel(wide);
document.querySelectorAll("details.alert").forEach(el=>{ el.open=wide; });

$("filterToggle").onclick=()=>setPanel($("ctrlpanel").hidden);
$("clearAll").onclick=()=>{
  state.corr.clear();state.type.clear();state.tag.clear();state.lowScam=false;state.q="";
  document.querySelectorAll("#ctrlpanel .chip[aria-pressed]").forEach(b=>b.setAttribute("aria-pressed","false"));
  $("q").value="";
  render();
};
$("sortSel").onchange=e=>{state.sort=e.target.value;render();};
$("q").oninput=e=>{state.q=e.target.value;render();};
$("lowScam").onclick=()=>{state.lowScam=!state.lowScam;$("lowScam").setAttribute("aria-pressed",String(state.lowScam));render();};
render();
