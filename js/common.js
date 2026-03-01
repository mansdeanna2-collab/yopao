// ── Mobile Navigation ─────────────────────────────────────────────────────
var hamburger=document.getElementById('hamburger-btn'),overlay=document.getElementById('mobile-nav-overlay'),panel=document.getElementById('mobile-nav-panel'),closeBtn=document.getElementById('mobile-nav-close');
function openMobileNav(){overlay.classList.add('active');panel.classList.add('active');document.body.classList.add('nav-open');}
function closeMobileNav(){overlay.classList.remove('active');panel.classList.remove('active');document.body.classList.remove('nav-open');}
hamburger.addEventListener('click',openMobileNav);
overlay.addEventListener('click',closeMobileNav);
closeBtn.addEventListener('click',closeMobileNav);

// ── User Session ─────────────────────────────────────────────────────────
var currentUser=null;
try{var su=localStorage.getItem('yopao_user');if(su){currentUser=JSON.parse(su);if(!currentUser||!currentUser.id||!currentUser.email){currentUser=null;}}}catch(e){currentUser=null;}

function saveUser(user){
  currentUser=user;
  try{localStorage.setItem('yopao_user',JSON.stringify(user));}catch(e){}
}
function clearUser(){
  currentUser=null;
  try{localStorage.removeItem('yopao_user');}catch(e){}
}
function syncCartToServer(){
  if(!currentUser)return;
  var xhr=new XMLHttpRequest();
  xhr.open('POST','/api/user.php?action=sync_cart',true);
  xhr.setRequestHeader('Content-Type','application/json');
  xhr.send(JSON.stringify({user_id:currentUser.id,items:cart}));
}
function loadCartFromServer(callback){
  if(!currentUser){if(callback)callback();return;}
  var xhr=new XMLHttpRequest();
  xhr.open('POST','/api/user.php?action=get_cart',true);
  xhr.setRequestHeader('Content-Type','application/json');
  xhr.onreadystatechange=function(){
    if(xhr.readyState!==4)return;
    try{
      var resp=JSON.parse(xhr.responseText);
      if(resp.success&&Array.isArray(resp.items)){
        // Merge: add server-only items to local cart (items already in local cart are kept as-is)
        resp.items.forEach(function(si){
          var existing=cart.find(function(li){return li.id===si.id;});
          if(!existing){cart.push(si);}
        });
        // Save to localStorage only (avoid re-syncing to server what we just loaded)
        try{localStorage.setItem('yopao_cart',JSON.stringify(cart));}catch(e){}
        renderCart();
      }
    }catch(e){}
    if(callback)callback();
  };
  xhr.send(JSON.stringify({user_id:currentUser.id}));
}

// ── Login Modal ──────────────────────────────────────────────────────────
var accountBtn=document.getElementById('account-btn');
var loginOverlay=document.getElementById('login-modal-overlay');
var loginClose=document.getElementById('login-modal-close');
function openLoginModal(){loginOverlay.classList.add('active');}
function closeLoginModal(){loginOverlay.classList.remove('active');}

// Update account button based on login state
var _accountListenerAttached=false;
function updateAccountUI(){
  if(!accountBtn)return;
  // Remove existing dropdown if any
  var existingDd=document.getElementById('account-dropdown');
  if(existingDd)existingDd.parentNode.removeChild(existingDd);

  if(currentUser){
    accountBtn.removeAttribute('href');
    accountBtn.style.position='relative';
    // Create dropdown for logged-in user
    var dd=document.createElement('div');
    dd.id='account-dropdown';
    dd.style.cssText='display:none;position:absolute;top:100%;right:0;background:#fff;border:1px solid #ddd;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,.12);min-width:180px;z-index:1000;padding:8px 0;';
    var info=document.createElement('div');
    info.style.cssText='padding:10px 16px;font-size:13px;color:#666;border-bottom:1px solid #eee;word-break:break-all;';
    info.textContent=currentUser.email;
    dd.appendChild(info);
    var logoutBtn=document.createElement('button');
    logoutBtn.textContent='Log out';
    logoutBtn.style.cssText='display:block;width:100%;padding:10px 16px;border:none;background:none;text-align:left;font-size:14px;color:#333;cursor:pointer;';
    logoutBtn.addEventListener('mouseenter',function(){logoutBtn.style.background='#f5f5f5';});
    logoutBtn.addEventListener('mouseleave',function(){logoutBtn.style.background='none';});
    logoutBtn.addEventListener('click',function(e){
      e.stopPropagation();
      clearUser();
      window.location.reload();
    });
    dd.appendChild(logoutBtn);
    accountBtn.parentNode.style.position='relative';
    accountBtn.parentNode.appendChild(dd);

    accountBtn.onclick=function(e){
      e.preventDefault();
      e.stopPropagation();
      dd.style.display=dd.style.display==='none'?'block':'none';
    };
    document.addEventListener('click',function(e){
      if(!accountBtn.parentNode.contains(e.target)){dd.style.display='none';}
    });
  }else if(!_accountListenerAttached){
    _accountListenerAttached=true;
    accountBtn.addEventListener('click',function(e){e.preventDefault();openLoginModal();});
  }
}

