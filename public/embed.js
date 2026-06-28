/* ebooks.co.mz Partner Widget v1 — https://ebooks.co.mz */
(function (w, d) {
  'use strict';

  var API = (w.__EBOOKS_API__ || 'https://api.ebooks.co.mz');
  var STORE = (w.__EBOOKS_STORE__ || 'https://ebooks.co.mz');
  var STYLE_ID = 'ebooks-widget-css';

  var CSS = [
    '.ebooks-widget*{box-sizing:border-box;margin:0;padding:0}',
    '.ebooks-widget{font-family:system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.5}',
    '.ebooks-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:16px;padding:8px 0}',
    '.ebooks-list{display:flex;flex-direction:column;gap:12px;padding:8px 0}',
    '.ebooks-card{border-radius:8px;overflow:hidden;cursor:pointer;transition:transform .15s,box-shadow .15s;background:#fff;border:1px solid #e5e7eb}',
    '.ebooks-card:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,.12)}',
    '.ebooks-cover-wrap{aspect-ratio:2/3;overflow:hidden;background:#f3f4f6}',
    '.ebooks-cover{width:100%;height:100%;object-fit:cover;display:block}',
    '.ebooks-cover-placeholder{width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:32px}',
    '.ebooks-info{padding:10px}',
    '.ebooks-title{font-weight:600;font-size:13px;color:#111827;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
    '.ebooks-author{font-size:12px;color:#6b7280;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.ebooks-price{font-weight:700;font-size:14px;color:#059669;margin-top:6px}',
    '.ebooks-btn{display:block;width:100%;margin-top:8px;padding:6px 0;border:none;border-radius:6px;background:#2563eb;color:#fff;font-size:12px;font-weight:600;cursor:pointer;text-align:center;text-decoration:none;transition:background .15s}',
    '.ebooks-btn:hover{background:#1d4ed8}',
    '.ebooks-list .ebooks-card{display:flex;gap:12px;align-items:flex-start}',
    '.ebooks-list .ebooks-cover-wrap{width:72px;flex-shrink:0;aspect-ratio:2/3}',
    '.ebooks-list .ebooks-info{flex:1}',
    '.ebooks-list .ebooks-btn{width:auto;padding:5px 12px;display:inline-block}',
    '.ebooks-footer{text-align:center;margin-top:12px;font-size:11px;color:#9ca3af}',
    '.ebooks-footer a{color:#6b7280;text-decoration:none}',
    '.ebooks-footer a:hover{text-decoration:underline}',
    '.ebooks-loading,.ebooks-empty,.ebooks-error{padding:24px;text-align:center;color:#9ca3af;font-size:13px}',
    '.ebooks-error{color:#ef4444}',
    '.ebooks-theme-dark .ebooks-card{background:#1f2937;border-color:#374151;color:#f9fafb}',
    '.ebooks-theme-dark .ebooks-title{color:#f9fafb}',
    '.ebooks-theme-dark .ebooks-author{color:#9ca3af}',
    '.ebooks-theme-dark .ebooks-loading,.ebooks-theme-dark .ebooks-empty{color:#6b7280}',
    '.ebooks-theme-dark .ebooks-footer a{color:#6b7280}',
  ].join('');

  function injectStyles() {
    if (d.getElementById(STYLE_ID)) return;
    var s = d.createElement('style');
    s.id = STYLE_ID;
    s.textContent = CSS;
    (d.head || d.documentElement).appendChild(s);
  }

  function esc(str) {
    return (str || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmt(price, currency) {
    if (!price && price !== 0) return '';
    return parseFloat(price).toFixed(2) + ' ' + (currency || 'MZN');
  }

  function renderCard(book, layout) {
    var url = STORE + '/store/books/' + esc(book.slug || book.id);
    var coverHtml = book.coverUrl
      ? '<img class="ebooks-cover" src="' + esc(book.coverUrl) + '" alt="' + esc(book.title) + '" loading="lazy">'
      : '<div class="ebooks-cover-placeholder">📚</div>';
    var authors = (book.authorNames || []).join(', ');
    var price = fmt(book.price, book.currency);

    return [
      '<div class="ebooks-card" role="article" onclick="window.open(\'' + url + '\',\'_blank\',\'noopener\')">',
      '<div class="ebooks-cover-wrap">' + coverHtml + '</div>',
      '<div class="ebooks-info">',
      '<div class="ebooks-title">' + esc(book.title) + '</div>',
      authors ? '<div class="ebooks-author">' + esc(authors) + '</div>' : '',
      price ? '<div class="ebooks-price">' + esc(price) + '</div>' : '',
      '<a class="ebooks-btn" href="' + url + '" target="_blank" rel="noopener" onclick="event.stopPropagation()">',
      layout === 'list' ? 'Ver livro' : 'Comprar',
      '</a>',
      '</div>',
      '</div>',
    ].join('');
  }

  function loadWidget(container) {
    if (container.__ebooksLoaded) return;
    container.__ebooksLoaded = true;

    var publicKey = container.getAttribute('data-ebooks-partner');
    var theme = container.getAttribute('data-theme') || 'light';
    var limit = parseInt(container.getAttribute('data-limit') || '12', 10);
    var category = container.getAttribute('data-category') || '';
    var layout = container.getAttribute('data-layout') || 'grid'; // grid | list

    container.className = [container.className, 'ebooks-widget', 'ebooks-theme-' + theme]
      .join(' ')
      .trim();
    container.setAttribute('role', 'region');
    container.setAttribute('aria-label', 'Livros disponíveis');
    container.innerHTML = '<div class="ebooks-loading">A carregar livros…</div>';

    var url = API + '/partner/widget/v1/' + encodeURIComponent(publicKey) + '/books?limit=' + limit;
    if (category) url += '&category=' + encodeURIComponent(category);

    fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        var books = data.books || [];
        if (books.length === 0) {
          container.innerHTML = '<div class="ebooks-empty">Nenhum livro disponível.</div>';
          return;
        }
        var gridClass = layout === 'list' ? 'ebooks-list' : 'ebooks-grid';
        var html = '<div class="' + gridClass + '">';
        books.forEach(function (book) { html += renderCard(book, layout); });
        html += '</div>';
        html += '<div class="ebooks-footer"><a href="' + STORE + '" target="_blank" rel="noopener">Powered by ebooks.co.mz</a></div>';
        container.innerHTML = html;
      })
      .catch(function () {
        container.innerHTML = '<div class="ebooks-error">Não foi possível carregar os livros. Tente mais tarde.</div>';
      });
  }

  function init() {
    injectStyles();
    d.querySelectorAll('[data-ebooks-partner]').forEach(loadWidget);

    if (w.MutationObserver) {
      new w.MutationObserver(function (mutations) {
        mutations.forEach(function (m) {
          m.addedNodes.forEach(function (node) {
            if (node.nodeType !== 1) return;
            if (node.hasAttribute('data-ebooks-partner')) loadWidget(node);
            var children = node.querySelectorAll('[data-ebooks-partner]');
            if (children) children.forEach(loadWidget);
          });
        });
      }).observe(d.body || d.documentElement, { childList: true, subtree: true });
    }
  }

  if (d.readyState === 'loading') {
    d.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window, document);
