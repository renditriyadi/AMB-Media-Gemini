export function normalizeAccountProvider(account = {}, fallback = 'weavy') {
  const raw = String((account && (account.provider || account.accountProvider)) || fallback).toLowerCase();
  if (raw === 'flow') return 'flow';
  if (raw === 'dola') return 'dola';
  if (raw === 'gemini') return 'gemini';
  return 'weavy';
}

export function getProviderLabel(provider = 'weavy') {
  if (provider === 'flow') return 'Flow';
  if (provider === 'dola') return 'Dola';
  if (provider === 'gemini') return 'Gemini';
  return 'Weavy';
}

export function getProviderAccounts(accounts = [], provider = 'weavy') {
  return accounts.filter((account) => normalizeAccountProvider(account) === normalizeAccountProvider({ provider }, provider));
}

export function getActiveAccount(accounts, activeAccountId, provider = 'weavy') {
  const providerAccounts = getProviderAccounts(accounts, provider);
  return providerAccounts.find((account) => account.id === activeAccountId) || providerAccounts[0] || null;
}

export async function loadAccountState(storage) {
  return {
    accounts: (await storage.get('weavy_accounts')) || [],
    activeAccountId: await storage.get('weavy_active_account_id'),
    provider: (await storage.get('weavy_active_provider')) || 'weavy',
  };
}

export async function saveAccountState(storage, accounts, activeAccountId, provider = 'weavy') {
  await storage.set('weavy_accounts', accounts);
  await storage.set('weavy_active_account_id', activeAccountId);
  await storage.set('weavy_active_provider', provider);
}

export function getAccountStats(accounts, provider = 'weavy') {
  const providerAccounts = getProviderAccounts(accounts, provider);
  return {
    totalAccounts: providerAccounts.length,
    totalCredits: providerAccounts.reduce((sum, account) => sum + (Number(account.credits) || 0), 0),
  };
}
