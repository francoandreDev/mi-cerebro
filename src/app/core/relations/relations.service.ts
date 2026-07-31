import { Injectable, computed, inject, signal } from '@angular/core';

import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';
import { FsService } from '@core/fs/fs.service';
import type { NativeDirRef } from '@core/fs/native-fs.types';
import { WorkspaceService } from '@core/fs/workspace.service';
import { MigrationsService } from '@core/migrations/migrations.service';

import {
  RELATIONS_FILE,
  RELATION_SCHEMA_VERSION,
  refKey,
  sameRef,
  type EntityRef,
  type Relation,
  type RelationOrigin,
  type RelationsFile,
} from './relation.types';

const RELATION_KIND = 'relation';

export interface CreateRelationParams {
  readonly from: EntityRef;
  readonly to: EntityRef;
  readonly origin: RelationOrigin;
  readonly contextSnippet?: string;
}

// why: registro transversal, mismo molde que TagsService — un solo archivo
//      centralizado (.mi-cerebro/relations.json) en vez de embeber links en
//      cada entidad, así un backlink es un filter sobre el array, no un
//      escaneo de todas las entidades (docs/proyecto/features.md §10bis).
//      No conoce features: sólo {kind, id} en cada extremo.
@Injectable({ providedIn: 'root' })
export class RelationsService {
  private readonly fs = inject(FsService);
  private readonly workspace = inject(WorkspaceService);
  private readonly migrations = inject(MigrationsService);

  private readonly relationsSignal = signal<readonly Relation[]>([]);
  private loaded = false;

  readonly relations = this.relationsSignal.asReadonly();

  private readonly byFromKeySignal = computed(() => groupBy(this.relationsSignal(), (r) => r.from));
  private readonly byToKeySignal = computed(() => groupBy(this.relationsSignal(), (r) => r.to));

  constructor() {
    this.migrations.register({ kind: RELATION_KIND, latest: RELATION_SCHEMA_VERSION, steps: [] });
  }

  async refresh(): Promise<readonly Relation[]> {
    const root = this.requireRoot();
    const exists = await this.fs.hasEntry(root, RELATIONS_FILE);
    const data: RelationsFile = exists
      ? await this.fs.readJson<RelationsFile>(root, RELATIONS_FILE)
      : { schemaVersion: RELATION_SCHEMA_VERSION, relations: [] };
    const migrated = await this.migrations.migrate<RelationsFile>(RELATION_KIND, data);
    this.relationsSignal.set(migrated.relations);
    this.loaded = true;
    return migrated.relations;
  }

  outgoingFor(ref: EntityRef): readonly Relation[] {
    return this.byFromKeySignal().get(refKey(ref)) ?? [];
  }

  backlinksFor(ref: EntityRef): readonly Relation[] {
    return this.byToKeySignal().get(refKey(ref)) ?? [];
  }

  // why: idempotente — vincular dos veces la misma entidad desde el mismo
  //      origen (doble click, reintento) no debe crear filas duplicadas.
  async create(params: CreateRelationParams): Promise<Relation> {
    if (!this.loaded) await this.refresh();
    const existing = this.relationsSignal().find(
      (r) => sameRef(r.from, params.from) && sameRef(r.to, params.to),
    );
    if (existing) return existing;

    const relation: Relation = {
      id: crypto.randomUUID(),
      from: params.from,
      to: params.to,
      origin: params.origin,
      createdAt: new Date().toISOString(),
      ...(params.contextSnippet ? { contextSnippet: params.contextSnippet } : {}),
    };
    await this.persist([...this.relationsSignal(), relation]);
    return relation;
  }

  async remove(id: string): Promise<void> {
    const next = this.relationsSignal().filter((r) => r.id !== id);
    if (next.length === this.relationsSignal().length) return;
    await this.persist(next);
  }

  private async persist(next: readonly Relation[]): Promise<void> {
    const root = this.requireRoot();
    const file: RelationsFile = { schemaVersion: RELATION_SCHEMA_VERSION, relations: next };
    await this.fs.writeFileAtomic(root, RELATIONS_FILE, JSON.stringify(file, null, 2));
    this.relationsSignal.set(next);
  }

  private requireRoot(): NativeDirRef {
    const root = this.workspace.root();
    if (!root) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    return root;
  }
}

function groupBy(
  relations: readonly Relation[],
  pick: (r: Relation) => EntityRef,
): ReadonlyMap<string, readonly Relation[]> {
  const map = new Map<string, Relation[]>();
  for (const r of relations) {
    const key = refKey(pick(r));
    const list = map.get(key);
    if (list) list.push(r);
    else map.set(key, [r]);
  }
  return map;
}
