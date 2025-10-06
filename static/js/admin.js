function esc(text) {
  const div = document.createElement('div');
  div.innerText = text == null ? '' : String(text);
  return div.innerHTML;
}

let personalityMetaCache = {};

function getPersonalityBadge(personality) {
  const entry = personalityMetaCache[personality];
  if (!entry) {
    const label = personality ? esc(personality) : 'Bilinmiyor';
    return `<span class="badge bg-warning text-dark mb-1"><i class="bi bi-question-circle"></i> ${label}</span>`;
  }
  const color = esc(entry.badge_color || 'secondary');
  const icon = esc(entry.badge_icon || 'person-circle');
  const label = esc(entry.name || personality);
  return `<span class="badge bg-${color} mb-1"><i class="bi bi-${icon}"></i> ${label}</span>`;
}

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('admin-root');
  const defaultFile = root?.dataset?.defaultFile || 'expanded_data.json';

  let currentFile = '';
  let allFiles = [];
  const qaModalEl = document.getElementById('qaModal');
  const loginModalEl = document.getElementById('loginModal');
  const messageDetailModalEl = document.getElementById('messageDetailModal');
  const sessionConversationModalEl = document.getElementById('sessionConversationModal');
  const qaModal = qaModalEl ? new bootstrap.Modal(qaModalEl) : null;
  const loginModal = loginModalEl ? new bootstrap.Modal(loginModalEl) : null;
  const messageDetailModal = messageDetailModalEl ? new bootstrap.Modal(messageDetailModalEl) : null;
  const sessionConversationModal = sessionConversationModalEl ? new bootstrap.Modal(sessionConversationModalEl) : null;
  const $fileSel = $('#fileSelect');
  const qaTabEl = document.getElementById('qa-tab');
  const qaPaneEl = document.getElementById('qa-pane');
  const logsTabEl = document.getElementById('logs-tab');
  const logsPaneEl = document.getElementById('logs-pane');
  const personalitiesTabEl = document.getElementById('personalities-tab');
  const personalitiesPaneEl = document.getElementById('personalities-pane');
  let qaTable;
  const ROLE_ADMIN = 'admin';
  const ROLE_EDITOR = 'editor';
  let adminRole = null;
  let isAuthenticated = false;
  let lastKnownRole = null;
  let currentSessionForModal = null;

  // Personality management state
  const personalityModalEl = document.getElementById('personalityModal');
  const personalityModal = personalityModalEl ? new bootstrap.Modal(personalityModalEl) : null;
  const personalityForm = document.getElementById('personalityForm');
  const personalityModalLabel = document.getElementById('personalityModalLabel');
  const personalityIdInput = document.getElementById('personalityId');
  const personalityNameInput = document.getElementById('personalityName');
  const personalityThemeInput = document.getElementById('personalityTheme');
  const personalityBadgeColorInput = document.getElementById('personalityBadgeColor');
  const personalityBadgeIconInput = document.getElementById('personalityBadgeIcon');
  const personalityWelcomeInput = document.getElementById('personalityWelcome');
  const personalityPromptInput = document.getElementById('personalityPrompt');
  const personalitySetDefaultInput = document.getElementById('personalitySetDefault');
  const personalityAvatarInput = document.getElementById('personalityAvatarInput');
  const personalityAvatarPreview = document.getElementById('personalityAvatarPreview');
  const removePersonalityAvatarBtn = document.getElementById('removePersonalityAvatarBtn');
  const systemPromptInput = document.getElementById('systemPromptInput');
  const saveSystemPromptBtn = document.getElementById('saveSystemPromptBtn');
  const reloadSystemPromptBtn = document.getElementById('reloadSystemPromptBtn');
  const systemPromptStatus = document.getElementById('systemPromptStatus');
  const personalitiesLoadingEl = document.getElementById('personalitiesLoading');
  const personalitiesTableWrapper = document.getElementById('personalitiesTableWrapper');
  const personalitiesTableBody = document.querySelector('#personalitiesTable tbody');
  const personalitiesEmptyState = document.getElementById('personalitiesEmptyState');
  const personalitiesErrorEl = document.getElementById('personalitiesError');
  const refreshPersonalitiesBtn = document.getElementById('refreshPersonalitiesBtn');
  const addPersonalityBtn = document.getElementById('addPersonalityBtn');
  let editingPersonalityId = null;
  let personalityList = [];
  let defaultPersonalityId = null;
  let currentSystemPrompt = '';
  let avatarRemoveRequested = false;
  let currentAvatarPreviewUrl = null;
  let existingAvatarRelative = null;
  const personalityEmojiInput = null;

  function hasQaAccess() {
    return adminRole === ROLE_ADMIN || adminRole === ROLE_EDITOR;
  }

  function hasAdminAccess() {
    return adminRole === ROLE_ADMIN;
  }

  function requireAdmin(message = 'Bu işlem için admin yetkisi gerekir.') {
    if (hasAdminAccess()) return true;
    if (hasQaAccess()) {
      alert(message);
    } else {
      loginModal?.show();
    }
    return false;
  }

  function toggleAdminTabs(visible) {
    const entries = [
      { tab: logsTabEl, pane: logsPaneEl },
      { tab: personalitiesTabEl, pane: personalitiesPaneEl },
    ];

    entries.forEach(({ tab, pane }) => {
      if (!tab || !pane) return;
      tab.classList.toggle('d-none', !visible);
      if (tab.parentElement) {
        tab.parentElement.classList.toggle('d-none', !visible);
      }
      if (!visible) {
        if (tab.classList.contains('active')) {
          if (qaPaneEl) {
            qaPaneEl.classList.add('show', 'active');
          }
          if (qaTabEl) {
            bootstrap.Tab.getOrCreateInstance(qaTabEl).show();
          }
        }
        pane.classList.remove('show', 'active');
      }
    });
  }
  const themePresets = {
    angry: { badge_color: 'danger', badge_icon: 'emoji-frown' },
    neutral: { badge_color: 'secondary', badge_icon: 'emoji-neutral' },
    positive: { badge_color: 'success', badge_icon: 'emoji-smile' },
  };
  const themeNameMap = {
    angry: 'Huysuz',
    neutral: 'Nötr',
    positive: 'Pozitif',
  };

  // Treat backend timestamps (e.g., 'YYYY-MM-DD HH:MM:SS') as UTC
  function parseUtcLike(ts) {
    if (!ts) return null;
    const s = String(ts).trim();
    if (!s) return null;
    // Convert 'YYYY-MM-DD HH:MM:SS' -> 'YYYY-MM-DDTHH:MM:SSZ'
    return new Date(s.replace(' ', 'T') + 'Z');
  }

  function resolveAvatarUrl(relativePath) {
    if (!relativePath) return null;
    let path = String(relativePath).trim();
    if (!path) return null;
    if (path.startsWith('/')) path = path.slice(1);
    if (path.startsWith('static/')) path = path.slice(7);
    return `/static/${path}`;
  }

  function setAvatarPreview(src, isObjectUrl = false) {
    if (!personalityAvatarPreview) return;
    if (currentAvatarPreviewUrl) {
      URL.revokeObjectURL(currentAvatarPreviewUrl);
      currentAvatarPreviewUrl = null;
    }
    if (src) {
      personalityAvatarPreview.src = src;
      personalityAvatarPreview.classList.remove('d-none');
      if (isObjectUrl) {
        currentAvatarPreviewUrl = src;
      }
    } else {
      personalityAvatarPreview.src = '';
      personalityAvatarPreview.classList.add('d-none');
    }
  }

  function setAvatarRemoveButtonVisible(visible) {
    if (!removePersonalityAvatarBtn) return;
    removePersonalityAvatarBtn.classList.toggle('d-none', !visible);
    removePersonalityAvatarBtn.disabled = !visible;
  }

  function handleAvatarFileChange() {
    if (!personalityAvatarInput) return;
    const file = personalityAvatarInput.files?.[0] || null;
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      setAvatarPreview(objectUrl, true);
      setAvatarRemoveButtonVisible(true);
      avatarRemoveRequested = false;
    } else if (existingAvatarRelative && !avatarRemoveRequested) {
      const resolved = resolveAvatarUrl(existingAvatarRelative);
      setAvatarPreview(resolved);
      setAvatarRemoveButtonVisible(Boolean(resolved));
    } else {
      setAvatarPreview(null);
      setAvatarRemoveButtonVisible(false);
    }
  }

  function handleRemoveAvatarClick() {
    avatarRemoveRequested = true;
    existingAvatarRelative = null;
    if (personalityAvatarInput) personalityAvatarInput.value = '';
    setAvatarPreview(null);
    setAvatarRemoveButtonVisible(false);
  }

  function showSystemPromptStatus(message, type = 'muted') {
    if (!systemPromptStatus) return;
    systemPromptStatus.textContent = message || '';
    systemPromptStatus.className = `text-${type}`;
  }

  function setSystemPromptControlsEnabled(enabled) {
    if (systemPromptInput) systemPromptInput.disabled = !enabled;
    if (saveSystemPromptBtn) saveSystemPromptBtn.disabled = !enabled;
    if (reloadSystemPromptBtn) reloadSystemPromptBtn.disabled = !enabled;
  }

  function setPersonalityLoading(isLoading) {
    if (!personalitiesLoadingEl) return;
    personalitiesLoadingEl.classList.toggle('d-none', !isLoading);
  }

  function clearPersonalityError() {
    if (personalitiesErrorEl) {
      personalitiesErrorEl.classList.add('d-none');
      personalitiesErrorEl.textContent = '';
    }
  }

  function showPersonalityError(message) {
    if (personalitiesErrorEl) {
      personalitiesErrorEl.textContent = message;
      personalitiesErrorEl.classList.remove('d-none');
    }
  }

  function syncPersonalityRegistry() {
    personalityMetaCache = {};
    personalityList.forEach((item) => {
      if (item && item.id) {
        personalityMetaCache[item.id] = item;
      }
    });
  }

  function populatePersonalityFilters() {
    const advancedSelect = document.getElementById('advancedPersonalityFilter');
    if (!advancedSelect) return;

    const previousValue = advancedSelect.value;
    advancedSelect.innerHTML = '<option value="">Tüm kişilikler</option>';

    personalityList.forEach((item) => {
      if (!item || !item.id) return;
      const opt = document.createElement('option');
      opt.value = item.id;
      opt.textContent = item.name || item.id;
      advancedSelect.appendChild(opt);
    });

    if (previousValue && personalityMetaCache[previousValue]) {
      advancedSelect.value = previousValue;
    }
  }

  function renderPersonalities() {
    if (!personalitiesTableBody) return;
    personalitiesTableBody.innerHTML = '';

    if (!hasAdminAccess()) {
      if (personalitiesErrorEl) {
        const message = hasQaAccess()
          ? 'Bu bölüme yalnızca admin erişebilir.'
          : 'Giriş yaptıktan sonra düzenleyebilirsiniz.';
        personalitiesErrorEl.textContent = message;
        personalitiesErrorEl.classList.remove('d-none');
      }
      personalitiesTableWrapper?.classList.add('d-none');
      personalitiesEmptyState?.classList.add('d-none');
      return;
    }
    if (!Array.isArray(personalityList) || personalityList.length === 0) {
      personalitiesTableWrapper?.classList.add('d-none');
      personalitiesEmptyState?.classList.remove('d-none');
      return;
    }

    personalitiesEmptyState?.classList.add('d-none');
    personalitiesTableWrapper?.classList.remove('d-none');

    personalityList.forEach((item) => {
      const slug = item.id || '';
      const displayName = esc(item.name || slug);
      const slugLabel = esc(slug);
      const welcomeRaw = item.welcome_message || '';
      const welcomeHtml = welcomeRaw
        ? `<div class="text-truncate" style="max-width: 240px;">${esc(welcomeRaw)}</div>`
        : '<span class="text-muted">-</span>';
      const promptText = item.prompt || '';
      const promptPreview = promptText.length > 160 ? `${promptText.slice(0, 160)}…` : promptText;
      const promptHtml = promptText
        ? `<div class="small text-muted text-truncate" style="max-width: 320px;">${esc(promptPreview)}</div>`
        : '<span class="text-muted">-</span>';
      const isDefault = slug === defaultPersonalityId;
      const defaultHtml = isDefault
        ? '<span class="badge bg-primary"><i class="bi bi-star-fill"></i> Varsayılan</span>'
        : `<button type="button" class="btn btn-outline-primary btn-sm set-default-personality" data-personality="${slug}"><i class="bi bi-star"></i> Varsayılan Yap</button>`;
      const themeLabel = esc(themeNameMap[item.theme] || item.theme || '-');
      const avatarResolved = item.avatar_resolved || resolveAvatarUrl(item.avatar_url);
      const avatarHtml = avatarResolved
        ? `<img src="${esc(avatarResolved)}" alt="${displayName} avatar" class="rounded-circle border" style="width:48px;height:48px;object-fit:cover;">`
        : '<span class="text-muted small">-</span>';
      const actionsHtml = `<div class="btn-group btn-group-sm" role="group">
           <button type="button" class="btn btn-warning edit-personality" data-personality="${slug}"><i class="bi bi-pencil"></i></button>
           <button type="button" class="btn btn-outline-danger delete-personality" data-personality="${slug}"><i class="bi bi-trash"></i></button>
         </div>`;

      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${defaultHtml}</td>
        <td>
          <div>
            <div class="fw-semibold">${displayName}</div>
            <div class="text-muted small">${slugLabel}</div>
            ${getPersonalityBadge(slug)}
          </div>
        </td>
        <td>${avatarHtml}</td>
        <td><span class="badge bg-light text-dark border">${themeLabel}</span></td>
        <td>${welcomeHtml}</td>
        <td>${promptHtml}</td>
        <td>${actionsHtml}</td>
      `;
      personalitiesTableBody.appendChild(row);
    });
  }

  function applyThemeDefaults(theme, force = false) {
    if (!personalityBadgeColorInput || !personalityBadgeIconInput) return;
    const preset = themePresets[theme] || themePresets.neutral;
    if (force || !personalityBadgeColorInput.value) {
      personalityBadgeColorInput.value = preset.badge_color;
    }
    if (force || !personalityBadgeIconInput.value) {
      personalityBadgeIconInput.value = preset.badge_icon;
    }
  }

  function resetPersonalityForm() {
    if (!personalityForm) return;
    personalityForm.reset();
    personalityForm.classList.remove('was-validated');
    if (personalityIdInput) {
      personalityIdInput.disabled = false;
    }
    if (personalityAvatarInput) {
      personalityAvatarInput.value = '';
    }
    existingAvatarRelative = null;
    avatarRemoveRequested = false;
    setAvatarPreview(null);
    setAvatarRemoveButtonVisible(false);
  }

  function openPersonalityModal(slug = null) {
    if (!personalityModal || !personalityForm) return;
    if (!requireAdmin()) return;
    resetPersonalityForm();
    editingPersonalityId = slug || null;
    const isEdit = Boolean(editingPersonalityId);

    if (personalityModalLabel) {
      personalityModalLabel.textContent = isEdit ? 'Kişiliği Düzenle' : 'Yeni Kişilik';
    }
    if (personalitySetDefaultInput) {
      personalitySetDefaultInput.checked = false;
    }

    if (isEdit) {
      const entry = personalityMetaCache[editingPersonalityId];
      if (!entry) {
        showPersonalityError('Kişilik bilgisi yüklenemedi. Lütfen listeyi yenileyin.');
        return;
      }
      if (personalityIdInput) {
        personalityIdInput.value = entry.id || '';
        personalityIdInput.disabled = true;
      }
      if (personalityNameInput) personalityNameInput.value = entry.name || '';
      if (personalityThemeInput) personalityThemeInput.value = entry.theme || 'neutral';
      if (personalityBadgeColorInput) personalityBadgeColorInput.value = entry.badge_color || '';
      if (personalityBadgeIconInput) personalityBadgeIconInput.value = entry.badge_icon || '';
      if (personalityWelcomeInput) personalityWelcomeInput.value = entry.welcome_message || '';
      if (personalityPromptInput) personalityPromptInput.value = entry.prompt || '';
      existingAvatarRelative = entry.avatar_url || null;
      const resolvedAvatar = entry.avatar_resolved || resolveAvatarUrl(existingAvatarRelative);
      setAvatarPreview(resolvedAvatar);
      setAvatarRemoveButtonVisible(Boolean(resolvedAvatar));
      avatarRemoveRequested = false;
      if (personalityAvatarInput) personalityAvatarInput.value = '';
    } else {
      if (personalityIdInput) {
        personalityIdInput.value = '';
        personalityIdInput.disabled = false;
      }
      if (personalityNameInput) personalityNameInput.value = '';
      if (personalityThemeInput) personalityThemeInput.value = 'neutral';
      applyThemeDefaults('neutral', true);
      existingAvatarRelative = null;
      avatarRemoveRequested = false;
      setAvatarPreview(null);
      setAvatarRemoveButtonVisible(false);
      if (personalityAvatarInput) personalityAvatarInput.value = '';
    }

    personalityModal.show();
  }

  function handlePersonalitySubmit(event) {
    if (!personalityForm) return;
    event.preventDefault();
    event.stopPropagation();

    personalityForm.classList.add('was-validated');
    if (!personalityForm.checkValidity()) {
      return;
    }

    if (!requireAdmin()) return;

    const idValue = personalityIdInput?.value.trim().toLowerCase();
    const payload = {
      id: idValue,
      name: personalityNameInput?.value.trim(),
      emoji: null,
      theme: personalityThemeInput?.value || 'neutral',
      badge_color: personalityBadgeColorInput?.value.trim(),
      badge_icon: personalityBadgeIconInput?.value.trim(),
      welcome_message: personalityWelcomeInput?.value.trim(),
      prompt: personalityPromptInput?.value.trim(),
      set_default: Boolean(personalitySetDefaultInput?.checked),
    };

    if (editingPersonalityId) {
      delete payload.id;
    }

    const avatarFile = personalityAvatarInput?.files?.[0] || null;
    const shouldDeleteAvatar = Boolean(editingPersonalityId && avatarRemoveRequested && !avatarFile);

    const submitBtn = personalityForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    const url = editingPersonalityId
      ? `/admin/api/personalities/${encodeURIComponent(editingPersonalityId)}`
      : '/admin/api/personalities';
    const method = editingPersonalityId ? 'PUT' : 'POST';

    fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((resp) => {
        if (resp.status === 401) {
          loginModal?.show();
          throw new Error('Bu işlem için giriş yapmalısınız.');
        }
        if (!resp.ok) {
          return resp.json().then((data) => {
            const message = data?.message || data?.error || 'İşlem başarısız oldu.';
            throw new Error(message);
          }).catch((err) => {
            if (err instanceof Error) throw err;
            throw new Error('İşlem başarısız oldu.');
          });
        }
        return resp.json();
      })
      .then((data) => {
        const slug = data?.item?.id || editingPersonalityId || idValue;
        const followUps = [];
        if (slug) {
          if (avatarFile) {
            followUps.push(uploadAvatar(slug, avatarFile));
          } else if (shouldDeleteAvatar) {
            followUps.push(deleteAvatar(slug));
          }
        }
        return Promise.all(followUps).then(() => data);
      })
      .then((data) => {
        if (typeof data?.default === 'string') {
          defaultPersonalityId = data.default;
        }
        avatarRemoveRequested = false;
        existingAvatarRelative = null;
        personalityModal?.hide();
        resetPersonalityForm();
        loadPersonalities();
      })
      .catch((err) => {
        alert(err.message || 'Kişilik kaydedilemedi.');
      })
      .finally(() => {
        if (submitBtn) submitBtn.disabled = false;
      });
  }

  function handleDeletePersonality(slug) {
    if (!slug) return;
    if (!requireAdmin()) return;
    if (!window.confirm('Bu kişiliği silmek istediğinize emin misiniz?')) {
      return;
    }

    fetch(`/admin/api/personalities/${encodeURIComponent(slug)}`, {
      method: 'DELETE',
    })
      .then((resp) => {
        if (resp.status === 401) {
          loginModal?.show();
          throw new Error('Bu işlem için giriş yapmalısınız.');
        }
        if (!resp.ok) {
          return resp.json().then((data) => {
            const message = data?.message || data?.error || 'Silme işlemi başarısız oldu.';
            throw new Error(message);
          }).catch((err) => {
            if (err instanceof Error) throw err;
            throw new Error('Silme işlemi başarısız oldu.');
          });
        }
        return resp.json();
      })
      .then(() => {
        loadPersonalities();
      })
      .catch((err) => {
        alert(err.message || 'Kişilik silinemedi.');
      });
  }

  function handleSetDefaultPersonality(slug) {
    if (!slug) return;
    if (!requireAdmin()) return;

    fetch(`/admin/api/personalities/${encodeURIComponent(slug)}/default`, {
      method: 'POST',
    })
      .then((resp) => {
        if (resp.status === 401) {
          loginModal?.show();
          throw new Error('Bu işlem için giriş yapmalısınız.');
        }
        if (!resp.ok) {
          return resp.json().then((data) => {
            const message = data?.message || data?.error || 'Varsayılan kişilik güncellenemedi.';
            throw new Error(message);
          }).catch((err) => {
            if (err instanceof Error) throw err;
            throw new Error('Varsayılan kişilik güncellenemedi.');
          });
        }
        return resp.json();
      })
      .then((data) => {
        defaultPersonalityId = data?.default || slug;
        renderPersonalities();
      })
      .catch((err) => {
        alert(err.message || 'Varsayılan kişilik belirlenemedi.');
      });
  }

  function uploadAvatar(slug, file) {
    if (!slug || !file) return Promise.resolve();
    const formData = new FormData();
    formData.append('avatar', file);
    return fetch(`/admin/api/personalities/${encodeURIComponent(slug)}/avatar`, {
      method: 'POST',
      body: formData,
    }).then((resp) => {
      if (resp.status === 401) {
        loginModal?.show();
        throw new Error('Bu işlem için giriş yapmalısınız.');
      }
      if (!resp.ok) {
        return resp.json().then((data) => {
          const message = data?.message || data?.error || 'Avatar yüklenemedi.';
          throw new Error(message);
        }).catch((err) => {
          if (err instanceof Error) throw err;
          throw new Error('Avatar yüklenemedi.');
        });
      }
      return resp.json();
    });
  }

  function deleteAvatar(slug) {
    if (!slug) return Promise.resolve();
    return fetch(`/admin/api/personalities/${encodeURIComponent(slug)}/avatar`, {
      method: 'DELETE',
    }).then((resp) => {
      if (resp.status === 401) {
        loginModal?.show();
        throw new Error('Bu işlem için giriş yapmalısınız.');
      }
      if (!resp.ok) {
        return resp.json().then((data) => {
          const message = data?.message || data?.error || 'Avatar silinemedi.';
          throw new Error(message);
        }).catch((err) => {
          if (err instanceof Error) throw err;
          throw new Error('Avatar silinemedi.');
        });
      }
      return resp.json();
    });
  }

  function loadPersonalities() {
    if (!personalitiesTableBody) return;
    setPersonalityLoading(true);
    clearPersonalityError();

    if (!hasAdminAccess()) {
      personalityList = [];
      defaultPersonalityId = null;
      setPersonalityLoading(false);
      renderPersonalities();
      return;
    }

    fetch('/admin/api/personalities')
      .then((resp) => {
        if (!resp.ok) {
          throw new Error('Kişilik listesi alınamadı');
        }
        return resp.json();
      })
      .then((data) => {
        personalityList = Array.isArray(data?.items)
          ? data.items.map((item) => {
              const normalized = { ...item };
              normalized.avatar_url = item?.avatar_url || null;
              normalized.avatar_resolved = resolveAvatarUrl(normalized.avatar_url);
              return normalized;
            })
          : [];
        defaultPersonalityId = data?.default || (personalityList[0]?.id ?? null);
        syncPersonalityRegistry();
        populatePersonalityFilters();
        renderPersonalities();
        if (chatResultsTable) {
          chatResultsTable.rows().invalidate().draw(false);
        }
      })
      .catch((err) => {
        console.error('Personality load error', err);
        showPersonalityError('Kişilikler yüklenirken bir sorun oluştu.');
      })
      .finally(() => {
        setPersonalityLoading(false);
      });
  }

  // New chat log management state
  let chatResultsTable;
  let currentSearchMode = 'basic'; // basic, session, feedback, advanced
  let currentResults = [];
  let currentPage = 1;
  let currentPerPage = 25;
  let currentFilter = {};
  let availableSeasons = new Set();

  const POST_LOGIN_DEFAULT_FILE = 'pdf_qa_ogrenci_kilavuzu_2024_2025.json';

  function loadSystemPrompt() {
    if (!systemPromptInput) return Promise.resolve();
    if (!hasAdminAccess()) {
      const message = hasQaAccess()
        ? 'Bu bölüme yalnızca admin erişebilir.'
        : 'Giriş yaptıktan sonra düzenleyebilirsiniz.';
      showSystemPromptStatus(message, 'muted');
      return Promise.resolve();
    }
    setSystemPromptControlsEnabled(false);
    showSystemPromptStatus('Yükleniyor...', 'muted');
    return fetch('/admin/api/system_prompt')
      .then((resp) => {
        if (resp.status === 401) {
          loginModal?.show();
          throw new Error('Bu işlem için giriş yapmalısınız.');
        }
        if (!resp.ok) {
          throw new Error('Sistem promptu alınamadı.');
        }
        return resp.json();
      })
      .then((data) => {
        currentSystemPrompt = data?.base_prompt || '';
        if (systemPromptInput) {
          systemPromptInput.value = currentSystemPrompt;
        }
        if (hasAdminAccess()) {
          setSystemPromptControlsEnabled(true);
        }
        handleSystemPromptInput();
        return data;
      })
      .catch((err) => {
        showSystemPromptStatus(err.message || 'Sistem promptu alınamadı.', 'danger');
        if (hasAdminAccess()) {
          setSystemPromptControlsEnabled(true);
        }
        throw err;
      });
  }

  function saveSystemPrompt() {
    if (!systemPromptInput || !hasAdminAccess()) return;
    const value = systemPromptInput.value.trim();
    if (!value) {
      showSystemPromptStatus('Prompt boş olamaz.', 'danger');
      systemPromptInput.focus();
      return;
    }
    setSystemPromptControlsEnabled(false);
    showSystemPromptStatus('Kaydediliyor...', 'muted');
    fetch('/admin/api/system_prompt', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base_prompt: value }),
    })
      .then((resp) => {
        if (resp.status === 401) {
          loginModal?.show();
          throw new Error('Bu işlem için giriş yapmalısınız.');
        }
        if (!resp.ok) {
          return resp.json().then((data) => {
            const message = data?.message || data?.error || 'Sistem promptu kaydedilemedi.';
            throw new Error(message);
          }).catch((err) => {
            if (err instanceof Error) throw err;
            throw new Error('Sistem promptu kaydedilemedi.');
          });
        }
        return resp.json();
      })
      .then(() => {
        currentSystemPrompt = value;
        showSystemPromptStatus('Kaydedildi.', 'success');
      })
      .catch((err) => {
        showSystemPromptStatus(err.message || 'Sistem promptu kaydedilemedi.', 'danger');
      })
      .finally(() => {
        if (hasAdminAccess()) {
          setSystemPromptControlsEnabled(true);
          handleSystemPromptInput();
        } else {
          setSystemPromptControlsEnabled(false);
        }
      });
  }

  function handleSystemPromptInput() {
    if (!systemPromptInput || !saveSystemPromptBtn) return;
    if (!hasAdminAccess()) {
      saveSystemPromptBtn.disabled = true;
      return;
    }
    const value = systemPromptInput.value;
    const trimmedValue = value.trim();
    const trimmedCurrent = currentSystemPrompt.trim();
    if (!trimmedValue) {
      showSystemPromptStatus('Prompt girilmedi.', 'warning');
      saveSystemPromptBtn.disabled = true;
      return;
    }
    if (trimmedValue === trimmedCurrent) {
      showSystemPromptStatus('Kaydedildi.', 'success');
      saveSystemPromptBtn.disabled = true;
    } else {
      showSystemPromptStatus('Kaydedilmedi.', 'warning');
      saveSystemPromptBtn.disabled = false;
    }
  }

  function updateAuthUI() {
    const qaAccess = hasQaAccess();
    const adminAccess = hasAdminAccess();
    isAuthenticated = qaAccess;

    $('#loginBtn').toggle(!qaAccess);
    $('#logoutBtn').toggle(qaAccess);
    $('#addBtn').prop('disabled', !qaAccess);
    if (qaTable) qaTable.draw();

    if (qaAccess) {
      $('#loginPasswordInput').val('');
      $('#loginError').hide();
      $('#loginForm').removeClass('was-validated');
    } else {
      $('#loginError').hide();
      $('#loginForm').removeClass('was-validated');
      loginModal?.show();
    }

    toggleAdminTabs(adminAccess);

    if (adminAccess) {
      if (addPersonalityBtn) addPersonalityBtn.disabled = false;
      setSystemPromptControlsEnabled(true);
      handleSystemPromptInput();
    } else {
      if (addPersonalityBtn) addPersonalityBtn.disabled = true;
      currentSystemPrompt = '';
      if (systemPromptInput) systemPromptInput.value = '';
      setSystemPromptControlsEnabled(false);
      const statusMessage = qaAccess
        ? 'Bu bölüme yalnızca admin erişebilir.'
        : 'Giriş yaptıktan sonra düzenleyebilirsiniz.';
      showSystemPromptStatus(statusMessage, 'muted');
      $('#totalChats, #totalLikes, #totalDislikes').text('-');
      $('#currentSeason').text('-');
    }

    if (lastKnownRole !== adminRole) {
      lastKnownRole = adminRole;
      if (adminAccess) {
        loadPersonalities();
        loadSystemPrompt().catch(() => {});
        updateOverviewStats();
      } else {
        personalityList = [];
        renderPersonalities();
      }
    } else if (adminAccess) {
      renderPersonalities();
      handleSystemPromptInput();
    }
  }

  $.getJSON('/admin/api/auth_status', (data) => {
    adminRole = data?.role || null;
    isAuthenticated = Boolean(data?.authenticated);
    updateAuthUI();
  }).fail(() => {
    adminRole = null;
    isAuthenticated = false;
    updateAuthUI();
  });

  $.getJSON('/admin/api/files', (files) => {
    allFiles = Array.isArray(files) ? files : [];
    if (!allFiles.length) {
      alert('data/ klasöründe JSON dosyası bulunamadı.');
      $('#addBtn').prop('disabled', true);
      return;
    }
    allFiles.forEach((f) => $fileSel.append(`<option value="${f}">${f}</option>`));
    currentFile = allFiles.includes(defaultFile) ? defaultFile : allFiles[0];
    $fileSel.val(currentFile);
    if (currentFile) {
      initQaTable();
    } else {
      alert('Yüklenecek veri dosyası bulunamadı.');
      $('#addBtn').prop('disabled', true);
    }
  });

  $.fn.dataTable.ext.errMode = 'none';

  function initQaTable() {
    qaTable = $('#qaTable').DataTable({
      ajax: {
        url: '/admin/api/items',
        data: function(){ return { file: currentFile }; },
        dataSrc: '',
        type: 'GET',
        cache: false,
      },
      columns: [
        { data: null, render: (_d, _t, _r, meta) => meta.row + 1 },
        { data: 'questions', render: (d) => `<span class='badge bg-info me-1'>${d.length}</span><ul class='mb-0'>${d.map((q) => `<li>${esc(q)}</li>`).join('')}</ul>` },
        { data: 'answer', render: (d) => esc(d) },
        { data: null, orderable: false, render: (_d, _t, _r, meta) => {
            if (!isAuthenticated) return '<small class="text-muted">Giriş Gerekli</small>';
            return `<button class='btn btn-sm btn-warning editBtn me-1' data-idx='${meta.row}'>Düzenle</button>` +
                   `<button class='btn btn-sm btn-danger delBtn' data-idx='${meta.row}'>Sil</button>`;
          } },
      ],
    });
  }

  // ===============================
  // NEW CHAT LOG FUNCTIONALITY
  // ===============================

  function initChatResultsTable() {
    if (chatResultsTable) return;
    
    chatResultsTable = $('#chatResultsTable').DataTable({
      data: [],
      columns: [
        { 
          data: null, 
          orderable: false,
          render: () => '<input type="checkbox" class="form-check-input result-checkbox">'
        },
        {
          data: 'timestamp',
          render: (d) => {
            if (!d) return '';
            const date = parseUtcLike(d);
            if (!date || isNaN(date.getTime())) return esc(d);
            return `<small>${date.toLocaleDateString('tr-TR')}<br>${date.toLocaleTimeString('tr-TR')}</small>`;
          }
        },
        { 
          data: 'season', 
          render: (d) => d ? `<span class="badge bg-secondary">${esc(d)}</span>` : '<span class="text-muted">-</span>' 
        },
        { 
          data: 'session_id', 
          render: (d) => {
            if (!d) return '';
            const label = `${d.substring(0, 12)}...`;
            return `<a href="#" class="open-session" data-session="${esc(d)}" title="Oturumu konuşma görünümünde aç">`
                 + `<code class="text-primary small">${esc(label)}</code></a>`;
          }
        },
        { 
          data: 'user_id', 
          render: (d) => d ? `<code class="text-info small">${esc(d.substring(0, 12))}...</code>` : '' 
        },
        { 
          data: 'assistant_personality', 
          render: (d) => d ? getPersonalityBadge(d) : '<span class="text-muted">-</span>'
        },
        { 
          data: 'feedback', 
          render: (d) => {
            if (d === 'like') return '<span class="badge bg-success"><i class="bi bi-hand-thumbs-up"></i></span>';
            if (d === 'dislike') return '<span class="badge bg-danger"><i class="bi bi-hand-thumbs-down"></i></span>';
            return '<span class="text-muted">-</span>';
          } 
        },
        { 
          data: 'user_message', 
          render: (d) => {
            const truncated = (d || '').length > 100 ? (d || '').substring(0, 100) + '...' : (d || '');
            return `<div class='text-break small' style='max-width: 250px;'>${esc(truncated)}</div>`;
          }
        },
        { 
          data: 'assistant_response', 
          render: (d, t, row) => {
            const truncated = (d || '').length > 100 ? (d || '').substring(0, 100) + '...' : (d || '');
            const personality = row.assistant_personality || 'bilinmiyor';
            const personalityBadge = getPersonalityBadge(personality);
            return `
              <div class='text-break small' style='max-width: 250px;'>
                ${personalityBadge}
                <div class="mt-1">${esc(truncated)}</div>
              </div>`;
          }
        },
        {
          data: null,
          orderable: false,
          render: (d, t, row) => {
            return `<button class="btn btn-outline-primary btn-sm view-detail" title="Detayları Görüntüle">
                <i class="bi bi-eye"></i>
            </button>`;
          }
        }
      ],
      order: [], // Don't apply default ordering - use server order
      ordering: false, // Disable client-side sorting completely
      paging: false,
      searching: false,
      info: false,
      responsive: true,
      language: {
        url: '//cdn.datatables.net/plug-ins/1.13.4/i18n/tr.json'
      }
    });
  }

  function updateOverviewStats() {
    // Only load stats if admin
    if (!hasAdminAccess()) {
      $('#totalChats, #totalLikes, #totalDislikes').text('-');
      $('#currentSeason').text('-');
      return;
    }
    
    // Get accurate stats from chat logs
    $.getJSON('/admin/api/chat/stats_summary', (stats) => {
      console.log('Chat stats received:', stats);
      
      // Total messages = total conversation exchanges
      $('#totalChats').text(stats.total_messages || 0);
      $('#totalLikes').text(stats.feedback_like || 0);
      $('#totalDislikes').text(stats.feedback_dislike || 0);
      
      // Calculate current season
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const currentSeason = month >= 9 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
      $('#currentSeason').text(currentSeason);
      
      // Update season filters
      updateSeasonFilters(stats.by_season || {});
    }).fail((xhr, status, error) => {
      console.error('Chat stats API failed:', xhr, status, error);
      $('#totalChats, #totalLikes, #totalDislikes').text('0');
      $('#currentSeason').text('-');
      
      if (xhr.status === 401) {
        loginModal?.show();
      }
    });
  }

  function updateSeasonFilters(seasonData) {
    const seasons = Object.keys(seasonData).sort().reverse();
    
    $('#seasonFilterGlobal, #feedbackSeasonFilter, #advancedSeasonFilter').each(function() {
      const $select = $(this);
      const currentVal = $select.val();
      $select.empty().append('<option value="">Tüm sezonlar</option>');
      seasons.forEach(season => {
        $select.append(`<option value="${esc(season)}">${esc(season)}</option>`);
      });
      if (currentVal) $select.val(currentVal);
    });
  }

  function loadSessions() {
    if (!hasAdminAccess()) {
      requireAdmin();
      return;
    }
    $.getJSON('/admin/api/chat/sessions', (sessions) => {
      const $sessionSelect = $('#sessionSelect');
      $sessionSelect.empty().append('<option value="">Oturum seçin...</option>');
      
      if (!sessions?.length) {
        $sessionSelect.append('<option value="" disabled>(Oturum bulunamadı)</option>');
        return;
      }
      
      sessions.forEach(session => {
        let last = session.last_activity || '';
        if (last) {
          const dt = parseUtcLike(last);
          last = dt && !isNaN(dt) ? dt.toLocaleString('tr-TR') : last;
        }
        const label = `${session.session_id}${last ? ' (' + last + ')' : ''}`;
        $sessionSelect.append(`<option value="${session.session_id}">${esc(label)}</option>`);
      });
    }).fail((xhr) => {
      if (xhr.status === 401) loginModal?.show();
    });
  }

  function loadUsersForSession(sessionId) {
    if (!hasAdminAccess()) {
      requireAdmin();
      return;
    }
    if (!sessionId) {
      $('#sessionUsersInfo').hide();
      return;
    }
    
    $.getJSON(`/admin/api/chat/users?session=${encodeURIComponent(sessionId)}`, (users) => {
      const $tableBody = $('#sessionUsersTable tbody');
      $tableBody.empty();
      
      if (!users?.length) {
        $tableBody.append('<tr><td colspan="6" class="text-center text-muted">Bu oturumda kullanıcı bulunamadı</td></tr>');
        return;
      }
      
      users.forEach(user => {
        const successRate = user.total > 0 ? Math.round((user.like / user.total) * 100) : 0;
        const lastDt = parseUtcLike(user.last_activity);
        const lastActivity = lastDt && !isNaN(lastDt) ? lastDt.toLocaleString('tr-TR') : 'Bilinmiyor';
        
        const row = `
          <tr>
            <td><code class="small">${esc(user.user_id.substring(0, 16))}...</code></td>
            <td><span class="badge bg-primary">${user.total}</span></td>
            <td><span class="badge bg-success">${user.like}</span></td>
            <td><span class="badge bg-danger">${user.dislike}</span></td>
            <td><small>${lastActivity}</small></td>
            <td>
              <button class="btn btn-sm btn-outline-primary select-user" data-user-id="${esc(user.user_id)}">
                <i class="bi bi-arrow-right"></i> Seç
              </button>
              <button class="btn btn-sm btn-outline-danger ms-1 delete-user-log" data-user-id="${esc(user.user_id)}">
                <i class="bi bi-trash"></i> Sil
              </button>
            </td>
          </tr>
        `;
        $tableBody.append(row);
      });
      
      $('#sessionUsersInfo').show();
    });
  }

  function performSearch(searchParams) {
    if (!hasAdminAccess()) {
      requireAdmin();
      return;
    }
    const url = buildSearchUrl(searchParams);
    // Track current filter for follow-up actions
    currentFilter = Object.assign({}, searchParams);
    
    showLoading();
    
    $.getJSON(url, (response) => {
      console.log('Search response received:', response);
      updateResultsDisplay(response);
      hideLoading();
    }).fail((xhr) => {
      hideLoading();
      console.error('Search failed:', xhr);
      if (xhr.status === 401) {
        loginModal?.show();
      } else {
        alert('Arama sırasında bir hata oluştu: ' + (xhr.responseJSON?.error || xhr.statusText));
      }
    });
  }

  function buildSearchUrl(params) {
    let baseUrl;
    const queryParams = new URLSearchParams();
    
    if (params.mode === 'session') {
      baseUrl = '/admin/api/chat/logs_advanced';
    } else if (params.mode === 'global') {
      baseUrl = '/admin/api/chat/global_search';
    } else if (params.mode === 'feedback') {
      baseUrl = '/admin/api/chat/search_by_feedback';
    } else {
      // Default fallback
      baseUrl = '/admin/api/chat/search_by_feedback';
    }
    
    Object.keys(params).forEach(key => {
      if (key !== 'mode' && params[key] !== null && params[key] !== undefined && params[key] !== '') {
        queryParams.append(key, params[key]);
      }
    });
    
    console.log('Built URL:', `${baseUrl}?${queryParams.toString()}`);
    return `${baseUrl}?${queryParams.toString()}`;
  }

  function updateResultsDisplay(response) {
    initChatResultsTable();
    
    // Handle different response formats
    if (Array.isArray(response)) {
      // Direct array response (from search_by_feedback)
      currentResults = response;
    } else {
      // Object response with items (from global_search or logs_advanced)
      currentResults = response.items || [];
    }
    
    // Debug: show first few timestamps to verify sorting
    if (currentResults.length > 0) {
      console.log('Results timestamp order (first 5):');
      currentResults.slice(0, 5).forEach((item, i) => {
        console.log(`${i+1}. ${item.timestamp} (${item.assistant_personality || 'unknown'})`);
      });
    }
    
    chatResultsTable.clear();
    
    // Add data without reordering
    currentResults.forEach((item, index) => {
      chatResultsTable.row.add(item);
    });
    
    chatResultsTable.draw(false); // false = don't reset order
    
    // Update result count
    $('#resultCount').text(currentResults.length);
    
    // Update pagination if available
    if (response.pagination) {
      updatePagination(response.pagination);
    } else {
      $('#resultsPagination').empty();
      $('#paginationInfo').text('');
    }
    
    // Update info with more details
    const total = response.pagination ? response.pagination.total : currentResults.length;
    
    // Add date range info if applicable
    let dateInfo = '';
    if (currentResults.length > 0) {
      const dates = currentResults.map(r => r.timestamp).filter(t => t).sort();
      if (dates.length > 0) {
        const firstDt = parseUtcLike(dates[0]);
        const lastDt = parseUtcLike(dates[dates.length - 1]);
        const firstDate = firstDt && !isNaN(firstDt) ? firstDt.toLocaleDateString('tr-TR') : dates[0];
        const lastDate = lastDt && !isNaN(lastDt) ? lastDt.toLocaleDateString('tr-TR') : dates[dates.length - 1];
        if (firstDate === lastDate) {
          dateInfo = ` (${firstDate})`;
        } else {
          dateInfo = ` (${firstDate} - ${lastDate})`;
        }
      }
    }
    
    if (total === 0) {
      $('#resultsInfo').html(`<small><i class="bi bi-exclamation-circle text-warning"></i> Bu kriterlere uygun sonuç bulunamadı</small>`);
      $('#likeLoadStatus, #dislikeLoadStatus').text('Sonuç bulunamadı');
    } else {
      $('#resultsInfo').html(`<small><i class="bi bi-info-circle"></i> ${total} sonuç bulundu${dateInfo}</small>`);
      $('#likeLoadStatus, #dislikeLoadStatus').text(`${total} sonuç yüklendi`);
    }
    
    // Update seasons from results
    currentResults.forEach(item => {
      if (item.season) availableSeasons.add(item.season);
    });
  }

  function updatePagination(pagination) {
    if (!pagination) return;
    
    const { page, per_page, total, pages, has_prev, has_next } = pagination;
    
    // Update info
    const start = (page - 1) * per_page + 1;
    const end = Math.min(page * per_page, total);
    $('#paginationInfo').text(`${start}-${end} / ${total} sonuç`);
    
    // Build pagination controls
    const $pagination = $('#resultsPagination');
    $pagination.empty();
    
    if (pages <= 1) return;
    
    // Previous button
    $pagination.append(`
      <li class="page-item ${!has_prev ? 'disabled' : ''}">
        <a class="page-link" href="#" data-page="${page - 1}" ${!has_prev ? 'tabindex="-1"' : ''}>
          <i class="bi bi-chevron-left"></i>
        </a>
      </li>
    `);
    
    // Page numbers
    const startPage = Math.max(1, page - 2);
    const endPage = Math.min(pages, page + 2);
    
    for (let i = startPage; i <= endPage; i++) {
      $pagination.append(`
        <li class="page-item ${i === page ? 'active' : ''}">
          <a class="page-link" href="#" data-page="${i}">${i}</a>
        </li>
      `);
    }
    
    // Next button
    $pagination.append(`
      <li class="page-item ${!has_next ? 'disabled' : ''}">
        <a class="page-link" href="#" data-page="${page + 1}" ${!has_next ? 'tabindex="-1"' : ''}>
          <i class="bi bi-chevron-right"></i>
        </a>
      </li>
    `);
  }

  function showMessageDetail(rowData) {
    if (!messageDetailModal) return;
    
    // Populate modal with data
    $('#modalSessionId').text(rowData.session_id || '');
    $('#modalUserId').text(rowData.user_id || '');
    (function(){
      const dt = parseUtcLike(rowData.timestamp);
      $('#modalTimestamp').text(dt && !isNaN(dt) ? dt.toLocaleString('tr-TR') : (rowData.timestamp || ''));
    })();
    $('#modalSeason').text(rowData.season || 'Bilinmiyor');
    $('#modalSessionBadge').text(`#${(rowData.idx || 0) + 1}`);
    
    $('#modalUserMessage').text(rowData.user_message || '');
    $('#modalAssistantResponse').text(rowData.assistant_response || '');
    
    $('#modalUserMessageLength').text((rowData.user_message || '').length);
    $('#modalAssistantResponseLength').text((rowData.assistant_response || '').length);
    
    // Handle personality
    if (rowData.assistant_personality) {
      const personalityBadge = getPersonalityBadge(rowData.assistant_personality);
      $('#modalPersonalityBadge').html(personalityBadge).show();
    } else {
      $('#modalPersonalityBadge').hide();
    }
    
    // Handle feedback
    let feedbackHtml = '<span class="text-muted">Değerlendirmesiz</span>';
    if (rowData.feedback === 'like') {
      feedbackHtml = '<span class="badge bg-success"><i class="bi bi-hand-thumbs-up"></i> Like</span>';
    } else if (rowData.feedback === 'dislike') {
      feedbackHtml = '<span class="badge bg-danger"><i class="bi bi-hand-thumbs-down"></i> Dislike</span>';
    }
    $('#modalFeedback').html(feedbackHtml);
    
    // Handle RAG information
    if (rowData.retrieval_hits && rowData.retrieval_hits.length > 0) {
      let ragHtml = '';
      rowData.retrieval_hits.forEach((hit, index) => {
        ragHtml += `
          <div class="card mb-2">
            <div class="card-body">
              <h6 class="card-title">Hit #${index + 1} <span class="badge bg-info">${(hit.similarity * 100).toFixed(1)}%</span></h6>
              <p class="card-text"><strong>Soru:</strong> ${esc(hit.question)}</p>
              <p class="card-text"><strong>Cevap:</strong> ${esc(hit.answer)}</p>
            </div>
          </div>
        `;
      });
      $('#modalRagContent').html(ragHtml);
      $('#modalRagSection').show();
    } else {
      $('#modalRagSection').hide();
    }
    
    // Store current row data for feedback updates
    messageDetailModal._currentRowData = rowData;
    
    messageDetailModal.show();
  }

  function showLoading() {
    $('#resultsInfo').html('<small><i class="bi bi-hourglass-split"></i> Yükleniyor...</small>');
  }

  function hideLoading() {
    // Loading state will be updated by updateResultsDisplay
  }

  function exportResults(format) {
    if (!currentResults.length) {
      alert('Dışa aktarılacak veri bulunamadı.');
      return;
    }
    
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    
    if (format === 'json') {
      const jsonData = JSON.stringify(currentResults, null, 2);
      downloadFile(`chat_logs_${timestamp}.json`, jsonData, 'application/json');
    } else if (format === 'csv') {
      const csvContent = convertToCSV(currentResults);
      downloadFile(`chat_logs_${timestamp}.csv`, csvContent, 'text/csv');
    } else if (format === 'txt') {
      const txtContent = convertToTXT(currentResults);
      downloadFile(`chat_logs_${timestamp}.txt`, txtContent, 'text/plain');
    }
  }

  function convertToCSV(data) {
    const headers = ['Timestamp', 'Season', 'Session', 'User', 'Feedback', 'User Message', 'Assistant Response'];
    const csvContent = [headers.join(',')];
    
    data.forEach(row => {
      const csvRow = [
        `"${row.timestamp || ''}"`,
        `"${row.season || ''}"`,
        `"${row.session_id || ''}"`,
        `"${row.user_id || ''}"`,
        `"${row.feedback || ''}"`,
        `"${(row.user_message || '').replace(/"/g, '""')}"`,
        `"${(row.assistant_response || '').replace(/"/g, '""')}"`
      ];
      csvContent.push(csvRow.join(','));
    });

    return csvContent.join('\n');
  }

  function convertToTXT(data) {
    let txtContent = `Chat Logs Export - ${new Date().toLocaleString('tr-TR')}\n`;
    txtContent += '='.repeat(60) + '\n\n';
    
    data.forEach((row, index) => {
      txtContent += `Chat #${index + 1}\n`;
      txtContent += `-`.repeat(20) + '\n';
      txtContent += `Zaman: ${row.timestamp || 'Bilinmiyor'}\n`;
      txtContent += `Sezon: ${row.season || 'Bilinmiyor'}\n`;
      txtContent += `Oturum: ${row.session_id || 'Bilinmiyor'}\n`;
      txtContent += `Kullanıcı: ${row.user_id || 'Bilinmiyor'}\n`;
      txtContent += `Geri Bildirim: ${row.feedback || 'Değerlendirmesiz'}\n\n`;
      txtContent += `Kullanıcı Mesajı:\n${row.user_message || 'Boş'}\n\n`;
      txtContent += `Asistan Yanıtı:\n${row.assistant_response || 'Boş'}\n\n`;
      txtContent += '='.repeat(60) + '\n\n';
    });
    
    return txtContent;
  }

  function downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  }

  // ===============================
  // EVENT HANDLERS
  // ===============================

  // Personality management actions
  if (refreshPersonalitiesBtn) {
    refreshPersonalitiesBtn.addEventListener('click', () => {
      loadPersonalities();
      if (hasAdminAccess()) {
        loadSystemPrompt().catch(() => {});
      }
    });
  }
  if (addPersonalityBtn) {
    addPersonalityBtn.addEventListener('click', () => openPersonalityModal());
  }
  if (personalityForm) {
    personalityForm.addEventListener('submit', handlePersonalitySubmit);
  }
  if (personalityThemeInput) {
    personalityThemeInput.addEventListener('change', () => {
      applyThemeDefaults(personalityThemeInput.value, !editingPersonalityId);
    });
  }
  if (personalityAvatarInput) {
    personalityAvatarInput.addEventListener('change', handleAvatarFileChange);
  }
  if (removePersonalityAvatarBtn) {
    removePersonalityAvatarBtn.addEventListener('click', (event) => {
      event.preventDefault();
      handleRemoveAvatarClick();
    });
  }
  if (systemPromptInput) {
    systemPromptInput.addEventListener('input', handleSystemPromptInput);
  }
  if (saveSystemPromptBtn) {
    saveSystemPromptBtn.addEventListener('click', (event) => {
      event.preventDefault();
      saveSystemPrompt();
    });
  }
  if (reloadSystemPromptBtn) {
    reloadSystemPromptBtn.addEventListener('click', (event) => {
      event.preventDefault();
      loadSystemPrompt().catch(() => {});
    });
  }
  if (personalitiesTableBody) {
    personalitiesTableBody.addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if (!button) return;
      const slug = button.dataset.personality;
      if (!slug) return;
      if (button.classList.contains('edit-personality')) {
        openPersonalityModal(slug);
      } else if (button.classList.contains('delete-personality')) {
        handleDeletePersonality(slug);
      } else if (button.classList.contains('set-default-personality')) {
        handleSetDefaultPersonality(slug);
      }
    });
  }
  if (personalityModalEl) {
    personalityModalEl.addEventListener('hidden.bs.modal', () => {
      editingPersonalityId = null;
      resetPersonalityForm();
    });
  }

  // File selection change (QA table)
  $('#fileSelect').on('change', function () {
    currentFile = this.value;
    if (qaTable) qaTable.ajax.reload();
  });

  // Tab change handler - initialize chat log interface
  $('#logs-tab').on('shown.bs.tab', () => {
    if (!hasAdminAccess()) {
      requireAdmin();
      if (qaTabEl) {
        bootstrap.Tab.getOrCreateInstance(qaTabEl).show();
      }
      return;
    }
    initChatResultsTable();
    updateOverviewStats();
    loadSessions();
  });

  // Session selection change
  $('#sessionSelect').on('change', function() {
    const sessionId = $(this).val();
    
    if (sessionId) {
      // Enable the load button
      $('#loadSessionData').prop('disabled', false);
      $('#openSessionViewerBtn').prop('disabled', false);
      
      // Load and display users for this session
      loadUsersForSession(sessionId);
      $('#sessionUsersInfo').show();
    } else {
      // Disable the load button and hide user info
      $('#loadSessionData').prop('disabled', true);
      $('#openSessionViewerBtn').prop('disabled', true);
      $('#sessionUsersInfo').hide();
    }
  });

  // Search handlers
  $('#searchGlobal').on('click', function() {
    const fromDate = $('#globalFromDate').val();
    const toDate = $('#globalToDate').val();
    
    // If specific dates are selected, use more results
    const perPage = (fromDate || toDate) ? 50 : 25;
    
    const searchParams = {
      mode: 'global',
      q: $('#globalSearch').val(),
      season: $('#seasonFilterGlobal').val(),
      sort: $('#globalSortOrder').val(),
      from: fromDate,
      to: toDate,
      page: 1,
      per_page: perPage,
      limit: (fromDate || toDate) ? 200 : 100
    };
    
    console.log('Global search clicked. Params:', searchParams);
    performSearch(searchParams);
  });

  $('#loadSessionData').on('click', function() {
    const sessionId = $('#sessionSelect').val();
    
    if (!sessionId) {
      alert('Lütfen önce bir oturum seçin.');
      return;
    }
    
    // Check if there are multiple users in this session
    const userRows = $('#sessionUsersTable tbody tr').length;
    
    if (userRows === 0) {
      alert('Bu oturumda kullanıcı bulunamadı.');
      return;
    } else if (userRows === 1) {
      // Single user - automatically load their data
      const userId = $('#sessionUsersTable tbody tr').first().find('.select-user').data('user-id');
      loadSessionMessages(sessionId, userId);
    } else {
      // Multiple users - show all users' messages
      loadAllSessionMessages(sessionId);
    }
  });

  // Open conversation viewer for selected session
  $('#openSessionViewerBtn').on('click', function() {
    const sessionId = $('#sessionSelect').val();
    if (!sessionId) {
      alert('Lütfen önce bir oturum seçin.');
      return;
    }
    openSessionViewer(sessionId);
  });

  // Handle user selection from session users table
  $(document).on('click', '.select-user', function() {
    const sessionId = $('#sessionSelect').val();
    const userId = $(this).data('user-id');
    
    // Highlight selected user
    $('#sessionUsersTable tbody tr').removeClass('table-active');
    $(this).closest('tr').addClass('table-active');
    
    // Load messages for this specific user
    loadSessionMessages(sessionId, userId);
  });

  // Delete a single user's log file within a session
  $(document).on('click', '.delete-user-log', function() {
    if (!requireAdmin()) return;
    const sessionId = $('#sessionSelect').val();
    const userId = $(this).data('user-id');
    if (!sessionId || !userId) return;
    if (!confirm('Bu kullanıcının loglarını silmek istediğinize emin misiniz?')) return;
    $.ajax({
      url: `/admin/api/chat/log?session=${encodeURIComponent(sessionId)}&user_id=${encodeURIComponent(userId)}`,
      method: 'DELETE',
      success: () => {
        loadUsersForSession(sessionId);
        if (currentFilter && currentFilter.mode) performSearch(currentFilter);
      },
      error: (xhr) => {
        let msg = xhr.responseJSON?.message || 'Silme işlemi sırasında bir hata oluştu.';
        if (xhr.status === 401) msg += ' Lütfen tekrar giriş yapmayı deneyin.';
        alert(msg);
      },
    });
  });

  function openSessionViewer(sessionId) {
    if (!requireAdmin()) return;
    currentSessionForModal = sessionId;
    $('#convSessionId').text(sessionId);
    $('#conversationContainer').html('<div class="text-center text-muted py-4"><i class="bi bi-hourglass-split"></i> Yükleniyor...</div>');
    sessionConversationModal?.show();
    $.getJSON(`/admin/api/chat/session_messages?session=${encodeURIComponent(sessionId)}`, (resp) => {
      const items = resp?.items || [];
      renderConversation(items);
    }).fail((xhr) => {
      if (xhr.status === 401) {
        sessionConversationModal?.hide();
        loginModal?.show();
      } else {
        $('#conversationContainer').html('<div class="text-danger">Veriler yüklenemedi.</div>');
      }
    });
  }

  function renderConversation(items) {
    const $c = $('#conversationContainer');
    $c.empty();
    if (!items.length) {
      $c.html('<div class="text-center text-muted py-4"><i class="bi bi-inbox"></i> Bu oturumda mesaj bulunamadı</div>');
      return;
    }
    items.forEach((e) => {
      const ts = e.timestamp ? new Date(e.timestamp).toLocaleString('tr-TR') : '';
      const userHtml = `
        <div class="d-flex align-items-start mb-2">
          <div class="me-2"><i class="bi bi-person-circle text-primary"></i></div>
          <div class="flex-grow-1">
            <div class="message-bubble user">${esc(e.user_message || '')}</div>
            <div class="small text-muted">${ts}</div>
          </div>
        </div>`;
      const assistantHtml = `
        <div class="d-flex align-items-start mb-4">
          <div class="me-2"><i class="bi bi-robot text-success"></i></div>
          <div class="flex-grow-1">
            <div class="message-bubble assistant">${esc(e.assistant_response || '')}</div>
            <div class="small text-muted">${e.assistant_personality ? getPersonalityBadge(e.assistant_personality) : ''}</div>
          </div>
        </div>`;
      $c.append(userHtml).append(assistantHtml);
    });
  }

  // Delete entire session from conversation modal
  $('#deleteSessionBtn').on('click', function() {
    if (!requireAdmin()) return;
    const sess = currentSessionForModal;
    if (!sess) return;
    if (!confirm('Bu oturumu ve tüm loglarını silmek istediğinize emin misiniz?')) return;
    $.ajax({
      url: `/admin/api/chat/sessions/${encodeURIComponent(sess)}`,
      method: 'DELETE',
      success: () => {
        sessionConversationModal?.hide();
        loadSessions();
        $('#sessionUsersInfo').hide();
        if (currentFilter && currentFilter.mode) performSearch(currentFilter);
      },
      error: (xhr) => {
        let msg = xhr.responseJSON?.message || 'Oturum silinirken bir hata oluştu.';
        if (xhr.status === 401) msg += ' Lütfen tekrar giriş yapmayı deneyin.';
        alert(msg);
      },
    });
  });

  function loadSessionMessages(sessionId, userId) {
    const searchParams = {
      mode: 'session',
      session: sessionId,
      user_id: userId,
      feedback: $('#sessionFeedbackFilter').val(),
      q: $('#sessionSearch').val(),
      page: 1,
      per_page: 25,
      sort: 'desc',
      order_by: 'timestamp'
    };
    performSearch(searchParams);
  }

  function loadAllSessionMessages(sessionId) {
    // For multiple users, use global search with session filter
    const searchParams = {
      mode: 'global',
      q: $('#sessionSearch').val(),
      feedback: $('#sessionFeedbackFilter').val(),
      page: 1,
      per_page: 50,
      limit: 200
    };
    
    // Add session filtering (we need to enhance the backend for this)
    console.log('Loading all messages for session:', sessionId);
    performSearch(searchParams);
  }

  $('#loadAllLikes').on('click', function() {
    if (!requireAdmin()) return;
    
    $('#likeLoadStatus').text('Yükleniyor...');
    
    const searchParams = {
      mode: 'feedback', // Use feedback-based search
      feedback: 'like',
      season: $('#feedbackSeasonFilter').val(),
      limit: $('#feedbackLimit').val() || 200,
      sort: $('#feedbackSortOrder').val() || 'desc' // User-selected sort order
    };
    console.log('Loading all likes with params:', searchParams);
    performSearch(searchParams);
  });

  $('#loadAllDislikes').on('click', function() {
    if (!requireAdmin()) return;
    
    $('#dislikeLoadStatus').text('Yükleniyor...');
    
    const searchParams = {
      mode: 'feedback', // Use feedback-based search  
      feedback: 'dislike',
      season: $('#feedbackSeasonFilter').val(),
      limit: $('#feedbackLimit').val() || 200,
      sort: $('#feedbackSortOrder').val() || 'desc' // User-selected sort order
    };
    console.log('Loading all dislikes with params:', searchParams);
    performSearch(searchParams);
  });

  $('#loadAdvancedSearch').on('click', function() {
    const searchParams = {
      mode: 'global',
      q: $('#advancedSearchText').val(),
      season: $('#advancedSeasonFilter').val(),
      feedback: $('#advancedFeedbackFilter').val(),
      personality: $('#advancedPersonalityFilter').val(),
      from: $('#advancedFromDate').val(),
      to: $('#advancedToDate').val(),
      sort: 'desc', // Always use desc for advanced search
      page: 1,
      per_page: $('#advancedPerPage').val() || 25,
      order_by: $('#advancedOrderBy').val() || 'timestamp'
    };
    performSearch(searchParams);
  });

  // Quick date filters
  $('#quickToday, #quick7d, #quick30d').on('click', function(e) {
    e.preventDefault();
    const $btn = $(this);
    const range = $btn.attr('id').replace('quick', '').toLowerCase();
    
    // Update button states
    $('#quickToday, #quick7d, #quick30d').removeClass('active');
    $btn.addClass('active');
    
    // Clear manual date inputs when using quick filters
    $('#globalFromDate, #globalToDate').val('');
    
    // Different per_page for different ranges
    let perPage = 25;
    if (range === 'today') perPage = 10;      // Less for today (more precise)
    else if (range === '7d') perPage = 25;    // Medium for week
    else if (range === '30d') perPage = 50;   // More for month
    
    const searchParams = {
      mode: 'global',
      range: range === 'today' ? 'today' : (range === '7d' ? '7d' : '30d'),
      q: $('#globalSearch').val(),
      season: $('#seasonFilterGlobal').val(),
      sort: $('#globalSortOrder').val(),
      page: 1,
      per_page: perPage,
      limit: range === 'today' ? 50 : 200  // Lower limit for today
    };
    
    console.log('Quick filter clicked:', range, 'Search params:', searchParams);
    performSearch(searchParams);
  });

  // View mode toggle
  $('input[name="viewMode"]').on('change', function() {
    if ($(this).attr('id') === 'tableView') {
      $('#tableViewContainer').show();
      $('#cardViewContainer').hide();
    } else {
      $('#tableViewContainer').hide();
      $('#cardViewContainer').show();
      renderCardView(currentResults);
    }
  });

  function renderCardView(results) {
    const $container = $('#chatResultsCards');
    $container.empty();
    
    if (!results || !results.length) {
      $container.html('<div class="col-12 text-center text-muted py-5"><i class="bi bi-inbox fs-1"></i><br>Gösterilecek sonuç bulunamadı</div>');
      return;
    }
    
    results.forEach((item, index) => {
      const feedbackBadge = item.feedback === 'like' ? 
        '<span class="badge bg-success"><i class="bi bi-hand-thumbs-up"></i> Like</span>' :
        item.feedback === 'dislike' ?
        '<span class="badge bg-danger"><i class="bi bi-hand-thumbs-down"></i> Dislike</span>' :
        '<span class="badge bg-secondary">Değerlendirmesiz</span>';
      
    const date = item.timestamp ? parseUtcLike(item.timestamp) : null;
    const dateStr = (date && !isNaN(date)) ? date.toLocaleDateString('tr-TR') + ' ' + date.toLocaleTimeString('tr-TR') : 'Bilinmiyor';
      
      const cardHtml = `
        <div class="col-md-6 col-lg-4">
          <div class="card h-100 chat-card" data-index="${index}">
            <div class="card-header d-flex justify-content-between align-items-center">
              <small class="text-muted">${dateStr}</small>
              ${feedbackBadge}
            </div>
            <div class="card-body">
              <div class="mb-3">
                <h6 class="card-title text-primary mb-2">
                  <i class="bi bi-person-fill"></i> Kullanıcı
                  ${item.season ? `<span class="badge bg-info ms-2">${esc(item.season)}</span>` : ''}
                </h6>
                <p class="card-text small text-truncate" style="max-height: 3.6em; overflow: hidden;">
                  ${esc(item.user_message || 'Mesaj bulunamadı')}
                </p>
              </div>
              
              <div class="mb-3">
                <h6 class="card-title text-success mb-2">
                  <i class="bi bi-robot"></i> Asistan
                  ${item.assistant_personality ? getPersonalityBadge(item.assistant_personality) : ''}
                </h6>
                <p class="card-text small text-truncate" style="max-height: 3.6em; overflow: hidden;">
                  ${esc(item.assistant_response || 'Yanıt bulunamadı')}
                </p>
              </div>
              
              <div class="text-muted small">
                <div><strong>Oturum:</strong> <code class="small">${esc((item.session_id || '').substring(0, 12))}...</code></div>
                <div><strong>Kullanıcı:</strong> <code class="small">${esc((item.user_id || '').substring(0, 12))}...</code></div>
              </div>
            </div>
            <div class="card-footer">
              <button class="btn btn-outline-primary btn-sm w-100 view-card-detail">
                <i class="bi bi-eye"></i> Detayları Görüntüle
              </button>
            </div>
          </div>
        </div>
      `;
      
      $container.append(cardHtml);
    });
  }
  
  // Card view detail click handler
  $(document).on('click', '.view-card-detail', function() {
    const index = parseInt($(this).closest('.chat-card').data('index'));
    const item = currentResults[index];
    if (item) {
      showMessageDetail(item);
    }
  });

  // Clicking a session code opens session conversation viewer
  $(document).on('click', '.open-session', function(e) {
    e.preventDefault();
    const sessionId = $(this).data('session');
    if (sessionId) openSessionViewer(sessionId);
  });

  // Export handlers
  $('#exportResultsJson').on('click', (e) => { e.preventDefault(); exportResults('json'); });
  $('#exportResultsCsv').on('click', (e) => { e.preventDefault(); exportResults('csv'); });
  $('#exportResultsTxt').on('click', (e) => { e.preventDefault(); exportResults('txt'); });

  // Result table row click handler
  $(document).on('click', '.view-detail', function() {
    const row = chatResultsTable.row($(this).closest('tr')).data();
    if (row) {
      showMessageDetail(row);
    }
  });

  // Pagination click handler
  $(document).on('click', '#resultsPagination .page-link', function(e) {
    e.preventDefault();
    const page = parseInt($(this).data('page'));
    if (page && page !== currentPage) {
      // Rebuild current search with new page
      currentFilter.page = page;
      performSearch(currentFilter);
    }
  });

  // Reset filters
  $('#resetAllFilters').on('click', function() {
    // Reset all form fields
    $('#globalSearch, #globalFromDate, #globalToDate, #sessionSearch, #advancedSearchText, #advancedFromDate, #advancedToDate').val('');
    $('#seasonFilterGlobal, #feedbackSeasonFilter, #advancedSeasonFilter, #sessionSelect, #userSelect, #advancedFeedbackFilter, #advancedPersonalityFilter').val('');
    $('#globalSortOrder').val('desc');
    $('#sessionFeedbackFilter').val('any');
    $('#feedbackSortOrder').val('desc');
    $('#advancedPerPage').val('25');
    $('#advancedOrderBy').val('timestamp');
    
    // Clear results
    if (chatResultsTable) {
      chatResultsTable.clear().draw();
    }
    currentResults = [];
    $('#resultCount').text('0');
    $('#resultsInfo').html('<small><i class="bi bi-info-circle"></i> Sonuçlar yükleniyor...</small>');
    
    // Clear pagination
    $('#resultsPagination').empty();
    $('#paginationInfo').text('');
  });

  // Clear search buttons
  $('#clearGlobalSearch').on('click', function() {
    $('#globalSearch').val('');
  });

  $('#clearAdvancedSearch').on('click', function() {
    $('#advancedSearchText').val('');
  });


  // Real-time search for global search
  let searchTimeout;
  $('#globalSearch').on('input', function() {
    clearTimeout(searchTimeout);
    const query = $(this).val();
    if (query.length >= 3) {
      searchTimeout = setTimeout(() => {
        $('#searchGlobal').click();
      }, 500);
    }
  });

  // ===============================
  // EXISTING QA FUNCTIONALITY
  // ===============================
  // Answer length controls
  const ANSWER_MIN = 600;
  const ANSWER_MAX = 1200;
  let currentAnswerLimit = ANSWER_MAX;

  function setAnswerLimit(limit) {
    currentAnswerLimit = Number(limit) || ANSWER_MAX;
    const $ans = $('#answerInput');
    const val = ($ans.val() || '').toString();
    $ans.attr('maxlength', currentAnswerLimit)
        .attr('placeholder', `En fazla ${currentAnswerLimit} karakter…`);
    $('#answerCount').text(`${val.length}/${currentAnswerLimit}`);
  }

  function resetQaForm() {
    const form = document.getElementById('qaForm');
    form?.reset();
    $('#qaForm').removeClass('was-validated');
    // default to short answers (600)
    const toggle = document.getElementById('longAnswerToggle');
    if (toggle) toggle.checked = false;
    setAnswerLimit(ANSWER_MIN);
    $('#editIdx').val('');
  }

  $('#loginBtn').on('click', () => loginModal?.show());
  $('#logoutBtn').on('click', () => {
    $.post('/admin/api/logout', (res) => {
      if (res?.logged_out) {
        adminRole = null;
        isAuthenticated = false;
        updateAuthUI();
      }
    });
  });

  $('#loginForm').on('submit', function (e) {
    e.preventDefault();
    const form = this;
    if (!form.checkValidity()) {
      form.classList.add('was-validated');
      return;
    }
    const password = $('#loginPasswordInput').val();
    $.ajax({
      url: '/admin/api/login',
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({ password }),
      success: (data) => {
        if (data?.authenticated) {
          adminRole = data?.role || null;
          isAuthenticated = true;
          $('#loginError').hide();
          loginModal?.hide();
          let switchFile = false;
          if (allFiles.includes(POST_LOGIN_DEFAULT_FILE) && currentFile !== POST_LOGIN_DEFAULT_FILE) {
            switchFile = true;
          }
          if (switchFile) {
            currentFile = POST_LOGIN_DEFAULT_FILE;
            $fileSel.val(currentFile);
            if (qaTable) {
              qaTable.ajax.reload(() => updateAuthUI());
            } else {
              initQaTable();
              updateAuthUI();
            }
          } else {
            updateAuthUI();
          }
        } else {
          adminRole = null;
          isAuthenticated = false;
          $('#loginError').text(data?.message || 'Giriş başarısız.').show();
          $('#loginPasswordInput').focus();
        }
      },
      error: (xhr) => {
        adminRole = null;
        isAuthenticated = false;
        $('#loginError').text(xhr.responseJSON?.message || 'Bir hata oluştu. Lütfen tekrar deneyin.').show();
      },
    });
  });

  $('#addBtn').on('click', () => {
    if (!isAuthenticated) {
      loginModal?.show();
      return;
    }
    $('#qaModalLabel').text('Yeni Kayıt');
    resetQaForm();
    qaModal?.show();
  });

  $('#qaTable').on('click', '.editBtn', function () {
    if (!isAuthenticated) {
      loginModal?.show();
      return;
    }
    const idx = $(this).data('idx');
    const row = qaTable.row(idx).data();
    $('#qaModalLabel').text('Kaydı Düzenle');
    $('#questionsInput').val((row.questions || []).join('\n'));
    $('#answerInput').val(row.answer || '');
    $('#editIdx').val(idx);
    // default to short limit on edit as well
    const toggle = document.getElementById('longAnswerToggle');
    if (toggle) toggle.checked = false;
    setAnswerLimit(ANSWER_MIN);
    $('#qaForm').removeClass('was-validated');
    qaModal?.show();
  });

  $('#qaTable').on('click', '.delBtn', function () {
    if (!isAuthenticated) {
      loginModal?.show();
      return;
    }
    const idx = $(this).data('idx');
    if (!confirm('Silmek istediğinize emin misiniz?')) return;
    $.ajax({
      url: `/admin/api/items/${idx}?file=${currentFile}`,
      method: 'DELETE',
      success: () => qaTable.ajax.reload(),
      error: (xhr) => {
        let msg = xhr.responseJSON?.message || 'Silme işlemi sırasında bir hata oluştu.';
        if (xhr.status === 401) msg += ' Lütfen tekrar giriş yapmayı deneyin.';
        alert(msg);
      },
    });
  });

  $('#qaForm').on('submit', function (e) {
    e.preventDefault();
    const form = this;
    form.classList.add('was-validated');
    if (!form.checkValidity()) return;
    if (!isAuthenticated) {
      loginModal?.show();
      return;
    }
    const questions = $('#questionsInput').val().split('\n').map((s) => s.trim()).filter(Boolean);
    const answer = $('#answerInput').val().trim();
    const idx = $('#editIdx').val();
    const payload = { questions, answer };
    const ajaxBase = {
      contentType: 'application/json',
      data: JSON.stringify(payload),
      success: () => {
        qaModal?.hide();
        qaTable.ajax.reload();
      },
      error: (xhr) => {
        let msg = xhr.responseJSON?.message || 'İşlem sırasında bir hata oluştu.';
        if (xhr.status === 401) msg += ' Lütfen tekrar giriş yapmayı deneyin.';
        alert(msg);
      },
    };
    if (idx) {
      $.ajax(Object.assign({ url: `/admin/api/items/${idx}?file=${currentFile}`, method: 'PUT' }, ajaxBase));
    } else {
      $.ajax(Object.assign({ url: `/admin/api/items?file=${currentFile}`, method: 'POST' }, ajaxBase));
    }
  });

  $('#answerInput').on('input', function () {
    const val = $(this).val();
    $('#answerCount').text(`${val.length}/${currentAnswerLimit}`);
  });

  // Toggle between 600 and 1200
  $(document).on('change', '#longAnswerToggle', function() {
    if (this.checked) setAnswerLimit(ANSWER_MAX); else setAnswerLimit(ANSWER_MIN);
  });

  $('#qaModal').on('shown.bs.modal', () => $('#questionsInput').trigger('focus'));

  // Keyboard shortcuts
  $(document).on('keydown', (e) => {
    // Ctrl+Enter for form submission
    if (e.ctrlKey && e.key === 'Enter') {
      if ($('#qaModal').hasClass('show') && isAuthenticated) {
        $('#qaForm').trigger('submit');
      } else if ($('#loginModal').hasClass('show')) {
        $('#loginForm').trigger('submit');
      }
      return;
    }

    // Escape to close modals
    if (e.key === 'Escape') {
      if ($('#messageDetailModal').hasClass('show')) {
        messageDetailModal?.hide();
      }
      return;
    }
  });
});
