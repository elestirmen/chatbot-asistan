from __future__ import annotations
import json, pathlib, re
from typing import List, Dict, Any
from flask import Flask, jsonify, render_template_string, request, session # session eklendi

BASE      = pathlib.Path(__file__).resolve().parent
DATA_DIR  = BASE / 'data'
LOGS_DIR  = BASE / 'chat_logs'
DEFAULT_F = 'expanded_data.json'  # Python tarafındaki varsayılan dosya (ilk açılış için)
app = Flask(__name__)

# --- OTURUM AYARLARI ---
app.secret_key = 'cok_gizli_bir_anahtar_12345!' # Flask sessionları için gerekli

# Şifre (sadece bir tane ve sabit)
APP_PASSWORD = 'Kun2025' # BU ŞİFREYİ DEĞİŞTİRİN!
# -----------------------

# -----------------------------------------------------------------------------
HTML = r"""
<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Admin Manager</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css" rel="stylesheet">
  <link href="https://cdn.datatables.net/1.13.4/css/dataTables.bootstrap5.min.css" rel="stylesheet">
  <style>
    .invalid-feedback { display: none; }
    .was-validated textarea:invalid ~ .invalid-feedback,
    .was-validated input:invalid ~ .invalid-feedback { display: block; }
    .position-relative small { position: absolute; bottom: 0.25rem; right: 0.5rem; }
    #authControl button { min-width: 100px; }
    .truncate {
      display: -webkit-box;
      -webkit-line-clamp: 6;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .feedback-pill {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 2px 8px; border-radius: 999px; font-size: 12px;
    }
    .pill-like { background: #e6f4ea; color: #137333; border: 1px solid #c6e9cc; }
    .pill-dislike { background: #fde8e8; color: #b71c1c; border: 1px solid #f9caca; }
  </style>
</head>
<body class="bg-light">
<div class="container py-4">
  <div class="d-flex justify-content-between align-items-center mb-3">
    <h1 class="mb-0">Admin Manager</h1>
    <div id="authControl">
      <button class="btn btn-success" id="loginBtn">Giriş Yap</button>
      <button class="btn btn-danger" id="logoutBtn" style="display:none;">Çıkış Yap</button>
    </div>
  </div>
  <ul class="nav nav-tabs" id="adminTabs" role="tablist">
    <li class="nav-item" role="presentation">
      <button class="nav-link active" id="qa-tab" data-bs-toggle="tab" data-bs-target="#qa-pane" type="button" role="tab" aria-controls="qa-pane" aria-selected="true">
        Soru‑Cevap
      </button>
    </li>
    <li class="nav-item" role="presentation">
      <button class="nav-link" id="logs-tab" data-bs-toggle="tab" data-bs-target="#logs-pane" type="button" role="tab" aria-controls="logs-pane" aria-selected="false">
        Chat Logları
      </button>
    </li>
  </ul>
  <div class="tab-content border border-top-0 rounded-bottom p-3 bg-white shadow-sm" id="adminTabsContent">
    <div class="tab-pane fade show active" id="qa-pane" role="tabpanel" aria-labelledby="qa-tab" tabindex="0">
      <div class="mb-3">
        <select id="fileSelect" class="form-select w-auto d-inline-block me-2"></select>
        <button class="btn btn-primary" id="addBtn" disabled>Yeni Ekle</button>
      </div>
      <table id="qaTable" class="table table-striped table-bordered w-100">
        <thead class="table-dark"><tr>
          <th style="width:50px">#</th>
          <th>Sorular</th>
          <th style="min-width:200px">Cevap</th>
          <th style="width:120px">İşlemler</th>
        </tr></thead><tbody></tbody>
      </table>
    </div>

    <div class="tab-pane fade" id="logs-pane" role="tabpanel" aria-labelledby="logs-tab" tabindex="0">
      <div class="row g-2 align-items-end mb-3">
        <div class="col-auto">
          <label for="sessionSelect" class="form-label mb-1">Oturum</label>
          <select id="sessionSelect" class="form-select"></select>
        </div>
        <div class="col-auto">
          <label for="userSelect" class="form-label mb-1">Kullanıcı Logu</label>
          <select id="userSelect" class="form-select"></select>
        </div>
        <div class="col-auto">
          <label for="feedbackFilter" class="form-label mb-1">Filtre</label>
          <select id="feedbackFilter" class="form-select">
            <option value="any">Hepsi</option>
            <option value="like">Sadece Like</option>
            <option value="dislike">Sadece Dislike</option>
            <option value="unrated">Geri Bildirim Yok</option>
          </select>
        </div>
        <div class="col-auto">
          <button class="btn btn-outline-primary" id="loadLogsBtn"><i class="bi bi-download me-1"></i>Yükle</button>
        </div>
        <div class="col-auto ms-auto">
          <div class="btn-group" role="group" aria-label="Like/Dislike hızlı görüntü">
            <button class="btn btn-success" id="quickLikes"><i class="bi bi-hand-thumbs-up"></i> Like'lar</button>
            <button class="btn btn-danger" id="quickDislikes"><i class="bi bi-hand-thumbs-down"></i> Dislike'lar</button>
          </div>
        </div>
      </div>
      <table id="logsTable" class="table table-striped table-bordered w-100">
        <thead class="table-dark"><tr>
          <th style="width:60px">#</th>
          <th style="width:160px">Zaman</th>
          <th style="width:100px">Feedback</th>
          <th>Kullanıcı Mesajı</th>
          <th>Asistan Yanıtı</th>
        </tr></thead><tbody></tbody>
      </table>
    </div>
  </div>
</div>

<div class="modal fade" id="qaModal" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog modal-lg">
    <div class="modal-content">
      <form id="qaForm" class="needs-validation" novalidate>
        <div class="modal-header">
          <h5 class="modal-title" id="qaModalLabel">Yeni Kayıt</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Kapat"></button>
        </div>
        <div class="modal-body">
          <div class="mb-3">
            <label class="form-label">Sorular (her satıra bir):</label>
            <textarea id="questionsInput" class="form-control" rows="5" required
                      placeholder="Her satıra bir soru yazın…" autofocus></textarea>
            <div class="invalid-feedback">Bu alan boş olamaz.</div>
          </div>
          <div class="mb-3 position-relative">
            <label class="form-label">Cevap:</label>
            <textarea id="answerInput" class="form-control" rows="10" required maxlength="600"
                      placeholder="En fazla 600 karakter…"></textarea>
            <div class="invalid-feedback">Bu alan boş olamaz.</div>
            <small id="answerCount" class="form-text text-muted">0/600</small>
          </div>
          <input type="hidden" id="editIdx">
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
            <i class="bi bi-x-circle me-1"></i> İptal
          </button>
          <button type="submit" class="btn btn-primary">
            <i class="bi bi-save me-1"></i> Kaydet
          </button>
        </div>
      </form>
    </div>
  </div>
</div>

<div class="modal fade" id="loginModal" tabindex="-1" aria-hidden="true" data-bs-backdrop="static" data-bs-keyboard="false">
  <div class="modal-dialog modal-sm">
    <div class="modal-content">
      <form id="loginForm">
        <div class="modal-header">
          <h5 class="modal-title">Giriş Yap</h5>
        </div>
        <div class="modal-body">
          <div class="mb-3">
            <label for="loginPasswordInput" class="form-label">Şifre:</label>
            <input type="password" id="loginPasswordInput" class="form-control" required autofocus>
            <div class="invalid-feedback">Şifre gereklidir.</div>
          </div>
          <div id="loginError" class="text-danger small" style="display:none;"></div>
        </div>
        <div class="modal-footer">
          <button type="submit" class="btn btn-primary w-100">Giriş Yap</button>
        </div>
      </form>
    </div>
  </div>
</div>


<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
<script src="https://cdn.datatables.net/1.13.4/js/jquery.dataTables.min.js"></script>
<script src="https://cdn.datatables.net/1.13.4/js/dataTables.bootstrap5.min.js"></script>
<script>
// Bootstrap custom validation (qaForm için)
(function(){
  const form = document.querySelector('#qaForm');
  form.addEventListener('submit', function(event){
    if (!form.checkValidity()) { }
    form.classList.add('was-validated');
  }, false);
})();

// Bootstrap custom validation (loginForm için)
(function(){
  const form = document.querySelector('#loginForm');
  form.addEventListener('submit', function(event){
    if (!form.checkValidity()) { }
    form.classList.add('was-validated');
  }, false);
})();


$(function(){
  let currentFile = '';
  let allFiles = []; // Tüm JSON dosyalarının listesini burada sakla
  const qaModal = new bootstrap.Modal('#qaModal');
  const loginModal = new bootstrap.Modal('#loginModal');
  const $fileSel = $('#fileSelect');
  let tbl;
  let isAuthenticated = false;

  // Logs tab state
  const $sessionSel = $('#sessionSelect');
  const $userSel = $('#userSelect');
  const $feedbackSel = $('#feedbackFilter');
  let logsTbl;

  const PY_DEFAULT_FILENAME = {{ PY_DEFAULT_F | tojson }}; // Python'dan gelen ilk varsayılan dosya
  const POST_LOGIN_DEFAULT_FILE = 'pdf_qa_ogrenci_kilavuzu_2024_2025.json'; // Giriş sonrası yüklenecek varsayılan dosya

  function updateUIBasedOnAuth() {
    if (isAuthenticated) {
      $('#loginBtn').hide();
      $('#logoutBtn').show();
      $('#addBtn').prop('disabled', false);
      if(tbl) tbl.draw(); 
      // loginModal.hide(); // Giriş başarılı olunca zaten gizleniyor
      $('#loginPasswordInput').val('');
      $('#loginError').hide();
      $('#loginForm').removeClass('was-validated');
    } else {
      $('#loginBtn').show();
      $('#logoutBtn').hide();
      $('#addBtn').prop('disabled', true);
      if(tbl) tbl.draw(); 
      loginModal.show(); 
    }
  }

  $.getJSON('/api/auth_status', function(data) {
    isAuthenticated = data.authenticated;
    updateUIBasedOnAuth();
  }).fail(function() {
    isAuthenticated = false; 
    updateUIBasedOnAuth();
  });

  $.getJSON('/api/files', function(filesData){
    allFiles = filesData; // Dosya listesini global değişkene ata
    if (!allFiles.length){
      alert('data/ klasöründe JSON dosyası bulunamadı.');
      $('#addBtn').prop('disabled', true); 
      return;
    }
    allFiles.forEach(f => $fileSel.append(`<option value="${f}">${f}</option>`));
    
    currentFile = allFiles.includes(PY_DEFAULT_FILENAME) ? PY_DEFAULT_FILENAME : allFiles[0];
    $fileSel.val(currentFile);
    
    if (currentFile) {
        initTable();
    } else {
        alert('Yüklenecek veri dosyası bulunamadı.');
        $('#addBtn').prop('disabled', true);
    }
  });

  $.fn.dataTable.ext.errMode = 'none';
  function initTable(){
    tbl = $('#qaTable').DataTable({
      ajax:{ url:()=>`/api/items?file=${currentFile}`, dataSrc:'' , type: 'GET', cache: false },
      columns:[
        { data:null, render:(d,t,r,m)=> m.row+1 },
        { data:'questions', render:d=>`<span class='badge bg-info me-1'>${d.length}</span><ul class='mb-0'>${d.map(q=>`<li>${q}</li>`).join('')}</ul>` },
        { data:'answer' },
        { data:null, orderable:false, render:(d,t,r,m)=> {
            if (isAuthenticated) {
              return `<button class='btn btn-sm btn-warning editBtn me-1' data-idx='${m.row}'>Düzenle</button>`+
                     `<button class='btn btn-sm btn-danger  delBtn'  data-idx='${m.row}'>Sil</button>`;
            }
            return '<small class="text-muted">Giriş Gerekli</small>';
          }
        }
      ],
      language:{ url:'//cdn.datatables.net/plug-ins/1.13.4/i18n/tr.json' }
    });
  }

  function initLogsTable(){
    logsTbl = $('#logsTable').DataTable({
      data: [],
      columns: [
        { data: 'idx' },
        { data: 'timestamp' },
        { data: 'feedback', render: d => {
            if (d === 'like') return `<span class="feedback-pill pill-like">👍 Like</span>`;
            if (d === 'dislike') return `<span class="feedback-pill pill-dislike">👎 Dislike</span>`;
            return '';
          }
        },
        { data: 'user_message', render: d => `<div class='truncate'>${$('<div>').text(d || '').html()}</div>` },
        { data: 'assistant_response', render: d => `<div class='truncate'>${$('<div>').text(d || '').html()}</div>` },
      ],
      order: [[0, 'asc']],
      language:{ url:'//cdn.datatables.net/plug-ins/1.13.4/i18n/tr.json' }
    });
  }

  $fileSel.on('change', function(){
    currentFile = this.value;
    if (tbl) {
      tbl.ajax.url(`/api/items?file=${currentFile}`).load();
    }
  });

  // --- Logs Tab ---
  function loadSessions(){
    $.getJSON('/api/chat/sessions', function(items){
      $sessionSel.empty();
      if (!items.length){
        $sessionSel.append('<option value="">(Oturum bulunamadı)</option>');
        $userSel.empty();
        return;
      }
      items.forEach(s => $sessionSel.append(`<option value="${s}">${s}</option>`));
      loadUsersForSession();
    });
  }

  function loadUsersForSession(){
    const sess = $sessionSel.val();
    $userSel.empty();
    if (!sess){ return; }
    $.getJSON(`/api/chat/users?session=${encodeURIComponent(sess)}`, function(list){
      if (!list.length){
        $userSel.append('<option value="">(Log dosyası yok)</option>');
        return;
      }
      list.forEach(u => $userSel.append(`<option value="${u.user_id}">${u.file}</option>`));
    });
  }

  function loadLogs(){
    const sess = $sessionSel.val();
    const user = $userSel.val();
    const fb = $feedbackSel.val();
    if (!sess || !user){ return; }
    $.getJSON(`/api/chat/logs?session=${encodeURIComponent(sess)}&user_id=${encodeURIComponent(user)}&feedback=${encodeURIComponent(fb)}`, function(items){
      logsTbl.clear();
      logsTbl.rows.add(items);
      logsTbl.draw();
    });
  }

  $('#logs-tab').on('shown.bs.tab', function(){
    if (!logsTbl) initLogsTable();
    loadSessions();
  });
  $sessionSel.on('change', loadUsersForSession);
  $('#loadLogsBtn').on('click', loadLogs);
  $feedbackSel.on('change', loadLogs);
  $userSel.on('change', loadLogs);

  $('#quickLikes').on('click', function(){
    $.getJSON('/api/chat/search_by_feedback?feedback=like&limit=200', function(items){
      if (!logsTbl) initLogsTable();
      logsTbl.clear();
      logsTbl.rows.add(items);
      logsTbl.draw();
    });
  });
  $('#quickDislikes').on('click', function(){
    $.getJSON('/api/chat/search_by_feedback?feedback=dislike&limit=200', function(items){
      if (!logsTbl) initLogsTable();
      logsTbl.clear();
      logsTbl.rows.add(items);
      logsTbl.draw();
    });
  });

  const resetQaForm = () => {
    $('#qaForm').get(0).reset();
    $('#qaForm').removeClass('was-validated');
    $('#questionsInput').val('');
    $('#answerInput').val('');
    $('#editIdx').val('');
    $('#answerCount').text('0/600');
  };

  $('#loginBtn').on('click', function() {
    loginModal.show();
  });

  $('#logoutBtn').on('click', function() {
    $.post('/api/logout', function(data) {
      if(data.logged_out) {
        isAuthenticated = false;
        updateUIBasedOnAuth();
      }
    });
  });

  $('#loginForm').on('submit', function(e) {
    e.preventDefault();
    const form = this;
    if (!form.checkValidity()) {
      form.classList.add('was-validated');
      return;
    }
    const password = $('#loginPasswordInput').val();
    $.ajax({
      url: '/api/login',
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({ password: password }),
      success: function(data) {
        if (data.authenticated) {
          isAuthenticated = true;
          $('#loginError').hide();
          loginModal.hide(); // Giriş başarılı olunca modalı hemen gizle

          let needsFileChange = false;
          // Giriş sonrası varsayılan dosyayı kontrol et
          if (allFiles.includes(POST_LOGIN_DEFAULT_FILE)) {
            if (currentFile !== POST_LOGIN_DEFAULT_FILE) {
                needsFileChange = true;
            }
          }

          if (needsFileChange) {
            currentFile = POST_LOGIN_DEFAULT_FILE;
            $fileSel.val(currentFile); 
            if (tbl) {
              console.log(`Giriş başarılı: ${currentFile} dosyasına geçiliyor.`);
              tbl.ajax.url(`/api/items?file=${currentFile}`).load(function() {
                // Yeni dosya yüklendikten sonra UI'ı güncelle
                updateUIBasedOnAuth();
              });
            } else {
              // Bu durumun oluşması beklenmez eğer ilk dosya listesi başarıyla yüklendiyse
              console.log(`Giriş başarılı: Tablo ${currentFile} ile başlatılıyor (POST_LOGIN_DEFAULT).`);
              initTable(); 
              updateUIBasedOnAuth(); 
            }
          } else {
            // Dosya değişikliği gerekmiyorsa (zaten hedefte veya hedef dosya yok)
            // Sadece yetkilendirme durumuna göre UI'yı güncelle
            console.log(`Giriş başarılı: Dosya değişikliği gerekmiyor veya ${POST_LOGIN_DEFAULT_FILE} bulunamadı. Mevcut dosya: ${currentFile}.`);
            updateUIBasedOnAuth();
          }

        } else {
          isAuthenticated = false;
          $('#loginError').text(data.message || 'Giriş başarısız.').show();
          $('#loginPasswordInput').focus();
        }
      },
      error: function(xhr) {
        isAuthenticated = false;
        $('#loginError').text(xhr.responseJSON?.message || 'Bir hata oluştu. Lütfen tekrar deneyin.').show();
      }
    });
  });


  $('#addBtn').on('click',()=>{
    if (!isAuthenticated) { loginModal.show(); return; }
    $('#qaModalLabel').text('Yeni Kayıt');
    resetQaForm();
    qaModal.show();
  });

  $('#qaTable').on('click','.editBtn',function(){
    if (!isAuthenticated) { loginModal.show(); return; }
    const idx = $(this).data('idx');
    const row = tbl.row(idx).data();
    $('#qaModalLabel').text('Kaydı Düzenle');
    $('#questionsInput').val(row.questions.join('\n'));
    $('#answerInput').val(row.answer);
    $('#editIdx').val(idx);
    $('#answerCount').text(`${row.answer.length}/600`);
    $('#qaForm').removeClass('was-validated');
    qaModal.show();
  });

  $('#qaTable').on('click','.delBtn',function(){
    if (!isAuthenticated) { loginModal.show(); return; }
    const idx = $(this).data('idx');
    if(confirm('Silmek istediğinize emin misiniz?')) {
      $.ajax({
        url:`/api/items/${idx}?file=${currentFile}`,
        method:'DELETE',
        success:()=>tbl.ajax.reload(),
        error:(xhr)=>{
          let errorMsg = xhr.responseJSON?.message || 'Silme işlemi sırasında bir hata oluştu.';
          if (xhr.status === 401) {
              errorMsg += ' Lütfen tekrar giriş yapmayı deneyin.';
              isAuthenticated = false; 
              updateUIBasedOnAuth();
          }
          alert(errorMsg);
        }
      });
    }
  });

  $('#qaForm').on('submit',function(e){
    const form = this;
    e.preventDefault();
    if (!isAuthenticated) { loginModal.show(); return; }

    if (!form.checkValidity()) {
      form.classList.add('was-validated');
      return;
    }
    
    const qs  = $('#questionsInput').val().split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    const ans = $('#answerInput').val().trim();
    const idx = $('#editIdx').val();
    
    const payload = JSON.stringify({ questions:qs, answer:ans });
    const urlBase = `/api/items${idx ? '/' + idx : ''}?file=${currentFile}`;
    const method  = idx ? 'PUT' : 'POST';

    $.ajax({
      url:urlBase, method, contentType:'application/json', data:payload,
      success:()=>{ qaModal.hide(); tbl.ajax.reload(); resetQaForm(); },
      error:(xhr)=>{
        let errorMsg = xhr.responseJSON?.message || 'Kayıt işlemi sırasında bir hata oluştu.';
        if (xhr.status === 401) {
            errorMsg += ' Lütfen tekrar giriş yapmayı deneyin.';
            isAuthenticated = false; 
            updateUIBasedOnAuth();
        }
        alert(errorMsg);
      }
    });
  });

  $('#answerInput').on('input', function(){
    $('#answerCount').text(`${this.value.length}/600`);
  });

  $('#qaModal').on('shown.bs.modal', ()=>{
    $('#questionsInput').trigger('focus');
  });

  $(document).on('keydown', function(e){
    if (e.ctrlKey && e.key==='Enter') {
        if ($('#qaModal').hasClass('show') && isAuthenticated) {
            $('#qaForm').submit();
        } else if ($('#loginModal').hasClass('show')) {
            $('#loginForm').submit();
        }
    }
  });
});
</script>
</body>
</html>
"""

