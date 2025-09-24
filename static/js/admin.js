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
  const qaModal = qaModalEl ? new bootstrap.Modal(qaModalEl) : null;
  const loginModal = loginModalEl ? new bootstrap.Modal(loginModalEl) : null;
  const $fileSel = $('#fileSelect');
  let qaTable;
  let isAuthenticated = false;

  const $sessionSel = $('#sessionSelect');
  const $usersTableEl = $('#usersTable');
  let usersTable;
  // Eski select yedeği (şablonda artık görünmüyor ama referans kalabilir)
  const $userSel = $('#userSelect');
  const $feedbackSel = $('#feedbackFilter');
  let logsTable;
  let currentPage = 1;
  let currentPerPage = 25;

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

  function ensureLogsTable() {
    if (logsTable) return;
    logsTable = $('#logsTable').DataTable({
      data: [],
      columns: [
        { 
          data: null, 
          orderable: false,
          render: () => '<input type="checkbox" class="form-check-input row-checkbox">'
        },
        { data: 'idx' },
        { data: 'timestamp', render: (d) => {
            if (!d) return '';
            const date = new Date(d);
            return `<small class="text-muted">${date.toLocaleDateString('tr-TR')}<br>${date.toLocaleTimeString('tr-TR')}</small>`;
          }
        },
        { data: 'feedback', render: (d) => {
            if (d === 'like') return '<span class="feedback-pill pill-like"><i class="bi bi-hand-thumbs-up"></i> Like</span>';
            if (d === 'dislike') return '<span class="feedback-pill pill-dislike"><i class="bi bi-hand-thumbs-down"></i> Dislike</span>';
            return '<span class="text-muted">-</span>';
          } 
        },
        { 
          data: 'user_message', 
          render: (d) => `<div class='message-bubble user truncate' title="${esc(d || '')}">${esc(d || '')}</div>` 
        },
        { 
          data: 'assistant_response', 
          render: (d) => `<div class='message-bubble assistant truncate' title="${esc(d || '')}">${esc(d || '')}</div>` 
        },
        {
          data: null,
          orderable: false,
          render: (d, t, row) => {
            return `<div class="btn-group btn-group-sm">
              <button class="btn btn-outline-primary btn-sm view-detail" data-bs-toggle="modal" data-bs-target="#messageModal" title="Detay">
                <i class="bi bi-eye"></i>
              </button>
            </div>`;
          }
        }
      ],
      order: [[1, 'desc']],
      paging: false, // We handle pagination manually
      searching: false, // We handle search manually
      info: false, // We show custom info
      responsive: true,
      language: {
        url: '//cdn.datatables.net/plug-ins/1.13.4/i18n/tr.json'
      }
    });
  }

  $('#fileSelect').on('change', function () {
    currentFile = this.value;
    if (qaTable) qaTable.ajax.reload();
  });

  function loadSessions() {
    $.getJSON('/admin/api/chat/sessions', (items) => {
      $sessionSel.empty();
      if (!items?.length) {
        $sessionSel.append('<option value="">(Oturum bulunamadı)</option>');
        if (usersTable) usersTable.clear().draw();
        return;
      }
      // items: [{session_id,last_activity,last_activity_ts}]
      items.forEach((it) => {
        const label = `${it.session_id}${it.last_activity ? ' ('+it.last_activity+')' : ''}`;
        $sessionSel.append(`<option value="${it.session_id}">${label}</option>`);
      });
      loadUsersForSession();
    }).fail((xhr) => {
      if (xhr.status === 401) loginModal?.show();
    });
  }

  function ensureUsersTable() {
    if (usersTable) return;
    usersTable = $usersTableEl.DataTable({
      data: [],
      columns: [
        { data: 'user_id', render: (d) => `<code class="text-primary">${esc(d)}</code>` },
        { data: 'total', render: (d) => `<span class="badge bg-primary">${d}</span>` },
        { data: 'like', render: (d) => `<span class="badge bg-success">${d}</span>` },
        { data: 'dislike', render: (d) => `<span class="badge bg-danger">${d}</span>` },
        { data: 'unrated', render: (d) => `<span class="badge bg-secondary">${d}</span>` },
        { data: 'last_activity', render: (d) => {
            if (!d) return '<span class="text-muted">-</span>';
            const date = new Date(d);
            return `<small>${date.toLocaleDateString('tr-TR')} ${date.toLocaleTimeString('tr-TR')}</small>`;
          }
        },
        { 
          data: null, 
          render: (d, t, row) => {
            const total = row.total || 0;
            const like = row.like || 0;
            const rate = total > 0 ? Math.round((like / total) * 100) : 0;
            let className = 'low';
            if (rate >= 70) className = 'high';
            else if (rate >= 40) className = 'medium';
            return `<span class="success-rate ${className}">${rate}%</span>`;
          }
        }
      ],
      order: [[5, 'desc']],
      pageLength: 10,
      responsive: true
    });
    $('#usersTable tbody').on('click', 'tr', function () {
      const row = usersTable.row(this).data();
      if (!row) return;
      $userSel.val(row.user_id); // yedek
      loadLogsAdvanced();
      $('#usersTable tbody tr').removeClass('table-active');
      $(this).addClass('table-active');
    });
  }

  function loadUsersForSession() {
    const sessionId = $sessionSel.val();
    if (!sessionId) return;
    ensureUsersTable();
    $.getJSON(`/admin/api/chat/users?session=${encodeURIComponent(sessionId)}`, (list) => {
      usersTable.clear();
      usersTable.rows.add(list || []);
      usersTable.draw();
    });
  }

  function loadLogsAdvanced(page = currentPage) {
    const sessionId = $sessionSel.val();
    let userId = $userSel.val();
    // Eğer usersTable'da seçili satır varsa onu esas al
    const sel = usersTable?.row('.table-active')?.data();
    if (sel) userId = sel.user_id;
    const fb = $feedbackSel.val();
    const from = $('#fromDate').val();
    const to = $('#toDate').val();
    const q = $('#searchText').val();
    const perPage = $('#perPageSelect').val() || currentPerPage;
    const sortOrder = $('#sortOrder').val() || 'desc';
    
    if (!sessionId || !userId) return;
    
    const url = `/admin/api/chat/logs_advanced?session=${encodeURIComponent(sessionId)}&user_id=${encodeURIComponent(userId)}&feedback=${encodeURIComponent(fb)}&from=${encodeURIComponent(from||'')}&to=${encodeURIComponent(to||'')}&q=${encodeURIComponent(q||'')}&page=${page}&per_page=${perPage}&sort=${encodeURIComponent(sortOrder)}`;
    
    showLoading('#logsTable');
    
    $.getJSON(url, (res) => {
      ensureLogsTable();
      logsTable.clear();
      logsTable.rows.add(res.items || []);
      logsTable.draw();
      
      // Update pagination
      currentPage = page;
      currentPerPage = parseInt(perPage);
      updatePagination(res.pagination);
      
      // Enhanced stats
      updateStats(res.summary);
      
      hideLoading('#logsTable');
    }).fail(() => {
      hideLoading('#logsTable');
    });
  }

  function updatePagination(pagination) {
    if (!pagination) return;
    
    const { page, per_page, total, pages, has_prev, has_next } = pagination;
    
    // Update pagination info
    const start = (page - 1) * per_page + 1;
    const end = Math.min(page * per_page, total);
    $('#paginationInfo').text(`${start}-${end} / ${total} sonuç`);
    $('#resultsInfo').html(`<small>Toplam <strong>${total}</strong> sonuç bulundu</small>`);
    
    // Build pagination controls
    const $pagination = $('#paginationControls');
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
    
    if (startPage > 1) {
      $pagination.append(`<li class="page-item"><a class="page-link" href="#" data-page="1">1</a></li>`);
      if (startPage > 2) {
        $pagination.append(`<li class="page-item disabled"><span class="page-link">...</span></li>`);
      }
    }
    
    for (let i = startPage; i <= endPage; i++) {
      $pagination.append(`
        <li class="page-item ${i === page ? 'active' : ''}">
          <a class="page-link" href="#" data-page="${i}">${i}</a>
        </li>
      `);
    }
    
    if (endPage < pages) {
      if (endPage < pages - 1) {
        $pagination.append(`<li class="page-item disabled"><span class="page-link">...</span></li>`);
      }
      $pagination.append(`<li class="page-item"><a class="page-link" href="#" data-page="${pages}">${pages}</a></li>`);
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

  $('#logs-tab').on('shown.bs.tab', () => {
    ensureLogsTable();
    ensureUsersTable();
    loadSessions();
  });
  $sessionSel.on('change', loadUsersForSession);
  $('#loadLogsBtn').on('click', loadLogsAdvanced);
  $feedbackSel.on('change', loadLogsAdvanced);
  $userSel.on('change', loadLogsAdvanced);
  $('#searchText').on('keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); loadLogsAdvanced(); }});
  $('#quickToday').on('click', function(e){ e.preventDefault(); $('#fromDate').val(''); $('#toDate').val(''); loadQuick('today'); });
  $('#quick7d').on('click', function(e){ e.preventDefault(); $('#fromDate').val(''); $('#toDate').val(''); loadQuick('7d'); });
  $('#quickAll').on('click', function(e){ e.preventDefault(); $('#fromDate').val(''); $('#toDate').val(''); loadLogsAdvanced(); });
  function loadQuick(range){
    const sessionId = $sessionSel.val();
    let userId = $userSel.val();
    const sel = usersTable?.row('.table-active')?.data();
    if (sel) userId = sel.user_id;
    const fb = $feedbackSel.val();
    const q = $('#searchText').val();
    const perPage = $('#perPageSelect').val() || currentPerPage;
    const sortOrder = $('#sortOrder').val() || 'desc';
    
    if (!sessionId || !userId) return;
    
    currentPage = 1; // Reset to first page
    const url = `/admin/api/chat/logs_advanced?session=${encodeURIComponent(sessionId)}&user_id=${encodeURIComponent(userId)}&feedback=${encodeURIComponent(fb)}&range=${encodeURIComponent(range)}&q=${encodeURIComponent(q||'')}&page=1&per_page=${perPage}&sort=${encodeURIComponent(sortOrder)}`;
    
    showLoading('#logsTable');
    
    $.getJSON(url, (res) => {
      ensureLogsTable();
      logsTable.clear();
      logsTable.rows.add(res.items || []);
      logsTable.draw();
      
      // Update pagination
      updatePagination(res.pagination);
      
      // Enhanced stats
      updateStats(res.summary);
      
      hideLoading('#logsTable');
    }).fail(() => {
      hideLoading('#logsTable');
    });
  }
  $('#quickLikes').on('click', () => {
    $.getJSON('/admin/api/chat/search_by_feedback?feedback=like&limit=200', (items) => {
      ensureLogsTable();
      logsTable.clear();
      logsTable.rows.add(items || []);
      logsTable.draw();
    });
  });
  $('#quickDislikes').on('click', () => {
    $.getJSON('/admin/api/chat/search_by_feedback?feedback=dislike&limit=200', (items) => {
      ensureLogsTable();
      logsTable.clear();
      logsTable.rows.add(items || []);
      logsTable.draw();
    });
  });

  // New enhanced functionality
  
  // Real-time search
  let searchTimeout;
  $('#searchText').on('input', function() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      loadLogsAdvanced();
    }, 500);
  });

  // Clear search button
  $('#clearSearch').on('click', function() {
    $('#searchText').val('');
    loadLogsAdvanced();
  });

  // Reset filters
  $('#resetFilters').on('click', function() {
    $('#sessionSelect').val('');
    $('#feedbackFilter').val('any');
    $('#fromDate').val('');
    $('#toDate').val('');
    $('#searchText').val('');
    $('#perPageSelect').val('25');
    $('#sortOrder').val('desc');
    currentPage = 1;
    currentPerPage = 25;
    
    if (usersTable) {
      usersTable.clear().draw();
    }
    if (logsTable) {
      logsTable.clear().draw();
    }
    
    // Reset pagination controls
    $('#paginationControls').empty();
    $('#paginationInfo').text('');
    $('#resultsInfo').html('<small>Sonuç gösteriliyor</small>');
    
    // Reset stats
    $('#statTotal, #statLike, #statDislike, #statUnrated, #statActiveUsers').text('0');
    $('#statSatisfaction').text('0%');
  });

  // Select all checkbox functionality
  $('#selectAll').on('change', function() {
    const isChecked = $(this).prop('checked');
    $('.row-checkbox').prop('checked', isChecked);
  });

  // Individual checkbox handling
  $(document).on('change', '.row-checkbox', function() {
    const totalCheckboxes = $('.row-checkbox').length;
    const checkedCheckboxes = $('.row-checkbox:checked').length;
    $('#selectAll').prop('checked', totalCheckboxes === checkedCheckboxes);
  });

  // Export functionality
  function exportToCSV(data, filename) {
    const csvContent = [];
    csvContent.push(['Index', 'Timestamp', 'Feedback', 'User Message', 'Assistant Response'].join(','));
    
    data.forEach(row => {
      const csvRow = [
        row.idx || '',
        row.timestamp || '',
        row.feedback || '',
        `"${(row.user_message || '').replace(/"/g, '""')}"`,
        `"${(row.assistant_response || '').replace(/"/g, '""')}"`
      ];
      csvContent.push(csvRow.join(','));
    });

    const blob = new Blob([csvContent.join('\\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  }

  function exportToJSON(data, filename) {
    const jsonData = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  }

  $('#exportJson').on('click', function(e) {
    e.preventDefault();
    if (!logsTable || logsTable.data().length === 0) {
      alert('Dışa aktarılacak veri bulunamadı.');
      return;
    }
    const data = logsTable.data().toArray();
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    exportToJSON(data, `chat_logs_${timestamp}.json`);
  });

  $('#exportCsv').on('click', function(e) {
    e.preventDefault();
    if (!logsTable || logsTable.data().length === 0) {
      alert('Dışa aktarılacak veri bulunamadı.');
      return;
    }
    const data = logsTable.data().toArray();
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    exportToCSV(data, `chat_logs_${timestamp}.csv`);
  });

  // Refresh logs
  $('#refreshLogs').on('click', function() {
    loadLogsAdvanced();
  });

  // Add 30-day quick filter
  $('#quick30d').on('click', function(e) {
    e.preventDefault();
    $('#fromDate').val('');
    $('#toDate').val('');
    loadQuick('30d');
  });

  function updateStats(summary) {
    const total = summary?.total || 0;
    const like = summary?.like || 0;
    const dislike = summary?.dislike || 0;
    const unrated = summary?.unrated || 0;
    
    $('#statTotal').text(total);
    $('#statLike').text(like);
    $('#statDislike').text(dislike);
    $('#statUnrated').text(unrated);
    
    const ratedTotal = like + dislike;
    const satisfaction = ratedTotal > 0 ? Math.round((like / ratedTotal) * 100) : 0;
    $('#statSatisfaction').text(satisfaction + '%');
    
    const activeUsers = usersTable ? usersTable.data().length : 0;
    $('#statActiveUsers').text(activeUsers);
  }

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

  // Message detail modal
  $(document).on('click', '.view-detail', function() {
    const row = logsTable.row($(this).closest('tr')).data();
    if (!row) return;
    
    $('#modalUserMessage').text(row.user_message || '');
    $('#modalAssistantResponse').text(row.assistant_response || '');
    $('#modalTimestamp').text(row.timestamp || '');
    
    let feedbackHtml = '<span class="text-muted">-</span>';
    if (row.feedback === 'like') {
      feedbackHtml = '<span class="feedback-pill pill-like"><i class="bi bi-hand-thumbs-up"></i> Like</span>';
    } else if (row.feedback === 'dislike') {
      feedbackHtml = '<span class="feedback-pill pill-dislike"><i class="bi bi-hand-thumbs-down"></i> Dislike</span>';
    }
    $('#modalFeedback').html(feedbackHtml);
  });

  // Bulk operations
  $('#bulkMarkLike').on('click', function(e) {
    e.preventDefault();
    const selectedRows = $('.row-checkbox:checked');
    if (selectedRows.length === 0) {
      alert('Lütfen en az bir satır seçin.');
      return;
    }
    if (confirm(`${selectedRows.length} mesajı Like olarak işaretlemek istediğinize emin misiniz?`)) {
      // Implementation would require backend support for bulk operations
      alert('Bu özellik henüz backend tarafında desteklenmiyor. Yakında eklenecek.');
    }
  });

  $('#bulkMarkDislike').on('click', function(e) {
    e.preventDefault();
    const selectedRows = $('.row-checkbox:checked');
    if (selectedRows.length === 0) {
      alert('Lütfen en az bir satır seçin.');
      return;
    }
    if (confirm(`${selectedRows.length} mesajı Dislike olarak işaretlemek istediğinize emin misiniz?`)) {
      // Implementation would require backend support for bulk operations
      alert('Bu özellik henüz backend tarafında desteklenmiyor. Yakında eklenecek.');
    }
  });

  // Enhanced loading states
  function showLoading(element) {
    $(element).addClass('loading-overlay loading');
  }

  function hideLoading(element) {
    $(element).removeClass('loading-overlay loading');
  }

  // Update loadLogsAdvanced to show loading
  const originalLoadLogsAdvanced = loadLogsAdvanced;
  loadLogsAdvanced = function() {
    showLoading('#logsTable');
    const result = originalLoadLogsAdvanced();
    setTimeout(() => hideLoading('#logsTable'), 500);
    return result;
  };

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

    // Ctrl+R for refresh logs
    if (e.ctrlKey && e.key === 'r' && $('#logs-tab').hasClass('active')) {
      e.preventDefault();
      loadLogsAdvanced();
      return;
    }

    // Ctrl+E for export
    if (e.ctrlKey && e.key === 'e' && $('#logs-tab').hasClass('active')) {
      e.preventDefault();
      $('#exportJson').click();
      return;
    }

    // Escape to clear search
    if (e.key === 'Escape' && $('#searchText').is(':focus')) {
      $('#clearSearch').click();
      return;
    }
  });

  // Auto-refresh functionality (optional)
  let autoRefreshInterval;
  function startAutoRefresh(intervalMinutes = 5) {
    stopAutoRefresh();
    autoRefreshInterval = setInterval(() => {
      if ($('#logs-tab').hasClass('active') && $sessionSel.val()) {
        loadLogsAdvanced();
      }
    }, intervalMinutes * 60 * 1000);
  }

  function stopAutoRefresh() {
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
      autoRefreshInterval = null;
    }
  }

  // Pagination event handlers
  $(document).on('click', '#paginationControls .page-link', function(e) {
    e.preventDefault();
    const page = parseInt($(this).data('page'));
    if (page && page !== currentPage) {
      loadLogsAdvanced(page);
    }
  });

  $('#perPageSelect').on('change', function() {
    currentPage = 1; // Reset to first page when changing per-page
    loadLogsAdvanced(1);
  });

  // Sort order change handler
  $('#sortOrder').on('change', function() {
    currentPage = 1; // Reset to first page when changing sort order
    updateSortIcon();
    loadLogsAdvanced(1);
  });

  function updateSortIcon() {
    const sortOrder = $('#sortOrder').val();
    const $label = $('label[for="sortOrder"] i');
    if (sortOrder === 'asc') {
      $label.removeClass('bi-sort-down').addClass('bi-sort-up');
    } else {
      $label.removeClass('bi-sort-up').addClass('bi-sort-down');
    }
  }

  // Initialize sort icon
  updateSortIcon();

  // Initialize auto-refresh on logs tab
  $('#logs-tab').on('shown.bs.tab', () => {
    startAutoRefresh(5); // 5 minutes
  });

  $('#logs-tab').on('hidden.bs.tab', () => {
    stopAutoRefresh();
  });
});
