// app.js - ванильный фронтенд для каталога вузов
// Требования: data/universities.json рядом с index.html

const state = {
  data: [],
  filtered: [],
  page: 1,
  perPage: 10,
  compareSet: new Set(JSON.parse(localStorage.getItem('compare') || '[]')),
  sortBy: 'recommended' // 'rating' | 'tuition' | 'alpha'
};

const els = {
  grid: document.querySelector('.universities-grid'),
  searchInput: document.querySelector('.search-box input'),
  searchBtn: document.querySelector('.search-box .btn-primary'),
  citySelect: null,
  typeSelect: null,
  langSelect: null,
  sortSelect: null,
  pagination: null,
  compareList: null
};

function fetchData() {
  return fetch('data/universities.json')
    .then(r => r.json())
    .then(j => {
      state.data = j;
      state.filtered = j.slice();
      initFilters();
      render();
    })
    .catch(err => {
      console.error('Ошибка загрузки данных', err);
      // Если fetch падает (file://), можно подсунуть встроенный fallback (если нужен)
    });
}

function initFilters() {
  // создаём фильтры динамически (город, тип, язык)
  const cities = Array.from(new Set(state.data.map(u=>u.city))).sort();
  const types = Array.from(new Set(state.data.map(u=>u.type))).sort();
  const langs = Array.from(new Set(state.data.map(u=>u.language))).sort();

  // создаём элемент фильтров в DOM (вставляем после .search-box)
  const container = document.createElement('div');
  container.className = 'filters';
  container.innerHTML = `
    <div class="filters-inner">
      <select id="cityFilter"><option value="">Все города</option></select>
      <select id="typeFilter"><option value="">Все типы</option></select>
      <select id="langFilter"><option value="">Все языки</option></select>
      <select id="sortSelect">
        <option value="recommended">Рекомендуемые</option>
        <option value="rating">По рейтингу (убыв.)</option>
        <option value="tuition">По стоимости (возр.)</option>
        <option value="alpha">По алфавиту (A→Z)</option>
      </select>
    </div>
  `;
  const header = document.querySelector('.header-inner');
  header.insertAdjacentElement('afterend', container);

  const city = container.querySelector('#cityFilter');
  const type = container.querySelector('#typeFilter');
  const lang = container.querySelector('#langFilter');
  const sort = container.querySelector('#sortSelect');

  cities.forEach(c => {
    const o = document.createElement('option'); o.value = c; o.textContent = c; city.appendChild(o);
  });
  types.forEach(t => {
    const o = document.createElement('option'); o.value = t; o.textContent = t; type.appendChild(o);
  });
  langs.forEach(l => {
    const o = document.createElement('option'); o.value = l; o.textContent = l; lang.appendChild(o);
  });

  // attach to els for later use
  els.citySelect = city;
  els.typeSelect = type;
  els.langSelect = lang;
  els.sortSelect = sort;

  city.addEventListener('change', applyFilters);
  type.addEventListener('change', applyFilters);
  lang.addEventListener('change', applyFilters);
  sort.addEventListener('change', (e) => { state.sortBy = e.target.value; applyFilters(); });
}

function applyFilters() {
  const q = els.searchInput.value.trim().toLowerCase();
  const city = els.citySelect ? els.citySelect.value : '';
  const type = els.typeSelect ? els.typeSelect.value : '';
  const lang = els.langSelect ? els.langSelect.value : '';

  let list = state.data.filter(u=>{
    if (city && u.city !== city) return false;
    if (type && u.type !== type) return false;
    if (lang && u.language !== lang) return false;
    if (q) {
      const hay = (u.name_ru + ' ' + u.programs + ' ' + u.city + ' ' + (u.mission||'')).toLowerCase();
      return hay.includes(q);
    }
    return true;
  });

  // sorting
  if (state.sortBy === 'rating') list.sort((a,b)=>b.rating - a.rating);
  else if (state.sortBy === 'tuition') list.sort((a,b)=>a.tuition_kzt - b.tuition_kzt);
  else if (state.sortBy === 'alpha') list.sort((a,b)=>a.name_ru.localeCompare(b.name_ru, 'ru'));

  state.filtered = list;
  state.page = 1;
  render();
}

