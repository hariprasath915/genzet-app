/* ============================================================================
   cloud_sync_v3.js  —  GenZet / Animind  v3.0
   ============================================================================
   REPLACES:  genzet_auth_override.js  +  auth_sync.js  +  cloud_sync.js
              (remove ALL three old script tags — use this ONE file instead)

   ADD as the LAST <script> tag before </body> in index.html:
     <script src="cloud_sync_v3.js"></script>

   WHAT'S NEW vs v2 (genzet_auth_override.js / cloud_sync.js):
     ✅ Single GET /sync/all on login  — one round-trip loads everything
     ✅ POST /sync/items               — typed save (ai_creator/book_mode/question_anim/topic_content)
     ✅ POST /sync/subjects + /cos + /topics  — per-row normalized writes
     ✅ POST /sync/vault/entries       — per-row vault entries (no more full-blob PUT)
     ✅ Legacy /sync/animations + /sync/courses + /sync/vault kept as fallback
     ✅ window.* API surface IDENTICAL to v2 — zero changes needed in index.html
        (except replacing the script filename)

   LOCALSTORAGE POLICY:
     ONLY  genzet_jwt      — auth token (needed for pre-paint gate)
     ONLY  genzet_user     — cached name/email for offline display
     ONLY  genzet_theme    — dark/light preference  (UI state, fine)
     ONLY  genzet_searches — search autocomplete history  (UI state, fine)
     ALL   app data (animations, courses, vault) comes from cloud only.
   ============================================================================ */

