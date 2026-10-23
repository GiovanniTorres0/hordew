// Barra de versões: mostra qual versão está aberta, lista as prévias geradas pelas Issues,
// avisa quando sai versão nova e ajuda a sugerir, aprovar ou apagar. Funciona fora do Phaser (HTML puro).
(function () {
  const REPO = 'https://github.com/GiovanniTorres0/hordew';
  const path = location.pathname;
  const m = path.match(/^(.*\/)preview\/([^/]+)\//);
  const root = m ? m[1] : path.replace(/[^/]*$/, ''); // pasta da versão oficial
  const slug = m ? m[2] : null; // null = versão oficial
  let current = null; // informações desta versão no versions.json
  let known = null; // datas das versões na primeira leitura, para detectar novidades

  const css = `
    #hv-bar { position: fixed; bottom: 10px; right: 10px; z-index: 10; display: flex; gap: 6px; font: 13px system-ui, sans-serif; }
    #hv-bar button, #hv-box button { background: #2b2823; color: #e9e1cc; border: 1px solid #6b5a44; border-radius: 3px; padding: 5px 9px; cursor: pointer; font: inherit; }
    #hv-bar button:hover, #hv-box button:hover { background: #4a3d2e; }
    #hv-bar .hv-new { background: #3d6b2a; border-color: #7fd67f; }
    #hv-box { position: fixed; bottom: 46px; right: 8px; z-index: 10; width: min(380px, calc(100vw - 32px)); max-height: 70vh; overflow: auto;
      background: #16130fee; color: #e9e1cc; border: 1px solid #6b5a44; border-radius: 8px; padding: 12px; font: 13px system-ui, sans-serif; }
    #hv-box h3 { margin: 0 0 8px; font-size: 15px; }
    #hv-box a { color: #7fd67f; }
    #hv-box .hv-item { padding: 6px 0; border-top: 1px solid #3b2d50; }
    #hv-box .hv-item small { color: #b9a9cf; display: block; }
    #hv-box .hv-here { color: #ffd76a; }
    #hv-box textarea { width: 100%; box-sizing: border-box; min-height: 80px; background: #120d19; color: #f4ecff; border: 1px solid #5b4a73; border-radius: 6px; padding: 6px; font: inherit; }
    #hv-box .hv-row { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const bar = document.createElement('div');
  bar.id = 'hv-bar';
  const box = document.createElement('div');
  box.id = 'hv-box';
  box.hidden = true;
  // As teclas digitadas aqui não podem mexer o personagem
  ['keydown', 'keyup'].forEach((t) => box.addEventListener(t, (e) => e.stopPropagation()));
  document.body.append(bar, box);

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const issueOf = (branch) => (branch.match(/issue-(\d+)/) || [])[1];

  function button(label, onClick, cls) {
    const b = document.createElement('button');
    b.textContent = label;
    if (cls) b.className = cls;
    b.onclick = onClick;
    return b;
  }

  function toggle(render) {
    if (!box.hidden && box.dataset.view === render.name) { box.hidden = true; return; }
    box.dataset.view = render.name;
    render();
    box.hidden = false;
  }

  // Onde o jogador está agora, para o Claude entender o contexto do pedido
  function gameContext() {
    try {
      const s = typeof game !== 'undefined' && game.scene.getScene('GameScene');
      if (!s || !game.scene.isActive('GameScene')) return 'No menu.';
      return `Fase ${s.levelIndex + 1}, horda ${s.wave}, dificuldade ${s.diff.name || s.diff.id}, dinheiro ${s.money}.`;
    } catch (e) { return ''; }
  }

  function suggestView() {
    const where = slug ? `Testando a versão \`${current ? current.branch : slug}\`` : 'Versão oficial';
    box.innerHTML = `<h3>💬 Sugerir mudança</h3>
      <p>Escreva o que você quer. Vai abrir o GitHub com o pedido pronto: é só clicar em <b>Submit</b>.
      Em poucos minutos o Claude cria uma <b>versão nova</b>, que aparece em 📦 Versões.</p>
      <textarea id="hv-text" placeholder="ex.: o Hunter está forte demais; quero uma torre de gelo"></textarea>
      <div class="hv-row"></div>`;
    const row = box.querySelector('.hv-row');
    row.append(button('Enviar pedido', () => {
      const text = box.querySelector('#hv-text').value.trim();
      if (!text) return;
      const body = `@claude ${text}\n\n---\n${where}. ${gameContext()}`;
      const title = 'Pedido: ' + text.slice(0, 60);
      window.open(`${REPO}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`, '_blank');
      box.hidden = true;
    }));
    setTimeout(() => box.querySelector('#hv-text').focus(), 0);
  }

  function versionsView() {
    const list = (window.hvVersions || []);
    const items = list.map((v) => {
      const here = v.slug === slug ? ' <span class="hv-here">(você está aqui)</span>' : '';
      return `<div class="hv-item"><a href="${root}preview/${esc(v.slug)}/">${esc(v.msg || v.branch)}</a>${here}
        <small>${esc(v.branch)} · ${esc(v.date)}</small></div>`;
    }).join('') || '<p>Nenhuma versão de teste no momento.</p>';
    const official = slug ? `<p><a href="${root}">⬅ Voltar para a versão oficial</a></p>` : '<p class="hv-here">Você está na versão oficial.</p>';
    box.innerHTML = `<h3>📦 Versões para testar</h3>${official}${items}<div class="hv-row"></div>`;
    if (slug && current) {
      const row = box.querySelector('.hv-row');
      const n = issueOf(current.branch);
      const branch = encodeURIComponent(current.branch);
      row.append(button('✅ Ficou bom: aprovar', () => window.open(`${REPO}/compare/main...${branch}?quick_pull=1&body=${encodeURIComponent(n ? `Closes #${n}` : '')}`, '_blank')));
      if (n) row.append(button('✏️ Pedir ajuste', () => window.open(`${REPO}/issues/${n}#new_comment_field`, '_blank')));
      row.append(button('🗑 Apagar esta versão', () => window.open(`${REPO}/branches/all?query=${branch}`, '_blank')));
      box.insertAdjacentHTML('beforeend', '<small>Apagar: clique na lixeira 🗑 ao lado da branch no GitHub. A versão some daqui em 1 minuto.</small>');
    }
  }

  function renderBar(hasNews) {
    bar.innerHTML = '';
    const label = slug ? `🧪 ${current ? current.msg || current.branch : slug}` : 'Versão oficial';
    const tag = document.createElement('button');
    tag.textContent = label.length > 34 ? label.slice(0, 33) + '…' : label;
    tag.title = slug ? (current ? current.branch : slug) : 'Versão oficial';
    tag.onclick = () => toggle(versionsView);
    bar.append(tag);
    if (hasNews) bar.append(button('🔄 Versão nova pronta!', () => (hasNews === 'self' ? location.reload() : toggle(versionsView)), 'hv-new'));
    bar.append(button('📦 Versões', () => toggle(versionsView)), button('💬 Sugerir', () => toggle(suggestView)));
  }

  async function check() {
    try {
      const res = await fetch(`${root}preview/versions.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(res.status);
      const list = await res.json();
      window.hvVersions = list;
      current = list.find((v) => v.slug === slug) || null;
      const stamp = Object.fromEntries(list.map((v) => [v.slug, v.sha || v.date]));
      let news = false;
      if (known) {
        if (slug && known[slug] && stamp[slug] && known[slug] !== stamp[slug]) news = 'self'; // esta versão foi atualizada
        else if (list.some((v) => !known[v.slug])) news = 'list'; // apareceu versão nova
      } else known = stamp;
      renderBar(news);
      if (!box.hidden && box.dataset.view === 'versionsView') versionsView();
    } catch (e) {
      renderBar(false); // rodando local ou sem prévias: a barra continua para sugerir
    }
  }

  renderBar(false);
  check();
  setInterval(check, 60000);
})();
