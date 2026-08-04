/* ===== CADev Hub — Briefing: multi-step genérico + envio ===== */
(function(){
  const FORM_ENDPOINT = 'enviar-briefing-gofirst.php';
  const DEMO_FALLBACK = !/cadevhub\.com$/i.test(location.hostname);

  const panels = [...document.querySelectorAll('.fp-step-panel')];
  const steps  = [...document.querySelectorAll('.fp-step')];
  const bars   = [...document.querySelectorAll('.fp-progress span')];
  const TOTAL  = panels.length;

  const selections = {};   // option/swatch groups → string (radio) ou array (check/swatch)

  function goTo(n){
    panels.forEach(p=>p.classList.toggle('show', +p.dataset.panel===n));
    steps.forEach(s=>{
      const sn=+s.dataset.step;
      s.classList.toggle('active', sn===n);
      s.classList.toggle('done', sn<n);
    });
    bars.forEach((b,i)=>b.classList.toggle('fill', i<n));
    window.scrollTo({top:0,behavior:'smooth'});
  }

  /* ---- option groups (radio / checkbox) ---- */
  document.querySelectorAll('.opts').forEach(group=>{
    const field = group.dataset.field;
    const type  = group.dataset.type;
    group.querySelectorAll('.opt').forEach(opt=>{
      opt.addEventListener('click', ()=>{
        const label = opt.querySelector('.txt b').textContent.trim();
        if (type==='radio'){
          group.querySelectorAll('.opt').forEach(o=>o.classList.remove('sel'));
          opt.classList.add('sel');
          selections[field] = label;
        } else {
          opt.classList.toggle('sel');
          const set = new Set(selections[field]||[]);
          opt.classList.contains('sel') ? set.add(label) : set.delete(label);
          selections[field] = [...set];
        }
        clearErr();
      });
    });
  });

  /* ---- swatch groups (multi-seleção de cor) ---- */
  document.querySelectorAll('.swatches').forEach(group=>{
    const field = group.dataset.field;
    group.querySelectorAll('.swatch').forEach(sw=>{
      sw.addEventListener('click', ()=>{
        sw.classList.toggle('sel');
        const set = new Set(selections[field]||[]);
        const c = sw.dataset.color;
        sw.classList.contains('sel') ? set.add(c) : set.delete(c);
        selections[field] = [...set];
        clearErr();
      });
    });
  });

  /* ---- erros ---- */
  function showErr(step, msg){
    const el = document.querySelector(`.fp-err[data-err="${step}"]`);
    if(el) el.textContent = msg;
  }
  function clearErr(){ document.querySelectorAll('.fp-err').forEach(e=>e.textContent=''); }

  /* ---- validação de uma etapa ---- */
  function validatePanel(n){
    const panel = panels.find(p=>+p.dataset.panel===n);
    // campos de texto obrigatórios
    for (const fld of panel.querySelectorAll('.fld[required]')){
      const v = fld.value.trim();
      if (!v){ showErr(n, 'Preencha o campo destacado para continuar.'); fld.focus(); return false; }
      if (fld.id === 'zap' && v.replace(/\D/g,'').length < 10){ showErr(n,'Informe um WhatsApp válido com DDD.'); fld.focus(); return false; }
      if (fld.type === 'email' && v && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)){ showErr(n,'Informe um e-mail válido.'); fld.focus(); return false; }
    }
    // grupos de opção obrigatórios
    for (const grp of panel.querySelectorAll('.opts[data-required="true"]')){
      const f = grp.dataset.field;
      const val = selections[f];
      const empty = !val || (Array.isArray(val) && !val.length);
      if (empty){ showErr(n, 'Responda: ' + (grp.dataset.label || 'campo obrigatório') + '.'); return false; }
    }
    return true;
  }

  /* ---- navegação ---- */
  document.querySelectorAll('[data-next]').forEach(b=>b.addEventListener('click',()=>{
    const from = +b.closest('.fp-step-panel').dataset.panel;
    if(!validatePanel(from)) return;
    clearErr(); goTo(+b.dataset.next);
  }));
  document.querySelectorAll('[data-prev]').forEach(b=>b.addEventListener('click',()=>{ clearErr(); goTo(+b.dataset.prev); }));

  /* ---- coleta de todos os dados ---- */
  function collect(){
    const data = {};
    document.querySelectorAll('.fld[name]').forEach(f=>{ data[f.name] = f.value.trim(); });
    Object.assign(data, selections);
    const hp = document.getElementById('hp_field');
    data.hp = hp ? hp.value : '';
    data._tipo = 'GoFirst — SaaS/CRM para agências';
    data._anexos = anexos;
    return data;
  }

  /* ---- envio ---- */
  const modal = document.getElementById('successModal');
  const submitBtn = document.querySelector('[data-submit]');
  function showSuccess(){ goTo(TOTAL); modal.classList.add('open'); }

  submitBtn.addEventListener('click', async ()=>{
    // valida todas as etapas antes de enviar
    for (let n=1; n<=TOTAL; n++){
      if(!validatePanel(n)){ goTo(n); return; }
    }
    clearErr();

    const data = collect();
    try{ localStorage.setItem('cadev_briefing_gofirst', JSON.stringify(data)); }catch(e){}

    const original = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Enviando...';

    try{
      const res = await fetch(FORM_ENDPOINT, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(data)
      });
      const json = await res.json().catch(()=>({}));
      if(res.ok && json.ok){ showSuccess(); }
      else throw new Error(json.debug || json.error || ('HTTP '+res.status));
    }catch(err){
      if(DEMO_FALLBACK){
        console.warn('[CADev] Envio simulado (sem backend ativo):', err.message);
        showSuccess();
      } else {
        console.error('[CADev] Falha no envio:', err.message);
        showErr(TOTAL, 'Não foi possível enviar: ' + err.message);
        submitBtn.disabled = false;
        submitBtn.innerHTML = original;
      }
    }
  });
  modal.addEventListener('click',e=>{ if(e.target===modal) modal.classList.remove('open'); });

  /* ---- máscara de telefone ---- */
  const zap = document.getElementById('zap');
  if (zap) zap.addEventListener('input',()=>{
    let v = zap.value.replace(/\D/g,'').slice(0,11);
    if(v.length>2) v = v.replace(/^(\d{2})(\d)/,'$1 $2');
    if(v.length>9) v = v.replace(/(\d{5})(\d{1,4})$/,'$1-$2');
    else if(v.length>7) v = v.replace(/(\d{4})(\d{1,4})$/,'$1-$2');
    zap.value = v;
  });

  /* ---- anexos (múltiplos campos) ---- */
  let anexos = [];
  const MAX_MB = 8;
  document.querySelectorAll('input[type=file].fp-file').forEach(input=>{
    const listEl = document.getElementById(input.dataset.list);
    const origem = input.dataset.origem || '';
    input.addEventListener('change', async ()=>{
      for (const file of input.files){
        if (file.size > MAX_MB*1024*1024){ alert(`"${file.name}" passa de ${MAX_MB}MB e não foi anexado.`); continue; }
        const base64 = await new Promise((res,rej)=>{
          const r = new FileReader();
          r.onload = ()=>res(r.result.split(',')[1]);
          r.onerror = rej;
          r.readAsDataURL(file);
        });
        anexos.push({ name: file.name, type: file.type, content: base64, origem });
      }
      input.value = '';
      renderAnexos(listEl, origem);
    });
  });
  function renderAnexos(listEl, origem){
    if(!listEl) return;
    listEl.innerHTML = anexos.map((a,i)=>({a,i})).filter(o=>o.a.origem===origem)
      .map(({a,i})=>`<div class="f"><b>${a.name}</b><button type="button" data-i="${i}">✕</button></div>`).join('');
    listEl.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{
      anexos.splice(+b.dataset.i,1);
      document.querySelectorAll('.fp-filelist').forEach(l=>{
        const inp=document.querySelector(`input[data-list="${l.id}"]`);
        renderAnexos(l, inp?inp.dataset.origem||'':'');
      });
    }));
  }
})();
