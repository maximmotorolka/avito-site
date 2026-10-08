(function () {
  'use strict';

  var LS_ADS = 'site_ads_local';
  var LS_HIDDEN = 'site_ads_hidden';
  var LS_USER = 'site_user';
  var LS_AUTH = 'site_authed';
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

  /* ---------- аккаунт: регистрация / вход ---------- */
  function getUser() { try { return JSON.parse(localStorage.getItem(LS_USER)); } catch (e) { return null; } }
  function saveUser(u) { localStorage.setItem(LS_USER, JSON.stringify(u)); }
  function isAuthed() { return !!getUser() && localStorage.getItem(LS_AUTH) === '1'; }
  function avatarHtml(user, cls) {
    if (user && user.avatar) return '<img class="' + cls + '" src="' + user.avatar + '" alt="">';
    var initial = user && user.name ? user.name.charAt(0).toUpperCase() : '?';
    return '<span class="' + cls + ' av-init">' + esc(initial) + '</span>';
  }
  function readFileAsScaledImage(file, cb) {
    var img = new Image();
    var fr = new FileReader();
    fr.onload = function () { img.src = fr.result; };
    img.onload = function () {
      var max = 256, w = img.width, h = img.height;
      if (w > h && w > max) { h = Math.round(h * max / w); w = max; }
      else if (h >= w && h > max) { w = Math.round(w * max / h); h = max; }
      var c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      try { cb(c.toDataURL('image/jpeg', 0.85)); } catch (e) { cb(null); }
    };
    img.onerror = function () { cb(null); };
    fr.readAsDataURL(file);
  }

  var CHEV = '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  var LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5.5" y="10.5" width="13" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/></svg>';
  var CAM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:34px;height:34px;color:var(--text-disabled)"><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2L9 5h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="13" r="3.4"/></svg>';

  function renderUserWidget() {
    var w = document.getElementById('userWidget');
    if (!w) return;
    var u = getUser();
    if (isAuthed() && u) {
      w.className = 'h-link user-widget';
      w.innerHTML = avatarHtml(u, 'avatar-circle') +
        '<span class="txt user-name">' + esc(u.name) + '</span>' + CHEV +
        '<div class="user-menu" id="userMenu">' +
        '<a href="#/reset" class="menu-item">Сменить аккаунт</a>' +
        '<a href="#/logout" class="menu-item">Выйти</a>' +
        '</div>';
    } else {
      w.className = 'h-link';
      w.innerHTML = LOCK + '<span class="txt">Вход и регистрация</span>';
    }
  }

  function handleUserWidgetClick(e) {
    var w = document.getElementById('userWidget');
    if (!w) return;
    var menu = document.getElementById('userMenu');
    if (menu) {
      if (!menu.contains(e.target)) {
        e.preventDefault();
        menu.classList.toggle('open');
      }
    } else {
      e.preventDefault();
      location.hash = '#/login';
      route();
    }
  }

  function renderRegister(app) {
    var f = el('div', 'form-card auth-card');
    f.innerHTML =
      '<h1>Регистрация</h1>' +
      '<p class="sub">Создайте аккаунт: имя, почта и фото для аватара.</p>' +
      '<div class="avatar-pick" id="avatarPick" title="Нажмите, чтобы выбрать фото">' +
        '<div class="avatar-circle" id="avatarCircle">' + CAM + '</div>' +
        '<div class="avatar-hint">Фото для аватара</div>' +
        '<input type="file" id="avatarFile" accept="image/*" hidden>' +
      '</div>' +
      '<form id="regForm">' +
        '<div class="field"><label>Имя *</label><input name="name" maxlength="40" required placeholder="Как вас зовут?"></div>' +
        '<div class="field"><label>Электронная почта *</label><input name="email" type="email" required placeholder="name@example.com"></div>' +
        '<button class="btn btn-primary" type="submit" style="width:100%;height:52px;font-size:16px">Зарегистрироваться</button>' +
      '</form>' +
      '<p class="auth-note">Аккаунт хранится только в этом браузере (демо).</p>';
    app.appendChild(f);
    var avatarData = null;
    var circle = document.getElementById('avatarCircle');
    function setAvatar(data) {
      if (!data) { toast('Не удалось загрузить фото'); return; }
      avatarData = data;
      circle.innerHTML = '<img src="' + data + '" alt="">';
      document.getElementById('avatarPick').classList.add('has-photo');
    }
    document.getElementById('avatarPick').addEventListener('click', function () {
      document.getElementById('avatarFile').click();
    });
    document.getElementById('avatarFile').addEventListener('click', function (e) { e.stopPropagation(); });
    document.getElementById('avatarFile').addEventListener('change', function () {
      var file = this.files && this.files[0];
      if (!file) return;
      if (file.size > 8 * 1024 * 1024) { toast('Фото слишком большое — до 8 МБ'); this.value = ''; return; }
      readFileAsScaledImage(file, setAvatar);
      this.value = '';
    });
    document.getElementById('regForm').onsubmit = function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      var name = String(fd.get('name')).trim();
      var email = String(fd.get('email')).trim();
      if (!name) { toast('Введите имя'); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('Введите корректную почту'); return; }
      saveUser({ name: name, email: email, avatar: avatarData, ts: Date.now() });
      renderUserWidget();
      toast('Аккаунт создан — войдите');
      location.hash = '#/login';
      route();
    };
  }

  function renderLogin(app) {
    var u = getUser();
    var f = el('div', 'form-card auth-card');
    if (u) {
      f.innerHTML =
        '<div class="auth-avatar-big">' + avatarHtml(u, 'avatar-circle') + '</div>' +
        '<h1>Вход</h1>' +
        '<p class="sub">Здравствуйте, <b>' + esc(u.name) + '</b>!<br>Войдите, чтобы открыть Авито.</p>' +
        '<button class="btn btn-primary" id="loginBtn" type="button" style="width:100%;height:52px;font-size:16px">Войти</button>' +
        '<p class="auth-note"><a href="#/reset">Сменить аккаунт</a></p>';
      app.appendChild(f);
      document.getElementById('loginBtn').onclick = function () {
        localStorage.setItem(LS_AUTH, '1');
        renderUserWidget();
        toast('Вы вошли');
        location.hash = '#/';
        route();
      };
    } else {
      f.innerHTML =
        '<h1>Вход</h1>' +
        '<p class="sub">У вас ещё нет аккаунта — сначала зарегистрируйтесь.</p>' +
        '<a class="btn btn-primary" href="#/register" style="display:block;text-align:center;height:52px;font-size:16px">Создать аккаунт</a>';
      app.appendChild(f);
    }
  }

  function renderReset(app) {
    var u = getUser();
    var f = el('div', 'form-card auth-card');
    f.innerHTML =
      '<h1>Сменить аккаунт</h1>' +
      '<p class="sub">Текущий аккаунт: ' + (u ? esc(u.name) + ' · ' + esc(u.email) : '—') +
      '.<br>Он будет удалён, и вы сможете зарегистрироваться заново.</p>' +
      '<button class="btn btn-primary" id="resetBtn2" type="button" style="width:100%;height:52px;font-size:16px">Удалить и зарегистрировать нового</button>' +
      '<p class="auth-note"><a href="#/">← Вернуться на сайт</a></p>';
    app.appendChild(f);
    document.getElementById('resetBtn2').onclick = function () {
      localStorage.removeItem(LS_USER);
      localStorage.removeItem(LS_AUTH);
      renderUserWidget();
      toast('Аккаунт удалён');
      location.hash = '#/register';
      route();
    };
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

  /* ---------- роутер ---------- */
  function route() {
    var app = $('#app');
    app.innerHTML = '';
    renderUserWidget();
    if (!isAuthed()) {
      if (getUser()) renderLogin(app);
      else renderRegister(app);
      window.scrollTo(0, 0);
      return;
    }
    var hash = location.hash || '#/';
    var path = hash.replace(/^#\//, '');
    var parts = path.split('/');
    var page = parts[0] || '';
    if (page === '') renderFeed(app, null);
    else if (page === 'cat') renderFeed(app, catById(parts[1]) || null);
    else if (page === 'ad') renderAd(app, parts[1]);
    else if (page === 'new') renderNew(app);
    else if (page === 'logout') {
      localStorage.removeItem(LS_AUTH);
      renderUserWidget();
      toast('Вы вышли');
      location.hash = '#/login';
      return;
    }
    else renderFeed(app, null);
    window.scrollTo(0, 0);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var w = document.getElementById('userWidget');
    if (w) {
      w.addEventListener('click', handleUserWidgetClick);
      w.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); handleUserWidgetClick(e); } });
    }
    document.addEventListener('click', function (e) {
      var m = document.getElementById('userMenu');
      if (m && m.classList.contains('open') && !m.parentElement.contains(e.target)) m.classList.remove('open');
    });
    document.addEventListener('click', function (e) {
      var m = document.getElementById('userMenu');
      if (!m || !m.contains(e.target)) return;
      var a = e.target.closest ? e.target.closest('a.menu-item') : null;
      if (!a) return;
      e.preventDefault();
      m.classList.remove('open');
      if (a.getAttribute('href') === '#/logout') {
        localStorage.removeItem(LS_AUTH);
        renderUserWidget();
        toast('Вы вышли');
        location.hash = '#/login';
        route();
      } else {
        location.hash = a.getAttribute('href');
        route();
      }
    });
    window.addEventListener('hashchange', route);
    route();
  });
})();
