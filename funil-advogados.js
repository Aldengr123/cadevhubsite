/* ===== CADev Hub — Funil Advogados: navegação, validação, envio ===== */
(function(){
  const FORM_ENDPOINT = 'enviar-funil-advogados.php';
  const DEMO_FALLBACK = !/cadevhub\.com$/i.test(location.hostname);
  const LAST = 4;

  const data = {};
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

  /* ---- seleção (radio / checkbox) ---- */
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

  /* ---- erros ---- */
  function showErr(step, msg){
    const el = document.querySelector(`.fp-err[data-err="${step}"]`);
    if(el) el.textContent = msg;
  }
  function clearErr(){ document.querySelectorAll('.fp-err').forEach(e=>e.textContent=''); }

  /* ---- valida um grupo obrigatório dentro de um painel ---- */
  function validateRequiredGroups(step){
    const panel = document.querySelector(`.fp-step-panel[data-panel="${step}"]`);
    const groups = panel.querySelectorAll('.opts[data-req]');
    for(const g of groups){
      const f = g.dataset.field;
      const v = data[f];
      const empty = !v || (Array.isArray(v) && v.length===0);
      if(empty){ showErr(step, g.dataset.req); return false; }
    }
    return true;
  }

  /* ---- valida etapa 1 (nome + zap + área) ---- */
  function validate1(){
    const nome = document.getElementById('nome').value.trim();
    const zap = document.getElementById('zap').value.trim();
    if(!nome){ showErr(1,'Por favor, informe seu nome.'); return false; }
    if(zap.replace(/\D/g,'').length < 10){ showErr(1,'Informe um WhatsApp válido com DDD.'); return false; }
    data.nome = nome; data.zap = zap;
    return validateRequiredGroups(1);
  }

  /* ---- navegação ---- */
  document.querySelectorAll('[data-next]').forEach(b=>b.addEventListener('click',()=>{
    const target = +b.dataset.next;
    const from = target - 1;
    if(from===1 && !validate1()) return;
    if(from>1 && !validateRequiredGroups(from)) return;
    if(from===3){ data.trava = document.getElementById('trava').value.trim(); }
    clearErr(); goTo(target);
  }));
  document.querySelectorAll('[data-prev]').forEach(b=>b.addEventListener('click',()=>{ clearErr(); goTo(+b.dataset.prev); }));

  /* ---- envio ---- */
  const modal = document.getElementById('successModal');
  const submitBtn = document.querySelector('[data-submit]');
  function showSuccess(){ modal.classList.add('open'); }

  const WA_NUMBER = '5531971566510'; // WhatsApp da CADev Hub

  function buildWaMessage(){
    const L = [];
    L.push('Olá! Vim pelo diagnóstico do site e quero conversar.');
    L.push('');
    if(data.nome)      L.push('*Nome:* ' + data.nome);
    if(data.area)      L.push('*Área:* ' + data.area);
    if(data.estrutura) L.push('*Atuação:* ' + data.estrutura);
    if(data.captacao && data.captacao.length) L.push('*Capta clientes por:* ' + data.captacao.join(', '));
    if(data.site)      L.push('*Site hoje:* ' + data.site);
    if(data.anuncios)  L.push('*Anúncios:* ' + data.anuncios);
    if(data.conteudo)  L.push('*Conteúdo:* ' + data.conteudo);
    if(data.objetivo)  L.push('*Objetivo:* ' + data.objetivo);
    if(data.meta)      L.push('*Meta de clientes/mês:* ' + data.meta);
    if(data.trava)     L.push('*O que trava:* ' + data.trava);
    if(data.canal)     L.push('*Prefere falar por:* ' + data.canal);
    if(data.periodo)   L.push('*Melhor período:* ' + data.periodo);
    return L.join('\n');
  }

  submitBtn.addEventListener('click', ()=>{
    if(!validateRequiredGroups(LAST)) return;
    clearErr();

    data.trava = document.getElementById('trava').value.trim();
    const hp = document.getElementById('hp_field');
    if(hp && hp.value) return; // honeypot: bot, ignora silenciosamente

    try{ localStorage.setItem('cadev_funil_advogados', JSON.stringify(data)); }catch(e){}

    const url = 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(buildWaMessage());
    window.open(url, '_blank', 'noopener');
    showSuccess();
  });
  modal.addEventListener('click',e=>{ if(e.target===modal) modal.classList.remove('open'); });

  /* ---- máscara de telefone ---- */
  const zap = document.getElementById('zap');
  zap.addEventListener('input',()=>{
    let v = zap.value.replace(/\D/g,'').slice(0,11);
    if(v.length>2) v = v.replace(/^(\d{2})(\d)/,'$1 $2');
    if(v.length>9) v = v.replace(/(\d{5})(\d{1,4})$/,'$1-$2');
    else if(v.length>7) v = v.replace(/(\d{4})(\d{1,4})$/,'$1-$2');
    zap.value = v;
  });
})();
