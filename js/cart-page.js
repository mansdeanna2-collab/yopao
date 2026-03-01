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

  // Render pending (unpaid) orders for logged-in users
  function renderPendingOrders() {
    var section = document.getElementById('pending-orders-section');
    if (!section || !currentUser) return;

    var xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/user.php?action=get_orders', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      try {
        var resp = JSON.parse(xhr.responseText);
        if (!resp.success || !resp.orders || resp.orders.length === 0) {
          section.style.display = 'none';
          return;
        }

        var orders = resp.orders;
        section.style.display = 'block';
        var html = '<div class="pending-orders-title">YOUR ORDERS</div>';
        orders.forEach(function (order) {
          var isPending = order.status === 'pending';
          var statusLabel = isPending ? 'Unpaid' : order.status;
          var statusClass = isPending ? 'status-unpaid' : 'status-other';
          var dateStr = '';
          if (order.created_at) {
            var d = new Date(order.created_at.replace(' ', 'T'));
            if (!isNaN(d.getTime())) {
              dateStr = (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear();
            }
          }

          html += '<div class="pending-order-card">';
          html += '<div class="pending-order-header">';
          html += '<div>';
          html += '<span class="pending-order-id">' + escapeHtml(order.order_id) + '</span>';
          if (dateStr) html += '<span class="pending-order-date">' + escapeHtml(dateStr) + '</span>';
          html += '</div>';
          html += '<span class="pending-order-status ' + statusClass + '">' + escapeHtml(statusLabel) + '</span>';
          html += '</div>';

          // Order items
          if (order.items && order.items.length > 0) {
            html += '<div class="pending-order-items">';
            order.items.forEach(function (item) {
              html += '<div class="pending-order-item">';
              html += '<span class="pending-item-name">' + escapeHtml(item.product_name) + ' &times; ' + item.qty + '</span>';
              html += '<span class="pending-item-price">' + fmt(item.price * item.qty) + '</span>';
              html += '</div>';
            });
            html += '</div>';
          }

          html += '<div class="pending-order-footer">';
          html += '<span class="pending-order-total">Total: <strong>' + fmt(order.total) + '</strong></span>';
          if (isPending) {
            html += '<a class="pending-order-pay-btn" href="/pay/?amount=' + order.total.toFixed(2) + '&order=' + encodeURIComponent(order.order_id) + '">Pay Now</a>';
          }
          html += '</div>';
          html += '</div>';
        });
        section.innerHTML = html;
      } catch (e) {
        section.style.display = 'none';
      }
    };
    xhr.send(JSON.stringify({ user_id: currentUser.id, status: 'pending' }));
  }

  renderPendingOrders();

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
