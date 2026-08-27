
const STORAGE_KEY="mi_portafolio_cripto_v1_1";
const state={assets:[],prices:{},marketContext:{},displayCurrency:"mxn",selectedCoin:null,searchTimer:null,avgPresets:{mxn:[5000,10000,20000],usd:[250,500,1000]}};
const $=id=>document.getElementById(id); const num=v=>Number(v||0);
const fmt=(n,c=state.displayCurrency)=>Number.isFinite(Number(n))?new Intl.NumberFormat("es-MX",{style:"currency",currency:c.toUpperCase(),maximumFractionDigits:Math.abs(Number(n))<10?4:2}).format(Number(n)):"—";
const pctClass=v=>!Number.isFinite(v)||v===0?"":v>0?"positive":"negative"; const formatPct=v=>Number.isFinite(v)?`${v>=0?"+":""}${v.toFixed(2)}%`:"—";
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function load(){try{const d=JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}");state.assets=Array.isArray(d.assets)?d.assets:[];state.displayCurrency=d.displayCurrency||"mxn";if(d.avgPresets&&typeof d.avgPresets==="object")state.avgPresets={...state.avgPresets,...d.avgPresets}}catch{state.assets=[]}}
function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify({assets:state.assets,displayCurrency:state.displayCurrency,avgPresets:state.avgPresets}))}
function getPrice(a,c=state.displayCurrency){return state.prices?.[a.coinId]?.[c]}
function fxFor(a){const c=state.prices?.[a.coinId]; return c?.usd&&c?.mxn?c.mxn/c.usd:null}
function optionalNum(v){if(v===null||v===undefined||String(v).trim()==="")return null;const n=Number(v);return Number.isFinite(n)?n:null}
function convertPrice(v,from,to,a){v=optionalNum(v); if(v===null||v<=0)return NaN; if(from===to)return v; const fx=fxFor(a); if(!fx)return NaN; return from==="usd"&&to==="mxn"?v*fx:v/fx}
function totalsFor(a){
  let amount=0,cost=0,hasUnknownCost=false;
  (a.lots||[]).forEach(l=>{const qty=num(l.amount);amount+=qty;const p=convertPrice(l.buyPrice,l.buyCurrency||"usd",state.displayCurrency,a);if(Number.isFinite(p))cost+=qty*p;else if(qty>0)hasUnknownCost=true;});
  const price=getPrice(a), value=Number.isFinite(price)?amount*price:NaN;
  const avg=!hasUnknownCost&&amount>0&&cost>0?cost/amount:NaN;
  const pnl=!hasUnknownCost&&cost>0&&Number.isFinite(value)?value-cost:NaN, pnlPct=!hasUnknownCost&&cost>0&&Number.isFinite(value)?pnl/cost*100:NaN;
  return {amount,cost:hasUnknownCost?NaN:cost,price,value,avg,pnl,pnlPct,hasUnknownCost};
}
function goalState(goal,a){
  const cur=getPrice(a); if(!Number.isFinite(cur)||!num(goal.price)) return {status:"far",label:"Sin precio",distance:NaN};
  const target=convertPrice(goal.price,goal.currency||"usd",state.displayCurrency,a); if(!Number.isFinite(target))return {status:"far",label:"Sin conversión",distance:NaN};
  const distance=(target-cur)/cur*100;
  if(cur>=target)return {status:"hit",label:"Meta alcanzada",distance};
  if(distance<=5)return {status:"near",label:"Meta casi alcanzada",distance};
  if(distance<=15)return {status:"close",label:"Acercándose",distance};
  return {status:"far",label:"Lejos de meta",distance};
}
let pricesRequestInFlight=false;
function validPriceRecord(x){return x&&((Number.isFinite(Number(x.usd))&&Number(x.usd)>0)||(Number.isFinite(Number(x.mxn))&&Number(x.mxn)>0))}
function normalizePriceRecord(x,usdMxn){
  if(!x||typeof x!=="object")return null;
  let usd=Number(x.usd),mxn=Number(x.mxn),chUsd=Number(x.usd_24h_change),chMxn=Number(x.mxn_24h_change);
  if(!(usd>0)&&mxn>0&&usdMxn>0)usd=mxn/usdMxn;
  if(!(mxn>0)&&usd>0&&usdMxn>0)mxn=usd*usdMxn;
  if(!(usd>0)&&!(mxn>0))return null;
  return {usd:usd>0?usd:null,mxn:mxn>0?mxn:null,usd_24h_change:Number.isFinite(chUsd)?chUsd:null,mxn_24h_change:Number.isFinite(chMxn)?chMxn:(Number.isFinite(chUsd)?chUsd:null),last_updated_at:Number(x.last_updated_at)||Math.floor(Date.now()/1000)};
}
function mergePrices(base,incoming,usdMxn){
  const out={...(base||{})};
  Object.entries(incoming||{}).forEach(([id,x])=>{const n=normalizePriceRecord(x,usdMxn);if(n)out[id]={...(out[id]||{}),...n}});
  return out;
}
function countUsefulPrices(prices,ids){return ids.filter(id=>validPriceRecord(prices?.[id])).length}
async function fetchJson(url,timeoutMs=9000){
  const ctl=new AbortController(); const timer=setTimeout(()=>ctl.abort(),timeoutMs);
  try{const r=await fetch(String(url),{signal:ctl.signal,cache:"no-store"});if(!r.ok){const e=new Error(`HTTP ${r.status}`);e.status=r.status;throw e}const data=await r.json();return data}finally{clearTimeout(timer)}
}
async function fetchUsdMxn(){
  const tries=[
    async()=>Number((await fetchJson("https://open.er-api.com/v6/latest/USD",6500))?.rates?.MXN),
    async()=>Number((await fetchJson("https://api.frankfurter.app/latest?from=USD&to=MXN",6500))?.rates?.MXN),
    async()=>Number((await fetchJson("https://api.coinbase.com/v2/exchange-rates?currency=USD",6500))?.data?.rates?.MXN)
  ];
  for(const fn of tries){try{const x=await fn();if(Number.isFinite(x)&&x>0)return x}catch{}}
  return null;
}
async function fetchCoinGeckoPrices(ids){
  const u=new URL("https://api.coingecko.com/api/v3/simple/price");
  u.searchParams.set("ids",ids.join(","));u.searchParams.set("vs_currencies","usd,mxn");u.searchParams.set("include_24hr_change","true");u.searchParams.set("include_last_updated_at","true");
  const d=await fetchJson(u,9000);
  if(!d||typeof d!=="object"||countUsefulPrices(d,ids)===0)throw new Error("CoinGecko respondió sin precios");
  return d;
}
async function fetchSymbolFallback(missingIds,usdMxn){
  const out={};
  const byId=new Map(state.assets.map(a=>[a.coinId,a]));
  for(const id of missingIds){
    const a=byId.get(id); if(!a)continue;
    const sym=String(a.symbol||"").toUpperCase().replace(/[^A-Z0-9]/g,""); if(!sym)continue;
    let usd=null,ch=null;
    try{
      const d=await fetchJson(`https://data-api.binance.vision/api/v3/ticker/24hr?symbol=${encodeURIComponent(sym+"USDT")}`,6000);
      const p=Number(d?.lastPrice);if(p>0){usd=p;const c=Number(d?.priceChangePercent);ch=Number.isFinite(c)?c:null}
    }catch{}
    if(!(usd>0)){
      try{const d=await fetchJson(`https://api.coinbase.com/v2/prices/${encodeURIComponent(sym)}-USD/spot`,6000);const p=Number(d?.data?.amount);if(p>0)usd=p}catch{}
    }
    if(usd>0)out[id]={usd,mxn:usdMxn>0?usd*usdMxn:null,usd_24h_change:ch,mxn_24h_change:ch,last_updated_at:Math.floor(Date.now()/1000)};
  }
  return out;
}
async function fetchPrices(){
  if(!state.assets.length){render();return}
  if(pricesRequestInFlight)return;
  pricesRequestInFlight=true;
  const ids=[...new Set(state.assets.map(a=>a.coinId).filter(Boolean))];
  const refresh=$("refreshBtn");if(refresh)refresh.textContent="…";clearError();
  let cached={};try{cached=JSON.parse(localStorage.getItem(STORAGE_KEY+"_prices")||"{}")||{}}catch{}
  let merged={...cached,...state.prices};
  const errors=[];
  try{
    let fx=await fetchUsdMxn();
    try{merged=mergePrices(merged,await fetchCoinGeckoPrices(ids),fx)}catch(e){errors.push("CoinGecko")}
    let missing=ids.filter(id=>!validPriceRecord(merged[id]));
    if(missing.length){
      try{const fb=await fetchSymbolFallback(missing,fx);merged=mergePrices(merged,fb,fx)}catch(e){errors.push("respaldo")}
    }
    // Si hay USD pero falta MXN, intenta FX una vez más y completa sin borrar precios válidos.
    if(!fx)fx=await fetchUsdMxn();
    if(fx)merged=mergePrices({},merged,fx);
    const useful=countUsefulPrices(merged,ids);
    if(useful===0)throw new Error("Ningún proveedor devolvió precios utilizables");
    state.prices=merged;
    localStorage.setItem(STORAGE_KEY+"_prices",JSON.stringify(state.prices));localStorage.setItem(STORAGE_KEY+"_prices_time",String(Date.now()));
    if($("lastUpdated"))$("lastUpdated").textContent="Actualizado "+new Date().toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"});
    render();
    const stillMissing=ids.filter(id=>!validPriceRecord(state.prices[id]));
    if(stillMissing.length)showError(`Se actualizaron ${useful} de ${ids.length} criptos. Faltan ${stillMissing.length}; toca ↻ para reintentar.`);
  }catch(e){
    state.prices=merged;
    render();
    showError(Object.keys(merged||{}).some(id=>validPriceRecord(merged[id]))?"No se pudieron renovar todos los precios. Se conservan los últimos precios válidos.":"No se obtuvo ningún precio válido. La cartera sigue guardada; toca ↻ para reintentar.");
  }finally{if(refresh)refresh.textContent="↻";pricesRequestInFlight=false}
}
function showError(msg){let el=document.querySelector(".error-banner");if(!el){el=document.createElement("div");el.className="error-banner";document.querySelector(".container").prepend(el)}el.textContent=msg}
function clearError(){document.querySelector(".error-banner")?.remove()}
function render(){
  document.querySelectorAll(".currency").forEach(b=>b.classList.toggle("active",b.dataset.currency===state.displayCurrency));
  $("coinCount").textContent=`${state.assets.length} ${state.assets.length===1?"activo":"activos"}`;$("emptyState").classList.toggle("hidden",state.assets.length>0);$("portfolioList").classList.toggle("hidden",state.assets.length===0);
  const list=$("portfolioList");list.innerHTML="";let totalValue=0,totalCost=0;
  const calc=state.assets.map(a=>({a,t:totalsFor(a)}));calc.forEach(x=>{if(Number.isFinite(x.t.value))totalValue+=x.t.value;if(Number.isFinite(x.t.cost)&&x.t.cost>0)totalCost+=x.t.cost});
  calc.forEach(({a,t},index)=>{
    const n=$("assetTemplate").content.cloneNode(true);n.querySelector(".coin-avatar").textContent=(a.symbol||"?").slice(0,1).toUpperCase();n.querySelector(".coin-name").textContent=a.name;n.querySelector(".symbol").textContent=a.symbol;n.querySelector(".amount-text").textContent=`${t.amount} ${a.symbol}`;n.querySelector(".current-price").textContent=fmt(t.price);n.querySelector(".asset-value").textContent=fmt(t.value);n.querySelector(".summary-price").textContent=fmt(t.price);n.querySelector(".summary-value").textContent=Number.isFinite(t.value)?`Valor ${fmt(t.value)}`:"Valor —";n.querySelector(".avg-price").textContent=Number.isFinite(t.avg)?fmt(t.avg):(t.hasUnknownCost?"Sin precio de compra":"Sin compras");
    const ch=state.prices?.[a.coinId]?.[`${state.displayCurrency}_24h_change`],chEl=n.querySelector(".change24");chEl.textContent=Number.isFinite(ch)?`${formatPct(ch)} en 24 h`:"Cambio 24 h —";chEl.classList.add(pctClass(ch));
    const pe=n.querySelector(".asset-pnl");pe.textContent=Number.isFinite(t.pnl)?`${fmt(t.pnl)} · ${formatPct(t.pnlPct)}`:"Sin costo";pe.classList.add(pctClass(t.pnl));
    populateMarketContext(n,a,t);const loc=n.querySelector(".locations-row");renderLocationGroups(loc,a,index);
    const goals=n.querySelector(".goals-row");let best=null;(a.goals||[]).forEach(g=>{const gs=goalState(g,a),c=document.createElement("span");c.className="chip goal-chip";c.innerHTML=`<span class="status-dot status-${gs.status}"></span>${escapeHtml(g.label||"Meta")} ${fmt(g.price,g.currency||"usd")} · ${gs.label}${Number.isFinite(gs.distance)&&gs.distance>0?` (${gs.distance.toFixed(1)}%)`:""}`;goals.appendChild(c);if(["hit","near","close"].includes(gs.status)&&(!best||(["hit","near","close"].indexOf(gs.status)<["hit","near","close"].indexOf(best.status))))best=gs});
    if(best){const d=n.querySelector(".goal-dot");d.classList.remove("hidden");d.classList.add(`status-${best.status}`)}
    n.querySelector(".allocation").textContent=totalValue&&Number.isFinite(t.value)?`${(t.value/totalValue*100).toFixed(1)}% del portafolio`:"— del portafolio";
    const summary=n.querySelector(".asset-summary"),details=n.querySelector(".asset-details"),chevron=n.querySelector(".chevron");summary.addEventListener("click",()=>{const willOpen=details.classList.contains("hidden");document.querySelectorAll("#portfolioList .asset-details").forEach(d=>d.classList.add("hidden"));document.querySelectorAll("#portfolioList .asset-summary").forEach(b=>b.setAttribute("aria-expanded","false"));document.querySelectorAll("#portfolioList .chevron").forEach(c=>c.classList.remove("open"));if(willOpen){details.classList.remove("hidden");summary.setAttribute("aria-expanded","true");chevron.classList.add("open")}});n.querySelector(".avg-sim-btn").addEventListener("click",e=>{e.stopPropagation();openAverageSimulator(index)});n.querySelector(".edit-btn").addEventListener("click",e=>{e.stopPropagation();openEdit(index)});n.querySelector(".delete-btn").addEventListener("click",e=>{e.stopPropagation();if(confirm(`¿Eliminar ${a.name}?`)){state.assets.splice(index,1);save();render();fetchPrices()}});
    list.appendChild(n)
  });
  const hasIncompleteCost=calc.some(x=>x.t.hasUnknownCost);const totalPnl=!hasIncompleteCost&&totalCost?totalValue-totalCost:NaN,totalPct=!hasIncompleteCost&&totalCost?totalPnl/totalCost*100:NaN;$("totalValue").textContent=calc.some(x=>Number.isFinite(x.t.value))?fmt(totalValue):"—";$("totalCost").textContent=totalCost?fmt(totalCost):"—";$("totalPnl").textContent=Number.isFinite(totalPnl)?fmt(totalPnl):"—";$("totalPnl").className=pctClass(totalPnl);$("totalPct").textContent=formatPct(totalPct);$("totalPct").className=pctClass(totalPct);
  renderGoals(calc);renderAllocation(calc,totalValue)
}

