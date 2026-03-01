/**
 * Admin Panel JavaScript
 * Handles page navigation, data fetching, and UI rendering
 */
(function () {
    'use strict';

    var API_BASE = '/api/admin.php';
    var currentPage = 'dashboard';

    /* ===================== Initialization ===================== */
    document.addEventListener('DOMContentLoaded', function () {
        initNavigation();
        initMobileMenu();
        loadPage('dashboard');
    });

    /* ===================== Navigation ===================== */
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

        // Update active nav
        document.querySelectorAll('.sidebar-nav a').forEach(function (a) {
            a.classList.toggle('active', a.getAttribute('data-page') === page);
        });

        // Update page title
        var titles = {
            dashboard: 'Dashboard',
            products: 'Products',
            orders: 'Orders',
            users: 'Users',
            categories: 'Categories'
        };
        document.getElementById('page-title').textContent = titles[page] || 'Dashboard';

        // Show correct section
        document.querySelectorAll('.page-section').forEach(function (s) {
            s.classList.toggle('active', s.id === 'section-' + page);
        });

        // Load data
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
        }
    }

    /* ===================== Mobile Menu ===================== */
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

    /* ===================== API Helper ===================== */
    function fetchAPI(params) {
        var qs = Object.keys(params).map(function (k) {
            return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
        }).join('&');
        return fetch(API_BASE + '?' + qs).then(function (r) {
            if (!r.ok) throw new Error('API error ' + r.status);
            return r.json();
        });
    }

    /* ===================== Dashboard ===================== */
    function loadDashboard() {
        var container = document.getElementById('dashboard-stats');
        container.innerHTML = '<div class="loading-spinner">Loading...</div>';

        fetchAPI({ action: 'stats' }).then(function (data) {
            renderDashboard(data);
        }).catch(function () {
            container.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>Unable to load dashboard data. Check database connection.</p></div>';
        });
    }

    function renderDashboard(data) {
        // Stats cards
        document.getElementById('dashboard-stats').innerHTML =
            statCard('📦', 'blue', data.total_products, 'Total Products') +
            statCard('🛒', 'green', data.total_orders, 'Total Orders') +
            statCard('👥', 'purple', data.total_users, 'Total Users') +
            statCard('📂', 'teal', data.total_categories, 'Categories') +
            statCard('💰', 'orange', '$' + Number(data.total_revenue).toFixed(2), 'Total Revenue') +
            statCard('⏳', 'red', data.pending_orders, 'Pending Orders');

        // Recent orders
        var ordersHtml = '';
        if (data.recent_orders && data.recent_orders.length > 0) {
            ordersHtml = '<table class="admin-table"><thead><tr><th>Order ID</th><th>Email</th><th>Total</th><th>Status</th><th>Date</th></tr></thead><tbody>';
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
            ordersHtml = '<div class="empty-state"><p>No orders yet</p></div>';
        }
        document.getElementById('recent-orders-body').innerHTML = ordersHtml;

        // Recent users
        var usersHtml = '';
        if (data.recent_users && data.recent_users.length > 0) {
            usersHtml = '<table class="admin-table"><thead><tr><th>ID</th><th>Email</th><th>Registered</th></tr></thead><tbody>';
            data.recent_users.forEach(function (u) {
                usersHtml += '<tr>' +
                    '<td>' + u.id + '</td>' +
                    '<td>' + escapeHtml(u.email) + '</td>' +
                    '<td>' + formatDate(u.created_at) + '</td>' +
                    '</tr>';
            });
            usersHtml += '</tbody></table>';
        } else {
            usersHtml = '<div class="empty-state"><p>No users yet</p></div>';
        }
        document.getElementById('recent-users-body').innerHTML = usersHtml;
    }

    function statCard(icon, color, value, label) {
        return '<div class="stat-card">' +
            '<div class="stat-icon ' + color + '">' + icon + '</div>' +
            '<div class="stat-info"><h3>' + value + '</h3><p>' + label + '</p></div>' +
            '</div>';
    }

    /* ===================== Products ===================== */
    function loadProducts(page) {
        var body = document.getElementById('products-table-body');
        body.innerHTML = '<div class="loading-spinner">Loading...</div>';

        var params = { action: 'products', page: page };
        var searchInput = document.getElementById('product-search');
        if (searchInput && searchInput.value.trim()) {
            params.q = searchInput.value.trim();
        }

        fetchAPI(params).then(function (data) {
            renderProductsTable(data);
        }).catch(function () {
            body.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>Unable to load products.</p></div>';
        });
    }

    function renderProductsTable(data) {
        var body = document.getElementById('products-table-body');

        if (!data.items || data.items.length === 0) {
            body.innerHTML = '<div class="empty-state"><div class="empty-icon">📦</div><p>No products found</p></div>';
            document.getElementById('products-pagination').innerHTML = '';
            return;
        }

        var html = '<table class="admin-table"><thead><tr>' +
            '<th>Image</th><th>Name</th><th class="hide-mobile">SKU</th><th>Price</th><th>Stock</th>' +
            '</tr></thead><tbody>';

        data.items.forEach(function (p) {
            var imgSrc = p.img1 || '';
            html += '<tr>' +
                '<td>' + (imgSrc ? '<img class="product-thumb" src="' + escapeHtml(imgSrc) + '" alt="" loading="lazy">' : '—') + '</td>' +
                '<td>' + escapeHtml(p.name) + '</td>' +
                '<td class="hide-mobile">' + escapeHtml(p.sku || '—') + '</td>' +
                '<td>' + escapeHtml(p.price) + '</td>' +
                '<td>' + p.stock + '</td>' +
                '</tr>';
        });

        html += '</tbody></table>';
        body.innerHTML = html;

        renderPagination('products-pagination', data.page, data.pages, function (pg) { loadProducts(pg); });
    }

    // Bind product search
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

    /* ===================== Orders ===================== */
    function loadOrders(page) {
        var body = document.getElementById('orders-table-body');
        body.innerHTML = '<div class="loading-spinner">Loading...</div>';

        var params = { action: 'orders', page: page };
        var statusFilter = document.getElementById('order-status-filter');
        if (statusFilter && statusFilter.value) {
            params.status = statusFilter.value;
        }

        fetchAPI(params).then(function (data) {
            renderOrdersTable(data);
        }).catch(function () {
            body.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>Unable to load orders.</p></div>';
        });
    }

    function renderOrdersTable(data) {
        var body = document.getElementById('orders-table-body');

        if (!data.items || data.items.length === 0) {
            body.innerHTML = '<div class="empty-state"><div class="empty-icon">🛒</div><p>No orders found</p></div>';
            document.getElementById('orders-pagination').innerHTML = '';
            return;
        }

        var html = '<table class="admin-table"><thead><tr>' +
            '<th>Order ID</th><th>Customer</th><th class="hide-mobile">Email</th><th>Total</th><th>Status</th><th class="hide-mobile">Date</th><th>Detail</th>' +
            '</tr></thead><tbody>';

        data.items.forEach(function (o) {
            html += '<tr>' +
                '<td>' + escapeHtml(o.order_id) + '</td>' +
                '<td>' + escapeHtml((o.first_name || '') + ' ' + (o.last_name || '')) + '</td>' +
                '<td class="hide-mobile">' + escapeHtml(o.email) + '</td>' +
                '<td>$' + Number(o.total).toFixed(2) + '</td>' +
                '<td>' + statusBadge(o.status) + '</td>' +
                '<td class="hide-mobile">' + formatDate(o.created_at) + '</td>' +
                '<td><button class="filter-btn view-order-btn" data-order-id="' + escapeHtml(o.order_id) + '">View</button></td>' +
                '</tr>';
        });

        html += '</tbody></table>';
        body.innerHTML = html;

        // Bind view buttons via event delegation
        body.querySelectorAll('.view-order-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                window._viewOrder(this.getAttribute('data-order-id'));
            });
        });

        renderPagination('orders-pagination', data.page, data.pages, function (pg) { loadOrders(pg); });
    }

    // Bind order status filter
    document.addEventListener('DOMContentLoaded', function () {
        var filter = document.getElementById('order-status-filter');
        if (filter) {
            filter.addEventListener('change', function () { loadOrders(1); });
        }
    });

    /* ===================== Order Detail Modal ===================== */
    window._viewOrder = function (orderId) {
        var overlay = document.getElementById('order-modal');
        var body = document.getElementById('order-modal-body');
        overlay.classList.add('active');
        body.innerHTML = '<div class="loading-spinner">Loading...</div>';

        fetchAPI({ action: 'order_detail', id: orderId }).then(function (data) {
            var html = '';
            html += detailRow('Order ID', data.order_id);
            html += detailRow('Status', statusBadge(data.status));
            html += detailRow('Customer', escapeHtml((data.first_name || '') + ' ' + (data.last_name || '')));
            html += detailRow('Email', escapeHtml(data.email));
            html += detailRow('Address', escapeHtml([data.address, data.city, data.state, data.postcode].filter(Boolean).join(', ')));
            html += detailRow('Total', '$' + Number(data.total).toFixed(2));
            html += detailRow('Created', formatDate(data.created_at));

            if (data.items && data.items.length > 0) {
                html += '<h3 style="margin:16px 0 8px;font-size:14px;font-weight:700;">Order Items</h3>';
                html += '<table class="admin-table"><thead><tr><th>Product</th><th>Price</th><th>Qty</th></tr></thead><tbody>';
                data.items.forEach(function (item) {
                    html += '<tr><td>' + escapeHtml(item.product_name) + '</td><td>$' + Number(item.price).toFixed(2) + '</td><td>' + item.qty + '</td></tr>';
                });
                html += '</tbody></table>';
            }

            body.innerHTML = html;
        }).catch(function () {
            body.innerHTML = '<div class="empty-state"><p>Unable to load order details.</p></div>';
        });
    };

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

    /* ===================== Users ===================== */
    function loadUsers(page) {
        var body = document.getElementById('users-table-body');
        body.innerHTML = '<div class="loading-spinner">Loading...</div>';

        fetchAPI({ action: 'users', page: page }).then(function (data) {
            renderUsersTable(data);
        }).catch(function () {
            body.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>Unable to load users.</p></div>';
        });
    }

    function renderUsersTable(data) {
        var body = document.getElementById('users-table-body');

        if (!data.items || data.items.length === 0) {
            body.innerHTML = '<div class="empty-state"><div class="empty-icon">👥</div><p>No users found</p></div>';
            document.getElementById('users-pagination').innerHTML = '';
            return;
        }

        var html = '<table class="admin-table"><thead><tr>' +
            '<th>ID</th><th>Email</th><th class="hide-mobile">Register IP</th><th>Orders</th><th class="hide-mobile">Logins</th><th>Registered</th>' +
            '</tr></thead><tbody>';

        data.items.forEach(function (u) {
            html += '<tr>' +
                '<td>' + u.id + '</td>' +
                '<td>' + escapeHtml(u.email) + '</td>' +
                '<td class="hide-mobile">' + escapeHtml(u.register_ip || '—') + '</td>' +
                '<td>' + u.order_count + '</td>' +
                '<td class="hide-mobile">' + u.login_count + '</td>' +
                '<td>' + formatDate(u.created_at) + '</td>' +
                '</tr>';
        });

        html += '</tbody></table>';
        body.innerHTML = html;

        renderPagination('users-pagination', data.page, data.pages, function (pg) { loadUsers(pg); });
    }

    /* ===================== Categories ===================== */
    function loadCategories() {
        var body = document.getElementById('categories-table-body');
        body.innerHTML = '<div class="loading-spinner">Loading...</div>';

        fetchAPI({ action: 'categories' }).then(function (data) {
            renderCategoriesTable(data);
        }).catch(function () {
            body.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>Unable to load categories.</p></div>';
        });
    }

    function renderCategoriesTable(data) {
        var body = document.getElementById('categories-table-body');

        if (!data || data.length === 0) {
            body.innerHTML = '<div class="empty-state"><div class="empty-icon">📂</div><p>No categories found</p></div>';
            return;
        }

        var html = '<table class="admin-table"><thead><tr>' +
            '<th>ID</th><th>Name</th><th>Slug</th><th>Products</th>' +
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

    /* ===================== Pagination Helper ===================== */
    function renderPagination(containerId, current, total, loadFn) {
        var container = document.getElementById(containerId);
        if (!container || total <= 1) {
            if (container) container.innerHTML = '';
            return;
        }

        var html = '';
        html += '<button ' + (current <= 1 ? 'disabled' : '') + ' data-page="' + (current - 1) + '">‹ Prev</button>';

        var start = Math.max(1, current - 2);
        var end = Math.min(total, current + 2);
        for (var i = start; i <= end; i++) {
            html += '<button class="' + (i === current ? 'active' : '') + '" data-page="' + i + '">' + i + '</button>';
        }

        html += '<span class="page-info">' + current + ' / ' + total + '</span>';
        html += '<button ' + (current >= total ? 'disabled' : '') + ' data-page="' + (current + 1) + '">Next ›</button>';

        container.innerHTML = html;

        container.querySelectorAll('button[data-page]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var pg = parseInt(this.getAttribute('data-page'), 10);
                if (pg >= 1 && pg <= total) loadFn(pg);
            });
        });
    }

    /* ===================== Utility ===================== */
    function escapeHtml(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    function statusBadge(status) {
        var cls = 'badge-pending';
        if (status === 'completed') cls = 'badge-completed';
        else if (status === 'shipped') cls = 'badge-shipped';
        else if (status === 'cancelled') cls = 'badge-cancelled';
        return '<span class="badge ' + cls + '">' + escapeHtml(status || 'pending') + '</span>';
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
