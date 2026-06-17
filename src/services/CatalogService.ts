import rawCatalog from '../data/ghosts.catalog.json';
import type { Catalog, GhostDef } from '../data/catalog.types';

/**
 * Loads the bundled ghost catalog and exposes typed lookups. Light runtime
 * guards only — exhaustive validation lives in scripts/validate-catalog.ts,
 * which runs before tests/CI.
 */
export class CatalogService {
  private readonly ghosts: GhostDef[];
  private readonly index: Map<string, GhostDef>;

  constructor(data: Catalog = rawCatalog as Catalog) {
    if (!data || !Array.isArray(data.ghosts) || data.ghosts.length === 0) {
      throw new Error('CatalogService: catalog is empty or malformed.');
    }
    this.ghosts = data.ghosts;
    this.index = new Map(this.ghosts.map((g) => [g.id, g]));
  }

  get all(): GhostDef[] {
    return this.ghosts;
  }

  byId(id: string): GhostDef | undefined {
    return this.index.get(id);
  }
}
