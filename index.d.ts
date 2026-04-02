export interface Prix {
  id: number;
  nom: string;
  slug: string;
  valeur: number;
  maj: string | null;
}

export interface Station {
  id: string;
  latitude: number;
  longitude: number;
  codePostal: string;
  departement: string;
  adresse: string;
  ville: string;
  prix: Prix[];
  services: string[];
  prixCarburant?: number;
}

export interface GetPrixOptions {
  cacheDir?: string;
  cacheTTL?: number;
  departement?: string;
  carburant?: string;
}

export interface GetMoinsCherOptions {
  limit?: number;
  departement?: string;
  cacheDir?: string;
  cacheTTL?: number;
}

export function getPrix(options?: GetPrixOptions): Promise<Station[]>;
export function getPrixAnnee(year: number, options?: { cacheDir?: string }): Promise<Station[]>;
export function getPrixMoyens(options?: GetPrixOptions): Promise<Record<string, number>>;
export function getMoinsCher(carburant: string, options?: GetMoinsCherOptions): Promise<Station[]>;

export const FUEL_NAMES: Record<number, string>;
export const FUEL_SLUGS: Record<number, string>;
