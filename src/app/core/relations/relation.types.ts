export const RELATIONS_FILE = 'relations.json';
export const RELATION_SCHEMA_VERSION = 1;

// why: generic across every linkable kind — RelationsService never imports a
//      feature to know what a "note" or "goal" is (regla §4.2.10). Title/ruta
//      se resuelven aparte contra el índice de búsqueda (§10bis).
export interface EntityRef {
  readonly kind: string;
  readonly id: string;
}

export type RelationOrigin = 'editor' | 'manual';

export interface Relation {
  readonly id: string;
  readonly from: EntityRef;
  readonly to: EntityRef;
  readonly origin: RelationOrigin;
  // why: sólo origin:'editor' la completa (frase alrededor del link) u origin:'manual'
  //      cuando el usuario nombra el hilo a mano (§10bis, hilos en /files). Congelada al
  //      crear — no se re-deriva si el texto de origen cambia después (mismo criterio
  //      que el subject de un commit compactado en §12).
  readonly contextSnippet?: string;
  readonly createdAt: string;
  readonly [key: string]: unknown;
}

export interface RelationsFile {
  readonly schemaVersion: number;
  readonly relations: readonly Relation[];
  readonly [key: string]: unknown;
}

export const sameRef = (a: EntityRef, b: EntityRef): boolean => a.kind === b.kind && a.id === b.id;

export const refKey = (ref: EntityRef): string => `${ref.kind}:${ref.id}`;
