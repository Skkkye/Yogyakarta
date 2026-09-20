/* =============================================================
   food.js —— 美食相关的工具函数与组件（food.html 清单 / eat.html 详情共用）

   · 依赖：data/foods.js、assets/site.js 先加载。esc / money / moneyHTML / rich /
     mapUrl / mapEmbed / watchMaps / CHECK / UI.srcmark / UI.buzz / scamClass 来自 site.js。
   · 一个品牌一个条目，分店写在 br 数组里（长度 ≥ 1，第一家是主店）：
     br:[{n:"分店名", area:"区域", pid, cid, geo:[lat,lng], dist, drive, near:[景点 slug]}]
     地区、顺路景点、车程在 data/foods.js 里已由 br 汇总成 areas / near / drive。
   · FUI.*  美食的 HTML 片段。版面结构照搬景点的 UI，改的只是字段。
   ============================================================= */

const foodTotal=d=>Math.round(FOOD_SCORE_KEYS.reduce((a,[k])=>a+d.s[k],0)/FOOD_SCORE_KEYS.length*10)/10;
const foodBySlug=s=>FOODS.find(d=>slugOf(d)===s);
const foodHref=d=>"eat.html?id="+slugOf(d);
const foodPhoto=(d,i)=>`assets/food/${slugOf(d)}/${i}.jpg`;
const foodThumb=d=>`assets/food/${slugOf(d)}/thumb.jpg`;
/* 营业时间用整数 HHMM；过了午夜记成 2400+（01:00 = 2500） */
const hhmm=n=>String(Math.floor(n/100)%24).padStart(2,"0")+":"+String(n%100).padStart(2,"0");
const openText=d=>`${hhmm(d.ot)}–${hhmm(d.ct)}`;
const opensOn=(d,day)=>!d.off.includes(day);
/* 分店 → site.js 的 mapUrl / mapEmbed 认得的形状 */
const branchPlace=b=>({name:b.n,gq:b.gq||b.n,pid:b.pid,cid:b.cid,geo:b.geo});

/* ---------- 「附近」：直线距离 ----------
   清单页选了起点（酒店／某个景点）之后设 FOOD_ORIGIN={n,geo}，卡片上多一颗距离 pill。
   多分店的品牌取最近的一家 —— 「离水城 0.6 km」说的是最近那家分店，不是主店。
   直线距离，不是车程：老城的小巷和环路会让实际路程长不少。 */
let FOOD_ORIGIN=null;
const kmBetween=(a,b)=>{
  const t=Math.PI/180, dla=(b[0]-a[0])*t, dlo=(b[1]-a[1])*t;
  const x=Math.sin(dla/2)**2+Math.cos(a[0]*t)*Math.cos(b[0]*t)*Math.sin(dlo/2)**2;
  return 6371*2*Math.asin(Math.sqrt(x));
};
const foodKm=(d,o)=>Math.min(...d.br.map(b=>kmBetween(o.geo,b.geo)));
const nearBranch=(d,o)=>d.br.reduce((m,b)=>kmBetween(o.geo,b.geo)<kmBetween(o.geo,m.geo)?b:m,d.br[0]);
const kmText=v=>v<1?Math.round(v*1000)+" m":v.toFixed(1)+" km";

