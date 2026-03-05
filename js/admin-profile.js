/**
 * InternTrack — Admin Profile Logic
 * Displays admin's own profile with live stats, intern roster, recent projects.
 */

'use strict';

(() => {
    // Guard: admin only
    const session = Auth.requireAuth(['admin']);
    if (!session) return;

    setupSidebar(session, 'admin-profile.html');

    // Logout
    document.getElementById('logout-btn').addEventListener('click', () => Auth.logout());

    // ── Populate admin info ──
    const adminProfile = Storage.getAdminProfile ? Storage.getAdminProfile(session.userId) : null;
    const displayName = adminProfile?.name || session.displayName || 'Admin';
    const email = session.email || '';

    setEl('admin-display-name', displayName);
    setEl('admin-avatar', displayName[0].toUpperCase());
    setEl('admin-email', email);
    setEl('info-email', email);

    // Session time
    if (session.loginTime) {
        const loginDate = new Date(session.loginTime);
        setEl('info-session', loginDate.toLocaleString('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        }));
    }

    // ── Name editor ──
    const nameField = document.getElementById('name-edit-field');
    const nameSaveBtn = document.getElementById('name-save-btn');
    if (nameField) nameField.value = displayName;

    if (nameSaveBtn) {
        nameSaveBtn.addEventListener('click', () => {
            const newName = nameField.value.trim();
            if (!newName) { showToast('Name cannot be empty.', 'error'); return; }

            // Update session in storage
            const updatedSession = { ...session, displayName: newName };
            sessionStorage.setItem('interntrack_session', JSON.stringify(updatedSession));
            localStorage.setItem('interntrack_session', JSON.stringify(updatedSession));

            // Update header
            setEl('admin-display-name', newName);
            setEl('admin-avatar', newName[0].toUpperCase());
            setEl('user-name-sidebar', newName);
            const sideAvatar = document.getElementById('user-avatar-sidebar');
            if (sideAvatar) sideAvatar.textContent = newName[0].toUpperCase();

            nameSaveBtn.textContent = '✓ Saved';
            nameSaveBtn.style.color = 'var(--clr-success, #10b981)';
            showToast('Display name updated!', 'success');
            setTimeout(() => {
                nameSaveBtn.textContent = 'Save';
                nameSaveBtn.style.color = '';
            }, 2000);
        });

        // Allow Enter key in field
        nameField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') nameSaveBtn.click();
        });
    }

    // ── Compute & render stats ──
    const profiles = Storage.getProfiles();
    const allProfiles = Object.values(profiles);
    const projects = Storage.getProjects();

    const totalStudents = allProfiles.length;
    const totalSkills = allProfiles.reduce((acc, p) => acc + (p.skills?.length || 0), 0);
    const companies = new Set(allProfiles.map(p => p.internship?.company).filter(Boolean));
    const totalCompanies = companies.size;

    // Animate counters
    animateCounter('stat-students', totalStudents, 0);
    animateCounter('stat-skills', totalSkills, 100);
    animateCounter('stat-companies', totalCompanies, 200);

    // ── Intern Roster ──
    const rosterEl = document.getElementById('student-roster');
    if (rosterEl) {
        if (allProfiles.length === 0) {
            rosterEl.innerHTML = '<p class="text-muted text-sm">No intern profiles yet.</p>';
        } else {
            rosterEl.innerHTML = allProfiles.map(p => {
                const initials = (p.name || '?')[0].toUpperCase();
                const role = p.internship?.role || 'Intern';
                const company = p.internship?.company || 'Not assigned';
                const avatarHtml = p.avatar
                    ? `<div class="student-list-avatar"><img src="${p.avatar}" alt="${p.name} avatar"></div>`
                    : `<div class="student-list-avatar">${initials}</div>`;
                return `
                <div class="student-list-item" style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--glass-border, rgba(255,255,255,0.07))">
                    ${avatarHtml}
                    <div class="student-list-info" style="flex:1;min-width:0">
                        <div class="student-list-name">${p.name || 'Unnamed'}</div>
                        <div class="student-list-role">${role} · ${company}</div>
                    </div>
                    <div style="display:flex;gap:6px;flex-shrink:0">
                        <a href="student-analytics.html?student=${p.userId}" class="btn btn-secondary btn-sm" title="View analytics" aria-label="View analytics for ${p.name}" style="padding:4px 10px">📊</a>
                        <a href="profile-builder.html?student=${p.userId}" class="btn btn-primary btn-sm" title="Edit profile" aria-label="Edit profile for ${p.name}" style="padding:4px 10px">✏️</a>
                    </div>
                </div>`;
            }).join('');
        }
    }

    // ── Recent Projects Removed ──

    // ── Scroll Reveal ──
    initReveal();

    // ─────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────

    function setEl(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    function animateCounter(id, target, delay = 0) {
        const el = document.getElementById(id);
        if (!el) return;
        setTimeout(() => {
            let current = 0;
            const step = Math.ceil(target / 30);
            const interval = setInterval(() => {
                current = Math.min(current + step, target);
                el.textContent = current;
                if (current >= target) clearInterval(interval);
            }, 30);
        }, delay);
    }

    function initReveal() {
        const els = document.querySelectorAll('.reveal');
        const obs = new IntersectionObserver((entries) => {
            entries.forEach(e => {
                if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }
            });
        }, { threshold: 0.08 });
        els.forEach(el => obs.observe(el));
    }

    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const icons = { success: '✅', error: '❌', info: 'ℹ️' };
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<span class="toast-icon" aria-hidden="true">${icons[type]}</span><span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-12px)';
            toast.style.transition = 'all .3s ease';
            setTimeout(() => toast.remove(), 350);
        }, 3000);
    }

    // ── Sidebar ──
    function setupSidebar(session, activePage) {
        const nav = document.getElementById('sidebar-nav');
        const avatar = document.getElementById('user-avatar-sidebar');
        const nameEl = document.getElementById('user-name-sidebar');
        const roleEl = document.getElementById('user-role-sidebar');

        const isAdmin = session.role === 'admin';
        const p = isAdmin ? (Storage.getAdminProfile ? Storage.getAdminProfile(session.userId) : null) : Storage.getProfile(session.userId);
        const currentName = p?.name || session.displayName;

        if (avatar) avatar.textContent = currentName[0].toUpperCase();
        if (nameEl) nameEl.textContent = currentName;
        if (roleEl) roleEl.textContent = 'Administrator';

        const items = [
            { label: 'Dashboard', href: 'dashboard.html', icon: '⊞' },
            { label: 'My Profile', href: 'admin-profile.html', icon: '👤', active: activePage === 'admin-profile.html' },
            { label: 'Interns', href: 'students.html', icon: '👥' },
            { label: 'Projects', href: 'projects.html', icon: '🗂️' },
        ];

        if (nav) {
            nav.innerHTML = '<div class="nav-section-label">Menu</div>' +
                items.map(item => `
                <a class="nav-item${item.href === activePage ? ' active' : ''}" href="${item.href}" aria-current="${item.href === activePage ? 'page' : 'false'}">
                    <span class="nav-icon" aria-hidden="true">${item.icon}</span>
                    <span>${item.label}</span>
                </a>`).join('');
        }

        const hamburger = document.getElementById('hamburger-btn');
        const sidebar = document.getElementById('app-sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (hamburger && sidebar && overlay) {
            hamburger.addEventListener('click', () => {
                const open = sidebar.classList.toggle('open');
                overlay.classList.toggle('visible', open);
                hamburger.setAttribute('aria-expanded', String(open));
            });
            overlay.addEventListener('click', () => {
                sidebar.classList.remove('open');
                overlay.classList.remove('visible');
                hamburger.setAttribute('aria-expanded', 'false');
            });
        }
    }

})();
