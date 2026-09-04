# Tournoi de l'été — Systerel Ping-pong

Site de suivi du tournoi interne : résultats des poules, tableau principal,
tableau secondaire, winner brackets et loser brackets.

## Développement local

```bash
npm install
npm run dev
```

## Gérer un résultat

Le bouton **Gérer les scores** du site ouvre un formulaire GitHub permettant
d'enregistrer, de corriger ou de supprimer un résultat. Seul le compte
`Dayonixe` est accepté par l'automatisation. Une demande valide met à jour
`data/tournament.json`; le site est ensuite recalculé et republié. Si une
correction change le vainqueur, ou si un résultat est supprimé, les résultats
déjà saisis qui en dépendent sont automatiquement effacés.

Format attendu pour les sets : `11/7, 8/11, 12/10`.

## Publication

Le workflow `deploy-pages.yml` construit le site statique et le publie sur
GitHub Pages après chaque modification de la branche `main`.