const FUI={
  tagPills:d=>d.tags.map(t=>`<span class="pill tag ${t==="必吃"?"pick":"soga"}">${t}</span>`).join(""),

  metaPills:d=>FUI.tagPills(d)+
    (FOOD_ORIGIN?`<span class="pill txt ink">${esc(FOOD_ORIGIN.n)} ${kmText(foodKm(d,FOOD_ORIGIN))}${d.br.length>1?"（最近一家）":""}</span>`:"")+
    d.areas.map(a=>`<span class="pill txt ink">${esc(a)}</span>`).join("")+
    `<span class="pill txt">${esc(d.kind)}</span>`+
    (d.br.length>1?`<span class="pill txt">${d.br.length} 家分店</span>`:"")+
    `<span class="pill">${d.price==null?"谷歌未标人均":"人均 "+moneyHTML(d.price)}</span>`+
    `<span class="pill">${openText(d)}</span>`+
    d.off.map(x=>`<span class="pill txt warn">${x}休</span>`).join("")+
    `<span class="pill ${scamClass(d.scam)}">踩坑${d.scam}</span>`,

  score:d=>`<span class="score">
      <span class="g">${d.g?`<span class="gr">★ ${d.g.toFixed(1)}</span>${d.gc?`<span class="gc">谷歌 ${money(d.gc)} 条</span>`:'<span class="gc">条数未核实</span>'}`:'<span class="none">评分<br>未核实到</span>'}${d.ta?`<span class="gc">TA ${d.ta.toFixed(1)}${d.tac?" · "+money(d.tac):""}</span>`:""}</span>
      <span class="tot" aria-label="我的总分 ${foodTotal(d)} / 10"><span class="n">${foodTotal(d)}</span><span class="d">/10</span></span>
    </span>`,

  card:(d,h="h2")=>`<li class="panel card${d.tags.includes("必吃")?" must":""}">
    <a class="head" href="${foodHref(d)}">
      ${d.img?`<img class="thumb" src="${foodThumb(d)}" alt="" width="74" height="74" loading="lazy" decoding="async">`:'<span class="thumb noimg" aria-hidden="true">—</span>'}
      <div class="headmain">
        <div class="titleline"><${h} class="name">${esc(d.n)}</${h}><span class="local">${esc(d.ln)}</span></div>
        <div class="metaline">${FUI.metaPills(d)}</div>
      </div>
      ${FUI.score(d)}
    </a>
  </li>`,

  /* 照片 1–5 张：宽屏两列，张数为奇数时首图横跨整行；地图另起一整行，每家分店一个按钮 */
  media:d=>{
    const n=d.img||0;
    const shots=n
      ? Array.from({length:n},(_,i)=>`<figure class="shot"><img src="${foodPhoto(d,i+1)}" alt="${esc(d.n)} 实拍 ${i+1}" loading="${i<2?"eager":"lazy"}" decoding="async"></figure>`).join("")
      : '<div class="shot nophoto">没有找到可用的照片</div>';
    const multi=d.br.length>1;
    const btn=d.br.map(b=>`<a class="mapbtn" href="${mapUrl(branchPlace(b))}" target="_blank" rel="noopener"${mapBlocked?"":" hidden"}>
        <span class="mapbtn-i" aria-hidden="true">◎</span>
        <span><b>在地图中打开${multi?" · "+esc(b.n):""}</b><small>${esc(b.area)} · ${esc(b.dist)} · 约 ${b.drive} 分钟</small></span>
      </a>`).join("");
    const frame=mapBlocked?"":`<iframe class="mapframe" src="${mapEmbed(branchPlace(d.br[0]))}" title="${esc(d.n)} 位置" referrerpolicy="no-referrer-when-downgrade"></iframe>`;
    return `<div class="media${n<2?" single":""}${n>2&&n%2?" odd":""}"><div class="shots">${shots}</div><div class="mapwrap">${frame}${btn}</div></div>`;
  },

  /* 分店表：一家一行，名称 + 区域 + 车程 + 地图链接 */
  branches:d=>d.br.length<2?"":`<div class="branchlist"><b class="h">${d.br.length} 家分店（地图按钮每家一个）</b><ul>${
    d.br.map(b=>`<li><a href="${mapUrl(branchPlace(b))}" target="_blank" rel="noopener">${esc(b.n)}</a><span>${esc(b.area)} · ${esc(b.dist)} · 约 ${b.drive} 分钟</span></li>`).join("")
  }</ul></div>`,

  /* near 里是景点 slug；详情页加载了 spots.js 时显示成链接 */
  nearLinks:list=>{
    if(typeof SPOTS==="undefined"||!list||!list.length) return "";
    return list.map(s=>{const x=SPOTS.find(y=>slugOf(y)===s);return x?`<a href="${spotHref(x)}">${esc(x.n)}</a>`:"";}).filter(Boolean).join("、");
  },

  detail:d=>{
    const bars=FOOD_SCORE_KEYS.map(([k,l])=>`<div class="bar"><div class="lbl"><span>${l}</span><b>${d.s[k]}</b></div><div class="track"><div class="fill" style="width:${d.s[k]*10}%"></div></div></div>`).join("");
    const near=FUI.nearLinks(d.near);
    const geo=d.br.map(b=>(d.br.length>1?esc(b.n)+" ":"")+b.geo.map(v=>v.toFixed(6)).join(", ")).join(" ｜ ");
    const fields=[
      /* 人均写「无」时不挂来源角标 —— 没有数字就没有来源 */
      ["人均",/^无/.test(d.cost)?rich(d.cost):rich(d.cost)+UI.srcmark(d.src)],
      ["招牌必点",esc(d.dish)],
      ["营业时间",esc(d.hours)],
      ["什么时候去",esc(d.best)],
      ["餐段",esc(d.meal.join(" / "))+(d.veg?' · <span class="pill txt good">素食友好</span>':"")+(d.local?"":' · <span class="pill txt">外来／连锁</span>')],
      ["位置与车程",`${d.areas.map(esc).join("、")} · ${esc(d.br[0].dist)} · 约 ${d.drive} 分钟${d.br.length>1?`（最近的一家：${esc(d.br[0].n)}）`:""}<br><small class="geo">车程为路网估算，不含拥堵；坐标 ${geo}</small>`],
      ...(near?[["顺路景点",near]]:[]),
      ["口味提示",esc(d.flavor)],
      ["环境与卫生",esc(d.env)],
      ["支付",esc(d.pay)],
      ["踩坑风险",`<span class="pill ${scamClass(d.scam)}">${d.scam}风险</span> ${rich(d.scamNote)}`]
    ].map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
    return `<p class="lede">${esc(d.intro)}</p>
      ${FUI.media(d)}
      ${FUI.branches(d)}
      <div class="bars">${bars}</div>
      <dl class="fields">${fields}</dl>
      ${d.buzz?UI.buzz(d.buzz):""}
      ${d.avoid?`<div class="callout soga"><b class="h">什么人会觉得踩雷</b>${rich(d.avoid)}</div>`:""}
      ${d.lite?'<div class="callout"><b class="h">精简收录</b>这一条只核实了评分、人均、营业时间与分店位置，没有逐条口碑与踩雷点。</div>':""}
      <div class="linkrow"><span class="label">来源</span><a href="${mapUrl(branchPlace(d.br[0]))}" target="_blank" rel="noopener">谷歌地图</a>${d.srcs.map(([t,u])=>`<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a>`).join("")}</div>
      ${d.img?`<p class="photocredit">照片为 Google 地图用户上传，${d.gp?"直接取自地图地点页":"经 Wanderlog 地点页转存"}，版权归原拍摄者，仅作私人行程笔记。</p>`:""}`;
  }
};
