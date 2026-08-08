import { Injectable, inject } from '@angular/core';

import { CommentsService, commentSearchDocs } from '@core/versioning/comments.service';
import { DraftsService, draftSearchDocs } from '@core/versioning/drafts.service';
import { stripHeadsPrefix } from '@core/versioning/variants.io';
import { VariantsService } from '@core/versioning/variants.service';
import { VersioningService } from '@core/versioning/versioning.service';

import { SearchIndexService } from './search-index.service';
import type { SearchDoc } from './search.types';

// why: a full changedPaths() tree-walk per commit is real I/O (pre-OPFS,
//      docs/deferred/versionado.md) — capped well below the ~1000-commit
//      aggregate window /history uses, so a variant switch doesn't stall
//      on indexing years of history the user is unlikely to full-text
//      search anyway (recents dominate "¿cuándo toqué X?" lookups).
const COMMIT_INDEX_DEPTH = 150;

// Walks the active family's comments/draft branches (never checked out to
// the working tree) to populate the 'comment'/'draft' search kinds — the
// only way those get indexed, since unlike main entities they don't live
// on disk for WorkspaceRefreshService.refreshAll() to walk. Runs at boot
// (once the active family is known) and again after every variant switch,
// since a different family's branches hold unrelated data. Commits share
// the same problem for a different reason: the commit log itself has no
// on-disk representation for refreshAll() to walk, so it's primed here too.
@Injectable({ providedIn: 'root' })
export class SearchFamilyPrimingService {
  private readonly comments = inject(CommentsService);
  private readonly drafts = inject(DraftsService);
  private readonly search = inject(SearchIndexService);
  private readonly versioning = inject(VersioningService);
  private readonly variants = inject(VariantsService);

  async primeActiveFamily(): Promise<void> {
    await Promise.all([this.primeComments(), this.primeDrafts(), this.primeCommits()]);
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

  // Full-text over commit messages + touched entity titles (docs/deferred/
  // versionado.md), so "¿cuándo toqué X?" is answerable from the palette
  // without opening /history and scanning estratos by hand.
  private async primeCommits(): Promise<void> {
    try {
      const active = this.variants.getActive();
      const refs = active
        ? [active.refs.main, active.refs.comments, active.refs.draft].map(stripHeadsPrefix)
        : undefined;
      const commits = await this.versioning.log(COMMIT_INDEX_DEPTH, refs);
      const docs = await Promise.all(commits.map((c) => this.commitDoc(c.oid, c.message)));
      await this.search.rebuildKind('commit', docs);
    } catch {
      // why: no workspace/repo yet (first boot before folder pick, or a
      //      test environment without FsService wiring) — the 'commit'
      //      kind just stays empty rather than breaking the other two
      //      primes this runs alongside via Promise.all.
    }
  }

  private async commitDoc(oid: string, message: string): Promise<SearchDoc> {
    let touchedTitles: readonly string[] = [];
    try {
      const paths = await this.versioning.changedPaths(oid);
      const titles = paths
        .map((p) => entityIdFromPath(p))
        .filter((id): id is string => id !== null)
        .map((id) => this.search.getTitle(id))
        .filter((t): t is string => !!t);
      touchedTitles = [...new Set(titles)];
    } catch {
      // best-effort — a commit whose parent/tree can't be walked (root
      // commit edge cases, corrupted history) still gets indexed by
      // message alone rather than dropped entirely.
    }
    return {
      id: `commit:${oid}`,
      kind: 'commit',
      title: message.trim().split('\n')[0] ?? oid.slice(0, 7),
      body: [message, ...touchedTitles].join(' '),
      tagIds: [],
    };
  }

  private titleFor(entityId: string): string {
    return this.search.getTitle(entityId) ?? entityId;
  }
}

// Best-effort id-from-path for the common `<kind>/<id>.json` entities —
// deliberately doesn't handle nested paths (books/<id>/chapters/<id>.json)
// or non-entity files (.mi-cerebro/*, comments/, drafts/); those just
// don't contribute a touched-title to the commit body, which is fine —
// the commit message alone still gets indexed.
const ENTITY_TOP_DIRS = new Set([
  'notes',
  'tasks',
  'goals',
  'lists',
  'writings',
  'images',
  'files',
  'reminders',
]);

function entityIdFromPath(filepath: string): string | null {
  const segments = filepath.split('/');
  if (segments.length !== 2 || !segments[1]!.endsWith('.json')) return null;
  const [dir, file] = segments;
  if (!ENTITY_TOP_DIRS.has(dir!)) return null;
  return file!.slice(0, -'.json'.length);
}
