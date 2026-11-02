import { getAccountStats, getProviderAccounts, getProviderLabel, normalizeAccountProvider } from './account-manager.js';
import { escapeHtml } from '../core/utils.js';

export function renderAccountCardHtml(account, { isActive, isChecked, isBatchSelectMode }) {
  const provider = normalizeAccountProvider(account);
  const displayName = account.name || account.email || `${getProviderLabel(provider)} User`;
  const initial = displayName.charAt(0).toUpperCase();
  const displayUid = (account.userId || account.id || '').substring(0, 16);
  const profileTag = account.chromeProfile || 'Profile Utama';

  return `
    <div class="account-card-modern ${isActive ? 'is-active' : ''}" data-id="${account.id}">
      <div class="acc-card-left">
        ${isBatchSelectMode ? `<input type="checkbox" class="acc-card-chk" data-id="${account.id}" ${isChecked ? 'checked' : ''}>` : ''}
        <div class="acc-avatar-circle" title="${escapeHtml(displayName)}">${escapeHtml(initial)}</div>
        <div class="acc-details">
          <div class="acc-title-row">
            <span class="acc-email-text" title="${escapeHtml(account.email)}">${escapeHtml(account.email)}</span>
          </div>
          <div class="acc-meta-row">
            <span class="acc-profile-tag btn-edit-profile" data-id="${account.id}" title="Klik untuk ubah nama/nomor Profil Chrome (misal: Profile 1, Profile 2)">
              👤 ${escapeHtml(profileTag)} ✎
            </span>
            <span>&bull;</span>
            <span>${escapeHtml(getProviderLabel(provider))}</span>
            <span>&bull;</span>
            ${account.apiKey
              ? `<span class="acc-credits-badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.35); font-weight: 600;" title="Akun ini menggunakan Gemini API Key (100% Silent Mode di background tanpa buka tab)">⚡ Silent API</span>`
              : (provider === 'dola' ? '' : `<span class="acc-credits-badge">⚡ ${account.credits ?? 0} ${provider === 'weavy' ? 'Koin' : 'Credits'}</span>`)}
          </div>
        </div>
      </div>
      <div class="acc-card-right">
        ${provider === 'flow'
          ? `<button type="button" class="btn-sm btn-icon-only btn-open-flow" data-id="${account.id}" data-email="${escapeHtml(account.email || '')}" title="Buka Workspace Google Flow di Tab Baru">
              <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 014-10z"/>
              </svg>
            </button>`
          : provider === 'dola'
          ? `<button type="button" class="btn-sm btn-icon-only btn-open-dola" data-id="${account.id}" title="Buka Dola AI (dola.com) di Tab Baru">
              <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 014-10z"/>
              </svg>
            </button>`
          : provider === 'gemini'
          ? `<button type="button" class="btn-sm btn-icon-only btn-open-gemini" data-id="${account.id}" data-email="${escapeHtml(account.email || '')}" title="Buka Google Gemini (gemini.google.com) di Tab Baru">
              <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 014-10z"/>
              </svg>
            </button>`
          : ''}
        ${isActive
          ? '<span class="acc-active-badge" title="Akun ini sedang aktif di ekstensi">✓ Aktif</span>'
          : `<button type="button" class="btn-sm btn-outline btn-set-active" data-id="${account.id}" title="Pilih akun ini sebagai akun aktif di ekstensi tanpa mengganggu tab browser">Pilih</button>`}
        <button type="button" class="btn-sm btn-icon-only btn-copy-account" data-id="${account.id}" title="Salin Data Akun (untuk Import Manual / Pindah Browser)">
          <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
        </button>
        <button type="button" class="btn-sm btn-icon-only btn-sync-account" data-id="${account.id}" title="Sinkronkan Saldo & Token Akun Ini">
          <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 4v6h-6M1 20v-6h6"/>
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
          </svg>
        </button>
        <button type="button" class="btn-sm btn-icon-only btn-del-account" data-id="${account.id}" title="Hapus Akun">
          <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
          </svg>
        </button>
      </div>
    </div>
  `;
}

export function renderAccountDropdownItemHtml(account, { isActive }) {
  const provider = normalizeAccountProvider(account);
  const displayName = account.name || account.email || `${getProviderLabel(provider)} User`;
  const initial = displayName.charAt(0).toUpperCase();
  const profileTag = account.chromeProfile || 'Profile Utama';
  const credits = account.credits ?? 0;

  return `
    <div class="header-acc-dropdown-item ${isActive ? 'is-active' : ''}" data-id="${account.id}" data-provider="${provider}">
      <div class="acc-dropdown-item-left">
        <div class="acc-avatar-circle sm" title="${escapeHtml(displayName)}">${escapeHtml(initial)}</div>
        <div class="acc-dropdown-item-info">
          <div class="acc-dropdown-name-row">
            <span class="acc-dropdown-email" title="${escapeHtml(account.email || displayName)}">${escapeHtml(account.email || displayName)}</span>
            ${isActive ? '<span class="acc-dropdown-active-tag">Aktif</span>' : ''}
          </div>
          <div class="acc-dropdown-meta-row">
            <span class="acc-dropdown-profile">👤 ${escapeHtml(profileTag)}</span>
            <span>&bull;</span>
            ${provider === 'dola' ? '' : `<span class="acc-dropdown-credits">⚡ ${account.credits ?? 0} ${provider === 'weavy' ? 'Koin' : 'Credits'}</span>`}
          </div>
        </div>
      </div>
      <div class="acc-dropdown-item-right">
        ${isActive
          ? `<svg class="icon-sm text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--success, #10b981);">
              <polyline points="20 6 9 17 4 12"/>
            </svg>`
          : `<span class="acc-dropdown-switch-hint">Pilih</span>`
        }
      </div>
    </div>
  `;
}

