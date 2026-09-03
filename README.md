# Tournoi de l'été — Systerel Ping-pong

Site de suivi du tournoi interne : résultats des poules, tableau principal,
tableau secondaire, winner brackets et loser brackets.

## Développement local

```bash
npm install
npm run dev
```

## Modifier un résultat

Le bouton **Saisir un score** du site ouvre un formulaire GitHub. Seul le compte
`Dayonixe` est accepté par l'automatisation. Une saisie valide met à jour
`data/tournament.json`; le site est ensuite recalculé et republié.

Format attendu pour les sets : `11/7, 8/11, 12/10`.

## Publication

Le workflow `deploy-pages.yml` construit le site statique et le publie sur
GitHub Pages après chaque modification de la branche `main`.
