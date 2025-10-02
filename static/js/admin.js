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
  const qaModal = qaModalEl ? new bootstrap.Modal(qaModalEl) : null;
  const loginModal = loginModalEl ? new bootstrap.Modal(loginModalEl) : null;
  const messageDetailModal = messageDetailModalEl ? new bootstrap.Modal(messageDetailModalEl) : null;
  const $fileSel = $('#fileSelect');
  let qaTable;
  let isAuthenticated = false;
  let lastAuthState = null;

  // Personality management state
  const personalityModalEl = document.getElementById('personalityModal');
  const personalityModal = personalityModalEl ? new bootstrap.Modal(personalityModalEl) : null;
  const personalityForm = document.getElementById('personalityForm');
  const personalityModalLabel = document.getElementById('personalityModalLabel');
  const personalityIdInput = document.getElementById('personalityId');
  const personalityNameInput = document.getElementById('personalityName');
  const personalityEmojiInput = document.getElementById('personalityEmoji');
  const personalityThemeInput = document.getElementById('personalityTheme');
  const personalityBadgeColorInput = document.getElementById('personalityBadgeColor');
  const personalityBadgeIconInput = document.getElementById('personalityBadgeIcon');
  const personalityWelcomeInput = document.getElementById('personalityWelcome');
  const personalityPromptInput = document.getElementById('personalityPrompt');
  const personalitySetDefaultInput = document.getElementById('personalitySetDefault');
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
      const emoji = item.emoji || '🤖';
      opt.textContent = `${emoji} ${item.name || item.id}`;
      advancedSelect.appendChild(opt);
    });

    if (previousValue && personalityMetaCache[previousValue]) {
      advancedSelect.value = previousValue;
    }
  }

  function renderPersonalities() {
    if (!personalitiesTableBody) return;
    personalitiesTableBody.innerHTML = '';
    if (!Array.isArray(personalityList) || personalityList.length === 0) {
      personalitiesTableWrapper?.classList.add('d-none');
      personalitiesEmptyState?.classList.remove('d-none');
      return;
    }

    personalitiesEmptyState?.classList.add('d-none');
    personalitiesTableWrapper?.classList.remove('d-none');

    personalityList.forEach((item) => {
      const slug = item.id || '';
      const emoji = esc(item.emoji || '🤖');
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
        : (isAuthenticated
            ? `<button type="button" class="btn btn-outline-primary btn-sm set-default-personality" data-personality="${slug}"><i class="bi bi-star"></i> Varsayılan Yap</button>`
            : '<span class="text-muted small">-</span>');
      const themeLabel = esc(themeNameMap[item.theme] || item.theme || '-');
      const actionsHtml = isAuthenticated
        ? `<div class="btn-group btn-group-sm" role="group">
             <button type="button" class="btn btn-warning edit-personality" data-personality="${slug}"><i class="bi bi-pencil"></i></button>
             <button type="button" class="btn btn-outline-danger delete-personality" data-personality="${slug}"><i class="bi bi-trash"></i></button>
           </div>`
        : '<small class="text-muted">Giriş gerekli</small>';

      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${defaultHtml}</td>
        <td>
          <div class="d-flex align-items-start gap-2">
            <span class="fs-4">${emoji}</span>
            <div>
              <div class="fw-semibold">${displayName}</div>
              <div class="text-muted small">${slugLabel}</div>
              ${getPersonalityBadge(slug)}
            </div>
          </div>
        </td>
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
  }

  function openPersonalityModal(slug = null) {
    if (!personalityModal || !personalityForm) return;
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
      if (personalityEmojiInput) personalityEmojiInput.value = entry.emoji || '';
      if (personalityThemeInput) personalityThemeInput.value = entry.theme || 'neutral';
      if (personalityBadgeColorInput) personalityBadgeColorInput.value = entry.badge_color || '';
      if (personalityBadgeIconInput) personalityBadgeIconInput.value = entry.badge_icon || '';
      if (personalityWelcomeInput) personalityWelcomeInput.value = entry.welcome_message || '';
      if (personalityPromptInput) personalityPromptInput.value = entry.prompt || '';
    } else {
      if (personalityIdInput) {
        personalityIdInput.value = '';
        personalityIdInput.disabled = false;
      }
      if (personalityNameInput) personalityNameInput.value = '';
      if (personalityEmojiInput) personalityEmojiInput.value = '🤖';
      if (personalityThemeInput) personalityThemeInput.value = 'neutral';
      applyThemeDefaults('neutral', true);
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

    if (!isAuthenticated) {
      loginModal?.show();
      return;
    }

    const idValue = personalityIdInput?.value.trim().toLowerCase();
    const payload = {
      id: idValue,
      name: personalityNameInput?.value.trim(),
      emoji: personalityEmojiInput?.value.trim(),
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
      .then(() => {
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
    if (!slug || !isAuthenticated) {
      if (!isAuthenticated) loginModal?.show();
      return;
    }
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
    if (!slug || !isAuthenticated) {
      if (!isAuthenticated) loginModal?.show();
      return;
    }

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

  function loadPersonalities() {
    if (!personalitiesTableBody) return;
    setPersonalityLoading(true);
    clearPersonalityError();

    fetch('/admin/api/personalities')
      .then((resp) => {
        if (!resp.ok) {
          throw new Error('Kişilik listesi alınamadı');
        }
        return resp.json();
      })
      .then((data) => {
        personalityList = Array.isArray(data?.items) ? data.items : [];
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

  function updateAuthUI() {
    if (isAuthenticated) {
      $('#loginBtn').hide();
      $('#logoutBtn').show();
      $('#addBtn').prop('disabled', false);
      if (qaTable) qaTable.draw();
      $('#loginPasswordInput').val('');
      $('#loginError').hide();
      $('#loginForm').removeClass('was-validated');
      
      if (addPersonalityBtn) addPersonalityBtn.disabled = false;
      // Update overview stats after login
      updateOverviewStats();
    } else {
      $('#loginBtn').show();
      $('#logoutBtn').hide();
      $('#addBtn').prop('disabled', true);
      if (qaTable) qaTable.draw();
      
      // Show placeholders when not authenticated
      $('#totalChats, #totalLikes, #totalDislikes').text('-');
      $('#currentSeason').text('-');
      
      if (addPersonalityBtn) addPersonalityBtn.disabled = true;
      loginModal?.show();
    }

    if (lastAuthState !== isAuthenticated) {
      lastAuthState = isAuthenticated;
      loadPersonalities();
    } else {
      renderPersonalities();
    }
  }

  $.getJSON('/admin/api/auth_status', (data) => {
    isAuthenticated = Boolean(data?.authenticated);
    updateAuthUI();
  }).fail(() => {
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
            const date = new Date(d);
            return `<small>${date.toLocaleDateString('tr-TR')}<br>${date.toLocaleTimeString('tr-TR')}</small>`;
          }
        },
        { 
          data: 'season', 
          render: (d) => d ? `<span class="badge bg-secondary">${esc(d)}</span>` : '<span class="text-muted">-</span>' 
        },
        { 
          data: 'session_id', 
          render: (d) => d ? `<code class="text-primary small">${esc(d.substring(0, 12))}...</code>` : '' 
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
    // Only load stats if authenticated
    if (!isAuthenticated) {
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
    $.getJSON('/admin/api/chat/sessions', (sessions) => {
      const $sessionSelect = $('#sessionSelect');
      $sessionSelect.empty().append('<option value="">Oturum seçin...</option>');
      
      if (!sessions?.length) {
        $sessionSelect.append('<option value="" disabled>(Oturum bulunamadı)</option>');
        return;
      }
      
      sessions.forEach(session => {
        const label = `${session.session_id}${session.last_activity ? ' (' + session.last_activity + ')' : ''}`;
        $sessionSelect.append(`<option value="${session.session_id}">${esc(label)}</option>`);
      });
    }).fail((xhr) => {
      if (xhr.status === 401) loginModal?.show();
    });
  }

  function loadUsersForSession(sessionId) {
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
        const lastActivity = user.last_activity ? new Date(user.last_activity).toLocaleString('tr-TR') : 'Bilinmiyor';
        
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
            </td>
          </tr>
        `;
        $tableBody.append(row);
      });
      
      $('#sessionUsersInfo').show();
    });
  }

  function performSearch(searchParams) {
    const url = buildSearchUrl(searchParams);
    
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
        const firstDate = new Date(dates[0]).toLocaleDateString('tr-TR');
        const lastDate = new Date(dates[dates.length - 1]).toLocaleDateString('tr-TR');
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
    $('#modalTimestamp').text(rowData.timestamp || '');
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
    refreshPersonalitiesBtn.addEventListener('click', () => loadPersonalities());
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
    initChatResultsTable();
    if (isAuthenticated) {
      updateOverviewStats();
      loadSessions();
    }
  });

  // Session selection change
  $('#sessionSelect').on('change', function() {
    const sessionId = $(this).val();
    
    if (sessionId) {
      // Enable the load button
      $('#loadSessionData').prop('disabled', false);
      
      // Load and display users for this session
      loadUsersForSession(sessionId);
      $('#sessionUsersInfo').show();
    } else {
      // Disable the load button and hide user info
      $('#loadSessionData').prop('disabled', true);
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
    if (!isAuthenticated) {
      loginModal?.show();
      return;
    }
    
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
    if (!isAuthenticated) {
      loginModal?.show();
      return;
    }
    
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
      
      const date = item.timestamp ? new Date(item.timestamp) : null;
      const dateStr = date ? date.toLocaleDateString('tr-TR') + ' ' + date.toLocaleTimeString('tr-TR') : 'Bilinmiyor';
      
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

  function resetQaForm() {
    const form = document.getElementById('qaForm');
    form?.reset();
    $('#qaForm').removeClass('was-validated');
    $('#answerCount').text('0/600');
    $('#editIdx').val('');
  }

  $('#loginBtn').on('click', () => loginModal?.show());
  $('#logoutBtn').on('click', () => {
    $.post('/admin/api/logout', (res) => {
      if (res?.logged_out) {
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
          isAuthenticated = false;
          $('#loginError').text(data?.message || 'Giriş başarısız.').show();
          $('#loginPasswordInput').focus();
        }
      },
      error: (xhr) => {
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
    $('#answerCount').text(`${(row.answer || '').length}/600`);
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
    $('#answerCount').text(`${val.length}/600`);
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
