/* =============================================================
   eat.js —— 美食详情页（eat.html?id=<slug>）
   版面全部来自 food.js 的 FUI，这里只负责找到数据、拼装。
   ============================================================= */

(function(){
  const id=new URLSearchParams(location.search).get("id")||"";
  const d=foodBySlug(id);
  const root=document.getElementById("eat");

  if(!d){
    document.title="没有这家店 · 日惹美食清单";
    root.innerHTML=`<header class="pagehead">
        <p class="eyebrow"><a href="food.html">美食清单</a></p>
        <h1>没有这家店</h1>
        <p class="lede">地址里的 id「${esc(id)}」对不上任何店，可能是改过名。回清单里找找。</p>
      </header>`;
    return;
  }

  document.title=`${d.n} · 日惹美食清单`;
  /* 同片区 = 和本店任一分店落在同一个区域；主店所在区优先 */
  const home=d.areas[0];
  const related=FOODS.filter(x=>x!==d&&x.areas.some(a=>d.areas.includes(a)))
    .sort((a,b)=>(b.areas[0]===home)-(a.areas[0]===home)||foodTotal(b)-foodTotal(a)).slice(0,12);

  root.innerHTML=`<header class="pagehead">
      <p class="eyebrow"><a href="food.html">美食清单</a> / ${esc(d.areas.join(" · "))}</p>
      <div class="spottitle">
        <div class="titleline"><h1>${esc(d.n)}</h1><span class="local">${esc(d.ln)}</span></div>
        ${FUI.score(d)}
      </div>
      <div class="metaline">${FUI.metaPills(d)}</div>
    </header>
    <article class="detail">${FUI.detail(d)}</article>
    ${related.length?`<section class="section" aria-labelledby="relHead">
      <div class="sechead">
        <p class="eyebrow">同一片区</p>
        <h2 id="relHead">${esc(home)}一带的其他 ${related.length} 家</h2>
      </div>
      <ul class="list">${related.map(x=>FUI.card(x,"h3")).join("")}</ul>
    </section>`:""}`;

  watchMaps(root);
})();
