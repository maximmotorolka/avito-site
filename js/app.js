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
  function photoUrl(ad) { return 'https://picsum.photos/seed/sitenet' + ad.id + '/640/480'; }
  function svgPhoto(ad) {
    var cat = catById(ad.cat) || { emoji: '📦' };
    var h1 = (ad.id * 47) % 360, h2 = (h1 + 40) % 360;
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="hsl(' + h1 + ',65%,88%)"/>' +
      '<stop offset="1" stop-color="hsl(' + h2 + ',65%,72%)"/>' +
      '</linearGradient></defs>' +
      '<rect width="640" height="480" fill="url(#g)"/>' +
      '<text x="320" y="270" font-size="120" text-anchor="middle">' + cat.emoji + '</text></svg>';
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

  function adCard(ad) {
    var a = el('a', 'card');
    a.href = '#/ad/' + ad.id;
    var cat = catById(ad.cat);
    a.innerHTML =
      '<div class="photo"><img loading="lazy" alt=""><span class="badge">' + esc(cat ? cat.name : '') + '</span></div>' +
      '<div class="card-body"><div class="card-title">' + esc(ad.title) + '</div>' +
      '<div class="price">' + fmtPrice(ad) + '</div>' +
      '<div class="meta"><span>' + esc(ad.city) + '</span><span>' + fmtDate(ad.ts) + '</span></div></div>';
    var img = a.querySelector('img');
    img.src = photoUrl(ad);
    img.onerror = function () { this.onerror = null; this.src = svgPhoto(ad); };
    return a;
  }

  function renderFeed(app, cat) {
    var ads = allAds();
    var q = filters.q.toLowerCase().trim();
    var list = ads.filter(function (a) {
      if (cat && a.cat !== cat.slug) return false;
      if (q && (a.title + ' ' + a.desc + ' ' + a.city).toLowerCase().indexOf(q) === -1) return false;
      if (filters.pmin !== '' && a.price < Number(filters.pmin)) return false;
      if (filters.pmax !== '' && a.price > Number(filters.pmax)) return false;
      return true;
    });
    if (filters.sort === 'cheap') list.sort(function (a, b) { return a.price - b.price; });
    else if (filters.sort === 'exp') list.sort(function (a, b) { return b.price - a.price; });
    else list.sort(function (a, b) { return b.ts - a.ts; });

    if (!cat && !q) {
      var hero = el('section', 'hero',
        '<h1>Что вы ищете сегодня?</h1>' +
        '<p>Более ' + ads.length + ' объявлений в Москве и по всей России</p>' +
        '<div class="chips"></div>');
      var chips = hero.querySelector('.chips');
      ['iPhone', 'Квартира', 'Toyota', 'Гитара', 'Диван', 'Котята'].forEach(function (c) {
        var b = el('a', 'chip', c);
        b.href = '#/';
        b.onclick = function (e) {
          e.preventDefault();
          filters.q = c;
          $('#searchInput').value = c;
          route();
        };
        chips.appendChild(b);
      });
      app.appendChild(hero);
      app.appendChild(el('h2', 'section-title', 'Категории'));
      var grid = el('div', 'cat-grid');
      CATEGORIES.forEach(function (c) {
        var count = ads.filter(function (a) { return a.cat === c.slug; }).length;
        var card = el('a', 'cat-card',
          '<div class="cat-emoji">' + c.emoji + '</div><div>' + c.name + '</div><small>' + count + ' объявл.</small>');
        card.href = '#/cat/' + c.slug;
        grid.appendChild(card);
      });
      app.appendChild(grid);
      app.appendChild(el('h2', 'section-title', 'Свежие объявления'));
    } else {
      app.appendChild(el('h1', 'section-title',
        (cat ? esc(cat.name) : 'Поиск: «' + esc(filters.q) + '»') + ' — ' + list.length));
    }

    var bar = el('div', 'feed-bar');
    bar.appendChild(el('div', 'count', list.length ? 'Найдено: ' + list.length : ''));
    var right = el('div', 'filters',
      '<input type="number" id="fMin" placeholder="Цена от" value="' + esc(filters.pmin) + '">' +
      '<input type="number" id="fMax" placeholder="Цена до" value="' + esc(filters.pmax) + '">' +
      '<select id="fSort">' +
      '<option value="new"' + (filters.sort === 'new' ? ' selected' : '') + '>Сначала новые</option>' +
      '<option value="cheap"' + (filters.sort === 'cheap' ? ' selected' : '') + '>Сначала дешевле</option>' +
      '<option value="exp"' + (filters.sort === 'exp' ? ' selected' : '') + '>Сначала дороже</option>' +
      '</select>');
    bar.appendChild(right);
    app.appendChild(bar);
    $('#fMin').onchange = function () { filters.pmin = this.value; route(); };
    $('#fMax').onchange = function () { filters.pmax = this.value; route(); };
    $('#fSort').onchange = function () { filters.sort = this.value; route(); };

    if (!list.length) {
      app.appendChild(el('div', 'empty',
        '<div class="big">🔍</div><p>Ничего не нашлось. Попробуйте изменить запрос или сбросить фильтры.</p>'));
      return;
    }
    var g = el('div', 'grid');
    list.forEach(function (ad) { g.appendChild(adCard(ad)); });
    app.appendChild(g);
  }

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
    var right = el('div', 'ad-side');
    right.innerHTML =
      '<span class="badge" style="position:static;display:inline-block;margin-bottom:10px">' + esc(cat ? cat.name : 'Разное') + '</span>' +
      '<h1>' + esc(ad.title) + '</h1>' +
      '<div class="ad-price">' + fmtPrice(ad) + '</div>' +
      '<button class="btn btn-primary phone-btn" type="button">Показать номер</button>' +
      '<div class="phone-reveal">' + esc(ad.phone) + '</div>' +
      '<div class="ad-meta"><span>📍 ' + esc(ad.city) + '</span><span>🕒 ' + fmtDate(ad.ts) + '</span><span>👁 ' + ad.views + ' просмотров</span></div>' +
      '<div class="seller"><div class="name">' + esc(sellerName(ad.id)) + '</div>' +
      '<div class="sub">На site с 2019 года · 12 объявлений</div>' +
      '<div class="sub"><span class="stars">★ 4.8</span> · 12 отзывов</div></div>';
    right.querySelector('.phone-btn').onclick = function () {
      right.querySelector('.phone-reveal').style.display = 'block';
      this.textContent = 'Номер показан';
      this.disabled = true;
    };
    wrap.appendChild(left);
    wrap.appendChild(right);
    app.appendChild(wrap);

    var similar = allAds().filter(function (x) { return x.cat === ad.cat && String(x.id) !== String(ad.id); }).slice(0, 3);
    if (similar.length) {
      app.appendChild(el('h2', 'section-title', 'Похожие объявления'));
      var g = el('div', 'grid');
      similar.forEach(function (s) { g.appendChild(adCard(s)); });
      app.appendChild(g);
    }
  }

  function renderNew(app) {
    var f = el('div', 'form-card');
    f.innerHTML =
      '<h1>Подать объявление</h1>' +
      '<p class="sub">Заполните форму — объявление сразу появится в ленте.</p>' +
      '<form id="newAdForm">' +
      '<div class="field"><label>Заголовок *</label><input name="title" maxlength="70" required placeholder="Например: iPhone 14 Pro, 256 GB"></div>' +
      '<div class="row2">' +
      '<div class="field"><label>Категория *</label><select name="cat">' +
      CATEGORIES.map(function (c) { return '<option value="' + c.slug + '">' + c.emoji + ' ' + c.name + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="field"><label>Цена, ₽ *</label><input name="price" type="number" min="0" required placeholder="25000"></div></div>' +
      '<div class="row2">' +
      '<div class="field"><label>Город *</label><input name="city" required value="Москва"></div>' +
      '<div class="field"><label>Телефон *</label><input name="phone" required placeholder="+7 900 000-00-00"></div></div>' +
      '<div class="field"><label>Описание</label><textarea name="desc" placeholder="Состояние, комплектация, причина продажи…"></textarea></div>' +
      '<button class="btn btn-primary" type="submit" style="width:100%;height:48px;font-size:16px">Опубликовать</button></form>';
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

  function renderLogin(app) {
    var f = el('div', 'form-card');
    f.innerHTML =
      '<h1>Вход</h1>' +
      '<p class="sub">В демо-версии вход не требуется — личный кабинет появится позже.</p>' +
      '<a class="btn btn-blue" href="#/" style="display:block;text-align:center">На главную</a>';
    app.appendChild(f);
  }

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

  $('#searchForm').onsubmit = function (e) {
    e.preventDefault();
    filters.q = $('#searchInput').value.trim();
    if (location.hash !== '#/' && location.hash !== '') location.hash = '#/';
    route();
  };

  window.addEventListener('hashchange', route);
  route();
})();
