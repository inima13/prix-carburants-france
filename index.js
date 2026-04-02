/**
 * prix-carburants-france
 * API wrapper pour les prix des carburants en France
 * Données temps réel du gouvernement (prix-carburants.gouv.fr)
 *
 * @see https://palac.fr — Comparateur visuel des prix carburants
 * @license MIT
 */

const { XMLParser } = require('fast-xml-parser');
const { createWriteStream, existsSync, mkdirSync, unlinkSync, readFileSync } = require('fs');
const { pipeline } = require('stream/promises');
const { Readable } = require('stream');
const { join } = require('path');
const { execSync } = require('child_process');

const ZIP_URL = 'https://donnees.roulez-eco.fr/opendata/instantane';
const YEAR_URL = (year) => `https://donnees.roulez-eco.fr/opendata/annee/${year}`;

const FUEL_NAMES = {
  1: 'Gazole',
  2: 'SP95',
  3: 'E85',
  4: 'GPLc',
  5: 'E10',
  6: 'SP98'
};

const FUEL_SLUGS = {
  1: 'gazole',
  2: 'sp95',
  3: 'e85',
  4: 'gplc',
  5: 'e10',
  6: 'sp98'
};

/**
 * Télécharge et parse les prix carburants instantanés
 * @param {Object} [options]
 * @param {string} [options.cacheDir] - Dossier de cache pour le ZIP (défaut: /tmp)
 * @param {number} [options.cacheTTL] - Durée de cache en minutes (défaut: 15)
 * @param {string} [options.departement] - Filtrer par code département (ex: "75")
 * @param {string} [options.carburant] - Filtrer par carburant: gazole, sp95, sp98, e10, e85, gplc
 * @returns {Promise<Station[]>} Liste des stations avec leurs prix
 */
async function getPrix(options = {}) {
  const {
    cacheDir = join(require('os').tmpdir(), 'prix-carburants'),
    cacheTTL = 15,
    departement,
    carburant
  } = options;

  const xmlContent = await downloadAndExtract(ZIP_URL, cacheDir, cacheTTL);
  let stations = parseXML(xmlContent);

  if (departement) {
    const dept = departement.padStart(2, '0');
    stations = stations.filter(s => s.departement === dept);
  }

  if (carburant) {
    const slug = carburant.toLowerCase();
    const fuelId = Object.entries(FUEL_SLUGS).find(([, v]) => v === slug)?.[0];
    if (fuelId) {
      stations = stations.filter(s => s.prix.some(p => p.id === Number(fuelId)));
    }
  }

  return stations;
}

/**
 * Récupère les prix d'une année complète (historique)
 * @param {number} year - Année (ex: 2024)
 * @param {Object} [options]
 * @param {string} [options.cacheDir] - Dossier de cache
 * @returns {Promise<Station[]>}
 */
async function getPrixAnnee(year, options = {}) {
  const { cacheDir = join(require('os').tmpdir(), 'prix-carburants') } = options;
  const xmlContent = await downloadAndExtract(YEAR_URL(year), cacheDir, 1440); // cache 24h
  return parseXML(xmlContent);
}

/**
 * Récupère le prix moyen national par carburant
 * @param {Object} [options] - Mêmes options que getPrix
 * @returns {Promise<Object>} Prix moyens par carburant { gazole: 1.654, sp95: 1.789, ... }
 */
async function getPrixMoyens(options = {}) {
  const stations = await getPrix(options);
  const sums = {};
  const counts = {};

  for (const station of stations) {
    for (const prix of station.prix) {
      const slug = FUEL_SLUGS[prix.id];
      if (!slug) continue;
      sums[slug] = (sums[slug] || 0) + prix.valeur;
      counts[slug] = (counts[slug] || 0) + 1;
    }
  }

  const moyennes = {};
  for (const slug of Object.keys(sums)) {
    moyennes[slug] = Math.round((sums[slug] / counts[slug]) * 1000) / 1000;
  }
  return moyennes;
}

