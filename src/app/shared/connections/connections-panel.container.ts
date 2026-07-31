import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { resolveRelations, type ResolvedRelation } from '@core/relations/resolve-relation';
import { RelationsService } from '@core/relations/relations.service';
import { SearchIndexService } from '@core/search/search-index.service';
import { ConnectionsGraphOverlayComponent } from '@shared/connections/connections-graph-overlay.component';
import { entityKindIcon } from '@shared/entity-cards/entity-kind-icon';
import { IconComponent } from '@shared/icon/icon.component';
import type { IconName } from '@shared/icon/icons.data';

// why: mismo molde que CommentsPanelContainer/DraftsPanelContainer —
//      self-contained dado sólo entityKind/entityId, inyecta sus propios
//      servicios en vez de recibir datos ya resueltos del padre. A
//      diferencia de esos dos, no vive detrás de un toggle: se oculta sola
//      cuando no hay nada que mostrar (ver features.md §10bis).
@Component({
  selector: 'mc-connections-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, ConnectionsGraphOverlayComponent],
  templateUrl: './connections-panel.container.html',
  styleUrl: './connections-panel.container.css',
})
export class ConnectionsPanelContainer {
  readonly entityKind = input.required<string>();
  readonly entityId = input.required<string>();

  private readonly relationsService = inject(RelationsService);
  private readonly search = inject(SearchIndexService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  private readonly selfRef = computed(() => ({ kind: this.entityKind(), id: this.entityId() }));

  protected readonly outgoing = computed<readonly ResolvedRelation[]>(() =>
    resolveRelations(this.relationsService.outgoingFor(this.selfRef()), 'outgoing', this.search),
  );
  protected readonly backlinks = computed<readonly ResolvedRelation[]>(() =>
    resolveRelations(this.relationsService.backlinksFor(this.selfRef()), 'backlink', this.search),
  );
  protected readonly hasAny = computed(
    () => this.outgoing().length > 0 || this.backlinks().length > 0,
  );
  protected readonly graphOpen = signal(false);

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected iconFor(kind: string): IconName {
    return entityKindIcon(kind);
  }

  protected open(r: ResolvedRelation): void {
    if (r.title === null) return;
    void this.router.navigate([...r.route]);
  }

  protected unlink(relationId: string): void {
    void this.relationsService.remove(relationId);
  }
}