(function () {
  'use strict';

  const BACKEND   = 'https://animind-backend-production.up.railway.app';
  const TOKEN_KEY = 'genzet_jwt';
  const USER_KEY  = 'genzet_user';

  // Expose on window immediately so inline handlers can call them
  window.authToken = window.authToken || null;
  window.authUser  = window.authUser  || null;

  // ── Low-level fetch helper ──────────────────────────────────────────────
  async function _api(method, path, body) {
    const token = window.authToken;
    if (!token) return { ok: false, error: 'Not authenticated' };
    const opts = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    };
    if (body !== undefined) opts.body = JSON.stringify(body);
    try {
      const res  = await fetch(`${BACKEND}${path}`, opts);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.warn(`[SYNC] ${method} ${path} → HTTP ${res.status}`, data);
        return { ok: false, status: res.status, error: data.detail || `HTTP ${res.status}`, data };
      }
      return { ok: true, data };
    } catch (err) {
      console.warn(`[SYNC] ${method} ${path} network error:`, err.message);
      window._cloudOffline = true;
      return { ok: false, error: err.message };
    }
  }

  // ── Remove old auth gate markup (idempotent) ────────────────────────────
  function _removeOldGate() {
    if (document.getElementById('gz-auth-override-css')) return;
    const s = document.createElement('style');
    s.id = 'gz-auth-override-css';
    s.textContent = `
      #authGate, .ag-wrap, .ag-left, .ag-right, .ag-card,
      .ag-login-success-overlay, .ag-left-bg, .ag-anim-scene,
      [id="agLoginSuccessOverlay"] {
        display: none !important; visibility: hidden !important;
        pointer-events: none !important; opacity: 0 !important;
      }
      #authStatusBar { display: none; }
    `;
    document.head.appendChild(s);
    ['authGate', 'agLoginSuccessOverlay'].forEach(id => document.getElementById(id)?.remove());
  }

  // ── UI routing ──────────────────────────────────────────────────────────
  function _showLanding() {
    const dash = document.getElementById('gz-dashboard');
    if (dash) { dash.style.display = 'none'; dash.style.opacity = '0'; dash.classList.remove('active'); }
    const land = document.getElementById('gz-landing');
    if (land) { land.style.display = 'block'; land.style.opacity = '1'; }
    document.getElementById('authModal')?.classList?.remove('open');
    setTimeout(() => { if (typeof openAuthModal === 'function') openAuthModal(); }, 250);
  }

  function _enterDashboard() {
    if (typeof showDashboard === 'function') {
      showDashboard();
    } else {
      const land = document.getElementById('gz-landing');
      if (land) { land.style.opacity = '0'; setTimeout(() => land.style.display = 'none', 420); }
      const dash = document.getElementById('gz-dashboard');
      if (dash) { dash.style.display = 'block'; setTimeout(() => { dash.style.opacity = '1'; dash.classList.add('active'); }, 30); }
    }
    _updateStatusBar();
  }

  function _updateStatusBar() {
    const user = window.authUser;
    if (!user) return;

    // Show the topbar user pill (avatar + name + Sign Out button)
    const pill = document.getElementById('topbarUserPill');
    if (pill) pill.style.display = 'flex';

    // Set user name
    const nameEl = document.getElementById('authUserName');
    if (nameEl) nameEl.textContent = user.name || 'Student';

    // Set avatar initial (first letter of name or email)
    const avatarEl = document.getElementById('authUserAvatar');
    if (avatarEl) {
      avatarEl.textContent = (user.name || user.email || 'U').charAt(0).toUpperCase();
    }

    // Legacy: old authStatusBar (hidden in most layouts, no-op if absent)
    const bar = document.getElementById('authStatusBar');
    if (bar) bar.style.display = 'flex';

    const chipEl = document.getElementById('authUserIdChip');
    if (chipEl) {
      const uid = user.user_id;
      if (uid) {
        chipEl.textContent   = 'ID: ' + uid.slice(0, 8) + '…';
        chipEl.style.display = 'inline-block';
        chipEl.title         = 'Your User ID: ' + uid + ' — click to copy';
      } else {
        chipEl.style.display = 'none';
      }
    }
  }

  function _setSyncStatus(msg) {
    const el = document.getElementById('authSyncStatus');
    if (el) el.textContent = msg;
  }

  // ── Session helpers ─────────────────────────────────────────────────────
  function _storeSession(data) {
    window.authToken = data.token;
    window.authUser  = {
      user_id: data.user_id || null,
      email:   data.email   || '',
      name:    data.name    || (data.email || '').split('@')[0] || 'Student',
    };
    localStorage.setItem(TOKEN_KEY, window.authToken);
    localStorage.setItem(USER_KEY, JSON.stringify(window.authUser));
    localStorage.removeItem('genzet_local_session');
    localStorage.removeItem('genzet_authenticated');
  }

  function _clearSession() {
    window.authToken = null;
    window.authUser  = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem('genzet_authenticated');
    localStorage.removeItem('genzet_local_session');
  }

  // ════════════════════════════════════════════════════════════════════════
  // FULL DATA PULL  —  GET /sync/all
  // Called once after login. Falls back to legacy 3-call approach if needed.
  // ════════════════════════════════════════════════════════════════════════
  async function _syncAll() {
    const r = await _api('GET', '/sync/all');
    if (r.ok) {
      _hydrateItems(r.data.items    || []);
      _hydrateCourses(r.data.subjects || []);
      _hydrateVault(r.data.vault    || []);
      return true;
    }
    // /sync/all not available yet (pre-deploy) — fall back to legacy
    console.warn('[SYNC] /sync/all unavailable — using legacy 3-call fallback');
    await _legacyLoadAll();
    return false;
  }

  // ── Hydrate in-memory state from cloud data ─────────────────────────────

  function _hydrateItems(items) {
    /**
     * items from /sync/all use the new schema:
     *   { id, item_type, title, prompt, explanation, html_code, playlist, created_at }
     * We map them to the shape index.html expects:
     *   { id, title, prompt, explanation, animation_code, playlist, created_at }
     */
    if (!items.length) return;
    const mapped = items.map(item => ({
      id:             item.id,
      title:          item.title      || 'Untitled',
      prompt:         item.prompt     || '',
      explanation:    item.explanation || '',
      animation_code: item.html_code  || '',   // ← field rename
      playlist:       item.playlist   || 'General',
      created_at:     item.created_at,
      item_type:      item.item_type,           // extra — safe to keep
    }));

    // Cloud REPLACES local — no merge needed on login
    if (typeof animindLibrary !== 'undefined') {
      animindLibrary = mapped;
    }
    if (typeof syncLibraryToFolders === 'function') syncLibraryToFolders();
    if (typeof showFolders          === 'function') showFolders();
    if (typeof updateActiveCount    === 'function') updateActiveCount();
    if (items.length && typeof notify === 'function') {
      notify(`✅ ${items.length} saved items loaded from cloud.`);
    }
  }

  function _hydrateCourses(subjects) {
    /**
     * subjects from /sync/all is already in engineeringCourses shape:
     * [{ id, name, description, cos: [{ id, coNum, description, topics: [...] }] }]
     */
    if (!subjects.length) return;
    if (typeof engineeringCourses !== 'undefined') {
      engineeringCourses = subjects;
    }
    if (typeof renderSubjectsGrid  === 'function') renderSubjectsGrid();
    if (typeof syncLibraryToFolders === 'function') syncLibraryToFolders();
    if (typeof updateActiveCount    === 'function') updateActiveCount();
    if (typeof updateStorageBadge   === 'function') updateStorageBadge();
  }

  function _hydrateVault(entries) {
    if (!entries.length) return;
    if (typeof vaultVideos !== 'undefined') {
      // Map new schema fields → legacy shape that vaultRenderGrid() expects
      vaultVideos = entries.map(e => ({
        id:       e.id,
        name:     e.name,
        fileName: e.file_name   || e.fileName || e.name,
        size:     e.file_size   || e.size     || 0,
        url:      e.public_url  || e.url      || '',
        created_at: e.created_at,
      }));
      if (typeof vaultRenderGrid === 'function') vaultRenderGrid();
    }
    // Remove legacy localStorage copy
    try { localStorage.removeItem('genzet_vault'); } catch (_) {}
  }


  // ════════════════════════════════════════════════════════════════════════
  // SAVE GENERATED ITEM  —  POST /sync/items
  // ════════════════════════════════════════════════════════════════════════
  async function _saveItem(item, itemType) {
    /**
     * item must have: title, prompt, explanation, animation_code, playlist
     * itemType: 'ai_creator' | 'book_mode' | 'question_anim' | 'topic_content'
     * Falls back to legacy /sync/animations if the new endpoint fails.
     */
    _setSyncStatus('Saving…');
    const body = {
      item_type:   itemType || 'ai_creator',
      title:       (item.title       || 'Untitled').trim(),
      prompt:      item.prompt       || '',
      explanation: item.explanation  || '',
      html_code:   item.animation_code || '',
      playlist:    item.playlist     || 'General',
      is_saved:    true,
      created_at:  item.created_at   || new Date().toISOString(),
    };
    // Book mode extras
    if (item.source_pdf_name) body.source_pdf_name = item.source_pdf_name;
    if (item.source_topic)    body.source_topic    = item.source_topic;
    if (item.source_subtopic) body.source_subtopic = item.source_subtopic;

    const r = await _api('POST', '/sync/items', body);
    if (r.ok) {
      if (r.data?.id) item._cloud_id = r.data.id;  // store UUID for later deletes
      _setSyncStatus('☁ Saved');
      setTimeout(() => _setSyncStatus(''), 3000);
      return r;
    }

    // New endpoint failed — fall back to legacy
    console.warn('[SYNC] /sync/items failed, falling back to legacy:', r.error);
    await _legacySaveAnimation(item);
    return r;
  }

  // ── Delete item (tries new endpoint first, falls back to legacy) ─────────
  async function _deleteItem(id) {
    // id may be a UUID (_cloud_id) or a legacy timestamp string
    const r = await _api('DELETE', `/sync/items/${encodeURIComponent(id)}`);
    if (!r.ok) {
      // Fall back to legacy /sync/animations/{id}
      await _legacyDeleteAnimation(id);
    }
    _setSyncStatus('');
  }


  // ════════════════════════════════════════════════════════════════════════
  // SUBJECT / CO / TOPIC  —  normalized row operations
  // ════════════════════════════════════════════════════════════════════════

  async function _createSubject(name, description) {
    const r = await _api('POST', '/sync/subjects', { name, description: description || '' });
    if (r.ok) {
      if (typeof notify === 'function') notify(`✅ Subject "${name}" created`);
      return r.data?.subject || null;
    }
    console.warn('[SYNC] createSubject failed:', r.error);
    return null;
  }

  async function _updateSubject(subjectId, patch) {
    const r = await _api('PUT', `/sync/subjects/${subjectId}`, patch);
    if (!r.ok) console.warn('[SYNC] updateSubject failed:', r.error);
    return r.ok;
  }

  async function _deleteSubject(subjectId) {
    const r = await _api('DELETE', `/sync/subjects/${subjectId}`);
    if (!r.ok) console.warn('[SYNC] deleteSubject failed:', r.error);
    return r.ok;
  }

  async function _createCO(subjectId, coNum, description) {
    const r = await _api('POST', '/sync/cos', {
      subject_id: subjectId,
      co_num:     coNum,
      description: description || '',
    });
    if (r.ok) return r.data?.co || null;
    console.warn('[SYNC] createCO failed:', r.error);
    return null;
  }

  async function _updateCO(coId, patch) {
    const r = await _api('PUT', `/sync/cos/${coId}`, patch);
    if (!r.ok) console.warn('[SYNC] updateCO failed:', r.error);
    return r.ok;
  }

  async function _deleteCO(coId) {
    const r = await _api('DELETE', `/sync/cos/${coId}`);
    if (!r.ok) console.warn('[SYNC] deleteCO failed:', r.error);
    return r.ok;
  }

  async function _createTopic(coId, subjectId, name, htmlCode, prompt) {
    const r = await _api('POST', '/sync/topics', {
      co_id:      coId,
      subject_id: subjectId,
      name,
      prompt:     prompt   || '',
      html_code:  htmlCode || '',
    });
    if (r.ok) return r.data?.topic || null;
    console.warn('[SYNC] createTopic failed:', r.error);
    return null;
  }

  async function _updateTopic(topicId, patch) {
    const r = await _api('PUT', `/sync/topics/${topicId}`, patch);
    if (!r.ok) console.warn('[SYNC] updateTopic failed:', r.error);
    return r.ok;
  }

  async function _deleteTopic(topicId) {
    const r = await _api('DELETE', `/sync/topics/${topicId}`);
    if (!r.ok) console.warn('[SYNC] deleteTopic failed:', r.error);
    return r.ok;
  }


  // ════════════════════════════════════════════════════════════════════════
  // VAULT  —  per-entry operations
  // ════════════════════════════════════════════════════════════════════════

  async function _addVaultEntry(entry) {
    /**
     * entry: { name, fileName, size, url?, storagePath?, mimeType? }
     * Falls back to legacy PUT /sync/vault if new endpoint fails.
     */
    const r = await _api('POST', '/sync/vault/entries', {
      name:         entry.name,
      file_name:    entry.fileName   || entry.file_name || entry.name,
      file_size:    entry.size       || entry.file_size || 0,
      storage_path: entry.storagePath || entry.storage_path || '',
      public_url:   entry.url        || entry.public_url    || '',
      mime_type:    entry.mimeType   || entry.mime_type     || 'video/mp4',
    });
    if (!r.ok) {
      console.warn('[SYNC] /sync/vault/entries failed, falling back to legacy:', r.error);
      await _legacySaveVault();
    }
    return r;
  }

  async function _deleteVaultEntry(entryId) {
    const r = await _api('DELETE', `/sync/vault/entries/${encodeURIComponent(entryId)}`);
    if (!r.ok) {
      console.warn('[SYNC] /sync/vault/entries DELETE failed, using legacy:', r.error);
      await _legacySaveVault();
    }
    return r;
  }


  // ════════════════════════════════════════════════════════════════════════
  // LEGACY FALLBACK FUNCTIONS
  // Kept exactly as in cloud_sync.js v2 so nothing breaks during migration.
  // ════════════════════════════════════════════════════════════════════════

  async function _legacyLoadAll() {
    await Promise.all([
      _legacyLoadLibrary(),
      _legacyLoadCourses(),
      _legacyLoadVault(),
    ]);
    if (typeof syncLibraryToFolders === 'function') syncLibraryToFolders();
    if (typeof renderSubjectsGrid   === 'function') renderSubjectsGrid();
    if (typeof showFolders          === 'function') showFolders();
    if (typeof updateActiveCount    === 'function') updateActiveCount();
    if (typeof vaultRenderGrid      === 'function') vaultRenderGrid();
  }

  async function _legacyLoadLibrary() {
    const r = await _api('GET', '/sync/animations');
    if (!r.ok) return;
    const cloud = r.data?.animations || [];
    if (typeof animindLibrary !== 'undefined') animindLibrary = cloud;
  }

  async function _legacySaveAnimation(anim) {
    if (!anim || !anim.id) return;
    _setSyncStatus('Syncing…');
    const r = await _api('POST', '/sync/animations', {
      id:             anim.id,
      title:          anim.title          || 'Untitled',
      prompt:         anim.prompt         || '',
      explanation:    anim.explanation    || '',
      animation_code: anim.animation_code || '',
      playlist:       anim.playlist       || 'General',
      created_at:     anim.created_at     || new Date().toISOString(),
    });
    _setSyncStatus(r.ok ? '☁ Synced' : '⚠ Failed');
    setTimeout(() => _setSyncStatus(''), 3000);
  }

  async function _legacyBatchSave(anims) {
    if (!anims || !anims.length) return;
    _setSyncStatus(`Uploading ${anims.length}…`);
    const r = await _api('POST', '/sync/animations/batch', { animations: anims });
    _setSyncStatus(r.ok ? `☁ ${r.data?.synced || 0} backed up` : '⚠ Failed');
    setTimeout(() => _setSyncStatus(''), 4000);
  }

  async function _legacyDeleteAnimation(id) {
    if (!id) return;
    await _api('DELETE', `/sync/animations/${encodeURIComponent(id)}`);
  }

  // Debounce timer for legacy courses push
  let _coursesTimer = null;
  async function _legacySaveCourses() {
    if (!window.authToken || !window.authUser?.user_id) return;
    clearTimeout(_coursesTimer);
    return new Promise(resolve => {
      _coursesTimer = setTimeout(async () => {
        const courses = (typeof engineeringCourses !== 'undefined' && engineeringCourses)
          ? engineeringCourses.filter(Boolean).map(s => ({
              ...s,
              cos: Array.isArray(s.cos)
                ? s.cos.map(co => ({ ...co, topics: Array.isArray(co.topics) ? [...co.topics] : [] }))
                : [],
              syllabus: s.syllabus ? { ...s.syllabus, raw: '' } : null,
            }))
          : [];
        const r = await _api('PUT', '/sync/courses', { courses });
        if (!r.ok) {
          console.warn('[SYNC] Legacy courses push failed:', r.error);
          if (typeof notify === 'function') notify('⚠️ Courses sync failed — check connection', 'error');
        }
        resolve();
      }, 1200);
    });
  }

  async function _legacyLoadCourses() {
    const r = await _api('GET', '/sync/courses');
    if (!r.ok) return;
    const cloud = Array.isArray(r.data?.courses) ? r.data.courses : [];
    if (!cloud.length) return;

    // Strip old pre-seeded default subject IDs
    const LEGACY_IDS = new Set(['ep', 'ec', 'em', 'ht', 'mc']);
    const filtered = cloud.filter(s => !LEGACY_IDS.has(s.id));
    if (!filtered.length) return;

    if (typeof engineeringCourses !== 'undefined') {
      // Backfill animCode for topics that were saved before the Bug 2 fix
      const animById = {};
      if (typeof animindLibrary !== 'undefined' && Array.isArray(animindLibrary)) {
        for (const a of animindLibrary) animById[a.id] = a;
      }
      filtered.forEach(s => {
        (s.cos || []).forEach(co => {
          (co.topics || []).forEach(t => {
            if (!t.animCode && animById[t.id]) {
              t.animCode = animById[t.id].animation_code || null;
            }
          });
        });
      });
      engineeringCourses = filtered;
    }
  }

  async function _legacySaveVault() {
    const entries = typeof vaultVideos !== 'undefined' ? vaultVideos : [];
    await _api('PUT', '/sync/vault', { entries });
    try { localStorage.removeItem('genzet_vault'); } catch (_) {}
  }

  async function _legacyLoadVault() {
    const r = await _api('GET', '/sync/vault');
    if (!r.ok) return;
    const entries = r.data?.entries || [];
    if (typeof vaultVideos !== 'undefined') vaultVideos = entries;
    try { localStorage.removeItem('genzet_vault'); } catch (_) {}
  }


  // ════════════════════════════════════════════════════════════════════════
  // GOOGLE OAUTH  —  full-page redirect flow  (like Claude.ai / Gemini)
  // ════════════════════════════════════════════════════════════════════════

  /**
   * _googleLogin()
   *
   * Flow:
   *   1. Fetch the Supabase Google OAuth URL from the backend
   *   2. Redirect the whole page to that URL  (no popup — works everywhere)
   *   3. Google → Supabase → oauth_callback.html#access_token=...
   *   4. oauth_callback.html exchanges the token, saves JWT to localStorage,
   *      then redirects back to '/'
   *   5. _authInit() reads the JWT and enters the dashboard automatically
   */
  async function _googleLogin() {
    var origin = window.location.origin;
    if (!origin || origin === 'null') {
      origin = 'https://genzet-app.vercel.app';
    }
    var callbackUrl = origin + '/oauth_callback.html';

    try {
      var res = await fetch(
        BACKEND + '/auth/google?redirect_to=' + encodeURIComponent(callbackUrl)
      );
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var data = await res.json();
      if (!data.url) throw new Error('No OAuth URL returned');
      if (!data.verifier) throw new Error('No PKCE verifier returned');

      // ✅ Save the PKCE verifier so the callback page can use it
      localStorage.setItem('oauth_verifier', data.verifier);

      // ✅ Full-page redirect — no popup, no postMessage, no CORS issues
      window.location.href = data.url;

    } catch (err) {
      console.warn('[AUTH] Google OAuth URL fetch failed:', err.message);
      if (typeof window.amShowErr === 'function') {
        window.amShowErr('Google sign-in is unavailable right now. Please try email/password.');
      }
    }
  }


  // ════════════════════════════════════════════════════════════════════════
  // AUTH BOOTSTRAP
  // ════════════════════════════════════════════════════════════════════════

  async function _authInit() {
    _removeOldGate();

    // Clean up legacy flags
    const legacyFlag = localStorage.getItem('genzet_authenticated');
    if (legacyFlag === 'true') localStorage.removeItem('genzet_authenticated');
    if (legacyFlag === 'true' && !localStorage.getItem(TOKEN_KEY)) {
      _showLanding(); return;
    }

    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (!storedToken) { _showLanding(); return; }

    _setSyncStatus('Verifying session…');
    try {
      const res = await fetch(`${BACKEND}/auth/verify`, {
        headers: { 'Authorization': `Bearer ${storedToken}` },
      });

      if (!res.ok) {
        _clearSession();
        _showLanding();
        return;
      }

      const profile    = await res.json();
      window.authToken = storedToken;
      window.authUser  = {
        user_id: profile.user_id,
        email:   profile.email,
        name:    profile.name,
      };
      localStorage.setItem(USER_KEY, JSON.stringify(window.authUser));

      _enterDashboard();
      _setSyncStatus('Loading your data…');
      await _syncAll();
      _setSyncStatus('');

    } catch (err) {
      console.warn('[AUTH] Backend unreachable:', err.message);
      let cached = null;
      try { cached = JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch (_) {}
      if (cached) {
        window.authToken = storedToken;
        window.authUser  = cached;
        _enterDashboard();
        _setSyncStatus('⚠ Offline — reconnect to load your data');
      } else {
        _showLanding();
      }
    }
  }

  function _logout() {
    if (!confirm('Sign out of GenZet? Your library is safely synced to the cloud.')) return;
    _clearSession();
    if (typeof animindLibrary     !== 'undefined') animindLibrary     = [];
    if (typeof engineeringCourses !== 'undefined') engineeringCourses = [];
    if (typeof vaultVideos        !== 'undefined') vaultVideos        = [];
    if (typeof showFolders        === 'function') showFolders();
    if (typeof renderSubjectsGrid === 'function') renderSubjectsGrid();
    if (typeof vaultRenderGrid    === 'function') vaultRenderGrid();
    _showLanding();
  }

  // Called from login/register modal on success
  async function _onAuthSuccess(data) {
    _storeSession(data);
    _enterDashboard();
    _setSyncStatus('Syncing…');
    await _syncAll();
    _setSyncStatus('');
  }


  // ════════════════════════════════════════════════════════════════════════
  // PATCH showDashboard
  // ════════════════════════════════════════════════════════════════════════
  const _origShowDashboard = window.showDashboard;
  window.showDashboard = function () {
    if (typeof _origShowDashboard === 'function') _origShowDashboard();
    const t = localStorage.getItem(TOKEN_KEY);
    let u = null;
    try { u = JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch (_) {}
    if (t && u) { window.authToken = t; window.authUser = u; }
    _updateStatusBar();
  };


  // ════════════════════════════════════════════════════════════════════════
  // PUBLIC API  —  same surface as v2, extended with new normalized ops
  // ════════════════════════════════════════════════════════════════════════

  // ── Auth ─────────────────────────────────────────────────────────────────
  window.authInit            = _authInit;
  window.authStoreSession    = _storeSession;
  window.authOnLoginSuccess  = _onAuthSuccess;   // store + sync in one call
  window.authClearSession    = _clearSession;
  window.authLogout          = _logout;
  window.authUpdateStatusBar = _updateStatusBar;
  window.authSetSyncStatus   = _setSyncStatus;
  window.authShowGate        = _showLanding;     // back-compat alias
  window.authHideGate        = _enterDashboard;  // back-compat alias
  window.authGoogleLogin     = _googleLogin;     // Google OAuth popup flow

  // ── Item sync (new + legacy fallback) ────────────────────────────────────
  // syncPushToCloud(item, itemType?) — itemType defaults to 'ai_creator'
  window.syncPushToCloud     = (item, type) => _saveItem(item, type || 'ai_creator');
  window.syncPushAllToCloud  = (anims)      => _legacyBatchSave(anims || window.animindLibrary || []);
  window.syncPullFromCloud   = ()           => _syncAll();
  window.syncDeleteFromCloud = (id)         => _deleteItem(id);

  // ── Normalized course ops ─────────────────────────────────────────────────
  window.syncCreateSubject   = _createSubject;   // (name, description?) → subject|null
  window.syncUpdateSubject   = _updateSubject;   // (id, patch) → bool
  window.syncDeleteSubject   = _deleteSubject;   // (id) → bool
  window.syncCreateCO        = _createCO;        // (subjectId, coNum, desc?) → co|null
  window.syncUpdateCO        = _updateCO;        // (id, patch) → bool
  window.syncDeleteCO        = _deleteCO;        // (id) → bool
  window.syncCreateTopic     = _createTopic;     // (coId, subjectId, name, html?, prompt?) → topic|null
  window.syncUpdateTopic     = _updateTopic;     // (id, patch) → bool
  window.syncDeleteTopic     = _deleteTopic;     // (id) → bool

  // ── Legacy course sync (called by existing index.html saveECourses()) ─────
  window.syncCoursesToCloud       = _legacySaveCourses;
  window.syncPullCoursesFromCloud = _legacyLoadCourses;

  // ── Vault (new per-entry + legacy blob fallback) ──────────────────────────
  window.syncAddVaultEntry        = _addVaultEntry;    // (entry) → result
  window.syncDeleteVaultEntry     = _deleteVaultEntry; // (id) → result
  window.syncPushVaultToCloud     = _legacySaveVault;  // legacy: push full array
  window.syncPullVaultFromCloud   = _legacyLoadVault;  // legacy: pull full array

  // ── IDB stubs (safe no-ops) ───────────────────────────────────────────────
  window.initDB         = async () => null;
  window.saveLibraryIDB = async () => {};
  window.loadLibraryIDB = async () => { await _legacyLoadLibrary(); return window.animindLibrary || []; };
  window.saveECourses   = async () => { await _legacySaveCourses(); };
  window.loadECourses   = async () => { await _legacyLoadCourses(); return window.engineeringCourses || []; };

  // ── Old auth gate stubs ───────────────────────────────────────────────────
  window.authDoLogin    = () => console.warn('[AUTH] Use landing modal amHandleLogin()');
  window.authDoRegister = () => console.warn('[AUTH] Use landing modal amHandleSignup()');
  window.authSwitchTab  = () => {};
  window.agTogglePw     = () => {};
  window.authShowMsg    = () => {};
  window.authClearMsg   = () => {};


  // ════════════════════════════════════════════════════════════════════════
  // BOOTSTRAP  —  run exactly once
  // ════════════════════════════════════════════════════════════════════════
  _removeOldGate();

  function _boot() {
    // If this page was opened with ?share=<token>, skip auth entirely.
    // The public share page renderer (renderPublicSharePage) handles this URL.
    if (new URLSearchParams(location.search).get('share')) return;
    if (window.__authInitDone) return;
    window.__authInitDone = true;
    setTimeout(_authInit, 80);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _boot);
  } else {
    _boot();
  }


  console.log('[CLOUD] cloud_sync_v3.js loaded — cloud is the single source of truth');

})();