if(loginClose){loginClose.addEventListener('click',closeLoginModal);}
if(loginOverlay){loginOverlay.addEventListener('click',function(e){if(e.target===loginOverlay){closeLoginModal();}});}
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&loginOverlay&&loginOverlay.classList.contains('active')){closeLoginModal();}});

updateAccountUI();

// ── Login Form Submit ────────────────────────────────────────────────────
var loginForm=document.getElementById('login-form');
if(loginForm){
  loginForm.addEventListener('submit',function(e){
    e.preventDefault();
    var emailField=document.getElementById('login-username');
    var pwField=document.getElementById('login-password');
    var submitBtn=loginForm.querySelector('.login-modal-submit');
    var email=emailField?emailField.value.trim():'';
    var pw=pwField?pwField.value:'';
    if(!email||!pw){alert('Please enter your email and password.');return;}
    if(submitBtn){submitBtn.disabled=true;submitBtn.textContent='Logging in…';}
    var xhr=new XMLHttpRequest();
    xhr.open('POST','/api/auth.php?action=login',true);
    xhr.setRequestHeader('Content-Type','application/json');
    xhr.onreadystatechange=function(){
      if(xhr.readyState!==4)return;
      if(submitBtn){submitBtn.disabled=false;submitBtn.textContent='Log in';}
      try{
        var resp=JSON.parse(xhr.responseText);
        if(xhr.status===200&&resp.success&&resp.user){
          saveUser(resp.user);
          closeLoginModal();
          syncCartToServer();
          updateAccountUI();
        }else{
          alert(resp.error||'Login failed. Please try again.');
        }
      }catch(ex){alert('Server error. Please try again later.');}
    };
    xhr.send(JSON.stringify({email:email,password:pw}));
  });
}

// ── Back to Top ──────────────────────────────────────────────────────────
var backToTop=document.getElementById('back-to-top');
window.addEventListener('scroll',function(){backToTop.classList.toggle('visible',window.scrollY>400);});
backToTop.addEventListener('click',function(){window.scrollTo({top:0,behavior:'smooth'});});

// ── Cart ──────────────────────────────────────────────────────────────────
function escapeHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
var cart=[];
try{var saved=localStorage.getItem('yopao_cart');if(saved){var parsed=JSON.parse(saved);if(Array.isArray(parsed)){cart=parsed.filter(function(i){return i&&typeof i.id==='string'&&typeof i.name==='string'&&typeof i.price==='number'&&typeof i.qty==='number'&&i.qty>0;});}}}catch(e){}
function saveCart(){try{localStorage.setItem('yopao_cart',JSON.stringify(cart));}catch(e){}syncCartToServer();}
var cartWrapper=document.getElementById('cart-wrapper');
var cartDropdown=document.getElementById('cart-dropdown');
var cartBadge=document.getElementById('cart-badge');
var cartTotalEl=document.getElementById('cart-total');
var cartItemsList=document.getElementById('cart-items-list');
var cartSubtotalRow=document.getElementById('cart-subtotal-row');
var cartSubtotalAmount=document.getElementById('cart-subtotal-amount');
var cartActionBtns=document.getElementById('cart-action-btns');

function cartTotal(){return cart.reduce(function(s,i){return s+i.price*i.qty;},0);}
function cartCount(){return cart.reduce(function(s,i){return s+i.qty;},0);}
function fmt(n){return '$'+n.toFixed(2);}

function renderCart(){
  var count=cartCount(),tot=cartTotal();
  cartTotalEl.textContent=fmt(tot);
  cartBadge.textContent=count;
  cartBadge.classList.remove('pop');
  void cartBadge.offsetWidth; // force reflow to restart CSS animation
  cartBadge.classList.add('pop');
  if(cart.length===0){
    cartItemsList.innerHTML='<div class="cart-empty">Your cart is empty</div>';
    cartSubtotalRow.style.display='none';
    cartActionBtns.style.display='none';
  } else {
    var html='<div class="cart-dropdown-title">Shopping Cart</div>';
    html+='<div class="cart-dropdown-items">';
    cart.forEach(function(item){
      html+='<div class="cart-item">';
      html+='<img class="cart-item-img" src="'+escapeHtml(item.image)+'" alt="'+escapeHtml(item.name)+'">';
      html+='<div class="cart-item-info">';
      html+='<div class="cart-item-name">'+escapeHtml(item.name)+'</div>';
      html+='<div class="cart-item-qty-price">';
      html+='<div class="cart-item-qty-btns">';
      html+='<button class="qty-btn" data-id="'+escapeHtml(item.id)+'" data-delta="-1">&#8722;</button>';
      html+='<span class="cart-item-qty-val">'+item.qty+'</span>';
      html+='<button class="qty-btn" data-id="'+escapeHtml(item.id)+'" data-delta="1">+</button>';
      html+='</div>';
      html+='<span>&times; '+fmt(item.price)+'</span>';
      html+='</div></div>';
      html+='<button class="cart-item-remove" data-id="'+escapeHtml(item.id)+'">&times;</button>';
      html+='</div>';
    });
    html+='</div>';
    cartItemsList.innerHTML=html;
    cartSubtotalRow.style.display='flex';
    cartSubtotalAmount.textContent=fmt(tot);
    cartActionBtns.style.display='flex';
    cartItemsList.querySelectorAll('.cart-item-remove').forEach(function(btn){
      btn.addEventListener('click',function(){removeFromCart(this.getAttribute('data-id'));});
    });
    cartItemsList.querySelectorAll('.qty-btn').forEach(function(btn){
      btn.addEventListener('click',function(){updateQty(this.getAttribute('data-id'),parseInt(this.getAttribute('data-delta')));});
    });
  }
}

