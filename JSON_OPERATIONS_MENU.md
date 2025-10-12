# JSON İşlemleri Menüsü ve Dosya Silme Özelliği

## 🎯 Yapılan Değişiklikler

### 1. Arayüz Yeniden Düzenlendi

#### Önceki Durum ❌
```
Üst başlıkta: [Yeni Dosya] [İçe Aktar] [Dışa Aktar]
Alt toolbar'da: [Yeni Ekle] [Toplu Ekle] [Birleştir]
```
**Problem:** Çok fazla buton, karışık görünüm

#### Yeni Durum ✅
```
Üst başlıkta: [⚙️ JSON İşlemleri ▼]
Alt toolbar'da: [✅ Yeni Kayıt Ekle] [✅ Toplu Kayıt Ekle]
```
**Avantaj:** Temiz, organize, anlaşılır

---

## 🎨 Yeni "JSON İşlemleri" Dropdown Menüsü

### Görünüm

```
┌─────────────────────────────────────┐
│  ⚙️ JSON İşlemleri ▼                │ ← Dropdown butonu
└─────────────────────────────────────┘
           ↓ Tıklayınca açılır
┌─────────────────────────────────────┐
│  📁 DOSYA İŞLEMLERİ                 │
│  ───────────────────────────────    │
│  ✅ Yeni JSON Dosyası               │
│  🗑️ Aktif Dosyayı Sil              │
│                                      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│                                      │
│  ↔️ VERİ AKTARIMI                   │
│  ───────────────────────────────    │
│  🔀 Dosyaları Birleştir            │
│  📥 JSON İçe Aktar                 │
│  📤 JSON Dışa Aktar                │
└─────────────────────────────────────┘
```

### Özellikler

#### Dropdown Butonu
- **İkon:** ⚙️ (Dişli)
- **Metin:** "JSON İşlemleri"
- **Boyut:** Küçük (sm)
- **Renk:** Beyaz (btn-light)
- **Hover efekti:** Gri arka plan + yukarı kayma
- **Shadow:** Hafif gölge efekti

#### Menü İçeriği
**2 Bölüm:**

1. **Dosya İşlemleri**
   - Yeni JSON Dosyası (yeşil ✅)
   - Aktif Dosyayı Sil (kırmızı 🗑️)

2. **Veri Aktarımı**
   - Dosyaları Birleştir (mavi 🔀)
   - JSON İçe Aktar (cyan 📥)
   - JSON Dışa Aktar (sarı 📤)

#### Hover Animasyonu
```css
Normal:    [  İşlem adı ]
Hover:     [    İşlem adı ] → 4px sağa kayar + gri arka plan
```

---

## 🗑️ Yeni Özellik: JSON Dosyası Silme

### Çalışma Akışı

```
1. "JSON İşlemleri" menüsünden "Aktif Dosyayı Sil" seçilir
         ↓
2. Uyarı modalı açılır
         ↓
3. Dosya adı ve içerik bilgisi gösterilir
         ↓
4. Kullanıcı dosya adını tam olarak yazmalı (güvenlik)
         ↓
5. "Evet, Sil" butonu aktif olur
         ↓
6. Backend'e DELETE isteği gönderilir
         ↓
7. Dosya fiziksel olarak silinir
         ↓
8. Dosya listesi yenilenir
         ↓
9. Bir sonraki dosya otomatik seçilir
```

### Silme Modalı

#### Başlık (Kırmızı)
```
⚠️ JSON Dosyasını Sil
```

#### Uyarı Kutusu
```
┌──────────────────────────────────────────┐
│ 🛑 DİKKAT: Bu işlem geri alınamaz!      │
│                                           │
│ Dosyayı sildiğinizde içindeki tüm       │
│ soru-cevap kayıtları kalıcı olarak       │
│ silinecektir.                            │
└──────────────────────────────────────────┘
```

#### Dosya Bilgisi
```
┌──────────────────────────────────────────┐
│ 🗑️ Silinecek Dosya:                     │
│                                           │
│  ┌────────────────────────────────┐     │
│  │  ornek_dosya.json              │     │
│  └────────────────────────────────┘     │
│                                           │
│  ℹ️ Dosya içeriği: 45 kayıt             │
└──────────────────────────────────────────┘
```

#### Onay Input'u
```
Onaylamak için dosya adını yazın:
┌────────────────────────────────────┐
│  ornek_dosya.json                  │ ← Tam olarak eşleşmeli
└────────────────────────────────────┘
Silmek için yukarıdaki dosya adını tam olarak yazmalısınız.
```

