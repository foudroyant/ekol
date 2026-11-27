// ─── AUTHENTIFICATION LOCALE ──────────────────────────────────────────────────
// Comptes stockés dans SQLite. Mots de passe hachés avec PBKDF2-SHA256
// (Web Crypto), sel aléatoire par utilisateur. Aucune donnée ne quitte la machine.

var _orgSwitcherBound = false;

function _hex(buffer) {
  var bytes = new Uint8Array(buffer);
  var out = '';
  for (var i = 0; i < bytes.length; i++) {
    out += ('0' + bytes[i].toString(16)).slice(-2);
  }
  return out;
}

function _fromHex(hex) {
  var bytes = new Uint8Array(hex.length / 2);
  for (var i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function _randomHex(nBytes) {
  var bytes = new Uint8Array(nBytes);
  crypto.getRandomValues(bytes);
  return _hex(bytes.buffer);
}

async function hashPassword(password, saltHex) {
  if (!window.crypto || !window.crypto.subtle) {
    throw new Error('Web Crypto indisponible : impossible de sécuriser le mot de passe.');
  }
  var salt = saltHex ? _fromHex(saltHex) : _fromHex(_randomHex(16));
  var enc = new TextEncoder().encode(password);
  var key = await crypto.subtle.importKey('raw', enc, { name: 'PBKDF2' }, false, ['deriveBits']);
  var bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt, iterations: 120000, hash: 'SHA-256' },
    key,
    256
  );
  return { salt: _hex(salt.buffer), hash: _hex(bits) };
}

async function verifyPassword(password, saltHex, expectedHash) {
  var r = await hashPassword(password, saltHex);
  return r.hash === expectedHash;
}

// ─── RÔLES ────────────────────────────────────────────────────────────────────

function roleLabel(role) {
  if (role === 'super_admin') return 'Super administrateur';
  if (role === 'admin') return 'Administrateur';
  if (role === 'enseignant') return 'Enseignant';
  return role || '—';
}

function isSuperAdmin() {
  return !!currentUser && currentUser.role === 'super_admin';
}

function canManage() {
  return !!currentUser && (currentUser.role === 'admin' || currentUser.role === 'super_admin');
}

// ─── BOOT ─────────────────────────────────────────────────────────────────────

async function authBoot() {
  var orgs = dbGetAllOrganizations();
  if (!orgs.length) {
    await dbCreateOrganization({ nom: 'Mon établissement' });
  }
  var users = dbGetAllUsersAll();
  if (!users.length) {
    renderSetupScreen();
  } else {
    renderLoginScreen();
  }
}

function _authShell(inner) {
  var screen = document.getElementById('auth-screen');
  screen.innerHTML =
    '<div class="auth-card">' +
      '<div class="flex items-center gap-3 mb-6">' +
        '<img src="/icons/logo.svg" alt="Ekol" class="auth-logo">' +
        '<div>' +
          '<div class="auth-title">Ekol</div>' +
          '<div class="auth-sub">Gestion scolaire · notes & établissements</div>' +
        '</div>' +
      '</div>' +
      inner +
      '<div class="auth-footer">Bambyno Studio App · v1.1.0</div>' +
    '</div>';
  screen.classList.remove('hidden');
  document.getElementById('sidebar').classList.add('hidden');
  document.getElementById('main-panel').classList.add('hidden');
}

function renderSetupScreen() {
  var orgs = dbGetAllOrganizations();
  var orgNom = orgs.length ? orgs[0].nom : 'Mon établissement';

  _authShell(
    '<div class="auth-badge">Première configuration</div>' +
    '<h1 class="text-xl font-bold text-gray-900 mb-1">Créer votre établissement</h1>' +
    '<p class="text-sm text-gray-500 mb-5">Le premier compte sera super administrateur : il pourra gérer plusieurs établissements et créer des comptes.</p>' +
    '<div id="auth-error" class="auth-error hidden mb-4"></div>' +
    '<form id="setup-form" class="space-y-4">' +
      '<div>' +
        '<label class="form-label">Nom de l\'établissement *</label>' +
        '<input type="text" name="org_nom" value="' + escapeHtml(orgNom) + '" required class="form-input" placeholder="ex: Complexe scolaire Ekol">' +
      '</div>' +
      '<div>' +
        '<label class="form-label">Votre nom complet *</label>' +
        '<input type="text" name="nom" required class="form-input" placeholder="ex: Stéphane Bamby">' +
      '</div>' +
      '<div>' +
        '<label class="form-label">Nom d\'utilisateur *</label>' +
        '<input type="text" name="username" required class="form-input" autocomplete="username" placeholder="ex: admin">' +
      '</div>' +
      '<div class="grid grid-cols-2 gap-4">' +
        '<div>' +
          '<label class="form-label">Mot de passe *</label>' +
          '<input type="password" name="password" required minlength="6" class="form-input" autocomplete="new-password">' +
        '</div>' +
        '<div>' +
          '<label class="form-label">Confirmer *</label>' +
          '<input type="password" name="password2" required minlength="6" class="form-input" autocomplete="new-password">' +
        '</div>' +
      '</div>' +
      '<button type="submit" class="btn btn-primary w-full justify-center">Créer mon établissement</button>' +
    '</form>'
  );

  document.getElementById('setup-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    var fd = new FormData(e.target);
    var orgNom = (fd.get('org_nom') || '').trim();
    var nom = (fd.get('nom') || '').trim();
    var username = (fd.get('username') || '').trim();
    var password = fd.get('password') || '';
    var password2 = fd.get('password2') || '';

    if (!orgNom || !nom || !username) return _authError('Tous les champs sont obligatoires.');
    if (password.length < 6) return _authError('Le mot de passe doit contenir au moins 6 caractères.');
    if (password !== password2) return _authError('Les deux mots de passe ne correspondent pas.');

    try {
      var orgs = dbGetAllOrganizations();
      var orgId;
      if (orgs.length) {
        orgId = orgs[0].id;
        await dbUpdateOrganization(orgId, {
          nom: orgNom,
          adresse: orgs[0].adresse,
          telephone: orgs[0].telephone,
          email: orgs[0].email
        });
      } else {
        orgId = await dbCreateOrganization({ nom: orgNom });
      }

      await dbCreateUser({
        organization_id: orgId,
        nom: nom,
        username: username,
        password: password,
        role: 'super_admin'
      });
      var user = dbGetUserByUsername(username);
      await startSession(user);
    } catch (err) {
      _authError(err.message);
    }
  });
}