/**
 * Trouve les stations les moins chères
 * @param {string} carburant - gazole, sp95, sp98, e10, e85, gplc
 * @param {Object} [options]
 * @param {number} [options.limit] - Nombre de résultats (défaut: 10)
 * @param {string} [options.departement] - Filtrer par département
 * @returns {Promise<Station[]>}
 */
async function getMoinsCher(carburant, options = {}) {
  const { limit = 10, ...rest } = options;
  const fuelId = Number(Object.entries(FUEL_SLUGS).find(([, v]) => v === carburant.toLowerCase())?.[0]);
  if (!fuelId) throw new Error(`Carburant inconnu: ${carburant}. Valeurs: ${Object.values(FUEL_SLUGS).join(', ')}`);

  const stations = await getPrix(rest);

  return stations
    .map(s => {
      const prix = s.prix.find(p => p.id === fuelId);
      return prix ? { ...s, prixCarburant: prix.valeur } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.prixCarburant - b.prixCarburant)
    .slice(0, limit);
}

// --- Internal helpers ---

async function downloadAndExtract(url, cacheDir, cacheTTL) {
  if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true });

  const zipPath = join(cacheDir, 'data.zip');
  const xmlPath = join(cacheDir, 'data.xml');

  // Check cache
  if (existsSync(zipPath)) {
    const { mtimeMs } = require('fs').statSync(zipPath);
    const ageMin = (Date.now() - mtimeMs) / 60000;
    if (ageMin < cacheTTL && existsSync(xmlPath)) {
      return readFileSync(xmlPath, 'latin1');
    }
  }

  // Download
  const res = await fetch(url, {
    headers: { 'User-Agent': 'prix-carburants-france/1.0 (npm package)' }
  });
  if (!res.ok) throw new Error(`Erreur HTTP ${res.status} depuis ${url}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  require('fs').writeFileSync(zipPath, buffer);

  // Extract
  try {
    execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${cacheDir}' -Force"`, { stdio: 'pipe' });
  } catch {
    try {
      execSync(`unzip -o "${zipPath}" -d "${cacheDir}"`, { stdio: 'pipe' });
    } catch {
      throw new Error('Impossible d\'extraire le ZIP. Installez unzip ou utilisez Windows.');
    }
  }

  // Find XML
  const files = require('fs').readdirSync(cacheDir).filter(f => f.endsWith('.xml'));
  if (files.length === 0) throw new Error('Aucun fichier XML trouvé dans l\'archive');

  const extractedXml = join(cacheDir, files[0]);
  if (extractedXml !== xmlPath) {
    require('fs').renameSync(extractedXml, xmlPath);
  }

  return readFileSync(xmlPath, 'latin1');
}

function parseXML(xmlContent) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (name) => ['prix', 'service', 'pdv'].includes(name)
  });

  const parsed = parser.parse(xmlContent);
  const pdvs = parsed?.pdv_liste?.pdv || parsed?.pdv || [];

  return pdvs.map(pdv => {
    const prix = (pdv.prix || []).map(p => ({
      id: Number(p['@_id']),
      nom: FUEL_NAMES[Number(p['@_id'])] || `Carburant ${p['@_id']}`,
      slug: FUEL_SLUGS[Number(p['@_id'])] || 'inconnu',
      valeur: Number(p['@_valeur']) / 1000,
      maj: p['@_maj'] || null
    }));

    const services = pdv.services?.service || [];

    const cp = String(pdv['@_cp'] || '').padStart(5, '0');

    return {
      id: String(pdv['@_id']),
      latitude: Number(pdv['@_latitude']) / 100000,
      longitude: Number(pdv['@_longitude']) / 100000,
      codePostal: cp,
      departement: cp.startsWith('97') ? cp.slice(0, 3) : cp.slice(0, 2),
      adresse: pdv.adresse || '',
      ville: pdv.ville || '',
      prix,
      services: Array.isArray(services) ? services : [services].filter(Boolean)
    };
  });
}

module.exports = { getPrix, getPrixAnnee, getPrixMoyens, getMoinsCher, FUEL_NAMES, FUEL_SLUGS };
