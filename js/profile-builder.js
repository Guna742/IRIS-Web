/**
 * InternTrack — Profile Builder Logic (Admin Only)
 * Accordion UI, tag chip input, avatar upload, save to localStorage.
 */

'use strict';

(() => {
    // Guard: admin only
    const session = Auth.requireAuth(['admin']);
    if (!session) return;

    // ── Sidebar setup (shared pattern) ──
    setupSidebar(session, 'profile-builder.html');

    // ── DOM refs ──
    const saveBtn = document.getElementById('save-btn');
    const saveStatus = document.getElementById('save-status');
    const saveStatusText = document.getElementById('save-status-text');
    const saveStatusIcon = document.getElementById('save-status-icon');

    const logoutBtn = document.getElementById('logout-btn');
    const studentSelector = document.getElementById('student-selector');
    const addStudentBtn = document.getElementById('add-student-btn');

    // ── Logout ──
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => Auth.logout());
    }

    // ── Info button dropdown ──
    const infoBtn = document.getElementById('info-btn');
    if (infoBtn) {
        infoBtn.addEventListener('click', () => {
            IrisModal.alert('Profile Builder — Create and manage intern portfolio profiles. Fill in the fields and click Save Profile.', 'Help');
        });
    }

    // ── Credential Modal Refs ──
    const credModal = document.getElementById('credential-modal');
    const modalPass = document.getElementById('modal-password');
    const modalCancel = document.getElementById('modal-cancel-btn');
    const modalConfirm = document.getElementById('modal-confirm-btn');

    // ── Multi-profile State ──
    let allProfiles = Storage.getProfiles();
    // Support deep-link: profile-builder.html?student=userId
    const urlStudentId = new URLSearchParams(window.location.search).get('student');
    let currentStudentId = (urlStudentId && allProfiles[urlStudentId])
        ? urlStudentId
        : (Object.keys(allProfiles)[0] || 'u_intern1');
    let profile = allProfiles[currentStudentId] || {};
    let skills = [...(profile.skills || [])];

    // ── Init ──
    initStudentSelector();
    populateForm(profile);

    function initStudentSelector() {
        if (!studentSelector) return;
        studentSelector.innerHTML = Object.values(allProfiles).map(p =>
            `<option value="${p.userId}" ${p.userId === currentStudentId ? 'selected' : ''}>${p.name || p.userId}</option>`
        ).join('');

        studentSelector.addEventListener('change', async (e) => {
            if (!(await IrisModal.confirm('Switch student? Unsaved changes for the current student will be lost.'))) {
                studentSelector.value = currentStudentId;
                return;
            }
            currentStudentId = e.target.value;
            profile = allProfiles[currentStudentId];
            skills = [...(profile.skills || [])];
            populateForm(profile);
            markSaved(); // Reset status
        });
    }

    if (addStudentBtn) {
        addStudentBtn.addEventListener('click', async () => {
            const name = await IrisModal.prompt('Enter new student name:');
            if (!name) return;
            const email = await IrisModal.prompt('Enter intern email address:');
            if (!email) return;

            const id = 'u_' + Date.now();
            const newProfile = {
                userId: id,
                name: name,
                email: email.trim().toLowerCase(),
                tagline: '',
                bio: '',
                skills: [],
                internship: {},
                socialLinks: {},
                _isNew: true // Flag to trigger credential capture on Save
            };
            allProfiles[id] = newProfile;
            Storage.saveProfile(id, newProfile);

            // Switch to new student
            currentStudentId = id;
            allProfiles = Storage.getProfiles();
            initStudentSelector();
            profile = allProfiles[currentStudentId];
            skills = [];
            populateForm(profile);
            showToast(`Created draft for ${name}`, 'success');
        });
    }

    function populateForm(p) {
        if (!p) return;
        // Personal
        getField('name').value = p.name || '';
        getField('email').value = p.email || '';
        getField('tagline').value = p.tagline || '';
        getField('location').value = p.location || '';
        getField('bio').value = p.bio || '';
        getField('github').value = p.socialLinks?.github || '';
        getField('linkedin').value = p.socialLinks?.linkedin || '';
        // Internship
        const i = p.internship || {};
        getField('company').value = i.company || '';
        getField('role').value = i.role || '';
        getField('start').value = i.startDate || '';
        getField('intern-desc').value = i.description || '';
    }

    function getField(id) { return document.getElementById('field-' + id); }




    // ── Change detection ──
    function markSaved() {
        saveStatus.classList.remove('saved');
        saveStatusIcon.textContent = 'check_circle';
        saveStatusIcon.classList.add('material-symbols-outlined');
        saveStatusText.textContent = 'All changes saved';
    }

    function markUnsaved() {
        saveStatus.classList.remove('saved');
        saveStatusIcon.textContent = 'save';
        saveStatusIcon.classList.add('material-symbols-outlined');
        saveStatusText.textContent = 'Unsaved changes';
    }
    document.querySelectorAll('.field-input').forEach(el => {
        el.addEventListener('input', markUnsaved);
    });

    // ── Save ──
    saveBtn.addEventListener('click', async () => {
        const p = {
            ...profile,
            name: getField('name').value.trim(),
            email: getField('email').value.trim(),
            tagline: getField('tagline').value.trim(),
            location: getField('location').value.trim(),
            bio: getField('bio').value.trim(),
            skills: [...skills],
            socialLinks: {
                github: getField('github').value.trim(),
                linkedin: getField('linkedin').value.trim(),
            },
            internship: {
                company: getField('company').value.trim(),
                role: getField('role').value.trim(),
                startDate: getField('start').value,
                description: getField('intern-desc').value.trim(),
                technologies: skills.slice(0, 4),
            }
        };

        // If it's a new intern, we need account creation
        if (p._isNew) {
            const password = await showCredentialModal();
            if (!password) {
                showToast('Creation cancelled. Profile not saved to cloud.', 'info');
                return;
            }

            saveStatusText.textContent = 'Creating cloud account...';
            const result = await Storage.createInternAccount(p, password);
            if (!result.success) {
                showToast('Firebase Error: ' + result.error, 'error');
                saveStatusText.textContent = 'Account failed';
                return;
            }

            // Re-fetch since createInternAccount changes UID
            currentStudentId = result.userId;
            allProfiles = Storage.getProfiles();
            profile = allProfiles[currentStudentId];
            showToast(`Account created for ${p.name}!`, 'success');
        } else {
            // Update existing in Firestore
            try {
                saveStatusText.textContent = 'Syncing to cloud...';
                await Storage.saveProfileToFirebase(currentStudentId, p);
            } catch (err) {
                console.warn('[ProfileBuilder] Cloud sync failed:', err);
                showToast(`Cloud Sync Failed: ${err.message}`, 'error');
            }
        }

        // Always save locally
        Storage.saveProfile(currentStudentId, p);
        allProfiles = Storage.getProfiles();
        profile = allProfiles[currentStudentId];
        initStudentSelector();

        // UI feedback
        saveBtn.classList.add('saved-anim');
        setTimeout(() => saveBtn.classList.remove('saved-anim'), 800);
        saveStatus.classList.add('saved');
        saveStatusIcon.textContent = 'check_circle';
        saveStatusIcon.classList.add('material-symbols-outlined');
        saveStatusText.textContent = 'Saved successfully';

        showToast(`Profile for ${p.name || currentStudentId} updated!`, 'success');
        setTimeout(() => {
            saveStatus.classList.remove('saved');
            saveStatusText.textContent = 'All changes saved';
        }, 3000);
    });

    /** Show the password modal and return a promise */
    function showCredentialModal() {
        return new Promise((resolve) => {
            credModal.style.display = 'flex';
            setTimeout(() => credModal.classList.add('show'), 10);
            modalPass.value = '';
            modalPass.focus();

            const close = (val) => {
                credModal.classList.remove('show');
                setTimeout(() => {
                    credModal.style.display = 'none';
                    resolve(val);
                }, 300);
            };

            modalCancel.onclick = () => close(null);
            modalConfirm.onclick = () => {
                const pass = modalPass.value.trim();
                if (!pass || pass.length < 6) {
                    alert('Password must be at least 6 characters.');
                    return;
                }
                close(pass);
            };
        });
    }

    // ── Accordion ──
    document.querySelectorAll('.accordion-header').forEach(header => {
        header.addEventListener('click', () => toggleAccordion(header.closest('.accordion-item')));
        header.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleAccordion(header.closest('.accordion-item'));
            }
        });
    });

    function toggleAccordion(item) {
        const isOpen = item.classList.contains('open');
        item.classList.toggle('open', !isOpen);
        item.querySelector('.accordion-header').setAttribute('aria-expanded', String(!isOpen));
    }

    // ── Sidebar & Logout ──
    logoutBtn.addEventListener('click', () => Auth.logout());

    // ── Toast ──
    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const icons = { success: 'check_circle', error: 'error', info: 'info' };
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<span class="toast-icon material-symbols-outlined" aria-hidden="true">${icons[type]}</span><span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-12px)';
            toast.style.transition = 'all .3s ease';
            setTimeout(() => toast.remove(), 350);
        }, 3200);
    }

    // ── Shared sidebar builder ──
    function setupSidebar(session, activePage) {
        const nav = document.getElementById('sidebar-nav');
        const avatar = document.getElementById('user-avatar-sidebar');
        const nameEl = document.getElementById('user-name-sidebar');
        const roleEl = document.getElementById('user-role-sidebar');

        const p = Storage.getAdminProfile ? Storage.getAdminProfile(session.userId) : null;
        const currentName = p?.name || session.displayName;

        if (avatar) {
            if (p?.avatar) {
                avatar.innerHTML = `<img src="${p.avatar}" alt="${currentName}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
            } else {
                avatar.textContent = currentName[0].toUpperCase();
            }
        }
        if (nameEl) nameEl.textContent = currentName;
        if (roleEl) roleEl.textContent = p?.role || 'Administrator';


        const items = [
            { label: 'Dashboard', href: 'dashboard.html', icon: 'grid_view' },
            { label: 'My Profile', href: 'admin-profile.html', icon: 'person' },
            { label: 'Interns', href: 'students.html', icon: 'group' },
            { label: 'Projects', href: 'projects.html', icon: 'folder' },
        ];

        if (nav) {
            nav.innerHTML = '<div class="nav-section-label">Menu</div>' +
                items.map(item => `
          <a class="nav-item${item.href === activePage ? ' active' : ''}" href="${item.href}" aria-current="${item.href === activePage ? 'page' : 'false'}">
            <span class="nav-icon" aria-hidden="true"><span class="material-symbols-outlined">${item.icon}</span></span>
            <span>${item.label}</span>
          </a>`).join('');
        }

        // Mobile sidebar
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