export function renderHeaderAccount(account, provider = 'weavy') {
  const emailElement = document.getElementById('headerAccountEmail');
  const creditsElement = document.getElementById('headerAccountCredits');
  if (!emailElement || !creditsElement) return;

  if (!account) {
    emailElement.textContent = 'Belum Ada Akun';
    creditsElement.textContent = '0 Koin';
    creditsElement.style.display = 'none';
    return;
  }

  const activeProv = account.provider || provider;
  emailElement.textContent = account.email || `${getProviderLabel(activeProv)} User`;
  if (activeProv === 'dola' || activeProv === 'gemini') {
    creditsElement.textContent = '';
    creditsElement.style.display = 'none';
    return;
  }
  const defaultCredits = activeProv === 'dola' ? 4 : 0;
  const credits = account.credits ?? defaultCredits;
  const unit = activeProv === 'weavy' ? 'Koin' : 'Credits';
  creditsElement.textContent = `${credits} ${unit}`;
  creditsElement.style.display = 'inline-block';
}

export function renderAccountStats(accounts, activeAccount, provider = 'weavy') {
  const providerAccounts = getProviderAccounts(accounts, provider);
  const { totalAccounts, totalCredits } = getAccountStats(accounts, provider);

  const badgeTitle = document.getElementById('providerBannerTitle');
  if (badgeTitle) badgeTitle.textContent = `${getProviderLabel(provider)} Accounts`;

  const bannerLogo = document.getElementById('providerBannerLogo');
  if (bannerLogo) {
    bannerLogo.classList.toggle('provider-banner-logo-weavy', provider === 'weavy');
    bannerLogo.classList.toggle('provider-banner-logo-flow', provider === 'flow');
    bannerLogo.classList.toggle('provider-banner-logo-dola', provider === 'dola');
    bannerLogo.classList.toggle('provider-banner-logo-gemini', provider === 'gemini');
    bannerLogo.textContent = provider === 'flow' ? 'F' : provider === 'dola' ? 'D' : provider === 'gemini' ? 'G' : 'W';
  }

  const bannerDesc = document.getElementById('providerBannerDesc');
  if (bannerDesc) {
    if (provider === 'flow') {
      bannerDesc.textContent = 'Kelola akun Google Flow, sesi login, dan data akun untuk generate berbasis browser.';
    } else if (provider === 'dola') {
      bannerDesc.textContent = 'Kelola akun Dola AI (ByteDance), sessionid, dan histori percakapan / video.';
    } else if (provider === 'gemini') {
      bannerDesc.textContent = 'Kelola akun Google Gemini (gemini.google.com), sesi login Google, dan otomasi prompt chat/upload.';
    } else {
      bannerDesc.textContent = 'Kelola akun Weavy, refresh token, dan alokasi kredit untuk pembuatan video.';
    }
  }

  const accountsBadge = document.getElementById('weavyAccountsBadgeCount');
  if (accountsBadge) accountsBadge.textContent = `(${totalAccounts})`;

  const weavyCount = document.getElementById('weavyPillCount');
  if (weavyCount) weavyCount.textContent = getProviderAccounts(accounts, 'weavy').length;

  const flowCount = document.getElementById('flowPillCount');
  if (flowCount) flowCount.textContent = getProviderAccounts(accounts, 'flow').length;

  const dolaCount = document.getElementById('dolaPillCount');
  if (dolaCount) dolaCount.textContent = getProviderAccounts(accounts, 'dola').length;

  const geminiCount = document.getElementById('geminiPillCount');
  if (geminiCount) geminiCount.textContent = getProviderAccounts(accounts, 'gemini').length;

  const weavyPill = document.getElementById('pillProviderWeavy');
  const flowPill = document.getElementById('pillProviderFlow');
  const dolaPill = document.getElementById('pillProviderDola');
  const geminiPill = document.getElementById('pillProviderGemini');
  if (weavyPill) weavyPill.classList.toggle('active', provider === 'weavy');
  if (flowPill) flowPill.classList.toggle('active', provider === 'flow');
  if (dolaPill) dolaPill.classList.toggle('active', provider === 'dola');
  if (geminiPill) geminiPill.classList.toggle('active', provider === 'gemini');

  const totalAccountsElement = document.getElementById('statTotalAccounts');
  if (totalAccountsElement) totalAccountsElement.textContent = totalAccounts;

  const activeAccountElement = document.getElementById('statActiveAccountEmail');
  if (activeAccountElement) {
    activeAccountElement.textContent = activeAccount ? (activeAccount.name || activeAccount.email || `${getProviderLabel(provider)} User`) : 'Belum Ada Akun';
    activeAccountElement.title = activeAccount ? activeAccount.email : '';
  }

  const totalCreditsElement = document.getElementById('statTotalCredits');
  const totalCreditsCard = totalCreditsElement?.closest('.stat-bento-card');
  if (totalCreditsCard) totalCreditsCard.style.display = (provider === 'dola' || provider === 'gemini') ? 'none' : '';
  if (totalCreditsElement) totalCreditsElement.textContent = (provider === 'dola' || provider === 'gemini') ? '' : totalCredits.toLocaleString();

  const syncAllLabel = document.getElementById('syncAllBtnLabel');
  if (syncAllLabel) syncAllLabel.textContent = `Sync ALL (${totalAccounts})`;
}
