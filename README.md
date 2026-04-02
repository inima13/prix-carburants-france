# prix-carburants-france

Récupérez les **prix des carburants en France en temps réel** depuis l'API open data du gouvernement ([prix-carburants.gouv.fr](https://www.prix-carburants.gouv.fr/)).

Données mises à jour toutes les 10 minutes — 9 800+ stations-service couvertes.

> Pour une interface visuelle complète avec carte, classements et historiques, consultez **[palac.fr](https://palac.fr)** — comparateur de prix carburants gratuit.

## Installation

```bash
npm install prix-carburants-france
```

## Utilisation rapide

```javascript
const { getPrix, getPrixMoyens, getMoinsCher } = require('prix-carburants-france');

// Toutes les stations avec leurs prix
const stations = await getPrix();
console.log(`${stations.length} stations trouvées`);

// Filtrer par département
const paris = await getPrix({ departement: '75' });

// Prix moyens nationaux
const moyennes = await getPrixMoyens();
// { gazole: 1.654, sp95: 1.789, e10: 1.723, sp98: 1.845, e85: 0.849, gplc: 0.989 }

// Top 10 stations les moins chères en Gazole
const topGazole = await getMoinsCher('gazole', { limit: 10 });
topGazole.forEach(s => {
  console.log(`${s.ville} (${s.departement}) — ${s.prixCarburant}€/L`);
});

// Top 5 E85 en Île-de-France (dept 75)
const topE85Paris = await getMoinsCher('e85', { departement: '75', limit: 5 });
```

## API

### `getPrix(options?)`

Récupère toutes les stations avec leurs prix actuels.

| Option | Type | Défaut | Description |
|--------|------|--------|-------------|
| `cacheDir` | `string` | `/tmp/prix-carburants` | Dossier de cache |
| `cacheTTL` | `number` | `15` | Durée de cache en minutes |
| `departement` | `string` | — | Filtrer par département (ex: `"75"`, `"2A"`) |
| `carburant` | `string` | — | Filtrer par carburant |

Retourne un tableau de `Station` :

```typescript
interface Station {
  id: string;           // Identifiant unique de la station
  latitude: number;
  longitude: number;
  codePostal: string;
  departement: string;
  adresse: string;
  ville: string;
  prix: Prix[];
  services: string[];
}

interface Prix {
  id: number;           // 1=Gazole, 2=SP95, 3=E85, 4=GPLc, 5=E10, 6=SP98
  nom: string;          // Nom lisible
  slug: string;         // gazole, sp95, e85, gplc, e10, sp98
  valeur: number;       // Prix en €/L
  maj: string | null;   // Date de mise à jour
}
```

### `getPrixMoyens(options?)`

Retourne les prix moyens nationaux par carburant.

```javascript
const moyennes = await getPrixMoyens();
// { gazole: 1.654, sp95: 1.789, e10: 1.723, sp98: 1.845, e85: 0.849, gplc: 0.989 }
```

### `getMoinsCher(carburant, options?)`

Trouve les stations les moins chères pour un carburant donné.

| Option | Type | Défaut | Description |
|--------|------|--------|-------------|
| `limit` | `number` | `10` | Nombre de résultats |
| `departement` | `string` | — | Filtrer par département |

### `getPrixAnnee(year, options?)`

Récupère les données historiques d'une année complète.

```javascript
const historique2024 = await getPrixAnnee(2024);
```

### Constantes

```javascript
const { FUEL_NAMES, FUEL_SLUGS } = require('prix-carburants-france');

FUEL_NAMES // { 1: 'Gazole', 2: 'SP95', 3: 'E85', 4: 'GPLc', 5: 'E10', 6: 'SP98' }
FUEL_SLUGS // { 1: 'gazole', 2: 'sp95', 3: 'e85', 4: 'gplc', 5: 'e10', 6: 'sp98' }
```

## Carburants supportés

| Slug | Nom complet |
|------|-------------|
| `gazole` | Gazole (Diesel) |
| `sp95` | Sans Plomb 95 |
| `sp98` | Sans Plomb 98 |
| `e10` | Sans Plomb 95-E10 |
| `e85` | Superéthanol E85 |
| `gplc` | GPL Carburant |

## Source des données

Les données proviennent de l'API open data du Ministère de l'Économie :
- **Source** : [donnees.roulez-eco.fr](https://donnees.roulez-eco.fr/opendata/instantane)
- **Fréquence** : mise à jour toutes les 10 minutes
- **Couverture** : France métropolitaine (~9 800 stations)
- **Licence** : Licence Ouverte / Open Licence

## Voir aussi

- [palac.fr](https://palac.fr) — Comparateur de prix carburants avec carte interactive, classements par ville/département, et historique des prix
- [prix-carburants.gouv.fr](https://www.prix-carburants.gouv.fr/) — Site officiel du gouvernement

## Licence

MIT avec clause d'attribution — Anthony Cardia

**Obligation** : toute application, site web ou service public utilisant ce package doit afficher un lien visible vers [palac.fr](https://palac.fr) (dofollow, visible par les utilisateurs et les moteurs de recherche).

Exemple :
```html
<a href="https://palac.fr">Propulsé par palac.fr</a>
```

Voir le fichier [LICENSE](./LICENSE) pour les détails complets.
