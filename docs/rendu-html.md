# Rendu HTML → Image / PDF

Comment transformer une page HTML (reçu, facture, certificat) en image PNG/JPEG ou en PDF, pour impression ou export.

---

## 1. html2canvas (JS côté client)

**Principe** : Parcourt le DOM, dessine chaque élément sur un `<canvas>` via l'API Canvas 2D, puis exporte en PNG/JPEG.

**Avantages** :
- Zéro dépendance externe (lib JS uniquement)
- Fonctionne dans Neutralinojs/WebView2
- Appels asynchrones, pas de sous-processus

**Inconvénients** :
- Rendu parfois imparfait (certains styles CSS3, dégradés, ombres)
- Impossible de générer du PDF natif (faut d'abord faire une image, puis l'emballer)
- Pas de saut de page automatique

**Installation** :
```html
<script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
```
Ou télécharger le fichier et l'inclure localement.

**Utilisation** :
```js
var element = document.getElementById('recu');
html2canvas(element).then(function(canvas) {
  var img = canvas.toDataURL('image/png');
  // img est un data:image/png;base64,...
  // Pour télécharger :
  var link = document.createElement('a');
  link.download = 'recu.png';
  link.href = img;
  link.click();
});
```

Pour du JPEG avec qualité :
```js
canvas.toDataURL('image/jpeg', 0.92)
```

Pour du PDF : utiliser `canvas.toDataURL('image/png')` puis l'injecter dans `jsPDF` (lib tierce) :
```js
var pdf = new jspdf.jsPDF();
pdf.addImage(imgData, 'PNG', 0, 0, 210, 297);
pdf.save('recu.pdf');
```

---

## 2. Puppeteer (Node.js)

**Principe** : Lance un Chromium headless, charge une page HTML, prend une capture ou génère un PDF natif.

**Avantages** :
- Rendu pixel-perfect (Chromium véritable)
- PDF natif avec sauts de page, en-têtes, pieds de page
- Contrôle total (marges, format, viewport)

**Inconvénients** :
- Nécessite Node.js + téléchargement de Chromium (~300 Mo)
- Sous-processus à lancer depuis l'app (plus lourd)
- Pas de rendu en temps réel

**Installation** :
```bash
npm install puppeteer
```

**Utilisation (script Node.js)** :
```js
const puppeteer = require('puppeteer');

async function generateRecu(htmlContent, outputPath) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

  // PNG
  await page.screenshot({ path: outputPath + '.png', fullPage: true });

  // PDF
  await page.pdf({
    path: outputPath + '.pdf',
    format: 'A4',
    printBackground: true,
    margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
  });

  await browser.close();
}
```

**Lancement depuis Neutralinojs** :
```js
NL_OS.runCommand('node recu-generator.js --html content.html --out recu.pdf');
```

---

## 3. Playwright (Node.js)

Similaire à Puppeteer mais multi-navigateur (Chromium, Firefox, WebKit).

**Installation** :
```bash
npm install playwright
npx playwright install chromium
```

**Utilisation** :
```js
const { chromium } = require('playwright');
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html);
await page.screenshot({ path: 'recu.png', fullPage: true });
await page.pdf({ path: 'recu.pdf', format: 'A4' });
await browser.close();
```

API quasi identique à Puppeteer. Playwright est plus récent, mieux maintenu.

---

## 4. wkhtmltoimage / wkhtmltopdf (binaire C++)

**Principe** : Binaire unique, basé sur QtWebKit (moteur de rendu HTML). Prend une URL ou un fichier HTML et produit une image ou un PDF.

**Avantages** :
- Binaire unique, pas de dépendance
- Léger (~20 Mo contre 300+ pour Chromium)
- Fonctionne en ligne de commande simple

**Inconvénients** :
- QtWebKit est obsolète (pas de Flexbox, Grid, CSS Variables, etc.)
- Rendu approximatif sur du CSS moderne
- Projet mort (plus maintenu depuis 2017)

**Installation** :
Télécharger depuis https://wkhtmltopdf.org/downloads.html

**Utilisation** :
```bash
wkhtmltoimage --quality 90 --width 400 input.html output.png
wkhtmltopdf --orientation Portrait --page-size A4 input.html output.pdf
```

Options utiles :
- `--quality N` : qualité JPEG (1-100)
- `--width N` : largeur en pixels
- `--height N` : hauteur en pixels
- `--crop-w N` : recadrage largeur
- `--crop-h N` : recadrage hauteur
- `--encoding UTF-8` : encodage
- `--enable-local-file-access` : accès aux fichiers locaux (CSS, images)
- `--no-stop-slow-scripts` : ne pas interrompre les scripts lents

---

## Comparaison

| Outil | Type | Rendu | PDF natif | Taille | Maintenu |
|---|---|---|---|---|---|
| html2canvas | JS client | Partiel | Non (via jsPDF) | 30 Ko | Oui |
| Puppeteer | Node.js | Parfait | Oui | ~300 Mo | Oui |
| Playwright | Node.js | Parfait | Oui | ~300 Mo | Oui |
| wkhtmltoimage | Binaire C++ | Obsolète | Oui | ~20 Mo | Non |

---

## Recommandation pour Ekol

1. **Si le reçu est simple** (tableau, texte, pas de CSS avancé) : utiliser `wkhtmltoimage.exe` embarqué dans l'app — binaire unique, léger, appelé via `NL_OS.runCommand()`

2. **Si le reçu utilise Tailwind/CSS moderne** : utiliser `html2canvas` côté client — pas de sous-processus, intégration directe dans le flux de paiement

3. **Pour du PDF professionnel** : utiliser Playwright en sous-processus Node.js — le rendu est le plus fidèle

La solution la plus simple pour commencer : **html2canvas**, car elle ne nécessite aucun binaire supplémentaire et fonctionne directement dans WebView2.
