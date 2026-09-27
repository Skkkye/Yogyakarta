/* =============================================================
   site.js —— 全站共用的工具函数与组件

   · UI.*    景点相关的 HTML 片段。只要一个片段会出现在两个地方
             （清单卡片 / 详情页 / 以后的新页面），就写在这里，页面脚本只负责拼装。
   · PARTS   页面里写 <x data-part="名字">，加载时自动填充：站内导航、来源图例、汇率框、
             街区步行动线。没有景点数据的页面，walk 那一格自动留空。
   依赖：data/spots.js 要先于本文件加载 —— 行程方案页（index.html）为了 data-part="walk"
        也加载了它。
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
/* 区间：两端只写一次 IDR、一次 S$ —— 「IDR 25,000–50,000 ≈ S$1.8–3.6」
   比把两个 moneyHTML 拼起来（IDR … ≈ S$… – IDR … ≈ S$…）短一半，也好读 */
const moneyRangeHTML=(a,b)=>`<span class="money" data-idr="${a}" data-idr2="${b}">IDR ${money(a)}–${money(b)} <span class="sgd">≈ S$${sgdNum(a)}–${sgdNum(b)}</span></span>`;
function setFx(v){
  fx=Math.max(1,+v||FX_DEFAULT);
  try{ localStorage.setItem(FX_KEY,String(fx)); }catch(e){}
  document.querySelectorAll(".money[data-idr]").forEach(el=>{
    const a=+el.dataset.idr, b=el.dataset.idr2?+el.dataset.idr2:null;
    el.querySelector(".sgd").textContent="≈ S$"+sgdNum(a)+(b!=null?"–"+sgdNum(b):"");
  });
}
/* 数据里的富文本：{12345} -> 金额，{25000-50000} -> 金额区间；只还原 <b> 和 <br>，其余标签一律转义 */
const rich=s=>esc(s).replace(/\{(\d+)-(\d+)\}/g,(_,a,b)=>moneyRangeHTML(+a,+b)).replace(/\{(\d+)\}/g,(_,n)=>moneyHTML(+n))
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
/* 导航链接：点开就是谷歌地图的路线规划，不是介绍卡。
   destination_place_id 钉死终点那一条；mode 默认步行，下车／接车点写 "driving" */
const navUrl=p=>"https://www.google.com/maps/dir/?api=1&destination="+encodeURIComponent(p.gq||p.n)
  +(p.pid?"&destination_place_id="+p.pid:"")+"&travelmode="+(p.mode||"walking");
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

/* ---------- 讲解插图 ----------
   UI.story 用 figLayers / figMudra 按 key 取用。样式在 site.css 的 .fig，
   颜色全部走 token，没有写死的色值 */