# -----------------------------------------------------------------------------
# Veri yardımcıları (Bu kısım değişmedi)

def list_json_files() -> list[str]:
    return sorted(f.name for f in DATA_DIR.glob('*.json'))

def canonical(items:list[dict]) -> list[dict]:
    out=[]
    for it in items:
        if 'questions' in it and isinstance(it['questions'], (list,tuple)):
            qs=[str(q).strip() for q in it['questions'] if str(q).strip()]
            if qs and 'answer' in it: out.append({'questions':qs,'answer':it['answer']})
        elif 'question' in it and 'answer' in it: # Eski format
            q=str(it['question']).strip()
            if q: out.append({'questions':[q],'answer':it['answer']})
    return out

def load_data(filename:str=DEFAULT_F)->list[dict]:
    path = DATA_DIR / filename
    if not path.exists(): return []
    try:
        raw=json.loads(path.read_text('utf-8'))
    except Exception as e:
        print('[HATA] JSON okunamadı:',e); return []
    data=canonical(raw)
    if data!=raw:
        save_data(data, filename); print('[INFO] Kayıtlar dönüştürüldü:', filename)
    return data

def save_data(data:list[dict], filename:str=DEFAULT_F):
    path = DATA_DIR / filename
    path.write_text(json.dumps(data,ensure_ascii=False,indent=2), 'utf-8')

