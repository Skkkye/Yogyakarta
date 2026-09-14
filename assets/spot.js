/* =============================================================
   spot.js —— 景点详情页（spot.html?id=<slug>）
   版面全部来自 site.js 的 UI，这里只负责找到数据、拼装。
   ============================================================= */

(function(){
  const id=new URLSearchParams(location.search).get("id")||"";
  const d=spotBySlug(id);
  const root=document.getElementById("spot");

  if(!d){
    document.title="没有这个景点 · 日惹景点核准清单";
    root.innerHTML=`<header class="pagehead">
        <p class="eyebrow"><a href="index.html">景点清单</a></p>
        <h1>没有这个景点</h1>
        <p class="lede">地址里的 id「${esc(id)}」对不上任何景点，可能是景点改过名。回清单里找找。</p>
      </header>`;
    return;
  }

  document.title=`${d.n} · 日惹景点核准清单`;
  const related=SPOTS.filter(x=>x.c===d.c&&x!==d).sort((a,b)=>total(b)-total(a));

  root.innerHTML=`<header class="pagehead">
      <p class="eyebrow"><a href="index.html">景点清单</a> / ${esc(d.c)}</p>
      <div class="spottitle">
        <div class="titleline"><h1>${esc(d.n)}</h1><span class="local">${esc(d.ln)}</span></div>
        ${UI.score(d)}
      </div>
      <div class="metaline">${UI.metaPills(d)}</div>
    </header>
    <article class="detail">${UI.detail(d)}</article>
    ${related.length?`<section class="section" aria-labelledby="relHead">
      <div class="sechead">
        <p class="eyebrow">同一条线路</p>
        <h2 id="relHead">${esc(d.c)}的其他 ${related.length} 处</h2>
      </div>
      <ul class="list">${related.map(x=>UI.card(x,"h3")).join("")}</ul>
    </section>`:""}`;

  watchMaps(root);
})();
