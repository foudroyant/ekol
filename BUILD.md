# Build & Installateur — Ekol

## Prérequis

- [Node.js](https://nodejs.org/) (pour le CLI Neutralinojs)
- [Inno Setup](https://jrsoftware.org/isdl.php) (pour l'installateur Windows)

## 1. Build l'application

```bash
cd D:\Desktop\Ekol
neu build
```

Le livrable est généré dans `dist/Ekol/` :
```
dist/Ekol/
├── Ekol-win_x64.exe  # Exécutable principal (Windows)
├── resources.neu     # Bundle des ressources
└── ...
```

## 2. Compiler l'installateur

Ouvrir `installer.iss` dans Inno Setup puis cliquer sur **Compiler** (`Ctrl+F9`).

Ou en ligne de commande (si `ISCC.exe` est dans le PATH) :

```bash
ISCC installer.iss
```

L'installateur est généré dans `dist/installer/Ekol-Setup-1.0.0.exe`.

## 3. Distribuer

Donner le fichier `Ekol-Setup-1.0.0.exe` aux utilisateurs — il installe l'app, crée les raccourcis et propose de la lancer.
