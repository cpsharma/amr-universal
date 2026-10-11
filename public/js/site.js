// AMR Universal — the site's only script. No frameworks, no tracking.
// Handles: navigation toggle, the Wire signup, the enquiry form, the
// request-full-details dialog, and 45-second live-desk polling.

(function () {
  'use strict';

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  var postJson = function (url, data) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(function (res) {
      return res.json().then(function (body) {
        if (!res.ok || body.ok === false) throw new Error(body.error || 'Request failed');
        return body;
      });
    });
  };

  var formData = function (form) {
    var out = {};
    new FormData(form).forEach(function (v, k) { out[k] = v; });
    return out;
  };

  var isStaticSite = document.body.hasAttribute('data-static-site');
  var contactEmail = document.body.getAttribute('data-email') || '';

  function sendMail(form, subject) {
    var fields = formData(form);
    var body = Object.keys(fields)
      .filter(function (key) { return key !== 'website' && fields[key]; })
      .map(function (key) { return key + ': ' + fields[key]; })
      .join('\n');
    window.location.href = 'mailto:' + contactEmail +
      '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  }

  // ---- Navigation (small screens) ----
  var toggle = document.querySelector('.nav-toggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var nav = toggle.closest('.nav');
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  // ---- The Wire ----
  document.querySelectorAll('[data-wire-form]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (isStaticSite) {
        sendMail(form, 'Subscribe to the AMR lot sheet');
        return;
      }
      postJson('/api/subscribe', formData(form))
        .then(function () {
          form.hidden = true;
          var confirm = form.parentElement.querySelector('[data-wire-confirm]');
          if (confirm) confirm.hidden = false;
        })
        .catch(function () { /* quiet failure; the desk is reachable by other means */ });
    });
  });

  // ---- Enquiry form ----
  var enquiryForm = document.querySelector('[data-enquiry-form]');
  if (enquiryForm) {
    enquiryForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (isStaticSite) {
        sendMail(enquiryForm, 'Website enquiry for the AMR desk');
        return;
      }
      var errEl = document.querySelector('[data-enquiry-error]');
      errEl.hidden = true;
      postJson('/api/enquiry', formData(enquiryForm))
        .then(function () {
          enquiryForm.hidden = true;
          document.querySelector('[data-enquiry-confirm]').hidden = false;
        })
        .catch(function (err) {
          errEl.textContent = err.message;
          errEl.hidden = false;
        });
    });
  }

  // ---- Request full details ----
  var dialog = document.querySelector('[data-reveal-dialog]');

  function openReveal(lotNo, title) {
    if (!dialog) return;
    dialog.querySelector('[data-reveal-step="form"]').hidden = false;
    dialog.querySelector('[data-reveal-step="detail"]').hidden = true;
    dialog.querySelector('[data-reveal-lotno]').textContent = lotNo;
    dialog.querySelector('[data-reveal-title]').textContent = title;
    dialog.querySelector('[data-reveal-form] [name=lot_no]').value = lotNo;
    var errEl = dialog.querySelector('[data-reveal-error]');
    errEl.hidden = true;
    dialog.showModal();
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-reveal]');
    if (!btn) return;
    if (isStaticSite) {
      var staticCard = btn.closest('.lot-card');
      var staticTitle = staticCard ? staticCard.querySelector('.lot-title').textContent : '';
      var staticMessage = 'Regarding lot ' + btn.getAttribute('data-reveal') +
        (staticTitle ? ' — ' + staticTitle : '');
      window.open('https://wa.me/' + WHATSAPP + '?text=' +
        encodeURIComponent(staticMessage), '_blank', 'noopener');
      return;
    }
    var card = btn.closest('.lot-card');
    openReveal(btn.getAttribute('data-reveal'), card ? card.querySelector('.lot-title').textContent : '');
  });

  if (dialog) {
    dialog.querySelector('[data-reveal-form]').addEventListener('submit', function (e) {
      e.preventDefault();
      var form = e.target;
      var errEl = dialog.querySelector('[data-reveal-error]');
      errEl.hidden = true;
      postJson('/api/reveal', formData(form))
        .then(function (body) {
          var lot = body.lot;
          dialog.querySelector('[data-reveal-step="form"]').hidden = true;
          dialog.querySelector('[data-reveal-step="detail"]').hidden = false;
          dialog.querySelector('[data-detail-lotno]').textContent = lot.lot_no;
          dialog.querySelector('[data-detail-title]').textContent = lot.title;
          var facts = dialog.querySelector('[data-detail-facts]');
          facts.innerHTML = [
            lot.origin && '<div><dt>Origin</dt><dd>' + esc(lot.origin) + '</dd></div>',
            lot.quantity && '<div><dt>Quantity</dt><dd>' + esc(lot.quantity) + '</dd></div>',
            lot.spec && '<div><dt>Specification</dt><dd>' + esc(lot.spec) + '</dd></div>',
            '<div><dt>Price</dt><dd>' + esc(lot.price) + '</dd></div>',
            lot.notes && '<div><dt>Notes</dt><dd>' + esc(lot.notes) + '</dd></div>',
          ].filter(Boolean).join('');
          var photo = dialog.querySelector('[data-detail-photo]');
          if (lot.photo) { photo.src = lot.photo; photo.hidden = false; } else { photo.hidden = true; }
          dialog.querySelector('[data-detail-cta]').textContent =
            'The desk has been notified of your interest in ' + lot.lot_no + ' and will be in touch shortly.';
        })
        .catch(function (err) {
          errEl.textContent = err.message;
          errEl.hidden = false;
        });
    });
  }

  // ---- Live desk polling (45s) ----
  var WHATSAPP = document.body.getAttribute('data-whatsapp') || '';

  function cardHtml(lot) {
    var cat = lot.category === 'metals' ? 'Metals' : 'Paper & Board';
    var wa = 'https://wa.me/' + WHATSAPP + '?text=' +
      encodeURIComponent('Regarding lot ' + lot.lot_no + ' — ' + lot.title);
    return (
      '<article class="lot-card" id="' + esc(lot.lot_no) + '" data-lot="' + esc(lot.lot_no) + '">' +
      (lot.placed ? '<span class="ribbon">Placed</span>' : '') +
      '<p class="lot-meta smallcaps">' + cat + ' · ' + esc(lot.lot_no) + '</p>' +
      '<h3 class="lot-title">' + esc(lot.title) + '</h3>' +
      '<dl class="lot-facts">' +
      (lot.origin ? '<div><dt>Origin</dt><dd>' + esc(lot.origin) + '</dd></div>' : '') +
      (lot.quantity ? '<div><dt>Quantity</dt><dd>' + esc(lot.quantity) + '</dd></div>' : '') +
      '<div><dt>Price</dt><dd>On application</dd></div>' +
      '</dl>' +
      '<div class="lot-actions">' +
      '<button class="btn-quiet" data-reveal="' + esc(lot.lot_no) + '">Request full details</button>' +
      '<a class="lot-wa" href="' + wa + '" target="_blank" rel="noopener">Enquire on WhatsApp</a>' +
      '</div></article>'
    );
  }

  function refreshBoard(name, url, emptyText) {
    var board = document.querySelector('[data-board="' + name + '"]');
    if (!board) return;
    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (body) {
        if (!body.ok) return;
        board.innerHTML = body.lots.length
          ? body.lots.map(cardHtml).join('')
          : '<p class="empty-note">' + emptyText + '</p>';
        var stamp = document.querySelector('[data-desk-updated]');
        if (stamp) stamp.textContent = 'Updated ' + new Date().toISOString().slice(0, 10);
      })
      .catch(function () { /* transient — the next poll will succeed */ });
  }

  if (!isStaticSite && document.querySelector('[data-board]')) {
    setInterval(function () {
      refreshBoard('offers', '/api/offers',
        'The desk currently has no open lots. Enquiries for specific material are welcome.');
      refreshBoard('wanted', '/api/wanted',
        'Nothing is sought at present beyond the standing interest in redundant paper and board stock.');
    }, 45000);
  }
})();