function lotMetrics(a,l){
  const amount=num(l.amount), cur=getPrice(a);
  const buy=convertPrice(l.buyPrice,l.buyCurrency||"usd",state.displayCurrency,a);
  const cost=Number.isFinite(buy)?amount*buy:NaN;
  const value=Number.isFinite(cur)?amount*cur:NaN;
  const pnl=Number.isFinite(cost)&&Number.isFinite(value)?value-cost:NaN;
  const pnlPct=cost&&Number.isFinite(value)?pnl/cost*100:NaN;
  return {amount,buy,cost,value,pnl,pnlPct};
}
function renderLocationGroups(container,a,assetIndex){
  container.innerHTML="";
  const groups=new Map();
  (a.lots||[]).forEach((lot,lotIndex)=>{const key=(lot.location||"Sin ubicación").trim()||"Sin ubicación";if(!groups.has(key))groups.set(key,[]);groups.get(key).push({lot,lotIndex})});
  groups.forEach((items,location)=>{
    let amount=0,cost=0,value=0,validCost=true,validValue=true;
    items.forEach(({lot})=>{const m=lotMetrics(a,lot);amount+=m.amount;if(Number.isFinite(m.cost))cost+=m.cost;else validCost=false;if(Number.isFinite(m.value))value+=m.value;else validValue=false});
    const pnl=validCost&&validValue?value-cost:NaN,pnlPct=cost&&Number.isFinite(pnl)?pnl/cost*100:NaN;
    const group=document.createElement("div");group.className="location-group";
    group.innerHTML=`<button type="button" class="location-summary" aria-expanded="false"><div class="location-summary-main"><div class="location-summary-left"><strong>${escapeHtml(location)}</strong><small>${amount} ${escapeHtml(a.symbol)} · ${items.length} ${items.length===1?"compra":"compras"}</small></div><div class="location-summary-right"><strong>${validValue?fmt(value):"—"}</strong><small class="group-pnl ${pctClass(pnl)}">${Number.isFinite(pnl)?`${fmt(pnl)} · ${formatPct(pnlPct)}`:"—"}</small></div></div><span class="location-chevron">⌄</span></button><div class="location-lots hidden"></div>`;
    const list=group.querySelector(".location-lots");
    items.forEach(({lot,lotIndex},i)=>{
      const m=lotMetrics(a,lot), card=document.createElement("div");card.className="lot-card";
      const purposeLabel=lot.purpose==="opportunity"?"Nueva oportunidad":lot.purpose==="recovery"?"Recuperación":"Largo plazo";
      const target=lot.targetPrice>0?convertPrice(lot.targetPrice,lot.targetCurrency||lot.buyCurrency||"usd",state.displayCurrency,a):NaN;
      const targetProfit=Number.isFinite(target)&&Number.isFinite(m.cost)?m.amount*target-m.cost:NaN;
      const targetPct=m.cost&&Number.isFinite(targetProfit)?targetProfit/m.cost*100:NaN;
      card.innerHTML=`<div class="lot-top"><div class="lot-main"><strong>Compra ${i+1} · ${m.amount} ${escapeHtml(a.symbol)}</strong><small>Precio de compra: ${fmt(convertPrice(lot.buyPrice,lot.buyCurrency||"usd",state.displayCurrency,a))} / ${escapeHtml(a.symbol)}</small><span class="purpose-badge purpose-${escapeHtml(lot.purpose||"long")}">${purposeLabel}</span></div><strong class="${pctClass(m.pnl)}">${formatPct(m.pnlPct)}</strong></div><div class="lot-stats"><div><span>Invertido</span><strong>${fmt(m.cost)}</strong></div><div><span>Valor actual</span><strong>${fmt(m.value)}</strong></div><div><span>Ganancia / pérdida</span><strong class="${pctClass(m.pnl)}">${fmt(m.pnl)}</strong></div></div>${Number.isFinite(target)?`<div class="lot-target"><span>Objetivo propio ${fmt(target)}</span><strong class="${pctClass(targetProfit)}">${Number.isFinite(targetProfit)?`${fmt(targetProfit)} · ${formatPct(targetPct)}`:"—"}</strong></div>`:""}<div class="lot-actions"><button type="button" class="secondary lot-edit">Editar compra</button><button type="button" class="danger lot-delete">Eliminar compra</button></div>`;
      card.querySelector(".lot-edit").addEventListener("click",e=>{e.stopPropagation();openLotEdit(assetIndex,lotIndex)});
      card.querySelector(".lot-delete").addEventListener("click",e=>{e.stopPropagation();deleteLot(assetIndex,lotIndex)});
      list.appendChild(card);
    });
    const summary=group.querySelector(".location-summary"),chev=group.querySelector(".location-chevron");
    summary.addEventListener("click",()=>{const open=list.classList.toggle("hidden")===false;summary.setAttribute("aria-expanded",String(open));chev.classList.toggle("open",open)});
    container.appendChild(group);
  });
}
function openLotEdit(assetIndex,lotIndex){
  const lot=state.assets?.[assetIndex]?.lots?.[lotIndex];if(!lot)return;
  $("lotAssetIndex").value=assetIndex;$("lotIndex").value=lotIndex;$("lotEditAmount").value=lot.amount??"";$("lotEditPrice").value=lot.buyPrice??"";$("lotEditCurrency").value=lot.buyCurrency||"usd";$("lotEditLocation").value=lot.location||"";$("lotEditPurpose").value=lot.purpose||"long";$("lotEditTarget").value=lot.targetPrice??"";$("lotEditTargetCurrency").value=lot.targetCurrency||lot.buyCurrency||"usd";$("lotDialog").showModal();
}
function closeLotDialog(){$("lotDialog").close()}
function deleteLot(assetIndex,lotIndex){
  const a=state.assets?.[assetIndex];if(!a)return;const lot=a.lots?.[lotIndex];
  if(!confirm(`¿Eliminar esta compra de ${a.symbol}${lot?.location?` en ${lot.location}`:""}?`))return;
  if(a.lots.length===1){if(confirm(`Era la última compra de ${a.symbol}. ¿Eliminar también la cripto del portafolio?`)){state.assets.splice(assetIndex,1);save();render()}return}
  a.lots.splice(lotIndex,1);save();render();
}


