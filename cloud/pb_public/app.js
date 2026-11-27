// Ekol Cloud — mini-site (vanilla JS, aucune dépendance).
var store = {
  get token() { return localStorage.getItem("ekol_cloud_token") || ""; },
  set token(v) { v ? localStorage.setItem("ekol_cloud_token", v) : localStorage.removeItem("ekol_cloud_token"); },
  get user() { try { return JSON.parse(localStorage.getItem("ekol_cloud_user") || "null"); } catch (e) { return null; } },
  set user(v) { v ? localStorage.setItem("ekol_cloud_user", JSON.stringify(v)) : localStorage.removeItem("ekol_cloud_user"); }
};

function toast(msg, ok) {
  var el = document.getElementById("toast");
  el.textContent = msg;
  el.className = "toast " + (ok === false ? "err" : "ok");
  clearTimeout(el._t);
  el._t = setTimeout(function() { el.classList.add("hidden"); }, 3500);
}

async function api(path, opts) {
  opts = opts || {};
  var headers = opts.headers || {};
  if (store.token) headers["Authorization"] = store.token;
  var res = await fetch("/api" + path, Object.assign({}, opts, { headers: headers }));
  var data = null;
  try { data = await res.json(); } catch (e) { /* vide */ }
  if (!res.ok) {
    var msg = (data && (data.message || (data.data && JSON.stringify(data.data)))) || ("Erreur " + res.status);
    throw new Error(msg);
  }
  return data;
}

async function dlFile(collection, recordId, filename, label) {
  try {
    var ft = await api("/files/token", { method: "POST" });
    var a = document.createElement("a");
    a.href = "/api/files/" + collection + "/" + recordId + "/" + encodeURIComponent(filename) + "?token=" + ft.token;
    a.download = label || filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (err) { toast(err.message, false); }
}

function pill(status) {
  var labels = { active: "Actif", pending: "En attente", expired: "Expiré", cancelled: "Annulé" };
  return '<span class="pill ' + status + '">' + (labels[status] || status) + "</span>";
}

function fmtDate(d) {
  if (!d) return "—";
  return String(d).slice(0, 16).replace("T", " ");
}

// ─── Navigation ──────────────────────────────────────────────────────────
var currentTab = "account";
document.querySelectorAll("#tabs button[data-tab]").forEach(function(btn) {
  btn.addEventListener("click", function() { showTab(btn.getAttribute("data-tab")); });
});

function showTab(name) {
  currentTab = name;
  document.querySelectorAll("#tabs button[data-tab]").forEach(function(b) {
    b.classList.toggle("on", b.getAttribute("data-tab") === name);
  });
  ["account", "subscription", "devices", "backups"].forEach(function(t) {
    document.getElementById("view-" + t).classList.toggle("hidden", t !== name);
  });
  if (name === "subscription") loadSubs();
  if (name === "devices") loadDevices();
  if (name === "backups") loadBackupDevices();
}

// ─── Auth ────────────────────────────────────────────────────────────────
document.getElementById("show-login").addEventListener("click", function() {
  this.classList.add("on"); document.getElementById("show-signup").classList.remove("on");
  document.getElementById("login-form").classList.remove("hidden");
  document.getElementById("signup-form").classList.add("hidden");
});
document.getElementById("show-signup").addEventListener("click", function() {
  this.classList.add("on"); document.getElementById("show-login").classList.remove("on");
  document.getElementById("signup-form").classList.remove("hidden");
  document.getElementById("login-form").classList.add("hidden");
});

document.getElementById("login-form").addEventListener("submit", async function(e) {
  e.preventDefault();
  var fd = new FormData(e.target);
  try {
    var res = await api("/collections/users/auth-with-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identity: fd.get("email"), password: fd.get("password") })
    });
    store.token = res.token;
    store.user = res.record;
    enterApp();
    toast("Connecté — bienvenue " + (res.record.name || res.record.email));
  } catch (err) { toast(err.message, false); }
});

