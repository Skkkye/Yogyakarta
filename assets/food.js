/* =============================================================
   food.js —— 美食相关的工具函数与组件（food.html 清单 / eat.html 详情共用）

   · 依赖：data/foods.js、assets/site.js 先加载。esc / moneyHTML / rich / placesOf /
     mapUrl / mapEmbed / geoText / watchMaps / CHECK / UI.srcmark / scamClass 都来自 site.js。
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

const FUI={
  tagPills:d=>d.tags.map(t=>`<span class="pill tag ${t==="必吃"?"pick":"soga"}">${t}</span>`).join(""),

  metaPills:d=>FUI.tagPills(d)+
    `<span class="pill txt ink">${esc(d.area)}</span>`+
    `<span class="pill txt">${esc(d.kind)}</span>`+
    `<span class="pill">${d.price==null?"人均未核实":"人均 "+moneyHTML(d.price)}</span>`+
    `<span class="pill">${openText(d)}</span>`+
    d.off.map(x=>`<span class="pill txt warn">${x}休</span>`).join("")+
    `<span class="pill ${scamClass(d.scam)}">踩坑${d.scam}</span>`,

  score:d=>`<span class="score">
      <span class="g">${d.g?`<span class="gr">★ ${d.g.toFixed(1)}</span><span class="gc">谷歌 ${money(d.gc)} 条</span>`:'<span class="none">评分<br>未核实到</span>'}${d.ta?`<span class="gc">TA ${d.ta.toFixed(1)} · ${money(d.tac)}</span>`:""}</span>
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

  /* 照片 3–5 张：宽屏两列，张数为奇数时首图横跨整行；地图另起一整行 */
  media:d=>{
    const n=d.img||0;
    const shots=n
      ? Array.from({length:n},(_,i)=>`<figure class="shot"><img src="${foodPhoto(d,i+1)}" alt="${esc(d.n)} 实拍 ${i+1}" loading="${i<2?"eager":"lazy"}" decoding="async"></figure>`).join("")
      : '<div class="shot nophoto">没有找到可用的照片</div>';
    const p=placesOf(d)[0];
    const btn=`<a class="mapbtn" href="${mapUrl(p)}" target="_blank" rel="noopener"${mapBlocked?"":" hidden"}>
        <span class="mapbtn-i" aria-hidden="true">◎</span>
        <span><b>在地图中打开</b><small>${esc(d.dist)} · 约 ${d.drive} 分钟</small></span>
      </a>`;
    const frame=mapBlocked?"":`<iframe class="mapframe" src="${mapEmbed(p)}" title="${esc(d.n)} 位置" referrerpolicy="no-referrer-when-downgrade"></iframe>`;
    return `<div class="media${n<2?" single":""}${n>2&&n%2?" odd":""}"><div class="shots">${shots}</div><div class="mapwrap">${frame}${btn}</div></div>`;
  },

  /* near 里是景点 slug；详情页加载了 spots.js 时显示成链接，否则不显示 */
  nearLinks:d=>{
    if(typeof SPOTS==="undefined"||!d.near.length) return "";
    return d.near.map(s=>{const x=spotBySlug(s);return x?`<a href="${spotHref(x)}">${esc(x.n)}</a>`:"";}).filter(Boolean).join("、");
  },

  detail:d=>{
    const bars=FOOD_SCORE_KEYS.map(([k,l])=>`<div class="bar"><div class="lbl"><span>${l}</span><b>${d.s[k]}</b></div><div class="track"><div class="fill" style="width:${d.s[k]*10}%"></div></div></div>`).join("");
    const near=FUI.nearLinks(d);
    const fields=[
      ["人均",rich(d.cost)+UI.srcmark(d.src)],
      ["招牌必点",esc(d.dish)],
      ["营业时间",esc(d.hours)],
      ["什么时候去",esc(d.best)],
      ["餐段",esc(d.meal.join(" / "))+(d.veg?' · <span class="pill txt good">素食友好</span>':"")],
      ["位置与车程",`${esc(d.area)} · ${esc(d.dist)} · 约 ${d.drive} 分钟<br><small class="geo">车程为路网估算，不含拥堵${geoText(d)?"；坐标 "+geoText(d):""}</small>`],
      ...(near?[["顺路景点",near]]:[]),
      ["口味提示",esc(d.flavor)],
      ["环境与卫生",esc(d.env)],
      ["支付",esc(d.pay)],
      ["踩坑风险",`<span class="pill ${scamClass(d.scam)}">${d.scam}风险</span> ${rich(d.scamNote)}`]
    ].map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
    return `<p class="lede">${esc(d.intro)}</p>
      ${FUI.media(d)}
      <div class="bars">${bars}</div>
      <dl class="fields">${fields}</dl>
      ${UI.buzz(d.buzz)}
      <div class="callout soga"><b class="h">什么人会觉得踩雷</b>${rich(d.avoid)}</div>
      <div class="linkrow"><span class="label">来源</span><a href="${mapUrl(placesOf(d)[0])}" target="_blank" rel="noopener">谷歌地图</a>${d.srcs.map(([t,u])=>`<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a>`).join("")}</div>
      <p class="photocredit">照片为 Google 地图用户上传，经 Wanderlog 地点页转存，版权归原拍摄者。</p>`;
  }
};
