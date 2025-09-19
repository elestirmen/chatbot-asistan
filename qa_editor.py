"""
qa_editor.py – Çoklu JSON dosyalı Soru‑Cevap yönetim aracı
========================================================
• Eski `{question, answer}` ve yeni `{questions[], answer}` yapılarını otomatik dönüştürür.
• Birden fazla JSON dosyasını destekler; açılır listeden dosya seçilir.
• Bootstrap 5 + DataTables ile CRUD arayüzü.
• Placeholder, karakter sayacı, CSRF‑benzeri validasyon, ikonlar, klavye kısayolları.

Çalıştırma
----------
    pip install flask
    python qa_editor.py       # ardından http://localhost:5050
"""
from __future__ import annotations
import json, pathlib
from flask import Flask, jsonify, render_template_string, request

BASE      = pathlib.Path(__file__).resolve().parent
DATA_DIR  = BASE / 'data'                          # Verilerin bulunduğu klasör
DEFAULT_F = 'expanded_data.json'                   # Varsayılan dosya
app = Flask(__name__)

# -----------------------------------------------------------------------------
HTML = r"""
<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Soru‑Cevap Düzenleyici</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css" rel="stylesheet">
  <link href="https://cdn.datatables.net/1.13.4/css/dataTables.bootstrap5.min.css" rel="stylesheet">
  <style>
    .invalid-feedback { display: none; }
    .was-validated textarea:invalid ~ .invalid-feedback { display: block; }
    .position-relative small { position: absolute; bottom: 0.25rem; right: 0.5rem; }
  </style>
</head>
<body class="bg-light">
<div class="container py-4">
  <h1 class="mb-4">Soru‑Cevap Düzenleyici</h1>
  <select id="fileSelect" class="form-select w-auto d-inline-block me-2"></select>
  <button class="btn btn-primary mb-3" id="addBtn">Yeni Ekle</button>
  <table id="qaTable" class="table table-striped table-bordered w-100">
    <thead class="table-dark"><tr>
      <th style="width:50px">#</th>
      <th>Sorular</th>
      <th style="min-width:200px">Cevap</th>
      <th style="width:120px">İşlemler</th>
    </tr></thead><tbody></tbody>
  </table>
</div>

<!-- Modal -->
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
            <textarea id="questionsInput" class="form-control" rows="4" required
                      placeholder="Her satıra bir soru yazın…" autofocus></textarea>
            <div class="invalid-feedback">Bu alan boş olamaz.</div>
          </div>
          <div class="mb-3 position-relative">
            <label class="form-label">Cevap:</label>
            <textarea id="answerInput" class="form-control" rows="3" required maxlength="600"
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

<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
<script src="https://cdn.datatables.net/1.13.4/js/jquery.dataTables.min.js"></script>
<script src="https://cdn.datatables.net/1.13.4/js/dataTables.bootstrap5.min.js"></script>
<script>
// Bootstrap custom validation
(function(){
  const form = document.querySelector('#qaForm');
  form.addEventListener('submit', function(event){
    if (!form.checkValidity()) {
      event.preventDefault(); event.stopPropagation();
    }
    form.classList.add('was-validated');
  }, false);
})();

$(function(){
  let currentFile = '';
  const modal = new bootstrap.Modal('#qaModal');
  const $fileSel = $('#fileSelect');
  let tbl;  // DataTable referansı

  // JSON dosyalarını çek ve select'i doldur
  $.getJSON('/api/files', function(files){
      if (!files.length){
          alert('data/ klasöründe JSON dosyası bulunamadı.');
          return;
      }
      files.forEach(f => $fileSel.append(`<option value="${f}">${f}</option>`));
      currentFile = files.includes('" + DEFAULT_F + "') ? '" + DEFAULT_F + "' : files[0];
      $fileSel.val(currentFile);
      initTable();
  });

  function initTable(){
      tbl = $('#qaTable').DataTable({
        ajax:{ url:()=>`/api/items?file=${currentFile}`, dataSrc:'' },
        columns:[
          { data:null, render:(d,t,r,m)=> m.row+1 },
          { data:'questions', render:d=>`<span class='badge bg-info me-1'>${d.length}</span><ul class='mb-0'>${d.map(q=>`<li>${q}</li>`).join('')}</ul>` },
          { data:'answer' },
          { data:null, orderable:false, render:(d,t,r,m)=>
              `<button class='btn btn-sm btn-warning editBtn me-1' data-idx='${m.row}'>Düzenle</button>`+
              `<button class='btn btn-sm btn-danger  delBtn'  data-idx='${m.row}'>Sil</button>` }
        ],
        language:{ url:'//cdn.datatables.net/plug-ins/1.13.4/i18n/tr.json' }
      });
  }

  // Dosya seçimi değiştiğinde tabloyu yenile
  $fileSel.on('change', function(){
      currentFile = this.value;
      tbl.ajax.url(`/api/items?file=${currentFile}`).load();
  });

  const reset = () => {
      $('#questionsInput').val('');
      $('#answerInput').val('');
      $('#editIdx').val('');
      $('#answerCount').text('0/600');
  };

  $('#addBtn').on('click',()=>{ $('#qaModalLabel').text('Yeni Kayıt'); reset(); modal.show(); });

  $('#qaTable').on('click','.editBtn',function(){
    const idx = $(this).data('idx');
    const row = tbl.row(idx).data();
    $('#qaModalLabel').text('Kaydı Düzenle');
    $('#questionsInput').val(row.questions.join('\n'));
    $('#answerInput').val(row.answer);
    $('#editIdx').val(idx);
    $('#answerCount').text(`${row.answer.length}/600`);
    modal.show();
  });

  $('#qaTable').on('click','.delBtn',function(){
    const idx = $(this).data('idx');
    if(confirm('Silmek istediğinize emin misiniz?'))
      $.ajax({ url:`/api/items/${idx}?file=${currentFile}`, method:'DELETE', success:()=>tbl.ajax.reload() });
  });

  // form submit
  $('#qaForm').on('submit',function(e){
    e.preventDefault();
    const qs  = $('#questionsInput').val().split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    const ans = $('#answerInput').val().trim();
    const idx = $('#editIdx').val();
    const payload = JSON.stringify({ questions:qs, answer:ans });
    const urlBase = `/api/items${idx ? '/' + idx : ''}?file=${currentFile}`;
    const method  = idx ? 'PUT' : 'POST';
    $.ajax({ url:urlBase, method, contentType:'application/json', data:payload,
             success:()=>{ modal.hide(); tbl.ajax.reload(); } });
  });

  // karakter sayacı
  $('#answerInput').on('input', function(){
    $('#answerCount').text(`${this.value.length}/600`);
  });

  // modal açıldığında autofocus
  $('#qaModal').on('shown.bs.modal', ()=>{
    $('#questionsInput').trigger('focus');
  });

  // Ctrl+Enter ile kaydet
  $(document).on('keydown', function(e){
    if (e.ctrlKey && e.key==='Enter' && $('#qaModal').hasClass('show')) {
      $('#qaForm').submit();
    }
  });
});
</script>
</body>
</html>
"""