function getPresetValues(){
  const c=state.displayCurrency;
  const defaults=c==="mxn"?[5000,10000,20000]:[250,500,1000];
  const vals=Array.isArray(state.avgPresets?.[c])?state.avgPresets[c]:defaults;
  return [0,1,2].map(i=>num(vals[i])||defaults[i]);
}
function setPresetValues(vals){state.avgPresets[state.displayCurrency]=vals.map(v=>Math.max(0,num(v)));save()}
function simulateAverage(a,invest){
  const t=totalsFor(a), price=Number(t.price), money=num(invest);
  if(!(t.amount>0)||!(t.cost>0)||!(price>0)||!(money>0))return null;
  const addedAmount=money/price,newAmount=t.amount+addedAmount,newCost=t.cost+money,newAvg=newCost/newAmount;
  const reduction=t.avg-newAvg,reductionPct=t.avg?reduction/t.avg*100:NaN;
  const rebound=price?((newAvg-price)/price*100):NaN;
  return {money,addedAmount,newAmount,newCost,newAvg,reduction,reductionPct,rebound};
}
function renderAverageSimulator(){
  const ai=Number($("avgAssetIndex").value),a=state.assets?.[ai];if(!a)return;
  const t=totalsFor(a), cur=Number(t.price);
  $("avgCurrentPrice").textContent=fmt(cur);$("avgCurrentAvg").textContent=Number.isFinite(t.avg)?fmt(t.avg):"—";$("avgCurrentCost").textContent=fmt(t.cost);$("avgCurrentAmount").textContent=`${t.amount} ${a.symbol}`;
  const vals=getPresetValues();[$("avgPreset1"),$("avgPreset2"),$("avgPreset3")].forEach((el,i)=>{if(document.activeElement!==el)el.value=vals[i]});$("avgPresetCurrency").textContent=`Montos en ${state.displayCurrency.toUpperCase()}`;
  const custom=num($("avgCustomAmount").value), amounts=[...vals];if(custom>0&&!amounts.includes(custom))amounts.push(custom);
  const box=$("avgResults");box.innerHTML="";
  amounts.filter(v=>v>0).forEach(v=>{const r=simulateAverage(a,v),row=document.createElement("div");row.className="avg-result-card";if(!r){row.textContent="No hay datos suficientes para calcular.";box.appendChild(row);return}
    row.innerHTML=`<div class="avg-result-head"><strong>Invertir ${fmt(r.money)}</strong><span>${r.addedAmount.toFixed(6)} ${escapeHtml(a.symbol)}</span></div><div class="avg-result-grid"><div><span>Nuevo promedio</span><strong>${fmt(r.newAvg)}</strong></div><div><span>Baja del promedio</span><strong class="positive">${fmt(r.reduction)} · ${Number.isFinite(r.reductionPct)?r.reductionPct.toFixed(1)+"%":"—"}</strong></div><div><span>Subida para recuperar</span><strong>${Number.isFinite(r.rebound)?r.rebound.toFixed(1)+"%":"—"}</strong></div></div>`;box.appendChild(row)});
}
function openAverageSimulator(assetIndex){
  const a=state.assets?.[assetIndex],t=a?totalsFor(a):null;if(!a||!t)return;
  if(!(t.price>0)){alert("Primero necesito el precio actual de esta cripto para simular.");return}
  $("avgAssetIndex").value=assetIndex;$("avgDialogTitle").textContent=`Capital nuevo · ${a.symbol}`;$("avgCustomAmount").value="";$("avgTargetPrice").value="";$("avgTargetResult").classList.add("hidden");$("compareCapital").value=getPresetValues()[0];$("sameAssetTarget").value="";$("sameAssetLabel").textContent=`Nueva posición de ${a.symbol}`;$("otherAssetName").value="";$("otherEntry").value="";$("otherTarget").value="";$("compareCurrencyLabel").textContent=`Precios y capital en ${state.displayCurrency.toUpperCase()}`;$("compareResults").classList.add("hidden");$("compareResults").innerHTML="";renderAverageSimulator();$("avgDialog").showModal();
}
function calculateTargetAverage(){
  const ai=Number($("avgAssetIndex").value),a=state.assets?.[ai];if(!a)return;const t=totalsFor(a),target=num($("avgTargetPrice").value),cur=Number(t.price),out=$("avgTargetResult");
  out.classList.remove("hidden","positive","negative");
  if(!(target>0)||!(cur>0)||!(t.avg>0)){out.textContent="Escribe un promedio objetivo válido.";return}
  if(target>=t.avg){out.textContent=`Ya estás en un promedio de ${fmt(t.avg)}; el objetivo debe ser menor para simular bajarlo.`;return}
  if(target<=cur){out.textContent=`Con compras al precio actual (${fmt(cur)}), el promedio puede acercarse a ese precio pero no llegar a ${fmt(target)}. Necesitarías comprar por debajo de ese nivel.`;out.classList.add("negative");return}
  const units=t.amount*(t.avg-target)/(target-cur),money=units*cur;
  if(!(units>0)&&!(money>0)){out.textContent="No se pudo calcular ese objetivo.";return}
  out.innerHTML=`Para bajar tu promedio de <strong>${fmt(t.avg)}</strong> a <strong>${fmt(target)}</strong>, comprando al precio actual de <strong>${fmt(cur)}</strong>, necesitarías invertir aproximadamente <strong>${fmt(money)}</strong> y comprar <strong>${units.toFixed(6)} ${escapeHtml(a.symbol)}</strong>.`;
}