#### Butonlar
```
[İptal]  [Evet, Sil] ← Eşleşme yoksa disabled
```

---

## 🔒 Güvenlik Özellikleri

### 1. Dosya Adı Doğrulama
```javascript
$('#deleteFileConfirmInput').on('input', function() {
  const input = $(this).val();
  const isMatch = input === deleteFileTarget;
  $('#deleteFileConfirmBtn').prop('disabled', !isMatch);
});
```

**Mantık:** 
- Kullanıcı dosya adını **TAM OLARAK** yazmalı
- Bir karakter bile yanlışsa buton disabled kalır
- Eşleşme yoksa uyarı gösterilir

### 2. Varsayılan Dosya Koruması (Backend)
```python
if file_path.name == DEFAULT_QA_FILE:
    return jsonify({
        'error': 'Forbidden',
        'message': 'Varsayılan dosya silinemez.'
    }), 403
```

**Mantık:**
- `qna.json` (varsayılan dosya) silinemez
- 403 Forbidden hatası döner
- Sistem her zaman en az 1 dosya ile çalışır

### 3. Yetki Kontrolü
```python
if not _has_qna_access():
    return _unauthorized()
```

**Mantık:**
- Sadece Admin veya Editor rolü silebilir
- Yetkisiz kullanıcılara 401 Unauthorized

---

## 🎬 Kullanıcı Deneyimi

### Senaryo: Dosya Silme

**Adım 1:** "JSON İşlemleri" butonuna tıkla
```
⚙️ JSON İşlemleri ▼
```

**Adım 2:** "Aktif Dosyayı Sil" seçeneğine tıkla
```
🗑️ Aktif Dosyayı Sil
```

**Adım 3:** Modal açılır, dosya bilgilerini gör
```
Dosya: test_data.json
İçerik: 23 kayıt
```

**Adım 4:** Güvenlik için dosya adını yaz
```
test_data.json ← Tam eşleşme gerekli
```

**Adım 5:** "Evet, Sil" butonuna tıkla
```
[Evet, Sil] ← Artık aktif
```

**Adım 6:** Silme işlemi gerçekleşir
```
✅ Dosya başarıyla silindi!
```

**Adım 7:** Otomatik olarak:
- Modal kapanır
- Dosya listesi yenilenir
- Sonraki dosya seçilir
- Tablo yeni dosyayı gösterir

---

## 🔧 Backend API

### Endpoint

```
DELETE /admin/api/files/<filename>
```

### Parametreler

- **filename** (path parameter): Silinecek dosya adı (örn: `test.json`)

### Response

#### Başarılı (200)
```json
{
  "success": true,
  "message": "test.json başarıyla silindi.",
  "deleted_file": "test.json"
}
```

#### Dosya Bulunamadı (404)
```json
{
  "error": "Not Found",
  "message": "Dosya bulunamadı."
}
```

#### Varsayılan Dosya (403)
```json
{
  "error": "Forbidden",
  "message": "Varsayılan dosya silinemez."
}
```

#### Yetkisiz (401)
```json
{
  "error": "Unauthorized",
  "message": "Bu işlem için yetkiniz yok."
}
```

#### Sunucu Hatası (500)
```json
{
  "error": "Internal Server Error",
  "message": "Dosya silinirken hata: ..."
}
```

---

## 📊 Buton Durumları

### Enable/Disable Mantığı

| Buton | Gereksinim | Durum |
|-------|------------|-------|
| **JSON İşlemleri Dropdown** | QA Access | ✅ Yoksa disabled |
| **Yeni JSON Dosyası** | QA Access | ✅ Yoksa disabled |
| **Aktif Dosyayı Sil** | QA Access + Dosya var + Seçili dosya | ✅ |
| **Dosyaları Birleştir** | QA Access + 2+ dosya | ✅ |
| **JSON İçe Aktar** | QA Access + Dosya var + Seçili | ✅ |
| **JSON Dışa Aktar** | Dosya var + Seçili | ✅ (Yetki gerekmez) |

### JavaScript Kontrolü

```javascript
function updateFileActionButtons() {
  const qaAccess = hasQaAccess();
  const fileCount = allFiles.length;
  const canSelect = fileCount > 0;
  
  $('#jsonOperationsDropdown').prop('disabled', !qaAccess);
  $('#deleteFileBtn').prop('disabled', !qaAccess || !canSelect || !currentFile);
  $('#exportJsonBtn').prop('disabled', !canSelect || !currentFile);
  // ... diğer butonlar
}
```

