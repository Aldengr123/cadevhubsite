# CADev Hub — Publicação e envio do formulário

## Arquivos do site
```
index.html               → página principal
orcamento.html          → formulário de orçamento
styles.css, orcamento.css, app.js, orcamento.js
config-email.php        → ÚNICO lugar com a chave do Resend (protegido)
.htaccess               → bloqueia acesso web à config e aos logs
enviar-orcamento.php    → recebe o formulário e envia o e-mail (via Resend / HTTPS)
diagnostico.php         → página de teste no navegador (descobre falhas de envio)
assets/frames/          → 120 frames .webp da animação de abertura (scroll-scrub)
uploads/                → imagens .avif/.png dos projetos + .webm do lightbox
```

---

## 1) Configurar o envio — Resend (por HTTPS)
O formulário envia a notificação pelo **Resend** (API por **HTTPS, porta 443**). Isso **contorna o bloqueio de SMTP da DigitalOcean** e **não mexe no seu MX**: o e-mail continua sendo **recebido** na GoDaddy normalmente — o Resend só **envia** o aviso de novo orçamento.

**Passos:**
1. Crie a conta em **https://resend.com** (pode usar `contato@cadevhub.com`).
2. No painel: **API Keys → Create API Key** → copie a chave (começa com `re_`).
3. Abra **`config-email.php`** e cole em `api_key`:
   ```php
   'api_key' => 're_suachave_aqui',
   ```
4. **Remetente (`from`):**
   - **Agora, sem verificar domínio:** deixe `'CADev Hub <onboarding@resend.dev>'` — funciona na hora e o e-mail chega em `contato@cadevhub.com`.
   - **Depois (recomendado p/ não cair em spam):** no Resend → **Domains → Add Domain → cadevhub.com**. Ele dá uns registros **TXT/CNAME (DKIM)** para adicionar no **Cloudflare**. Verificado, troque o `from` para `'CADev Hub <contato@cadevhub.com>'`.

> Os leads chegam em `contato@cadevhub.com` (campo `to`) — sua caixa atual, sem mudar nada no recebimento. Plano grátis do Resend: ~3.000 e-mails/mês.

### 🔒 Segurança da chave (importante)
A chave fica em `config-email.php`, com **três camadas** de proteção:
1. **É `.php`, não `.env`/`.txt`** — ao acessar `cadevhub.com/config-email.php` o servidor *executa* (não mostra o texto). Um `.env` em `public_html` seria texto puro e vazaria.
2. **Guarda `CADEV_APP`** — o arquivo só roda se incluído pelo `enviar-orcamento.php`/`diagnostico.php`. Acesso direto retorna **403**, mesmo que o PHP falhe e tente servir como texto.
3. **`.htaccess`** — bloqueia no servidor o acesso web a `config-email.php`, ao `*.log` e ao próprio `.htaccess`. Funciona em Apache e LiteSpeed/CyberPanel.

**Suba o `.htaccess` junto** com os outros arquivos (ele fica na raiz do site).

**Camada extra (opcional, a mais forte):** mover a chave para **fora** do `public_html`. Ex.: crie `/home/cadevhub.com/segredos/config-email.php` e, no `enviar-orcamento.php`/`diagnostico.php`, troque o caminho do `require` para `'/home/cadevhub.com/segredos/config-email.php'`. Fora da pasta pública, **nenhuma** requisição web alcança o arquivo. Me avise que eu ajusto os caminhos.

> Nunca versione `config-email.php` num Git público. Se usar Git, adicione-o ao `.gitignore`.

---

## 2) Subir na VPS (CyberPanel / LiteSpeed)
1. Envie os arquivos para o **Document Root** do site (no CyberPanel: `/home/cadevhub.com/public_html/`). A página principal já é o **`index.html`**.
3. PHP já vem habilitado (lsphp). Precisa da extensão **cURL** (padrão) ou `allow_url_fopen=on` — qualquer uma serve para o HTTPS do Resend.
4. Permissões: arquivos `644`, pastas `755`. A pasta precisa de **escrita** para gravar o log de debug.
5. **Não** exponha `config-email.php` em repositório público (tem a chave).