function compareNewCapital(){
  const ai=Number($("avgAssetIndex").value),a=state.assets?.[ai];if(!a)return;
  const t=totalsFor(a),capital=num($("compareCapital").value),sameTarget=num($("sameAssetTarget").value),otherEntry=num($("otherEntry").value),otherTarget=num($("otherTarget").value),otherName=$("otherAssetName").value.trim()||"Otra cripto",out=$("compareResults");
  out.classList.remove("hidden");out.innerHTML="";
  if(!(capital>0)){out.innerHTML='<div class="avg-target-result negative">Escribe un capital mayor que cero.</div>';return}
  const cards=[];
  const avg=simulateAverage(a,capital);
  if(avg){
    let extra="";
    if(sameTarget>0){const portfolioAtTarget=avg.newAmount*sameTarget-avg.newCost;const oldAtTarget=t.amount*sameTarget-t.cost;extra=`<div><span>P/L total a objetivo</span><strong class="${pctClass(portfolioAtTarget)}">${fmt(portfolioAtTarget)}</strong></div><div><span>Posición vieja a objetivo</span><strong class="${pctClass(oldAtTarget)}">${fmt(oldAtTarget)}</strong></div>`}
    cards.push(`<div class="compare-result-card"><div class="compare-result-title"><strong>A · Promediar ${escapeHtml(a.symbol)}</strong><small>Mezcla el capital nuevo con la posición existente.</small></div><div class="compare-result-grid"><div><span>Nuevo promedio</span><strong>${fmt(avg.newAvg)}</strong></div><div><span>Capital nuevo</span><strong>${fmt(capital)}</strong></div>${extra}</div></div>`);
  }
  if(t.price>0&&sameTarget>0){
    const units=capital/t.price,profit=units*sameTarget-capital,pct=profit/capital*100,move=(sameTarget/t.price-1)*100;
    cards.push(`<div class="compare-result-card"><div class="compare-result-title"><strong>B · Nuevo lote ${escapeHtml(a.symbol)}</strong><small>La compra nueva se evalúa por separado; la vieja no necesita llegar a break-even.</small></div><div class="compare-result-grid"><div><span>Entrada actual</span><strong>${fmt(t.price)}</strong></div><div><span>Objetivo</span><strong>${fmt(sameTarget)}</strong></div><div><span>Ganancia lote nuevo</span><strong class="${pctClass(profit)}">${fmt(profit)} · ${formatPct(pct)}</strong></div><div><span>Movimiento necesario</span><strong>${formatPct(move)}</strong></div></div></div>`);
  }
  if(otherEntry>0&&otherTarget>0){
    const units=capital/otherEntry,profit=units*otherTarget-capital,pct=profit/capital*100,move=(otherTarget/otherEntry-1)*100;
    cards.push(`<div class="compare-result-card"><div class="compare-result-title"><strong>C · ${escapeHtml(otherName)}</strong><small>Oportunidad alternativa con entrada y objetivo independientes.</small></div><div class="compare-result-grid"><div><span>Entrada</span><strong>${fmt(otherEntry)}</strong></div><div><span>Objetivo</span><strong>${fmt(otherTarget)}</strong></div><div><span>Ganancia potencial</span><strong class="${pctClass(profit)}">${fmt(profit)} · ${formatPct(pct)}</strong></div><div><span>Movimiento necesario</span><strong>${formatPct(move)}</strong></div></div></div>`);
  }
  if(cards.length<2)cards.push('<div class="avg-target-result">Para comparar, agrega al menos un objetivo para la misma cripto o entrada + objetivo para otra oportunidad.</div>');
  out.innerHTML=cards.join("");
}

