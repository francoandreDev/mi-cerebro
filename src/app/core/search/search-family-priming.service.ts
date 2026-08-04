import { Injectable, inject } from '@angular/core';

import { CommentsService, commentSearchDocs } from '@core/versioning/comments.service';
import { DraftsService, draftSearchDocs } from '@core/versioning/drafts.service';

import { SearchIndexService } from './search-index.service';
import type { SearchDoc } from './search.types';

// Walks the active family's comments/draft branches (never checked out to
// the working tree) to populate the 'comment'/'draft' search kinds — the
// only way those get indexed, since unlike main entities they don't live
// on disk for WorkspaceRefreshService.refreshAll() to walk. Runs at boot
// (once the active family is known) and again after every variant switch,
// since a different family's branches hold unrelated data.
@Injectable({ providedIn: 'root' })
export class SearchFamilyPrimingService {
  private readonly comments = inject(CommentsService);
  private readonly drafts = inject(DraftsService);
  private readonly search = inject(SearchIndexService);

  async primeActiveFamily(): Promise<void> {
    await Promise.all([this.primeComments(), this.primeDrafts()]);
  }

  private async primeComments(): Promise<void> {
    const ids = await this.comments.listEntityIds();
    const docs: SearchDoc[] = [];
    for (const id of ids) {
      const file = await this.comments.read(id);
      docs.push(...commentSearchDocs(id, this.titleFor(id), file.comments));
    }
    await this.search.rebuildKind('comment', docs);
  }

  private async primeDrafts(): Promise<void> {
    const ids = await this.drafts.listEntityIds();
    const docs: SearchDoc[] = [];
    for (const id of ids) {
      const file = await this.drafts.read(id);
      docs.push(...draftSearchDocs(id, this.titleFor(id), file.marks));
    }
    await this.search.rebuildKind('draft', docs);
  }

  private titleFor(entityId: string): string {
    return this.search.getTitle(entityId) ?? entityId;
  }
}
