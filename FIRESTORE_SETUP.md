# Configuration Firestore

## Déployer les règles de sécurité

Les règles sont dans `firestore.rules`. Sans déploiement, l’app affiche des erreurs « permission denied » pour le classement, les promos et les duels en ligne.

```bash
firebase login
firebase use tssrquizz-2744f
firebase deploy --only firestore:rules
```

## Administrateurs

Le panneau « Admin » (menu) n’est plus protégé par un code dans le JavaScript. Il faut **créer un document** dans Firestore :

1. Console Firebase → Firestore Database  
2. Collection : `admins`  
3. ID du document : **exactement** l’UID du compte (copier depuis Authentication → utilisateur)  
4. Contenu : vide `{}` ou un champ factice ; la **présence** du document suffit.

Seuls ces comptes peuvent supprimer des entrées `leaderboard` ou `promos` via le panneau.

## Collections utilisées

| Collection    | Usage |
|---------------|--------|
| `users`       | Sauvegarde progression / profil |
| `leaderboard` | Classement public |
| `promos`      | Groupes promo |
| `duels`       | Sessions multijoueur temporaires |
| `admins`      | Droits admin (lecture restreinte par règle) |