const FIGS={
  "borobudur-section":`<figure class="fig"><svg viewBox="0 0 320 244" role="img" aria-label="婆罗浮屠剖面示意：最下是被封住的基座，中间五层方台，上面三层圆台，顶上一座封闭大塔"><rect class="kamadhatu" x="50" y="206" width="200" height="22" rx="1"/><rect class="rupadhatu" x="59" y="191" width="182" height="14" rx="1"/><rect class="rupadhatu" x="68" y="176" width="164" height="14" rx="1"/><rect class="rupadhatu" x="77" y="161" width="146" height="14" rx="1"/><rect class="rupadhatu" x="86" y="146" width="128" height="14" rx="1"/><rect class="rupadhatu" x="95" y="131" width="110" height="14" rx="1"/><rect class="arupadhatu" x="104" y="119" width="92" height="11" rx="1"/><rect class="arupadhatu" x="112" y="107" width="76" height="11" rx="1"/><rect class="arupadhatu" x="120" y="95" width="60" height="11" rx="1"/><path class="top" d="M136 95 q0 -27 14 -27 q14 0 14 27 z"/><line class="brace" x1="150" y1="68" x2="150" y2="60"/><line class="brace" x1="256" y1="207" x2="256" y2="227"/><text class="big" x="264" y="216">欲界</text><text class="sm" x="264" y="226">KAMADHATU</text><line class="brace" x1="256" y1="132" x2="256" y2="204"/><text class="big" x="264" y="163">色界</text><text class="sm" x="264" y="173">RUPADHATU</text><line class="brace" x1="256" y1="62" x2="256" y2="129"/><text class="big" x="264" y="92">无色界</text><text class="sm" x="264" y="102">ARUPADHATU</text><text class="sm" x="44" y="221" text-anchor="end">封住</text><text class="sm" x="52" y="170" text-anchor="end">浮雕</text><text class="sm" x="98" y="112" text-anchor="end">镂空</text><text class="sm" x="128" y="78" text-anchor="end">空</text></svg><figcaption>虚线＝看不到（基座被石台封住）；实心＝有浮雕，1,460 幅叙事全在这五层；空心＝镂空小塔，看得见看不清；顶上金色那座是封闭的，里面空着。</figcaption></figure>`,
  "borobudur-mudra":`<figure class="fig"><svg viewBox="0 0 320 236" role="img" aria-label="婆罗浮屠佛像手印的方位对照：东触地印、南与愿印、西禅定印、北施无畏印，中心是第五层说法印与圆台转法轮印"><path class="arc" d="M272 168 A 18 18 0 0 1 272 204"/><path d="M264 204 l10 -5 l0 10 z" fill="var(--pick-soft)"/><text class="sm" x="272" y="221" text-anchor="middle">顺时针</text><rect class="plan" x="115" y="85" width="90" height="90" rx="2"/><text class="sm" x="160" y="106" text-anchor="middle">第五层 · 四面</text><text class="big" x="160" y="120" text-anchor="middle">说法印</text><line x1="127" y1="130" x2="193" y2="130" stroke="var(--line)" stroke-width="1"/><text class="sm" x="160" y="147" text-anchor="middle">圆台 72 座小塔</text><text class="big" x="160" y="161" text-anchor="middle">转法轮印</text><text class="big" x="160" y="60" text-anchor="middle">北 · 施无畏印</text><text class="sm" x="160" y="72" text-anchor="middle">不空成就佛</text><text class="big" x="160" y="202" text-anchor="middle">南 · 与愿印</text><text class="sm" x="160" y="214" text-anchor="middle">宝生佛</text><text class="big" x="212" y="126">东 · 触地印</text><text class="sm" x="212" y="138">阿閦佛 · 从这里进</text><text class="big" x="108" y="126" text-anchor="end">西 · 禅定印</text><text class="sm" x="108" y="138" text-anchor="end">阿弥陀佛</text></svg><figcaption>方形回廊的俯视图。五层方台的佛龛按朝向换手印，对应五方佛；<b>从东面进、顺时针绕</b> —— 逆着走，五方佛的次序和浮雕的故事都是倒放的。</figcaption></figure>`
};

/* ---------- 组件 ---------- */
const CHECK='<svg class="ck" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" fill="currentColor"/></svg>';

