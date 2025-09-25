function esc(text) {
  const div = document.createElement('div');
  div.innerText = text == null ? '' : String(text);
  return div.innerHTML;
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
    } else {
      $('#loginBtn').show();
      $('#logoutBtn').hide();
      $('#addBtn').prop('disabled', true);
      if (qaTable) qaTable.draw();
      loginModal?.show();
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
          render: (d) => {
            const truncated = (d || '').length > 100 ? (d || '').substring(0, 100) + '...' : (d || '');
            return `<div class='text-break small' style='max-width: 250px;'>${esc(truncated)}</div>`;
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
      order: [[1, 'desc']],
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
    // Get analytics summary
    $.getJSON('/admin/api/analytics/summary', (stats) => {
      $('#totalChats').text(stats.user_messages || 0);
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
    }).fail(() => {
      $('#totalChats, #totalLikes, #totalDislikes').text('0');
      $('#currentSeason').text('-');
    });
  }

  function updateSeasonFilters(seasonData) {
    const seasons = Object.keys(seasonData).sort().reverse();
    
    $('#seasonFilterGlobal, #feedbackSeasonFilter').each(function() {
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
      $('#userSelect').prop('disabled', true).empty().append('<option value="">Kullanıcı seçin...</option>');
      return;
    }
    
    $.getJSON(`/admin/api/chat/users?session=${encodeURIComponent(sessionId)}`, (users) => {
      const $userSelect = $('#userSelect');
      $userSelect.prop('disabled', false).empty().append('<option value="">Kullanıcı seçin...</option>');
      
      if (!users?.length) {
        $userSelect.append('<option value="" disabled>(Kullanıcı bulunamadı)</option>');
        return;
      }
      
      users.forEach(user => {
        const label = `${user.user_id} (${user.total} mesaj, ${user.like} like)`;
        $userSelect.append(`<option value="${user.user_id}">${esc(label)}</option>`);
      });
    });
  }

  function performSearch(searchParams) {
    const url = buildSearchUrl(searchParams);
    
    showLoading();
    
    $.getJSON(url, (response) => {
      currentResults = response.items || [];
      updateResultsDisplay(response);
      hideLoading();
    }).fail((xhr) => {
      hideLoading();
      if (xhr.status === 401) {
        loginModal?.show();
      } else {
        alert('Arama sırasında bir hata oluştu.');
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
    } else {
      baseUrl = '/admin/api/chat/search_by_feedback';
    }
    
    Object.keys(params).forEach(key => {
      if (key !== 'mode' && params[key] !== null && params[key] !== undefined && params[key] !== '') {
        queryParams.append(key, params[key]);
      }
    });
    
    return `${baseUrl}?${queryParams.toString()}`;
  }

  function updateResultsDisplay(response) {
    initChatResultsTable();
    
    chatResultsTable.clear();
    chatResultsTable.rows.add(currentResults);
    chatResultsTable.draw();
    
    // Update result count
    $('#resultCount').text(currentResults.length);
    
    // Update pagination if available
    if (response.pagination) {
      updatePagination(response.pagination);
    }
    
    // Update info
    $('#resultsInfo').html(`<small><i class="bi bi-info-circle"></i> ${currentResults.length} sonuç bulundu</small>`);
    
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
      $('#modalPersonalityBadge').text(rowData.assistant_personality).show();
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

  // File selection change (QA table)
  $('#fileSelect').on('change', function () {
    currentFile = this.value;
    if (qaTable) qaTable.ajax.reload();
  });

  // Tab change handler - initialize chat log interface
  $('#logs-tab').on('shown.bs.tab', () => {
    initChatResultsTable();
    updateOverviewStats();
    loadSessions();
  });

  // Session selection change
  $('#sessionSelect').on('change', function() {
    const sessionId = $(this).val();
    loadUsersForSession(sessionId);
  });

  // Search handlers
  $('#searchGlobal').on('click', function() {
    const searchParams = {
      mode: 'global',
      q: $('#globalSearch').val(),
      season: $('#seasonFilterGlobal').val(),
      sort: $('#globalSortOrder').val(),
      from: $('#globalFromDate').val(),
      to: $('#globalToDate').val(),
      page: 1,
      per_page: 50
    };
    performSearch(searchParams);
  });

  $('#loadSessionData').on('click', function() {
    const sessionId = $('#sessionSelect').val();
    const userId = $('#userSelect').val();
    
    if (!sessionId || !userId) {
      alert('Lütfen önce oturum ve kullanıcı seçin.');
      return;
    }
    
    const searchParams = {
      mode: 'session',
      session: sessionId,
      user_id: userId,
      feedback: $('#sessionFeedbackFilter').val(),
      q: $('#sessionSearch').val(),
      page: 1,
      per_page: $('#advancedPerPage').val() || 25,
      sort: 'desc',
      order_by: $('#advancedOrderBy').val() || 'timestamp'
    };
    performSearch(searchParams);
  });

  $('#loadAllLikes').on('click', function() {
    const searchParams = {
      feedback: 'like',
      season: $('#feedbackSeasonFilter').val(),
      limit: $('#feedbackLimit').val() || 200
    };
    performSearch(searchParams);
  });

  $('#loadAllDislikes').on('click', function() {
    const searchParams = {
      feedback: 'dislike',
      season: $('#feedbackSeasonFilter').val(),
      limit: $('#feedbackLimit').val() || 200
    };
    performSearch(searchParams);
  });

  // Quick date filters
  $('#quickToday, #quick7d, #quick30d').on('click', function(e) {
    e.preventDefault();
    const range = $(this).attr('id').replace('quick', '').toLowerCase();
    
    const searchParams = {
      mode: 'global',
      range: range === 'today' ? 'today' : (range === '7d' ? '7d' : '30d'),
      q: $('#globalSearch').val(),
      season: $('#seasonFilterGlobal').val(),
      sort: $('#globalSortOrder').val(),
      page: 1,
      per_page: 50
    };
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
                  ${item.assistant_personality ? `<span class="badge bg-warning">${esc(item.assistant_personality)}</span>` : ''}
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
    $('#globalSearch, #globalFromDate, #globalToDate, #sessionSearch').val('');
    $('#seasonFilterGlobal, #feedbackSeasonFilter, #sessionSelect, #userSelect').val('');
    $('#globalSortOrder').val('desc');
    $('#sessionFeedbackFilter').val('any');
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