# -----------------------------------------------------------------------------
# Veri yardımcıları

def list_json_files() -> list[str]:
    """data/ altındaki .json dosyalarını A‑Z sırala."""
    return sorted(f.name for f in DATA_DIR.glob('*.json'))

def canonical(items:list[dict]) -> list[dict]:
    """Her öğeyi {questions:list[str], answer:str} biçimine getir."""
    out=[]
    for it in items:
        if 'questions' in it and isinstance(it['questions'], (list,tuple)):
            qs=[str(q).strip() for q in it['questions'] if str(q).strip()]
            if qs: out.append({'questions':qs,'answer':it['answer']})
        elif 'question' in it:
            q=str(it['question']).strip()
            if q: out.append({'questions':[q],'answer':it['answer']})
    return out

def load_data(filename:str=DEFAULT_F)->list[dict]:
    path = DATA_DIR / filename
    if not path.exists():
        return []
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
# API
@app.route('/')
def home():
    return render_template_string(HTML)

@app.route('/api/files')
def files():
    """data/ klasöründeki .json dosyalarının listesini döndür."""
    return jsonify(list_json_files())

@app.route('/api/items', methods=['GET','POST'])
def items():
    fname = request.args.get('file', DEFAULT_F)
    data  = load_data(fname)
    if request.method=='GET':
        return jsonify(data)
    new = canonical([request.get_json(force=True)])[0]
    data.append(new); save_data(data, fname)
    return jsonify({'ok':True}),201

@app.route('/api/items/<int:idx>', methods=['PUT','DELETE'])
def item(idx:int):
    fname = request.args.get('file', DEFAULT_F)
    data  = load_data(fname)
    if not 0<=idx<len(data):
        return jsonify({'error':'invalid index'}),404
    if request.method=='PUT':
        data[idx]=canonical([request.get_json(force=True)])[0]
        save_data(data, fname); return jsonify({'ok':True})
    removed=data.pop(idx); save_data(data, fname); return jsonify(removed)

# -----------------------------------------------------------------------------
if __name__=='__main__':
    print('Veri klasörü:', DATA_DIR)
    app.run(debug=True, host='0.0.0.0', port=5050)
