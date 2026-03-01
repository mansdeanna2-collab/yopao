/**
 * 后台管理面板 JavaScript
 * 处理页面导航、数据获取、界面渲染、管理员登录和删除操作
 */
(function () {
    'use strict';

    var API_BASE = '/api/admin.php';
    var currentPage = 'dashboard';
    var LOW_STOCK_THRESHOLD = 5;
    var adminToken = null;
    var _initialized = false; // prevent duplicate event listener binding

    /* ===================== 管理员登录 ===================== */
    function getStoredToken() {
        try { return sessionStorage.getItem('admin_token'); } catch (e) { return null; }
    }
    function getStoredAdmin() {
        try {
            var s = sessionStorage.getItem('admin_user');
            return s ? JSON.parse(s) : null;
        } catch (e) { return null; }
    }
    function storeSession(token, admin) {
        try {
            sessionStorage.setItem('admin_token', token);
            sessionStorage.setItem('admin_user', JSON.stringify(admin));
        } catch (e) {}
    }
    function clearSession() {
        try {
            sessionStorage.removeItem('admin_token');
            sessionStorage.removeItem('admin_user');
        } catch (e) {}
    }

    function showLoginScreen() {
        document.getElementById('admin-login-overlay').style.display = 'flex';
        document.getElementById('admin-layout').style.display = 'none';
        // Reset login form state
        var errorEl = document.getElementById('admin-login-error');
        var passwordEl = document.getElementById('admin-password');
        if (errorEl) errorEl.textContent = '';
        if (passwordEl) passwordEl.value = '';
    }

    function showAdminPanel() {
        document.getElementById('admin-login-overlay').style.display = 'none';
        document.getElementById('admin-layout').style.display = '';
        var adminInfo = getStoredAdmin();
        var infoEl = document.getElementById('admin-user-info');
        if (infoEl && adminInfo) {
            infoEl.textContent = '管理员: ' + adminInfo.username;
        }
    }

    /**
     * Verify stored token against the server. Returns a Promise<boolean>.
     */
    function verifyTokenWithServer() {
        if (!adminToken) return Promise.resolve(false);
        return fetch(API_BASE + '?action=stats', {
            headers: { 'Authorization': 'Bearer ' + adminToken }
        }).then(function (r) {
            return r.status !== 401;
        }).catch(function () {
            return false;
        });
    }

    /**
     * Bind all panel event listeners once. Subsequent calls are no-ops.
     */
    function initPanelOnce() {
        if (_initialized) return;
        _initialized = true;
        initNavigation();
        initMobileMenu();
        initLogout();
    }

    /* ===================== 初始化 ===================== */
    document.addEventListener('DOMContentLoaded', function () {
        initLoginForm();

        // Check if already logged in
        adminToken = getStoredToken();
        if (adminToken) {
            // Verify token is still valid before showing panel
            showAdminPanel();
            initPanelOnce();
            verifyTokenWithServer().then(function (valid) {
                if (valid) {
                    loadPage('dashboard');
                } else {
                    adminToken = null;
                    clearSession();
                    showLoginScreen();
                }
            });
        } else {
            showLoginScreen();
        }
    });

    function initLoginForm() {
        var form = document.getElementById('admin-login-form');
        if (!form) return;
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            var username = document.getElementById('admin-username').value.trim();
            var password = document.getElementById('admin-password').value;
            var errorEl = document.getElementById('admin-login-error');
            var btn = document.getElementById('admin-login-btn');

            if (!username || !password) {
                errorEl.textContent = '请输入用户名和密码';
                return;
            }

            btn.disabled = true;
            btn.textContent = '登录中...';
            errorEl.textContent = '';

            fetch(API_BASE + '?action=admin_login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username, password: password })
            }).then(function (r) {
                return r.json().then(function (data) { return { status: r.status, data: data }; });
            }).then(function (result) {
                btn.disabled = false;
                btn.textContent = '登 录';
                if (result.data.success && result.data.token) {
                    adminToken = result.data.token;
                    storeSession(result.data.token, result.data.admin);
                    // Clear form fields on successful login
                    document.getElementById('admin-username').value = '';
                    document.getElementById('admin-password').value = '';
                    showAdminPanel();
                    initPanelOnce();
                    loadPage('dashboard');
                } else {
                    errorEl.textContent = result.data.error || '登录失败，请重试。';
                    // Clear password on failed attempt
                    document.getElementById('admin-password').value = '';
                    document.getElementById('admin-password').focus();
                }
            }).catch(function () {
                btn.disabled = false;
                btn.textContent = '登 录';
                errorEl.textContent = '网络错误，请稍后重试。';
            });
        });
    }

    function initLogout() {
        var btn = document.getElementById('admin-logout-btn');
        if (btn) {
            btn.addEventListener('click', function () {
                adminToken = null;
                clearSession();
                showLoginScreen();
            });
        }
    }

    /* ===================== 导航 ===================== */
    function initNavigation() {
        var links = document.querySelectorAll('.sidebar-nav a[data-page]');
        links.forEach(function (link) {
            link.addEventListener('click', function (e) {
                e.preventDefault();
                var page = this.getAttribute('data-page');
                loadPage(page);
                closeMobileMenu();
            });
        });
    }

    function loadPage(page) {
        currentPage = page;

        // 更新导航高亮
        document.querySelectorAll('.sidebar-nav a').forEach(function (a) {
            a.classList.toggle('active', a.getAttribute('data-page') === page);
        });

        // 更新页面标题
        var titles = {
            dashboard: '仪表盘',
            products: '商品管理',
            orders: '订单管理',
            users: '用户管理',
            categories: '分类管理',
            'login-logs': '登录日志'
        };
        document.getElementById('page-title').textContent = titles[page] || '仪表盘';

        // 显示对应的页面区块
        document.querySelectorAll('.page-section').forEach(function (s) {
            s.classList.toggle('active', s.id === 'section-' + page);
        });

        // 加载数据
        switch (page) {
            case 'dashboard':
                loadDashboard();
                break;
            case 'products':
                loadProducts(1);
                break;
            case 'orders':
                loadOrders(1);
                break;
            case 'users':
                loadUsers(1);
                break;
            case 'categories':
                loadCategories();
                break;
            case 'login-logs':
                loadLoginLogs(1);
                break;
        }
    }

    /* ===================== 移动端菜单 ===================== */
    function initMobileMenu() {
        var btn = document.getElementById('mobile-menu-btn');
        var overlay = document.getElementById('sidebar-overlay');
        if (btn) {
            btn.addEventListener('click', function () {
                document.querySelector('.admin-sidebar').classList.toggle('open');
                overlay.classList.toggle('active');
            });
        }
        if (overlay) {
            overlay.addEventListener('click', closeMobileMenu);
        }
    }

    function closeMobileMenu() {
        document.querySelector('.admin-sidebar').classList.remove('open');
        document.getElementById('sidebar-overlay').classList.remove('active');
    }

    /* ===================== API 请求 ===================== */
    function fetchAPI(params) {
        var qs = Object.keys(params).map(function (k) {
            return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
        }).join('&');

        var headers = {};
        if (adminToken) {
            headers['Authorization'] = 'Bearer ' + adminToken;
        }

        return fetch(API_BASE + '?' + qs, { headers: headers }).then(function (r) {
            if (r.status === 401) {
                // Token expired or invalid — force re-login
                adminToken = null;
                clearSession();
                showLoginScreen();
                throw new Error('认证已过期，请重新登录');
            }
            if (!r.ok) throw new Error('API 错误 ' + r.status);
            return r.json();
        });
    }

    function postAPI(action, body) {
        var headers = { 'Content-Type': 'application/json' };
        if (adminToken) {
            headers['Authorization'] = 'Bearer ' + adminToken;
        }

        return fetch(API_BASE + '?action=' + encodeURIComponent(action), {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
        }).then(function (r) {
            if (r.status === 401) {
                adminToken = null;
                clearSession();
                showLoginScreen();
                throw new Error('认证已过期，请重新登录');
            }
            if (!r.ok) throw new Error('API 错误 ' + r.status);
            return r.json();
        });
    }

    /* ===================== 仪表盘 ===================== */
    function loadDashboard() {
        var container = document.getElementById('dashboard-stats');
        container.innerHTML = '<div class="loading-spinner">加载中...</div>';

        fetchAPI({ action: 'stats' }).then(function (data) {
            renderDashboard(data);
        }).catch(function () {
            container.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>无法加载仪表盘数据，请检查数据库连接。</p></div>';
        });
    }

    function renderDashboard(data) {
        // 统计卡片
        document.getElementById('dashboard-stats').innerHTML =
            statCard('📦', 'blue', data.total_products, '商品总数') +
            statCard('🛒', 'green', data.total_orders, '订单总数') +
            statCard('👥', 'purple', data.total_users, '用户总数') +
            statCard('📂', 'teal', data.total_categories, '分类总数') +
            statCard('💰', 'orange', '$' + Number(data.total_revenue).toFixed(2), '总收入') +
            statCard('⏳', 'red', data.pending_orders, '待处理订单');

        // 最近订单
        var ordersHtml = '';
        if (data.recent_orders && data.recent_orders.length > 0) {
            ordersHtml = '<table class="admin-table"><thead><tr><th>订单号</th><th>邮箱</th><th>金额</th><th>状态</th><th>日期</th></tr></thead><tbody>';
            data.recent_orders.forEach(function (o) {
                ordersHtml += '<tr>' +
                    '<td>' + escapeHtml(o.order_id) + '</td>' +
                    '<td>' + escapeHtml(o.email) + '</td>' +
                    '<td>$' + Number(o.total).toFixed(2) + '</td>' +
                    '<td>' + statusBadge(o.status) + '</td>' +
                    '<td>' + formatDate(o.created_at) + '</td>' +
                    '</tr>';
            });
            ordersHtml += '</tbody></table>';
        } else {
            ordersHtml = '<div class="empty-state"><p>暂无订单</p></div>';
        }
        document.getElementById('recent-orders-body').innerHTML = ordersHtml;

        // 最近用户
        var usersHtml = '';
        if (data.recent_users && data.recent_users.length > 0) {
            usersHtml = '<table class="admin-table"><thead><tr><th>ID</th><th>邮箱</th><th>注册时间</th></tr></thead><tbody>';
            data.recent_users.forEach(function (u) {
                usersHtml += '<tr>' +
                    '<td>' + u.id + '</td>' +
                    '<td>' + escapeHtml(u.email) + '</td>' +
                    '<td>' + formatDate(u.created_at) + '</td>' +
                    '</tr>';
            });
            usersHtml += '</tbody></table>';
        } else {
            usersHtml = '<div class="empty-state"><p>暂无用户</p></div>';
        }
        document.getElementById('recent-users-body').innerHTML = usersHtml;
    }

    function statCard(icon, color, value, label) {
        return '<div class="stat-card">' +
            '<div class="stat-icon ' + color + '">' + icon + '</div>' +
            '<div class="stat-info"><h3>' + value + '</h3><p>' + label + '</p></div>' +
            '</div>';
    }

    /* ===================== 商品管理 ===================== */
    function loadProducts(page) {
        var body = document.getElementById('products-table-body');
        body.innerHTML = '<div class="loading-spinner">加载中...</div>';

        var params = { action: 'products', page: page };
        var searchInput = document.getElementById('product-search');
        if (searchInput && searchInput.value.trim()) {
            params.q = searchInput.value.trim();
        }

        fetchAPI(params).then(function (data) {
            renderProductsTable(data);
        }).catch(function () {
            body.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>无法加载商品数据。</p></div>';
        });
    }

    function renderProductsTable(data) {
        var body = document.getElementById('products-table-body');

        if (!data.items || data.items.length === 0) {
            body.innerHTML = '<div class="empty-state"><div class="empty-icon">📦</div><p>未找到商品</p></div>';
            document.getElementById('products-pagination').innerHTML = '';
            return;
        }

        var html = '<table class="admin-table"><thead><tr>' +
            '<th>图片</th><th>名称</th><th class="hide-mobile">SKU</th><th>价格</th><th>库存</th>' +
            '</tr></thead><tbody>';

        data.items.forEach(function (p) {
            var imgSrc = p.img1 || '';
            var stockClass = (p.stock <= LOW_STOCK_THRESHOLD) ? ' class="low-stock"' : '';
            html += '<tr>' +
                '<td>' + (imgSrc ? '<img class="product-thumb" src="' + escapeHtml(imgSrc) + '" alt="" loading="lazy">' : '—') + '</td>' +
                '<td>' + escapeHtml(p.name) + '</td>' +
                '<td class="hide-mobile">' + escapeHtml(p.sku || '—') + '</td>' +
                '<td>' + escapeHtml(p.price) + '</td>' +
                '<td' + stockClass + '>' + p.stock + (p.stock <= LOW_STOCK_THRESHOLD ? ' ⚠️' : '') + '</td>' +
                '</tr>';
        });

        html += '</tbody></table>';
        body.innerHTML = html;

        renderPagination('products-pagination', data.page, data.pages, function (pg) { loadProducts(pg); });
    }

    // 绑定商品搜索
    document.addEventListener('DOMContentLoaded', function () {
        var searchBtn = document.getElementById('product-search-btn');
        var searchInput = document.getElementById('product-search');
        if (searchBtn) {
            searchBtn.addEventListener('click', function () { loadProducts(1); });
        }
        if (searchInput) {
            searchInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') loadProducts(1);
            });
        }
    });

    /* ===================== 订单管理 ===================== */
    function loadOrders(page) {
        var body = document.getElementById('orders-table-body');
        body.innerHTML = '<div class="loading-spinner">加载中...</div>';

        var params = { action: 'orders', page: page };
        var statusFilter = document.getElementById('order-status-filter');
        if (statusFilter && statusFilter.value) {
            params.status = statusFilter.value;
        }

        fetchAPI(params).then(function (data) {
            renderOrdersTable(data);
        }).catch(function () {
            body.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>无法加载订单数据。</p></div>';
        });
    }

    function renderOrdersTable(data) {
        var body = document.getElementById('orders-table-body');

        if (!data.items || data.items.length === 0) {
            body.innerHTML = '<div class="empty-state"><div class="empty-icon">🛒</div><p>未找到订单</p></div>';
            document.getElementById('orders-pagination').innerHTML = '';
            return;
        }

        var html = '<table class="admin-table"><thead><tr>' +
            '<th>订单号</th><th>客户</th><th class="hide-mobile">邮箱</th><th>金额</th><th>状态</th><th class="hide-mobile">日期</th><th>操作</th>' +
            '</tr></thead><tbody>';

        data.items.forEach(function (o) {
            html += '<tr>' +
                '<td>' + escapeHtml(o.order_id) + '</td>' +
                '<td>' + escapeHtml((o.first_name || '') + ' ' + (o.last_name || '')) + '</td>' +
                '<td class="hide-mobile">' + escapeHtml(o.email) + '</td>' +
                '<td>$' + Number(o.total).toFixed(2) + '</td>' +
                '<td>' + statusBadge(o.status) + '</td>' +
                '<td class="hide-mobile">' + formatDate(o.created_at) + '</td>' +
                '<td>' +
                '<button class="filter-btn view-order-btn" data-order-id="' + escapeHtml(o.order_id) + '">查看</button> ' +
                '<button class="filter-btn delete-btn delete-order-btn" data-order-id="' + escapeHtml(o.order_id) + '">删除</button>' +
                '</td>' +
                '</tr>';
        });

        html += '</tbody></table>';
        body.innerHTML = html;

        // 绑定查看按钮
        body.querySelectorAll('.view-order-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                viewOrder(this.getAttribute('data-order-id'));
            });
        });

        // 绑定删除按钮
        body.querySelectorAll('.delete-order-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var orderId = this.getAttribute('data-order-id');
                if (confirm('确定要删除订单 ' + orderId + ' 吗？此操作不可撤销！')) {
                    deleteOrder(orderId);
                }
            });
        });

        renderPagination('orders-pagination', data.page, data.pages, function (pg) { loadOrders(pg); });
    }

    function deleteOrder(orderId) {
        postAPI('delete_order', { order_id: orderId }).then(function (data) {
            if (data.success) {
                loadOrders(1);
                if (currentPage === 'dashboard') loadDashboard();
            } else {
                alert(data.error || '删除失败');
            }
        }).catch(function () {
            alert('网络错误，删除失败');
        });
    }

    // 绑定订单状态筛选
    document.addEventListener('DOMContentLoaded', function () {
        var filter = document.getElementById('order-status-filter');
        if (filter) {
            filter.addEventListener('change', function () { loadOrders(1); });
        }
    });

    /* ===================== 订单详情弹窗 ===================== */
    function viewOrder(orderId) {
        var overlay = document.getElementById('order-modal');
        var body = document.getElementById('order-modal-body');
        overlay.classList.add('active');
        body.innerHTML = '<div class="loading-spinner">加载中...</div>';

        fetchAPI({ action: 'order_detail', id: orderId }).then(function (data) {
            var html = '';
            html += detailRow('订单号', escapeHtml(data.order_id));
            html += detailRow('状态', statusBadge(data.status));
            html += detailRow('客户姓名', escapeHtml((data.first_name || '') + ' ' + (data.last_name || '')));
            html += detailRow('邮箱', escapeHtml(data.email));
            html += detailRow('收货地址', escapeHtml([data.address, data.city, data.state, data.postcode].filter(Boolean).join(', ')));
            html += detailRow('订单金额', '$' + Number(data.total).toFixed(2));
            html += detailRow('创建时间', formatDate(data.created_at));

            // 订单状态更新
            html += '<div class="order-status-update">' +
                '<label>更新状态：</label>' +
                '<select id="order-status-select" class="filter-select">' +
                '<option value="pending"' + (data.status === 'pending' ? ' selected' : '') + '>待处理</option>' +
                '<option value="shipped"' + (data.status === 'shipped' ? ' selected' : '') + '>已发货</option>' +
                '<option value="completed"' + (data.status === 'completed' ? ' selected' : '') + '>已完成</option>' +
                '<option value="cancelled"' + (data.status === 'cancelled' ? ' selected' : '') + '>已取消</option>' +
                '</select>' +
                '<button class="filter-btn" id="update-status-btn">保存</button>' +
                '<span id="status-update-msg" class="status-msg"></span>' +
                '</div>';

            if (data.items && data.items.length > 0) {
                html += '<h3 style="margin:16px 0 8px;font-size:14px;font-weight:700;">订单商品</h3>';
                html += '<table class="admin-table"><thead><tr><th>商品名称</th><th>价格</th><th>数量</th></tr></thead><tbody>';
                data.items.forEach(function (item) {
                    html += '<tr><td>' + escapeHtml(item.product_name) + '</td><td>$' + Number(item.price).toFixed(2) + '</td><td>' + item.qty + '</td></tr>';
                });
                html += '</tbody></table>';
            }

            body.innerHTML = html;

            // 绑定状态更新按钮
            var updateBtn = document.getElementById('update-status-btn');
            if (updateBtn) {
                updateBtn.addEventListener('click', function () {
                    var newStatus = document.getElementById('order-status-select').value;
                    updateOrderStatus(data.order_id, newStatus);
                });
            }
        }).catch(function () {
            body.innerHTML = '<div class="empty-state"><p>无法加载订单详情。</p></div>';
        });
    }

    function updateOrderStatus(orderId, newStatus) {
        var msgEl = document.getElementById('status-update-msg');
        var btn = document.getElementById('update-status-btn');
        if (btn) btn.disabled = true;
        if (msgEl) msgEl.textContent = '保存中...';

        postAPI('update_order_status', { order_id: orderId, status: newStatus }).then(function (data) {
            if (data.success) {
                if (msgEl) {
                    msgEl.textContent = '✅ 状态已更新';
                    msgEl.className = 'status-msg success';
                }
                // 刷新订单列表
                if (currentPage === 'orders') loadOrders(1);
                if (currentPage === 'dashboard') loadDashboard();
            } else {
                if (msgEl) {
                    msgEl.textContent = '❌ 更新失败';
                    msgEl.className = 'status-msg error';
                }
            }
        }).catch(function () {
            if (msgEl) {
                msgEl.textContent = '❌ 网络错误';
                msgEl.className = 'status-msg error';
            }
        }).finally(function () {
            if (btn) btn.disabled = false;
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        var closeBtn = document.getElementById('order-modal-close');
        var overlay = document.getElementById('order-modal');
        if (closeBtn) {
            closeBtn.addEventListener('click', function () { overlay.classList.remove('active'); });
        }
        if (overlay) {
            overlay.addEventListener('click', function (e) {
                if (e.target === overlay) overlay.classList.remove('active');
            });
        }
    });

    function detailRow(label, value) {
        return '<div class="detail-row"><div class="detail-label">' + label + '</div><div class="detail-value">' + value + '</div></div>';
    }

    /* ===================== 用户管理 ===================== */
    function loadUsers(page) {
        var body = document.getElementById('users-table-body');
        body.innerHTML = '<div class="loading-spinner">加载中...</div>';

        fetchAPI({ action: 'users', page: page }).then(function (data) {
            renderUsersTable(data);
        }).catch(function () {
            body.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>无法加载用户数据。</p></div>';
        });
    }

    function renderUsersTable(data) {
        var body = document.getElementById('users-table-body');

        if (!data.items || data.items.length === 0) {
            body.innerHTML = '<div class="empty-state"><div class="empty-icon">👥</div><p>暂无用户</p></div>';
            document.getElementById('users-pagination').innerHTML = '';
            return;
        }

        var html = '<table class="admin-table"><thead><tr>' +
            '<th>ID</th><th>邮箱</th><th class="hide-mobile">注册IP</th><th>订单数</th><th class="hide-mobile">登录次数</th><th>注册时间</th><th>操作</th>' +
            '</tr></thead><tbody>';

        data.items.forEach(function (u) {
            html += '<tr>' +
                '<td>' + u.id + '</td>' +
                '<td>' + escapeHtml(u.email) + '</td>' +
                '<td class="hide-mobile">' + escapeHtml(u.register_ip || '—') + '</td>' +
                '<td>' + u.order_count + '</td>' +
                '<td class="hide-mobile">' + u.login_count + '</td>' +
                '<td>' + formatDate(u.created_at) + '</td>' +
                '<td><button class="filter-btn delete-btn delete-user-btn" data-user-id="' + u.id + '" data-user-email="' + escapeHtml(u.email) + '">删除</button></td>' +
                '</tr>';
        });

        html += '</tbody></table>';
        body.innerHTML = html;

        // 绑定删除按钮
        body.querySelectorAll('.delete-user-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var userId = this.getAttribute('data-user-id');
                var userEmail = this.getAttribute('data-user-email');
                if (confirm('确定要删除用户 ' + userEmail + ' (ID: ' + userId + ') 吗？\n该用户的所有相关数据（购物车、浏览记录、地址等）也将被删除！')) {
                    deleteUser(userId);
                }
            });
        });

        renderPagination('users-pagination', data.page, data.pages, function (pg) { loadUsers(pg); });
    }

    function deleteUser(userId) {
        postAPI('delete_user', { user_id: parseInt(userId, 10) }).then(function (data) {
            if (data.success) {
                loadUsers(1);
                if (currentPage === 'dashboard') loadDashboard();
            } else {
                alert(data.error || '删除失败');
            }
        }).catch(function () {
            alert('网络错误，删除失败');
        });
    }

    /* ===================== 分类管理 ===================== */
    function loadCategories() {
        var body = document.getElementById('categories-table-body');
        body.innerHTML = '<div class="loading-spinner">加载中...</div>';

        fetchAPI({ action: 'categories' }).then(function (data) {
            renderCategoriesTable(data);
        }).catch(function () {
            body.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>无法加载分类数据。</p></div>';
        });
    }

    function renderCategoriesTable(data) {
        var body = document.getElementById('categories-table-body');

        if (!data || data.length === 0) {
            body.innerHTML = '<div class="empty-state"><div class="empty-icon">📂</div><p>暂无分类</p></div>';
            return;
        }

        var html = '<table class="admin-table"><thead><tr>' +
            '<th>ID</th><th>名称</th><th>标识</th><th>商品数量</th>' +
            '</tr></thead><tbody>';

        data.forEach(function (c) {
            html += '<tr>' +
                '<td>' + c.id + '</td>' +
                '<td>' + escapeHtml(c.name) + '</td>' +
                '<td>' + escapeHtml(c.slug) + '</td>' +
                '<td>' + (c.actual_count || c.product_count || 0) + '</td>' +
                '</tr>';
        });

        html += '</tbody></table>';
        body.innerHTML = html;
    }

    /* ===================== 登录日志 ===================== */
    function loadLoginLogs(page) {
        var body = document.getElementById('login-logs-table-body');
        body.innerHTML = '<div class="loading-spinner">加载中...</div>';

        fetchAPI({ action: 'login_logs', page: page }).then(function (data) {
            renderLoginLogsTable(data);
        }).catch(function () {
            body.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>无法加载登录日志。</p></div>';
        });
    }

    function renderLoginLogsTable(data) {
        var body = document.getElementById('login-logs-table-body');

        if (!data.items || data.items.length === 0) {
            body.innerHTML = '<div class="empty-state"><div class="empty-icon">🔐</div><p>暂无登录记录</p></div>';
            document.getElementById('login-logs-pagination').innerHTML = '';
            return;
        }

        var html = '<table class="admin-table"><thead><tr>' +
            '<th>ID</th><th>用户ID</th><th>邮箱</th><th>IP地址</th><th class="hide-mobile">浏览器</th><th>登录时间</th>' +
            '</tr></thead><tbody>';

        data.items.forEach(function (log) {
            var shortUA = log.user_agent || '—';
            if (shortUA.length > 60) shortUA = shortUA.substring(0, 60) + '…';
            html += '<tr>' +
                '<td>' + log.id + '</td>' +
                '<td>' + log.user_id + '</td>' +
                '<td>' + escapeHtml(log.email || '—') + '</td>' +
                '<td>' + escapeHtml(log.ip_address) + '</td>' +
                '<td class="hide-mobile" title="' + escapeHtml(log.user_agent || '') + '">' + escapeHtml(shortUA) + '</td>' +
                '<td>' + formatDate(log.login_at) + '</td>' +
                '</tr>';
        });

        html += '</tbody></table>';
        body.innerHTML = html;

        renderPagination('login-logs-pagination', data.page, data.pages, function (pg) { loadLoginLogs(pg); });
    }

    /* ===================== 分页组件 ===================== */
    function renderPagination(containerId, current, total, loadFn) {
        var container = document.getElementById(containerId);
        if (!container || total <= 1) {
            if (container) container.innerHTML = '';
            return;
        }

        var html = '';
        html += '<button ' + (current <= 1 ? 'disabled' : '') + ' data-page="' + (current - 1) + '">‹ 上一页</button>';

        var start = Math.max(1, current - 2);
        var end = Math.min(total, current + 2);
        for (var i = start; i <= end; i++) {
            html += '<button class="' + (i === current ? 'active' : '') + '" data-page="' + i + '">' + i + '</button>';
        }

        html += '<span class="page-info">第 ' + current + ' / ' + total + ' 页</span>';
        html += '<button ' + (current >= total ? 'disabled' : '') + ' data-page="' + (current + 1) + '">下一页 ›</button>';

        container.innerHTML = html;

        container.querySelectorAll('button[data-page]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var pg = parseInt(this.getAttribute('data-page'), 10);
                if (pg >= 1 && pg <= total) loadFn(pg);
            });
        });
    }

    /* ===================== 工具函数 ===================== */
    function escapeHtml(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    var STATUS_MAP = {
        pending: '待处理',
        completed: '已完成',
        shipped: '已发货',
        cancelled: '已取消'
    };

    function statusBadge(status) {
        var cls = 'badge-pending';
        if (status === 'completed') cls = 'badge-completed';
        else if (status === 'shipped') cls = 'badge-shipped';
        else if (status === 'cancelled') cls = 'badge-cancelled';
        var label = STATUS_MAP[status] || status || '待处理';
        return '<span class="badge ' + cls + '">' + escapeHtml(label) + '</span>';
    }

    function formatDate(dateStr) {
        if (!dateStr) return '—';
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.getFullYear() + '-' +
            String(d.getMonth() + 1).padStart(2, '0') + '-' +
            String(d.getDate()).padStart(2, '0') + ' ' +
            String(d.getHours()).padStart(2, '0') + ':' +
            String(d.getMinutes()).padStart(2, '0');
    }
})();
