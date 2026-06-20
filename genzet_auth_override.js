/**
 * ═══════════════════════════════════════════════════════════════════════
 * GENZET AUTH FIX v2.0 — genzet_auth_override.js
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * DROP-IN REPLACEMENT: Add this as the LAST <script> tag before </body>
 * (after all existing scripts).
 * 
 * This completely replaces the old auth system:
 *   ✅ Removes old white #authGate UI (CSS + DOM)
 *   ✅ On no JWT → shows landing page + opens dark modal
 *   ✅ On valid JWT → goes straight to dashboard
 *   ✅ On expired JWT → clears, shows landing + modal
 *   ✅ Logout → back to landing + modal
 *   ✅ Full cloud sync preserved
 * ═══════════════════════════════════════════════════════════════════════
 */

(function() {
'use strict';

// ─── 1. NUKE OLD AUTH GATE CSS & DOM ─────────────────────────────────────
function removeOldAuthGate() {
  // Hide via CSS (instant, before DOM removal)
  const style = document.createElement('style');
  style.id = 'gz-auth-override-css';
  style.textContent = `
    #authGate,
    .ag-wrap, .ag-left, .ag-right, .ag-card,
    .ag-login-success-overlay,
    .ag-left-bg, .ag-anim-scene,
    [id="agLoginSuccessOverlay"] {
      display: none !important;
      visibility: hidden !important;
      pointer-events: none !important;
      opacity: 0 !important;
    }
    /* Status bar only shown when logged in */
    #authStatusBar { display: none; }
  `;
  document.head.appendChild(style);

  // Remove DOM elements
  const toRemove = ['authGate', 'agLoginSuccessOverlay'];
  toRemove.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });
}

// ─── 2. CONFIGURATION ────────────────────────────────────────────────────
const BACKEND_URL = 'https://animind-backend-production.up.railway.app';
const TOKEN_KEY   = 'genzet_jwt';
const USER_KEY    = 'genzet_user';
const sb          = { auth: { signOut: () => Promise.resolve() } };

// ─── 3. HELPER: show landing page + open dark modal ──────────────────────
function _showLandingWithModal() {
  // Hide dashboard
  const dash = document.getElementById('gz-dashboard');
  if (dash) {
    dash.style.display    = 'none';
    dash.style.opacity    = '0';
    dash.classList.remove('active');
  }

  // Show landing page
  const landing = document.getElementById('gz-landing');
  if (landing) {
    landing.style.display = 'block';
    landing.style.opacity = '1';
  }

  // Close the dashboard auth modal if somehow open
  const dashModal = document.getElementById('authModal');
  if (dashModal) dashModal.classList.remove('open');

  // Open the landing page dark auth modal (defined in gz-landing script)
  setTimeout(() => {
    if (typeof openAuthModal === 'function') {
      openAuthModal();
    }
  }, 200);
}

// ─── 4. HELPER: enter dashboard ──────────────────────────────────────────
function _enterDashboard() {
  // Use existing showDashboard if available (smooth transition)
  if (typeof showDashboard === 'function') {
    showDashboard();
  } else {
    const landing = document.getElementById('gz-landing');
    if (landing) {
      landing.style.opacity = '0';
      setTimeout(() => { landing.style.display = 'none'; }, 420);
    }
    const dash = document.getElementById('gz-dashboard');
    if (dash) {
      dash.style.display = 'block';
      setTimeout(() => { dash.style.opacity = '1'; dash.classList.add('active'); }, 30);
    }
  }
  _updateStatusBar();
}

// ─── 5. UPDATE STATUS BAR ────────────────────────────────────────────────
function _updateStatusBar() {
  const user = window.authUser;
  if (!user) return;

  const bar = document.getElementById('authStatusBar');
  if (bar) bar.style.display = 'flex';

  const nameEl = document.getElementById('authUserName');
  if (nameEl) nameEl.textContent = user.name || 'Teacher';

  const chipEl = document.getElementById('authUserIdChip');
  if (chipEl) {
    const uid = user.user_id;
    if (uid) {
      chipEl.textContent    = 'ID: ' + uid.slice(0, 8) + '…';
      chipEl.style.display  = 'inline-block';
      chipEl.title          = 'User ID: ' + uid + ' — click to copy';
    } else {
      chipEl.style.display = 'none';
    }
  }
}

