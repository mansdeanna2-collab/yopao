(function () {
  'use strict';

  var couponToggleEl = document.getElementById('coupon-toggle');
  var couponFormEl = document.getElementById('coupon-form');
  var cartBodyEl = document.getElementById('cart-body');
  var cartEmptyEl = document.getElementById('cart-empty');
  var cartFilledEl = document.getElementById('cart-filled');
  var estimatedAmountEl = document.getElementById('estimated-amount');

  function fmt(n) { return '$' + n.toFixed(2); }

  function cartTotal() {
    return cart.reduce(function (s, i) { return s + i.price * i.qty; }, 0);
  }

  function renderCartPage() {
    if (cart.length === 0) {
      cartEmptyEl.style.display = 'block';
      cartFilledEl.style.display = 'none';
      return;
    }
    cartEmptyEl.style.display = 'none';
    cartFilledEl.style.display = 'flex';

    var html = '';
    cart.forEach(function (item) {
      var lineTotal = item.price * item.qty;
      var variation = item.variation || 'Quantity: 5 Sheets of 20 (100 Stamps)';
      html += '<div class="cart-row">';
      html += '<img class="cart-row-img" src="' + escapeHtml(item.image) + '" alt="' + escapeHtml(item.name) + '">';
      html += '<div class="cart-row-details">';
      html += '<div class="cart-row-name">' + escapeHtml(item.name) + '</div>';
      html += '<div class="cart-row-price">' + fmt(item.price) + '</div>';
      html += '<div class="cart-row-variation">' + escapeHtml(variation) + '</div>';
      html += '<div class="cart-row-qty">';
      html += '<button class="cart-qty-minus" data-id="' + escapeHtml(item.id) + '" aria-label="Decrease">&#8722;</button>';
      html += '<span class="qty-val">' + item.qty + '</span>';
      html += '<button class="cart-qty-plus" data-id="' + escapeHtml(item.id) + '" aria-label="Increase">+</button>';
      html += '</div>';
      html += '<button class="cart-row-remove" data-id="' + escapeHtml(item.id) + '">&#128465; Remove</button>';
      html += '</div>';
      html += '<div class="cart-row-total">' + fmt(lineTotal) + '</div>';
      html += '</div>';
    });
    cartBodyEl.innerHTML = html;

    estimatedAmountEl.textContent = fmt(cartTotal());
  }

  // Event delegation for cart item interactions
  cartBodyEl.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-id]');
    if (!btn) return;
    var id = btn.getAttribute('data-id');
    if (btn.classList.contains('cart-qty-minus')) {
      updateQty(id, -1);
      renderCartPage();
    } else if (btn.classList.contains('cart-qty-plus')) {
      updateQty(id, 1);
      renderCartPage();
    } else if (btn.classList.contains('cart-row-remove')) {
      removeFromCart(id);
      renderCartPage();
    }
  });

  // Coupon toggle
  couponToggleEl.addEventListener('click', function () {
    var isOpen = couponFormEl.classList.toggle('visible');
    couponToggleEl.classList.toggle('open', isOpen);
  });

  renderCartPage();

  // Render order info summary for logged-in users
  function renderOrderInfo() {
    var orderInfoBox = document.getElementById('cart-order-info');
    var orderItemsEl = document.getElementById('cart-order-items');
    var orderTotalEl = document.getElementById('order-info-total');
    var savedAddrEl = document.getElementById('cart-saved-address');
    if (!orderInfoBox || !currentUser) return;
    if (cart.length === 0) { orderInfoBox.style.display = 'none'; return; }

    orderInfoBox.style.display = 'block';
    var html = '';
    var total = 0;
    cart.forEach(function (item) {
      var lineTotal = item.price * item.qty;
      total += lineTotal;
      html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;font-size:13px;">';
      html += '<span>' + escapeHtml(item.name) + ' &times; ' + item.qty + '</span>';
      html += '<span style="font-weight:700;">' + fmt(lineTotal) + '</span>';
      html += '</div>';
    });
    if (orderItemsEl) orderItemsEl.innerHTML = html;
    if (orderTotalEl) orderTotalEl.textContent = fmt(total);

    // Load saved address
    if (savedAddrEl) {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/user.php?action=get_address', true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        try {
          var resp = JSON.parse(xhr.responseText);
          if (resp.success && resp.address && resp.address.first_name) {
            var a = resp.address;
            var addrParts = [escapeHtml(a.city || '')];
            if (a.state) addrParts.push(escapeHtml(a.state));
            addrParts.push(escapeHtml(a.postcode || ''));
            savedAddrEl.innerHTML = '<div style="margin-top:4px;"><strong>Shipping Address:</strong></div>' +
              '<div>' + escapeHtml(a.first_name || '') + ' ' + escapeHtml(a.last_name || '') + '</div>' +
              '<div>' + escapeHtml(a.address || '') + '</div>' +
              '<div>' + addrParts.join(', ') + '</div>';
          }
        } catch (e) {}
      };
      xhr.send(JSON.stringify({ user_id: currentUser.id }));
    }
  }

  renderOrderInfo();

  // Navigate to checkout when clicking Proceed to Checkout
  var btnCheckout = document.querySelector('.btn-checkout');
  if (btnCheckout) {
    btnCheckout.addEventListener('click', function () {
      if (!currentUser) {
        openLoginModal();
        return;
      }
      window.location.href = '/checkout/';
    });
  }
}());
