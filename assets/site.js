/* =============================================================
   site.js —— 全站共用的工具函数与组件

   · UI.*    景点相关的 HTML 片段。只要一个片段会出现在两个地方
             （清单卡片 / 详情页 / 以后的新页面），就写在这里，页面脚本只负责拼装。
   · PARTS   页面里写 <x data-part="名字">，加载时自动填充：站内导航、来源图例、汇率框。
             plan.html 不加载景点数据，也能用 PARTS。
   依赖：data/spots.js 要先于本文件加载（plan.html 除外，它不调 UI）。
   ============================================================= */

const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const money=n=>n.toLocaleString("en-US");
const slugOf=d=>d.ln.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,48);
const total=d=>Math.round((d.s.view+d.s.culture+d.s.unique+d.s.value+d.s.quiet)/5*10)/10;
const spotBySlug=s=>SPOTS.find(d=>slugOf(d)===s);
const spotHref=d=>"spot.html?id="+slugOf(d);
const photoSrc=(d,i)=>`assets/img/${slugOf(d)}/${i}.jpg`;
const thumbSrc=d=>`assets/img/${slugOf(d)}/thumb.jpg`;
const scamClass=v=>v==="低"?"good":v==="中"?"warn":"risk";

/* ---------- 汇率：各页共用一个值，存在本机浏览器里 ----------
   FX_DATE 是抓取日，键名带着它：换了汇率连它一起改，上次存在本机的旧值自动作废，
   打开就是新汇率，不用再点「恢复实时汇率」 */
const FX_DATE="2026-09-20";
const FX_DEFAULT=13900, FX_KEY="jogja.fx."+FX_DATE, CNY_KEY="jogja.fxcny."+FX_DATE;
function dropStaleFx(){
  ["jogja.fx","jogja.fxcny"].forEach(k=>localStorage.removeItem(k));   // 旧版不带日期的键
  for(let i=localStorage.length-1;i>=0;i--){
    const k=localStorage.key(i);
    if(/^jogja\.fx(cny)?\./.test(k)&&k!==FX_KEY&&k!==CNY_KEY) localStorage.removeItem(k);
  }
}
let fx=(()=>{ try{ dropStaleFx(); const v=+localStorage.getItem(FX_KEY); return v>0?v:FX_DEFAULT; }catch(e){ return FX_DEFAULT; } })();
const sgdNum=n=>{const v=n/fx;return v<1?v.toFixed(2):v<10?v.toFixed(1):String(Math.round(v));};
/* 金额一律经过这里。data-idr 留原值，改汇率时只刷新 .sgd，不重绘页面（地图 iframe 不会重载） */
const moneyHTML=n=>`<span class="money" data-idr="${n}">IDR ${money(n)} <span class="sgd">≈ S$${sgdNum(n)}</span></span>`;
function setFx(v){
  fx=Math.max(1,+v||FX_DEFAULT);
  try{ localStorage.setItem(FX_KEY,String(fx)); }catch(e){}
  document.querySelectorAll(".money[data-idr]").forEach(el=>{
    el.querySelector(".sgd").textContent="≈ S$"+sgdNum(+el.dataset.idr);
  });
}
/* 数据里的富文本：{12345} -> 金额；只还原 <b> 和 <br>，其余标签一律转义 */
const rich=s=>esc(s).replace(/\{(\d+)\}/g,(_,n)=>moneyHTML(+n))
  .replace(/&lt;b&gt;/g,"<b>").replace(/&lt;\/b&gt;/g,"</b>").replace(/&lt;br&gt;/g,"<br>");

/* ---------- 地图 ----------
   先放 iframe。Artifact 沙箱的 CSP 会拦第三方 frame，拦到时浏览器抛
   securitypolicyviolation，届时换成「在地图中打开」按钮；GitHub Pages / 本地文件没有这层 CSP
   定位要落在景点的介绍卡（名称 / 评分 / 评论），不是光秃秃的坐标针：
   · 链接：query 用谷歌 POI 名 gq，再带 query_place_id=pid 钉死那一条
   · 嵌入图：用 cid 钉死那一条（嵌入图认不了 place_id；按名字搜遇到同名 POI 会出列表、没有卡；按坐标搜只出一根针）
     没有 cid 才按 gq 搜索
   · geo 只作留档，显示在「位置与车程」里，不参与定位
   都没填就退回「ln + Yogyakarta」泛搜索。
   两处的景点 gq/pid/cid/geo 写成数组，顺序对应 ln 里用「 & 」或「 / 」隔开的名字；嵌入图只放第一处，按钮每处一个
   cid 必须写成字符串：多数超过 JS 能精确表示的整数范围 */