document.getElementById("signup-form").addEventListener("submit", async function(e) {
  e.preventDefault();
  var fd = new FormData(e.target);
  var body = {
    name: fd.get("name"), email: fd.get("email"), phone: fd.get("phone") || "",
    password: fd.get("password"), passwordConfirm: fd.get("passwordConfirm")
  };
  if (body.password !== body.passwordConfirm) { toast("Les mots de passe ne correspondent pas", false); return; }
  try {
    await api("/collections/users/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    var res = await api("/collections/users/auth-with-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identity: body.email, password: body.password })
    });
    store.token = res.token;
    store.user = res.record;
    enterApp();
    toast("Compte créé — demandez ensuite votre abonnement (25 000 FCFA / an)");
  } catch (err) { toast(err.message, false); }
});

document.getElementById("logout-btn").addEventListener("click", async function() {
  try { await api("/collections/users/auth-refresh", { method: "POST" }); } catch (e) { /* ignore */ }
  store.token = ""; store.user = null;
  document.getElementById("view-auth").classList.remove("hidden");
  document.getElementById("tabs").classList.add("hidden");
  ["account", "subscription", "devices", "backups"].forEach(function(t) {
    document.getElementById("view-" + t).classList.add("hidden");
  });
});

function enterApp() {
  document.getElementById("view-auth").classList.add("hidden");
  document.getElementById("tabs").classList.remove("hidden");
  var u = store.user || {};
  document.getElementById("account-info").textContent = (u.name || "") + " · " + (u.email || "") + (u.phone ? " · " + u.phone : "");
  showTab("account");
  loadSubs();
}

// ─── Appairage ───────────────────────────────────────────────────────────
document.getElementById("pair-form").addEventListener("submit", async function(e) {
  e.preventDefault();
  var code = document.getElementById("pair-code").value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (code.length < 6) { toast("Code invalide", false); return; }
  try {
    await api("/collections/pairing_codes/records/" + code);
    await api("/collections/pairing_codes/records/" + code, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "claimed", claimed_by: store.user.id })
    });
    document.getElementById("pair-code").value = "";
    toast("Appareil associé — retournez dans l'application de bureau");
    loadDevices();
  } catch (err) { toast(err.message, false); }
});

// ─── Abonnement ──────────────────────────────────────────────────────────
document.getElementById("subscribe-btn").addEventListener("click", async function() {
  if (!confirm("Demander l'abonnement annuel (25 000 FCFA) ? Le statut restera « En attente » jusqu'à validation du paiement.")) return;
  try {
    // Valeurs verrouillées : le serveur les exige à l'identique (voir hooks).
    await api("/collections/subscriptions/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: store.user.id, plan: "annuel", amount: 25000, currency: "FCFA", status: "pending" })
    });
    toast("Demande envoyée — statut : en attente de validation du paiement");
    loadSubs();
  } catch (err) { toast(err.message, false); }
});

async function loadSubs() {
  try {
    // Pas de tri serveur (même quirk PocketBase que pour les sauvegardes :
    // sort + règle d'accès = 400). Tri côté client.
    var res = await api("/collections/subscriptions/records?perPage=50");
    var items = (res.items || []).slice().sort(function(a, b) {
      return String(b.created).localeCompare(String(a.created));
    });
    document.getElementById("subs-tbody").innerHTML = items.map(function(s) {
      return "<tr><td>" + (s.plan || "annuel") + "</td><td>" + s.amount + " " + s.currency + "</td>" +
        "<td>" + pill(s.status) + "</td><td>" + fmtDate(s.expires_at) + "</td>" +
        "<td>" + (s.payment_ref || "—") + "</td></tr>";
    }).join("") || '<tr><td colspan="5">Aucun abonnement — cliquez sur « Demander ».</td></tr>';
  } catch (err) { toast(err.message, false); }
}

// ─── Appareils ───────────────────────────────────────────────────────────
async function loadDevices() {
  try {
    var res = await api("/collections/devices/records?perPage=50");
    window._devices = res.items;
    document.getElementById("devices-tbody").innerHTML = res.items.map(function(d) {
      var sub = d.sub_active ? '<span class="pill active">Actif</span>' : '<span class="pill pending">Sans abonnement</span>';
      return "<tr><td>" + escapeHtml(d.device_name) + "</td><td>" + escapeHtml(d.org_name || "—") + "</td>" +
        "<td>" + sub + (d.sub_expires ? " <small>(" + fmtDate(d.sub_expires) + ")</small>" : "") + "</td>" +
        "<td>" + fmtDate(d.last_sync_at) + "</td>" +
        '<td><button class="btn small ghost" onclick="unlinkDevice(\'' + d.id + "')\">Dissocier</button></td></tr>";
    }).join("") || '<tr><td colspan="5">Aucun appareil associé pour l\'instant.</td></tr>';
  } catch (err) { toast(err.message, false); }
}