function render() {
  // pagination
  const start = (state.page - 1) * state.perPage;
  const pageItems = state.filtered.slice(start, start + state.perPage);

  // clear
  els.grid.innerHTML = '';

  if (pageItems.length === 0) {
    els.grid.innerHTML = '<div class="empty">Ничего не найдено</div>';
  } else {
    pageItems.forEach(u => {
      const card = document.createElement('article');
      card.className = 'university-card';
      card.innerHTML = `
        <div class="university-top">
          <img class="university-logo" src="${u.logo || 'https://picsum.photos/seed/default/120/120'}" alt="">
          <div class="title-wrap">
            <div class="university-title">${u.name_ru}</div>
            <div class="university-location">${u.city} • ${u.type}</div>
          </div>
        </div>
        <p class="university-info">${u.programs}</p>
        <div class="university-meta">
          <span class="badge">Рейтинг ${u.rating}</span>
          <span class="badge muted">От ${u.tuition_kzt.toLocaleString('ru-RU')} KZT/год</span>
        </div>
        <div class="university-buttons">
          <a class="btn btn-outline" href="${u.website}" target="_blank">Сайт</a>
          <button class="btn btn-ghost js-details" data-id="${u.id}">Подробнее</button>
          <button class="btn btn-outline js-compare" data-id="${u.id}">${state.compareSet.has(u.id) ? 'Убрать' : 'Сравнить'}</button>
        </div>
      `;
      els.grid.appendChild(card);
    });
  }

  renderPagination();
  attachCardEvents();
  renderComparePanel();
}

function attachCardEvents(){
  document.querySelectorAll('.js-details').forEach(btn=>{
    btn.onclick = () => {
      const id = Number(btn.dataset.id);
      const item = state.data.find(x=>x.id===id);
      openDetails(item);
    };
  });
  document.querySelectorAll('.js-compare').forEach(btn=>{
    btn.onclick = () => {
      const id = Number(btn.dataset.id);
      toggleCompare(id);
      render(); // rerender to update button text
    };
  });
}

