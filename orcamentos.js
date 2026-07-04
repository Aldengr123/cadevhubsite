/* ===== CADev Hub — Construtor de Orçamentos ===== */
(function(){
  const WA = '5531996835764';
  const LS_KEY = 'cadev_orcamentos';
  const API = 'orcamentos-api.php';

  /* ---------- API helpers ---------- */
  function storedToken(){ return localStorage.getItem('cadev_admin_token')||''; }
  function askToken(msg){
    return new Promise(resolve=>{
      const modal=$('#authModal'), input=$('#authInput'), ok=$('#authOk');
      $('#authMsg').textContent=msg||'Digite a senha para salvar e gerenciar orçamentos.';
      input.value=''; modal.classList.add('open'); setTimeout(()=>input.focus(),60);
      function done(){ const v=input.value.trim(); if(!v) return; localStorage.setItem('cadev_admin_token',v); modal.classList.remove('open'); ok.onclick=null; input.onkeydown=null; resolve(v); }
      ok.onclick=done;
      input.onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); done(); } };
    });
  }
  async function apiGet(id){
    try{ const r=await fetch(API+'?action=get&id='+encodeURIComponent(id)); return await r.json(); }
    catch(e){ return {ok:false,error:'offline'}; }
  }
  async function apiAdmin(action,payload){
    let token=storedToken(); if(!token) token=await askToken();
    const send=t=>fetch(API+'?action='+action,{method:'POST',
      headers:{'Content-Type':'application/json','X-Admin-Token':t},
      body:JSON.stringify(payload||{})});
    let r=await send(token);
    if(r.status===401){
      localStorage.removeItem('cadev_admin_token');
      token=await askToken('Senha incorreta. Tente de novo.');
      r=await send(token);
      if(r.status===401){ throw new Error('senha incorreta'); }
    }
    return await r.json();
  }

  const GRUPOS = {
    setup:      {label:'Investimento inicial (setup)', rec:'unico'},
    mensalidade:{label:'Mensalidade CADev',            rec:'mensal'},
    hospedagem: {label:'Hospedagem / VPS',             rec:'mensal'},
    manutencao: {label:'Manutenção',                   rec:'mensal'},
    plataformas:{label:'Plataformas terceiras',        rec:'mensal'},
    tokens:     {label:'Tokens de IA (estimado)',      rec:'mensal'},
    anuncio:    {label:'Verba de anúncio / tráfego',   rec:'mensal'},
    outro:      {label:'Outro',                         rec:'unico'}
  };
  const TIPOS = ['Web App / Sistema','Site institucional','Landing Page','Loja virtual','Automação','Chatbot WhatsApp','Gestão de Tráfego'];

  const BRL = v => (Number(v)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});

  /* ---------- state ---------- */
  function blank(){
    return {
      id:null,
      cliente:{nome:'',empresa:'',contato:''},
      projeto:{titulo:'',resumo:'',prazo:'',validade:'15'},
      tipos:[], video:'', portfolio:[], entregaveis:[], itens:[], observacoes:''
    };
  }
  let state = blank();

  const $ = s => document.querySelector(s);
  const doc = $('#doc');

  /* ---------- dotted get/set ---------- */
  function setPath(obj,path,val){ const p=path.split('.'); let o=obj; for(let i=0;i<p.length-1;i++)o=o[p[i]]; o[p[p.length-1]]=val; }
  function getPath(obj,path){ return path.split('.').reduce((o,k)=>o&&o[k],obj); }

  /* ---------- bind simple fields ---------- */
  function bindFields(){
    document.querySelectorAll('[data-k]').forEach(el=>{
      el.addEventListener('input',()=>{ setPath(state,el.dataset.k,el.value); render(); });
    });
  }
  function fillFields(){
    document.querySelectorAll('[data-k]').forEach(el=>{ const v=getPath(state,el.dataset.k); el.value=v==null?'':v; });
  }

  /* ---------- chips ---------- */
  function buildChips(){
    const box=$('#chips'); box.innerHTML='';
    TIPOS.forEach(t=>{
      const c=document.createElement('div');
      c.className='oc-chip'+(state.tipos.includes(t)?' on':'');
      c.textContent=t;
      c.onclick=()=>{ const i=state.tipos.indexOf(t); i>-1?state.tipos.splice(i,1):state.tipos.push(t); c.classList.toggle('on'); render(); };
      box.appendChild(c);
    });
  }

  /* ---------- deliverables ---------- */
  function renderDeliv(){
    const ul=$('#delivList'); ul.innerHTML='';
    state.entregaveis.forEach((d,i)=>{
      const li=document.createElement('li');
      const inp=document.createElement('input'); inp.value=d; inp.placeholder='Ex.: Site responsivo (5 páginas)';
      inp.oninput=()=>{ state.entregaveis[i]=inp.value; render(); };
      const del=document.createElement('button'); del.className='del'; del.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>';
      del.onclick=()=>{ state.entregaveis.splice(i,1); renderDeliv(); render(); };
      li.append(inp,del); ul.appendChild(li);
    });
  }

  /* ---------- portfolio ---------- */
  function renderPf(){
    const box=$('#pfList'); box.innerHTML='';
    state.portfolio.forEach((p,i)=>{
      const it=document.createElement('div'); it.className='oc-item';
      it.innerHTML=`<div class="oc-item-top"><input placeholder="Título (ex.: Fala Alícia)" value="${esc(p.titulo)}" data-f="titulo"><button class="del"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg></button></div>
      <div class="oc-item-bot" style="grid-template-columns:1fr"><input placeholder="Link do projeto (https://...)" value="${esc(p.url)}" data-f="url"></div>
      <div style="margin-top:8px"><input placeholder="URL da imagem/thumb (opcional)" value="${esc(p.img)}" data-f="img" style="width:100%;background:var(--bg);border:1px solid var(--line-strong);border-radius:10px;padding:11px 13px;color:#fff;font:400 .92rem Inter"></div>`;
      it.querySelectorAll('[data-f]').forEach(inp=>inp.oninput=()=>{ state.portfolio[i][inp.dataset.f]=inp.value; render(); });
      it.querySelector('.del').onclick=()=>{ state.portfolio.splice(i,1); renderPf(); render(); };
      box.appendChild(it);
    });
  }

  /* ---------- line items ---------- */
  function renderItems(){
    const box=$('#itemList'); box.innerHTML='';
    state.itens.forEach((it,i)=>{
      const el=document.createElement('div'); el.className='oc-item';
      const opts=Object.entries(GRUPOS).map(([k,g])=>`<option value="${k}"${it.grupo===k?' selected':''}>${g.label}</option>`).join('');
      el.innerHTML=`<div class="oc-item-top"><select data-f="grupo">${opts}</select><button class="del"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg></button></div>
      <div class="oc-item-bot"><input placeholder="Descrição" value="${esc(it.descricao)}" data-f="descricao"><input type="number" placeholder="0,00" value="${it.valor||''}" data-f="valor"></div>
      <div class="oc-rec"><button data-r="unico"${it.rec==='unico'?' class="on"':''}>Valor único</button><button data-r="mensal"${it.rec==='mensal'?' class="on"':''}>Mensal</button></div>`;
      el.querySelector('[data-f="grupo"]').onchange=e=>{ it.grupo=e.target.value; it.rec=GRUPOS[it.grupo].rec; renderItems(); render(); };
      el.querySelector('[data-f="descricao"]').oninput=e=>{ it.descricao=e.target.value; render(); };
      el.querySelector('[data-f="valor"]').oninput=e=>{ it.valor=e.target.value; render(); };
      el.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>{ it.rec=b.dataset.r; renderItems(); render(); });
      el.querySelector('.del').onclick=()=>{ state.itens.splice(i,1); renderItems(); render(); };
      box.appendChild(el);
    });
  }

  function esc(s){ return (s||'').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }
  function escT(s){ return (s||'').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  /* ---------- video embed ---------- */
  function videoHtml(url){
    if(!url) return `<div class="oc-video"><div class="ph"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 7l-7 5 7 5V7zM1 5h15v14H1z"/></svg>Vídeo de apresentação</div></div>`;
    const yt=url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]{11})/);
    if(yt) return `<div class="oc-video"><iframe src="https://www.youtube.com/embed/${yt[1]}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
    if(/\.(mp4|webm|mov|ogg)(\?.*)?$/i.test(url)) return `<div class="oc-video"><video src="${esc(url)}" controls playsinline></video></div>`;
    return `<div class="oc-video"><iframe src="${esc(url)}" allowfullscreen></iframe></div>`;
  }

  /* ---------- render proposal ---------- */
  function render(){
    const s=state;
    const initItems=s.itens.filter(i=>i.rec==='unico'&&(i.descricao||i.valor));
    const monItems =s.itens.filter(i=>i.rec==='mensal'&&(i.descricao||i.valor));
    const totalInit=initItems.reduce((a,i)=>a+(Number(i.valor)||0),0);
    const totalMon =monItems.reduce((a,i)=>a+(Number(i.valor)||0),0);
    const hoje=new Date().toLocaleDateString('pt-BR');

    const badges=s.tipos.length?`<div class="oc-badges">${s.tipos.map(t=>`<span>${escT(t)}</span>`).join('')}</div>`:'';

    const metaParts=[];
    if(s.cliente.nome) metaParts.push(`Para <b>${escT(s.cliente.nome)}</b>${s.cliente.empresa?` — ${escT(s.cliente.empresa)}`:''}`);
    if(s.projeto.prazo) metaParts.push(`Prazo estimado: <b>${escT(s.projeto.prazo)}</b>`);
    metaParts.push(`Emitida em ${hoje}${s.projeto.validade?` · válida por ${escT(s.projeto.validade)} dias`:''}`);

    const rowsHtml=list=>list.map(i=>`<div class="oc-inv-row"><div class="d">${escT(i.descricao)||'<span style="color:var(--text-mute)">(sem descrição)</span>'}<small>${GRUPOS[i.grupo].label}</small></div><div class="v">${BRL(i.valor)}</div></div>`).join('');

    let invHtml='';
    if(initItems.length) invHtml+=`<div class="oc-inv-group"><h3>Investimento inicial <span class="tag once">único</span></h3>${rowsHtml(initItems)}</div>`;
    if(monItems.length)  invHtml+=`<div class="oc-inv-group"><h3>Custos recorrentes <span class="tag month">mensal</span></h3>${rowsHtml(monItems)}</div>`;

    let totalsHtml='';
    if(initItems.length) totalsHtml+=`<div class="oc-total initial"><div class="lbl">Investimento inicial<small>Pagamento único (setup)</small></div><div class="amt">${BRL(totalInit)}</div></div>`;
    if(monItems.length)  totalsHtml+=`<div class="oc-total monthly"><div class="lbl">Custo mensal<small>Recorrente</small></div><div class="amt">${BRL(totalMon)}</div></div>`;

    const pfHtml=s.portfolio.filter(p=>p.titulo||p.url).map(p=>{
      const thumb=p.img?` style="background-image:url('${esc(p.img)}');background-size:cover"`:'';
      const tag=p.url?'a':'div', href=p.url?` href="${esc(p.url)}" target="_blank" rel="noopener"`:'';
      return `<${tag} class="oc-pf"${href}><div class="thumb"${thumb}></div><div class="cap"><b>${escT(p.titulo)||'Projeto'}</b>${p.url?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M9 7h8v8"/></svg>':''}</div></${tag}>`;
    }).join('');

    const delivHtml=s.entregaveis.filter(d=>d.trim()).map(d=>`<li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>${escT(d)}</li>`).join('');

    const waMsg=encodeURIComponent(`Olá! Vi a proposta "${s.projeto.titulo||'da CADev Hub'}" e quero seguir.`);

    doc.innerHTML=`
      <div class="oc-doc-hd">
        <svg class="logo" viewBox="0 0 67 39" fill="url(#ocGD)"><defs><linearGradient id="ocGD" gradientUnits="userSpaceOnUse" x1="2" y1="2" x2="60" y2="38"><stop offset="0" stop-color="#A5FFA9"/><stop offset="0.55" stop-color="#41E248"/><stop offset="1" stop-color="#179E1D"/></linearGradient></defs>
          <path d="M33.452 0C33.98.5 39.752 11.65 40.516 13.084L47.532 26.199C48.811 28.585 50.353 31.315 51.517 33.732 59.169 31.745 63.138 24.28 61.566 16.964 60.779 13.408 58.58 10.293 55.443 8.292 52.016 6.124 48.442 5.934 44.514 6.742 44.562 8.663 44.38 12.221 44.644 13.984 44.278 12.984 43.428 11.546 42.932 10.552 41.685 8.057 40.207 5.532 39.003 3.027 44.474.978 51.755.731 57.018 3.462 61.427 5.795 64.696 9.732 66.103 14.403 67.715 19.483 67.139 24.979 64.504 29.641 63.858 30.774 63.084 31.834 62.199 32.802 60.738 34.402 59.008 35.75 57.08 36.787 50.937 40.092 46.271 38.557 39.766 38.965L39.77 34.115C41.878 34.086 43.986 34.084 46.094 34.108 42.082 26.275 37.535 18.451 33.509 10.59 32.794 11.768 31.914 13.556 31.246 14.803L26.135 24.322 37.101 24.327C37.696 25.422 39.055 28.226 39.689 29.111 34.502 29.212 29.026 29.116 23.807 29.126 22.219 30.7 19.028 30.94 16.902 30.928L33.452 0Z"/><path d="M17.329 1.455C17.833 1.374 19.136 1.443 19.65 1.48 22.672 1.693 24.918 2.436 27.541 3.863 26.844 5.304 25.976 6.887 25.207 8.302 24.465 7.714 22.664 6.967 21.735 6.723 14.462 4.814 7.599 9.418 5.609 16.206 4.54 19.896 5.009 23.844 6.917 27.201 8.769 30.397 11.685 32.701 15.341 33.675 19.091 34.674 22.479 33.943 25.809 32.132 26.125 31.997 26.883 31.471 27.204 31.26L27.207 36.847C20.541 40.211 13.154 39.647 7.245 35.057 3.282 32.002.728 27.554.139 22.683-.463 17.298.878 12.187 4.407 7.938 6.969 4.834 10.55 2.672 14.556 1.81 15.372 1.638 16.48 1.543 17.329 1.455Z"/></svg>
        <div class="eyebrow">Proposta comercial</div>
        <h1>${escT(s.projeto.titulo)||'Título da sua proposta'}</h1>
        ${badges}
        <div class="meta">${metaParts.join('<br>')}</div>
      </div>
      <div class="oc-doc-body">
        ${s.projeto.resumo?`<div class="oc-block"><h2>O projeto</h2><p class="lead">${escT(s.projeto.resumo).replace(/\n/g,'<br>')}</p></div>`:''}
        ${s.video||true?`<div class="oc-block"><h2>Apresentação</h2>${videoHtml(s.video)}</div>`:''}
        ${delivHtml?`<div class="oc-block"><h2>O que está incluso</h2><ul class="oc-deliv">${delivHtml}</ul></div>`:''}
        ${pfHtml?`<div class="oc-block"><h2>Alguns trabalhos nossos</h2><div class="oc-portfolio">${pfHtml}</div></div>`:''}
        ${(invHtml||totalsHtml)?`<div class="oc-block"><h2>Investimento</h2>${invHtml||'<p class="oc-empty">Adicione itens de custo no editor.</p>'}<div class="oc-totals">${totalsHtml}</div>${s.observacoes?`<div class="oc-note">${escT(s.observacoes).replace(/\n/g,'<br>')}</div>`:''}</div>`:''}
        <div class="oc-cta">
          <h3>Vamos começar?</h3>
          <p>Responda esta proposta e a gente já dá o primeiro passo.</p>
          <a class="btn btn-primary btn-md" href="https://wa.me/${WA}?text=${waMsg}" target="_blank" rel="noopener">Aprovar pelo WhatsApp
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg></a>
        </div>
      </div>
      <div class="oc-foot">CADev Hub · Tecnologia que destaca · cadevhub.com</div>`;
  }

  /* ---------- share link (base64 no hash) ---------- */
  function encodeState(){ return btoa(unescape(encodeURIComponent(JSON.stringify(state)))); }
  function decodeState(str){ try{ return JSON.parse(decodeURIComponent(escape(atob(str)))); }catch(e){ return null; } }

  async function copyLink(){
    let short=null;
    try{ const res=await doSave(true); if(res&&res.ok) short=location.origin+location.pathname+'?id='+encodeURIComponent(state.id)+'&view=1'; }catch(e){}
    const url = short || (location.origin+location.pathname+'?view=1#p='+encodeState());
    navigator.clipboard.writeText(url).then(
      ()=>toast(short?'Link curto copiado! Cole no WhatsApp.':'Sem banco — link longo copiado.'),
      ()=>prompt('Copie o link:',url));
  }

  /* ---------- persistência: MySQL (primary) + localStorage (backup) ---------- */
  function loadAll(){ try{ return JSON.parse(localStorage.getItem(LS_KEY))||{}; }catch(e){ return {}; } }
  function saveAll(o){ localStorage.setItem(LS_KEY,JSON.stringify(o)); }
  function meta(){
    return {
      titulo:state.projeto.titulo||'Sem título', cliente:state.cliente.nome||'',
      total_inicial:state.itens.filter(i=>i.rec==='unico').reduce((a,i)=>a+(+i.valor||0),0),
      total_mensal:state.itens.filter(i=>i.rec==='mensal').reduce((a,i)=>a+(+i.valor||0),0)
    };
  }
  function saveLocal(){
    const all=loadAll(); const m=meta();
    all[state.id]={data:JSON.parse(JSON.stringify(state)),savedAt:Date.now(),titulo:m.titulo,cliente:m.cliente,total:m.total_inicial};
    saveAll(all);
  }
  async function doSave(silent){
    if(!state.id) state.id='oc_'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
    saveLocal();
    const m=meta();
    try{
      const res=await apiAdmin('save',{id:state.id,titulo:m.titulo,cliente:m.cliente,total_inicial:m.total_inicial,total_mensal:m.total_mensal,dados:state});
      if(res&&res.ok){ if(!silent)toast('Salvo no banco de dados.'); return res; }
      throw new Error(res&&res.error||'falha');
    }catch(e){ if(!silent)toast('Sem banco — salvo só neste navegador ('+e.message+').'); return {ok:false}; }
  }
  function save(){ doSave(false); }

  async function renderSaved(){
    const box=$('#savedList'); box.innerHTML='<p class="oc-empty">Carregando...</p>';
    let itens=null;
    try{ const res=await apiAdmin('list'); if(res&&res.ok) itens=res.itens; }catch(e){}
    if(itens){
      if(!itens.length){ box.innerHTML='<p class="oc-empty">Nenhum orçamento no banco ainda.</p>'; return; }
      box.innerHTML='';
      itens.forEach(r=>{
        const d=document.createElement('div'); d.className='oc-saved-item';
        const dt=r.atualizado_em?new Date(r.atualizado_em.replace(' ','T')).toLocaleDateString('pt-BR'):'';
        d.innerHTML=`<b>${escT(r.titulo)}</b><small>${escT(r.cliente)||'—'} · ${dt}</small><div class="r"><span class="val">${BRL(r.total_inicial)}</span><span class="rm">Excluir</span></div>`;
        d.querySelector('.rm').onclick=async e=>{ e.stopPropagation(); if(confirm('Excluir este orçamento do banco?')){ try{ await apiAdmin('delete',{id:r.id}); }catch(err){} renderSaved(); } };
        d.onclick=async ()=>{ const g=await apiGet(r.id); if(g&&g.ok){ state=g.dados; state.id=r.id; hydrate(); closeDrawer(); toast('Carregado do banco.'); } };
        box.appendChild(d);
      });
      return;
    }
    // fallback: cópias locais
    const all=loadAll();
    const keys=Object.keys(all).sort((a,b)=>all[b].savedAt-all[a].savedAt);
    if(!keys.length){ box.innerHTML='<p class="oc-empty">Sem conexão com o banco e nada salvo localmente.</p>'; return; }
    box.innerHTML='<p class="oc-empty" style="margin-bottom:10px">Sem banco — mostrando cópias locais:</p>';
    keys.forEach(k=>{
      const r=all[k];
      const d=document.createElement('div'); d.className='oc-saved-item';
      d.innerHTML=`<b>${escT(r.titulo)}</b><small>${escT(r.cliente)||'—'} · ${new Date(r.savedAt).toLocaleDateString('pt-BR')}</small><div class="r"><span class="val">${BRL(r.total)}</span><span class="rm">Excluir</span></div>`;
      d.querySelector('.rm').onclick=e=>{ e.stopPropagation(); if(confirm('Excluir cópia local?')){ const a=loadAll(); delete a[k]; saveAll(a); renderSaved(); } };
      d.onclick=()=>{ state=JSON.parse(JSON.stringify(all[k].data)); state.id=k; hydrate(); closeDrawer(); };
      box.appendChild(d);
    });
  }
  function openDrawer(){ renderSaved(); $('#drawer').classList.add('open'); $('#backdrop').classList.add('open'); }
  function closeDrawer(){ $('#drawer').classList.remove('open'); $('#backdrop').classList.remove('open'); }

  /* ---------- toast ---------- */
  let toastEl;
  function toast(msg){
    if(!toastEl){ toastEl=document.createElement('div'); toastEl.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--green);color:#fff;font:600 .9rem Inter;padding:12px 20px;border-radius:12px;z-index:99;box-shadow:0 10px 30px rgba(0,0,0,.4);transition:opacity .3s'; document.body.appendChild(toastEl); }
    toastEl.textContent=msg; toastEl.style.opacity='1';
    clearTimeout(toastEl._t); toastEl._t=setTimeout(()=>toastEl.style.opacity='0',2400);
  }

  /* ---------- hydrate editor from state ---------- */
  function hydrate(){ fillFields(); buildChips(); renderDeliv(); renderPf(); renderItems(); render(); }

  /* ---------- init ---------- */
  async function init(){
    bindFields();
    $('#addDeliv').onclick=()=>{ state.entregaveis.push(''); renderDeliv(); render(); };
    $('#addPf').onclick=()=>{ state.portfolio.push({titulo:'',url:'',img:''}); renderPf(); render(); };
    $('#addItem').onclick=()=>{ state.itens.push({grupo:'setup',descricao:'',valor:'',rec:'unico'}); renderItems(); render(); };
    $('#btnSave').onclick=save;
    $('#btnNew').onclick=()=>{ if(confirm('Começar um orçamento novo? Alterações não salvas serão perdidas.')){ state=blank(); hydrate(); } };
    $('#btnOpen').onclick=openDrawer;
    $('#btnLink').onclick=copyLink;
    $('#btnPrint').onclick=()=>window.print();
    $('#backdrop').onclick=closeDrawer;

    // client view: por id (banco) ou hash (offline)
    const params=new URLSearchParams(location.search);
    const id=params.get('id');
    if(id){
      document.body.classList.add('client-mode');
      const g=await apiGet(id);
      if(g&&g.ok&&g.dados){ state=g.dados; state.id=id; }
      else {
        const m=location.hash.match(/p=([^&]+)/); const dec=m&&decodeState(m[1]);
        if(dec){ state=dec; } else { hydrate(); doc.innerHTML='<p style="color:var(--text-mute);text-align:center;padding:100px 20px;font-size:1.05rem">Proposta não encontrada ou expirada.</p>'; return; }
      }
    } else {
      const m=location.hash.match(/p=([^&]+)/);
      if(m){ const dec=decodeState(m[1]); if(dec) state=dec; }
      if(params.has('view')) document.body.classList.add('client-mode');
    }

    if(!state.itens.length && !document.body.classList.contains('client-mode')){
      state.itens.push({grupo:'setup',descricao:'',valor:'',rec:'unico'});
    }
    hydrate();
  }
  document.addEventListener('DOMContentLoaded',init);
})();