const placesOf=d=>{
  const multi=[d.pid,d.gq,d.cid].some(Array.isArray)||(Array.isArray(d.geo)&&Array.isArray(d.geo[0]));
  const list=v=>v==null?[]:multi?v:[v];
  const geos=list(d.geo), pids=list(d.pid), gqs=list(d.gq), cids=list(d.cid), names=multi?d.ln.split(/\s+[&/]\s+/):[d.ln];
  return Array.from({length:Math.max(1,geos.length,pids.length,gqs.length,cids.length)},
    (_,i)=>({name:names[i]||d.ln,geo:geos[i],pid:pids[i],gq:gqs[i],cid:cids[i]}));
};
const mapQuery=p=>p.gq||p.name+" Yogyakarta";
const mapUrl=p=>"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(mapQuery(p))+(p.pid?"&query_place_id="+p.pid:"");
const mapEmbed=p=>"https://maps.google.com/maps?"+(p.cid?"cid="+p.cid:"q="+encodeURIComponent(mapQuery(p)))+"&z=14&output=embed";
const geoText=d=>{
  const ps=placesOf(d).filter(p=>p.geo);
  return ps.map(p=>(ps.length>1?esc(p.name)+" ":"")+p.geo.map(v=>v.toFixed(6)).join(", ")).join(" ｜ ");
};
let mapBlocked=false;
function fallbackMaps(){
  mapBlocked=true;
  document.querySelectorAll(".mapwrap").forEach(w=>{
    const f=w.querySelector(".mapframe"); if(f) f.remove();
    w.querySelectorAll(".mapbtn").forEach(b=>{b.hidden=false;});
  });
}
document.addEventListener("securitypolicyviolation",e=>{
  if((e.violatedDirective||"").indexOf("frame")>-1) fallbackMaps();
});
/* 有些环境拦了也不抛事件：8 秒还没 load 就当作被拦 */
function watchMaps(root){
  root.querySelectorAll(".mapframe").forEach(fr=>{
    let ok=false;
    fr.addEventListener("load",()=>{ok=true;},{once:true});
    setTimeout(()=>{ if(!ok&&document.body.contains(fr)) fallbackMaps(); },8000);
  });
}

/* ---------- 组件 ---------- */
const CHECK='<svg class="ck" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" fill="currentColor"/></svg>';

