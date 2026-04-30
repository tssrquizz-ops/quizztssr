# TSSR Quiz

Quiz interactif pour la formation TSSR — hébergé sur Firebase.

## Structure

```
├── index.html              # Shell principal (charge les modules)
├── css/
│   └── styles.css          # Tous les styles (122 KB)
├── js/
│   ├── firebase-init.js    # Initialisation Firebase (module ES6)
│   ├── data.js             # Banques de questions (~380 questions)
│   ├── mechanics.js        # Mécaniques de rendu (14 types de questions)
│   ├── srs.js              # Révision Ciblée (algorithme SM-2)
│   ├── profile.js          # Profil, Leaderboard, Objectifs
│   └── game.js             # Moteur de jeu, modes, scoring
└── README.md
```

## Déploiement

```bash
git add .
git commit -m "update quiz"
git push
```
Firebase Hosting se met à jour automatiquement.

## Projet Firebase

**ID :** `tssrquizz-2744f`
La config est dans `js/firebase-init.js`.

## Fonctionnalités

- 380+ questions, 14 catégories, 14 mécaniques
- 🎯 Révision Ciblée (répétition espacée adaptative)
- 🏆 Leaderboard de promo Firestore temps réel
- 👤 Profil avatar + titre dynamique
- 🎯 Objectifs quotidiens / hebdomadaires
- ⚙️ Réglages (thème, son, compte)
- 12 modes de jeu
