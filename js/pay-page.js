// ── USDT TRC20 Payment Page JS ───────────────────────────────────────────────

(function () {
  'use strict';

  // ── Config ────────────────────────────────────────────────────────────────
  var USDT_ADDRESS = 'TYzeWdjec1EjrrXFoq7uoXQSCerech3s5L';
  var COUNTDOWN_SECONDS = 15 * 60; // 15 minutes

  // ── Read order info from URL params or localStorage ────────────────────────
  var params = new URLSearchParams(window.location.search);
  var orderAmount = params.get('amount') || '0.00';
  var orderId = params.get('order') || generateOrderId();

  // ── Generate Order ID ─────────────────────────────────────────────────────
  function generateOrderId() {
    var now = new Date();
    var y = now.getFullYear().toString().slice(-2);
    var m = String(now.getMonth() + 1).padStart(2, '0');
    var d = String(now.getDate()).padStart(2, '0');
    var h = String(now.getHours()).padStart(2, '0');
    var min = String(now.getMinutes()).padStart(2, '0');
    var rand = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    return 'ORD' + y + m + d + h + min + rand;
  }

  // ── Populate page data ─────────────────────────────────────────────────────
  var amountEl = document.getElementById('pay-amount');
  var orderIdEl = document.getElementById('pay-order-id');

  // Sanitize amount to numeric value only to prevent XSS
  var sanitizedAmount = parseFloat(orderAmount);
  if (isNaN(sanitizedAmount) || sanitizedAmount < 0) sanitizedAmount = 0;
  var displayAmount = sanitizedAmount.toFixed(2);

  if (amountEl) {
    amountEl.textContent = '';
    amountEl.appendChild(document.createTextNode(displayAmount));
    var currSpan = document.createElement('span');
    currSpan.className = 'currency';
    currSpan.textContent = ' USDT';
    amountEl.appendChild(currSpan);
  }
  // Sanitize orderId to alphanumeric characters only to prevent XSS
  var sanitizedOrderId = orderId.replace(/[^a-zA-Z0-9]/g, '');
  if (orderIdEl) orderIdEl.textContent = sanitizedOrderId;

  // ── Countdown Timer ───────────────────────────────────────────────────────
  var timerEl = document.getElementById('pay-countdown');
  var timerWrap = document.getElementById('pay-timer-wrap');
  var statusSection = document.getElementById('pay-status');
  var statusText = document.getElementById('pay-status-text');
  var remaining = COUNTDOWN_SECONDS;

  // Try to restore timer from sessionStorage
  var storageKey = 'pay_timer_' + sanitizedOrderId;
  try {
    var saved = sessionStorage.getItem(storageKey);
    if (saved) {
      var parsed = JSON.parse(saved);
      var elapsed = Math.floor((Date.now() - parsed.startedAt) / 1000);
      remaining = Math.max(0, COUNTDOWN_SECONDS - elapsed);
    } else {
      sessionStorage.setItem(storageKey, JSON.stringify({ startedAt: Date.now() }));
    }
  } catch (e) {}

  function formatTime(secs) {
    var m = Math.floor(secs / 60);
    var s = secs % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function updateTimer() {
    if (!timerEl) return;
    timerEl.textContent = formatTime(remaining);

    // Color transitions
    if (timerWrap) {
      timerWrap.classList.remove('warning', 'expired');
      if (remaining <= 0) {
        timerWrap.classList.add('expired');
      } else if (remaining <= 120) {
        timerWrap.classList.add('warning');
      }
    }

    if (remaining <= 0) {
      timerEl.textContent = '00:00';
      if (statusSection) {
        statusSection.classList.add('expired-status');
      }
      if (statusText) {
        statusText.textContent = '';
        var dot = document.createElement('span');
        dot.className = 'pay-status-dot';
        statusText.appendChild(dot);
        statusText.appendChild(document.createTextNode(' Payment time expired. Please place a new order.'));
      }
      return;
    }

    remaining--;
    setTimeout(updateTimer, 1000);
  }

  updateTimer();

  // ── QR Code Generation (lightweight inline implementation) ─────────────────
  // Uses a QR code API via <img> tag for reliability
  var qrContainer = document.getElementById('pay-qr-code');
  if (qrContainer) {
    var qrImg = document.createElement('img');
    qrImg.width = 200;
    qrImg.height = 200;
    qrImg.alt = 'USDT TRC20 Address QR Code';
    qrImg.style.display = 'block';
    // Use qrserver.com API for QR code generation
    qrImg.src = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(USDT_ADDRESS);
    // Fallback: if the image fails to load, show a text placeholder
    qrImg.onerror = function () {
      var fallback = document.createElement('div');
      fallback.style.cssText = 'width:200px;height:200px;display:flex;align-items:center;justify-content:center;background:#f5f5f5;border-radius:8px;font-size:12px;color:#999;text-align:center;padding:20px;';
      fallback.textContent = 'QR Code unavailable. Please copy the address below.';
      qrContainer.textContent = '';
      qrContainer.appendChild(fallback);
    };
    qrContainer.appendChild(qrImg);
  }

  // ── Copy to Clipboard ─────────────────────────────────────────────────────
  var copyBtn = document.getElementById('pay-copy-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      var textArea = document.createElement('textarea');
      textArea.value = USDT_ADDRESS;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        copyBtn.classList.add('copied');
        copyBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copied';
        showToast('Address copied to clipboard!');
        setTimeout(function () {
          copyBtn.classList.remove('copied');
          copyBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy';
        }, 2000);
      } catch (e) {
        showToast('Copy failed. Please select and copy manually.');
      }
      document.body.removeChild(textArea);
    });
  }

  // ── Copy Order ID ─────────────────────────────────────────────────────────
  var copyOrderBtn = document.getElementById('pay-copy-order');
  if (copyOrderBtn) {
    copyOrderBtn.addEventListener('click', function () {
      var textArea = document.createElement('textarea');
      textArea.value = sanitizedOrderId;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        showToast('Order ID copied!');
      } catch (e) {}
      document.body.removeChild(textArea);
    });
  }

  // ── Toast ─────────────────────────────────────────────────────────────────
  function showToast(msg) {
    var toast = document.createElement('div');
    toast.className = 'pay-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(function () { toast.classList.add('show'); }, 10);
    setTimeout(function () {
      toast.classList.remove('show');
      setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 400);
    }, 2500);
  }

})();
