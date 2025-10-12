# Gelişmiş Arama ve Dosya Vurgulama Özellikleri

## 🎯 Yeni Özellikler

### 1. Aktif Dosya Vurgulama

#### Görsel İyileştirmeler
- **Büyük boyutlu seçici** - Dosya seçimi artık daha belirgin (Large size)
- **Kalın yazı tipi** - Aktif dosya adı bold gösteriliyor
- **Mavi renk vurgusu** - Seçili dosya mavi renkle vurgulanıyor
- **Animasyonlu parıltı** - Pulse glow animasyonu (2 saniye döngü)
- **Renkli ikon** - Mavi arka planlı ikon
- **Kalın border** - 2px kalınlığında mavi çerçeve
- **Box shadow** - 3-5px genişliğinde ışıltılı gölge

#### CSS Animasyon
```css
@keyframes pulseGlow {
  0%, 100% { box-shadow: 0 0 0 3px rgba(13, 110, 253, 0.25); }
  50% { box-shadow: 0 0 0 5px rgba(13, 110, 253, 0.35); }
}
```

#### Durum Gösterimi
```
✓ dosya_adi.json yüklendi ve aktif
```
Yeşil renkli onay işareti ile beraber dosya durumu gösteriliyor.

---

### 2. İki Ayrı Arama Sistemi

#### A) Aktif Dosyada Arama (Yeşil)

**Konum:** Sağ üst, ilk arama kutusu

**Görsel Özellikler:**
- 🟢 **Yeşil ikon** - Tekil dosya araması
- **Placeholder:** "Bu dosyada ara..."
- **Alt bilgi:** "📄 Sadece aktif dosya"

**Çalışma Prensibi:**
- DataTables filtreleme kullanır
- Gerçek zamanlı arama (her tuş vuruşunda)
- Sadece o an açık olan JSON dosyasında arar
- Hem sorularda hem cevaplarda arar
- Sonuçlar tabloda filtrelenir

**Kullanım:**
1. Arama kutusuna yazın
2. Tablo otomatik filtrelenir
3. "X" butonuyla temizleyin

---

#### B) Tüm Dosyalarda Arama (Sarı/Turuncu)

**Konum:** Sağ üst, ikinci arama kutusu

**Görsel Özellikler:**
- 🟡 **Sarı/Turuncu ikon** - Çoklu dosya simgesi
- **İki ikon birlikte:** 🔍📚 (Arama + Dosyalar)
- **Placeholder:** "Tüm dosyalarda ara..."
- **Alt bilgi:** "📚 Tüm JSON dosyaları"

**Çalışma Prensibi:**
1. **Debounce:** 500ms gecikme (performans için)
2. **Minimum karakter:** 2 karakter gerekli
3. **Paralel arama:** Tüm dosyalar aynı anda aranır
4. **Akıllı eşleşme:** Case-insensitive arama
5. **Sonuç toplama:** Tüm eşleşmeler toplanır
6. **Highlight:** Eşleşen kelimeler vurgulanır

**Sonuç Paneli Özellikleri:**
- Animasyonlu açılış (slideDown)
- Maksimum yükseklik 400px, scroll yapılabilir
- Her sonuç için detaylı kart görünümü
- Toplam sonuç sayısı badge ile gösterilir

---

### 3. Global Arama Sonuç Kartları

Her arama sonucu için özel tasarlanmış kartlar:

#### Kart Yapısı

```
┌─────────────────────────────────────────────┐
│ 📁 dosya_adi.json        Kayıt #5          │
│                            [Dosyayı Aç] ─────┼─► Tıklayınca o dosyaya gider
├─────────────────────────────────────────────┤
│ ❓ Eşleşen Sorular:                         │
│   → Soru 1 ile <highlight>arama</highlight> │
│   → Soru 2                                  │
│                                              │
│ 💬 Cevap:                                    │
│   Bu cevap <highlight>arama</highlight> kelimesini│
│   içeriyor...                                │
│   📝 250 karakter                            │
└─────────────────────────────────────────────┘
```

#### Kart Özellikleri

**Başlık Bölümü:**
- **Dosya rozeti:** Turuncu gradient, dosya adı
- **Kayıt numarası:** Gri rozet
- **Dosyayı Aç butonu:** Mavi, sağ üstte

**İçerik Bölümü:**
- **Sarı border:** Sol tarafta 3px kalınlığında
- **Gri arka plan:** #f8f9fa
- **Soru listesi:** Ok işaretli liste formatı
- **Cevap önizleme:** İlk 200 karakter
- **Karakter sayısı:** Altında küçük bilgi

**Hover Efekti:**
- Border rengi turuncuya döner
- Hafif sağa kayar (4px)
- Turuncu gölge efekti

---

### 4. Akıllı "Dosyayı Aç" Özelliği