async function unlinkDevice(id) {
  if (!confirm("Dissocier cet appareil ? Il ne pourra plus synchroniser.")) return;
  try {
    await api("/collections/devices/records/" + id, { method: "DELETE" });
    toast("Appareil dissocié");
    loadDevices();
  } catch (err) { toast(err.message, false); }
}

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ─── Sauvegardes & CSV ───────────────────────────────────────────────────
async function loadBackupDevices() {
  try {
    var res = await api("/collections/devices/records?perPage=50");
    var sel = document.getElementById("backup-device");
    sel.innerHTML = res.items.map(function(d) {
      return '<option value="' + d.id + '">' + escapeHtml(d.device_name) + " — " + escapeHtml(d.org_name || "") + "</option>";
    }).join("") || "<option value=''>— aucun appareil —</option>";
    if (res.items.length) loadBackups(res.items[0].id);
  } catch (err) { toast(err.message, false); }
}

document.getElementById("backup-device").addEventListener("change", function() {
  if (this.value) loadBackups(this.value);
});
document.getElementById("refresh-backups").addEventListener("click", function() {
  var v = document.getElementById("backup-device").value;
  if (v) loadBackups(v);
});

async function loadBackups(deviceId) {
  var box = document.getElementById("backups-list");
  try {
    // Pas de tri/filtre serveur (quirk PocketBase : tri + règle = 400
    // intermittent — voir cloud/README.md). La règle restreint déjà
    // aux sauvegardes des appareils du compte ; on trie/filtre côté client.
    var res = await api("/collections/backups/records?perPage=100");
    var _items = (res.items || []).filter(function(x) { return x.device === deviceId; });
    _items.sort(function(a, b) { return String(b.created).localeCompare(String(a.created)); });
    _items = _items.slice(0, 20);
    if (!_items.length) { box.innerHTML = '<p class="muted">Aucune sauvegarde pour cet appareil.</p>'; return; }
    var exAll = await api("/collections/exports/records?perPage=100");
    var html = "";
    for (var i = 0; i < _items.length; i++) {
      var b = _items[i];
      var ex = { items: (exAll.items || []).filter(function(x) { return x.backup === b.id; }) };
      var files = '<button class="btn small" onclick="dlFile(\'backups\',\'' + b.id + "','" + b.snapshot + "','snapshot-" + b.id + '.json\')">snapshot.json</button>';
      files += ex.items.map(function(x) {
        return '<button class="btn small ghost" onclick="dlFile(\'exports\',\'' + x.id + "','" + x.file + "','" + escapeHtml(x.label || x.kind) + '.csv\')">' + escapeHtml(x.label || x.kind) + ".csv</button>";
      }).join("");
      html += '<div class="backup"><h4>' + fmtDate(b.created) + " — " + escapeHtml(b.org_name || "") + "</h4>" +
        '<div class="meta">checksum ' + b.checksum.slice(0, 16) + "… · " + JSON.stringify(b.counts || {}) + "</div>" +
        '<div class="files">' + files +
        '<button class="btn small danger" onclick="deleteBackup(\'' + b.id + "','" + deviceId + "')\">Supprimer</button></div></div>";
    }
    box.innerHTML = html;
    window._lastDevice = deviceId;
  } catch (err) { toast(err.message, false); }
}

async function deleteBackup(id, deviceId) {
  if (!confirm("Supprimer cette sauvegarde et ses CSV ?")) return;
  try {
    await api("/collections/backups/records/" + id, { method: "DELETE" });
    toast("Sauvegarde supprimée");
    loadBackups(deviceId);
  } catch (err) { toast(err.message, false); }
}

// ─── Boot ────────────────────────────────────────────────────────────────
(function() {
  if (store.token && store.user) {
    api("/collections/users/auth-refresh", { method: "POST" }).then(function(res) {
      store.token = res.token;
      store.user = res.record;
      enterApp();
    }).catch(function() {
      store.token = ""; store.user = null;
    });
  }
})();
