// ── Checkout Page JS ──────────────────────────────────────────────────────────

(function () {
  'use strict';

  // ── Login Gate ──────────────────────────────────────────────────────────────
  var loggedInUser = null;
  try { var u = localStorage.getItem('yopao_user'); if (u) loggedInUser = JSON.parse(u); } catch (e) {}
  if (!loggedInUser || !loggedInUser.id) {
    window.location.href = '/cart/';
    return;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function fmt(n) { return '$' + Number(n).toFixed(2); }
  function escHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── Read cart from localStorage ─────────────────────────────────────────────
  var cart = [];
  try {
    var raw = localStorage.getItem('yopao_cart');
    if (raw) {
      var parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        cart = parsed.filter(function (i) {
          return i && typeof i.id === 'string' && typeof i.price === 'number' && i.qty > 0;
        });
      }
    }
  } catch (e) {}

  // ── Populate Order Summary ───────────────────────────────────────────────────
  function renderOrderSummary() {
    var tbody = document.getElementById('order-items-body');
    var subtotalEl = document.getElementById('order-subtotal-amount');
    var totalEl = document.getElementById('order-total-amount');
    if (!tbody) return;

    if (cart.length === 0) {
      tbody.innerHTML = '<tr><td colspan="2" style="padding:12px 0;color:#999;font-size:13px;">Your cart is empty. <a href="../" style="color:#333365;text-decoration:underline;">Continue shopping</a></td></tr>';
      subtotalEl.textContent = '$0.00';
      totalEl.textContent = '$0.00';
      return;
    }

    var html = '';
    var total = 0;
    cart.forEach(function (item) {
      var lineTotal = item.price * item.qty;
      total += lineTotal;
      html += '<tr>';
      html += '<td><span class="order-item-name">' + escHtml(item.name) + '</span>';
      html += ' <strong class="order-item-qty">&times;&nbsp;' + item.qty + '</strong></td>';
      html += '<td>' + fmt(lineTotal) + '</td>';
      html += '</tr>';
    });
    tbody.innerHTML = html;
    subtotalEl.textContent = fmt(total);
    totalEl.textContent = fmt(total);
  }

  renderOrderSummary();

  // ── Load Saved Address ──────────────────────────────────────────────────────
  function loadSavedAddress() {
    if (!loggedInUser || !loggedInUser.id) return;
    var xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/user.php?action=get_address', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      try {
        var resp = JSON.parse(xhr.responseText);
        if (resp.success && resp.address) {
          var a = resp.address;
          var el;
          if (a.first_name) { el = document.getElementById('billing_first_name'); if (el && !el.value) el.value = a.first_name; }
          if (a.last_name) { el = document.getElementById('billing_last_name'); if (el && !el.value) el.value = a.last_name; }
          if (a.address) { el = document.getElementById('billing_address_1'); if (el && !el.value) el.value = a.address; }
          if (a.address_2) { el = document.getElementById('billing_address_2'); if (el && !el.value) el.value = a.address_2; }
          if (a.city) { el = document.getElementById('billing_city'); if (el && !el.value) el.value = a.city; }
          if (a.state) { el = document.getElementById('billing_state'); if (el && !el.value) el.value = a.state; }
          if (a.postcode) { el = document.getElementById('billing_postcode'); if (el && !el.value) el.value = a.postcode; }
          if (a.phone) { el = document.getElementById('billing_phone'); if (el && !el.value) el.value = a.phone; }
          if (a.email) { el = document.getElementById('billing_email'); if (el && !el.value) el.value = a.email; }
        }
      } catch (e) {}
    };
    xhr.send(JSON.stringify({ user_id: loggedInUser.id }));
  }
  loadSavedAddress();

  // Pre-fill email from logged-in user if empty
  var emailField = document.getElementById('billing_email');
  if (emailField && !emailField.value && loggedInUser.email) {
    emailField.value = loggedInUser.email;
  }

  // ── Coupon Notice Toggle ─────────────────────────────────────────────────────
  var couponToggle = document.getElementById('coupon-notice-toggle');
  var couponForm = document.getElementById('coupon-notice-form');
  if (couponToggle && couponForm) {
    couponToggle.addEventListener('click', function (e) {
      e.preventDefault();
      couponForm.classList.toggle('open');
      couponToggle.textContent = couponForm.classList.contains('open')
        ? 'Hide coupon form' : 'Click here to enter your code';
    });
  }

  var couponApplyBtn = document.getElementById('coupon-apply-btn');
  if (couponApplyBtn) {
    couponApplyBtn.addEventListener('click', function () {
      var code = (document.getElementById('coupon-code-input') || {}).value || '';
      if (code.trim() === '') {
        alert('Please enter a coupon code.');
        return;
      }
      // Placeholder – real coupon logic would call a server endpoint
      alert('Coupon "' + code.trim() + '" is not valid or has already been used.');
    });
  }

  // ── Ship to Different Address Toggle ────────────────────────────────────────
  var shipDifferentChk = document.getElementById('ship-to-different');
  var shippingBlock = document.getElementById('shipping-address-block');
  if (shipDifferentChk && shippingBlock) {
    shipDifferentChk.addEventListener('change', function () {
      shippingBlock.style.display = this.checked ? 'block' : 'none';
    });
  }

  // ── Form Validation ──────────────────────────────────────────────────────────
  function showError(inputId, errorId, msg) {
    var inp = document.getElementById(inputId);
    var err = document.getElementById(errorId);
    if (inp) { inp.classList.add('has-error'); inp.classList.remove('shake'); void inp.offsetWidth; inp.classList.add('shake'); }
    if (err) err.textContent = msg;
  }

  function clearError(inputId, errorId) {
    var inp = document.getElementById(inputId);
    var err = document.getElementById(errorId);
    if (inp) inp.classList.remove('has-error', 'shake');
    if (err) err.textContent = '';
  }

  function validateForm() {
    var valid = true;
    var firstInvalid = null;

    // First Name
    var firstName = (document.getElementById('billing_first_name') || {}).value || '';
    if (firstName.trim() === '') {
      showError('billing_first_name', 'err-first-name', 'First name is required.');
      valid = false;
      if (!firstInvalid) firstInvalid = document.getElementById('billing_first_name');
    } else {
      clearError('billing_first_name', 'err-first-name');
    }

    // Last Name
    var lastName = (document.getElementById('billing_last_name') || {}).value || '';
    if (lastName.trim() === '') {
      showError('billing_last_name', 'err-last-name', 'Last name is required.');
      valid = false;
      if (!firstInvalid) firstInvalid = document.getElementById('billing_last_name');
    } else {
      clearError('billing_last_name', 'err-last-name');
    }

    // Street Address
    var address1 = (document.getElementById('billing_address_1') || {}).value || '';
    if (address1.trim() === '') {
      showError('billing_address_1', 'err-address1', 'Street address is required.');
      valid = false;
      if (!firstInvalid) firstInvalid = document.getElementById('billing_address_1');
    } else {
      clearError('billing_address_1', 'err-address1');
    }

    // City
    var city = (document.getElementById('billing_city') || {}).value || '';
    if (city.trim() === '') {
      showError('billing_city', 'err-city', 'Town / City is required.');
      valid = false;
      if (!firstInvalid) firstInvalid = document.getElementById('billing_city');
    } else {
      clearError('billing_city', 'err-city');
    }

    // State
    var state = (document.getElementById('billing_state') || {}).value || '';
    if (state.trim() === '') {
      showError('billing_state', 'err-state', 'State is required.');
      valid = false;
      if (!firstInvalid) firstInvalid = document.getElementById('billing_state');
    } else {
      clearError('billing_state', 'err-state');
    }

    // ZIP / Postcode – basic US ZIP validation
    var postcode = (document.getElementById('billing_postcode') || {}).value || '';
    if (postcode.trim() === '') {
      showError('billing_postcode', 'err-postcode', 'ZIP Code is required.');
      valid = false;
      if (!firstInvalid) firstInvalid = document.getElementById('billing_postcode');
    } else if (!/^\d{5}(-\d{4})?$/.test(postcode.trim())) {
      showError('billing_postcode', 'err-postcode', 'Please enter a valid ZIP Code (e.g. 84101).');
      valid = false;
      if (!firstInvalid) firstInvalid = document.getElementById('billing_postcode');
    } else {
      clearError('billing_postcode', 'err-postcode');
    }

    // Email
    var email = (document.getElementById('billing_email') || {}).value || '';
    if (email.trim() === '') {
      showError('billing_email', 'err-email', 'Email address is required.');
      valid = false;
      if (!firstInvalid) firstInvalid = document.getElementById('billing_email');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      showError('billing_email', 'err-email', 'Please enter a valid email address.');
      valid = false;
      if (!firstInvalid) firstInvalid = document.getElementById('billing_email');
    } else {
      clearError('billing_email', 'err-email');
    }

    // Shipping fields (only validate when "Ship to a different address" is checked)
    if (shipDifferentChk && shipDifferentChk.checked) {
      var sFirstName = (document.getElementById('shipping_first_name') || {}).value || '';
      if (sFirstName.trim() === '') {
        showError('shipping_first_name', 'err-shipping-first-name', 'First name is required.');
        valid = false;
        if (!firstInvalid) firstInvalid = document.getElementById('shipping_first_name');
      } else {
        clearError('shipping_first_name', 'err-shipping-first-name');
      }

      var sLastName = (document.getElementById('shipping_last_name') || {}).value || '';
      if (sLastName.trim() === '') {
        showError('shipping_last_name', 'err-shipping-last-name', 'Last name is required.');
        valid = false;
        if (!firstInvalid) firstInvalid = document.getElementById('shipping_last_name');
      } else {
        clearError('shipping_last_name', 'err-shipping-last-name');
      }

      var sAddress1 = (document.getElementById('shipping_address_1') || {}).value || '';
      if (sAddress1.trim() === '') {
        showError('shipping_address_1', 'err-shipping-address1', 'Street address is required.');
        valid = false;
        if (!firstInvalid) firstInvalid = document.getElementById('shipping_address_1');
      } else {
        clearError('shipping_address_1', 'err-shipping-address1');
      }

      var sCity = (document.getElementById('shipping_city') || {}).value || '';
      if (sCity.trim() === '') {
        showError('shipping_city', 'err-shipping-city', 'Town / City is required.');
        valid = false;
        if (!firstInvalid) firstInvalid = document.getElementById('shipping_city');
      } else {
        clearError('shipping_city', 'err-shipping-city');
      }

      var sPostcode = (document.getElementById('shipping_postcode') || {}).value || '';
      if (sPostcode.trim() === '') {
        showError('shipping_postcode', 'err-shipping-postcode', 'ZIP Code is required.');
        valid = false;
        if (!firstInvalid) firstInvalid = document.getElementById('shipping_postcode');
      } else if (!/^\d{5}(-\d{4})?$/.test(sPostcode.trim())) {
        showError('shipping_postcode', 'err-shipping-postcode', 'Please enter a valid ZIP Code (e.g. 84101).');
        valid = false;
        if (!firstInvalid) firstInvalid = document.getElementById('shipping_postcode');
      } else {
        clearError('shipping_postcode', 'err-shipping-postcode');
      }
    }

    // Cart must not be empty
    if (cart.length === 0) {
      valid = false;
      showToast('Your cart is empty. Please add items before placing an order.', '#e2401c');
    }

    if (firstInvalid) {
      firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(function () { firstInvalid.focus(); }, 400);
    }

    return valid;
  }

  // ── Real-time clear errors on input ─────────────────────────────────────────
  [
    ['billing_first_name', 'err-first-name'],
    ['billing_last_name',  'err-last-name'],
    ['billing_address_1',  'err-address1'],
    ['billing_city',       'err-city'],
    ['billing_postcode',   'err-postcode'],
    ['billing_email',      'err-email'],
    ['billing_state',      'err-state'],
    ['shipping_first_name', 'err-shipping-first-name'],
    ['shipping_last_name',  'err-shipping-last-name'],
    ['shipping_address_1',  'err-shipping-address1'],
    ['shipping_city',       'err-shipping-city'],
    ['shipping_postcode',   'err-shipping-postcode']
  ].forEach(function (pair) {
    var el = document.getElementById(pair[0]);
    if (el) {
      el.addEventListener('input', function () { clearError(pair[0], pair[1]); });
      el.addEventListener('change', function () { clearError(pair[0], pair[1]); });
    }
  });

  // ── Toast Notification ──────────────────────────────────────────────────────
  function showToast(msg, bg) {
    var toast = document.createElement('div');
    toast.className = 'checkout-toast';
    toast.textContent = msg;
    if (bg) toast.style.background = bg;
    document.body.appendChild(toast);
    setTimeout(function () { toast.classList.add('show'); }, 10);
    setTimeout(function () {
      toast.classList.remove('show');
      setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 400);
    }, 3500);
  }

  // ── Payment Method Selection ─────────────────────────────────────────────────
  var paymentOptions = document.querySelectorAll('.co-payment-option');
  function clearPaymentSelection() {
    paymentOptions.forEach(function(opt) { opt.classList.remove('selected'); });
  }
  paymentOptions.forEach(function(option) {
    option.addEventListener('click', function(e) {
      if (option.classList.contains('disabled')) { e.preventDefault(); return; }
      clearPaymentSelection();
      option.classList.add('selected');
      var radio = option.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
      var errPayment = document.getElementById('err-payment');
      if (errPayment) errPayment.style.display = 'none';
    });
  });

  // Also handle direct radio change (keyboard accessibility)
  paymentOptions.forEach(function(option) {
    var radio = option.querySelector('input[type="radio"]');
    if (radio) {
      radio.addEventListener('change', function() {
        if (option.classList.contains('disabled')) return;
        clearPaymentSelection();
        option.classList.add('selected');
      });
    }
  });

  // ── Place Order ──────────────────────────────────────────────────────────────
  var placeOrderBtn = document.getElementById('place-order-btn');
  if (placeOrderBtn) {
    placeOrderBtn.addEventListener('click', function () {
      if (!validateForm()) return;

      // Validate payment method selection
      var selectedPayment = document.querySelector('input[name="payment_method"]:checked');
      if (!selectedPayment) {
        var errPayment = document.getElementById('err-payment');
        if (errPayment) { errPayment.style.display = 'block'; errPayment.textContent = 'Please select a payment method.'; }
        return;
      }

      // Disable button to prevent double-click
      placeOrderBtn.classList.add('loading');
      placeOrderBtn.textContent = 'Processing…';

      // Read the already-rendered order total from the DOM
      var totalText = (document.getElementById('order-total-amount') || {}).textContent || '$0.00';
      var orderTotal = parseFloat(totalText.replace(/[^0-9.]/g, '')) || 0;

      // Generate order ID
      var now = new Date();
      var oid = 'ORD' + now.getFullYear().toString().slice(-2)
        + String(now.getMonth() + 1).padStart(2, '0')
        + String(now.getDate()).padStart(2, '0')
        + String(now.getHours()).padStart(2, '0')
        + String(now.getMinutes()).padStart(2, '0')
        + String(Math.floor(Math.random() * 10000)).padStart(4, '0');

      // Save order to database if user is logged in
      var payUrl = '../pay/?amount=' + orderTotal.toFixed(2) + '&order=' + oid;
      var _redirected = false;

      function doRedirect() {
        if (_redirected) return;
        _redirected = true;
        try { localStorage.removeItem('yopao_cart'); } catch (e) {}
        window.location.href = payUrl;
      }

      if (loggedInUser && loggedInUser.id) {
        var orderData = {
          user_id: loggedInUser.id,
          order_id: oid,
          email: ((document.getElementById('billing_email') || {}).value || '').trim(),
          first_name: ((document.getElementById('billing_first_name') || {}).value || '').trim(),
          last_name: ((document.getElementById('billing_last_name') || {}).value || '').trim(),
          address: ((document.getElementById('billing_address_1') || {}).value || '').trim(),
          address_2: ((document.getElementById('billing_address_2') || {}).value || '').trim(),
          city: ((document.getElementById('billing_city') || {}).value || '').trim(),
          state: ((document.getElementById('billing_state') || {}).value || '').trim(),
          postcode: ((document.getElementById('billing_postcode') || {}).value || '').trim(),
          phone: ((document.getElementById('billing_phone') || {}).value || '').trim(),
          total: orderTotal,
          items: cart
        };
        var xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/user.php?action=create_order', true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.onreadystatechange = function () {
          if (xhr.readyState !== 4) return;
          // Redirect after order is saved (or on error, still redirect to payment)
          doRedirect();
        };
        xhr.send(JSON.stringify(orderData));
        // Fallback: redirect after 5s even if request hangs
        setTimeout(doRedirect, 5000);
      } else {
        // Not logged in — redirect after short delay
        setTimeout(doRedirect, 1200);
      }
    });
  }

})();
