import type { CanvasNode } from '../types/canvas';
import type { GeminiAccount } from './geminiAccountManager';

export type CanvasGeminiAssignmentStatus =
  | 'assigned'
  | 'queued'
  | 'conflict'
  | 'unavailable';

export interface CanvasGeminiAccountAssignment {
  nodeId: string;
  status: CanvasGeminiAssignmentStatus;
  accountId?: string;
  ownerNodeId?: string;
}

function isEligibleGeminiAccount(account: GeminiAccount): boolean {
  const credentials = (account.token || account.refreshToken || account.apiKey || account.cookies || '').trim();
  const credits = typeof account.credits === 'number' ? account.credits : 0;
  return Boolean(
    credentials &&
    (!account.accountStatus || account.accountStatus === 'active') &&
    credits > 0
  );
}

function sortCanvasNodes(nodes: CanvasNode[]): CanvasNode[] {
  return [...nodes].sort(
    (a, b) =>
      a.position.x - b.position.x ||
      a.position.y - b.position.y ||
      a.id.localeCompare(b.id)
  );
}

export function planCanvasGeminiAccountAssignments(
  nodes: CanvasNode[],
  accounts: GeminiAccount[],
  activeAccountId?: string | null
): Map<string, CanvasGeminiAccountAssignment> {
  const videoNodes = sortCanvasNodes(nodes.filter((node) => node.type === 'geminiVideo'));
  const eligibleAccounts = accounts.filter(isEligibleGeminiAccount).sort((a, b) => {
    if (activeAccountId && a.id === activeAccountId) return -1;
    if (activeAccountId && b.id === activeAccountId) return 1;
    const creditsA = typeof a.credits === 'number' ? a.credits : 0;
    const creditsB = typeof b.credits === 'number' ? b.credits : 0;
    return creditsB - creditsA || a.id.localeCompare(b.id);
  });
  const eligibleIds = new Set(eligibleAccounts.map((account) => account.id));
  const assignments = new Map<string, CanvasGeminiAccountAssignment>();
  const claimedAccounts = new Map<string, string>();

  for (const node of videoNodes) {
    const preferredId = node.data?.accountId;
    if (!preferredId || preferredId === 'auto') continue;

    if (!eligibleIds.has(preferredId)) {
      assignments.set(node.id, { nodeId: node.id, status: 'unavailable', accountId: preferredId });
      continue;
    }

    const ownerNodeId = claimedAccounts.get(preferredId);
    if (ownerNodeId) {
      assignments.set(node.id, {
        nodeId: node.id,
        status: 'conflict',
        accountId: preferredId,
        ownerNodeId,
      });
      continue;
    }

    claimedAccounts.set(preferredId, node.id);
    assignments.set(node.id, { nodeId: node.id, status: 'assigned', accountId: preferredId });
  }

  for (const node of videoNodes) {
    if (assignments.has(node.id)) continue;
    const account = eligibleAccounts.find((candidate) => !claimedAccounts.has(candidate.id));
    if (!account) {
      assignments.set(node.id, { nodeId: node.id, status: 'queued' });
      continue;
    }
    claimedAccounts.set(account.id, node.id);
    assignments.set(node.id, {
      nodeId: node.id,
      status: 'assigned',
      accountId: account.id,
    });
  }

  return assignments;
}