const UI={
  srcmark:src=>src==="off"?'<span class="srcmark off">官方</span>':'<span class="srcmark sec">二手</span>',

  tagPills:d=>d.tags.map(t=>`<span class="pill tag ${t==="必去"?"pick":"soga"}">${t}</span>`).join(""),

  /* 卡片和详情页页首用的同一排 pill */
  metaPills:d=>UI.tagPills(d)+
    `<span class="pill txt ink">${esc(d.c)}</span>`+
    `<span class="pill txt">${esc(d.t)}</span>`+
    `<span class="pill">${d.price===0?"免费":moneyHTML(d.price)+" 起"}</span>`+
    `<span class="pill">车程 ${d.drive} 分</span>`+
    `<span class="pill ${scamClass(d.scam)}">宰客${d.scam}</span>`,

  score:d=>`<span class="score">
      <span class="g">${d.g?`<span class="gr">★ ${d.g.toFixed(1)}</span><span class="gc">${money(d.gc)} 条</span>`:'<span class="none">评分<br>未核实到</span>'}</span>
      <span class="tot" aria-label="我的总分 ${total(d)} / 10"><span class="n">${total(d)}</span><span class="d">/10</span></span>
    </span>`,

  /* 景点卡片：整张是指向详情页的链接。h 是标题层级，嵌在别的段落里时传 "h3" */
  card:(d,h="h2")=>`<li class="panel card${d.tags.includes("必去")?" must":""}">
    <a class="head" href="${spotHref(d)}">
      ${d.img?`<img class="thumb" src="${thumbSrc(d)}" alt="" width="74" height="74" loading="lazy" decoding="async">`:'<span class="thumb noimg" aria-hidden="true">—</span>'}
      <div class="headmain">
        <div class="titleline"><${h} class="name">${esc(d.n)}</${h}><span class="local">${esc(d.ln)}</span></div>
        <div class="metaline">${UI.metaPills(d)}</div>
      </div>
      ${UI.score(d)}
    </a>
  </li>`,

  media:d=>{
    const n=d.img||0;
    const shots=n
      ? Array.from({length:n},(_,i)=>`<figure class="shot"><img src="${photoSrc(d,i+1)}" alt="${esc(d.n)} 实景 ${i+1}" decoding="async"></figure>`).join("")
      : '<div class="shot nophoto">两个图库都没有这处的开放授权照片</div>';
    const places=placesOf(d), multi=places.length>1;
    const btn=places.map(p=>`<a class="mapbtn" href="${mapUrl(p)}" target="_blank" rel="noopener"${mapBlocked?"":" hidden"}>
        <span class="mapbtn-i" aria-hidden="true">◎</span>
        <span><b>在地图中打开${multi?" · "+esc(p.name):""}</b><small>${esc(d.dist)} · 单程约 ${d.drive} 分钟</small></span>
      </a>`).join("");
    const frame=mapBlocked?"":`<iframe class="mapframe" src="${mapEmbed(places[0])}" title="${esc(d.n)} 位置" referrerpolicy="no-referrer-when-downgrade"></iframe>`;
    return `<div class="media${n<2?" single":""}"><div class="shots">${shots}</div><div class="mapwrap">${frame}${btn}</div></div>`;
  },

  /* 口碑块：good 一段文字，bad 是 [小标题, 文字] 数组 */
  buzz:b=>`<div class="callout buzz"><b class="h">口碑：赞与吐槽</b><ul>
      <li><b>赞：</b>${rich(b.good)}</li>
      <li><b>吐槽：</b><ul>${b.bad.map(([k,v])=>`<li><b>${esc(k)}：</b>${rich(v)}</li>`).join("")}</ul></li>
    </ul></div>`,

  detail:d=>{
    const bars=SCORE_KEYS.map(([k,l])=>`<div class="bar"><div class="lbl"><span>${l}</span><b>${d.s[k]}</b></div><div class="track"><div class="fill" style="width:${d.s[k]*10}%"></div></div></div>`).join("");
    const fields=[
      ["门票",rich(d.ticket)+UI.srcmark(d.src)],
      ["预约要求",rich(d.book)+(d.url?` · <a href="${esc(d.url)}" target="_blank" rel="noopener">订票入口</a>`:"")],
      ["开放时间",esc(d.hours)],
      ["建议停留",esc(d.dur)],
      ["最佳时段",esc(d.best)],
      ["位置与车程",`${esc(d.dist)} · 单程约 ${d.drive} 分钟`+(geoText(d)?`<br><small class="geo">坐标 ${geoText(d)}</small>`:"")],
      ["交通方式",d.trans.map(rich).join("<br>")],
      ["体力强度",esc(d.phys)],
      ["天气敏感度",rich(d.weather)],
      ["宰客与踩坑",`<span class="pill ${scamClass(d.scam)}">${d.scam}风险</span> ${rich(d.scamNote)}`],
      ["支付方式",esc(d.pay)],
      ["着装与礼仪",esc(d.dress)]
    ].map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
    return `<p class="lede">${esc(d.intro)}</p>
      ${UI.media(d)}
      <div class="bars">${bars}</div>
      <dl class="fields">${fields}</dl>
      ${d.pick?`<div class="callout"><b class="h">${esc(d.pick.h)}</b>${rich(d.pick.t)}</div>`:""}
      ${d.buzz?UI.buzz(d.buzz):""}
      <div class="callout soga"><b class="h">什么人会觉得踩雷</b>${rich(d.avoid)}</div>
      <div class="linkrow"><span class="label">来源</span>${d.srcs.map(([t,u])=>`<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a>`).join("")}</div>`;
  }
};

/* ---------- PARTS：<x data-part="名字"> 自动填充 ---------- */
const NAV=[["list","景点清单","index.html"],["food","美食清单","food.html"],["plan","行程方案","plan.html"],["info","实用信息","info.html"]];
const PARTS={
  /* <nav class="topnav" data-part="nav" data-current="list|food|plan|info"> */
  nav:el=>NAV.map(([k,t,h])=>`<a href="${h}"${k===el.dataset.current?' aria-current="true"':""}>${t}</a>`).join(""),
  srclegend:()=>'<b>来源标注</b>　<span class="srcmark off">官方</span> 景区官网 / 政府机构 / 官方票务平台。'+
    '<span class="srcmark sec">二手</span> 旅行社、攻略站、媒体报道、网友分享 —— 价格与开放时间可能已变，到场前请复核。',
  /* 汇率框：改一次，各页通用 */
  fx:el=>{
    el.innerHTML=`<label class="label" for="fx">汇率 1 SGD =</label>
      <input type="number" id="fx" value="${fx}" min="1" step="50" aria-label="每新元兑印尼盾">
      <span class="label">IDR — 预设 ${money(FX_DEFAULT)}（${FX_DATE} 实时报价），出发前请自行核对当日汇率</span>`;
    el.querySelector("input").oninput=e=>setFx(e.target.value);
  }
};
function renderParts(root){
  root.querySelectorAll("[data-part]").forEach(el=>{
    const f=PARTS[el.dataset.part]; if(!f) return;
    const html=f(el);
    if(typeof html==="string") el.innerHTML=html;
  });
}
renderParts(document);
