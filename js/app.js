(function () {
  'use strict';

  var LS_ADS = 'site_ads_local';
  var LS_HIDDEN = 'site_ads_hidden';
  var filters = { q: '', sort: 'new', pmin: '', pmax: '' };

  function $(s, r) { return (r || document).querySelector(s); }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function catById(slug) {
    for (var i = 0; i < CATEGORIES.length; i++) if (CATEGORIES[i].slug === slug) return CATEGORIES[i];
    return null;
  }
  function loadLocal() { try { return JSON.parse(localStorage.getItem(LS_ADS)) || []; } catch (e) { return []; } }
  function loadHidden() { try { return JSON.parse(localStorage.getItem(LS_HIDDEN)) || []; } catch (e) { return []; } }
  function saveLocal(a) { localStorage.setItem(LS_ADS, JSON.stringify(a)); }
  function allAds() {
    var hidden = loadHidden();
    return SEED_ADS.filter(function (a) { return hidden.indexOf(a.id) === -1; }).concat(loadLocal());
  }
  function getAd(id) {
    var list = allAds();
    for (var i = 0; i < list.length; i++) if (String(list[i].id) === String(id)) return list[i];
    return null;
  }
  function fmtPrice(ad) {
    var pre = ad.unit === 'от ' ? 'от ' : '';
    var suf = ad.unit === '/мес' || ad.unit === '/м²' || ad.unit === '/час' ? ad.unit : '';
    return pre + Number(ad.price).toLocaleString('ru-RU') + ' ₽' + suf;
  }
  function fmtDate(ts) {
    var d = Math.floor((Date.now() - ts) / 86400000);
    if (d <= 0) return 'Сегодня';
    if (d === 1) return 'Вчера';
    if (d < 7) return d + ' дн. назад';
    return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  }
  function sellerName(id) {
    var n = 0;
    String(id).split('').forEach(function (c) { n += c.charCodeAt(0); });
    return NAMES[n % NAMES.length];
  }
  function photoUrl(ad) { return 'https://picsum.photos/seed/avito' + ad.id + '/640/480'; }
  function svgPhoto(ad) {
    var cat = catById(ad.cat) || { icon: 'cheap' };
    var h1 = (ad.id * 47) % 360, h2 = (h1 + 40) % 360;
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="hsl(' + h1 + ',45%,90%)"/>' +
      '<stop offset="1" stop-color="hsl(' + h2 + ',45%,76%)"/>' +
      '</linearGradient></defs>' +
      '<rect width="640" height="480" fill="url(#g)"/>' +
      '<g transform="translate(280,180) scale(3.4)" stroke="#9a978f" stroke-width="0.9" stroke-linecap="round" stroke-linejoin="round" fill="none">' +
      (ICONS[cat.icon] || '').replace(/<svg[^>]*>/, '').replace('</svg>', '') +
      '</g></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  var toastTimer = null;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2500);
  }

  /* ---------- карточка ---------- */
  function adCard(ad) {
    var a = el('a', 'ad-card');
    a.href = '#/ad/' + ad.id;
    var cat = catById(ad.cat);
    a.innerHTML =
      '<div class="ad-card-photo"><img loading="lazy" alt=""></div>' +
      '<div class="ad-card-title">' + esc(ad.title) + '</div>' +
      '<div class="ad-card-price">' + fmtPrice(ad) + '</div>' +
      '<div class="ad-card-meta">' + esc(ad.city) + '<span class="dot">·</span>' + fmtDate(ad.ts) + '</div>';
    var img = a.querySelector('img');
    img.src = photoUrl(ad);
    img.onerror = function () { this.onerror = null; this.src = svgPhoto(ad); };
    return a;
  }

  /* ---------- лента ---------- */
  function renderFeed(app, cat) {
    var ads = allAds();
    var q = filters.q.toLowerCase().trim();
    var list = ads.filter(function (a) {
      if (cat && a.cat !== cat.slug) return false;
      if (filters.pmin !== '' && Number(a.price) < Number(filters.pmin)) return false;
      if (filters.pmax !== '' && Number(a.price) > Number(filters.pmax)) return false;
      if (q && (a.title + ' ' + a.desc + ' ' + a.city).toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
    if (filters.sort === 'cheap') list.sort(function (a, b) { return a.price - b.price; });
    else if (filters.sort === 'exp') list.sort(function (a, b) { return b.price - a.price; });
    else list.sort(function (a, b) { return b.ts - a.ts; });

    var head = el('div', 'feed-head');
    head.innerHTML = '<h1>' + esc(cat ? cat.name : (q ? 'Результаты поиска' : 'Свежие объявления')) + '</h1>' +
      '<span class="feed-count">' + list.length + (list.length < 5 ? ' объявления' : list.length < 20 ? ' объявления' : ' объявлений') + '</span>';
    app.appendChild(head);

    var f = el('div', 'filters');
    f.innerHTML =
      '<label>Цена, ₽: <input type="number" id="fMin" min="0" placeholder="от" value="' + esc(filters.pmin) + '"></label>' +
      '<label>— <input type="number" id="fMax" min="0" placeholder="до" value="' + esc(filters.pmax) + '"></label>' +
      '<label>Сортировка: <select id="fSort">' +
      '<option value="new"' + (filters.sort === 'new' ? ' selected' : '') + '>Сначала новые</option>' +
      '<option value="cheap"' + (filters.sort === 'cheap' ? ' selected' : '') + '>Сначала дешёвые</option>' +
      '<option value="exp"' + (filters.sort === 'exp' ? ' selected' : '') + '>Сначала дорогие</option>' +
      '</select></label>' +
      '<span class="reset-link" id="fReset">Сбросить фильтры</span>';
    app.appendChild(f);
    $('#fMin').onchange = function () { filters.pmin = this.value; route(); };
    $('#fMax').onchange = function () { filters.pmax = this.value; route(); };
    $('#fSort').onchange = function () { filters.sort = this.value; route(); };
    $('#fReset').onclick = function () {
      filters = { q: '', sort: 'new', pmin: '', pmax: '' };
      var si = $('#searchInput'); if (si) si.value = '';
      route();
    };

    if (!list.length) {
      app.appendChild(el('div', 'empty',
        '<div class="big">🔍</div><p>Ничего не нашлось. Попробуйте изменить запрос или сбросить фильтры.</p>'));
      return;
    }
    var g = el('div', 'grid');
    list.forEach(function (ad) { g.appendChild(adCard(ad)); });
    app.appendChild(g);
  }

  /* ---------- страница объявления ---------- */
  function renderAd(app, id) {
    var ad = getAd(id);
    if (!ad) {
      app.appendChild(el('div', 'empty',
        '<div class="big">😕</div><p>Объявление не найдено или было удалено.</p><p><a href="#/">← ко всем объявлениям</a></p>'));
      return;
    }
    var cat = catById(ad.cat);
    var wrap = el('div', 'ad-page');
    var left = el('div');
    left.innerHTML =
      '<div class="ad-photo"><img alt=""></div>' +
      '<div class="ad-desc"><h3>Описание</h3><p>' + esc(ad.desc) + '</p></div>';
    var img = left.querySelector('img');
    img.src = photoUrl(ad);
    img.onerror = function () { this.onerror = null; this.src = svgPhoto(ad); };
    var sn = sellerName(ad.id);
    var right = el('div', 'ad-side');
    right.innerHTML =
      '<span class="badge">' + esc(cat ? cat.name : 'Разное') + '</span>' +
      '<h1>' + esc(ad.title) + '</h1>' +
      '<div class="ad-price">' + fmtPrice(ad) + '</div>' +
      '<button class="btn btn-primary phone-btn" type="button">Показать номер</button>' +
      '<div class="phone-reveal">' + esc(ad.phone) + '</div>' +
      '<div class="ad-meta"><span>' + esc(ad.city) + '</span><span>' + fmtDate(ad.ts) + '</span><span>' + ad.views + ' просмотров</span></div>' +
      '<div class="seller"><div class="avatar">' + esc(sn.charAt(0)) + '</div><div>' +
      '<div class="name">' + esc(sn) + '</div>' +
      '<div class="sub">На Авито с 2019 года · 12 объявлений</div>' +
      '<div class="sub"><span class="stars">★ 4.8</span> · 12 отзывов</div>' +
      '</div></div>';
    right.querySelector('.phone-btn').onclick = function () {
      right.querySelector('.phone-reveal').style.display = 'block';
      this.textContent = 'Номер показан';
      this.disabled = true;
    };
    wrap.appendChild(left);
    wrap.appendChild(right);
    app.appendChild(wrap);

    var similar = allAds().filter(function (x) { return x.cat === ad.cat && String(x.id) !== String(ad.id); }).slice(0, 6);
    if (similar.length) {
      app.appendChild(el('h2', 'section-title', 'Похожие объявления'));
      var g = el('div', 'grid');
      similar.forEach(function (s) { g.appendChild(adCard(s)); });
      app.appendChild(g);
    }
  }

  /* ---------- форма «Разместить объявление» ---------- */
  function renderNew(app) {
    var f = el('div', 'form-card');
    f.innerHTML =
      '<h1>Разместить объявление</h1>' +
      '<p class="sub">Заполните форму — объявление сразу появится в ленте.</p>' +
      '<form id="newAdForm">' +
      '<div class="field"><label>Заголовок *</label><input name="title" maxlength="70" required placeholder="Например: iPhone 14 Pro, 256 GB"></div>' +
      '<div class="row2">' +
      '<div class="field"><label>Категория *</label><select name="cat">' +
      CATEGORIES.map(function (c) { return '<option value="' + c.slug + '">' + c.name + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="field"><label>Цена, ₽ *</label><input name="price" type="number" min="0" required placeholder="25000"></div></div>' +
      '<div class="row2">' +
      '<div class="field"><label>Город *</label><input name="city" required value="Москва"></div>' +
      '<div class="field"><label>Телефон *</label><input name="phone" required placeholder="+7 900 000-00-00"></div></div>' +
      '<div class="field"><label>Описание</label><textarea name="desc" placeholder="Состояние, комплектация, причина продажи…"></textarea></div>' +
      '<button class="btn btn-primary" type="submit" style="width:100%;height:52px;font-size:16px">Опубликовать</button></form>';
    app.appendChild(f);
    $('#newAdForm').onsubmit = function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      var ad = {
        id: 'u' + Date.now(),
        cat: fd.get('cat'),
        title: String(fd.get('title')).trim(),
        price: Number(fd.get('price')) || 0,
        unit: '',
        city: String(fd.get('city')).trim(),
        phone: String(fd.get('phone')).trim(),
        desc: String(fd.get('desc')).trim() || 'Без описания.',
        ts: Date.now(),
        views: 0,
        local: true
      };
      var local = loadLocal();
      local.push(ad);
      saveLocal(local);
      toast('Объявление опубликовано ✓');
      location.hash = '#/ad/' + ad.id;
      route();
    };
  }

  /* ---------- вход ---------- */
  function renderLogin(app) {
    var f = el('div', 'form-card');
    f.innerHTML =
      '<h1>Вход и регистрация</h1>' +
      '<p class="sub">В демо-версии вход не требуется — личный кабинет появится позже.</p>' +
      '<a class="btn btn-blue" href="#/" style="display:block;text-align:center">На главную</a>';
    app.appendChild(f);
  }

  /* ---------- роутер ---------- */
  function route() {
    var hash = location.hash || '#/';
    var path = hash.replace(/^#\//, '');
    var parts = path.split('/');
    var page = parts[0] || '';
    var app = $('#app');
    app.innerHTML = '';
    if (page === '') renderFeed(app, null);
    else if (page === 'cat') renderFeed(app, catById(parts[1]) || null);
    else if (page === 'ad') renderAd(app, parts[1]);
    else if (page === 'new') renderNew(app);
    else if (page === 'login') renderLogin(app);
    else renderFeed(app, null);
    window.scrollTo(0, 0);
  }

  document.addEventListener('DOMContentLoaded', function () {
    window.addEventListener('hashchange', route);
    route();
  });
})();