function _setSyncStatus(msg) {
  const el = document.getElementById('authSyncStatus');
  if (el) el.textContent = msg;
}

function _clearSession() {
  window.authToken = null;
  window.authUser  = null;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem('genzet_authenticated');
}

// ─── 6. MAIN INIT ────────────────────────────────────────────────────────
async function _authInit() {
  removeOldAuthGate();

  // Handle legacy sessions (genzet_authenticated flag, no JWT)
  const hasJwt      = !!localStorage.getItem(TOKEN_KEY);
  const legacyFlag  = localStorage.getItem('genzet_authenticated');
  if (legacyFlag === 'true') localStorage.removeItem('genzet_authenticated');
  if (legacyFlag === 'true' && !hasJwt) {
    // Old session without JWT — must re-login
    _showLandingWithModal();
    return;
  }

  const storedToken = localStorage.getItem(TOKEN_KEY);
  if (!storedToken) {
    _showLandingWithModal();
    return;
  }

  // Verify token
  _setSyncStatus('Verifying…');
  try {
    const res = await fetch(`${BACKEND_URL}/auth/verify`, {
      headers: { 'Authorization': `Bearer ${storedToken}` }
    });

    if (res.ok) {
      const profile     = await res.json();
      window.authToken  = storedToken;
      window.authUser   = { user_id: profile.user_id, email: profile.email, name: profile.name };
      localStorage.setItem(USER_KEY, JSON.stringify(window.authUser));

      _enterDashboard();
      _setSyncStatus('Syncing…');
      await _syncPull();
      _setSyncStatus('');

    } else {
      _clearSession();
      _showLandingWithModal();
    }

  } catch (err) {
    console.warn('[AUTH] Backend unreachable:', err.message);
    let cached = null;
    try { cached = JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch {}
    if (cached) {
      // Offline mode
      window.authToken = storedToken;
      window.authUser  = cached;
      _enterDashboard();
      _setSyncStatus('Offline');
    } else {
      _showLandingWithModal();
    }
  }
}

// ─── 7. CLOUD SYNC ───────────────────────────────────────────────────────
async function _syncPull() {
  const token = window.authToken;
  if (!token) return;
  try {
    const res = await fetch(`${BACKEND_URL}/sync/animations`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return;
    const { animations: cloud = [] } = await res.json();
    if (cloud.length > 0) {
      // Merge with local
      const local = typeof animindLibrary !== 'undefined' ? [...animindLibrary] : [];
      const byId  = Object.fromEntries(local.map(a => [a.id, a]));
      for (const c of cloud) byId[c.id] = c;
      const merged = Object.values(byId).sort((a, b) =>
        new Date(b.created_at || 0) - new Date(a.created_at || 0)
      );
      // Update global in-memory state (Supabase is the persistent store)
      if (typeof animindLibrary !== 'undefined') animindLibrary = merged;
      if (typeof syncLibraryToFolders === 'function') syncLibraryToFolders();
      if (typeof showFolders === 'function') showFolders();
      if (typeof updateActiveCount === 'function') updateActiveCount();
      if (typeof notify === 'function') notify(`✅ ${cloud.length} animations synced.`);
    }

    // Pull courses and vault sequentially AFTER animations —
    // _syncPullCourses needs animindLibrary populated to backfill animCode
    await _syncPullCourses();
    await _syncPullVault();
  } catch (e) { console.warn('[SYNC] Pull error:', e.message); }
}

async function _syncPushOne(anim) {
  const token = window.authToken;
  if (!token || !anim || !window.authUser?.user_id) return;
  _setSyncStatus('Syncing…');
  try {
    const res = await fetch(`${BACKEND_URL}/sync/animations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        id: anim.id,
        title: anim.title || 'Untitled',
        prompt: anim.prompt || '',
        explanation: anim.explanation || '',
        animation_code: anim.animation_code || '',
        playlist: anim.playlist || 'General',
        created_at: anim.created_at || new Date().toISOString(),
      }),
    });
    _setSyncStatus(res.ok ? '☁ Synced' : '⚠ Failed');
    setTimeout(() => _setSyncStatus(''), 3000);
  } catch (e) { _setSyncStatus('⚠ Offline'); setTimeout(() => _setSyncStatus(''), 5000); }
}

async function _syncPushAll() {
  const token = window.authToken;
  if (!token) return;
  const anims = typeof animindLibrary !== 'undefined' ? animindLibrary : [];
  if (!anims.length) return;
  _setSyncStatus(`Uploading ${anims.length}…`);
  try {
    const res = await fetch(`${BACKEND_URL}/sync/animations/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ animations: anims }),
    });
    const d = res.ok ? await res.json() : {};
    _setSyncStatus(res.ok ? `☁ ${d.synced || 0} backed up` : '⚠ Failed');
    setTimeout(() => _setSyncStatus(''), 4000);
  } catch (e) { _setSyncStatus('⚠ Offline'); setTimeout(() => _setSyncStatus(''), 5000); }
}