function addToCart(id,name,price,image,btnEl){
  var ex=cart.find(function(i){return i.id===id;});
  if(ex){ex.qty++;}else{cart.push({id:id,name:name,price:price,qty:1,image:image});}
  saveCart();
  renderCart();
  cartDropdown.classList.add('visible');
  if(btnEl){
    btnEl.classList.remove('added');
    void btnEl.offsetWidth;
    btnEl.classList.add('added');
    var orig=btnEl.textContent;
    btnEl.textContent='\u2713 ADDED';
    setTimeout(function(){btnEl.textContent=orig;},800);
  }
}

function removeFromCart(id){
  cart=cart.filter(function(i){return i.id!==id;});
  saveCart();
  renderCart();
}

function updateQty(id,delta){
  var item=cart.find(function(i){return i.id===id;});
  if(!item)return;
  item.qty+=delta;
  if(item.qty<=0){removeFromCart(id);}else{saveCart();renderCart();}
}

// Inject data attributes into each product card and make them clickable
document.querySelectorAll('.product-card').forEach(function(card,idx){
  var img=card.querySelector('.product-image img');
  var nameEl=card.querySelector('.product-name a')||card.querySelector('.product-name');
  var priceEl=card.querySelector('.price-current')||card.querySelector('.product-price');
  var id='p'+idx;
  var name=nameEl?nameEl.textContent.trim():'Product';
  var price=priceEl?parseFloat(priceEl.textContent.replace(/[$,]/g,'').trim()):0;
  var image=img?img.src:'';
  card.setAttribute('data-id',id);
  card.setAttribute('data-name',name);
  card.setAttribute('data-price',price);
  card.setAttribute('data-image',image);
  // Make clicking on the product card navigate to the product detail page
  var link=card.querySelector('.product-name a');
  if(link&&link.getAttribute('href')&&link.getAttribute('href')!=='#'){
    card.style.cursor='pointer';
    card.addEventListener('click',function(e){
      window.location.href=link.getAttribute('href');
    });
  }
});

// Dropdown: hover on desktop, click-toggle on touch
cartWrapper.addEventListener('mouseenter',function(){cartDropdown.classList.add('visible');});
cartWrapper.addEventListener('mouseleave',function(){cartDropdown.classList.remove('visible');});
document.getElementById('cart-toggle').addEventListener('click',function(e){
  e.preventDefault();
  e.stopPropagation();
  cartDropdown.classList.toggle('visible');
});
document.addEventListener('click',function(e){
  if(!cartWrapper.contains(e.target)){cartDropdown.classList.remove('visible');}
});

// Navigate to cart page when clicking VIEW CART or CHECKOUT
var viewCartBtn=document.querySelector('.view-cart-btn');
var checkoutBtn=document.querySelector('.checkout-btn');
if(viewCartBtn){viewCartBtn.addEventListener('click',function(){window.location.href='/cart/';});}
if(checkoutBtn){checkoutBtn.addEventListener('click',function(){window.location.href='/cart/';});}

renderCart();

// Load cart from server for logged-in users (merge with local cart)
loadCartFromServer();

// ── Active Nav Link ──────────────────────────────────────────────────────
(function(){
  var path=window.location.pathname.replace(/\/$/,'');
  var hash=window.location.hash;
  var links=document.querySelectorAll('.nav-main a, .mobile-nav-panel ul li a');
  links.forEach(function(a){
    var href=a.getAttribute('href');if(!href||href==='#')return;
    var resolved=new URL(href,window.location.href);
    var linkPath=resolved.pathname.replace(/\/$/,'');
    var linkHash=resolved.hash;
    var samePath=(path===linkPath);
    if(samePath&&(!linkHash||(linkHash===hash))){a.classList.add('active');}
  });
})();
