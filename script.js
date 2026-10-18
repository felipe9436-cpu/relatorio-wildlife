/* WildLife — relatório web. Sem bibliotecas externas ou conexão obrigatória. */
(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const storageKey = 'wildlife-relatorio-v1';
  const state = { credits: {}, checked: [], images: {} };
  const defaults = { author: '', institution: '', teacher: '' };
  let toastTimeout;

  function readState() {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || '{}');
      if (stored && typeof stored === 'object') {
        state.credits = { ...defaults, ...(stored.credits || {}) };
        state.checked = Array.isArray(stored.checked) ? stored.checked : [];
        state.images = stored.images && typeof stored.images === 'object' ? stored.images : {};
      }
    } catch (_) { state.credits = { ...defaults }; }
  }
  function saveState() {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); return true; }
    catch (_) { return false; }
  }
  function toast(message) {
    const node = $('#toast');
    if (!node) return;
    node.textContent = message;
    node.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => node.classList.remove('show'), 2900);
  }

  readState();

  // Navegação do relatório.
  const sidebar = $('#sidebar');
  const toggle = $('#menuToggle');
  const links = $$('.nav-link');
  function closeMenu() {
    sidebar?.classList.remove('open');
    toggle?.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('menu-open');
  }
  toggle?.addEventListener('click', () => {
    const isOpen = sidebar.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });
  links.forEach(a => a.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { closeMenu(); closeCredits(); } });
  document.addEventListener('click', event => {
    if (window.innerWidth <= 1050 && sidebar?.classList.contains('open') && !sidebar.contains(event.target) && !toggle?.contains(event.target)) closeMenu();
  });

  const sections = $$('[data-section]');
  function updateReading() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const pct = max > 0 ? Math.min(100, Math.max(0, window.scrollY / max * 100)) : 0;
    $('#readingTrack').style.width = `${pct}%`;
    let active = sections[0]?.id;
    const boundary = window.scrollY + Math.min(210, window.innerHeight * .28);
    for (const section of sections) if (section.offsetTop <= boundary) active = section.id;
    links.forEach(link => {
      const selected = link.getAttribute('href') === `#${active}`;
      link.classList.toggle('active', selected);
      if (selected) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  window.addEventListener('scroll', updateReading, { passive: true });
  window.addEventListener('resize', updateReading);
  updateReading();

  // Créditos editáveis. Tudo permanece local no navegador.
  const modal = $('#creditsModal');
  const fields = { author: $('#authorInput'), institution: $('#institutionInput'), teacher: $('#teacherInput') };
  function applyCredits() {
    const { author, institution, teacher } = state.credits;
    $('#footerAuthor').textContent = author?.trim() ? `Autor(a): ${author.trim()}` : 'Autor(a): preencher';
    $('#footerInstitution').textContent = institution?.trim() ? `Instituição: ${institution.trim()}` : 'Instituição: preencher';
    let extra = $('#teacherCredit');
    if (teacher?.trim()) {
      if (!extra) { extra = document.createElement('span'); extra.id = 'teacherCredit'; $('#footerInstitution').after(extra); }
      extra.textContent = teacher.trim();
    } else { extra?.remove(); }
  }
  function openCredits() {
    for (const [key, input] of Object.entries(fields)) input.value = state.credits[key] || '';
    modal.hidden = false;
    fields.author.focus();
  }
  function closeCredits() { if (modal) modal.hidden = true; }
  $('#editCredits')?.addEventListener('click', openCredits);
  $('#closeModal')?.addEventListener('click', closeCredits);
  $('#cancelModal')?.addEventListener('click', closeCredits);
  modal?.addEventListener('click', e => { if (e.target === modal) closeCredits(); });
  $('#creditsForm')?.addEventListener('submit', event => {
    event.preventDefault();
    for (const [key, input] of Object.entries(fields)) state.credits[key] = input.value.slice(0, 140);
    saveState(); applyCredits(); closeCredits(); toast('Identificação atualizada.');
  });

  // Checklist de testes: não pré-preenche nenhum resultado.
  const tests = $$('.test-item input[type="checkbox"]');
  function updateTests() {
    const completed = tests.filter(input => input.checked).length;
    $('#testCount').textContent = `${completed} / ${tests.length}`;
    $('#testProgressFill').style.width = `${tests.length ? completed / tests.length * 100 : 0}%`;
  }
  tests.forEach(input => {
    input.checked = state.checked.includes(input.dataset.test);
    input.addEventListener('change', () => {
      state.checked = tests.filter(i => i.checked).map(i => i.dataset.test);
      saveState(); updateTests();
    });
  });
  $('#resetTests')?.addEventListener('click', () => {
    tests.forEach(input => { input.checked = false; });
    state.checked = []; saveState(); updateTests(); toast('Marcações limpas.');
  });
  updateTests();

  // Evidências visuais: imagens na pasta assets/ ou importadas pelo navegador.
  // Arquivos escolhidos pela interface são reduzidos e armazenados localmente;
  // para distribuição do ZIP, coloque originais nos caminhos assets/*.png.
  const imageSlots = $$('.evidence-slot');
  function applyImage(slot, src) {
    const img = $('img', slot);
    const fallback = $('.evidence-fallback', slot);
    img.onload = () => { img.hidden = false; fallback.hidden = true; };
    img.onerror = () => { img.hidden = true; fallback.hidden = false; };
    if (src) img.src = src;
    else { img.hidden = true; fallback.hidden = false; img.removeAttribute('src'); }
  }
  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Arquivo ilegível'));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error('Imagem inválida'));
        image.onload = () => {
          const max = 1150;
          const ratio = Math.min(1, max / Math.max(image.width, image.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(image.width * ratio);
          canvas.height = Math.round(image.height * ratio);
          canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', .73));
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }
  imageSlots.forEach(slot => {
    const name = slot.dataset.slot;
    const saved = state.images[name];
    if (saved) applyImage(slot, saved);
    else applyImage(slot, `assets/${name}.png`);
    const input = $('input[type="file"]', slot);
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) { toast('Selecione uma imagem.'); return; }
      try {
        const value = await compressImage(file);
        state.images[name] = value;
        applyImage(slot, value);
        if (!saveState()) toast('Imagem exibida, mas sem espaço para salvá-la no navegador.');
        else toast('Print adicionado. Use Exportar PDF para incluí-lo no relatório.');
      } catch (_) { toast('Não foi possível abrir esta imagem.'); }
    });
  });

  // Ferramentas de apresentação.
  $('#printTop')?.addEventListener('click', () => window.print());
  $('#printBottom')?.addEventListener('click', () => window.print());
  $('#copyStructure')?.addEventListener('click', async () => {
    const value = $('#structureText')?.innerText || '';
    try { await navigator.clipboard.writeText(value); toast('Estrutura copiada.'); }
    catch (_) { toast('Selecione o trecho e use Ctrl + C.'); }
  });
  applyCredits();
})();
