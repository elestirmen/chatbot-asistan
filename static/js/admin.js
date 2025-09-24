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
  const $userSel = $('#userSelect');
  const $feedbackSel = $('#feedbackFilter');
  let logsTable;

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
        url: () => `/admin/api/items?file=${currentFile}`,
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
        { data: 'idx' },
        { data: 'timestamp' },
        { data: 'feedback', render: (d) => {
            if (d === 'like') return '<span class="feedback-pill pill-like">👍 Like</span>';
            if (d === 'dislike') return '<span class="feedback-pill pill-dislike">👎 Dislike</span>';
            return '';
          } },
        { data: 'user_message', render: (d) => `<div class='truncate'>${esc(d || '')}</div>` },
        { data: 'assistant_response', render: (d) => `<div class='truncate'>${esc(d || '')}</div>` },
      ],
      order: [[0, 'asc']],
    });
  }

  $('#fileSelect').on('change', function () {
    currentFile = this.value;
    qaTable?.ajax.url(`/admin/api/items?file=${currentFile}`).load();
  });

  function loadSessions() {
    $.getJSON('/admin/api/chat/sessions', (items) => {
      $sessionSel.empty();
      if (!items?.length) {
        $sessionSel.append('<option value="">(Oturum bulunamadı)</option>');
        $userSel.empty();
        return;
      }
      items.forEach((s) => $sessionSel.append(`<option value="${s}">${s}</option>`));
      loadUsersForSession();
    }).fail((xhr) => {
      if (xhr.status === 401) loginModal?.show();
    });
  }

  function loadUsersForSession() {
    const sessionId = $sessionSel.val();
    $userSel.empty();
    if (!sessionId) return;
    $.getJSON(`/admin/api/chat/users?session=${encodeURIComponent(sessionId)}`, (list) => {
      if (!list?.length) {
        $userSel.append('<option value="">(Log dosyası yok)</option>');
        return;
      }
      list.forEach((u) => $userSel.append(`<option value="${u.user_id}">${esc(u.file)}</option>`));
    });
  }

  function loadLogs() {
    const sessionId = $sessionSel.val();
    const userId = $userSel.val();
    const fb = $feedbackSel.val();
    if (!sessionId || !userId) return;
    $.getJSON(`/admin/api/chat/logs?session=${encodeURIComponent(sessionId)}&user_id=${encodeURIComponent(userId)}&feedback=${encodeURIComponent(fb)}`, (items) => {
      ensureLogsTable();
      logsTable.clear();
      logsTable.rows.add(items || []);
      logsTable.draw();
    });
  }

  $('#logs-tab').on('shown.bs.tab', () => {
    ensureLogsTable();
    loadSessions();
  });
  $sessionSel.on('change', loadUsersForSession);
  $('#loadLogsBtn').on('click', loadLogs);
  $feedbackSel.on('change', loadLogs);
  $userSel.on('change', loadLogs);
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
              qaTable.ajax.url(`/admin/api/items?file=${currentFile}`).load(() => updateAuthUI());
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

  $(document).on('keydown', (e) => {
    if (!e.ctrlKey || e.key !== 'Enter') return;
    if ($('#qaModal').hasClass('show') && isAuthenticated) {
      $('#qaForm').trigger('submit');
    } else if ($('#loginModal').hasClass('show')) {
      $('#loginForm').trigger('submit');
    }
  });
});