async function _syncDelete(id) {
  const token = window.authToken;
  if (!token || !id) return;
  try {
    await fetch(`${BACKEND_URL}/sync/animations/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
  } catch (e) { console.warn('[SYNC] Delete error:', e.message); }
}

async function _syncPushCourses() {
  const token = window.authToken;
  if (!token || !window.authUser?.user_id) return;
  try {
    const currentLocal = (typeof engineeringCourses !== 'undefined' && engineeringCourses) ? engineeringCourses : [];
    const courses = currentLocal.map(s => {
      if (!s) return null;
      const safeCos = Array.isArray(s.cos) ? s.cos.map(co => ({
        ...co,
        topics: Array.isArray(co.topics) ? [...co.topics] : []
      })) : [];
      return {
        ...s,
        cos: safeCos,
        syllabus: s.syllabus ? { ...s.syllabus, raw: '' } : null
      };
    }).filter(Boolean);
    const res = await fetch(`${BACKEND_URL}/sync/courses`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ courses }),
    });
    if (!res.ok) console.warn('[SYNC] Courses push HTTP error:', res.status);
  } catch (e) { console.warn('[SYNC] Courses push error:', e.message); }
}

async function _syncPullCourses() {
  const token = window.authToken;
  if (!token) return;
  try {
    const res = await fetch(`${BACKEND_URL}/sync/courses`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return;
    const { courses: cloud = [] } = await res.json();
    
    if (!cloud || !cloud.length) return;

    // Pull courses from cloud — merge with any local state
    // Ensure engineeringCourses is an array (may be null on very first load)
    const currentLocal = (typeof engineeringCourses !== 'undefined' && Array.isArray(engineeringCourses))
      ? engineeringCourses : [];
    const localById = Object.fromEntries(currentLocal.map(s => [s.id, s]));
    for (const s of cloud) localById[s.id] = s;
    if (typeof engineeringCourses !== 'undefined') {
      engineeringCourses = Object.values(localById);
    }

    // ✅ FIX Bug 3: Backfill animCode for topics where it is null.
    // Topics saved before the Bug 2 fix have animCode=null in the courses snapshot,
    // but their HTML was saved separately to /sync/animations (playlist='__co_topic__').
    // Cross-reference animindLibrary (already pulled by _syncPull) to restore the code.
    const animById = {};
    if (typeof animindLibrary !== 'undefined' && Array.isArray(animindLibrary)) {
      for (const a of animindLibrary) animById[a.id] = a;
    }
    if (typeof engineeringCourses !== 'undefined' && Array.isArray(engineeringCourses)) {
      engineeringCourses.forEach(s => {
        s.cos.forEach(co => {
          co.topics.forEach(t => {
            if (!t.animCode && animById[t.id]) {
              t.animCode = animById[t.id].animation_code || null;
            }
          });
        });
      });
    }

    if (typeof renderSubjectsGrid === 'function') renderSubjectsGrid();
    if (typeof syncLibraryToFolders === 'function') syncLibraryToFolders();
    if (typeof showFolders === 'function') showFolders();
    if (typeof updateActiveCount === 'function') updateActiveCount();
  } catch (e) { console.warn('[SYNC] Courses pull error:', e.message); }
}

// ── Vault cloud sync ────────────────────────────────────────────────────────
async function _syncPullVault() {
  const token = window.authToken;
  if (!token) return;
  try {
    const res = await fetch(`${BACKEND_URL}/sync/vault`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return;
    const { entries = [] } = await res.json();
    // Update in-memory vaultVideos in the main script block
    if (typeof vaultVideos !== 'undefined') {
      vaultVideos = entries;
      if (typeof vaultRenderGrid === 'function') vaultRenderGrid();
    }
    // Remove the now-redundant localStorage copy to avoid stale data
    try { localStorage.removeItem('genzet_vault'); } catch (_) {}
  } catch (e) { console.warn('[SYNC] Vault pull error:', e.message); }
}

async function _syncPushVault() {
  const token = window.authToken;
  if (!token || !window.authUser?.user_id) return;
  const entries = (typeof vaultVideos !== 'undefined') ? vaultVideos : [];
  try {
    const res = await fetch(`${BACKEND_URL}/sync/vault`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ entries }),
    });
    if (!res.ok) console.warn('[SYNC] Vault push HTTP error:', res.status);
    // Mirror removal from localStorage
    try { localStorage.removeItem('genzet_vault'); } catch (_) {}
  } catch (e) { console.warn('[SYNC] Vault push error:', e.message); }
}

// ─── 8. LOGOUT ────────────────────────────────────────────────────────────
function _logout() {
  if (!confirm('Sign out? Your library is saved in the cloud.')) return;
  _clearSession();
  sb.auth.signOut().catch(() => {});
  // Reset in-memory state — cloud data is already persisted in Supabase
  if (typeof animindLibrary !== 'undefined') animindLibrary = [];
  if (typeof engineeringCourses !== 'undefined') engineeringCourses = [];
  if (typeof showFolders === 'function') showFolders();
  if (typeof renderSubjectsGrid === 'function') renderSubjectsGrid();
  _showLandingWithModal();
}

// ─── 9. PATCH showDashboard to work with new flow ─────────────────────────
// Override the original showDashboard (defined in gz-landing script block)
// so it correctly sets authToken from genzet_jwt and calls authUpdateStatusBar.
const _origShowDashboard = window.showDashboard;
window.showDashboard = function() {
  // Call original transition code
  if (typeof _origShowDashboard === 'function') _origShowDashboard();

  // Ensure authToken/authUser are populated from localStorage
  const storedToken = localStorage.getItem(TOKEN_KEY);
  let storedUser = null;
  try { storedUser = JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch {}
  if (storedToken && storedUser) {
    window.authToken = storedToken;
    window.authUser  = storedUser;
  } else if (storedUser) {
    window.authUser  = storedUser;
    window.authToken = null;
  }
  // Show status bar
  _updateStatusBar();
};

// ─── 10. EXPOSE PUBLIC API ────────────────────────────────────────────────
// Override functions that the existing scripts call by name
window.authLogout               = _logout;
window.authUpdateStatusBar      = _updateStatusBar;
window.authSetSyncStatus        = _setSyncStatus;
window.authShowGate             = _showLandingWithModal;   // old callers redirected
window.authHideGate             = _enterDashboard;         // old callers redirected

// Sync API (called from saveToLibrary, deleteCO, etc.)
window.syncPushToCloud          = _syncPushOne;
window.syncPushAllToCloud       = _syncPushAll;
window.syncPullFromCloud        = _syncPull;
window.syncDeleteFromCloud      = _syncDelete;
window.syncCoursesToCloud       = _syncPushCourses;
window.syncPullCoursesFromCloud = _syncPullCourses;
// Vault sync API
window.syncPushVaultToCloud     = _syncPushVault;
window.syncPullVaultFromCloud   = _syncPullVault;

// Stub out old auth gate functions so they don't crash if called
window.authDoLogin    = () => console.warn('[AUTH] authDoLogin() replaced — use landing modal');
window.authDoRegister = () => console.warn('[AUTH] authDoRegister() replaced — use landing modal');
window.authSwitchTab  = () => {};
window.agTogglePw     = () => {};
window.authShowMsg    = () => {};
window.authClearMsg   = () => {};

// ─── 11. BOOTSTRAP ───────────────────────────────────────────────────────
// Remove old auth gate immediately (don't wait for DOMContentLoaded)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    removeOldAuthGate();
    // Run after a small delay so initDB() (in the existing DOMContentLoaded) completes first
    setTimeout(_authInit, 100);
  });
} else {
  removeOldAuthGate();
  setTimeout(_authInit, 100);
}

})(); // end IIFE
