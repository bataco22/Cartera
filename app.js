
const STORAGE_KEY="mi_portafolio_cripto_v1_1";
const state={assets:[],prices:{},marketContext:{},displayCurrency:"mxn",selectedCoin:null,searchTimer:null};
const $=id=>document.getElementById(id); const num=v=>Number(v||0);
const fmt=(n,c=state.displayCurrency)=>Number.isFinite(Number(n))?new Intl.NumberFormat("es-MX",{style:"currency",currency:c.toUpperCase(),maximumFractionDigits:Math.abs(Number(n))<10?4:2}).format(Number(n)):"—";
const pctClass=v=>!Number.isFinite(v)||v===0?"":v>0?"positive":"negative"; const formatPct=v=>Number.isFinite(v)?`${v>=0?"+":""}${v.toFixed(2)}%`:"—";
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function load(){try{const d=JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}");state.assets=Array.isArray(d.assets)?d.assets:[];state.displayCurrency=d.displayCurrency||"mxn"}catch{state.assets=[]}}
function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify({assets:state.assets,displayCurrency:state.displayCurrency}))}
function getPrice(a,c=state.displayCurrency){return state.prices?.[a.coinId]?.[c]}
function fxFor(a){const c=state.prices?.[a.coinId]; return c?.usd&&c?.mxn?c.mxn/c.usd:null}
function convertPrice(v,from,to,a){v=num(v); if(!v||from===to)return v; const fx=fxFor(a); if(!fx)return NaN; return from==="usd"&&to==="mxn"?v*fx:v/fx}
function totalsFor(a){
  let amount=0,cost=0;
  (a.lots||[]).forEach(l=>{amount+=num(l.amount); const p=convertPrice(l.buyPrice,l.buyCurrency||"usd",state.displayCurrency,a); if(Number.isFinite(p)) cost+=num(l.amount)*p;});
  const price=getPrice(a), value=Number.isFinite(price)?amount*price:NaN, avg=amount&&cost?cost/amount:NaN, pnl=cost&&Number.isFinite(value)?value-cost:NaN, pnlPct=cost&&Number.isFinite(value)?pnl/cost*100:NaN;
  return {amount,cost,price,value,avg,pnl,pnlPct};
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
async function fetchPrices(){if(!state.assets.length){render();return}const ids=[...new Set(state.assets.map(a=>a.coinId).filter(Boolean))];$("refreshBtn").textContent="…";clearError();try{
  const u=new URL("https://api.coingecko.com/api/v3/simple/price");u.searchParams.set("ids",ids.join(","));u.searchParams.set("vs_currencies","usd,mxn");u.searchParams.set("include_24hr_change","true");u.searchParams.set("include_last_updated_at","true");
  const r=await fetch(u);if(!r.ok)throw new Error(`HTTP ${r.status}`);state.prices=await r.json();localStorage.setItem(STORAGE_KEY+"_prices",JSON.stringify(state.prices));$("lastUpdated").textContent="Actualizado "+new Date().toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"});render();
}catch(e){try{state.prices=JSON.parse(localStorage.getItem(STORAGE_KEY+"_prices")||"{}")}catch{}showError("No se pudieron actualizar los precios. Se muestran los últimos datos guardados.");render()}finally{$("refreshBtn").textContent="↻";fetchAllMarketContext()}}
function showError(msg){let el=document.querySelector(".error-banner");if(!el){el=document.createElement("div");el.className="error-banner";document.querySelector(".container").prepend(el)}el.textContent=msg}
function clearError(){document.querySelector(".error-banner")?.remove()}
function render(){
  document.querySelectorAll(".currency").forEach(b=>b.classList.toggle("active",b.dataset.currency===state.displayCurrency));
  $("coinCount").textContent=`${state.assets.length} ${state.assets.length===1?"activo":"activos"}`;$("emptyState").classList.toggle("hidden",state.assets.length>0);$("portfolioList").classList.toggle("hidden",state.assets.length===0);
  const list=$("portfolioList");list.innerHTML="";let totalValue=0,totalCost=0;
  const calc=state.assets.map(a=>({a,t:totalsFor(a)}));calc.forEach(x=>{if(Number.isFinite(x.t.value))totalValue+=x.t.value;if(x.t.cost)totalCost+=x.t.cost});
  calc.forEach(({a,t},index)=>{
    const n=$("assetTemplate").content.cloneNode(true);n.querySelector(".coin-avatar").textContent=(a.symbol||"?").slice(0,1).toUpperCase();n.querySelector(".coin-name").textContent=a.name;n.querySelector(".symbol").textContent=a.symbol;n.querySelector(".amount-text").textContent=`${t.amount} ${a.symbol}`;n.querySelector(".current-price").textContent=fmt(t.price);n.querySelector(".asset-value").textContent=fmt(t.value);n.querySelector(".avg-price").textContent=Number.isFinite(t.avg)?fmt(t.avg):"Sin compras";
    const ch=state.prices?.[a.coinId]?.[`${state.displayCurrency}_24h_change`],chEl=n.querySelector(".change24");chEl.textContent=Number.isFinite(ch)?`${formatPct(ch)} en 24 h`:"Cambio 24 h —";chEl.classList.add(pctClass(ch));
    const pe=n.querySelector(".asset-pnl");pe.textContent=Number.isFinite(t.pnl)?`${fmt(t.pnl)} · ${formatPct(t.pnlPct)}`:"Sin costo";pe.classList.add(pctClass(t.pnl));
    populateMarketContext(n,a,t);const loc=n.querySelector(".locations-row");(a.lots||[]).forEach(l=>{const c=document.createElement("span");c.className="chip";c.textContent=`${l.location||"Sin ubicación"} · ${l.amount} ${a.symbol}`;loc.appendChild(c)});
    const goals=n.querySelector(".goals-row");let best=null;(a.goals||[]).forEach(g=>{const gs=goalState(g,a),c=document.createElement("span");c.className="chip goal-chip";c.innerHTML=`<span class="status-dot status-${gs.status}"></span>${escapeHtml(g.label||"Meta")} ${fmt(g.price,g.currency||"usd")} · ${gs.label}${Number.isFinite(gs.distance)&&gs.distance>0?` (${gs.distance.toFixed(1)}%)`:""}`;goals.appendChild(c);if(["hit","near","close"].includes(gs.status)&&(!best||(["hit","near","close"].indexOf(gs.status)<["hit","near","close"].indexOf(best.status))))best=gs});
    if(best){const d=n.querySelector(".goal-dot");d.classList.remove("hidden");d.classList.add(`status-${best.status}`)}
    n.querySelector(".allocation").textContent=totalValue&&Number.isFinite(t.value)?`${(t.value/totalValue*100).toFixed(1)}% del portafolio`:"— del portafolio";
    const actions=n.querySelector(".row-actions");n.querySelector(".menu-btn").addEventListener("click",()=>actions.classList.toggle("hidden"));n.querySelector(".edit-btn").addEventListener("click",()=>openEdit(index));n.querySelector(".delete-btn").addEventListener("click",()=>{if(confirm(`¿Eliminar ${a.name}?`)){state.assets.splice(index,1);save();render();fetchPrices()}});
    list.appendChild(n)
  });
  const totalPnl=totalCost?totalValue-totalCost:NaN,totalPct=totalCost?totalPnl/totalCost*100:NaN;$("totalValue").textContent=fmt(totalValue);$("totalCost").textContent=totalCost?fmt(totalCost):"—";$("totalPnl").textContent=Number.isFinite(totalPnl)?fmt(totalPnl):"—";$("totalPnl").className=pctClass(totalPnl);$("totalPct").textContent=formatPct(totalPct);$("totalPct").className=pctClass(totalPct);
  renderGoals(calc);renderAllocation(calc,totalValue)
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
  for(const a of state.assets){
    await fetchMarketContextForAsset(a);
  }
  render();
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
function addLotRow(v={}){const e=document.createElement("div");e.className="editor-row lot-row";e.innerHTML=`<div class="grid3"><label>Cantidad<input class="lot-amount" type="number" step="any" min="0" value="${v.amount??""}" placeholder="0.00"></label><label>Precio compra<input class="lot-price" type="number" step="any" min="0" value="${v.buyPrice??""}" placeholder="0.00"></label><label>Moneda<select class="lot-currency"><option value="usd"${(v.buyCurrency||"usd")==="usd"?" selected":""}>USD</option><option value="mxn"${v.buyCurrency==="mxn"?" selected":""}>MXN</option></select></label></div><label>Exchange / Wallet<input class="lot-location" value="${escapeHtml(v.location||"")}" placeholder="Binance, Bitso, Ledger..."></label><button type="button" class="danger small remove-row">Eliminar compra</button>`;e.querySelector(".remove-row").addEventListener("click",()=>e.remove());$("lotsEditor").appendChild(e)}
function addGoalRow(v={}){const e=document.createElement("div");e.className="editor-row goal-edit-row";e.innerHTML=`<div class="grid3"><label>Nombre<input class="goal-label" value="${escapeHtml(v.label||"Meta")}" placeholder="Ej. Venta 1"></label><label>Precio objetivo<input class="goal-price" type="number" step="any" min="0" value="${v.price??""}" placeholder="15"></label><label>Moneda<select class="goal-currency"><option value="usd"${(v.currency||"usd")==="usd"?" selected":""}>USD</option><option value="mxn"${v.currency==="mxn"?" selected":""}>MXN</option></select></label></div><button type="button" class="danger small remove-row">Eliminar meta</button>`;e.querySelector(".remove-row").addEventListener("click",()=>e.remove());$("goalsEditor").appendChild(e)}
function resetForm(){$("assetForm").reset();$("editIndex").value="";$("coinId").value="";$("selectedCoin").classList.add("hidden");$("selectedCoin").textContent="";$("searchResults").innerHTML="";$("lotsEditor").innerHTML="";$("goalsEditor").innerHTML="";state.selectedCoin=null;$("dialogTitle").textContent="Agregar cripto";addLotRow();addGoalRow()}
function openAdd(){resetForm();$("assetDialog").showModal();setTimeout(()=>$("coinSearch").focus(),50)}
function openEdit(i){resetForm();const a=state.assets[i];$("editIndex").value=i;$("dialogTitle").textContent="Editar cripto";selectCoin({coinId:a.coinId,name:a.name,symbol:a.symbol});$("lotsEditor").innerHTML="";$("goalsEditor").innerHTML="";(a.lots||[]).forEach(addLotRow);(a.goals||[]).forEach(addGoalRow);if(!(a.lots||[]).length)addLotRow();if(!(a.goals||[]).length)addGoalRow();$("assetDialog").showModal()}
function closeDialog(){$("assetDialog").close()}
$("assetForm").addEventListener("submit",e=>{e.preventDefault();if(!$("coinId").value||!state.selectedCoin){alert("Selecciona una cripto.");return}const lots=[...document.querySelectorAll(".lot-row")].map(r=>({amount:num(r.querySelector(".lot-amount").value),buyPrice:num(r.querySelector(".lot-price").value),buyCurrency:r.querySelector(".lot-currency").value,location:r.querySelector(".lot-location").value.trim()})).filter(l=>l.amount>0);if(!lots.length){alert("Agrega al menos una cantidad mayor que cero.");return}const goals=[...document.querySelectorAll(".goal-edit-row")].map(r=>({label:r.querySelector(".goal-label").value.trim()||"Meta",price:num(r.querySelector(".goal-price").value),currency:r.querySelector(".goal-currency").value})).filter(g=>g.price>0);const a={coinId:$("coinId").value,name:state.selectedCoin.name,symbol:state.selectedCoin.symbol.toUpperCase(),lots,goals};const idx=$("editIndex").value;if(idx==="")state.assets.push(a);else state.assets[Number(idx)]=a;save();closeDialog();render();fetchPrices()});
$("coinSearch").addEventListener("input",e=>{$("coinId").value="";state.selectedCoin=null;$("selectedCoin").classList.add("hidden");clearTimeout(state.searchTimer);state.searchTimer=setTimeout(()=>searchCoins(e.target.value),350)});
$("addBtn").addEventListener("click",openAdd);$("emptyAddBtn").addEventListener("click",openAdd);$("closeDialog").addEventListener("click",closeDialog);$("cancelBtn").addEventListener("click",closeDialog);$("addLotBtn").addEventListener("click",()=>addLotRow());$("addGoalBtn").addEventListener("click",()=>addGoalRow());$("refreshBtn").addEventListener("click",fetchPrices);
document.querySelectorAll(".currency").forEach(b=>b.addEventListener("click",()=>{state.displayCurrency=b.dataset.currency;save();render()}));
$("backupBtn").addEventListener("click",()=>$("backupDialog").showModal());$("closeBackup").addEventListener("click",()=>$("backupDialog").close());
$("exportBtn").addEventListener("click",()=>{const blob=new Blob([JSON.stringify({version:"1.1",exportedAt:new Date().toISOString(),assets:state.assets,displayCurrency:state.displayCurrency},null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`mi-portafolio-cripto-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href)});
$("importInput").addEventListener("change",async e=>{const f=e.target.files?.[0];if(!f)return;try{const d=JSON.parse(await f.text());if(!Array.isArray(d.assets))throw new Error();if(confirm("Esto reemplazará el portafolio actual. ¿Continuar?")){state.assets=d.assets;state.displayCurrency=d.displayCurrency||"mxn";save();$("backupDialog").close();render();fetchPrices()}}catch{alert("El archivo no parece ser un respaldo válido.")}e.target.value=""});
load();loadMarketContext();try{state.prices=JSON.parse(localStorage.getItem(STORAGE_KEY+"_prices")||"{}")}catch{}render();fetchPrices();setInterval(fetchPrices,5*60*1000);if("serviceWorker"in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
