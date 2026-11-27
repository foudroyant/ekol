// ─── MOTEUR DE CALCUL DES NOTES ───────────────────────────────────────────────
// Composantes libres : chaque style de notation définit ses composantes et leurs
// poids. La moyenne d'une matière est la moyenne pondérée des composantes.
// Les poids sont normalisés : inutile qu'ils totalisent 100.

function gradeNum(v) {
  if (v === null || v === undefined || v === '') return null;
  var n = Number(v);
  return isNaN(n) ? null : n;
}

// valeurs : { composante_id: valeur }
// composantes : [{ id, nom, groupe, poids }]
// missingAsZero : true => une note absente compte 0 ; false => elle est ignorée
function gradeComputeMoyenneMatiere(valeurs, composantes, missingAsZero) {
  var sum = 0;
  var weightSum = 0;
  var saisies = 0;

  for (var i = 0; i < composantes.length; i++) {
    var c = composantes[i];
    var v = gradeNum(valeurs[c.id]);
    var w = Number(c.poids) || 0;
    if (v !== null) {
      saisies++;
      sum += v * w;
      weightSum += w;
    } else if (missingAsZero) {
      weightSum += w;
    }
  }

  return {
    moyenne: weightSum > 0 ? sum / weightSum : null,
    saisies: saisies,
    total: composantes.length
  };
}

// rows : [{ moyenne, coefficient }]
function gradeComputeMoyenneGenerale(rows, missingAsZero) {
  var sum = 0;
  var coefTotal = 0;
  var saisies = 0;
  var totalNotes = 0;

  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var coef = Number(r.coefficient) || 0;
    totalNotes += Number(r.total) || 0;
    saisies += Number(r.saisies) || 0;

    if (r.moyenne !== null && r.moyenne !== undefined) {
      sum += r.moyenne * coef;
      coefTotal += coef;
    } else if (missingAsZero) {
      coefTotal += coef;
    }
  }

  return {
    moyenne: coefTotal > 0 ? sum / coefTotal : null,
    coefTotal: coefTotal,
    saisies: saisies,
    totalNotes: totalNotes
  };
}

function gradeMention(moyenne, noteMax) {
  if (moyenne === null || moyenne === undefined) return '—';
  var max = Number(noteMax) || 20;
  var pct = max > 0 ? (Number(moyenne) / max) * 100 : 0;
  if (pct >= 80) return 'Excellent';
  if (pct >= 70) return 'Très bien';
  if (pct >= 60) return 'Bien';
  if (pct >= 50) return 'Assez bien';
  if (pct >= 40) return 'Passable';
  return 'Insuffisant';
}

function gradeMentionClass(mention) {
  switch (mention) {
    case 'Excellent':  return 'badge-excellent';
    case 'Très bien':  return 'badge-tresbien';
    case 'Bien':       return 'badge-bien';
    case 'Assez bien': return 'badge-assez';
    case 'Passable':   return 'badge-passable';
    case 'Insuffisant':return 'badge-insuffisant';
    default:           return 'badge-neutral';
  }
}

// Attribue un rang (même rang en cas d'égalité) aux résultats d'une classe.
// Les élèves sans aucune note saisie ne sont pas classés (rang null) : une
// moyenne à 0 par absence de note ne doit pas fausser le classement.
function gradeAssignRanks(results) {
  var ranked = [];
  var unranked = [];
  for (var i = 0; i < results.length; i++) {
    var r = results[i];
    if (r.saisies > 0 && r.moyenne_generale !== null && r.moyenne_generale !== undefined) {
      ranked.push(r);
    } else {
      r.rang = null;
      unranked.push(r);
    }
  }

  ranked.sort(function(a, b) { return b.moyenne_generale - a.moyenne_generale; });

  var last = null;
  var lastRank = 0;
  for (var j = 0; j < ranked.length; j++) {
    var res = ranked[j];
    if (res.moyenne_generale !== last) {
      lastRank = j + 1;
      last = res.moyenne_generale;
    }
    res.rang = lastRank;
  }
}

function gradeFormat(v, decimals) {
  if (v === null || v === undefined) return '—';
  var d = decimals === undefined ? 2 : decimals;
  return Number(v).toFixed(d).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

function gradePercent(saisies, total) {
  if (!total) return 0;
  return Math.round((saisies / total) * 100);
}
