// Ekol Cloud — schéma initial (PocketBase ≥ 0.40, JSVM).
//
// Collections :
//   devices        (auth)  identité de chaque app de bureau ; l'app s'y authentifie
//   pairing_codes  (base)  codes d'appairage (l'id du record EST le code)
//   subscriptions  (base)  abonnements 25 000 FCFA / an
//   backups        (base)  instantanés snapshot.json téléversés par les apps
//   exports        (base)  fichiers CSV liés à une sauvegarde (téléchargeables côté cloud)
// + champ `phone` sur la collection `users` native.

migrate((app) => {
  var settings = app.settings();
  settings.meta.appName = "Ekol Cloud";
  app.save(settings);

  // ── users : inscription ouverte, lecture/modif limitées à soi-même ──
  var users = app.findCollectionByNameOrId("users");
  users.createRule = "";
  users.viewRule = "id = @request.auth.id";
  users.updateRule = "id = @request.auth.id";
  users.deleteRule = null;
  if (!hasField(users, "phone")) {
    users.fields.add(new TextField({ name: "phone", required: false, max: 30 }));
  }
  app.save(users);
  var usersId = users.id;

  function hasField(collection, name) {
    try {
      return !!collection.fields.getByName(name);
    } catch (e) {
      return false;
    }
  }

  function rel(name, collectionId, required, cascadeDelete) {
    return {
      type: "relation", name: name, required: !!required, maxSelect: 1,
      collectionId: collectionId, cascadeDelete: !!cascadeDelete
    };
  }

  // Les règles sont validées à la construction : les relations doivent donc
  // figurer dans `fields` dès le `new Collection`. Les collections sont créées
  // dans l'ordre des dépendances (les ids devenant connus au fil de l'eau).
  function getOrCreate(name, build) {
    try {
      return app.findCollectionByNameOrId(name);
    } catch (e) {
      var col = build();
      app.save(col);
      return app.findCollectionByNameOrId(name);
    }
  }

  // ── devices (auth) ──
  var devicesRules = {
    listRule: "owner = @request.auth.id",
    viewRule: "id = @request.auth.id || owner = @request.auth.id",
    createRule: "",
    updateRule: "id = @request.auth.id || owner = @request.auth.id",
    deleteRule: "owner = @request.auth.id"
  };
  var devices = getOrCreate("devices", function() {
    return new Collection({
      type: "auth", name: "devices",
      listRule: devicesRules.listRule, viewRule: devicesRules.viewRule,
      createRule: devicesRules.createRule, updateRule: devicesRules.updateRule,
      deleteRule: devicesRules.deleteRule,
      fields: [
        { type: "text", name: "device_name", required: true, max: 80 },
        { type: "text", name: "org_name", required: false, max: 120 },
        { type: "text", name: "app_version", required: false, max: 20 },
        { type: "bool", name: "sub_active" },
        { type: "date", name: "sub_expires", required: false, min: "", max: "" },
        { type: "date", name: "last_sync_at", required: false, min: "", max: "" },
        rel("owner", usersId)
      ]
    });
  });
  devices.listRule = devicesRules.listRule;
  devices.viewRule = devicesRules.viewRule;
  devices.createRule = devicesRules.createRule;
  devices.updateRule = devicesRules.updateRule;
  devices.deleteRule = devicesRules.deleteRule;
  if (!hasField(devices, "owner")) { devices.fields.add(new RelationField(rel("owner", usersId))); }
  app.save(devices);
  var devicesId = devices.id;

  // ── pairing_codes : l'id du record EST le code d'appairage ──
  var codesRules = {
    listRule: null, viewRule: "",
    createRule: "",
    updateRule: '@request.auth.collectionName = "users"',
    deleteRule: null
  };
  var codes = getOrCreate("pairing_codes", function() {
    return new Collection({
      type: "base", name: "pairing_codes",
      listRule: codesRules.listRule, viewRule: codesRules.viewRule,
      createRule: codesRules.createRule, updateRule: codesRules.updateRule,
      deleteRule: codesRules.deleteRule,
      fields: [
        { type: "select", name: "status", required: true, maxSelect: 1, values: ["pending", "claimed", "expired"] },
        { type: "date", name: "expires_at", required: true, min: "", max: "" },
        { type: "date", name: "claimed_at", required: false, min: "", max: "" },
        rel("device", devicesId, true, true),
        rel("claimed_by", usersId)
      ]
    });
  });
  codes.listRule = codesRules.listRule;
  codes.viewRule = codesRules.viewRule;
  codes.createRule = codesRules.createRule;
  codes.updateRule = codesRules.updateRule;
  codes.deleteRule = codesRules.deleteRule;
  if (!hasField(codes, "device")) { codes.fields.add(new RelationField(rel("device", devicesId, true, true))); }
  if (!hasField(codes, "claimed_by")) { codes.fields.add(new RelationField(rel("claimed_by", usersId))); }
  app.save(codes);

  // ── subscriptions : 25 000 FCFA / an ──
  var subsRules = {
    listRule: "user = @request.auth.id",
    viewRule: "user = @request.auth.id",
    createRule: '@request.auth.id != "" && @request.body.user = @request.auth.id',
    updateRule: null,
    deleteRule: null
  };
  var subs = getOrCreate("subscriptions", function() {
    return new Collection({
      type: "base", name: "subscriptions",
      listRule: subsRules.listRule, viewRule: subsRules.viewRule,
      createRule: subsRules.createRule, updateRule: subsRules.updateRule,
      deleteRule: subsRules.deleteRule,
      fields: [
        { type: "select", name: "plan", required: true, maxSelect: 1, values: ["annuel"] },
        { type: "number", name: "amount", required: true, min: 0, onlyInt: true },
        { type: "text", name: "currency", required: true, max: 8 },
        { type: "select", name: "status", required: true, maxSelect: 1, values: ["pending", "active", "expired", "cancelled"] },
        { type: "text", name: "payment_ref", required: false, max: 120 },
        { type: "text", name: "notes", required: false, max: 500 },
        { type: "date", name: "started_at", required: false, min: "", max: "" },
        { type: "date", name: "expires_at", required: false, min: "", max: "" },
        rel("user", usersId, true, true)
      ]
    });
  });
  subs.listRule = subsRules.listRule;
  subs.viewRule = subsRules.viewRule;
  subs.createRule = subsRules.createRule;
  subs.updateRule = subsRules.updateRule;
  subs.deleteRule = subsRules.deleteRule;
  if (!hasField(subs, "user")) { subs.fields.add(new RelationField(rel("user", usersId, true, true))); }
  app.save(subs);

  // ── backups ──
  var backupsRules = {
    listRule: "device = @request.auth.id || owner = @request.auth.id",
    viewRule: "device = @request.auth.id || owner = @request.auth.id",
    createRule: '@request.auth.collectionName = "devices" && @request.auth.id = @request.body.device && @request.auth.sub_active = true && @request.body.owner = @request.auth.owner',
    updateRule: null,
    deleteRule: "owner = @request.auth.id"
  };
  var backups = getOrCreate("backups", function() {
    return new Collection({
      type: "base", name: "backups",
      listRule: backupsRules.listRule, viewRule: backupsRules.viewRule,
      createRule: backupsRules.createRule, updateRule: backupsRules.updateRule,
      deleteRule: backupsRules.deleteRule,
      fields: [
        { type: "number", name: "org_local_id", required: false, onlyInt: true },
        { type: "text", name: "org_name", required: false, max: 120 },
        { type: "text", name: "checksum", required: true, max: 64 },
        { type: "text", name: "app_version", required: false, max: 20 },
        { type: "json", name: "counts", required: false, maxSize: 2000 },
        rel("owner", usersId),
        { type: "file", name: "snapshot", required: true, maxSelect: 1, maxSize: 20971520, mimeTypes: ["application/json", "text/plain"], thumbs: [], protected: true },
        { type: "text", name: "note", required: false, max: 300 },
        rel("device", devicesId, true)
      ],
      indexes: ["CREATE INDEX idx_backups_device ON backups (device)"]
    });
  });
  backups.listRule = backupsRules.listRule;
  backups.viewRule = backupsRules.viewRule;
  backups.createRule = backupsRules.createRule;
  backups.updateRule = backupsRules.updateRule;
  backups.deleteRule = backupsRules.deleteRule;
  if (!hasField(backups, "device")) { backups.fields.add(new RelationField(rel("device", devicesId, true))); }
  if (!hasField(backups, "owner")) { backups.fields.add(new RelationField(rel("owner", usersId))); }
  app.save(backups);
  var backupsId = backups.id;

  // ── exports : CSV liés à une sauvegarde ──
  var exportsRules = {
    listRule: "device = @request.auth.id || owner = @request.auth.id",
    viewRule: "device = @request.auth.id || owner = @request.auth.id",
    createRule: '@request.auth.collectionName = "devices" && @request.auth.sub_active = true && @request.body.device = @request.auth.id && @request.body.owner = @request.auth.owner && @request.body.backup != ""',
    updateRule: null,
    deleteRule: null
  };
  var exportsCol = getOrCreate("exports", function() {
    return new Collection({
      type: "base", name: "exports",
      listRule: exportsRules.listRule, viewRule: exportsRules.viewRule,
      createRule: exportsRules.createRule, updateRule: exportsRules.updateRule,
      deleteRule: exportsRules.deleteRule,
      fields: [
        { type: "select", name: "kind", required: true, maxSelect: 1, values: ["eleves", "notes", "paiements"] },
        { type: "text", name: "label", required: false, max: 160 },
        { type: "file", name: "file", required: true, maxSelect: 1, maxSize: 10485760, mimeTypes: ["text/csv", "text/plain"], thumbs: [], protected: true },
        rel("backup", backupsId, true, true),
        rel("device", devicesId, true),
        rel("owner", usersId)
      ]
    });
  });
  exportsCol.listRule = exportsRules.listRule;
  exportsCol.viewRule = exportsRules.viewRule;
  exportsCol.createRule = exportsRules.createRule;
  exportsCol.updateRule = exportsRules.updateRule;
  exportsCol.deleteRule = exportsRules.deleteRule;
  if (!hasField(exportsCol, "backup")) { exportsCol.fields.add(new RelationField(rel("backup", backupsId, true, true))); }
  if (!hasField(exportsCol, "device")) { exportsCol.fields.add(new RelationField(rel("device", devicesId, true))); }
  if (!hasField(exportsCol, "owner")) { exportsCol.fields.add(new RelationField(rel("owner", usersId))); }
  app.save(exportsCol);
}, (app) => {
  var names = ["exports", "backups", "subscriptions", "pairing_codes", "devices"];
  for (var i = 0; i < names.length; i++) {
    try {
      app.delete(app.findCollectionByNameOrId(names[i]));
    } catch (e) { /* déjà absente */ }
  }
  try {
    var users = app.findCollectionByNameOrId("users");
    var kept = [];
    for (var j = 0; j < users.fields.length; j++) {
      if (users.fields[j].name !== "phone") kept.push(users.fields[j]);
    }
    users.fields = kept;
    app.save(users);
  } catch (e) { /* ignore */ }
});
