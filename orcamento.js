/* ===== CADev Hub — Orçamento: step nav, selection, validation ===== */
(function(){
  /* ===== Envio do formulário =====
     Em produção (cadevhub.com) envia de verdade pro enviar-orcamento.php.
     Em preview/local, simula o envio para você conseguir testar o fluxo. */
  const FORM_ENDPOINT = 'enviar-orcamento.php';
  const DEMO_FALLBACK = !/cadevhub\.com$/i.test(location.hostname);

  const data = { tipo: [] };
  const panels = document.querySelectorAll('.fp-step-panel');
  const steps = document.querySelectorAll('.fp-step');
  const bars = document.querySelectorAll('.fp-progress span');

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

  /* ---- option selection (radio / checkbox) ---- */
  document.querySelectorAll('.opts').forEach(group=>{
    const field = group.dataset.field;
    const type = group.dataset.type;
    group.querySelectorAll('.opt').forEach(opt=>{
      opt.addEventListener('click', ()=>{
        const label = opt.querySelector('.txt b').textContent.trim();
        if (type==='radio'){
          group.querySelectorAll('.opt').forEach(o=>o.classList.remove('sel'));
          opt.classList.add('sel');
          data[field] = label;
        } else {
          opt.classList.toggle('sel');
          const set = new Set(data[field]||[]);
          opt.classList.contains('sel') ? set.add(label) : set.delete(label);
          data[field] = [...set];
        }
        clearErr();
      });
    });
  });

  /* ---- validation ---- */
  function showErr(step, msg){
    const el = document.querySelector(`.fp-err[data-err="${step}"]`);
    if(el) el.textContent = msg;
  }
  function clearErr(){ document.querySelectorAll('.fp-err').forEach(e=>e.textContent=''); }

  function validate1(){
    const nome = document.getElementById('nome').value.trim();
    const zap = document.getElementById('zap').value.trim();
    if(!nome){ showErr(1,'Por favor, informe seu nome.'); return false; }
    if(zap.replace(/\D/g,'').length < 10){ showErr(1,'Informe um WhatsApp válido com DDD.'); return false; }
    data.nome=nome; data.zap=zap;
    data.negocio=document.getElementById('neg').value.trim();
    data.link=document.getElementById('link').value.trim();
    return true;
  }

  /* ---- nav buttons ---- */
  document.querySelectorAll('[data-next]').forEach(b=>b.addEventListener('click',()=>{
    const target=+b.dataset.next;
    if(target===2 && !validate1()) return;
    clearErr(); goTo(target);
  }));
  document.querySelectorAll('[data-prev]').forEach(b=>b.addEventListener('click',()=>{ clearErr(); goTo(+b.dataset.prev); }));

  /* ---- submit ---- */
  const modal = document.getElementById('successModal');
  const submitBtn = document.querySelector('[data-submit]');
  function showSuccess(){
    goTo(3);
    modal.classList.add('open');
  }
  submitBtn.addEventListener('click', async ()=>{
    if(!data.presenca){ showErr(2,'Conta pra gente como está sua presença digital.'); return; }
    if(!data.tipo || !data.tipo.length){ showErr(2,'Selecione ao menos um tipo de projeto.'); return; }
    if(!data.objetivo){ showErr(2,'Qual o principal objetivo do projeto?'); return; }
    clearErr();

    // honeypot (preenchido = bot)
    const hp = document.getElementById('hp_field');
    data.hp = hp ? hp.value : '';

    try{ localStorage.setItem('cadev_orcamento', JSON.stringify(data)); }catch(e){}

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
        showErr(2, 'Não foi possível enviar: ' + err.message);
        submitBtn.disabled = false;
        submitBtn.innerHTML = original;
      }
    }
  });
  modal.addEventListener('click',e=>{ if(e.target===modal) modal.classList.remove('open'); });

  /* live phone mask */
  const zap = document.getElementById('zap');
  zap.addEventListener('input',()=>{
    let v = zap.value.replace(/\D/g,'').slice(0,11);
    if(v.length>2) v = v.replace(/^(\d{2})(\d)/,'$1 $2');
    if(v.length>9) v = v.replace(/(\d{5})(\d{1,4})$/,'$1-$2');
    else if(v.length>7) v = v.replace(/(\d{4})(\d{1,4})$/,'$1-$2');
    zap.value = v;
  });
})();