Kullanıcı bir sonuçtaki "Dosyayı Aç" butonuna tıkladığında:

**Adım 1: Dosya Değiştirme**
```javascript
$('#fileSelect').val(file).trigger('change');
```
- Otomatik olarak o dosyaya geçer
- Tablo yeniden yüklenir

**Adım 2: Sayfa ve Satır Bulma**
```javascript
const page = Math.floor(index / qaTable.page.len());
qaTable.page(page).draw(false);
```
- Kayıt hangi sayfadaysa o sayfaya gider
- Sayfa yeniden çizilir

**Adım 3: Satır Vurgulama**
```javascript
$row.addClass('table-warning');
$row[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
```
- İlgili satır **sarı** ile vurgulanır
- Smooth scroll ile ekranın ortasına gelir
- 2 saniye sonra vurgu kaybolur

**Adım 4: Arama Paneli Kapanır**
- Global arama paneli otomatik kapanır
- Arama kutusu temizlenir

---

### 5. Highlight (Vurgulama) Sistemi

#### Sarı Arka Plan
Arama terimi bulunduğunda:
```html
<span class="match-highlight">aranan kelime</span>
```

**CSS:**
```css
.match-highlight {
  background: #fff3cd;  /* Açık sarı */
  padding: 2px 4px;
  border-radius: 3px;
  font-weight: 600;      /* Kalın yazı */
}
```

#### Akıllı Eşleşme
- Case-insensitive (büyük/küçük harf duyarsız)
- İlk eşleşmeyi bulur
- Öncesi ve sonrası korunur
- XSS güvenliği (esc fonksiyonu)

---

## 🎨 Renk Kodları

| Özellik | Renk | Hex | Kullanım |
|---------|------|-----|----------|
| Aktif Dosya Border | Mavi | #0d6efd | Dosya seçici çerçevesi |
| Aktif Dosya Glow | Açık Mavi | rgba(13,110,253,0.25) | Parıltı animasyonu |
| Lokal Arama İkon | Yeşil | #198754 | Tek dosya araması |
| Global Arama İkon | Turuncu | #ffc107 | Çoklu dosya araması |
| Dosya Rozeti | Turuncu Gradient | #ffc107 → #ff9800 | Dosya adı rozeti |
| Highlight Arka Plan | Açık Sarı | #fff3cd | Eşleşen kelime vurgusu |
| Satır Vurgusu | Sarı | table-warning | Bulunan satır |

---

## 🔍 Kullanım Senaryoları

### Senaryo 1: Hızlı Arama (Aktif Dosya)

```
Kullanıcı: "başvuru" kelimesini arıyor
         ↓
1. Yeşil arama kutusuna "başvuru" yaz
2. Tablo anında filtreler
3. 3 sonuç gösterilir
4. Sonuçlarda "başvuru" kelimesi görünür
```

**Süre:** ~100ms (anlık)

---

### Senaryo 2: Kapsamlı Arama (Tüm Dosyalar)

```
Kullanıcı: "ders kayıt" kelimesini TÜM dosyalarda arıyor
         ↓
1. Turuncu arama kutusuna "ders kayıt" yaz
2. 500ms bekle (debounce)
3. Tüm 15 JSON dosyası paralel aranır
4. Loading spinner gösterilir
5. 23 sonuç bulunur
6. Sonuçlar kartlarda listelenir
7. Her kartta dosya adı ve kayıt # gösterilir
8. "ders kayıt" kelimeleri sarı vurgulu
```

**Süre:** ~2-3 saniye (dosya sayısına göre)

---

### Senaryo 3: Dosyaya Atlama

```
Kullanıcı: Global aramada "öğrenci.json #12" kaydını buldu
         ↓
1. "Dosyayı Aç" butonuna tıkla
2. Dosya seçici "öğrenci.json" olarak değişir
3. Tablo yeniden yüklenir
4. Sayfa otomatik #12 kaydına gider
5. #12 satırı sarıya döner
6. Ekran yumuşakça kaydırılır
7. 2 saniye sonra vurgu kaybolur
8. Arama paneli kapanır
```

**Süre:** ~1.5 saniye (animasyonlu)

---

## 📊 Performans Optimizasyonları

### 1. Debounce (500ms)
```javascript
clearTimeout(globalSearchTimeout);
globalSearchTimeout = setTimeout(() => {
  performGlobalSearch(query);
}, 500);
```
**Fayda:** Gereksiz API çağrılarını engeller

### 2. Minimum 2 Karakter
```javascript
if (query.length < 2) {
  $('#globalSearchResults').slideUp();
  return;
}
```
**Fayda:** Çok genel aramaları engeller