function renderGoals(calc){
  const items=[];calc.forEach(({a,t})=>(a.goals||[]).forEach(g=>{const s=goalState(g,a);if(["hit","near","close"].includes(s.status))items.push({a,g,s,t})}));items.sort((x,y)=>(x.s.status==="hit"?-999:x.s.distance)-(y.s.status==="hit"?-999:y.s.distance));
  $("goalPanel").classList.toggle("hidden",!items.length);const gl=$("goalList");gl.innerHTML="";items.forEach(({a,g,s,t})=>{const e=document.createElement("div");e.className="goal-card";e.innerHTML=`<div><strong>${escapeHtml(a.name)} · ${escapeHtml(g.label||"Meta")}</strong><small>${fmt(t.price)} → ${fmt(convertPrice(g.price,g.currency||"usd",state.displayCurrency,a))}</small></div><div style="text-align:right"><div class="goal-status">${s.label}</div><small>${s.status==="hit"?"Objetivo tocado":`Falta ${Math.max(0,s.distance).toFixed(1)}%`}</small></div>`;gl.appendChild(e)})
}
function renderAllocation(calc,total){
  $("allocationPanel").classList.toggle("hidden",!total);const box=$("allocationList");box.innerHTML="";calc.filter(x=>Number.isFinite(x.t.value)&&x.t.value>0).sort((a,b)=>b.t.value-a.t.value).forEach(({a,t})=>{const pct=t.value/total*100,e=document.createElement("div");e.className="allocation-item";e.innerHTML=`<strong>${escapeHtml(a.symbol)}</strong><span>${pct.toFixed(1)}%</span><div class="allocation-bar"><div class="allocation-fill" style="width:${pct}%"></div></div>`;box.appendChild(e)})
}

