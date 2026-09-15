/* =============================================================
   info.js —— 实用信息页 info.html
   · 汇率计算器：IDR ↔ SGD ↔ CNY。SGD 汇率就是全站那一个（site.js 的 fx / setFx），
     改了景点、美食页的 S$ 也跟着变；CNY 汇率只在这一页用，另存一份
   · 钞票速查表
   · 页面里写 <span data-money="500000"></span>，加载时换成 moneyHTML（带 S$ 换算）
   依赖：assets/site.js
   ============================================================= */

const CNY_DEFAULT=2635, CNY_KEY="jogja.fxcny";
const FX_REF={sgd:13900,cny:2635};   // 2026-09-15 Alpha Vantage 实时报价
const NOTES=[1000,2000,5000,10000,20000,50000,100000];
const QUICK=[["25rb",25000],["50rb",50000],["100rb",100000],["500rb",500000],["1jt",1000000],["2,5jt",2500000]];

let cny=(()=>{ try{ const v=+localStorage.getItem(CNY_KEY); return v>0?v:CNY_DEFAULT; }catch(e){ return CNY_DEFAULT; } })();
let lastIdr=null;

const $=id=>document.getElementById(id);
const inIdr=$("inIdr"), inSgd=$("inSgd"), inCny=$("inCny"), rateSgd=$("rateSgd"), rateCny=$("rateCny");

/* 印尼盾：认 50rb / 50k / 1,2jt / 1.2jt；纯数字里的 . 和 , 都当千分位 */
function parseIdr(s){
  let t=String(s).trim().toLowerCase().replace(/\s/g,""), mul=1;
  if(/(rb|k)$/.test(t)){ mul=1e3; t=t.replace(/(rb|k)$/,""); }
  else if(/(jt|juta)$/.test(t)){ mul=1e6; t=t.replace(/(jt|juta)$/,""); }
  t = mul>1 ? t.replace(/\.(?=\d{3}\b)/g,"").replace(",",".") : t.replace(/[.,]/g,"");
  const v=parseFloat(t);
  return isFinite(v)&&v>=0 ? Math.round(v*mul) : null;
}
const parseForeign=s=>{ const v=parseFloat(String(s).replace(/[,\s]/g,"")); return isFinite(v)&&v>=0?v:null; };
const fmtForeign=v=>v.toLocaleString("en-US",{maximumFractionDigits:v<100?2:0});
const shortIdr=n=>n>=1e6?String(n/1e6).replace(".",",")+"jt":n>=1e3?(n/1e3)+"rb":String(n);

function fill(from){
  if(lastIdr==null){ [inIdr,inSgd,inCny].forEach(el=>{ if(el.id!==from) el.value=""; }); return; }
  if(from!=="inIdr") inIdr.value=money(lastIdr);
  if(from!=="inSgd") inSgd.value=fmtForeign(lastIdr/fx);
  if(from!=="inCny") inCny.value=fmtForeign(lastIdr/cny);
}

inIdr.addEventListener("input",()=>{ lastIdr=parseIdr(inIdr.value); fill("inIdr"); });
inIdr.addEventListener("blur",()=>{ if(lastIdr!=null) inIdr.value=money(lastIdr); });
inSgd.addEventListener("input",()=>{ const v=parseForeign(inSgd.value); lastIdr=v==null?null:Math.round(v*fx); fill("inSgd"); });
inCny.addEventListener("input",()=>{ const v=parseForeign(inCny.value); lastIdr=v==null?null:Math.round(v*cny); fill("inCny"); });

$("quick").innerHTML=QUICK.map(([t,n])=>`<button class="chip" type="button" data-idr="${n}">${t}</button>`).join("");
$("quick").addEventListener("click",e=>{
  const b=e.target.closest("[data-idr]"); if(!b) return;
  lastIdr=+b.dataset.idr; fill("");
});

function renderNotes(){
  $("notes").innerHTML=NOTES.map(n=>`<tr><th scope="row" class="n">IDR ${money(n)}</th><td class="n">S$ ${sgdNum(n)}</td><td class="n">¥ ${fmtForeign(n/cny)}</td><td class="n">${shortIdr(n)}</td></tr>`).join("");
}
function rates(){
  rateSgd.value=fx; rateCny.value=cny;
  renderNotes(); fill(document.activeElement&&document.activeElement.id);
}
rateSgd.addEventListener("input",()=>{ setFx(rateSgd.value); renderNotes(); fill(""); });
rateCny.addEventListener("input",()=>{
  cny=Math.max(1,+rateCny.value||CNY_DEFAULT);
  try{ localStorage.setItem(CNY_KEY,String(cny)); }catch(e){}
  renderNotes(); fill("");
});
$("useRef").addEventListener("click",()=>{
  setFx(FX_REF.sgd); cny=FX_REF.cny;
  try{ localStorage.setItem(CNY_KEY,String(cny)); }catch(e){}
  rates();
});

document.querySelectorAll("[data-money]").forEach(el=>{ el.outerHTML=moneyHTML(+el.dataset.money); });
rates();
