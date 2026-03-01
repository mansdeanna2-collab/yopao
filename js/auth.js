(function () {
  'use strict';

  /* ========== Helpers ========== */
  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function $(id) { return document.getElementById(id); }

  var EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

  /* ========== Open login modal from auth pages ========== */
  var loginLink = $('open-login-link');
  if (loginLink) {
    loginLink.addEventListener('click', function (e) {
      e.preventDefault();
      var overlay = $('login-modal-overlay');
      if (overlay) overlay.classList.add('active');
    });
  }

  /* ========== Show/Hide Password Toggles ========== */
  var toggleBtns = document.querySelectorAll('.auth-toggle-pw');
  for (var t = 0; t < toggleBtns.length; t++) {
    (function (btn) {
      btn.addEventListener('click', function () {
        var targetId = btn.getAttribute('data-target');
        var input = $(targetId);
        if (!input) return;
        var showing = input.type === 'text';
        input.type = showing ? 'password' : 'text';
        var open = btn.querySelector('.eye-open');
        var closed = btn.querySelector('.eye-closed');
        if (open) open.style.display = showing ? '' : 'none';
        if (closed) closed.style.display = showing ? 'none' : '';
      });
    })(toggleBtns[t]);
  }

  /* ========== Field Error Helpers ========== */
  function showError(fieldId, errorId, msg) {
    var wrap = $(fieldId);
    var errEl = $(errorId);
    if (errEl) errEl.textContent = msg;
    if (wrap) {
      var inp = wrap.querySelector('input');
      if (inp) {
        inp.classList.add('has-error');
        inp.classList.remove('shake');
        void inp.offsetWidth;
        inp.classList.add('shake');
      }
    }
  }

  function clearError(fieldId, errorId) {
    var wrap = $(fieldId);
    var errEl = $(errorId);
    if (errEl) errEl.textContent = '';
    if (wrap) {
      var inp = wrap.querySelector('input');
      if (inp) inp.classList.remove('has-error', 'shake');
    }
  }

  /* ========== Toast ========== */
  function showToast(msg) {
    var toast = document.createElement('div');
    toast.className = 'auth-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(function () { toast.classList.add('show'); }, 10);
    setTimeout(function () {
      toast.classList.remove('show');
      setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 400);
    }, 3500);
  }

  /* ========== Password Strength ========== */
  function calcStrength(pw) {
    var score = 0;
    if (pw.length >= 8)  score++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return score; // 0-4
  }

  function updateStrengthBar(score) {
    var segs = document.querySelectorAll('.strength-seg');
    var label = $('strength-label');
    if (!segs.length || !label) return;
    var levels = ['', 'Weak', 'Medium', 'Strong', 'Very Strong'];
    var classes = ['', 'weak', 'medium', 'strong', 'very-strong'];

    for (var i = 0; i < segs.length; i++) {
      segs[i].className = 'strength-seg';
      if (i < score) segs[i].classList.add(classes[score]);
    }
    label.textContent = levels[score];
    var colors = ['#999', '#e53935', '#ff9800', '#4caf50', '#333365'];
    label.style.color = colors[score];
  }

  /* ========== Validate Helpers ========== */
  function validateEmail(val) {
    if (!val) return 'Email address is required.';
    if (!EMAIL_RE.test(val)) return 'Please enter a valid email address.';
    return '';
  }

  function validatePassword(val) {
    if (!val) return 'Password is required.';
    if (val.length < 8) return 'Password must be at least 8 characters.';
    if (!/[A-Z]/.test(val)) return 'Include at least one uppercase letter.';
    if (!/[a-z]/.test(val)) return 'Include at least one lowercase letter.';
    if (!/\d/.test(val)) return 'Include at least one number.';
    if (!/[^A-Za-z0-9]/.test(val)) return 'Include at least one special character.';
    return '';
  }

  function validateConfirm(pw, cpw) {
    if (!cpw) return 'Please confirm your password.';
    if (pw !== cpw) return 'Passwords do not match.';
    return '';
  }

  /* ========== Register Page ========== */
  var regForm = $('register-form');
  if (regForm) {
    var emailIn = $('reg-email');
    var pwIn = $('reg-password');
    var cpwIn = $('reg-confirm');
    var termsIn = $('reg-terms');
    var blurred = {};

    // Real-time strength meter
    if (pwIn) {
      pwIn.addEventListener('input', function () {
        updateStrengthBar(calcStrength(pwIn.value));
        if (blurred.password) {
          var err = validatePassword(pwIn.value);
          if (err) showError('field-password', 'error-password', err);
          else clearError('field-password', 'error-password');
        }
      });
    }

    // Validate on blur (first time), then live
    function bindBlur(input, key, fieldId, errorId, fn) {
      if (!input) return;
      input.addEventListener('blur', function () {
        blurred[key] = true;
        var err = fn();
        if (err) showError(fieldId, errorId, err);
        else clearError(fieldId, errorId);
      });
      input.addEventListener('input', function () {
        if (!blurred[key]) return;
        var err = fn();
        if (err) showError(fieldId, errorId, err);
        else clearError(fieldId, errorId);
      });
    }

    bindBlur(emailIn, 'email', 'field-email', 'error-email', function () { return validateEmail(emailIn.value.trim()); });
    bindBlur(pwIn, 'password', 'field-password', 'error-password', function () { return validatePassword(pwIn.value); });
    bindBlur(cpwIn, 'confirm', 'field-confirm', 'error-confirm', function () { return validateConfirm(pwIn.value, cpwIn.value); });

    regForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var valid = true;

      var emailErr = validateEmail(emailIn.value.trim());
      if (emailErr) { showError('field-email', 'error-email', emailErr); valid = false; }
      else clearError('field-email', 'error-email');

      var pwErr = validatePassword(pwIn.value);
      if (pwErr) { showError('field-password', 'error-password', pwErr); valid = false; }
      else clearError('field-password', 'error-password');

      var cpwErr = validateConfirm(pwIn.value, cpwIn.value);
      if (cpwErr) { showError('field-confirm', 'error-confirm', cpwErr); valid = false; }
      else clearError('field-confirm', 'error-confirm');

      if (!termsIn.checked) {
        showError('field-terms', 'error-terms', 'You must agree to the terms and privacy policy.');
        valid = false;
      } else {
        clearError('field-terms', 'error-terms');
      }

      if (!valid) return;

      // Send registration to backend
      var submitBtn = regForm.querySelector('.auth-submit');
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'CREATING…'; }

      var xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/auth.php?action=register', true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'CREATE ACCOUNT'; }
        try {
          var resp = JSON.parse(xhr.responseText);
          if (xhr.status === 200 && resp.success) {
            showToast(resp.message || 'Account created successfully!');
            regForm.reset();
            updateStrengthBar(0);
            blurred = {};
          } else {
            showToast(resp.error || 'Registration failed. Please try again.');
          }
        } catch (ex) {
          showToast('Server error. Please try again later.');
        }
      };
      xhr.send(JSON.stringify({ email: emailIn.value.trim(), password: pwIn.value }));
    });
  }

  /* ========== Forgot Password Page ========== */
  var forgotForm = $('forgot-form');
  if (forgotForm) {
    var fEmailIn = $('forgot-email');
    var fBlurred = false;

    if (fEmailIn) {
      fEmailIn.addEventListener('blur', function () {
        fBlurred = true;
        var err = validateEmail(fEmailIn.value.trim());
        if (err) showError('field-email', 'error-email', err);
        else clearError('field-email', 'error-email');
      });
      fEmailIn.addEventListener('input', function () {
        if (!fBlurred) return;
        var err = validateEmail(fEmailIn.value.trim());
        if (err) showError('field-email', 'error-email', err);
        else clearError('field-email', 'error-email');
      });
    }

    forgotForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var emailErr = validateEmail(fEmailIn.value.trim());
      if (emailErr) {
        showError('field-email', 'error-email', emailErr);
        return;
      }
      clearError('field-email', 'error-email');

      // Hide form, show success
      forgotForm.style.display = 'none';
      var success = $('forgot-success');
      if (success) success.style.display = 'block';
    });
  }
})();
