(function () {
  'use strict';

  var WIDGET_ID = '__pesto_widget__';
  var MIN_WIDTH = 400;
  var MAX_WIDTH = 600;
  var MIN_HEIGHT = 300;

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
    '  min-width: 400px;',
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

    // Resize handles — positioned at the bottom corners, on top of the iframe
    '.pesto-resize-bl,',
    '.pesto-resize-br {',
    '  position: absolute;',
    '  bottom: 0;',
    '  width: 20px;',
    '  height: 20px;',
    '  z-index: 10;',
    '}',

    '.pesto-resize-bl { left: 0; cursor: sw-resize; }',
    '.pesto-resize-br { right: 0; cursor: se-resize; }',

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

  // Resize handles at bottom-left and bottom-right
  var resizeBL = document.createElement('div');
  resizeBL.className = 'pesto-resize-bl';

  var resizeBR = document.createElement('div');
  resizeBR.className = 'pesto-resize-br';

  container.appendChild(iframe);
  container.appendChild(resizeBL);
  container.appendChild(resizeBR);

  shadow.appendChild(style);
  shadow.appendChild(backdrop);
  shadow.appendChild(container);

  document.documentElement.appendChild(widget);

  // Once the user drags to resize height, stop auto-fitting from PESTO_WIDGET_RESIZE
  var userResizedHeight = false;

  // -----------------------------------------------------------------------
  // Resize logic
  // -----------------------------------------------------------------------

  function startResize(e, isLeft) {
    e.preventDefault();
    e.stopPropagation();

    var startX = e.clientX;
    var startY = e.clientY;
    var startWidth = container.offsetWidth;
    var startHeight = iframe.offsetHeight;
    var startLeft = container.getBoundingClientRect().left;

    container.style.transition = 'none';
    iframe.style.pointerEvents = 'none';
    userResizedHeight = true;

    // Left-handle resize needs left-based positioning to move the left edge
    if (isLeft) {
      container.style.right = 'auto';
      container.style.left = startLeft + 'px';
    }

    function onResizeMove(ev) {
      var dx = ev.clientX - startX;
      var dy = ev.clientY - startY;

      // Height — both handles resize vertically
      var newHeight = Math.max(MIN_HEIGHT, Math.min(startHeight + dy, window.innerHeight - 48));
      iframe.style.height = newHeight + 'px';

      // Width
      var newWidth;
      if (isLeft) {
        newWidth = Math.max(MIN_WIDTH, Math.min(startWidth - dx, MAX_WIDTH));
        container.style.width = newWidth + 'px';
        container.style.left = (startLeft + (startWidth - newWidth)) + 'px';
      } else {
        newWidth = Math.max(MIN_WIDTH, Math.min(startWidth + dx, MAX_WIDTH));
        container.style.width = newWidth + 'px';
      }
    }

    function onResizeUp() {
      document.removeEventListener('pointermove', onResizeMove);
      document.removeEventListener('pointerup', onResizeUp);
      iframe.style.pointerEvents = '';
      container.style.transition = '';
    }

    document.addEventListener('pointermove', onResizeMove);
    document.addEventListener('pointerup', onResizeUp);
  }

  resizeBL.addEventListener('pointerdown', function (e) { startResize(e, true); });
  resizeBR.addEventListener('pointerdown', function (e) { startResize(e, false); });

  // -----------------------------------------------------------------------
  // Message handling from the popup iframe
  // -----------------------------------------------------------------------

  window.addEventListener('message', function (e) {
    if (!e.data || typeof e.data.type !== 'string') return;
    if (!e.data.type.startsWith('PESTO_WIDGET_')) return;

    if (e.data.type === 'PESTO_WIDGET_RESIZE') {
      // Skip auto-resize once user has taken manual control of height
      if (userResizedHeight) return;
      var maxH = window.innerHeight - 48;
      iframe.style.height = Math.min(e.data.height, maxH) + 'px';
    }

    if (e.data.type === 'PESTO_WIDGET_CLOSE') {
      hide(widget);
    }

    if (e.data.type === 'PESTO_WIDGET_DRAG_START') {
      var rect = container.getBoundingClientRect();
      // mouseX/mouseY are iframe-local coords; iframe starts at container's top-left
      var grabOffsetX = e.data.mouseX;
      var grabOffsetY = e.data.mouseY;

      // Switch to explicit left/top so we can move the container freely
      container.style.right = 'auto';
      container.style.left = rect.left + 'px';
      container.style.top = rect.top + 'px';
      container.style.transition = 'none';

      // Disable iframe hit-testing so parent document receives pointermove
      iframe.style.pointerEvents = 'none';

      function onDragMove(ev) {
        var w = container.offsetWidth;
        var newLeft = ev.clientX - grabOffsetX;
        var newTop = ev.clientY - grabOffsetY;
        newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - w));
        newTop = Math.max(0, Math.min(newTop, window.innerHeight - 40));
        container.style.left = newLeft + 'px';
        container.style.top = newTop + 'px';
      }

      function onDragUp() {
        document.removeEventListener('pointermove', onDragMove);
        document.removeEventListener('pointerup', onDragUp);
        iframe.style.pointerEvents = '';
        container.style.transition = '';
      }

      document.addEventListener('pointermove', onDragMove);
      document.addEventListener('pointerup', onDragUp);
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