const UI={
  srcmark:src=>src==="off"?'<span class="srcmark off">官方</span>':src==="gmap"?'<span class="srcmark google">谷歌</span>':'<span class="srcmark sec">二手</span>',

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
    <a class="head" href="${spotHref(d)}" target="_blank" rel="noopener">
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

  /* 街区步行动线：适用于「没有大门、只能靠走」的景点（Kotagede、以后的 Malioboro / Prawirotaman）
     d.walk = {h 小标题, note 一句话说明, sum 路线长度与耗时, url 整条路线的步行导航, stops:[…]}
     stop   = {n 名称, ln 原名, m 距上一站米数, stay 建议停留, open 开放时间,
               tip 为什么值得停, off 不开的日子（画成虚线并标红）, pin 下车／接车点, gq/pid 导航用, mode}
     每站一个「导航到这里」，顶上一个整条路线 —— 两种都直接落进谷歌地图的路线规划。
     卡片是 <details>：景点详情页默认展开（那是那一页的主角），
     行程页塞进时刻表里的那份默认收起，open=false */
  walk:(w,open=true)=>`<details class="walk"${open?" open":""}>
      <summary><b class="h">${esc(w.h)}</b><span class="wsum">${esc(w.sum)}</span></summary>
      <p class="wnote">${rich(w.note)}</p>
      <a class="mapbtn walkall" href="${esc(w.url)}" target="_blank" rel="noopener">
        <span class="mapbtn-i" aria-hidden="true">⇢</span>
        <span><b>用谷歌步行导航打开整条路线</b><small>${esc(w.sum)}</small></span>
      </a>
      <ol class="walkstops">${w.stops.map(s=>`<li${s.off?' class="off"':s.pin?' class="pin"':""}>
          ${s.m!=null?`<span class="gap"><span class="num">${s.m}</span> m</span>`:'<span class="gap start">起</span>'}
          <div class="s">
            <p class="sline"><b>${esc(s.n)}</b>${s.ln?`<span class="local">${esc(s.ln)}</span>`:""}${s.stay?`<span class="pill">${esc(s.stay)}</span>`:""}${s.off?`<span class="pill risk">${esc(s.off)}</span>`:""}</p>
            ${s.open?`<p class="open">${esc(s.open)}</p>`:""}
            ${s.tip?`<p class="tip">${rich(s.tip)}</p>`:""}
            ${s.pid?`<a class="nav" href="${navUrl(s)}" target="_blank" rel="noopener">导航到这里 ↗</a>`:""}
          </div>
        </li>`).join("")}</ol>
    </details>`,

  /* 背景讲解：适用于「看不懂就等于没看」的古迹（婆罗浮屠、普兰巴南）
     d.story = {h 小标题, sum 折叠时的一行摘要, note 导言,
                shape / build / time / layers：都是 [[小标题, 正文]…]，渲染成 dl.fields
                tables:[[表名, [表头…], [[行…]…]]…] 真正的表格数据（浮雕分配、手印对照）
                tips 参观实操, myth 要破的常见说法}
     和 UI.walk 一样是 <details>，详情页默认展开 */
  story:(w,open=true)=>{
    const fields=(t,rows)=>rows?`<b class="sub">${esc(t)}</b><dl class="fields">${
      rows.map(([k,v])=>`<div><dt>${rich(k)}</dt><dd>${rich(v)}</dd></div>`).join("")}</dl>`:"";
    const table=([t,head,rows])=>`<b class="sub">${esc(t)}</b><div class="scroll"><table>
        <thead><tr>${head.map(h=>`<th scope="col">${esc(h)}</th>`).join("")}</tr></thead>
        <tbody>${rows.map(r=>`<tr><th scope="row">${rich(r[0])}</th>${
          r.slice(1).map(c=>`<td>${rich(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
    return `<details class="story"${open?" open":""}>
      <summary><b class="h">${esc(w.h)}</b><span class="wsum">${esc(w.sum)}</span></summary>
      <p class="wnote">${rich(w.note)}</p>
      ${fields("塔的形状代表什么",w.shape)}
      ${fields("来历",w.time)}
      ${w.figLayers?FIGS[w.figLayers]||"":""}
      ${fields("一层一层在看什么",w.layers)}
      ${(w.tables||[]).map(table).join("")}
      ${w.figMudra?FIGS[w.figMudra]||"":""}
      ${fields("怎么垒起来的",w.build)}
      ${w.tips?`<b class="sub">走的时候</b><p class="wnote">${rich(w.tips)}</p>`:""}
      ${w.myth?`<div class="callout soga"><b class="h">顺便破一个常听到的说法</b>${rich(w.myth)}</div>`:""}
    </details>`;
  },

  /* 口碑块：good 一段文字，bad 是 [小标题, 文字] 数组 */
  buzz:b=>`<div class="callout buzz"><b class="h">口碑：赞与吐槽</b><ul>
      <li><b>赞：</b>${rich(b.good)}</li>
      <li><b>吐槽：</b><ul>${b.bad.map(([k,v])=>`<li><b>${esc(k)}：</b>${rich(v)}</li>`).join("")}</ul></li>
    </ul></div>`,

  detail:d=>{
    const bars=SCORE_KEYS.map(([k,l])=>`<div class="bar"><div class="lbl"><span>${l}</span><b>${d.s[k]}</b></div><div class="track"><div class="fill" style="width:${d.s[k]*10}%"></div></div></div>`).join("");
    const fields=[
      /* 来源角标放句首，和美食详情页的「人均」一个口径 */
      ["门票",UI.srcmark(d.src)+rich(d.ticket)],
      ["预约要求",rich(d.book)+(d.url?` · <a href="${esc(d.url)}" target="_blank" rel="noopener">订票入口</a>`:"")],
      ["开放时间",rich(d.hours)],
      ["建议停留",rich(d.dur)],
      ["最佳时段",rich(d.best)],
      ["位置与车程",`${rich(d.dist)} · 单程约 ${d.drive} 分钟`+(geoText(d)?`<br><small class="geo">坐标 ${geoText(d)}</small>`:"")],
      ["交通方式",d.trans.map(rich).join("<br>")],
      ["体力强度",rich(d.phys)],
      ["天气敏感度",rich(d.weather)],
      ["宰客与踩坑",`<span class="pill ${scamClass(d.scam)}">${d.scam}风险</span> ${rich(d.scamNote)}`],
      ["支付方式",rich(d.pay)],
      ["着装与礼仪",rich(d.dress)]
    ].map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
    return `<p class="lede">${rich(d.intro)}</p>
      ${UI.media(d)}
      <div class="bars">${bars}</div>
      <dl class="fields">${fields}</dl>
      ${d.story?UI.story(d.story):""}
      ${d.walk?UI.walk(d.walk):""}
      ${d.pick?`<div class="callout"><b class="h">${esc(d.pick.h)}</b>${rich(d.pick.t)}</div>`:""}
      ${d.buzz?UI.buzz(d.buzz):""}
      <div class="callout soga"><b class="h">什么人会觉得踩雷</b>${rich(d.avoid)}</div>
      <div class="linkrow"><span class="label">来源</span>${d.srcs.map(([t,u])=>`<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a>`).join("")}</div>`;
  }
};

/* ---------- 清单页共用（spots.html / food.html）----------
   两页的筛选面板结构相同：同一套 chip、同一套开合。写在这里，改一次两页都生效。
   页面脚本只要在自己的 render 准备好之后调 setupPanel()。 */

/* 一排可多选的 chip：items 是选项，set 是选中集合，onchange 在切换后调用 */
function chipRow(host,items,set,onchange){
  host.innerHTML=items.map(v=>`<button class="chip" type="button" aria-pressed="${set.has(v)}">${CHECK}${esc(v)}</button>`).join("");
  host.querySelectorAll(".chip").forEach((b,i)=>{
    const v=items[i];
    b.onclick=()=>{ set.has(v)?set.delete(v):set.add(v); b.setAttribute("aria-pressed",String(set.has(v))); onchange(); };
  });
}

/* 筛选面板：手机默认收起、宽屏默认展开；顶上的「筛选」钮切换，面板末尾的箭头收起。
   收起后焦点回到「筛选」钮，键盘操作不会掉到页面开头 */
function setupPanel(){
  const wide=window.matchMedia("(min-width:640px)").matches;
  const el=id=>document.getElementById(id);
  const panel=el("ctrlpanel"), toggle=el("filterToggle"), closer=el("panelClose");
  const show=open=>{ panel.hidden=!open; toggle.setAttribute("aria-expanded",String(open)); };
  show(wide);
  document.querySelectorAll("details.alert").forEach(el=>{ el.open=wide; });
  toggle.onclick=()=>show(panel.hidden);
  if(closer) closer.onclick=()=>{ show(false); toggle.focus(); };
}

/* ---------- PARTS：<x data-part="名字"> 自动填充 ---------- */
const NAV=[["plan","行程方案","index.html"],["food","美食清单","food.html"],["list","景点清单","spots.html"],["info","实用信息","info.html"]];
const PARTS={
  /* <nav class="topnav" data-part="nav" data-current="list|food|plan|info"> */
  nav:el=>NAV.map(([k,t,h])=>`<a href="${h}"${k===el.dataset.current?' aria-current="true"':""}>${t}</a>`).join(""),
  srclegend:()=>'<b>来源标注</b>　<span class="srcmark off">官方</span> 景区官网 / 政府机构 / 官方票务平台。'+
    '<span class="srcmark google">谷歌</span> 谷歌地图地点页上标的人均区间（2026-09-21 逐家打开核对）。'+
    '<span class="srcmark sec">二手</span> 旅行社、攻略站、媒体报道、网友分享 —— 价格与开放时间可能已变，到场前请复核。',
  /* 街区步行动线：<div data-part="walk" data-slug="<景点 slug>">
     行程页把景点清单里那张卡原样搬过来，默认收起。没加载 spots.js 的页面自动留空 */
  walk:el=>{
    if(typeof SPOTS==="undefined") return "";
    const d=spotBySlug(el.dataset.slug);
    return d&&d.walk?UI.walk(d.walk,false):"";
  },
  /* 汇率框：改一次，各页通用 */
  fx:el=>{
    el.innerHTML=`<label class="label" for="fx">汇率 1 SGD =</label>
      <input type="number" id="fx" value="${fx}" min="1" step="50" aria-label="每新元兑印尼盾">
      <span class="label">IDR</span>`;
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
