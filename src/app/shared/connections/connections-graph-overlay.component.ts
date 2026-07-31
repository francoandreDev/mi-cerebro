import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import type { EntityRef } from '@core/relations/relation.types';
import { resolveRelations } from '@core/relations/resolve-relation';
import { RelationsService } from '@core/relations/relations.service';
import { routeFor } from '@core/search/kind-routes';
import { SearchIndexService } from '@core/search/search-index.service';
import { IconComponent } from '@shared/icon/icon.component';

type Direction = 'outgoing' | 'backlink';

export interface GraphNodeVm {
  readonly kind: string;
  readonly entityId: string;
  readonly title: string | null;
  readonly directions: ReadonlySet<Direction>;
  readonly x: number;
  readonly y: number;
}

const CENTER = 200;
const RADIUS = 140;
const LABEL_MAX = 18;

// why: vista de grafo de 1 salto (§10bis "explícitamente fuera" original —
//      ahora sí se pide). No es el grafo completo del workspace (sería un
//      hairball ilegible sin layout de fuerzas, fuera de alcance §4.8
//      YAGNI) — muestra el nodo central + sus vecinos directos, y clickear
//      un vecino recentra el grafo sobre él ("caminar" el grafo), no
//      navega. Mismo lenguaje visual que goal-constellation-editor (círculos
//      + líneas en SVG puro), sin íconos por kind dentro del nodo — se
//      resolvería con foreignObject, complejidad no justificada para el
//      primer corte.
@Component({
  selector: 'mc-connections-graph-overlay',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './connections-graph-overlay.component.html',
  styleUrl: './connections-graph-overlay.component.css',
})
export class ConnectionsGraphOverlayComponent {
  readonly centerKind = input.required<string>();
  readonly centerId = input.required<string>();
  readonly dismiss = output<void>();

  private readonly relationsService = inject(RelationsService);
  private readonly search = inject(SearchIndexService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  // why: nullable en vez de sembrado en el constructor — leer un input
  //      required() dentro del constructor dispara NG8118 (Angular lo trata
  //      como demasiado temprano pese a que el valor ya está bindeado). `ref`
  //      resuelve el valor real, con el input como default hasta el primer
  //      recentrado.
  private readonly current = signal<EntityRef | null>(null);
  protected readonly ref = computed<EntityRef>(
    () => this.current() ?? { kind: this.centerKind(), id: this.centerId() },
  );
  protected readonly historyStack = signal<readonly EntityRef[]>([]);

  protected readonly centerTitle = computed(() => this.search.getTitle(this.ref().id));

  protected readonly neighbors = computed<readonly GraphNodeVm[]>(() => {
    const ref = this.ref();
    const outgoing = resolveRelations(
      this.relationsService.outgoingFor(ref),
      'outgoing',
      this.search,
    );
    const backlinks = resolveRelations(
      this.relationsService.backlinksFor(ref),
      'backlink',
      this.search,
    );
    const byKey = new Map<
      string,
      { kind: string; entityId: string; title: string | null; directions: Set<Direction> }
    >();
    const tag = (
      list: readonly { kind: string; entityId: string; title: string | null }[],
      direction: Direction,
    ): void => {
      for (const r of list) {
        const key = `${r.kind}:${r.entityId}`;
        const entry = byKey.get(key) ?? {
          kind: r.kind,
          entityId: r.entityId,
          title: r.title,
          directions: new Set<Direction>(),
        };
        entry.directions.add(direction);
        byKey.set(key, entry);
      }
    };
    tag(outgoing, 'outgoing');
    tag(backlinks, 'backlink');

    const list = [...byKey.values()];
    const n = list.length;
    return list.map((item, i) => {
      const angle = (i / Math.max(n, 1)) * 2 * Math.PI - Math.PI / 2;
      return {
        ...item,
        x: CENTER + RADIUS * Math.cos(angle),
        y: CENTER + RADIUS * Math.sin(angle),
      };
    });
  });

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected label(title: string | null): string {
    if (title === null) return this.t('connections.orphaned');
    const text = title || this.t('connections.untitled');
    return text.length > LABEL_MAX ? `${text.slice(0, LABEL_MAX - 1)}…` : text;
  }

  protected lineClass(n: GraphNodeVm): 'both' | 'outgoing' | 'backlink' {
    if (n.directions.size === 2) return 'both';
    return n.directions.has('outgoing') ? 'outgoing' : 'backlink';
  }

  protected onNeighborClick(n: GraphNodeVm): void {
    if (n.title === null) return;
    this.historyStack.update((stack) => [...stack, this.ref()]);
    this.current.set({ kind: n.kind, id: n.entityId });
  }

  protected goBack(): void {
    const stack = this.historyStack();
    const prev = stack[stack.length - 1];
    if (!prev) return;
    this.historyStack.set(stack.slice(0, -1));
    this.current.set(prev);
  }

  protected openCurrent(): void {
    const ref = this.ref();
    const title = this.centerTitle();
    if (title === null) return;
    void this.router.navigate([...routeFor(ref.kind, ref.id, title)]);
    this.dismiss.emit();
  }
}