function renderLoginScreen() {
  _authShell(
    '<h1 class="text-xl font-bold text-gray-900 mb-1">Connexion</h1>' +
    '<p class="text-sm text-gray-500 mb-5">Accédez à votre espace de gestion scolaire.</p>' +
    '<div id="auth-error" class="auth-error hidden mb-4"></div>' +
    '<form id="login-form" class="space-y-4">' +
      '<div>' +
        '<label class="form-label">Nom d\'utilisateur</label>' +
        '<input type="text" name="username" required class="form-input" autocomplete="username" autofocus>' +
      '</div>' +
      '<div>' +
        '<label class="form-label">Mot de passe</label>' +
        '<input type="password" name="password" required class="form-input" autocomplete="current-password">' +
      '</div>' +
      '<button type="submit" class="btn btn-primary w-full justify-center">Se connecter</button>' +
    '</form>' +
    '<p class="text-xs text-gray-400 mt-4 text-center">Mot de passe oublié ? Contactez votre administrateur.</p>'
  );

  document.getElementById('login-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    var fd = new FormData(e.target);
    var username = (fd.get('username') || '').trim();
    var password = fd.get('password') || '';
    if (!username || !password) return _authError('Renseignez votre identifiant et votre mot de passe.');

    var btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Connexion…';
    try {
      var user = await dbAuthenticate(username, password);
      if (!user) {
        _authError('Identifiant ou mot de passe incorrect, ou compte désactivé.');
        btn.disabled = false;
        btn.textContent = 'Se connecter';
        return;
      }
      await startSession(user);
    } catch (err) {
      _authError(err.message);
      btn.disabled = false;
      btn.textContent = 'Se connecter';
    }
  });
}

function _authError(message) {
  var el = document.getElementById('auth-error');
  if (!el) return;
  el.textContent = message;
  el.classList.remove('hidden');
}

async function startSession(user) {
  currentUser = user;
  currentOrgId = user.organization_id || (dbGetAllOrganizations()[0] || {}).id || null;
  await dbTouchUserLogin(user.id);
  setCurrency(dbGetCurrency());

  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('sidebar').classList.remove('hidden');
  document.getElementById('main-panel').classList.remove('hidden');

  applyRoleUI();
  if (!window.location.hash) window.location.hash = '#/dashboard';
  router.init();
  if (typeof checkForAppUpdate === 'function') checkForAppUpdate();
}

async function logout() {
  currentUser = null;
  currentOrgId = null;
  document.getElementById('sidebar').classList.add('hidden');
  document.getElementById('main-panel').classList.add('hidden');
  window.location.hash = '';
  renderLoginScreen();
}

function applyRoleUI() {
  if (!currentUser) return;
  var org = dbGetOrganizationById(currentOrgId) || { nom: '—' };

  var orgEl = document.getElementById('sidebar-org');
  var userEl = document.getElementById('sidebar-user');
  var roleEl = document.getElementById('sidebar-role');
  if (orgEl) orgEl.textContent = org.nom;
  if (userEl) userEl.textContent = currentUser.nom;
  if (roleEl) roleEl.textContent = roleLabel(currentUser.role);

  var nodes = document.querySelectorAll('[data-role]');
  for (var i = 0; i < nodes.length; i++) {
    var need = nodes[i].getAttribute('data-role');
    var ok = need === 'admin' ? canManage() : (need === 'super' ? isSuperAdmin() : true);
    nodes[i].classList.toggle('hidden', !ok);
  }

  var switcher = document.getElementById('org-switcher');
  if (switcher) {
    if (isSuperAdmin()) {
      var orgs = dbGetAllOrganizations();
      switcher.innerHTML = orgs.map(function(o) {
        return '<option value="' + o.id + '"' + (o.id === currentOrgId ? ' selected' : '') + '>' +
          escapeHtml(o.nom) + '</option>';
      }).join('');
      switcher.classList.remove('hidden');
      if (!_orgSwitcherBound) {
        switcher.addEventListener('change', function() { switchOrg(Number(this.value)); });
        _orgSwitcherBound = true;
      }
    } else {
      switcher.classList.add('hidden');
    }
  }
}

function switchOrg(id) {
  currentOrgId = Number(id);
  setCurrency(dbGetCurrency());
  applyRoleUI();
  if (window.location.hash === '#/dashboard') {
    _handleRoute();
  } else {
    routerNavigate('/dashboard');
  }
}