function contextCacheKey(){return STORAGE_KEY+"_market_context"}
function loadMarketContext(){try{const d=JSON.parse(localStorage.getItem(contextCacheKey())||"{}");state.marketContext=d||{}}catch{state.marketContext={}}}
function saveMarketContext(){localStorage.setItem(contextCacheKey(),JSON.stringify(state.marketContext))}
function contextFresh(c){return c?.fetchedAt && (Date.now()-c.fetchedAt)<6*60*60*1000}
async function fetchMarketContextForAsset(a){
  if(!a?.coinId)return;
  const cached=state.marketContext[a.coinId];
  if(contextFresh(cached))return;
  try{
    const base=`https://api.coingecko.com/api/v3/coins/${encodeURIComponent(a.coinId)}`;
    const detailUrl=base+"?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false";
    const chartUrl=base+"/market_chart?vs_currency=usd&days=365";
    const [detailRes,chartRes]=await Promise.all([fetch(detailUrl),fetch(chartUrl)]);
    if(!detailRes.ok||!chartRes.ok)throw new Error("context fetch");
    const detail=await detailRes.json(),chart=await chartRes.json();
    const md=detail.market_data||{},prices=Array.isArray(chart.prices)?chart.prices:[];
    const vals=prices.map(p=>Number(p?.[1])).filter(Number.isFinite);
    const low1yUsd=vals.length?Math.min(...vals):NaN, high1yUsd=vals.length?Math.max(...vals):NaN;
    state.marketContext[a.coinId]={
      fetchedAt:Date.now(),
      low24Usd:Number(md.low_24h?.usd),
      high24Usd:Number(md.high_24h?.usd),
      athUsd:Number(md.ath?.usd),
      athDateUsd:md.ath_date?.usd||null,
      low1yUsd,high1yUsd
    };
    saveMarketContext();
  }catch(e){
    // Conserva el último contexto disponible si existe.
  }
}
async function fetchAllMarketContext(){
  const assets=[...state.assets];
  await Promise.allSettled(assets.map(a=>fetchMarketContextForAsset(a)));
  try{render()}catch(e){console.error("Error al actualizar contexto de mercado",e)}
}
function usdToDisplay(v,a){
  v=Number(v); if(!Number.isFinite(v))return NaN;
  if(state.displayCurrency==="usd")return v;
  const fx=fxFor(a); return fx?v*fx:NaN;
}
function formatDateShort(iso){
  if(!iso)return "—";
  const d=new Date(iso); if(Number.isNaN(d.getTime()))return "—";
  return d.toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric"});
}
function populateMarketContext(node,a,t){
  const c=state.marketContext[a.coinId];
  if(!c){
    node.querySelector(".market-context-updated").textContent="Cargando…";
    return;
  }
  const low24=usdToDisplay(c.low24Usd,a),high24=usdToDisplay(c.high24Usd,a);
  const low1y=usdToDisplay(c.low1yUsd,a),high1y=usdToDisplay(c.high1yUsd,a),ath=usdToDisplay(c.athUsd,a);
  node.querySelector(".low24").textContent=fmt(low24);
  node.querySelector(".high24").textContent=fmt(high24);
  node.querySelector(".low1y").textContent=fmt(low1y);
  node.querySelector(".high1y").textContent=fmt(high1y);
  node.querySelector(".range-low-label").textContent=fmt(low1y);
  node.querySelector(".range-high-label").textContent=fmt(high1y);
  node.querySelector(".ath-price").textContent=fmt(ath);
  node.querySelector(".ath-date").textContent=formatDateShort(c.athDateUsd);
  node.querySelector(".market-context-updated").textContent=c.fetchedAt?`Datos ${new Date(c.fetchedAt).toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"})}`:"—";

  const cur=Number(t.price);
  if(Number.isFinite(cur)&&Number.isFinite(low1y)&&Number.isFinite(high1y)&&high1y>low1y){
    const pos=Math.max(0,Math.min(100,(cur-low1y)/(high1y-low1y)*100));
    node.querySelector(".range-progress").style.width=pos+"%";
    node.querySelector(".range-marker").style.left=pos+"%";
    node.querySelector(".range-position").textContent=`Precio actual en ${pos.toFixed(1)}% del rango anual`;
  }else{
    node.querySelector(".range-position").textContent="Rango anual no disponible";
  }

  if(Number.isFinite(cur)&&Number.isFinite(ath)&&ath>0){
    const d=(ath-cur)/ath*100;
    const el=node.querySelector(".ath-distance");
    if(cur>=ath){el.textContent="En / sobre máximo histórico";el.classList.add("positive")}
    else{el.textContent=`Falta ${Math.max(0,d).toFixed(1)}% para el ATH`;el.classList.toggle("positive",d<=10)}
  }
}