# -----------------------------------------------------------------------------
# API Endpointleri (Genişletildi)

@app.route('/')
def home():
    return render_template_string(HTML, PY_DEFAULT_F=DEFAULT_F)

@app.route('/api/files')
def files_route():
    return jsonify(list_json_files())

@app.route('/api/auth_status', methods=['GET'])
def auth_status():
    return jsonify({'authenticated': session.get('authenticated', False)})

@app.route('/api/login', methods=['POST'])
def login_route():
    payload = request.get_json()
    if payload and payload.get('password') == APP_PASSWORD:
        session['authenticated'] = True
        return jsonify({'authenticated': True})
    session.pop('authenticated', None) 
    return jsonify({'authenticated': False, 'message': 'Şifre yanlış.'}), 401

@app.route('/api/logout', methods=['POST'])
def logout_route():
    session.pop('authenticated', None)
    return jsonify({'logged_out': True})

@app.route('/api/items', methods=['GET', 'POST'])
def items_collection_route():
    fname = request.args.get('file', DEFAULT_F)
    
    if request.method == 'GET':
        data = load_data(fname)
        return jsonify(data)

    if request.method == 'POST':
        if not session.get('authenticated'):
            return jsonify({'error': 'Unauthorized', 'message': 'Bu işlem için giriş yapmalısınız.'}), 401
        
        data = load_data(fname) 
        payload = request.get_json(force=True)
        
        if 'questions' not in payload or 'answer' not in payload:
            return jsonify({'error': 'Bad Request', 'message': 'Eksik "questions" veya "answer" alanı.'}), 400
        
        item_data_for_canonical = {'questions': payload.get('questions'), 'answer': payload.get('answer')}
        processed_item = canonical([item_data_for_canonical])

        if not processed_item:
            return jsonify({'error': 'Bad Request', 'message': 'Geçersiz soru/cevap formatı.'}), 400
        new = processed_item[0]
        
        data.append(new)
        save_data(data, fname)
        return jsonify({'ok': True}), 201

