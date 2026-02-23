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
      html += '<img class="cart-row-img" src="' + item.image + '" alt="' + item.name + '">';
      html += '<div class="cart-row-details">';
      html += '<div class="cart-row-name">' + item.name + '</div>';
      html += '<div class="cart-row-price">' + fmt(item.price) + '</div>';
      html += '<div class="cart-row-variation">' + variation + '</div>';
      html += '<div class="cart-row-qty">';
      html += '<button class="cart-qty-minus" data-id="' + item.id + '" aria-label="Decrease">&#8722;</button>';
      html += '<span class="qty-val">' + item.qty + '</span>';
      html += '<button class="cart-qty-plus" data-id="' + item.id + '" aria-label="Increase">+</button>';
      html += '</div>';
      html += '<button class="cart-row-remove" data-id="' + item.id + '">Remove item</button>';
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
}());