async function searchCoins(q){const box=$("searchResults");if(!q||q.trim().length<2){box.innerHTML="";return}try{const r=await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(q.trim())}`);if(!r.ok)throw new Error();const d=await r.json();box.innerHTML="";(d.coins||[]).slice(0,8).forEach(c=>{const b=document.createElement("button");b.type="button";b.className="search-item";b.innerHTML=`<span>${escapeHtml(c.name)}</span><span>${escapeHtml(c.symbol)}</span>`;b.addEventListener("click",()=>selectCoin({coinId:c.id,name:c.name,symbol:c.symbol.toUpperCase()}));box.appendChild(b)})}catch{box.innerHTML=`<div style="padding:12px;color:#6b7280;font-size:13px">No se pudo buscar ahora.</div>`}}
function selectCoin(c){state.selectedCoin=c;$("coinId").value=c.coinId;$("coinSearch").value=`${c.name} (${c.symbol})`;$("selectedCoin").textContent=`Seleccionada: ${c.name} · ${c.symbol}`;$("selectedCoin").classList.remove("hidden");$("searchResults").innerHTML=""}
function addLotRow(v={}){const e=document.createElement("div");e.className="editor-row lot-row";e.innerHTML=`<div class="grid3"><label>Cantidad<input class="lot-amount" type="number" step="any" min="0" value="${v.amount??""}" placeholder="0.00"></label><label>Precio compra<input class="lot-price" type="number" step="any" min="0" value="${v.buyPrice??""}" placeholder="0.00"></label><label>Moneda<select class="lot-currency"><option value="usd"${(v.buyCurrency||"usd")==="usd"?" selected":""}>USD</option><option value="mxn"${v.buyCurrency==="mxn"?" selected":""}>MXN</option></select></label></div><label>Exchange / Wallet<input class="lot-location" value="${escapeHtml(v.location||"")}" placeholder="Binance, Bitso, Ledger..."></label><div class="grid3"><label>Intención<select class="lot-purpose"><option value="long"${(v.purpose||"long")==="long"?" selected":""}>Largo plazo</option><option value="recovery"${v.purpose==="recovery"?" selected":""}>Recuperación</option><option value="opportunity"${v.purpose==="opportunity"?" selected":""}>Nueva oportunidad</option></select></label><label>Objetivo salida<input class="lot-target" type="number" step="any" min="0" value="${v.targetPrice??""}" placeholder="Opcional"></label><label>Moneda objetivo<select class="lot-target-currency"><option value="usd"${(v.targetCurrency||v.buyCurrency||"usd")==="usd"?" selected":""}>USD</option><option value="mxn"${(v.targetCurrency||v.buyCurrency)==="mxn"?" selected":""}>MXN</option></select></label></div><button type="button" class="danger small remove-row">Eliminar compra</button>`;e.querySelector(".remove-row").addEventListener("click",()=>e.remove());$("lotsEditor").appendChild(e)}
function addGoalRow(v={}){const e=document.createElement("div");e.className="editor-row goal-edit-row";e.innerHTML=`<div class="grid3"><label>Nombre<input class="goal-label" value="${escapeHtml(v.label||"Meta")}" placeholder="Ej. Venta 1"></label><label>Precio objetivo<input class="goal-price" type="number" step="any" min="0" value="${v.price??""}" placeholder="15"></label><label>Moneda<select class="goal-currency"><option value="usd"${(v.currency||"usd")==="usd"?" selected":""}>USD</option><option value="mxn"${v.currency==="mxn"?" selected":""}>MXN</option></select></label></div><button type="button" class="danger small remove-row">Eliminar meta</button>`;e.querySelector(".remove-row").addEventListener("click",()=>e.remove());$("goalsEditor").appendChild(e)}
function resetForm(){$("assetForm").reset();$("editIndex").value="";$("coinId").value="";$("selectedCoin").classList.add("hidden");$("selectedCoin").textContent="";$("searchResults").innerHTML="";$("lotsEditor").innerHTML="";$("goalsEditor").innerHTML="";state.selectedCoin=null;$("dialogTitle").textContent="Agregar cripto";addLotRow();addGoalRow()}
function openAdd(){resetForm();$("assetDialog").showModal();setTimeout(()=>$("coinSearch").focus(),50)}
function openEdit(i){resetForm();const a=state.assets[i];$("editIndex").value=i;$("dialogTitle").textContent="Editar cripto";selectCoin({coinId:a.coinId,name:a.name,symbol:a.symbol});$("lotsEditor").innerHTML="";$("goalsEditor").innerHTML="";(a.lots||[]).forEach(addLotRow);(a.goals||[]).forEach(addGoalRow);if(!(a.lots||[]).length)addLotRow();if(!(a.goals||[]).length)addGoalRow();$("assetDialog").showModal()}
function closeDialog(){$("assetDialog").close()}
$("assetForm").addEventListener("submit",e=>{
  e.preventDefault();
  if(!$("coinId").value||!state.selectedCoin){alert("Selecciona una cripto.");return}
  try{
    const lots=[...document.querySelectorAll(".lot-row")].map(r=>{
      const amount=optionalNum(r.querySelector(".lot-amount").value);
      const buyPrice=optionalNum(r.querySelector(".lot-price").value);
      const targetPrice=optionalNum(r.querySelector(".lot-target").value);
      return {
        amount:amount===null?0:Math.max(0,amount),
        buyPrice:buyPrice!==null&&buyPrice>0?buyPrice:null,
        buyCurrency:r.querySelector(".lot-currency").value,
        location:r.querySelector(".lot-location").value.trim(),
        purpose:r.querySelector(".lot-purpose").value||"long",
        targetPrice:targetPrice!==null&&targetPrice>0?targetPrice:null,
        targetCurrency:r.querySelector(".lot-target-currency").value||"usd"
      };
    }).filter(l=>l.amount>0);
    const goals=[...document.querySelectorAll(".goal-edit-row")].map(r=>({label:r.querySelector(".goal-label").value.trim()||"Meta",price:optionalNum(r.querySelector(".goal-price").value),currency:r.querySelector(".goal-currency").value})).filter(g=>g.price!==null&&g.price>0);
    const a={coinId:$("coinId").value,name:state.selectedCoin.name,symbol:state.selectedCoin.symbol.toUpperCase(),lots,goals};
    const idx=$("editIndex").value;
    if(idx==="")state.assets.push(a);else state.assets[Number(idx)]=a;
    save();
    closeDialog();
    render();
    // Las consultas de red van después del guardado y nunca deben bloquear la interfaz.
    Promise.resolve().then(()=>fetchPrices()).catch(()=>{});
  }catch(err){
    console.error("Error al guardar activo",err);
    alert("No se pudo guardar esta cripto. Intenta de nuevo; tus datos anteriores siguen intactos.");
  }
});
$("coinSearch").addEventListener("input",e=>{$("coinId").value="";state.selectedCoin=null;$("selectedCoin").classList.add("hidden");clearTimeout(state.searchTimer);state.searchTimer=setTimeout(()=>searchCoins(e.target.value),350)});
$("addBtn").addEventListener("click",openAdd);$("emptyAddBtn").addEventListener("click",openAdd);$("closeDialog").addEventListener("click",closeDialog);$("cancelBtn").addEventListener("click",closeDialog);$("addLotBtn").addEventListener("click",()=>addLotRow());$("addGoalBtn").addEventListener("click",()=>addGoalRow());$("refreshBtn").addEventListener("click",fetchPrices);
document.querySelectorAll(".currency").forEach(b=>b.addEventListener("click",()=>{state.displayCurrency=b.dataset.currency;save();render()}));
$("backupBtn").addEventListener("click",()=>$("backupDialog").showModal());$("closeBackup").addEventListener("click",()=>$("backupDialog").close());
$("exportBtn").addEventListener("click",()=>{const blob=new Blob([JSON.stringify({version:"1.7",exportedAt:new Date().toISOString(),assets:state.assets,displayCurrency:state.displayCurrency,avgPresets:state.avgPresets},null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`mi-portafolio-cripto-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href)});
$("importInput").addEventListener("change",async e=>{
  const f=e.target.files?.[0]; if(!f)return;
  try{
    const d=JSON.parse(await f.text()); if(!Array.isArray(d.assets))throw new Error();
    if(confirm("Esto reemplazará el portafolio actual. ¿Continuar?")){
      state.assets=d.assets.map(a=>({
        ...a,
        lots:Array.isArray(a.lots)?a.lots.map(l=>({
          ...l,
          buyPrice:Number(l.buyPrice)>0?Number(l.buyPrice):null,
          targetPrice:Number(l.targetPrice)>0?Number(l.targetPrice):null
        })):[]
      }));
      state.displayCurrency=d.displayCurrency||"mxn";
      if(d.avgPresets)state.avgPresets={...state.avgPresets,...d.avgPresets};
      save();$("backupDialog").close();render();fetchPrices();
    }
  }catch{alert("El archivo no parece ser un respaldo válido.")}
  e.target.value="";
});

