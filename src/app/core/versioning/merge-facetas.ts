// 13c-iv / 13d-iv — additive merge of the secondary facetas (comments,
// drafts) that travel with an entity in a bundle. Each helper is
// best-effort: a failure surfaces to the caller via throw so the
// MergeService partial-fail UX can surface the failed entity. None of
// them ever deletes — if `from` lacks the file, `into` keeps whatever
// it had.

import * as git from 'isomorphic-git';

import { commentsFilepath } from './comments.types';
import { draftsFilepath } from './drafts.types';
import type { GitFsAdapter } from './git-fs.adapter';
import { buildMergeCommit } from './merge-apply';
import { blobOidAt } from './tree-ops';
import { stripHeadsPrefix } from './variants.io';
import type { Variant } from './variants.types';
import { DEFAULT_GIT_AUTHOR } from './versioning.constants';

const REPO_DIR = '/';

export interface MergeFacetaArgs {
  readonly fs: GitFsAdapter;
  readonly filepath: string;
  readonly fromMainTip: string;
  readonly from: Variant;
  readonly into: Variant;
  readonly groupId: string;
}

export async function mergeCommentsFaceta(args: MergeFacetaArgs): Promise<void> {
  await mergeFaceta({
    ...args,
    fromBranchRef: args.from.refs.comments,
    intoBranchRef: args.into.refs.comments,
    pathFor: commentsFilepath,
    formatMessage: formatCommentsMessage,
  });
}

export async function mergeDraftsFaceta(args: MergeFacetaArgs): Promise<void> {
  await mergeFaceta({
    ...args,
    fromBranchRef: args.from.refs.draft,
    intoBranchRef: args.into.refs.draft,
    pathFor: draftsFilepath,
    formatMessage: formatDraftsMessage,
  });
}

interface FacetaPlan extends MergeFacetaArgs {
  readonly fromBranchRef: string;
  readonly intoBranchRef: string;
  readonly pathFor: (entityId: string) => string;
  readonly formatMessage: (
    entityId: string,
    from: Variant,
    into: Variant,
    groupId: string,
  ) => string;
}

async function mergeFaceta(plan: FacetaPlan): Promise<void> {
  const entityId = await readEntityIdAt(plan.fs, plan.fromMainTip, plan.filepath);
  if (!entityId) return;
  const fromRef = stripHeadsPrefix(plan.fromBranchRef);
  const intoRef = stripHeadsPrefix(plan.intoBranchRef);
  const fromTip = await resolveOrNull(plan.fs, fromRef);
  if (!fromTip) return;
  const filepath = plan.pathFor(entityId);
  const fromBlob = await blobOidAt(plan.fs, fromTip, filepath);
  if (!fromBlob) return;
  const intoTip = await resolveOrNull(plan.fs, intoRef);
  if (!intoTip) return;
  const newOid = await buildMergeCommit({
    fs: plan.fs,
    baseCommitOid: intoTip,
    fromCommitOid: fromTip,
    filepath,
    message: plan.formatMessage(entityId, plan.from, plan.into, plan.groupId),
    author: DEFAULT_GIT_AUTHOR,
  });
  if (!newOid) return;
  await git.writeRef({
    fs: plan.fs,
    dir: REPO_DIR,
    ref: `refs/heads/${intoRef}`,
    value: newOid,
    force: true,
  });
}

function formatCommentsMessage(
  entityId: string,
  from: Variant,
  into: Variant,
  groupId: string,
): string {
  const subject = `merge [comentarios]: ${entityId} (from "${from.name}" into "${into.name}")`;
  return `${subject}\n\nMerge-Group: ${groupId}\nMerge-From: ${from.id}\nMerge-Into: ${into.id}\nMerge-Facet: comments\nMerge-Choice: from\n`;
}

function formatDraftsMessage(
  entityId: string,
  from: Variant,
  into: Variant,
  groupId: string,
): string {
  const subject = `merge [borrador]: ${entityId} (from "${from.name}" into "${into.name}")`;
  return `${subject}\n\nMerge-Group: ${groupId}\nMerge-From: ${from.id}\nMerge-Into: ${into.id}\nMerge-Facet: draft\nMerge-Choice: from\n`;
}

async function readEntityIdAt(
  fs: GitFsAdapter,
  commitOid: string,
  filepath: string,
): Promise<string | null> {
  const oid = await blobOidAt(fs, commitOid, filepath);
  if (!oid) return null;
  try {
    const { blob } = await git.readBlob({ fs, dir: REPO_DIR, oid });
    const parsed = JSON.parse(new TextDecoder().decode(blob)) as { id?: unknown };
    return typeof parsed.id === 'string' && parsed.id.length > 0 ? parsed.id : null;
  } catch {
    return null;
  }
}

async function resolveOrNull(fs: GitFsAdapter, ref: string): Promise<string | null> {
  try {
    return await git.resolveRef({ fs, dir: REPO_DIR, ref });
  } catch {
    return null;
  }
}