### SSL
Emita o certificado (Let's Encrypt pelo CyberPanel ou Cloudflare). Com o domínio **proxied (nuvem laranja)** no Cloudflare, use SSL/TLS em **Full (strict)** com cert válido na origem.

---

## 3) Testar
Acesse `https://cadevhub.com/diagnostico.php?key=cadev2026` — ele faz, em ordem:
ambiente PHP → cURL/OpenSSL → conexão HTTPS à api.resend.com → **envio real de um e-mail de teste** → mostra o resultado e as últimas linhas do log. **O primeiro ❌ de cima para baixo é a causa.**

Tudo ✅ e o e-mail de teste chegou? Então abra `https://cadevhub.com/orcamento.html`, preencha e envie de verdade.

> O JS detecta o domínio: em `cadevhub.com` o envio é **real**; em preview/localhost ele **simula** (mostra o modal) para você testar o fluxo sem backend.

### Causas comuns (o diagnóstico aponta qual é)
| Sintoma | Causa | Correção |
|---|---|---|
| **API key ❌ / HTTP 401-403** | chave inválida, revogada ou placeholder | Gere outra no Resend e cole em `config-email.php` |
| **HTTP 403 "domain is not verified"** | `from` usa `@cadevhub.com` sem verificar | Use `onboarding@resend.dev` por ora, ou verifique o domínio no Resend |
| **HTTP 422** | formato do `from` inválido | Use `"Nome <email>"` (ex.: `CADev Hub <onboarding@resend.dev>`) |
| **Conexão 443 ❌** | sem cURL **e** `allow_url_fopen=off` | Habilite cURL no lsphp (ou `allow_url_fopen=on`) |
| **e-mail caiu no spam** | domínio não verificado | Verifique cadevhub.com no Resend (DKIM) e use o `from` do próprio domínio |

### Modo DEBUG
`enviar-orcamento.php` está com **`$DEBUG = true`**: grava cada passo em **`debug-orcamento.log`** e devolve o detalhe do erro na mensagem vermelha do formulário.
**Depois de validar:** ponha **`$DEBUG = false`** e **apague** `diagnostico.php` + `debug-orcamento.log` do servidor.

---

## Anti-spam
Incluído um **honeypot** (campo oculto `hp`): se um robô preencher, o PHP ignora silenciosamente. Para reforçar, dá pra plugar Cloudflare Turnstile depois.

## Imagens dos projetos (AVIF + fallback, desktop/mobile)
Os 3 cards usam `<picture>` com **AVIF principal**, fallback **WebP/PNG** e troca automática para a **versão mobile (retrato)** abaixo de 767px:
```html
<picture>
  <source media="(max-width:767px)" srcset="uploads/NOME-mobile.avif" type="image/avif">
  <source media="(max-width:767px)" srcset="uploads/NOME-mobile.webp" type="image/webp">
  <source srcset="uploads/NOME.avif" type="image/avif">
  <img src="uploads/NOME.png" alt="..." loading="lazy">
</picture>
```
Arquivos em `uploads/` (desktop 1280×714 / mobile 1080×1920):
- `pedrogomes-mockup` (.avif/.png) + `pedrogomes-mockup-mobile` (.avif/.webp) — card "Site institucional"
- `falaalicia-mockup` (.avif/.png) + `falaalicia-mockup-mobile` (.avif/.webp) — card "Landing page"
- `animação-thumb` (.avif/.png) + `animação-thumb-mobile` (.avif/.webp) — card "Animação com I.A"

> Garanta o MIME `image/avif` no LiteSpeed (builds recentes já trazem). No mobile os cards ficam em retrato (3/4).

## Animação de abertura (scroll-scrub por frames)
Usa uma **sequência de 120 imagens WebP** (`assets/frames/frame-000.webp` … `frame-119.webp`) desenhadas num `<canvas>` conforme a rolagem — técnica "estilo Apple":
- **Fluidez:** cada frame já decodificado, desenho instantâneo (sem "seek" de vídeo, que travava).
- **Compatibilidade total:** roda em tudo, **incluindo Safari/iPhone**.
- **Leve:** os WebP somam ~1 MB e carregam atrás da barra "Carregando experiência".

Para trocar a animação, substitua os arquivos em `assets/frames/` mantendo a numeração (ou ajuste `FRAME_COUNT` no topo do `app.js`).

> O `.webm` em `uploads/` ainda é usado no **lightbox** do card "Animação com I.A" — mantenha-o.

## Opcional — cópia em planilha/CRM
O endpoint hoje envia por e-mail (Resend). Se quiser também registrar em Google Sheets ou num CRM (RD Station, etc.), me diga o destino que eu adiciono o gancho no `enviar-orcamento.php`.