$("closeLotDialog").addEventListener("click",closeLotDialog);$("cancelLotBtn").addEventListener("click",closeLotDialog);
$("lotForm").addEventListener("submit",e=>{e.preventDefault();const ai=Number($("lotAssetIndex").value),li=Number($("lotIndex").value),a=state.assets?.[ai];if(!a||!a.lots?.[li])return;const amount=num($("lotEditAmount").value),buyPrice=optionalNum($("lotEditPrice").value);if(amount<=0){alert("La cantidad debe ser mayor que cero.");return}if(buyPrice!==null&&buyPrice<0){alert("El precio de compra no puede ser negativo.");return}a.lots[li]={amount,buyPrice,buyCurrency:$("lotEditCurrency").value,location:$("lotEditLocation").value.trim(),purpose:$("lotEditPurpose").value||"long",targetPrice:num($("lotEditTarget").value),targetCurrency:$("lotEditTargetCurrency").value||"usd"};save();closeLotDialog();render();});

$("closeAvgDialog").addEventListener("click",()=>$("avgDialog").close());
[$("avgPreset1"),$("avgPreset2"),$("avgPreset3")].forEach(el=>el.addEventListener("input",()=>{setPresetValues([num($("avgPreset1").value),num($("avgPreset2").value),num($("avgPreset3").value)]);renderAverageSimulator()}));
$("avgCustomAmount").addEventListener("input",renderAverageSimulator);
$("avgCalcTarget").addEventListener("click",calculateTargetAverage);
$("avgTargetPrice").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();calculateTargetAverage()}});
$("compareCapitalBtn").addEventListener("click",compareNewCapital);

load();loadMarketContext();try{state.prices=JSON.parse(localStorage.getItem(STORAGE_KEY+"_prices")||"{}")}catch{}render();fetchPrices();setInterval(fetchPrices,10*60*1000);if("serviceWorker"in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