@app.route('/api/items/<int:idx>', methods=['PUT','DELETE'])
def item_singular_route(idx:int):
    if not session.get('authenticated'):
        return jsonify({'error': 'Unauthorized', 'message': 'Bu işlem için giriş yapmalısınız.'}), 401

    fname = request.args.get('file', DEFAULT_F)
    data  = load_data(fname)

    if not (0 <= idx < len(data)):
        return jsonify({'error':'Geçersiz index'}), 404

    if request.method == 'PUT':
        payload = request.get_json(force=True)
        if 'questions' not in payload or 'answer' not in payload:
            return jsonify({'error': 'Bad Request', 'message': 'Eksik "questions" veya "answer" alanı.'}), 400
        
        item_data_for_canonical = {'questions': payload.get('questions'), 'answer': payload.get('answer')}
        processed_item = canonical([item_data_for_canonical])

        if not processed_item:
             return jsonify({'error': 'Bad Request', 'message': 'Geçersiz soru/cevap formatı.'}), 400
        data[idx] = processed_item[0]
        
        save_data(data, fname)
        return jsonify({'ok':True})

    if request.method == 'DELETE':
        removed = data.pop(idx)
        save_data(data, fname)
        return jsonify(removed)

# ----- Chat logları için yardımcılar -----
def _list_sessions() -> List[str]:
    if not LOGS_DIR.exists():
        return []
    items = []
    for p in LOGS_DIR.iterdir():
        if p.is_dir() and re.match(r'^(sess|session)_', p.name):
            items.append(p.name)
    return sorted(items, reverse=True)

