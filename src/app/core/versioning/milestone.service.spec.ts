import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FsService } from '@core/fs/fs.service';
import { WorkspaceService } from '@core/fs/workspace.service';
import { SettingsService } from '@core/settings/settings.service';

import { CompactionService } from './compaction.service';
import { MilestoneService } from './milestone.service';
import { RemoteService } from './remote.service';
import type { CommitSummary } from './versioning.service';
import { VersioningService } from './versioning.service';

describe('MilestoneService.commitsSinceLastMilestone', () => {
  let service: MilestoneService;
  let logFull: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    logFull = vi.fn();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: VersioningService, useValue: { logFull } },
        { provide: WorkspaceService, useValue: { root: () => null } },
        { provide: FsService, useValue: {} },
        { provide: CompactionService, useValue: {} },
        { provide: RemoteService, useValue: { isConfigured: () => false } },
        { provide: SettingsService, useValue: { state: () => ({ versioning: {} }) } },
      ],
    });
    service = TestBed.inject(MilestoneService);
  });

  it('returns the commit count before the most recent milestone in the ref', async () => {
    const commits: CommitSummary[] = [
      { oid: 'c3', message: 'c3', authorTimestamp: 3, parents: [] },
      { oid: 'c2', message: 'c2', authorTimestamp: 2, parents: [] },
      { oid: 'tag-oid', message: 'c1', authorTimestamp: 1, parents: [] },
      { oid: 'c0', message: 'c0', authorTimestamp: 0, parents: [] },
    ];
    logFull.mockResolvedValue(commits);
    vi.spyOn(service, 'list').mockResolvedValue([{ name: 'v1', oid: 'tag-oid', message: 'v1' }]);

    const result = await service.commitsSinceLastMilestone('refs/heads/main');
    expect(result).toEqual({ name: 'v1', count: 2 });
  });

  it('picks the most recent milestone when several are in the ref history', async () => {
    const commits: CommitSummary[] = [
      { oid: 'c3', message: 'c3', authorTimestamp: 3, parents: [] },
      { oid: 'newer-tag', message: 'c2', authorTimestamp: 2, parents: [] },
      { oid: 'older-tag', message: 'c1', authorTimestamp: 1, parents: [] },
    ];
    logFull.mockResolvedValue(commits);
    vi.spyOn(service, 'list').mockResolvedValue([
      { name: 'old', oid: 'older-tag', message: 'old' },
      { name: 'new', oid: 'newer-tag', message: 'new' },
    ]);

    const result = await service.commitsSinceLastMilestone('refs/heads/main');
    expect(result).toEqual({ name: 'new', count: 1 });
  });

  it('returns null when no milestone is found in the ref history', async () => {
    logFull.mockResolvedValue([{ oid: 'a', message: 'a', authorTimestamp: 1, parents: [] }]);
    vi.spyOn(service, 'list').mockResolvedValue([]);

    const result = await service.commitsSinceLastMilestone('refs/heads/main');
    expect(result).toBeNull();
  });
});