---

## 🎨 CSS Stilleri

### Dropdown Butonu
```css
#jsonOperationsDropdown {
  min-width: 150px;
  font-weight: 600;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

#jsonOperationsDropdown:hover {
  background-color: #e9ecef !important;
  transform: translateY(-1px);
  box-shadow: 0 3px 6px rgba(0,0,0,0.15);
}
```

### Dropdown Menüsü
```css
.dropdown-menu {
  min-width: 280px;
  padding: 0.5rem 0;
}

.dropdown-item {
  padding: 0.75rem 1.5rem;
  transition: all 0.2s ease;
}

.dropdown-item:hover {
  background-color: #f8f9fa;
  padding-left: 2rem; /* Sağa kayma */
}
```

### Dropdown Başlıkları
```css
.dropdown-header {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #6c757d;
  font-weight: 700;
}
```

---

## 🚀 Avantajlar

### Önceki Durum
❌ Çok fazla buton üst başlıkta
❌ Karışık görünüm
❌ Dosya silme özelliği yok
❌ Ne yapacağınız hemen belli değil

### Yeni Durum
✅ Temiz ve organize arayüz
✅ Tüm dosya işlemleri tek menüde
✅ Kayıt ekleme ayrı ve net
✅ Güvenli dosya silme
✅ Renkli ikonlarla kolay tanıma
✅ Hover animasyonları
✅ Profesyonel görünüm

---

## 📝 Kullanım İpuçları

### İşlem Türlerine Göre

#### Kayıt İşlemleri (Yeşil)
```
✅ Yeni Kayıt Ekle      → Tek kayıt ekler
✅ Toplu Kayıt Ekle     → Çoklu kayıt ekler
```
**Hedef:** Aktif dosyaya kayıt eklemek

#### Dosya İşlemleri (Dropdown)
```
✅ Yeni JSON Dosyası    → Boş dosya oluştur
🗑️ Aktif Dosyayı Sil   → Dosyayı sil
```
**Hedef:** Dosya oluşturma/silme

#### Veri Aktarımı (Dropdown)
```
🔀 Dosyaları Birleştir  → İki dosyayı birleştir
📥 JSON İçe Aktar       → Dışarıdan veri al
📤 JSON Dışa Aktar      → Veriyi dışarı ver
```
**Hedef:** Dosyalar arası veri transferi

---

## 🔮 Gelecek İyileştirmeler (Opsiyonel)

1. **Geri Alma (Undo)** - Silinen dosyayı geri getir (çöp kutusu)
2. **Dosya Yeniden Adlandır** - Dropdown'a eklenebilir
3. **Dosya Kopyala** - Hızlı kopya oluştur
4. **Toplu Silme** - Birden fazla dosya seç ve sil
5. **Yedekleme** - Silmeden önce otomatik yedek
6. **Silme Geçmişi** - Son silinen dosyalar listesi
7. **Dosya Özellikleri** - Boyut, oluşturma tarihi, vs.
8. **Favori İşaretleme** - Önemli dosyaları işaretle

---

## 📄 Dosyalar

### Değiştirilen Dosyalar
- ✅ `/opt/chatbot/templates/admin.html` - UI ve modal
- ✅ `/opt/chatbot/static/js/admin.js` - JavaScript logic
- ✅ `/opt/chatbot/app.py` - Backend API endpoint
- 📝 `/opt/chatbot/JSON_OPERATIONS_MENU.md` - Bu dokümantasyon

### Yeni Eklenen Kodlar
- **HTML:** Delete modal + dropdown menü (130 satır)
- **CSS:** Dropdown stilleri (50 satır)
- **JavaScript:** Delete fonksiyonları (110 satır)
- **Python:** DELETE endpoint (30 satır)

---

## 🎉 Sonuç

Artık admin panelinde:
- 🧹 **Temiz arayüz** - Az buton, çok işlevsellik
- 📂 **Organize menü** - Tüm JSON işlemleri bir yerde
- 🗑️ **Güvenli silme** - Onay mekanizması ile
- 🎨 **Modern görünüm** - Renkli ikonlar ve animasyonlar
- 🔒 **Güvenlik** - Varsayılan dosya koruması
- ✨ **Kullanıcı dostu** - Net ve anlaşılır

Kullanıcılar artık JSON dosyalarını kolayca yönetebilir ve güvenle silebilir!

