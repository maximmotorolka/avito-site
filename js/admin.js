(function () {
  'use strict';

  // SHA-256 от пароля администратора. Текущий пароль: site-admin-2026
  var PASS_HASH = 'daa01393303494259e015e9c3571c3fcf2a704400333fd2a38c1fd778e2967e2';
  var LS_ADS = 'site_ads_local';
  var LS_HIDDEN = 'site_ads_hidden';

  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function loadLocal() { try { return JSON.parse(localStorage.getItem(LS_ADS)) || []; } catch (e) { return []; } }
  function loadHidden() { try { return JSON.parse(localStorage.getItem(LS_HIDDEN)) || []; } catch (e) { return []; } }
  function saveLocal(a) { localStorage.setItem(LS_ADS, JSON.stringify(a)); }
  function saveHidden(h) { localStorage.setItem(LS_HIDDEN, JSON.stringify(h)); }
  function catName(slug) {
    for (var i = 0; i < CATEGORIES.length; i++) if (CATEGORIES[i].slug === slug) return CATEGORIES[i].name;
    return slug || '—';
  }
  function fmtPrice(ad) {
    var pre = ad.unit === 'от ' ? 'от ' : '';
    var suf = ad.unit === '/мес' || ad.unit === '/м²' || ad.unit === '/час' ? ad.unit : '';
    return pre + Number(ad.price).toLocaleString('ru-RU') + ' ₽' + suf;
  }
  function photoOf(id) { return 'https://picsum.photos/seed/sitenet' + id + '/160/120'; }
  function sha256hex(str) {
    var data = new TextEncoder().encode(str);
    return crypto.subtle.digest('SHA-256', data).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    });
  }
  function allAds() { return SEED_ADS.concat(loadLocal()); }

  function render() {
    var hidden = loadHidden();
    var ads = allAds();
    var local = loadLocal();

    $('#stats').innerHTML =
      '<div class="stat"><b>' + ads.length + '</b><span>всего объявлений</span></div>' +
      '<div class="stat"><b>' + local.length + '</b><span>добавлено локально</span></div>' +
      '<div class="stat"><b>' + hidden.length + '</b><span>скрыто</span></div>' +
      '<div class="stat"><b>' + CATEGORIES.length + '</b><span>категорий</span></div>';

    var body = $('#adsBody');
    body.innerHTML = '';
    ads.forEach(function (ad) {
      var tr = document.createElement('tr');
      var isHidden = hidden.indexOf(ad.id) !== -1;
      tr.innerHTML =
        '<td><img class="thumb" alt="" loading="lazy"></td>' +
        '<td><a href="index.html#/ad/' + esc(ad.id) + '" target="_blank">' + esc(ad.title) + '</a>' +
        (isHidden ? ' <span style="color:#c0392b">(скрыто)</span>' : '') + '</td>' +
        '<td>' + esc(catName(ad.cat)) + '</td>' +
        '<td>' + fmtPrice(ad) + '</td>' +
        '<td>' + esc(ad.city) + '</td>' +
        '<td><span class="src ' + (ad.local ? 'src-local' : 'src-seed') + '">' + (ad.local ? 'локальное' : 'сайт') + '</span></td>' +
        '<td class="act"><button type="button" data-act="' + (isHidden ? 'show' : 'hide') + '" data-id="' + esc(ad.id) + '">' +
        (isHidden ? 'Вернуть' : 'Скрыть') + '</button></td>';
      var img = tr.querySelector('img');
      img.src = photoOf(ad.id);
      img.onerror = function () { this.onerror = null; this.style.background = '#e5e7eb'; };
      body.appendChild(tr);
    });

    var hb = $('#hiddenBlock');
    if (hidden.length) {
      hb.style.display = 'block';
      var hl = $('#hiddenList');
      hl.innerHTML = '';
      hidden.forEach(function (id) {
        var ad = null;
        for (var i = 0; i < ads.length; i++) if (String(ads[i].id) === String(id)) { ad = ads[i]; break; }
        var div = document.createElement('div');
        div.className = 'h-item';
        div.innerHTML = esc(ad ? ad.title : ('объявление #' + id));
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = 'Вернуть';
        b.onclick = function () {
          var h = loadHidden().filter(function (x) { return String(x) !== String(id); });
          saveHidden(h);
          render();
        };
        div.appendChild(b);
        hl.appendChild(div);
      });
    } else {
      hb.style.display = 'none';
    }

    body.querySelectorAll('button[data-act]').forEach(function (b) {
      b.onclick = function () {
        var id = b.getAttribute('data-id');
        var act = b.getAttribute('data-act');
        var h = loadHidden();
        if (act === 'hide') { if (h.indexOf(id) === -1) h.push(id); }
        else { h = h.filter(function (x) { return String(x) !== String(id); }); }
        saveHidden(h);
        render();
      };
    });
  }

  function showPanel() {
    $('#loginBox').style.display = 'none';
    $('#panelBox').style.display = 'block';
    $('#adminActions').style.display = 'flex';
    render();
  }

  $('#loginForm').onsubmit = function (e) {
    e.preventDefault();
    var val = $('#passInput').value;
    sha256hex(val).then(function (h) {
      if (h === PASS_HASH) {
        sessionStorage.setItem('site_admin_ok', '1');
        $('#loginErr').style.display = 'none';
        $('#passInput').value = '';
        showPanel();
      } else {
        $('#loginErr').style.display = 'block';
        $('#passInput').select();
      }
    });
  };

  $('#logoutBtn').onclick = function () {
    sessionStorage.removeItem('site_admin_ok');
    location.reload();
  };

  $('#exportBtn').onclick = function () {
    var data = { exported: new Date().toISOString(), ads: allAds(), hidden: loadHidden() };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'site-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  };

  $('#importFile').onchange = function (e) {
    var f = e.target.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        var data = JSON.parse(r.result);
        var incoming = Array.isArray(data) ? data : (data.ads || []);
        var local = loadLocal();
        var have = {};
        local.forEach(function (a) { have[String(a.id)] = 1; });
        var added = 0;
        incoming.forEach(function (a) {
          if (a && a.id != null && a.title && !have[String(a.id)]) { local.push(a); have[String(a.id)] = 1; added++; }
        });
        saveLocal(local);
        render();
        alert('Импортировано объявлений: ' + added);
      } catch (err) {
        alert('Не удалось прочитать файл: ' + err.message);
      }
    };
    r.readAsText(f);
    e.target.value = '';
  };

  $('#resetBtn').onclick = function () {
    if (confirm('Удалить все локальные объявления и сбросить список скрытых?')) {
      localStorage.removeItem(LS_ADS);
      localStorage.removeItem(LS_HIDDEN);
      render();
    }
  };

  if (sessionStorage.getItem('site_admin_ok') === '1') showPanel();
})();
