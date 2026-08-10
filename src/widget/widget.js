(function () {
  'use strict';

  var WIDGET_ID = '__pesto_widget__';

  // If widget already exists, toggle it
  var existing = document.getElementById(WIDGET_ID);
  if (existing) {
    if (existing.dataset.visible === 'true') {
      hide(existing);
    } else {
      // Refresh iframe to pick up fresh extension context after potential reload
      var iframe = existing.shadowRoot.querySelector('iframe');
      if (iframe) iframe.src = chrome.runtime.getURL('popup/popup.html');
      show(existing);
    }
    return;
  }

  // -----------------------------------------------------------------------
  // Create the widget
  // -----------------------------------------------------------------------

  var widget = document.createElement('pesto-widget');
  widget.id = WIDGET_ID;
  widget.dataset.visible = 'false';
  widget.style.cssText =
    'overflow:visible;position:relative;width:0;height:0;display:block;pointer-events:auto;';

  var shadow = widget.attachShadow({ mode: 'open' });

  // Styles
  var style = document.createElement('style');
  style.textContent = [
    '*, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }',

    '.pesto-backdrop {',
    '  position: fixed;',
    '  inset: 0;',
    '  z-index: 2147483646;',
    '  display: none;',
    '}',

    '.pesto-container {',
    '  position: fixed;',
    '  top: 16px;',
    '  right: 16px;',
    '  z-index: 2147483647;',
    '  width: 420px;',
    '  border-radius: 16px;',
    '  overflow: hidden;',
    '  background: #fff;',
    '  box-shadow: 0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1);',
    '  opacity: 0;',
    '  transform: translateY(-8px) scale(0.98);',
    '  transition: opacity 150ms cubic-bezier(0.215,0.61,0.355,1),',
    '              transform 150ms cubic-bezier(0.215,0.61,0.355,1);',
    '  display: none;',
    '  pointer-events: auto;',
    '}',

    '.pesto-container.visible {',
    '  opacity: 1;',
    '  transform: translateY(0) scale(1);',
    '}',

    '.pesto-container.hiding {',
    '  opacity: 0;',
    '  transform: translateY(-8px) scale(0.98);',
    '  transition: opacity 100ms cubic-bezier(0.215,0.61,0.355,1),',
    '              transform 100ms cubic-bezier(0.215,0.61,0.355,1);',
    '}',

    'iframe {',
    '  width: 100%;',
    '  height: 520px;',
    '  border: none;',
    '  display: block;',
    '  background: #fff;',
    '  color-scheme: light;',
    '}',

    '@media (prefers-reduced-motion: reduce) {',
    '  .pesto-container,',
    '  .pesto-container.hiding {',
    '    transition: none;',
    '  }',
    '}',

    '@media (max-width: 460px) {',
    '  .pesto-container {',
    '    width: calc(100vw - 24px);',
    '    right: 12px;',
    '  }',
    '}',
  ].join('\n');

  // Backdrop — click outside to close
  var backdrop = document.createElement('div');
  backdrop.className = 'pesto-backdrop';
  backdrop.addEventListener('click', function () { hide(widget); });

  // Container
  var container = document.createElement('div');
  container.className = 'pesto-container';

  // Iframe — loads the existing popup page (full chrome.* API access)
  var iframe = document.createElement('iframe');
  iframe.src = chrome.runtime.getURL('popup/popup.html');
  iframe.allow = 'clipboard-write';

  container.appendChild(iframe);
  shadow.appendChild(style);
  shadow.appendChild(backdrop);
  shadow.appendChild(container);

  document.documentElement.appendChild(widget);

  // -----------------------------------------------------------------------
  // Message handling from the popup iframe
  // -----------------------------------------------------------------------

  window.addEventListener('message', function (e) {
    if (!e.data || typeof e.data.type !== 'string') return;
    if (!e.data.type.startsWith('PESTO_WIDGET_')) return;

    if (e.data.type === 'PESTO_WIDGET_RESIZE') {
      var maxH = window.innerHeight - 48;
      iframe.style.height = Math.min(e.data.height, maxH) + 'px';
    }
    if (e.data.type === 'PESTO_WIDGET_CLOSE') {
      hide(widget);
    }
  });

  // Escape key to close
  function onKeydown(e) {
    if (e.key === 'Escape' && widget.dataset.visible === 'true') {
      hide(widget);
    }
  }
  document.addEventListener('keydown', onKeydown, true);

  // Show on first creation
  show(widget);

  // -----------------------------------------------------------------------
  // Show / Hide
  // -----------------------------------------------------------------------

  function show(w) {
    var s = w.shadowRoot;
    var c = s.querySelector('.pesto-container');
    var b = s.querySelector('.pesto-backdrop');

    c.style.display = 'block';
    b.style.display = 'block';
    w.dataset.visible = 'true';

    c.classList.remove('hiding');
    // Double rAF to ensure the initial state is painted before animating
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        c.classList.add('visible');
      });
    });
  }

  function hide(w) {
    var s = w.shadowRoot;
    var c = s.querySelector('.pesto-container');
    var b = s.querySelector('.pesto-backdrop');

    c.classList.remove('visible');
    c.classList.add('hiding');
    w.dataset.visible = 'false';

    var duration = 100;
    // Respect reduced motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      duration = 0;
    }

    setTimeout(function () {
      c.style.display = 'none';
      b.style.display = 'none';
      c.classList.remove('hiding');
    }, duration);
  }
})();