def _list_user_logs(session_id: str) -> List[Dict[str, str]]:
    sess_dir = LOGS_DIR / session_id
    if not sess_dir.exists() or not sess_dir.is_dir():
        return []
    out: List[Dict[str, str]] = []
    for f in sorted(sess_dir.glob('*.json')):
        m = re.match(r'^chat_log_(.+)\.json$', f.name)
        user_id = m.group(1) if m else f.stem
        out.append({"file": f.name, "user_id": user_id})
    return out

def _load_logs(session_id: str, user_id: str) -> List[Dict[str, Any]]:
    path = LOGS_DIR / session_id / f"chat_log_{user_id}.json"
    if not path.exists():
        return []
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except Exception:
        return []

def _filter_feedback(entries: List[Dict[str, Any]], fb: str) -> List[Dict[str, Any]]:
    if fb == 'like':
        return [e for e in entries if e.get('feedback') == 'like']
    if fb == 'dislike':
        return [e for e in entries if e.get('feedback') == 'dislike']
    if fb == 'unrated':
        return [e for e in entries if not e.get('feedback')]
    return entries

@app.route('/api/chat/sessions')
def api_chat_sessions():
    if not session.get('authenticated'):
        return jsonify({'error': 'Unauthorized'}), 401
    return jsonify(_list_sessions())

