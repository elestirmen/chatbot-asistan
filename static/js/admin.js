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
  const isActive = entry.active !== false;
  const color = esc(isActive ? (entry.badge_color || 'secondary') : 'secondary');
  const icon = esc(isActive ? (entry.badge_icon || 'person-circle') : 'slash-circle');
  const label = esc(entry.name || personality);
  const baseBadge = `<span class="badge bg-${color} mb-1"><i class="bi bi-${icon}"></i> ${label}</span>`;
  if (isActive) {
    return baseBadge;
  }
  return `${baseBadge} <span class="badge bg-secondary text-white mb-1">Pasif</span>`;
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
  const createFileBtn = document.getElementById('createFileBtn');
  const mergeFileBtn = document.getElementById('mergeFileBtn');
  const createFileModalEl = document.getElementById('createFileModal');
  const createFileModal = createFileModalEl ? new bootstrap.Modal(createFileModalEl) : null;
  const createFileForm = document.getElementById('createFileForm');
  const createFilenameInput = document.getElementById('createFilenameInput');
  const createFileSubmitBtn = document.getElementById('createFileSubmitBtn');
  const createCopySelect = document.getElementById('createCopySelect');
  const createFileStatus = document.getElementById('createFileStatus');
  const createInitialModeInputs = document.querySelectorAll('input[name="createInitialMode"]');
  const renameFileBtn = document.getElementById('renameFileBtn');
  const renameFileModalEl = document.getElementById('renameFileModal');
  const renameFileModal = renameFileModalEl ? new bootstrap.Modal(renameFileModalEl) : null;
  const renameFileForm = document.getElementById('renameFileForm');
  const renameFilenameInput = document.getElementById('renameFilenameInput');
  const renameCurrentName = document.getElementById('renameCurrentName');
  const renameFileStatus = document.getElementById('renameFileStatus');
  const renameFileSubmitBtn = document.getElementById('renameFileSubmitBtn');
  const mergeFileModalEl = document.getElementById('mergeFileModal');
  const mergeFileModal = mergeFileModalEl ? new bootstrap.Modal(mergeFileModalEl) : null;
  const mergeFileForm = document.getElementById('mergeFileForm');
  const mergeFileSubmitBtn = document.getElementById('mergeFileSubmitBtn');
  const mergeSourceSelect = document.getElementById('mergeSourceSelect');
  const mergeTargetExistingRadio = document.getElementById('mergeTargetExisting');
  const mergeTargetNewRadio = document.getElementById('mergeTargetNew');
  const mergeTargetSelect = document.getElementById('mergeTargetSelect');
  const mergeTargetExistingGroup = document.getElementById('mergeTargetExistingGroup');
  const mergeTargetNewGroup = document.getElementById('mergeTargetNewGroup');
  const mergeTargetNameInput = document.getElementById('mergeTargetNameInput');
  const mergeAllowDuplicatesInput = document.getElementById('mergeAllowDuplicatesInput');
  const mergeFileStatus = document.getElementById('mergeFileStatus');
  const qaTabEl = document.getElementById('qa-tab');
  const qaPaneEl = document.getElementById('qa-pane');
  const logsTabEl = document.getElementById('logs-tab');
  const logsPaneEl = document.getElementById('logs-pane');
  const modelsTabEl = document.getElementById('models-tab');
  const modelsPaneEl = document.getElementById('models-pane');
  const personalitiesTabEl = document.getElementById('personalities-tab');
  const personalitiesPaneEl = document.getElementById('personalities-pane');
  let qaTable;
  let initialQaDataLoaded = false;
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
  const personalityActiveInput = document.getElementById('personalityActive');
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
  const restartAppBtn = document.getElementById('restartAppBtn');
  let editingPersonalityId = null;
  let personalityList = [];
  let defaultPersonalityId = null;
  let currentSystemPrompt = '';
  let avatarRemoveRequested = false;
  let currentAvatarPreviewUrl = null;
  let existingAvatarRelative = null;
  const personalityEmojiInput = document.getElementById('personalityEmoji');

  const modelSelectInput = document.getElementById('modelSelect');
  const modelCustomInput = document.getElementById('modelCustomInput');
  const saveModelBtn = document.getElementById('saveModelBtn');
  const resetModelBtn = document.getElementById('resetModelBtn');
  const modelStatusEl = document.getElementById('modelStatus');
  const samplingControlsWrapper = document.getElementById('samplingControls');
  const temperatureInput = document.getElementById('temperatureInput');
  const topPInput = document.getElementById('topPInput');
  const FALLBACK_TEMPERATURE = 0.75;
  const FALLBACK_TOP_P = 0.9;
  const NUMBER_EPSILON = 0.00005;
  let persistedModelValue = '';
  let defaultModelValue = '';
  let persistedTemperature = FALLBACK_TEMPERATURE;
  let defaultTemperature = FALLBACK_TEMPERATURE;
  let persistedTopP = FALLBACK_TOP_P;
  let defaultTopP = FALLBACK_TOP_P;
  let modelSuggestions = [];

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
      { tab: modelsTabEl, pane: modelsPaneEl },
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

  function showModelStatus(message, tone = 'muted') {
    if (!modelStatusEl) return;
    modelStatusEl.textContent = message || '';
    modelStatusEl.className = `small d-block mt-2 text-${tone}`;
  }

  function setModelControlsEnabled(enabled) {
    if (modelSelectInput) modelSelectInput.disabled = !enabled;
    if (modelCustomInput) {
      const hidden = modelCustomInput.classList.contains('d-none');
      modelCustomInput.disabled = !enabled || hidden;
    }
    if (saveModelBtn) saveModelBtn.disabled = !enabled;
    if (resetModelBtn) resetModelBtn.disabled = !enabled;
    if (!enabled) {
      if (temperatureInput) temperatureInput.disabled = true;
      if (topPInput) topPInput.disabled = true;
    }
  }

  function toggleCustomModelInput(show, value) {
    if (!modelCustomInput) return;
    modelCustomInput.classList.toggle('d-none', !show);
    if (show) {
      if (typeof value === 'string') {
        modelCustomInput.value = value;
      }
      modelCustomInput.disabled = modelSelectInput?.disabled ?? false;
    } else {
      modelCustomInput.value = '';
      modelCustomInput.disabled = true;
    }
  }

  function updateSamplingControlsState(modelId) {
    const normalized = typeof modelId === 'string' ? modelId.trim().toLowerCase() : '';
    const isGpt5 = normalized.startsWith('gpt-5');
    if (samplingControlsWrapper) {
      samplingControlsWrapper.classList.toggle('d-none', isGpt5);
      samplingControlsWrapper.setAttribute('aria-hidden', isGpt5 ? 'true' : 'false');
    }
    const shouldDisable = !hasAdminAccess() || !normalized || isGpt5 || (modelSelectInput?.disabled ?? true);
    if (temperatureInput) temperatureInput.disabled = shouldDisable;
    if (topPInput) topPInput.disabled = shouldDisable;
  }

  function clampAndRound(value, min, max) {
    if (!Number.isFinite(value)) {
      return Math.round(min * 10000) / 10000;
    }
    const clamped = Math.min(Math.max(value, min), max);
    return Math.round(clamped * 10000) / 10000;
  }

  function approxEqual(a, b, epsilon = NUMBER_EPSILON) {
    if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
    return Math.abs(a - b) <= epsilon;
  }

  function formatNumber(value, digits = 4) {
    if (!Number.isFinite(value)) return '';
    const rounded = Math.round(value * 10 ** digits) / 10 ** digits;
    return rounded.toFixed(digits).replace(/\.?0+$/, '');
  }

  function setSamplingInputs(temperature, topP) {
    if (temperatureInput) {
      temperatureInput.value = formatNumber(temperature ?? persistedTemperature);
    }
    if (topPInput) {
      topPInput.value = formatNumber(topP ?? persistedTopP);
    }
  }

  function parseSamplingInput(inputEl, min, max, label, fallbackValue) {
    if (!inputEl) {
      return { value: clampAndRound(fallbackValue, min, max), error: null };
    }
    if (inputEl.disabled) {
      return { value: clampAndRound(fallbackValue, min, max), error: null };
    }
    const raw = (inputEl.value ?? '').trim();
    if (!raw) {
      return { value: clampAndRound(fallbackValue, min, max), error: `${label} alanı boş olamaz.` };
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      return { value: clampAndRound(fallbackValue, min, max), error: `${label} için geçerli bir sayı girin.` };
    }
    if (parsed < min || parsed > max) {
      return {
        value: clampAndRound(parsed, min, max),
        error: `${label} değeri ${formatNumber(min, 2)} ile ${formatNumber(max, 2)} aralığında olmalıdır.`,
      };
    }
    return { value: clampAndRound(parsed, min, max), error: null };
  }

  function collectSamplingState() {
    const temperatureState = parseSamplingInput(temperatureInput, 0, 2, 'Temperature', persistedTemperature);
    if (temperatureState.error) {
      return {
        valid: false,
        message: temperatureState.error,
        temperature: temperatureState.value,
        top_p: persistedTopP,
        dirtyTemperature: false,
        dirtyTopP: false,
      };
    }
    const topPState = parseSamplingInput(topPInput, 0, 1, 'Top-p', persistedTopP);
    if (topPState.error) {
      return {
        valid: false,
        message: topPState.error,
        temperature: temperatureState.value,
        top_p: topPState.value,
        dirtyTemperature: false,
        dirtyTopP: false,
      };
    }
    return {
      valid: true,
      message: null,
      temperature: temperatureState.value,
      top_p: topPState.value,
      dirtyTemperature: !approxEqual(temperatureState.value, persistedTemperature),
      dirtyTopP: !approxEqual(topPState.value, persistedTopP),
    };
  }

  function applyModelConfigData(data) {
    modelSuggestions = Array.isArray(data?.suggestions) ? data.suggestions : [];
    persistedModelValue = typeof data?.completion_model === 'string' ? data.completion_model.trim() : '';
    const previousDefaultModel = defaultModelValue;
    defaultModelValue = typeof data?.default_model === 'string'
      ? data.default_model.trim()
      : (previousDefaultModel || persistedModelValue);
    const defaultTempCandidate = (typeof data?.default_temperature === 'number' && Number.isFinite(data?.default_temperature))
      ? data?.default_temperature
      : FALLBACK_TEMPERATURE;
    const persistedTempCandidate = (typeof data?.temperature === 'number' && Number.isFinite(data?.temperature))
      ? data?.temperature
      : defaultTempCandidate;
    const defaultTopCandidate = (typeof data?.default_top_p === 'number' && Number.isFinite(data?.default_top_p))
      ? data?.default_top_p
      : FALLBACK_TOP_P;
    const persistedTopCandidate = (typeof data?.top_p === 'number' && Number.isFinite(data?.top_p))
      ? data?.top_p
      : defaultTopCandidate;

    defaultTemperature = clampAndRound(defaultTempCandidate, 0, 2);
    persistedTemperature = clampAndRound(persistedTempCandidate, 0, 2);
    defaultTopP = clampAndRound(defaultTopCandidate, 0, 1);
    persistedTopP = clampAndRound(persistedTopCandidate, 0, 1);

    populateModelOptions(persistedModelValue);
    setSamplingInputs(persistedTemperature, persistedTopP);
  }

  function populateModelOptions(selectedValue) {
    if (!modelSelectInput) return;
    const suggestions = Array.isArray(modelSuggestions) ? modelSuggestions : [];
    modelSelectInput.innerHTML = '';
    suggestions.forEach((item) => {
      if (!item || !item.id) return;
      const option = document.createElement('option');
      option.value = item.id;
      const label = item.label && item.label !== item.id ? `${item.label} (${item.id})` : item.id;
      option.textContent = label;
      modelSelectInput.appendChild(option);
    });
    const customOption = document.createElement('option');
    customOption.value = '__custom__';
    customOption.textContent = 'Özel model...';
    modelSelectInput.appendChild(customOption);
    const hasMatch = suggestions.some((item) => item.id === selectedValue);
    if (selectedValue && hasMatch) {
      modelSelectInput.value = selectedValue;
      toggleCustomModelInput(false);
    } else if (selectedValue) {
      modelSelectInput.value = '__custom__';
      toggleCustomModelInput(true, selectedValue);
    } else if (suggestions.length) {
      modelSelectInput.value = suggestions[0].id;
      toggleCustomModelInput(false);
    } else {
      modelSelectInput.value = '__custom__';
      toggleCustomModelInput(true, '');
    }
  }

  function getSelectedModelValue() {
    if (!modelSelectInput) return '';
    if (modelSelectInput.value === '__custom__') {
      return (modelCustomInput?.value || '').trim();
    }
    return modelSelectInput.value;
  }

  function handleModelInputChange() {
    if (!saveModelBtn || !modelStatusEl) return;
    if (!hasAdminAccess() || modelSelectInput?.disabled) {
      saveModelBtn.disabled = true;
      return;
    }
    const samplingState = collectSamplingState();
    if (!samplingState.valid) {
      showModelStatus(samplingState.message || 'Geçersiz değer.', 'danger');
      saveModelBtn.disabled = true;
      return;
    }
    const candidate = getSelectedModelValue();
    if (!candidate) {
      showModelStatus('Model adı boş olamaz.', 'warning');
      saveModelBtn.disabled = true;
      return;
    }
    const dirtyModel = candidate !== persistedModelValue;
    const hasChanges = dirtyModel || samplingState.dirtyTemperature || samplingState.dirtyTopP;
    if (!hasChanges) {
      const parts = [];
      if (candidate) parts.push(candidate);
      if (Number.isFinite(persistedTemperature)) parts.push(`T=${formatNumber(persistedTemperature, 3)}`);
      if (Number.isFinite(persistedTopP)) parts.push(`top-p=${formatNumber(persistedTopP, 3)}`);
      const suffix = parts.length ? ` (${parts.join(', ')})` : '';
      showModelStatus(`Kaydedildi.${suffix}`, 'success');
      saveModelBtn.disabled = true;
    } else {
      showModelStatus('Kaydedilmedi.', 'warning');
      saveModelBtn.disabled = false;
    }
  }

  function handleModelSelectChange() {
    if (!modelSelectInput) return;
    if (modelSelectInput.value === '__custom__') {
      toggleCustomModelInput(true);
      if (!modelCustomInput?.value && persistedModelValue && !modelSuggestions.some((item) => item.id === persistedModelValue)) {
        modelCustomInput.value = persistedModelValue;
      }
    } else {
      toggleCustomModelInput(false);
    }
    updateSamplingControlsState(getSelectedModelValue());
    handleModelInputChange();
  }

  function loadModelConfig() {
    if (!modelSelectInput) return Promise.resolve();
    if (!hasAdminAccess()) {
      const message = hasQaAccess()
        ? 'Bu bölüme yalnızca admin erişebilir.'
        : 'Giriş yaptıktan sonra düzenleyebilirsiniz.';
      toggleCustomModelInput(false);
      setModelControlsEnabled(false);
      showModelStatus(message, 'muted');
      updateSamplingControlsState(getSelectedModelValue());
      return Promise.resolve();
    }
    setModelControlsEnabled(false);
    showModelStatus('Yükleniyor...', 'muted');
    updateSamplingControlsState(getSelectedModelValue());
    return fetch('/admin/api/openai/model')
      .then((resp) => {
        if (resp.status === 401) {
          loginModal?.show();
          throw new Error('Bu işlem için giriş yapmalısınız.');
        }
        if (!resp.ok) {
          return resp.json().then((data) => {
            const message = data?.message || data?.error || 'Model bilgisi alınamadı.';
            throw new Error(message);
          }).catch((err) => {
            if (err instanceof Error) throw err;
            throw new Error('Model bilgisi alınamadı.');
          });
        }
        return resp.json();
      })
      .then((data) => {
        applyModelConfigData(data);
        setModelControlsEnabled(true);
        updateSamplingControlsState(getSelectedModelValue());
        handleModelInputChange();
        return data;
      })
      .catch((err) => {
        setModelControlsEnabled(true);
        showModelStatus(err.message || 'Model bilgisi alınamadı.', 'danger');
        updateSamplingControlsState(getSelectedModelValue());
        handleModelInputChange();
        throw err;
      });
  }

  function saveModelSelection() {
    if (!hasAdminAccess() || !modelSelectInput) return;
    const nextValue = getSelectedModelValue();
    if (!nextValue) {
      showModelStatus('Model adı boş olamaz.', 'warning');
      if (modelSelectInput.value === '__custom__') {
        modelCustomInput?.focus();
      }
      return;
    }
    const samplingState = collectSamplingState();
    if (!samplingState.valid) {
      showModelStatus(samplingState.message || 'Geçersiz değer.', 'danger');
      if (samplingState.message?.includes('Temperature') && temperatureInput && !temperatureInput.disabled) {
        temperatureInput.focus();
      } else if (samplingState.message?.includes('Top-p') && topPInput && !topPInput.disabled) {
        topPInput.focus();
      }
      return;
    }
    const confirmMessage = `Seçili dil modelini "${nextValue}" olarak ayarlamak üzeresiniz. Onaylıyor musunuz?`;
    if (!window.confirm(confirmMessage)) {
      showModelStatus('Model değişikliği iptal edildi.', 'muted');
      handleModelInputChange();
      return;
    }
    setModelControlsEnabled(false);
    showModelStatus('Kaydediliyor...', 'muted');
    updateSamplingControlsState(nextValue);
    fetch('/admin/api/openai/model', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        completion_model: nextValue,
        temperature: samplingState.temperature,
        top_p: samplingState.top_p,
      }),
    })
      .then((resp) => {
        if (resp.status === 401) {
          loginModal?.show();
          throw new Error('Bu işlem için giriş yapmalısınız.');
        }
        if (!resp.ok) {
          return resp.json().then((data) => {
            const message = data?.message || data?.error || 'Model kaydedilemedi.';
            throw new Error(message);
          }).catch((err) => {
            if (err instanceof Error) throw err;
            throw new Error('Model kaydedilemedi.');
          });
        }
        return resp.json();
      })
      .then((data) => {
        applyModelConfigData(data);
        setModelControlsEnabled(true);
        updateSamplingControlsState(getSelectedModelValue());
        handleModelInputChange();
      })
      .catch((err) => {
        setModelControlsEnabled(true);
        handleModelInputChange();
        showModelStatus(err.message || 'Model kaydedilemedi.', 'danger');
        updateSamplingControlsState(getSelectedModelValue());
      });
  }

  function resetModelSelection() {
    if (!hasAdminAccess() || !modelSelectInput) return;
    const confirmMessage = 'Varsayılan dil modeline dönmek istediğinizden emin misiniz?';
    if (!window.confirm(confirmMessage)) {
      showModelStatus('Varsayılan modele geçiş iptal edildi.', 'muted');
      handleModelInputChange();
      return;
    }
    setModelControlsEnabled(false);
    showModelStatus('Varsayılan model yükleniyor...', 'muted');
    updateSamplingControlsState(defaultModelValue);
    fetch('/admin/api/openai/model', {
      method: 'DELETE',
    })
      .then((resp) => {
        if (resp.status === 401) {
          loginModal?.show();
          throw new Error('Bu işlem için giriş yapmalısınız.');
        }
        if (!resp.ok) {
          return resp.json().then((data) => {
            const message = data?.message || data?.error || 'Varsayılan modele dönülemedi.';
            throw new Error(message);
          }).catch((err) => {
            if (err instanceof Error) throw err;
            throw new Error('Varsayılan modele dönülemedi.');
          });
        }
        return resp.json();
      })
      .then((data) => {
        applyModelConfigData(data);
        setModelControlsEnabled(true);
        updateSamplingControlsState(getSelectedModelValue());
        handleModelInputChange();
      })
      .catch((err) => {
        setModelControlsEnabled(true);
        handleModelInputChange();
        showModelStatus(err.message || 'Varsayılan modele dönülemedi.', 'danger');
        updateSamplingControlsState(getSelectedModelValue());
      });
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
      const isActive = item.active !== false;
      const statusSwitchId = `personality-status-${slug}`;
      const statusLabel = isActive ? 'Aktif' : 'Pasif';
      const statusHtml = `
        <div class="form-check form-switch mb-0">
          <input class="form-check-input toggle-personality-status" type="checkbox" role="switch"
            id="${esc(statusSwitchId)}"
            data-personality="${slugLabel}"
            data-active="${isActive ? 'true' : 'false'}"
            ${isActive ? 'checked' : ''}>
          <label class="form-check-label small" for="${esc(statusSwitchId)}">${esc(statusLabel)}</label>
        </div>
      `;
      const defaultHtml = isDefault
        ? '<span class="badge bg-primary"><i class="bi bi-star-fill"></i> Varsayılan</span>'
        : `<button type="button" class="btn btn-outline-primary btn-sm set-default-personality" data-personality="${slug}"><i class="bi bi-star"></i> Varsayılan Yap</button>`;
      const themeLabel = esc(themeNameMap[item.theme] || item.theme || '-');
      const avatarResolved = item.avatar_resolved || resolveAvatarUrl(item.avatar_url);
      const avatarHtml = avatarResolved
        ? `<img src="${esc(avatarResolved)}" alt="${displayName} avatar" class="rounded-circle border" style="width:72px;height:72px;object-fit:cover;">`
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
        <td>${statusHtml}</td>
        <td>${welcomeHtml}</td>
        <td>${promptHtml}</td>
        <td>${actionsHtml}</td>
      `;
      row.classList.toggle('opacity-50', !isActive);
      personalitiesTableBody.appendChild(row);
    });
  }

  function syncStatusSwitchVisual(inputEl, isActive) {
    if (!inputEl) return;
    inputEl.checked = !!isActive;
    inputEl.dataset.active = isActive ? 'true' : 'false';
    const formCheck = inputEl.closest('.form-check');
    if (formCheck) {
      const label = formCheck.querySelector('.form-check-label');
      if (label) {
        label.textContent = isActive ? 'Aktif' : 'Pasif';
      }
    }
    const row = inputEl.closest('tr');
    if (row) {
      row.classList.toggle('opacity-50', !isActive);
    }
  }

  function updatePersonalityStatus(slug, desiredActive, inputEl, previousValue) {
    if (!slug || !inputEl) return;
    const previous = typeof previousValue === 'boolean' ? previousValue : !desiredActive;
    inputEl.disabled = true;
    fetch(`/admin/api/personalities/${encodeURIComponent(slug)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: desiredActive }),
    })
      .then((resp) => {
        if (resp.status === 401) {
          loginModal?.show();
          throw new Error('Bu işlem için giriş yapmalısınız.');
        }
        if (!resp.ok) {
          return resp.json().then((data) => {
            const message = data?.message || data?.error || 'Durum güncellenemedi.';
            throw new Error(message);
          }).catch((err) => {
            if (err instanceof Error) throw err;
            throw new Error('Durum güncellenemedi.');
          });
        }
        return resp.json();
      })
      .then((data) => {
        if (typeof data?.default === 'string') {
          defaultPersonalityId = data.default;
        }
        syncStatusSwitchVisual(inputEl, desiredActive);
        loadPersonalities();
      })
      .catch((err) => {
        alert(err.message || 'Kişilik durumu güncellenemedi.');
        syncStatusSwitchVisual(inputEl, previous);
      })
      .finally(() => {
        inputEl.disabled = false;
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
    if (personalityActiveInput) {
      personalityActiveInput.checked = true;
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
      if (personalityActiveInput) personalityActiveInput.checked = entry.active !== false;
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
      if (personalityActiveInput) personalityActiveInput.checked = true;
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
    const isActive = personalityActiveInput ? Boolean(personalityActiveInput.checked) : true;

    if (editingPersonalityId && editingPersonalityId === defaultPersonalityId && !isActive) {
      alert('Varsayılan kişilik pasif hale getirilemez.');
      return;
    }
    if (payload.set_default && !isActive) {
      alert('Varsayılan kişilik varsayılan olarak seçilebilmesi için aktif olmalıdır.');
      return;
    }
    payload.active = isActive;

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
    updateFileActionButtons();
    if (qaTable) {
      if (qaAccess) {
        qaTable.draw();
      } else {
        qaTable.clear().draw();
      }
    }

    if (qaAccess) {
      $('#loginPasswordInput').val('');
      $('#loginError').hide();
      $('#loginForm').removeClass('was-validated');
      ensureInitialQaDataLoaded();
    } else {
      initialQaDataLoaded = false;
      allFiles = [];
      currentFile = '';
      $('#loginError').hide();
      $('#loginForm').removeClass('was-validated');
      loginModal?.show();
      if ($fileSel && $fileSel.length) {
        $fileSel.empty();
      }
    }

    toggleAdminTabs(adminAccess);

    if (adminAccess) {
      if (addPersonalityBtn) addPersonalityBtn.disabled = false;
      if (restartAppBtn && !restartAppBtn.dataset.pending) restartAppBtn.disabled = false;
      setSystemPromptControlsEnabled(true);
      handleSystemPromptInput();
      if (!modelSelectInput?.disabled) {
        handleModelInputChange();
      }
      updateSamplingControlsState(getSelectedModelValue());
    } else {
      if (addPersonalityBtn) addPersonalityBtn.disabled = true;
      if (restartAppBtn) restartAppBtn.disabled = true;
      currentSystemPrompt = '';
      if (systemPromptInput) systemPromptInput.value = '';
      setSystemPromptControlsEnabled(false);
      const statusMessage = qaAccess
        ? 'Bu bölüme yalnızca admin erişebilir.'
        : 'Giriş yaptıktan sonra düzenleyebilirsiniz.';
      showSystemPromptStatus(statusMessage, 'muted');
      toggleCustomModelInput(false);
      setModelControlsEnabled(false);
      persistedModelValue = '';
      if (modelSelectInput) {
        modelSelectInput.value = '';
      }
      showModelStatus(statusMessage, 'muted');
      updateSamplingControlsState(getSelectedModelValue());
      $('#totalChats, #totalLikes, #totalDislikes').text('-');
      $('#currentSeason').text('-');
    }

    if (lastKnownRole !== adminRole) {
      lastKnownRole = adminRole;
      if (adminAccess) {
        loadPersonalities();
        loadSystemPrompt().catch(() => {});
        loadModelConfig().catch(() => {});
        updateOverviewStats();
      } else {
        personalityList = [];
        renderPersonalities();
      }
    } else if (adminAccess) {
      renderPersonalities();
      handleSystemPromptInput();
      handleModelInputChange();
      updateSamplingControlsState(getSelectedModelValue());
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

  $.fn.dataTable.ext.errMode = 'none';

  function updateFileActionButtons() {
    const qaAccess = hasQaAccess();
    const fileCount = Array.isArray(allFiles) ? allFiles.length : 0;
    const canSelect = fileCount > 0;
    const canMerge = qaAccess && fileCount > 1 && Boolean(currentFile);

    // JSON Operations Dropdown
    $('#jsonOperationsDropdown').prop('disabled', !qaAccess);
    
    if (createFileBtn) {
      createFileBtn.disabled = !qaAccess;
    }
    if (mergeFileBtn) {
      mergeFileBtn.disabled = !canMerge;
    }
    
    // New buttons in dropdown
    $('#renameFileBtn').prop('disabled', !qaAccess || !canSelect || !currentFile);
    $('#deleteFileBtn').prop('disabled', !qaAccess || !canSelect || !currentFile);
    $('#importJsonBtn').prop('disabled', !qaAccess || !canSelect || !currentFile);
    $('#exportJsonBtn').prop('disabled', !canSelect || !currentFile);
    
    $fileSel.prop('disabled', !canSelect);
    handleCreateFormChange();
    handleMergeFormChange();
  }

  function setInlineStatus(element, message, tone = 'muted') {
    if (!element) return;
    element.textContent = message || '';
    element.className = `form-text text-${tone}`;
  }

  function toggleVisibility(target, show) {
    if (!target) return;
    target.classList.toggle('d-none', !show);
  }

  function populateFileSelect(files, preferred) {
    const safeFiles = Array.isArray(files)
      ? files.filter((f) => typeof f === 'string' && f.toLowerCase().endsWith('.json'))
      : [];
    allFiles = safeFiles;
    $fileSel.empty();
    safeFiles.forEach((f) => {
      $fileSel.append(`<option value="${f}">${f}</option>`);
    });
    if (!safeFiles.length) {
      currentFile = '';
      $fileSel.val('');
      updateFileActionButtons();
      return;
    }
    let next = preferred && safeFiles.includes(preferred)
      ? preferred
      : (currentFile && safeFiles.includes(currentFile) ? currentFile : safeFiles[0]);
    currentFile = next;
    $fileSel.val(currentFile);
    updateFileActionButtons();
  }

  function reloadFileList(preferred) {
    return new Promise((resolve, reject) => {
      $.getJSON('/admin/api/files', (files) => {
        populateFileSelect(files, preferred);
        refreshCreateModalOptions();
        refreshMergeModalOptions();
        resolve(allFiles);
      }).fail((xhr) => {
        updateFileActionButtons();
        reject(xhr);
      });
    });
  }

  function ensureInitialQaDataLoaded(forceReload = false) {
    if (!hasQaAccess()) return;

    const shouldReload = forceReload || !initialQaDataLoaded;
    const preferredFile = currentFile || defaultFile;

    const handleReadyState = () => {
      if (!allFiles.length) {
        alert('data/ klasöründe JSON dosyası bulunamadı.');
        $('#addBtn').prop('disabled', true);
        return;
      }
      if (currentFile) {
        if (qaTable) {
          qaTable.ajax.reload(null, false);
        } else {
          initQaTable();
        }
      } else {
        alert('Yüklenecek veri dosyası bulunamadı.');
        $('#addBtn').prop('disabled', true);
      }
    };

    if (!shouldReload) {
      handleReadyState();
      return;
    }

    reloadFileList(preferredFile)
      .then(() => {
        initialQaDataLoaded = true;
        handleReadyState();
      })
      .catch((xhr) => {
        initialQaDataLoaded = false;
        if (xhr?.status === 401) {
          adminRole = null;
          isAuthenticated = false;
          updateAuthUI();
          return;
        }
        alert('JSON dosyaları listelenemedi. Lütfen sayfayı yenileyin.');
      });
  }

  function normalizeFilenameInput(value) {
    if (typeof value !== 'string') return '';
    let trimmed = value.trim();
    if (!trimmed) return '';
    if (!trimmed.toLowerCase().endsWith('.json')) {
      trimmed += '.json';
    }
    return trimmed;
  }

  function matchExistingFile(value) {
    const normalized = normalizeFilenameInput(value);
    if (!normalized) return null;
    return allFiles.find((f) => f.toLowerCase() === normalized.toLowerCase()) || null;
  }

  function refreshCreateModalOptions() {
    if (!createCopySelect) return;
    const files = Array.isArray(allFiles) ? allFiles : [];
    createCopySelect.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = files.length ? 'Kaynak dosya seçin' : 'Kullanılabilir dosya yok';
    placeholder.disabled = files.length === 0;
    placeholder.selected = true;
    createCopySelect.appendChild(placeholder);
    files.forEach((file) => {
      const opt = document.createElement('option');
      opt.value = file;
      opt.textContent = file;
      createCopySelect.appendChild(opt);
    });
    const copyRadio = Array.from(createInitialModeInputs || []).find((input) => input.value === 'copy');
    if (copyRadio) {
      copyRadio.disabled = files.length === 0;
      if (copyRadio.disabled && copyRadio.checked) {
        const emptyRadio = Array.from(createInitialModeInputs || []).find((input) => input.value === 'empty');
        if (emptyRadio) emptyRadio.checked = true;
      }
    }
    const isCopyMode = Array.from(createInitialModeInputs || []).some((input) => input.checked && input.value === 'copy');
    createCopySelect.disabled = !(isCopyMode && files.length);
    handleCreateFormChange();
  }

  function refreshMergeModalOptions() {
    if (!mergeSourceSelect || !mergeTargetSelect) return;
    const files = Array.isArray(allFiles) ? allFiles : [];
    mergeSourceSelect.innerHTML = '';
    mergeTargetSelect.innerHTML = '';

    if (!files.length) {
      const emptyOpt = document.createElement('option');
      emptyOpt.value = '';
      emptyOpt.textContent = 'JSON dosyası bulunamadı';
      emptyOpt.disabled = true;
      emptyOpt.selected = true;
      mergeSourceSelect.appendChild(emptyOpt);
      mergeTargetSelect.appendChild(emptyOpt.cloneNode(true));
      mergeSourceSelect.disabled = true;
      mergeTargetSelect.disabled = true;
      if (mergeTargetExistingRadio) mergeTargetExistingRadio.disabled = true;
      if (mergeTargetNewRadio) mergeTargetNewRadio.checked = true;
      toggleVisibility(mergeTargetExistingGroup, false);
      toggleVisibility(mergeTargetNewGroup, true);
      return;
    }

    files.forEach((file) => {
      const optSource = document.createElement('option');
      optSource.value = file;
      optSource.textContent = file;
      mergeSourceSelect.appendChild(optSource);
      const optTarget = document.createElement('option');
      optTarget.value = file;
      optTarget.textContent = file;
      mergeTargetSelect.appendChild(optTarget);
    });

    mergeSourceSelect.disabled = false;
    mergeTargetSelect.disabled = false;

    const defaultSource = files.find((file) => file !== currentFile) || files[0];
    mergeSourceSelect.value = defaultSource;

    const targetDefault = currentFile && files.includes(currentFile) ? currentFile : files[0];
    mergeTargetSelect.value = targetDefault;

    if (mergeTargetExistingRadio) {
      mergeTargetExistingRadio.disabled = files.length === 0;
      if (!mergeTargetExistingRadio.disabled && !mergeTargetExistingRadio.checked && !mergeTargetNewRadio?.checked) {
        mergeTargetExistingRadio.checked = true;
      }
    }
    handleMergeFormChange();
  }

  function prepareCreateFileModal() {
    if (!createFileForm) return;
    createFileForm.reset();
    createFileForm.classList.remove('was-validated');
    setInlineStatus(createFileStatus, '');
    refreshCreateModalOptions();
    const emptyRadio = Array.from(createInitialModeInputs || []).find((input) => input.value === 'empty');
    if (emptyRadio) emptyRadio.checked = true;
    if (createCopySelect) {
      createCopySelect.disabled = !(Array.from(createInitialModeInputs || []).some((input) => input.checked && input.value === 'copy') && createCopySelect.options.length > 1);
      createCopySelect.value = currentFile && Array.from(createCopySelect.options).some((opt) => opt.value === currentFile) ? currentFile : '';
    }
    if (createFileSubmitBtn) {
      createFileSubmitBtn.disabled = true;
    }
    if (createFilenameInput) {
      createFilenameInput.value = '';
      setTimeout(() => createFilenameInput.focus(), 150);
    }
    handleCreateInitialModeChange();
  }

  function handleCreateInitialModeChange() {
    const mode = Array.from(createInitialModeInputs || []).find((input) => input.checked)?.value || 'empty';
    const hasCopies = createCopySelect && createCopySelect.options.length > 1;
    if (createCopySelect) {
      if (mode === 'copy' && hasCopies) {
        createCopySelect.disabled = false;
      } else {
        createCopySelect.disabled = true;
        createCopySelect.value = '';
      }
    }
    handleCreateFormChange();
  }

  function handleCreateFormChange() {
    if (!createFileSubmitBtn) return;
    if (!hasQaAccess()) {
      createFileSubmitBtn.disabled = true;
      return;
    }
    const filenameRaw = (createFilenameInput?.value || '').trim();
    const filenameValid = filenameRaw && (!createFilenameInput || createFilenameInput.checkValidity());
    const normalized = filenameValid ? normalizeFilenameInput(filenameRaw) : '';
    const existing = normalized ? matchExistingFile(normalized) : null;

    const mode = Array.from(createInitialModeInputs || []).find((input) => input.checked)?.value || 'empty';
    const requiresCopy = mode === 'copy';
    const copyValue = createCopySelect?.value || '';

    let valid = Boolean(filenameValid);
    if (!valid) {
      setInlineStatus(createFileStatus, '');
    } else if (existing) {
      setInlineStatus(createFileStatus, 'Bu isimde bir dosya zaten var.', 'warning');
      valid = false;
    } else if (requiresCopy && !copyValue) {
      setInlineStatus(createFileStatus, 'Lütfen kaynak dosya seçin.', 'warning');
      valid = false;
    } else {
      setInlineStatus(createFileStatus, '');
    }

    createFileSubmitBtn.disabled = !valid;
  }

  function prepareMergeFileModal() {
    if (!mergeFileForm) return;
    mergeFileForm.reset();
    mergeFileForm.classList.remove('was-validated');
    setInlineStatus(mergeFileStatus, '');
    refreshMergeModalOptions();
    if (mergeTargetExistingRadio) mergeTargetExistingRadio.checked = true;
    if (mergeTargetNewRadio) mergeTargetNewRadio.checked = false;
    if (mergeAllowDuplicatesInput) mergeAllowDuplicatesInput.checked = false;
    handleMergeTargetModeChange();
    handleMergeFormChange();
    setTimeout(() => {
      if (mergeSourceSelect && !mergeSourceSelect.disabled) mergeSourceSelect.focus();
    }, 150);
  }

  function handleMergeTargetModeChange() {
    const useExisting = Boolean(mergeTargetExistingRadio?.checked);
    toggleVisibility(mergeTargetExistingGroup, useExisting);
    toggleVisibility(mergeTargetNewGroup, !useExisting);
    if (mergeTargetSelect) mergeTargetSelect.disabled = !useExisting;
    if (mergeTargetNameInput) {
      mergeTargetNameInput.disabled = useExisting;
      if (!useExisting && !mergeTargetNameInput.value) {
        const suggestion = currentFile ? `birlesik_${currentFile.replace(/\.json$/i, '')}.json` : `birlesik_${Date.now()}.json`;
        mergeTargetNameInput.value = suggestion;
      }
    }
    handleMergeFormChange();
  }

  function deriveMergeTarget() {
    const usingExisting = Boolean(mergeTargetExistingRadio?.checked);
    if (usingExisting) {
      const value = mergeTargetSelect?.value || '';
      return {
        target: value,
        createIfMissing: false,
        conflict: false,
        normalized: value,
      };
    }
    const raw = (mergeTargetNameInput?.value || '').trim();
    const normalized = normalizeFilenameInput(raw);
    if (!normalized) {
      return {
        target: '',
        createIfMissing: true,
        conflict: false,
        normalized: '',
      };
    }
    const existing = matchExistingFile(normalized);
    if (existing) {
      return {
        target: existing,
        createIfMissing: false,
        conflict: true,
        normalized,
      };
    }
    return {
      target: normalized,
      createIfMissing: true,
      conflict: false,
      normalized,
    };
  }

  function handleMergeFormChange() {
    if (!mergeFileSubmitBtn) return;
    if (!hasQaAccess()) {
      mergeFileSubmitBtn.disabled = true;
      return;
    }
    const files = Array.isArray(allFiles) ? allFiles : [];
    const source = mergeSourceSelect?.value || '';
    const targetInfo = deriveMergeTarget();
    let valid = Boolean(source) && Boolean(targetInfo.target);
    let tone = 'muted';
    let message = '';

    if (!files.length) {
      valid = false;
      message = 'Birleştirme için en az bir JSON dosyası gereklidir.';
      tone = 'warning';
    } else if (!source) {
      valid = false;
      message = 'Lütfen kaynak dosya seçin.';
      tone = 'warning';
    } else if (!targetInfo.target) {
      valid = false;
      message = mergeTargetExistingRadio?.checked ? 'Lütfen hedef dosya seçin.' : 'Yeni dosya adı girin.';
      tone = 'warning';
    } else if (source && targetInfo.target && source === targetInfo.target && !targetInfo.createIfMissing) {
      valid = false;
      message = 'Kaynak ve hedef dosya farklı olmalıdır.';
      tone = 'warning';
    } else if (targetInfo.conflict && mergeTargetNewRadio?.checked) {
      message = 'Bu isimde bir dosya zaten var; veriler mevcut dosyaya eklenecek.';
      tone = 'info';
    }

    setInlineStatus(mergeFileStatus, message, tone);
    mergeFileSubmitBtn.disabled = !valid;
  }

  function handleCreateFileSubmit(event) {
    event.preventDefault();
    if (!hasQaAccess()) {
      if (!isAuthenticated) {
        loginModal?.show();
      }
      return;
    }
    if (!createFileForm || !createFileSubmitBtn) return;

    createFileForm.classList.add('was-validated');

    const filenameRaw = (createFilenameInput?.value || '').trim();
    if (!filenameRaw || !createFilenameInput?.checkValidity()) {
      handleCreateFormChange();
      return;
    }
    const normalizedName = normalizeFilenameInput(filenameRaw);
    if (matchExistingFile(normalizedName)) {
      setInlineStatus(createFileStatus, 'Bu isimde bir dosya zaten var.', 'warning');
      handleCreateFormChange();
      return;
    }

    const mode = Array.from(createInitialModeInputs || []).find((input) => input.checked)?.value || 'empty';
    const requiresCopy = mode === 'copy';
    const copyValue = createCopySelect?.value || '';
    if (requiresCopy && !copyValue) {
      setInlineStatus(createFileStatus, 'Lütfen kaynak dosya seçin.', 'warning');
      handleCreateFormChange();
      return;
    }

    const payload = { filename: normalizedName };
    if (requiresCopy && copyValue) {
      payload.copy_from = copyValue;
    }

    createFileSubmitBtn.disabled = true;
    setInlineStatus(createFileStatus, 'Dosya oluşturuluyor...', 'muted');

    fetch('/admin/api/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((resp) => {
        if (!resp.ok) {
          return resp.json().catch(() => ({})).then((data) => {
            const message = data?.message || data?.error || 'Dosya oluşturulamadı.';
            throw new Error(message);
          });
        }
        return resp.json();
      })
      .then((data) => {
        const createdName = data?.filename || normalizedName;
        const count = typeof data?.count === 'number' ? data.count : 0;
        setInlineStatus(createFileStatus, `Dosya oluşturuldu. (${count} kayıt)`, 'success');
        if (createFilenameInput) createFilenameInput.value = '';
        if (createCopySelect) createCopySelect.value = '';
        return reloadFileList(createdName).then(() => {
          if (qaTable) {
            qaTable.ajax.reload(null, false);
          } else if (currentFile) {
            initQaTable();
          }
          setTimeout(() => {
            createFileModal?.hide();
            setInlineStatus(createFileStatus, '');
          }, 900);
        });
      })
      .catch((err) => {
        setInlineStatus(createFileStatus, err.message || 'Dosya oluşturulamadı.', 'danger');
        handleCreateFormChange();
      });
  }

  function prepareRenameFileModal() {
    if (!renameFileForm) return;
    renameFileForm.reset();
    renameFileForm.classList.remove('was-validated');
    setInlineStatus(renameFileStatus, '');
    if (renameCurrentName) {
      renameCurrentName.textContent = currentFile || '-';
    }
    if (renameFilenameInput) {
      renameFilenameInput.value = currentFile || '';
      setTimeout(() => renameFilenameInput.focus(), 150);
    }
    if (renameFileSubmitBtn) renameFileSubmitBtn.disabled = true;
    handleRenameFormChange();
  }

  function handleRenameFormChange() {
    if (!renameFileSubmitBtn) return;
    if (!hasQaAccess()) {
      renameFileSubmitBtn.disabled = true;
      return;
    }
    const raw = (renameFilenameInput?.value || '').trim();
    const normalized = raw ? normalizeFilenameInput(raw) : '';
    let valid = Boolean(normalized);
    let message = '';
    let tone = 'muted';

    if (!currentFile) {
      valid = false;
      message = 'Önce bir dosya seçin.';
      tone = 'warning';
    } else if (!normalized) {
      valid = false;
      message = raw ? 'Geçersiz dosya adı.' : '';
    } else if (normalized === currentFile) {
      valid = false;
      message = 'Yeni ad mevcut adla aynı olamaz.';
      tone = 'warning';
    } else {
      const existing = matchExistingFile(normalized);
      if (existing) {
        valid = false;
        message = 'Bu isimde bir dosya zaten var.';
        tone = 'warning';
      }
    }

    setInlineStatus(renameFileStatus, message, tone);
    renameFileSubmitBtn.disabled = !valid;
  }

  function handleRenameFileSubmit(event) {
    event.preventDefault();
    if (!hasQaAccess()) {
      if (!isAuthenticated) {
        loginModal?.show();
      }
      return;
    }
    if (!renameFileForm || !renameFileSubmitBtn) return;
    renameFileForm.classList.add('was-validated');
    handleRenameFormChange();
    if (renameFileSubmitBtn.disabled) return;

    const sourceName = currentFile;
    const raw = (renameFilenameInput?.value || '').trim();
    const normalized = normalizeFilenameInput(raw);
    renameFileSubmitBtn.disabled = true;
    setInlineStatus(renameFileStatus, 'Yeniden adlandırılıyor...', 'muted');

    fetch(`/admin/api/files/${encodeURIComponent(sourceName)}/rename`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_name: normalized }),
    })
      .then((resp) => {
        if (!resp.ok) {
          return resp.json().catch(() => ({})).then((data) => {
            const message = data?.message || data?.error || 'Yeniden adlandırma başarısız.';
            throw new Error(message);
          });
        }
        return resp.json();
      })
      .then((data) => {
        const newName = data?.new_name || normalized;
        return reloadFileList(newName).then(() => {
          if (qaTable) {
            qaTable.ajax.reload(null, false);
          }
          setInlineStatus(renameFileStatus, 'Dosya adı güncellendi.', 'success');
          setTimeout(() => {
            renameFileModal?.hide();
            setInlineStatus(renameFileStatus, '');
          }, 600);
        });
      })
      .catch((err) => {
        setInlineStatus(renameFileStatus, err.message || 'Yeniden adlandırılamadı.', 'danger');
      })
      .finally(() => {
        renameFileSubmitBtn.disabled = false;
      });
  }

  function handleMergeFileSubmit(event) {
    event.preventDefault();
    if (!hasQaAccess()) {
      if (!isAuthenticated) {
        loginModal?.show();
      }
      return;
    }
    if (!mergeFileForm || !mergeFileSubmitBtn) return;

    mergeFileForm.classList.add('was-validated');
    handleMergeFormChange();
    if (mergeFileSubmitBtn.disabled) return;

    const source = mergeSourceSelect?.value || '';
    const targetInfo = deriveMergeTarget();
    if (!source || !targetInfo.target) {
      handleMergeFormChange();
      return;
    }
    if (source === targetInfo.target && !targetInfo.createIfMissing) {
      setInlineStatus(mergeFileStatus, 'Kaynak ve hedef dosya farklı olmalıdır.', 'warning');
      handleMergeFormChange();
      return;
    }

    const payload = {
      source,
      target: targetInfo.target,
      allow_duplicates: Boolean(mergeAllowDuplicatesInput?.checked),
      create_if_missing: targetInfo.createIfMissing,
    };

    mergeFileSubmitBtn.disabled = true;
    setInlineStatus(mergeFileStatus, 'Dosyalar birleştiriliyor...', 'muted');

    fetch('/admin/api/files/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((resp) => {
        if (!resp.ok) {
          return resp.json().catch(() => ({})).then((data) => {
            const message = data?.message || data?.error || 'Dosyalar birleştirilemedi.';
            throw new Error(message);
          });
        }
        return resp.json();
      })
      .then((data) => {
        const targetFile = data?.target || targetInfo.target;
        const summary = [];
        if (typeof data?.added === 'number') {
          summary.push(`${data.added} kayıt aktarıldı`);
        }
        if (typeof data?.skipped === 'number' && data.skipped > 0) {
          summary.push(`${data.skipped} kayıt atlandı`);
        }
        if (data?.created) {
          summary.push('Yeni dosya oluşturuldu');
        }
        const message = summary.length ? `Birleştirme tamamlandı: ${summary.join(', ')}.` : 'Birleştirme tamamlandı.';
        setInlineStatus(mergeFileStatus, message, 'success');
        return reloadFileList(targetFile).then(() => {
          if (qaTable) {
            qaTable.ajax.reload(null, false);
          } else if (currentFile) {
            initQaTable();
          }
          setTimeout(() => {
            mergeFileModal?.hide();
            setInlineStatus(mergeFileStatus, '');
          }, 1100);
        });
      })
      .catch((err) => {
        setInlineStatus(mergeFileStatus, err.message || 'Dosyalar birleştirilemedi.', 'danger');
        handleMergeFormChange();
      });
  }

  function initQaTable() {
    qaTable = $('#qaTable').DataTable({
      ajax: {
        url: '/admin/api/items',
        data: function(){ return { file: currentFile }; },
        dataSrc: function(json) {
          updateQaStats(json);
          return json;
        },
        type: 'GET',
        cache: false,
      },
      columns: [
        { 
          data: null, 
          orderable: false,
          className: 'text-center',
          render: () => '<input type="checkbox" class="form-check-input qa-checkbox">'
        },
        { data: null, className: 'text-center', render: (_d, _t, _r, meta) => meta.row + 1 },
        { 
          data: 'questions', 
          render: (d) => {
            const badge = `<span class='badge bg-info me-2'>${d.length} soru</span>`;
            const list = `<ul class='question-list'>${d.map((q) => `<li>${esc(q)}</li>`).join('')}</ul>`;
            return badge + list;
          }
        },
        { 
          data: 'answer', 
          render: (d) => `<div class='answer-preview'>${esc(d)}</div>`
        },
        {
          data: 'answer',
          className: 'text-center',
          render: (d) => {
            const len = (d || '').length;
            let colorClass = 'bg-success';
            if (len > 500) colorClass = 'bg-warning';
            if (len > 800) colorClass = 'bg-danger';
            return `<span class='badge ${colorClass} char-count-badge'>${len}</span>`;
          }
        },
        { 
          data: null, 
          orderable: false,
          className: 'text-center',
          render: (_d, _t, _r, meta) => {
            if (!isAuthenticated) return '<small class="text-muted">Giriş Gerekli</small>';
            return `<div class="btn-group btn-group-sm" role="group">
                      <button class='btn btn-outline-primary editBtn' data-idx='${meta.row}' title='Düzenle'>
                        <i class='bi bi-pencil'></i>
                      </button>
                      <button class='btn btn-outline-danger delBtn' data-idx='${meta.row}' title='Sil'>
                        <i class='bi bi-trash'></i>
                      </button>
                    </div>`;
          } 
        },
      ],
      pageLength: 25,
      order: [[1, 'asc']],
      searching: true, // Arama fonksiyonu aktif ama UI gizli
      dom: 'lrtip', // 'f' (filter/search box) hariç tüm elementler - bu DataTables'ın kendi arama kutusunu gizler
      language: {
        lengthMenu: "Sayfa başına _MENU_ kayıt",
        info: "_TOTAL_ kayıttan _START_ - _END_ arası",
        infoEmpty: "Kayıt yok",
        infoFiltered: "(_MAX_ kayıt içinden filtrelendi)",
        paginate: {
          first: "İlk",
          last: "Son",
          next: "Sonraki",
          previous: "Önceki"
        }
      }
    });
  }

  function updateQaStats(data) {
    if (!Array.isArray(data)) return;
    
    const totalItems = data.length;
    const totalQuestions = data.reduce((sum, item) => sum + (item.questions?.length || 0), 0);
    const avgAnswerLen = data.length > 0 
      ? Math.round(data.reduce((sum, item) => sum + (item.answer?.length || 0), 0) / data.length)
      : 0;
    
    // Calculate file size estimate (rough JSON size)
    const jsonStr = JSON.stringify(data);
    const fileSizeKB = Math.round(jsonStr.length / 1024);
    
    $('#statTotalItems').text(totalItems);
    $('#statTotalQuestions').text(totalQuestions);
    $('#statAvgAnswerLen').text(avgAnswerLen + ' kar.');
    $('#statFileSize').text(fileSizeKB + ' KB');
    
    // Update file info with enhanced styling (teal theme)
    if (currentFile) {
      $('#fileInfo').html(`
        <i class="bi bi-file-check" style="color: #20c997;"></i>
        <span class="fw-bold" style="color: #20c997;">${currentFile}</span> 
        <span class="text-muted">yüklendi ve aktif</span>
      `);
    }
  }

  // Global search across all files
  let globalSearchTimeout = null;

  $('#globalQaSearchInput').on('input', function() {
    const query = $(this).val().trim();
    
    clearTimeout(globalSearchTimeout);
    
    if (query.length < 2) {
      $('#globalSearchResults').slideUp();
      return;
    }
    
    globalSearchTimeout = setTimeout(() => {
      performGlobalSearch(query);
    }, 500); // Debounce 500ms
  });

  $('#clearGlobalQaSearch').on('click', function() {
    $('#globalQaSearchInput').val('');
    $('#globalSearchResults').slideUp();
  });

  $('#closeGlobalSearch').on('click', function() {
    $('#globalSearchResults').slideUp();
    $('#globalQaSearchInput').val('');
  });

  function performGlobalSearch(query) {
    if (!allFiles || allFiles.length === 0) {
      $('#globalSearchResultsContent').html('<p class="text-muted">Dosya bulunamadı.</p>');
      $('#globalSearchResults').slideDown();
      return;
    }

    $('#globalSearchResults').slideDown();
    $('#globalSearchResultsContent').html('<div class="text-center"><div class="spinner-border text-warning" role="status"><span class="visually-hidden">Aranıyor...</span></div><p class="mt-2 text-muted">Tüm dosyalarda aranıyor...</p></div>');

    let allResults = [];
    let filesProcessed = 0;
    const lowerQuery = query.toLowerCase();

    // Search in all files
    allFiles.forEach(filename => {
      $.get(`/admin/api/items?file=${filename}`, function(data) {
        if (Array.isArray(data)) {
          data.forEach((item, idx) => {
            let matchFound = false;
            let matchType = '';
            let matchText = '';

            // Search in questions
            if (item.questions && Array.isArray(item.questions)) {
              item.questions.forEach(q => {
                if (q.toLowerCase().includes(lowerQuery)) {
                  matchFound = true;
                  matchType = 'question';
                  matchText = q;
                }
              });
            }

            // Search in answer
            if (!matchFound && item.answer && item.answer.toLowerCase().includes(lowerQuery)) {
              matchFound = true;
              matchType = 'answer';
              matchText = item.answer;
            }

            if (matchFound) {
              allResults.push({
                file: filename,
                index: idx,
                item: item,
                matchType: matchType,
                matchText: matchText
              });
            }
          });
        }
      }).always(() => {
        filesProcessed++;
        
        // When all files are processed, display results
        if (filesProcessed === allFiles.length) {
          displayGlobalSearchResults(allResults, query);
        }
      });
    });
  }

  function displayGlobalSearchResults(results, query) {
    $('#globalSearchCount').text(results.length);

    if (results.length === 0) {
      $('#globalSearchResultsContent').html(`
        <div class="alert alert-warning">
          <i class="bi bi-exclamation-triangle"></i>
          <strong>"${esc(query)}"</strong> için sonuç bulunamadı.
        </div>
      `);
      return;
    }

    let html = '';
    const lowerQuery = query.toLowerCase();

    results.forEach((result, idx) => {
      const highlightedText = highlightMatch(result.matchText, query);
      const questions = result.item.questions || [];
      const answer = result.item.answer || '';

      html += `
        <div class="global-search-item">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <div>
              <span class="file-badge">
                <i class="bi bi-file-earmark-code"></i> ${esc(result.file)}
              </span>
              <span class="badge bg-secondary ms-2">Kayıt #${result.index + 1}</span>
            </div>
            <button class="btn btn-sm btn-outline-primary load-file-btn" 
                    data-file="${esc(result.file)}" 
                    data-index="${result.index}">
              <i class="bi bi-box-arrow-in-down-right"></i> Dosyayı Aç
            </button>
          </div>
          
          <div class="item-preview">
            <div class="mb-2">
              <strong class="text-primary">
                <i class="bi bi-question-circle"></i> 
                ${result.matchType === 'question' ? 'Eşleşen ' : ''}Sorular:
              </strong>
              <ul class="question-list mt-1">
                ${questions.map(q => {
                  const highlighted = q.toLowerCase().includes(lowerQuery) 
                    ? highlightMatch(q, query) 
                    : esc(q);
                  return `<li>${highlighted}</li>`;
                }).join('')}
              </ul>
            </div>
            
            <div>
              <strong class="text-success">
                <i class="bi bi-chat-left-text"></i> 
                ${result.matchType === 'answer' ? 'Eşleşen ' : ''}Cevap:
              </strong>
              <div class="mt-1 answer-preview">
                ${result.matchType === 'answer' ? highlightedText : esc(answer.substring(0, 200))}${answer.length > 200 ? '...' : ''}
              </div>
              <small class="text-muted">
                <i class="bi bi-type"></i> ${answer.length} karakter
              </small>
            </div>
          </div>
        </div>
      `;
    });

    $('#globalSearchResultsContent').html(html);

    // Bind click events for "Load File" buttons
    $('.load-file-btn').on('click', function() {
      const file = $(this).data('file');
      const index = $(this).data('index');
      
      // Switch to that file
      $('#fileSelect').val(file).trigger('change');
      
      // Close global search
      $('#globalSearchResults').slideUp();
      $('#globalQaSearchInput').val('');
      
      // Scroll to the item (after a small delay to let the table load)
      setTimeout(() => {
        if (qaTable) {
          const page = Math.floor(index / qaTable.page.len());
          qaTable.page(page).draw(false);
          
          // Highlight the row
          setTimeout(() => {
            const $row = $(`#qaTable tbody tr:eq(${index % qaTable.page.len()})`);
            if ($row.length) {
              $row.addClass('table-warning');
              $row[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
              
              setTimeout(() => {
                $row.removeClass('table-warning');
              }, 2000);
            }
          }, 300);
        }
      }, 500);
    });
  }

  function highlightMatch(text, query) {
    if (!text || !query) return esc(text);
    
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerText.indexOf(lowerQuery);
    
    if (index === -1) return esc(text);
    
    const before = text.substring(0, index);
    const match = text.substring(index, index + query.length);
    const after = text.substring(index + query.length);
    
    return `${esc(before)}<span class="match-highlight">${esc(match)}</span>${esc(after)}`;
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

  async function fetchAllForExport() {
    // If no filter context, fall back to currentResults snapshot
    if (!currentFilter || !currentFilter.mode) {
      return currentResults.slice();
    }

    const filter = Object.assign({}, currentFilter);
    const mode = filter.mode;
    delete filter.limit; // export tüm sonuçları alsın

    // Feedback endpoint returns a flat array; request a high limit
    if (mode === 'feedback') {
      const params = Object.assign({}, filter, { limit: 10000 });
      const url = buildSearchUrl(params);
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('Export isteği başarısız oldu (feedback).');
      return await resp.json();
    }

    // Paginated endpoints (global and session)
    const perPageCap = mode === 'session' ? 1000 : 100;
    filter.per_page = perPageCap;
    filter.page = 1;

    const allItems = [];
    let guard = 0;

    while (true) {
      const url = buildSearchUrl(filter);
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`Export isteği başarısız oldu (sayfa ${filter.page}).`);
      const data = await resp.json();
      const pageItems = Array.isArray(data) ? data : (data.items || []);
      allItems.push(...pageItems);

      const pagination = data.pagination || {};
      const hasNext =
        pagination.has_next === true ||
        (pagination.pages && filter.page < pagination.pages) ||
        pageItems.length === perPageCap;

      if (!hasNext) break;
      filter.page += 1;
      guard += 1;
      if (guard > 200) break; // safety guard
    }

    return allItems;
  }

  async function exportResults(format) {
    if (!currentResults.length) {
      alert('Dışa aktarılacak veri bulunamadı.');
      return;
    }

    const $exportBtns = $('#exportResultsJson, #exportResultsXlsx, #exportResultsCsv, #exportResultsTxt');
    const prevInfoHtml = $('#resultsInfo').html();
    $exportBtns.prop('disabled', true);
    $('#resultsInfo').html('<small><i class="bi bi-hourglass-split"></i> Export hazırlanıyor...</small>');
    
    try {
      const exportData = await fetchAllForExport();
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      
      if (format === 'json') {
        const jsonData = JSON.stringify(exportData, null, 2);
        downloadFile(`chat_logs_${timestamp}.json`, jsonData, 'application/json');
      } else if (format === 'xlsx') {
        const xlsxContent = convertToXlsx(exportData);
        downloadFile(`chat_logs_${timestamp}.xlsx`, xlsxContent, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      } else if (format === 'csv') {
        const csvContent = convertToCSV(exportData);
        downloadFile(`chat_logs_${timestamp}.csv`, csvContent, 'text/csv', { addBom: true });
      } else if (format === 'txt') {
        const txtContent = convertToTXT(exportData);
        downloadFile(`chat_logs_${timestamp}.txt`, txtContent, 'text/plain', { addBom: true });
      }
    } catch (err) {
      console.error('Export failed', err);
      alert('Export hazırlanırken bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      $exportBtns.prop('disabled', false);
      $('#resultsInfo').html(prevInfoHtml);
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

  function convertToXlsx(data) {
    const headers = ['Timestamp', 'Season', 'Session', 'User', 'Feedback', 'User Message', 'Assistant Response'];
    const escapeXml = (value) => {
      return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };

    const sheetRows = [];
    const addRow = (cells, isHeader = false) => {
      const cellXml = cells.map(val => {
        const text = escapeXml(val);
        return `<c t="inlineStr"><is><t>${text}</t></is></c>`;
      }).join('');
      sheetRows.push(`<row>${cellXml}</row>`);
    };

    addRow(headers, true);
    data.forEach(row => {
      addRow([
        row.timestamp || '',
        row.season || '',
        row.session_id || '',
        row.user_id || '',
        row.feedback || '',
        row.user_message || '',
        row.assistant_response || ''
      ]);
    });

    const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetData>
    ${sheetRows.join('')}
  </sheetData>
</worksheet>`;

    const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Chat Logs" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

    const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

    const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`;

    const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`;

    const files = {
      '[Content_Types].xml': contentTypesXml,
      '_rels/.rels': relsXml,
      'xl/workbook.xml': workbookXml,
      'xl/_rels/workbook.xml.rels': workbookRelsXml,
      'xl/worksheets/sheet1.xml': sheetXml
    };

    return buildZip(files);
  }

  // Minimal ZIP builder (store mode) for XLSX
  function buildZip(files) {
    const encoder = new TextEncoder();
    const fileEntries = [];
    let offset = 0;

    Object.entries(files).forEach(([name, content]) => {
      const data = typeof content === 'string' ? encoder.encode(content) : new Uint8Array(content);
      const crc = crc32(data);
      const size = data.length;
      const fname = encoder.encode(name);

      // Local file header
      const localHeader = new Uint8Array(30 + fname.length);
      const view = new DataView(localHeader.buffer);
      view.setUint32(0, 0x04034b50, true); // signature
      view.setUint16(4, 20, true); // version needed
      view.setUint16(6, 0, true); // flags
      view.setUint16(8, 0, true); // compression (store)
      view.setUint16(10, 0, true); // mod time
      view.setUint16(12, 0, true); // mod date
      view.setUint32(14, crc >>> 0, true);
      view.setUint32(18, size, true);
      view.setUint32(22, size, true);
      view.setUint16(26, fname.length, true);
      view.setUint16(28, 0, true); // extra length
      localHeader.set(fname, 30);

      fileEntries.push({ name, fname, data, crc, size, offset, localHeader });
      offset += localHeader.length + size;
    });

    // Central directory
    const centralParts = [];
    let centralSize = 0;
    fileEntries.forEach(entry => {
      const { fname, crc, size, offset: locOffset } = entry;
      const cd = new Uint8Array(46 + fname.length);
      const view = new DataView(cd.buffer);
      view.setUint32(0, 0x02014b50, true); // signature
      view.setUint16(4, 20, true); // version made by
      view.setUint16(6, 20, true); // version needed
      view.setUint16(8, 0, true); // flags
      view.setUint16(10, 0, true); // compression
      view.setUint16(12, 0, true); // mod time
      view.setUint16(14, 0, true); // mod date
      view.setUint32(16, crc >>> 0, true);
      view.setUint32(20, size, true);
      view.setUint32(24, size, true);
      view.setUint16(28, fname.length, true);
      view.setUint16(30, 0, true); // extra length
      view.setUint16(32, 0, true); // comment length
      view.setUint16(34, 0, true); // disk number
      view.setUint16(36, 0, true); // internal attrs
      view.setUint32(38, 0, true); // external attrs
      view.setUint32(42, locOffset, true); // relative offset
      cd.set(fname, 46);
      centralParts.push(cd);
      centralSize += cd.length;
    });

    // End of central directory
    const end = new Uint8Array(22);
    const endView = new DataView(end.buffer);
    endView.setUint32(0, 0x06054b50, true); // signature
    endView.setUint16(4, 0, true); // disk
    endView.setUint16(6, 0, true); // start disk
    endView.setUint16(8, fileEntries.length, true); // entries this disk
    endView.setUint16(10, fileEntries.length, true); // total entries
    endView.setUint32(12, centralSize, true); // size of central dir
    endView.setUint32(16, offset, true); // offset of central dir
    endView.setUint16(20, 0, true); // comment length

    // Concatenate all parts
    const totalSize = offset + centralSize + end.length;
    const zip = new Uint8Array(totalSize);
    let cursor = 0;
    fileEntries.forEach(entry => {
      zip.set(entry.localHeader, cursor); cursor += entry.localHeader.length;
      zip.set(entry.data, cursor); cursor += entry.data.length;
    });
    centralParts.forEach(part => { zip.set(part, cursor); cursor += part.length; });
    zip.set(end, cursor);
    return zip;
  }

  // CRC32 for ZIP
  const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(buf) {
    let c = 0 ^ (-1);
    for (let i = 0; i < buf.length; i++) {
      c = (c >>> 8) ^ CRC_TABLE[(c ^ buf[i]) & 0xFF];
    }
    return (c ^ (-1)) >>> 0;
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

  function downloadFile(filename, content, mimeType, options = {}) {
    // content string veya Uint8Array olabilir
    const addBom = options.addBom === true;
    let payload;
    let type = mimeType;
    if (content instanceof Uint8Array || content instanceof ArrayBuffer) {
      payload = content;
    } else {
      payload = addBom ? '\uFEFF' + content : content;
      type = `${mimeType};charset=utf-8`;
    }
    const blob = new Blob([payload], { type });
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
        loadModelConfig().catch(() => {});
      }
    });
  }
  if (addPersonalityBtn) {
    addPersonalityBtn.addEventListener('click', () => openPersonalityModal());
  }

  if (restartAppBtn) {
    restartAppBtn.addEventListener('click', () => {
      if (!requireAdmin('Uygulamayı yeniden başlatmak için admin yetkisi gerekir.')) {
        return;
      }
      const warningMessage =
        'Bu işlem uygulamayı yeniden başlatacak ve aktif sohbetleri kesecek.\n' +
        'Devam etmek istediğinizden emin misiniz?';
      if (!window.confirm(warningMessage)) {
        return;
      }
      const originalHtml = restartAppBtn.innerHTML;
      restartAppBtn.dataset.pending = 'true';
      restartAppBtn.disabled = true;
      restartAppBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>Yeniden Başlatılıyor...';

      fetch('/admin/api/system/restart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ delay_seconds: 1.0 }),
      })
        .then((resp) => {
          if (!resp.ok) throw new Error('HTTP ' + resp.status);
          return resp.json();
        })
        .then((data) => {
          const message =
            data?.message ||
            'Uygulama kısa süre içinde yeniden başlatılacak. Sayfayı birkaç saniye sonra yenileyin.';
          alert(message);
          restartAppBtn.innerHTML = originalHtml;
        })
        .catch((err) => {
          console.error('Restart request failed', err);
          alert('Yeniden başlatma isteği gönderilemedi. Lütfen daha sonra tekrar deneyin.');
          restartAppBtn.disabled = false;
          restartAppBtn.innerHTML = originalHtml;
          restartAppBtn.removeAttribute('data-pending');
        });
    });
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
  if (modelSelectInput) {
    modelSelectInput.addEventListener('change', handleModelSelectChange);
  }
  if (modelCustomInput) {
    modelCustomInput.addEventListener('input', () => {
      updateSamplingControlsState(getSelectedModelValue());
      handleModelInputChange();
    });
  }
  if (temperatureInput) {
    temperatureInput.addEventListener('input', () => {
      handleModelInputChange();
    });
    temperatureInput.addEventListener('blur', () => {
      const state = parseSamplingInput(temperatureInput, 0, 2, 'Temperature', persistedTemperature);
      if (!state.error) {
        temperatureInput.value = formatNumber(state.value);
      }
    });
  }
  if (topPInput) {
    topPInput.addEventListener('input', () => {
      handleModelInputChange();
    });
    topPInput.addEventListener('blur', () => {
      const state = parseSamplingInput(topPInput, 0, 1, 'Top-p', persistedTopP);
      if (!state.error) {
        topPInput.value = formatNumber(state.value);
      }
    });
  }
  if (saveModelBtn) {
    saveModelBtn.addEventListener('click', (event) => {
      event.preventDefault();
      saveModelSelection();
    });
  }
  if (resetModelBtn) {
    resetModelBtn.addEventListener('click', (event) => {
      event.preventDefault();
      resetModelSelection();
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
    personalitiesTableBody.addEventListener('change', (event) => {
      const input = event.target.closest('.toggle-personality-status');
      if (!input) return;
      const slug = input.dataset.personality;
      if (!slug) return;
      const previous = input.dataset.active !== 'false';
      const desiredActive = input.checked;
      if (!requireAdmin()) {
        syncStatusSwitchVisual(input, previous);
        return;
      }
      if (slug === defaultPersonalityId && !desiredActive) {
        alert('Varsayılan kişilik pasif hale getirilemez.');
        syncStatusSwitchVisual(input, true);
        return;
      }
      updatePersonalityStatus(slug, desiredActive, input, previous);
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
      per_page: perPage
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
      per_page: 50
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
      per_page: perPage
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
  $('#exportResultsXlsx').on('click', (e) => { e.preventDefault(); exportResults('xlsx'); });
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
            qaTable.ajax.reload(() => updateAuthUI(), false);
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

  if (createFileModalEl) {
    createFileModalEl.addEventListener('show.bs.modal', prepareCreateFileModal);
    createFileModalEl.addEventListener('hidden.bs.modal', () => {
      setInlineStatus(createFileStatus, '');
    });
  }

  if (createInitialModeInputs && typeof createInitialModeInputs.forEach === 'function') {
    createInitialModeInputs.forEach((input) => {
      input.addEventListener('change', handleCreateInitialModeChange);
    });
  }
  if (createFilenameInput) {
    createFilenameInput.addEventListener('input', handleCreateFormChange);
  }
  if (createCopySelect) {
    createCopySelect.addEventListener('change', handleCreateFormChange);
  }
  if (createFileForm) {
    createFileForm.addEventListener('submit', handleCreateFileSubmit);
  }

  if (mergeFileModalEl) {
    mergeFileModalEl.addEventListener('show.bs.modal', prepareMergeFileModal);
    mergeFileModalEl.addEventListener('hidden.bs.modal', () => {
      setInlineStatus(mergeFileStatus, '');
    });
  }
  if (mergeSourceSelect) mergeSourceSelect.addEventListener('change', handleMergeFormChange);
  if (mergeTargetSelect) mergeTargetSelect.addEventListener('change', handleMergeFormChange);
  if (mergeTargetNameInput) mergeTargetNameInput.addEventListener('input', handleMergeFormChange);
  if (mergeTargetExistingRadio) mergeTargetExistingRadio.addEventListener('change', handleMergeTargetModeChange);
  if (mergeTargetNewRadio) mergeTargetNewRadio.addEventListener('change', handleMergeTargetModeChange);
  if (mergeAllowDuplicatesInput) mergeAllowDuplicatesInput.addEventListener('change', () => {
    setInlineStatus(mergeFileStatus, '');
  });
  if (mergeFileForm) {
    mergeFileForm.addEventListener('submit', handleMergeFileSubmit);
  }

  if (createFileBtn) {
    createFileBtn.addEventListener('click', (event) => {
      event.preventDefault();
      if (!hasQaAccess()) {
        if (!isAuthenticated) {
          loginModal?.show();
        } else {
          alert('Bu işlem için yeterli yetkiniz bulunmuyor.');
        }
        return;
      }
      createFileModal?.show();
    });
  }

  if (mergeFileBtn) {
    mergeFileBtn.addEventListener('click', (event) => {
      event.preventDefault();
      if (!hasQaAccess()) {
        if (!isAuthenticated) {
          loginModal?.show();
        } else {
          alert('Bu işlem için yeterli yetkiniz bulunmuyor.');
        }
        return;
      }
      mergeFileModal?.show();
    });
  }

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
      success: () => qaTable.ajax.reload(null, false),
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
        qaTable.ajax.reload(null, false);
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
    
    // Show warning when close to limit
    const warningThreshold = currentAnswerLimit * 0.9;
    if (val.length >= warningThreshold) {
      $('#answerLimitWarning').show();
    } else {
      $('#answerLimitWarning').hide();
    }
    
    // Update preview
    updateQaPreview();
  });

  // Toggle between 600 and 1200
  $(document).on('change', '#longAnswerToggle', function() {
    if (this.checked) setAnswerLimit(ANSWER_MAX); else setAnswerLimit(ANSWER_MIN);
  });

  // Update question count badge
  $('#questionsInput').on('input', function() {
    const questions = $(this).val().split('\n').map(s => s.trim()).filter(Boolean);
    $('#questionCountBadge').text(questions.length);
    updateQaPreview();
  });

  // Update preview in QA modal
  function updateQaPreview() {
    const questions = $('#questionsInput').val().split('\n').map(s => s.trim()).filter(Boolean);
    const answer = $('#answerInput').val().trim();
    
    if (questions.length === 0 && !answer) {
      $('#qaPreview').html(`<p class="text-muted mb-0"><i class="bi bi-lightbulb"></i> Soru ve cevap girildikçe burada önizleme görünecek...</p>`);
      return;
    }
    
    let preview = '<div class="preview-content">';
    if (questions.length > 0) {
      preview += '<div class="mb-2"><strong class="text-primary"><i class="bi bi-question-circle"></i> Sorular:</strong></div>';
      preview += '<ul class="question-list">';
      questions.forEach(q => {
        preview += `<li>${esc(q)}</li>`;
      });
      preview += '</ul>';
    }
    
    if (answer) {
      preview += '<div class="mt-3 mb-2"><strong class="text-success"><i class="bi bi-chat-left-text"></i> Cevap:</strong></div>';
      preview += `<div class="answer-preview p-2 bg-white rounded border">${esc(answer)}</div>`;
      preview += `<div class="text-muted small mt-1"><i class="bi bi-type"></i> ${answer.length} karakter</div>`;
    }
    preview += '</div>';
    
    $('#qaPreview').html(preview);
  }

  $('#qaModal').on('shown.bs.modal', () => {
    $('#questionsInput').trigger('focus');
    updateQaPreview();
  });

  // ===============================
  // ENHANCED QA FEATURES
  // ===============================

  // Bulk selection
  let selectedQaItems = new Set();

  $('#selectAllQa').on('change', function() {
    const isChecked = $(this).prop('checked');
    $('.qa-checkbox').prop('checked', isChecked);
    updateBulkSelection();
  });

  $(document).on('change', '.qa-checkbox', function() {
    updateBulkSelection();
  });

  function updateBulkSelection() {
    selectedQaItems.clear();
    $('.qa-checkbox:checked').each(function() {
      const row = $(this).closest('tr');
      const idx = qaTable.row(row).index();
      selectedQaItems.add(idx);
    });
    
    $('#selectedCount').text(selectedQaItems.size);
    
    if (selectedQaItems.size > 0) {
      $('#bulkActionsBar').fadeIn();
    } else {
      $('#bulkActionsBar').fadeOut();
    }
  }

  $('#clearSelectionBtn').on('click', function() {
    $('.qa-checkbox').prop('checked', false);
    $('#selectAllQa').prop('checked', false);
    updateBulkSelection();
  });

  $('#bulkDeleteBtn').on('click', function() {
    if (selectedQaItems.size === 0) return;
    
    if (!confirm(`Seçili ${selectedQaItems.size} öğeyi silmek istediğinizden emin misiniz?`)) {
      return;
    }
    
    const indicesToDelete = Array.from(selectedQaItems).sort((a, b) => b - a);
    let deleteCount = 0;
    
    indicesToDelete.forEach(idx => {
      $.ajax({
        url: `/admin/api/items/${idx}?file=${currentFile}`,
        method: 'DELETE',
        async: false,
        success: () => deleteCount++
      });
    });
    
    alert(`${deleteCount} öğe silindi.`);
    qaTable.ajax.reload(null, false);
    updateBulkSelection();
  });

  $('#bulkExportBtn').on('click', function() {
    if (selectedQaItems.size === 0) return;
    
    const exportData = [];
    selectedQaItems.forEach(idx => {
      const data = qaTable.row(idx).data();
      exportData.push(data);
    });
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `export_${selectedQaItems.size}_items_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // QA Search
  $('#qaSearchInput').on('input', function() {
    if (qaTable) {
      qaTable.search($(this).val()).draw();
    }
  });

  $('#clearQaSearch').on('click', function() {
    $('#qaSearchInput').val('');
    if (qaTable) {
      qaTable.search('').draw();
    }
  });

  // Bulk Add Modal
  let bulkAddModal;
  $('#bulkAddBtn').on('click', function() {
    if (!bulkAddModal) {
      bulkAddModal = new bootstrap.Modal(document.getElementById('bulkAddModal'));
    }
    bulkAddModal.show();
  });

  // JSON formatting
  $('#formatJsonBtn').on('click', function() {
    try {
      const input = $('#bulkJsonInput').val();
      const parsed = JSON.parse(input);
      $('#bulkJsonInput').val(JSON.stringify(parsed, null, 2));
      $('#bulkJsonStatus').html('<div class="alert alert-success"><i class="bi bi-check-circle"></i> JSON formatlandı</div>');
      updateBulkPreview('json', parsed);
    } catch (e) {
      $('#bulkJsonStatus').html(`<div class="alert alert-danger"><i class="bi bi-x-circle"></i> Hata: ${e.message}</div>`);
    }
  });

  $('#validateJsonBtn').on('click', function() {
    try {
      const input = $('#bulkJsonInput').val();
      const parsed = JSON.parse(input);
      
      if (!Array.isArray(parsed)) {
        throw new Error('JSON bir array olmalı');
      }
      
      const errors = [];
      parsed.forEach((item, idx) => {
        if (!item.questions || !Array.isArray(item.questions)) {
          errors.push(`#${idx + 1}: 'questions' alanı eksik veya array değil`);
        }
        if (!item.answer || typeof item.answer !== 'string') {
          errors.push(`#${idx + 1}: 'answer' alanı eksik veya string değil`);
        }
      });
      
      if (errors.length > 0) {
        $('#bulkJsonStatus').html(`<div class="alert alert-warning"><i class="bi bi-exclamation-triangle"></i> ${errors.length} hata bulundu:<ul class="mb-0 mt-2">${errors.map(e => `<li>${e}</li>`).join('')}</ul></div>`);
      } else {
        $('#bulkJsonStatus').html(`<div class="alert alert-success"><i class="bi bi-check-circle"></i> JSON geçerli! ${parsed.length} kayıt hazır.</div>`);
        $('#bulkAddSubmitBtn').prop('disabled', false);
        updateBulkPreview('json', parsed);
      }
    } catch (e) {
      $('#bulkJsonStatus').html(`<div class="alert alert-danger"><i class="bi bi-x-circle"></i> Geçersiz JSON: ${e.message}</div>`);
      $('#bulkAddSubmitBtn').prop('disabled', true);
    }
  });

  // Auto-validate on input change
  $('#bulkJsonInput, #bulkCsvInput, #bulkTextInput').on('input', function() {
    $('#bulkAddSubmitBtn').prop('disabled', true);
  });

  function updateBulkPreview(type, data) {
    if (!Array.isArray(data) || data.length === 0) {
      $('#bulkPreviewContainer').html('<p class="text-muted">Veri girince önizleme görünecek...</p>');
      $('#bulkPreviewCount').text('0');
      return;
    }
    
    $('#bulkPreviewCount').text(data.length);
    let html = '';
    
    data.slice(0, 5).forEach((item, idx) => {
      html += `<div class="bulk-preview-item">
        <div class="d-flex justify-content-between mb-1">
          <strong>#${idx + 1}</strong>
          <span class="badge bg-info">${item.questions?.length || 0} soru</span>
        </div>
        <div class="small text-muted">${(item.questions || []).join(', ')}</div>
        <div class="mt-1 small"><strong>Cevap:</strong> ${esc((item.answer || '').substring(0, 100))}${(item.answer || '').length > 100 ? '...' : ''}</div>
      </div>`;
    });
    
    if (data.length > 5) {
      html += `<div class="text-muted text-center mt-2"><small>... ve ${data.length - 5} kayıt daha</small></div>`;
    }
    
    $('#bulkPreviewContainer').html(html);
  }

  $('#bulkAddSubmitBtn').on('click', function() {
    const activeTab = $('.nav-link.active', '#bulkAddModal').attr('id');
    let data = [];
    
    try {
      if (activeTab === 'bulk-json-tab') {
        data = JSON.parse($('#bulkJsonInput').val());
      } else if (activeTab === 'bulk-csv-tab') {
        const lines = $('#bulkCsvInput').val().split('\n').filter(l => l.trim());
        lines.forEach(line => {
          const parts = line.split(',');
          if (parts.length >= 2) {
            const questions = parts[0].split('|').map(q => q.trim()).filter(Boolean);
            const answer = parts.slice(1).join(',').trim();
            data.push({ questions, answer });
          }
        });
      } else if (activeTab === 'bulk-text-tab') {
        const text = $('#bulkTextInput').val();
        const blocks = text.split(/\n\s*\n/).filter(b => b.trim());
        
        blocks.forEach(block => {
          const lines = block.split('\n');
          const questions = [];
          let answer = '';
          
          lines.forEach(line => {
            if (line.trim().startsWith('Q:')) {
              questions.push(line.substring(2).trim());
            } else if (line.trim().startsWith('A:')) {
              answer = line.substring(2).trim();
            }
          });
          
          if (questions.length > 0 && answer) {
            data.push({ questions, answer });
          }
        });
      }
      
      // Add all items
      let addedCount = 0;
      data.forEach(item => {
        $.ajax({
          url: `/admin/api/items?file=${currentFile}`,
          method: 'POST',
          contentType: 'application/json',
          data: JSON.stringify(item),
          async: false,
          success: () => addedCount++
        });
      });
      
      alert(`${addedCount} kayıt eklendi!`);
      bulkAddModal.hide();
      qaTable.ajax.reload(null, false);
      
      // Clear inputs
      $('#bulkJsonInput, #bulkCsvInput, #bulkTextInput').val('');
      $('#bulkPreviewContainer').html('<p class="text-muted">Veri girince önizleme görünecek...</p>');
      
    } catch (e) {
      alert('Hata: ' + e.message);
    }
  });

  // Import/Export
  let importJsonModal;
  let importedFileData = null;

  $('#importJsonBtn').on('click', function() {
    if (!importJsonModal) {
      importJsonModal = new bootstrap.Modal(document.getElementById('importJsonModal'));
    }
    importJsonModal.show();
  });

  $('#selectFileBtn').on('click', function() {
    $('#jsonFileInput').click();
  });

  $('#jsonFileInput').on('change', function(e) {
    const file = e.target.files[0];
    if (file) {
      handleImportFile(file);
    }
  });

  // Drag and drop
  const dragDropZone = document.getElementById('dragDropZone');
  if (dragDropZone) {
    dragDropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      $(dragDropZone).addClass('dragover');
    });
    
    dragDropZone.addEventListener('dragleave', () => {
      $(dragDropZone).removeClass('dragover');
    });
    
    dragDropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      $(dragDropZone).removeClass('dragover');
      
      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith('.json')) {
        handleImportFile(file);
      } else {
        alert('Lütfen sadece .json dosyası seçin');
      }
    });
  }

  function handleImportFile(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const data = JSON.parse(e.target.result);
        
        if (!Array.isArray(data)) {
          throw new Error('JSON bir array olmalı');
        }
        
        importedFileData = data;
        
        $('#importFileName').text(file.name);
        $('#importFileSize').text((file.size / 1024).toFixed(2) + ' KB');
        $('#importRecordCount').text(data.length);
        $('#importPreviewContent').text(JSON.stringify(data.slice(0, 3), null, 2));
        
        $('#dragDropZone').hide();
        $('#importFilePreview').show();
        $('#importSubmitBtn').prop('disabled', false);
        
      } catch (err) {
        alert('Geçersiz JSON dosyası: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  $('#clearImportFile').on('click', function() {
    importedFileData = null;
    $('#jsonFileInput').val('');
    $('#dragDropZone').show();
    $('#importFilePreview').hide();
    $('#importSubmitBtn').prop('disabled', true);
  });

  $('#importSubmitBtn').on('click', function() {
    if (!importedFileData) return;
    
    const merge = $('#importMergeOption').is(':checked');
    
    if (merge) {
      // Use the merge API endpoint
      alert('Birleştirme özelliği için mevcut "Birleştir" butonunu kullanın.');
    } else {
      // Replace current data
      if (!confirm('Mevcut tüm veriler silinecek ve yenileriyle değiştirilecek. Emin misiniz?')) {
        return;
      }
      
      // This would require a new API endpoint to replace all data
      // For now, show a message
      alert('Tam değiştirme özelliği henüz mevcut değil. Birleştir seçeneğini kullanın veya dosyayı manuel olarak değiştirin.');
    }
  });

  $('#exportJsonBtn').on('click', function() {
    if (!currentFile) {
      alert('Önce bir dosya seçin');
      return;
    }
    
    // Fetch current data
    $.get(`/admin/api/items?file=${currentFile}`, function(data) {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = currentFile;
      a.click();
      URL.revokeObjectURL(url);
    });
  });

  // ===============================
  // RENAME FILE FUNCTIONALITY
  // ===============================

  $('#renameFileBtn').on('click', function() {
    if (!hasQaAccess()) {
      if (!isAuthenticated) loginModal?.show();
      return;
    }
    if (!currentFile) {
      alert('Önce bir dosya seçin.');
      return;
    }
    if (currentFile === defaultFile) {
      alert('Varsayılan dosya yeniden adlandırılamaz.');
      return;
    }
    prepareRenameFileModal();
    renameFileModal?.show();
  });

  if (renameFilenameInput) {
    renameFilenameInput.addEventListener('input', handleRenameFormChange);
  }

  if (renameFileForm) {
    renameFileForm.addEventListener('submit', handleRenameFileSubmit);
  }

  if (renameFileModalEl) {
    renameFileModalEl.addEventListener('hidden.bs.modal', () => {
      setInlineStatus(renameFileStatus, '');
    });
  }

  // ===============================
  // DELETE FILE FUNCTIONALITY
  // ===============================

  let deleteFileModal;
  let deleteFileTarget = null;

  $('#deleteFileBtn').on('click', function() {
    if (!currentFile) {
      alert('Silinecek dosya yok');
      return;
    }

    if (!deleteFileModal) {
      deleteFileModal = new bootstrap.Modal(document.getElementById('deleteFileModal'));
    }

    deleteFileTarget = currentFile;
    
    // Populate modal
    $('#deleteFileName').text(currentFile);
    $('#deleteFileConfirmInput').val('');
    $('#deleteFileConfirmBtn').prop('disabled', true);
    
    // Get file item count
    $.get(`/admin/api/items?file=${currentFile}`, function(data) {
      const count = Array.isArray(data) ? data.length : 0;
      $('#deleteFileItemCount').text(count);
    });

    deleteFileModal.show();
  });

  // Validate filename input for delete confirmation
  $('#deleteFileConfirmInput').on('input', function() {
    const input = $(this).val();
    const isMatch = input === deleteFileTarget;
    $('#deleteFileConfirmBtn').prop('disabled', !isMatch);
    
    if (input && !isMatch) {
      $('#deleteFileStatus').html('<div class="alert alert-warning"><i class="bi bi-exclamation-triangle"></i> Dosya adı eşleşmiyor</div>');
    } else {
      $('#deleteFileStatus').html('');
    }
  });

  // Confirm delete
  $('#deleteFileConfirmBtn').on('click', function() {
    if (!deleteFileTarget) return;

    const btn = $(this);
    btn.prop('disabled', true);
    
    $('#deleteFileStatus').html('<div class="alert alert-info"><i class="bi bi-hourglass-split"></i> Dosya siliniyor...</div>');

    // Backend'de dosya silme endpoint'i olmalı
    // Şimdilik dosyayı boşaltıp sonra silmeyi simüle ediyoruz
    fetch(`/admin/api/files/${deleteFileTarget}`, {
      method: 'DELETE'
    })
    .then(resp => {
      if (!resp.ok) {
        return resp.json().catch(() => ({})).then((data) => {
          throw new Error(data?.message || 'Dosya silinemedi');
        });
      }
      return resp.json();
    })
    .then(() => {
      $('#deleteFileStatus').html('<div class="alert alert-success"><i class="bi bi-check-circle"></i> Dosya başarıyla silindi!</div>');
      
      setTimeout(() => {
        deleteFileModal.hide();
        
        // Reload file list
        const remainingFiles = allFiles.filter(f => f !== deleteFileTarget);
        const nextFile = remainingFiles.length > 0 ? remainingFiles[0] : null;
        
        reloadFileList(nextFile).then(() => {
          if (qaTable) {
            if (nextFile) {
              qaTable.ajax.reload(null, false);
            } else {
              qaTable.clear().draw();
            }
          }
        });
        
        deleteFileTarget = null;
        $('#deleteFileConfirmInput').val('');
        $('#deleteFileStatus').html('');
      }, 1500);
    })
    .catch(err => {
      $('#deleteFileStatus').html(`<div class="alert alert-danger"><i class="bi bi-x-circle"></i> ${err.message}</div>`);
      btn.prop('disabled', false);
    });
  });

  // Clear modal on close
  $('#deleteFileModal').on('hidden.bs.modal', function() {
    deleteFileTarget = null;
    $('#deleteFileConfirmInput').val('');
    $('#deleteFileStatus').html('');
    $('#deleteFileConfirmBtn').prop('disabled', true);
  });

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
