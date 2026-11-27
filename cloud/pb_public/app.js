// Ekol Cloud — mini-site (vanilla + SDK PocketBase vendored, aucune CDN).
var pb = new PocketBase(window.location.origin);

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

function apiError(err, fallback) {
  if (err && typeof err.status === "number" && err.status === 0) {
    return "Serveur injoignable. Vérifiez votre connexion.";
  }
  var m = (err && err.response && (err.response.message || (err.response.data && JSON.stringify(err.response.data)))) || (err && err.message);
  return m || fallback || "Erreur inconnue";
}

async function dlFile(collection, recordId, filename, label) {
  try {
    var ft = await pb.send("/api/files/token", { method: "POST" });
    var a = document.createElement("a");
    a.href = pb.files.getURL({ id: recordId, collectionId: collection }, filename, { token: ft.token });
    a.download = label || filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (err) { toast(apiError(err), false); }
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
    var res = await pb.collection("users").authWithPassword(fd.get("email"), fd.get("password"));
    store.token = pb.authStore.token;
    store.user = res.record;
    enterApp();
    toast("Connecté — bienvenue " + (res.record.name || res.record.email));
  } catch (err) { toast(apiError(err), false); }
});

document.getElementById("signup-form").addEventListener("submit", async function(e) {
  e.preventDefault();
  var fd = new FormData(e.target);
  var password = fd.get("password");
  if (password !== fd.get("passwordConfirm")) { toast("Les mots de passe ne correspondent pas", false); return; }
  try {
    await pb.collection("users").create({
      name: fd.get("name"), email: fd.get("email"), phone: fd.get("phone") || "",
      password: password, passwordConfirm: fd.get("passwordConfirm")
    });
    var res = await pb.collection("users").authWithPassword(fd.get("email"), password);
    store.token = pb.authStore.token;
    store.user = res.record;
    enterApp();
    toast("Compte créé — demandez ensuite votre abonnement (25 000 FCFA / an)");
  } catch (err) { toast(apiError(err), false); }
});

document.getElementById("logout-btn").addEventListener("click", function() {
  pb.authStore.clear();
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
    await pb.collection("pairing_codes").getOne(code);
    await pb.collection("pairing_codes").update(code, { status: "claimed", claimed_by: store.user.id });
    document.getElementById("pair-code").value = "";
    toast("Appareil associé — retournez dans l'application de bureau");
    loadDevices();
  } catch (err) { toast(apiError(err), false); }
});

// ─── Abonnement ──────────────────────────────────────────────────────────
document.getElementById("subscribe-btn").addEventListener("click", async function() {
  if (!confirm("Demander l'abonnement annuel (25 000 FCFA) ? Le statut restera « En attente » jusqu'à validation du paiement.")) return;
  try {
    // Valeurs verrouillées : le serveur les exige à l'identique.
    await pb.collection("subscriptions").create({
      user: store.user.id, plan: "annuel", amount: 25000, currency: "FCFA", status: "pending"
    });
    toast("Demande envoyée — statut : en attente de validation du paiement");
    loadSubs();
  } catch (err) { toast(apiError(err), false); }
});

async function loadSubs() {
  try {
    // Pas de tri serveur (quirk PocketBase : sort + règle d'accès = 400).
    var res = await pb.collection("subscriptions").getList(1, 50);
    var items = (res.items || []).slice().sort(function(a, b) {
      return String(b.created).localeCompare(String(a.created));
    });
    document.getElementById("subs-tbody").innerHTML = items.map(function(s) {
      return "<tr><td>" + (s.plan || "annuel") + "</td><td>" + s.amount + " " + s.currency + "</td>" +
        "<td>" + pill(s.status) + "</td><td>" + fmtDate(s.expires_at) + "</td>" +
        "<td>" + (s.payment_ref || "—") + "</td></tr>";
    }).join("") || '<tr><td colspan="5">Aucun abonnement — cliquez sur « Demander ».</td></tr>';
  } catch (err) { toast(apiError(err), false); }
}

// ─── Appareils ───────────────────────────────────────────────────────────
async function loadDevices() {
  try {
    var res = await pb.collection("devices").getList(1, 50);
    document.getElementById("devices-tbody").innerHTML = res.items.map(function(d) {
      var sub = d.sub_active ? '<span class="pill active">Actif</span>' : '<span class="pill pending">Sans abonnement</span>';
      return "<tr><td>" + escapeHtml(d.device_name) + "</td><td>" + escapeHtml(d.org_name || "—") + "</td>" +
        "<td>" + sub + (d.sub_expires ? " <small>(" + fmtDate(d.sub_expires) + ")</small>" : "") + "</td>" +
        "<td>" + fmtDate(d.last_sync_at) + "</td>" +
        '<td><button class="btn small ghost" onclick="unlinkDevice(\'' + d.id + "')\">Dissocier</button></td></tr>";
    }).join("") || '<tr><td colspan="5">Aucun appareil associé pour l\'instant.</td></tr>';
  } catch (err) { toast(apiError(err), false); }
}

async function unlinkDevice(id) {
  if (!confirm("Dissocier cet appareil ? Il ne pourra plus synchroniser.")) return;
  try {
    await pb.collection("devices").delete(id);
    toast("Appareil dissocié");
    loadDevices();
  } catch (err) { toast(apiError(err), false); }
}

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ─── Sauvegardes & CSV ───────────────────────────────────────────────────
async function loadBackupDevices() {
  try {
    var res = await pb.collection("devices").getList(1, 50);
    var sel = document.getElementById("backup-device");
    sel.innerHTML = res.items.map(function(d) {
      return '<option value="' + d.id + '">' + escapeHtml(d.device_name) + " — " + escapeHtml(d.org_name || "") + "</option>";
    }).join("") || "<option value=''>— aucun appareil —</option>";
    if (res.items.length) loadBackups(res.items[0].id);
  } catch (err) { toast(apiError(err), false); }
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
    // Pas de tri/filtre serveur (quirk PocketBase, voir cloud/README.md).
    var res = await pb.collection("backups").getList(1, 100);
    var _items = (res.items || []).filter(function(x) { return x.device === deviceId; });
    _items.sort(function(a, b) { return String(b.created).localeCompare(String(a.created)); });
    _items = _items.slice(0, 20);
    if (!_items.length) { box.innerHTML = '<p class="muted">Aucune sauvegarde pour cet appareil.</p>'; return; }
    var exAll = await pb.collection("exports").getList(1, 100);
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
  } catch (err) { toast(apiError(err), false); }
}

async function deleteBackup(id, deviceId) {
  if (!confirm("Supprimer cette sauvegarde et ses CSV ?")) return;
  try {
    await pb.collection("backups").delete(id);
    toast("Sauvegarde supprimée");
    loadBackups(deviceId);
  } catch (err) { toast(apiError(err), false); }
}

// ─── Boot ────────────────────────────────────────────────────────────────
(function() {
  if (store.token && store.user) {
    try { pb.authStore.save(store.token, store.user); } catch (e) { /* stocké brut */ }
    pb.collection("users").authRefresh().then(function() {
      store.token = pb.authStore.token;
      store.user = pb.authStore.record;
      enterApp();
    }).catch(function() {
      pb.authStore.clear();
      store.token = ""; store.user = null;
    });
  }
})();