@app.route('/api/chat/users')
def api_chat_users():
    if not session.get('authenticated'):
        return jsonify({'error': 'Unauthorized'}), 401
    sess = request.args.get('session', '')
    return jsonify(_list_user_logs(sess))

@app.route('/api/chat/logs')
def api_chat_logs():
    if not session.get('authenticated'):
        return jsonify({'error': 'Unauthorized'}), 401
    sess = request.args.get('session', '')
    user_id = request.args.get('user_id', '')
    fb = (request.args.get('feedback') or 'any').lower()
    entries = _load_logs(sess, user_id)
    entries = _filter_feedback(entries, fb)
    # enrich with index and safe defaults
    out = []
    for i, e in enumerate(entries):
        out.append({
            'idx': i,
            'timestamp': e.get('timestamp'),
            'feedback': e.get('feedback'),
            'user_message': e.get('user_message'),
            'assistant_response': e.get('assistant_response'),
        })
    return jsonify(out)

@app.route('/api/chat/search_by_feedback')
def api_chat_search_by_feedback():
    if not session.get('authenticated'):
        return jsonify({'error': 'Unauthorized'}), 401
    fb = (request.args.get('feedback') or 'like').lower()
    try:
        limit = int(request.args.get('limit', '200'))
    except ValueError:
        limit = 200
    results: List[Dict[str, Any]] = []
    for sess in _list_sessions():
        for u in _list_user_logs(sess):
            entries = _load_logs(sess, u['user_id'])
            filtered = _filter_feedback(entries, fb)
            for idx, e in enumerate(filtered):
                results.append({
                    'session_id': sess,
                    'user_id': u['user_id'],
                    'idx': idx,
                    'timestamp': e.get('timestamp'),
                    'feedback': e.get('feedback'),
                    'user_message': e.get('user_message'),
                    'assistant_response': e.get('assistant_response'),
                })
                if len(results) >= limit:
                    return jsonify(results)
    return jsonify(results)

# -----------------------------------------------------------------------------
if __name__=='__main__':
    if not DATA_DIR.exists():
        DATA_DIR.mkdir(parents=True)
        print(f"[INFO] '{DATA_DIR}' klasörü oluşturuldu.")
    print('Veri klasörü:', DATA_DIR)
    # print(f"Uygulama şifresi (test için): {APP_PASSWORD}")
    # print(f"Flask secret_key (test için): {app.secret_key}")
    app.run(debug=True, host='0.0.0.0', port=5050)
