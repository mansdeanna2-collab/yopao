(function () {
  'use strict';

  /* ── Helpers ─────────────────────────────────────────────────────────── */
  function fmt(n) { return '$' + n.toFixed(2); }

  function cartSubtotal() {
    return cart.reduce(function (s, i) { return s + i.price * i.qty; }, 0);
  }

  /* ── Render Order Summary from localStorage cart ─────────────────────── */
  function renderOrderSummary() {
    var tbody      = document.getElementById('order-items-body');
    var subtotalEl = document.getElementById('order-subtotal');
    var totalEl    = document.getElementById('order-total');

    if (!tbody) return;

    if (cart.length === 0) {
      tbody.innerHTML = '<tr><td colspan="2" style="padding:14px 0;color:#999;font-size:13px;">Your cart is empty</td></tr>';
      subtotalEl.textContent = '$0.00';
      totalEl.textContent    = '$0.00';
      return;
    }

    var html = '';
    cart.forEach(function (item) {
      var lineTotal = item.price * item.qty;
      var variation = item.variation || 'Quantity: 5 Sheets of 20 (100 Stamps)';
      html += '<tr>';
      html += '<td>' + escapeHtml(item.name) + ' &ndash; ' + escapeHtml(variation) +
              ' &times;&nbsp;' + item.qty + '</td>';
      html += '<td>' + fmt(lineTotal) + '</td>';
      html += '</tr>';
    });
    tbody.innerHTML = html;

    var sub = cartSubtotal();
    subtotalEl.textContent = fmt(sub);
    totalEl.textContent    = fmt(sub); // free shipping → total = subtotal
  }

  /* ── Coupon Notice Toggle ─────────────────────────────────────────────── */
  var couponNoticeToggle = document.getElementById('coupon-notice-toggle');
  var couponFormWrapper  = document.getElementById('coupon-form-wrapper');

  if (couponNoticeToggle && couponFormWrapper) {
    couponNoticeToggle.addEventListener('click', function () {
      var isOpen = couponFormWrapper.style.display !== 'none';
      couponFormWrapper.style.display = isOpen ? 'none' : 'block';
    });
  }

  /* ── Ship to Different Address Toggle ────────────────────────────────── */
  var shipCb        = document.getElementById('ship_to_different');
  var shippingFields = document.getElementById('shipping-fields');

  if (shipCb && shippingFields) {
    shipCb.addEventListener('change', function () {
      shippingFields.style.display = shipCb.checked ? 'block' : 'none';
    });
  }

  /* ── Basic Client-Side Form Validation ───────────────────────────────── */
  var form = document.getElementById('checkout-form');

  function showError(inputEl, msg) {
    inputEl.classList.add('invalid');
    var errEl = inputEl.parentElement.querySelector('.field-error');
    if (!errEl) {
      errEl = document.createElement('div');
      errEl.className = 'field-error';
      inputEl.parentElement.appendChild(errEl);
    }
    errEl.textContent = msg;
    errEl.classList.add('visible');
  }

  function clearError(inputEl) {
    inputEl.classList.remove('invalid');
    var errEl = inputEl.parentElement.querySelector('.field-error');
    if (errEl) { errEl.textContent = ''; errEl.classList.remove('visible'); }
  }

  // Live clear on input
  if (form) {
    form.querySelectorAll('.field-input, .field-select, .field-textarea').forEach(function (el) {
      el.addEventListener('input',  function () { clearError(el); });
      el.addEventListener('change', function () { clearError(el); });
    });
  }

  function validateForm() {
    var valid = true;
    var required = [
      { id: 'billing_first_name', label: 'First name' },
      { id: 'billing_last_name',  label: 'Last name'  },
      { id: 'billing_address_1',  label: 'Street address' },
      { id: 'billing_city',       label: 'Town / City' },
      { id: 'billing_state',      label: 'State' },
      { id: 'billing_postcode',   label: 'ZIP Code' },
      { id: 'billing_email',      label: 'Email address' }
    ];

    required.forEach(function (f) {
      var el = document.getElementById(f.id);
      if (!el) return;
      if (!el.value.trim()) {
        showError(el, f.label + ' is required.');
        valid = false;
      }
    });

    // Email format check
    var emailEl = document.getElementById('billing_email');
    if (emailEl && emailEl.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailEl.value.trim())) {
      showError(emailEl, 'Please enter a valid email address.');
      valid = false;
    }

    return valid;
  }

  /* ── Place Order ─────────────────────────────────────────────────────── */
  var placeOrderBtn = document.getElementById('btn-place-order');

  if (placeOrderBtn && form) {
    placeOrderBtn.addEventListener('click', function (e) {
      e.preventDefault();
      if (!validateForm()) {
        // Scroll to first error
        var firstInvalid = form.querySelector('.invalid');
        if (firstInvalid) { firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        return;
      }

      // Collect form data
      var data = {};
      new FormData(form).forEach(function (val, key) { data[key] = val; });
      data.cart = cart;
      data.total = cartSubtotal();

      // Disable button to prevent double-click
      placeOrderBtn.disabled = true;
      placeOrderBtn.textContent = 'Processing…';

      // Simulate order placement (replace with real API call)
      setTimeout(function () {
        // Clear cart
        cart = [];
        try { localStorage.removeItem('yopao_cart'); } catch (err) {}
        // Redirect to confirmation page
        window.location.href = '/order-complete/?order=demo';
      }, 1200);
    });
  }

  /* ── Init ────────────────────────────────────────────────────────────── */
  renderOrderSummary();

}());