function openDetails(item){
  // simple modal
  const modal = document.createElement('div');
  modal.className = 'modal open';
  modal.innerHTML = `
    <div class="modal-content">
      <button class="modal-close">✕</button>
      <h2>${item.name_ru}</h2>
      <p><strong>Город:</strong> ${item.city} • <strong>Тип:</strong> ${item.type}</p>
      <p><strong>Программы:</strong> ${item.programs}</p>
      <p><strong>Стоимость:</strong> ${item.tuition_kzt.toLocaleString('ru-RU')} KZT/год</p>
      <p><strong>Рейтинг:</strong> ${item.rating} • <strong>Проходной:</strong> ${item.pass_score}</p>
      <p><strong>Контакты:</strong> <a href="${item.website}" target="_blank">${item.website}</a> • ${item.phone} • ${item.email}</p>
      <p><strong>Миссия:</strong> ${item.mission}</p>
      <p><strong>История:</strong> ${item.history}</p>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector('.modal-close').onclick = () => modal.remove();
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
}

function toggleCompare(id) {
  if (state.compareSet.has(id)) state.compareSet.delete(id);
  else {
    if (state.compareSet.size >= 3) {
      alert('Можно сравнить до 3 вузов.');
      return;
    }
    state.compareSet.add(id);
  }
  localStorage.setItem('compare', JSON.stringify(Array.from(state.compareSet)));
  renderComparePanel();
}

function renderComparePanel(){
  // create panel if not exists
  let panel = document.querySelector('.compare-panel');
  if (!panel) {
    panel = document.createElement('aside');
    panel.className = 'compare-panel';
    panel.innerHTML = `<h4>Сравнение</h4><div class="compare-list"></div><div class="compare-actions"><button class="btn btn-primary js-compare-open">Сравнить</button><button class="btn btn-outline js-compare-clear">Очистить</button></div>`;
    document.body.appendChild(panel);
    panel.querySelector('.js-compare-open').onclick = showComparisonTable;
    panel.querySelector('.js-compare-clear').onclick = ()=>{ state.compareSet.clear(); localStorage.removeItem('compare'); renderComparePanel(); render(); };
  }
  const list = panel.querySelector('.compare-list');
  list.innerHTML = '';
  if (state.compareSet.size === 0) {
    list.innerHTML = '<div class="muted">Нет выбранных вузов</div>';
    return;
  }
  const items = state.data.filter(u => state.compareSet.has(u.id));
  items.forEach(u=>{
    const div = document.createElement('div');
    div.className = 'compare-item';
    div.innerHTML = `<div class="cmp-title">${u.name_ru}</div><div class="cmp-meta">${u.city} • ${u.type}</div><button class="btn btn-outline js-compare-remove" data-id="${u.id}">✕</button>`;
    list.appendChild(div);
  });
  panel.querySelectorAll('.js-compare-remove').forEach(b=>b.onclick = (e)=>{ toggleCompare(Number(e.target.dataset.id)); });
}

function showComparisonTable(){
  const ids = Array.from(state.compareSet);
  if (ids.length < 2) { alert('Выберите минимум 2 вуза для сравнения.'); return; }
  const list = state.data.filter(u=>ids.includes(u.id));
  // build table
  let html = `<div class="modal open"><div class="modal-content"><button class="modal-close">✕</button><h2>Сравнение вузов</h2><div class="compare-table-wrap"><table class="compare-table"><thead><tr><th>Поле</th>${list.map(u=>`<th>${u.name_ru}</th>`).join('')}</tr></thead><tbody>`;
  const rows = [
    ['Город', ...list.map(u=>u.city)],
    ['Тип', ...list.map(u=>u.type)],
    ['Стоимость (KZT/год)', ...list.map(u=>u.tuition_kzt.toLocaleString('ru-RU'))],
    ['Рейтинг', ...list.map(u=>u.rating)],
    ['Программы', ...list.map(u=>u.programs)]
  ];
  rows.forEach(r=>{
    html += `<tr><td class="row-title">${r[0]}</td>` + r.slice(1).map(v=>`<td>${v}</td>`).join('') + `</tr>`;
  });
  html += `</tbody></table></div></div></div>`;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper.firstChild);
  const modal = document.querySelector('.modal.open');
  modal.querySelector('.modal-close').onclick = ()=> modal.remove();
  modal.onclick = (e)=>{ if (e.target === modal) modal.remove(); };
}

function renderPagination(){
  // remove old
  let pag = document.querySelector('.pagination');
  if (!pag) {
    pag = document.createElement('div');
    pag.className = 'pagination';
    document.querySelector('.container').appendChild(pag);
  }
  const total = Math.ceil(state.filtered.length / state.perPage) || 1;
  pag.innerHTML = '';
  const left = document.createElement('div');
  left.className = 'page-controls';
  const prev = document.createElement('button'); prev.className='btn btn-outline'; prev.textContent='‹'; prev.disabled = state.page===1;
  prev.onclick = ()=>{ state.page = Math.max(1, state.page-1); render(); };
  const next = document.createElement('button'); next.className='btn btn-outline'; next.textContent='›'; next.disabled = state.page===total;
  next.onclick = ()=>{ state.page = Math.min(total, state.page+1); render(); };
  left.appendChild(prev);
  left.appendChild(next);
  pag.appendChild(left);

  const info = document.createElement('div');
  info.className = 'page-info';
  info.textContent = `Страница ${state.page} из ${total} • ${state.filtered.length} результатов`;
  pag.appendChild(info);

  // jump to page numbers (if few)
  const pagesWrap = document.createElement('div');
  pagesWrap.className = 'pages-wrap';
  for (let i=1;i<=total;i++){
    const b = document.createElement('button'); b.className='btn btn-outline page-btn'; b.textContent = i; if (i===state.page) { b.style.fontWeight='700'; }
    b.onclick = ()=>{ state.page = i; render(); };
    pagesWrap.appendChild(b);
    if (i>=7) { // don't create too many buttons
      if (total>7){
        const more = document.createElement('span'); more.textContent='...'; pagesWrap.appendChild(more);
      }
      break;
    }
  }
  pag.appendChild(pagesWrap);
}

function initUI(){
  els.searchBtn.onclick = ()=> applyFilters();
  els.searchInput.addEventListener('keydown', (e)=> { if (e.key === 'Enter') applyFilters(); });

  // ensure compare panel initial render
  renderComparePanel();
}

// initial
document.addEventListener('DOMContentLoaded', ()=>{
  if (!els.grid) { console.error('Grid element not found (.universities-grid)'); return; }
  initUI();
  fetchData();
});