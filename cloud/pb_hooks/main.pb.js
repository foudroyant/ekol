// Ekol Cloud — logique métier côté serveur (JSVM, exécuté par le seul binaire).
// Aucune dépendance externe : appairage, abonnement 25 000 FCFA / an, expiration.
//
// IMPORTANT JSVM : chaque handler s'exécute dans son propre contexte — tout le
// code utile est INLINÉ dans chaque handler (aucune fonction utilitaire
// partagée, aucune constante de fichier). Seules les globales du runtime
// ($app, console, BadRequestError, cronAdd, onRecord*…) sont utilisables.

// ─── pairing_codes : le client envoie status + expires_at ; on contrôle ───
onRecordCreateRequest((e) => {
  var isSuper = false;
  try { isSuper = !!(e.requestInfo && e.requestInfo.hasSuperuserAuth && e.requestInfo.hasSuperuserAuth()); } catch (err) {}
  if (!isSuper) {
    var r = e.record;
    if (r.get("status") !== "pending") {
      throw new BadRequestError("Un code d'appairage doit être créé avec le statut « pending ».");
    }
    var exp = r.get("expires_at");
    var nowMs = new Date().getTime();
    if (!exp || new Date(exp).getTime() > nowMs + 16 * 60000) {
      throw new BadRequestError("Durée de validité du code invalide (15 minutes maximum).");
    }
    var device = e.app.findRecordById("devices", r.get("device"));
    if (device.get("owner")) {
      throw new BadRequestError("Cet appareil est déjà associé à un compte.");
    }
  }
  e.next();
}, "pairing_codes");

// ─── pairing_codes : validation avant claim ──────────────────────────────
onRecordUpdateRequest((e) => {
  var r = e.record;
  if (r.get("status") !== "claimed") {
    e.next();
    return;
  }
  if (!r.get("claimed_by")) {
    throw new BadRequestError("Compte utilisateur manquant pour l'appairage.");
  }
  if (r.get("expires_at") && new Date(r.get("expires_at")).getTime() < new Date().getTime()) {
    throw new BadRequestError("Code d'appairage expiré. Générez-en un nouveau dans l'application.");
  }
  e.next();
}, "pairing_codes");

// ─── pairing_codes : liaison effective après claim persisté ───────────────
onRecordAfterUpdateSuccess((e) => {
  var r = e.record;
  if (r.get("status") === "claimed" && r.get("claimed_by")) {
    var app = e.app;
    var userId = r.get("claimed_by");
    app.findRecordById("users", userId); // 404 si inexistant
    var device = app.findRecordById("devices", r.get("device"));
    if (device.get("owner") && device.get("owner") !== userId) {
      throw new BadRequestError("Cet appareil est déjà associé à un autre compte.");
    }
    if (device.get("owner") !== userId) {
      device.set("owner", userId);
      app.save(device);
    }
    // Recopie l'état d'abonnement sur les appareils du compte
    var subs = app.findRecordsByFilter("subscriptions", "user = '" + userId + "' && status = 'active'", "-expires_at", 1, 0);
    var sub = (subs && subs.length) ? subs[0] : null;
    var ok = !!sub && new Date(sub.get("expires_at")).getTime() > new Date().getTime();
    var devices = app.findRecordsByFilter("devices", "owner = '" + userId + "'", "", 200, 0);
    for (var i = 0; i < devices.length; i++) {
      var d = devices[i];
      var changed = false;
      if (!!d.get("sub_active") !== ok) { d.set("sub_active", ok); changed = true; }
      var exp2 = ok ? sub.get("expires_at") : null;
      if ((d.get("sub_expires") || "") !== (exp2 || "")) { d.set("sub_expires", exp2); changed = true; }
      if (changed) { app.save(d); }
    }
  }
  e.next();
}, "pairing_codes");

// ─── subscriptions : le client envoie tout ; on verrouille le tarif ─────
onRecordCreateRequest((e) => {
  var isSuper2 = false;
  try { isSuper2 = !!(e.requestInfo && e.requestInfo.hasSuperuserAuth && e.requestInfo.hasSuperuserAuth()); } catch (err2) {}
  if (!isSuper2) {
    var r2 = e.record;
    if (r2.get("plan") !== "annuel" || Number(r2.get("amount")) !== 25000 ||
        r2.get("currency") !== "FCFA" || r2.get("status") !== "pending") {
      throw new BadRequestError("Abonnement invalide : plan « annuel », 25000 FCFA, statut « pending » requis.");
    }
  }
  e.next();
}, "subscriptions");

// ─── subscriptions : toute modification propage les droits aux appareils ─
onRecordAfterUpdateSuccess((e) => {
  var r = e.record;
  if (r.get("user")) {
    var app2 = e.app;
    var userId2 = r.get("user");
    var subs2 = app2.findRecordsByFilter("subscriptions", "user = '" + userId2 + "' && status = 'active'", "-expires_at", 1, 0);
    var sub2 = (subs2 && subs2.length) ? subs2[0] : null;
    var ok2 = !!sub2 && new Date(sub2.get("expires_at")).getTime() > new Date().getTime();
    var devices2 = app2.findRecordsByFilter("devices", "owner = '" + userId2 + "'", "", 200, 0);
    for (var j = 0; j < devices2.length; j++) {
      var dd = devices2[j];
      var changed2 = false;
      if (!!dd.get("sub_active") !== ok2) { dd.set("sub_active", ok2); changed2 = true; }
      var exp3 = ok2 ? sub2.get("expires_at") : null;
      if ((dd.get("sub_expires") || "") !== (exp3 || "")) { dd.set("sub_expires", exp3); changed2 = true; }
      if (changed2) { app2.save(dd); }
    }
  }
  e.next();
}, "subscriptions");

// ─── backups : horodate l'appareil après chaque sauvegarde ───────────────
onRecordAfterCreateSuccess((e) => {
  var deviceId = e.record.get("device");
  if (!deviceId) {
    e.next();
    return;
  }
  try {
    var device2 = e.app.findRecordById("devices", deviceId);
    device2.set("last_sync_at", new Date().toISOString());
    e.app.save(device2);
  } catch (err3) { /* appareil supprimé entre-temps : ignore */ }
  e.next();
}, "backups");

// ─── cron quotidien : expirations ─────────────────────────────────────────
cronAdd("ekol-expire", "0 2 * * *", () => {
  var app3 = $app;
  var nowIso = new Date().toISOString();
  var expired = app3.findRecordsByFilter(
    "subscriptions",
    "status = 'active' && expires_at != '' && expires_at < '" + nowIso + "'",
    "",
    500,
    0
  );
  for (var k = 0; k < expired.length; k++) {
    var s = expired[k];
    s.set("status", "expired");
    app3.save(s); // onRecordAfterUpdateSuccess propage aux appareils
  }
  var codes = app3.findRecordsByFilter(
    "pairing_codes",
    "status = 'pending' && expires_at < '" + nowIso + "'",
    "",
    500,
    0
  );
  for (var m = 0; m < codes.length; m++) {
    var c = codes[m];
    c.set("status", "expired");
    app3.save(c);
  }
});