### 3. Paralel Dosya Yükleme
```javascript
allFiles.forEach(filename => {
  $.get(`/admin/api/items?file=${filename}`, ...)
});
```
**Fayda:** Tüm dosyalar aynı anda yüklenir

### 4. İlk 200 Karakter Önizleme
```javascript
esc(answer.substring(0, 200))
```
**Fayda:** DOM boyutu küçük kalır

---

## 🛠️ Teknik Detaylar

### JavaScript Fonksiyonlar

1. **performGlobalSearch(query)**
   - Tüm dosyalarda paralel arama
   - Promise tabanlı
   - Error handling

2. **displayGlobalSearchResults(results, query)**
   - Sonuçları render eder
   - HTML oluşturur
   - Event listener'ları bağlar

3. **highlightMatch(text, query)**
   - Kelime vurgulama
   - XSS güvenli
   - Case-insensitive

4. **updateQaStats(data)**
   - İstatistik güncelleme
   - Dosya durumu gösterimi
   - Gelişmiş dosya bilgisi

### Event Handlers

```javascript
// Lokal arama
$('#qaSearchInput').on('input', ...)
$('#clearQaSearch').on('click', ...)

// Global arama  
$('#globalQaSearchInput').on('input', ...)
$('#clearGlobalQaSearch').on('click', ...)
$('#closeGlobalSearch').on('click', ...)

// Dosyaya atlama
$('.load-file-btn').on('click', ...)
```

---

## 🎬 Animasyonlar

### 1. Pulse Glow (Aktif Dosya)
- **Süre:** 2 saniye
- **Döngü:** Sonsuz
- **Etki:** Box-shadow büyüyüp küçülür

### 2. SlideDown/SlideUp (Arama Paneli)
- **Süre:** jQuery default (~400ms)
- **Etki:** Yumuşak açılma/kapanma

### 3. Smooth Scroll (Satıra Gitme)
- **Behavior:** smooth
- **Block:** center
- **Etki:** Animasyonlu kaydırma

### 4. Hover Transform (Arama Kartları)
- **Süre:** 0.2s
- **Etki:** 4px sağa kayma + gölge

---

## 💡 Kullanıcı İpuçları

### ✅ İyi Pratikler

1. **Hızlı aramalar için:** Yeşil kutuyu kullanın
2. **Kapsamlı aramalar için:** Turuncu kutuyu kullanın
3. **Minimum 2 karakter:** Daha iyi sonuçlar
4. **Dosyayı Aç butonu:** Hızlı navigasyon
5. **500ms bekleyin:** Global arama için

### ❌ Kaçınılması Gerekenler

1. ~~Tek karakter arama~~
2. ~~Çok hızlı yazma~~ (debounce var)
3. ~~Her iki kutuyu birden kullanma~~

---

## 🔮 Gelecek İyileştirmeler (Opsiyonel)

1. **Regex desteği** - Gelişmiş arama pattern'leri
2. **Fuzzy search** - Yaklaşık eşleşme
3. **Arama geçmişi** - Son aramalar
4. **Favori aramalar** - Kayıtlı pattern'ler
5. **Export sonuçları** - Arama sonuçlarını dışa aktar
6. **Highlight rengi seçimi** - Kullanıcı tercihi
7. **Arama istatistikleri** - Hangi dosyada kaç sonuç
8. **Gelişmiş filtreler** - Tarih, karakter sayısı vs.

---

## 📝 Özellik Karşılaştırması

| Özellik | Lokal Arama | Global Arama |
|---------|-------------|--------------|
| **İkon Rengi** | 🟢 Yeşil | 🟡 Turuncu |
| **Arama Kapsamı** | Tek dosya | Tüm dosyalar |
| **Hız** | Anlık | 2-3 saniye |
| **Debounce** | Yok | 500ms |
| **Sonuç Gösterimi** | Tablo filtresi | Ayrı panel |
| **Highlight** | DataTables | Custom CSS |
| **Dosya Geçişi** | Manuel | Otomatik |
| **Minimum Karakter** | 0 | 2 |
| **Loading Göstergesi** | Yok | Spinner |
| **Sonuç Sayısı** | DataTables info | Badge |

---

## 🎯 Sonuç

Bu iki yeni özellik sayesinde:

✨ **Aktif dosya artık çok belirgin** - Hangi dosyada çalıştığınız her zaman belli
🔍 **İki seviyeli arama** - Hem hızlı hem kapsamlı arama mümkün
🎨 **Profesyonel görünüm** - Animasyonlar ve renklerle modern UX
⚡ **Yüksek performans** - Debounce ve paralel yükleme
🎯 **Kolay navigasyon** - Dosyayı aç özelliği ile hızlı geçiş

Kullanıcılar artık hem aktif dosyada hızlıca arama yapabilir, hem de tüm dosyalarda kapsamlı araştırma yapabilir!

