# Kapadokya Üniversitesi Chatbot - Kapsamlı Kullanım Kılavuzu

**Versiyon:** Stabil RAG v3.3  
**Son Güncelleme:** 2024

Flask tabanlı, RAG (Retrieval-Augmented Generation) destekli ve SSE (Server-Sent Events) ile akışlı cevaplar veren gelişmiş bir sohbet uygulaması. Sunucu tarafı oturum yönetimi Redis ile yapılır; vektör arama için SentenceTransformers ve hibrit BM25 arama, yanıt üretimi için OpenAI kullanılır.

---

## 📋 İçindekiler

1. [Genel Bakış](#genel-bakış)
2. [Özellikler](#özellikler)
3. [Mimari ve Teknoloji](#mimari-ve-teknoloji)
4. [Kurulum Rehberi](#kurulum-rehberi)
   - [Yerel Geliştirme Ortamı](#yerel-geliştirme-ortamı)
   - [Sunucuya Kurulum](#sunucuya-kurulum)
5. [Yapılandırma](#yapılandırma)
6. [Kullanıcı Kılavuzu](#kullanıcı-kılavuzu)
7. [Admin Panel Kılavuzu](#admin-panel-kılavuzu)
8. [Geliştirici Kılavuzu](#geliştirici-kılavuzu)
9. [RAG Sistemi Detayları](#rag-sistemi-detayları)
10. [Sorun Giderme](#sorun-giderme)

---

## 🎯 Genel Bakış

Bu chatbot uygulaması, Kapadokya Üniversitesi öğrencilerine soru-cevap desteği sağlamak için geliştirilmiştir. Sistem, önceden tanımlanmış soru-cevap veritabanından en uygun cevapları bulmak için hibrit arama (vektör + keyword) kullanır ve OpenAI GPT modelleri ile doğal dil işleme yapar.

### Temel Yetenekler

- **Akıllı Arama:** Hibrit RAG sistemi (vektör benzerliği + BM25 keyword arama)
- **Akışlı Yanıtlar:** SSE ile gerçek zamanlı token bazlı cevap üretimi
- **Çoklu Kişilik:** Farklı kişilik modları (huysuz, nötr, pozitif)
- **Oturum Yönetimi:** Redis tabanlı sunucu tarafı session yönetimi
- **Admin Paneli:** Kapsamlı yönetim ve analitik araçları
- **Loglama ve Analitik:** Detaylı sohbet logları ve istatistikler

---

## ✨ Özellikler

### Kullanıcı Özellikleri

- **Akışlı Sohbet:** Mesajlar token token gerçek zamanlı olarak görüntülenir
- **Kişilik Değiştirme:** Sohbet sırasında `/huysuz`, `/notr`, `/pozitif` komutlarıyla kişilik değiştirilebilir
- **Sohbet Geçmişi:** Tüm sohbetler oturum bazında saklanır ve görüntülenebilir
- **Yeni Sohbet:** İstediğiniz zaman yeni bir sohbet başlatabilirsiniz
- **Geri Bildirim:** Cevapları beğenme/beğenmeme ile değerlendirebilirsiniz

### Admin Özellikleri

- **Soru-Cevap Yönetimi:** JSON dosyalarından soru-cevap çiftlerini ekleme, düzenleme, silme
- **Kişilik Yönetimi:** Kişilikleri oluşturma, düzenleme, avatar yükleme
- **Sistem Promptu:** Temel sistem promptunu özelleştirme
- **Model Yönetimi:** OpenAI model seçimi ve parametre ayarları (temperature, top_p)
- **Log Analizi:** Detaylı sohbet logları, filtreleme, arama
- **İstatistikler:** Mesaj sayıları, geri bildirimler, sezon bazlı analizler
- **Dosya Yönetimi:** Birden fazla JSON dosyası ile çalışma ve birleştirme

### Teknik Özellikler

- **Hibrit Arama:** %70 vektör benzerliği + %30 BM25 keyword arama
- **Dinamik Eşik:** Soru uzunluğuna göre otomatik benzerlik eşiği hesaplama
- **Akıllı Özetleme:** Uzun sohbetlerde otomatik özetleme
- **Embedding Önbelleği:** Bz2 sıkıştırmalı önbellek sistemi
- **Güvenlik:** Şifre korumalı admin panel, Redis güvenliği

---

## 🏗️ Mimari ve Teknoloji

### Backend Stack

- **Framework:** Flask 2.3.0+
- **Session:** Flask-Session (Redis backend)
- **CORS:** flask-cors
- **LLM:** OpenAI API (Chat Completions, streaming)
- **Embedding:** sentence-transformers (intfloat/multilingual-e5-base)
- **Arama:** scikit-learn (cosine similarity) + rank_bm25 (BM25)
- **Cache:** bz2 sıkıştırmalı pickle dosyası
- **Lock:** filelock (çoklu işlem güvenliği)

### Frontend Stack

- **UI:** Bootstrap 5 + jQuery
- **SSE:** EventSource API
- **Charts:** Chart.js (analitik için)

### Veri Yapıları

- **Soru-Cevap:** `data/*.json` (JSON array formatı)
- **Kişilikler:** `static/config/personalities.json`
- **Sistem Promptu:** `static/config/system_prompt.json`
- **Model Config:** `static/config/openai_model.json`
- **Loglar:** `chat_logs/<session_id>/chat_log_<user_id>.json`
- **Analitik:** `analytics/events_YYYYMMDD.ndjson`

---

## 🚀 Kurulum Rehberi

### Yerel Geliştirme Ortamı

#### Adım 1: Önkoşullar

```bash
# Python 3.10+ gereklidir
python3 --version

# Redis kurulumu (Ubuntu/Debian)
sudo apt-get update
sudo apt-get install redis-server

# Redis'i başlatın
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Redis test
redis-cli ping
# Çıktı: PONG
```

#### Adım 2: Proje Klonlama ve Sanal Ortam

```bash
# Proje dizinine gidin
cd /opt/chatbot

# Sanal ortam oluşturun
python3 -m venv .venv

# Sanal ortamı aktifleştirin
source .venv/bin/activate  # Linux/Mac
# veya
.venv\Scripts\activate  # Windows

# pip'i güncelleyin
pip install --upgrade pip
```

#### Adım 3: Bağımlılıkları Kurun

```bash
pip install -r requirements.txt
```

**Kurulan Paketler:**
- flask>=2.3.0
- flask-cors>=4.0.0
- Flask-Session>=0.5.0
- python-dotenv>=1.0.0
- openai==1.12.0
- numpy>=1.21.0
- sentence-transformers>=2.2.0
- scikit-learn>=1.0.0
- redis>=4.0.0
- gunicorn>=20.1.0
- rank_bm25 (BM25 arama için)

#### Adım 4: Çevre Değişkenlerini Ayarlayın

`.env` dosyası oluşturun:

```bash
cd /opt/chatbot
nano .env
```

**Zorunlu Değişkenler:**

```env
# OpenAI API anahtarı (mutlaka gerekli)
OPENAI_API_KEY=sk-...

# Redis bağlantı URL'i (mutlaka gerekli)
REDIS_URL=redis://localhost:6379/0
# veya şifreli Redis için:
REDIS_URL=redis://:parolanız@127.0.0.1:6379/0

# Admin panel şifresi (mutlaka gerekli - ADMIN_PASSWORD veya APP_PASSWORD)
ADMIN_PASSWORD=güvenli-şifre-buraya
# veya
APP_PASSWORD=güvenli-şifre-buraya

# Flask secret key (güvenlik için önerilir)
FLASK_SECRET_KEY=rastgele-uzun-string-buraya
```

**İsteğe Bağlı Değişkenler:**

```env
# OpenAI model ayarları
OPENAI_MODEL=gpt-4.1-mini
OPENAI_SUMMARY_MODEL=gpt-4.1-mini  # Özetleme için farklı model
OPENAI_REQUEST_TIMEOUT=30
OPENAI_MAX_RETRIES=2
OPENAI_TEMPERATURE=0.75
OPENAI_TOP_P=0.9

# Embedding model ayarları
MODEL_NAME=intfloat/multilingual-e5-base
MODEL_PATH=  # Yerel model dizini (varsa)

# Kişilik ayarları
DEFAULT_PERSONALITY=huysuz  # huysuz, notr, pozitif

# Avatar ayarları
AVATAR_MAX_BYTES=2097152  # 2MB (byte cinsinden)

# Editor şifresi (opsiyonel, sadece soru-cevap düzenleme için)
EDITOR_PASSWORD=editor-şifresi
```

#### Adım 5: Veri Dosyalarını Hazırlayın

`data/` dizininde JSON dosyaları oluşturun:

**Örnek: `data/expanded_data.json`**

```json
[
  {
    "question": "Kayıt ne zaman başlıyor?",
    "answer": "Kayıt işlemleri her akademik yıl başında başlar. Detaylı tarihler için öğrenci işlerine başvurabilirsiniz."
  },
  {
    "questions": [
      "Burs başvurusu nasıl yapılır?",
      "Burs için nereye başvurmalıyım?"
    ],
    "answer": "Burs başvuruları için öğrenci işleri bölümüne başvurmanız gerekmektedir. Gerekli belgeleri hazırlayarak başvuru yapabilirsiniz."
  }
]
```

**Format Kuralları:**
- Her öğe bir JSON objesi olmalı
- `question` (string) veya `questions` (array) alanı olmalı
- `answer` (string) alanı zorunlu
- Dosya bir JSON array olmalı

#### Adım 6: Uygulamayı Başlatın

**Geliştirme Modu:**

```bash
python app.py
```

Uygulama `http://localhost:5000` adresinde çalışacaktır.

**Üretim Modu (Gunicorn):**

```bash
gunicorn -w 2 -k gthread --threads 8 -b 0.0.0.0:5000 app:app
```

**Parametreler:**
- `-w 2`: 2 worker process
- `-k gthread`: Thread worker class
- `--threads 8`: Her worker için 8 thread
- `-b 0.0.0.0:5000`: Bind adresi ve port

---

### Sunucuya Kurulum

#### Otomatik Kurulum Scripti

Ubuntu 22.04+ için hazır kurulum scripti mevcuttur:

**Adım 1: Script'i Düzenleyin**

```bash
nano deploy/install_on_server.sh
```

Şu değerleri güncelleyin:
- `DOMAIN`: Alan adınız (örn: `asistan.kapadokya.edu.tr`)
- `EMAIL`: Let's Encrypt için e-posta adresiniz
- `APP_DIR`: Uygulama dizini (varsayılan: `/opt/chatbot`)

**Adım 2: Script'i Çalıştırın**

```bash
sudo bash deploy/install_on_server.sh
```

**Script'in Yaptığı İşlemler:**

1. ✅ Redis servisini etkinleştirir ve güvenli hale getirir
2. ✅ Python sanal ortamı oluşturur
3. ✅ Bağımlılıkları kurar (pip install)
4. ✅ `.env` şablonu oluşturur (yoksa)
5. ✅ Redis şifreleme ve güvenlik ayarlarını yapar
6. ✅ systemd servisi oluşturur (`kun-chatbot.service`)
7. ✅ Nginx konfigürasyonu yapar (SSE desteği ile)
8. ✅ Let's Encrypt TLS sertifikası kurar (certbot varsa)

**Adım 3: `.env` Dosyasını Doldurun**

```bash
sudo nano /opt/chatbot/.env
```

Tüm zorunlu değişkenleri doldurun (yukarıdaki "Çevre Değişkenlerini Ayarlayın" bölümüne bakın).

**Adım 4: Servisi Başlatın**

```bash
sudo systemctl start kun-chatbot.service
sudo systemctl enable kun-chatbot.service
sudo systemctl status kun-chatbot.service
```

**Adım 5: Nginx'i Test Edin ve Yeniden Yükleyin**

```bash
sudo nginx -t
sudo systemctl reload nginx
```

#### Manuel Kurulum

Script kullanmak istemiyorsanız:

**1. Nginx Konfigürasyonu**

`/etc/nginx/sites-available/chatbot.conf`:

```nginx
server {
    listen 80;
    server_name asistan.kapadokya.edu.tr;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # SSE için özel ayarlar
    location /chat {
        proxy_pass http://127.0.0.1:5000;
        proxy_buffering off;
        proxy_cache off;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
```

**2. systemd Servisi**

`/etc/systemd/system/kun-chatbot.service`:

```ini
[Unit]
Description=Kapadokya University Chatbot
After=network.target redis.service

[Service]
Type=notify
User=www-data
Group=www-data
WorkingDirectory=/opt/chatbot
Environment="PATH=/opt/chatbot/venv/bin"
ExecStart=/opt/chatbot/venv/bin/gunicorn -w 2 -k gthread --threads 8 -b 127.0.0.1:5000 app:app
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**3. Servisi Etkinleştirin**

```bash
sudo systemctl daemon-reload
sudo systemctl enable kun-chatbot.service
sudo systemctl start kun-chatbot.service
```

---

## ⚙️ Yapılandırma

### Çevre Değişkenleri Detayları

| Değişken | Zorunlu | Varsayılan | Açıklama |
|----------|---------|------------|----------|
| `OPENAI_API_KEY` | ✅ | - | OpenAI API anahtarı |
| `REDIS_URL` | ✅ | - | Redis bağlantı URL'i |
| `ADMIN_PASSWORD` veya `APP_PASSWORD` | ✅ | - | Admin panel şifresi |
| `FLASK_SECRET_KEY` | ❌ | Rastgele üretilir | Flask session güvenliği |
| `OPENAI_MODEL` | ❌ | `gpt-4.1-mini` | OpenAI chat modeli |
| `OPENAI_SUMMARY_MODEL` | ❌ | `OPENAI_MODEL` | Özetleme için model |
| `OPENAI_REQUEST_TIMEOUT` | ❌ | `30` | İstek zaman aşımı (saniye) |
| `OPENAI_MAX_RETRIES` | ❌ | `2` | Tekrar deneme sayısı |
| `OPENAI_TEMPERATURE` | ❌ | `0.75` | Model yaratıcılığı (0-2) |
| `OPENAI_TOP_P` | ❌ | `0.9` | Nucleus sampling (0-1) |
| `MODEL_NAME` | ❌ | `intfloat/multilingual-e5-base` | Embedding model adı |
| `MODEL_PATH` | ❌ | - | Yerel model dizini |
| `DEFAULT_PERSONALITY` | ❌ | `huysuz` | Varsayılan kişilik |
| `AVATAR_MAX_BYTES` | ❌ | `2097152` | Maksimum avatar boyutu (2MB) |
| `EDITOR_PASSWORD` | ❌ | - | Editor şifresi (sadece Q&A) |

### Dosya Yapısı

```
/opt/chatbot/
├── app.py                 # Ana uygulama dosyası
├── requirements.txt       # Python bağımlılıkları
├── .env                   # Çevre değişkenleri (oluşturulmalı)
├── README.md             # Bu dosya
├── data/                 # Soru-cevap JSON dosyaları
│   ├── expanded_data.json
│   ├── duyurular.json
│   └── ...
├── static/               # Statik dosyalar
│   ├── index.html        # Ana kullanıcı arayüzü
│   ├── js/               # JavaScript dosyaları
│   ├── config/           # Yapılandırma dosyaları
│   │   ├── personalities.json
│   │   ├── system_prompt.json
│   │   └── openai_model.json
│   └── avatars/          # Kişilik avatar dosyaları
├── templates/            # HTML şablonları
│   ├── admin.html        # Admin panel
│   └── analytics.html    # Analitik sayfası
├── chat_logs/            # Sohbet logları
│   └── <session_id>/
│       └── chat_log_<user_id>.json
├── analytics/            # Analitik verileri
│   └── events_YYYYMMDD.ndjson
├── embeddings.pkl.bz2    # Embedding önbelleği (otomatik oluşur)
└── deploy/               # Kurulum scriptleri
    └── install_on_server.sh
```

---

## 👤 Kullanıcı Kılavuzu

### İlk Kullanım

1. **Tarayıcıda Açın:** `http://localhost:5000` (veya sunucu adresiniz)
2. **Hoş Geldiniz Mesajı:** Chatbot sizi varsayılan kişilik ile karşılar
3. **Sorunuzu Yazın:** Mesaj kutusuna sorunuzu yazın ve Enter'a basın veya gönder butonuna tıklayın
4. **Akışlı Yanıt:** Cevap token token görüntülenir (SSE ile)

### Temel Özellikler

#### Soru Sorma

- Mesaj kutusuna sorunuzu yazın
- Enter tuşu veya gönder butonu ile gönderin
- Chatbot RAG sistemi ile en uygun cevabı bulur ve üretir

**Örnek Sorular:**
- "Kayıt ne zaman başlıyor?"
- "Burs başvurusu nasıl yapılır?"
- "Ders programını nereden görebilirim?"

#### Kişilik Değiştirme

Sohbet sırasında özel komutlar kullanarak kişiliği değiştirebilirsiniz:

- `/huysuz` - Huysuz ve agresif kişilik
- `/notr` - Nötr ve profesyonel kişilik
- `/pozitif` - Pozitif ve neşeli kişilik

**Kullanım:**
```
Kullanıcı: /huysuz
Chatbot: Kişiliği 'Huysuz Asistan' olarak ayarladım.
```

#### Yeni Sohbet Başlatma

- "Yeni Sohbet" butonuna tıklayın
- Veya `/new_chat` komutunu kullanın
- Önceki sohbet geçmişi temizlenir, yeni bir oturum başlar

#### Sohbet Geçmişi

- "Geçmiş" butonuna tıklayarak tüm sohbetlerinizi görebilirsiniz
- Her oturum ayrı ayrı listelenir
- İstediğiniz oturumu seçerek devam edebilirsiniz

#### Geri Bildirim Verme

Her cevabın altında 👍 (beğen) ve 👎 (beğenme) butonları vardır:

- **Beğen:** Cevabı beğendiğinizi belirtir
- **Beğenme:** Cevabı beğenmediğinizi belirtir

Geri bildirimler admin panelinde analiz edilir.

### Gelişmiş Özellikler

#### Çoklu Soru Sorma

Bir mesajda birden fazla soru sorabilirsiniz:

```
Kullanıcı: Kayıt ne zaman başlıyor ve burs başvurusu nasıl yapılır?
```

Chatbot her iki soruyu da cevaplayacaktır.

#### Bağlam Koruma

Chatbot sohbet bağlamını korur:

```
Kullanıcı: Kayıt ne zaman başlıyor?
Chatbot: [Kayıt tarihleri hakkında bilgi verir]

Kullanıcı: Hangi belgeler gerekiyor?
Chatbot: [Kayıt için gerekli belgeleri listeler - önceki bağlamı hatırlar]
```

#### Özetleme

Uzun sohbetlerde sistem otomatik olarak özetleme yapar:

- Belirli bir mesaj sayısı aşıldığında
- Önceki konuşmalar tek bir `[Özet]` mesajına indirgenir
- Bu sayede token kullanımı optimize edilir

---

## 🔧 Admin Panel Kılavuzu

### Giriş

1. **Admin Paneline Erişim:** `http://localhost:5000/admin` (veya sunucu adresiniz)
2. **Giriş Yap:** Sağ üstteki "Giriş Yap" butonuna tıklayın
3. **Şifre Girin:** `.env` dosyasında tanımlı `ADMIN_PASSWORD` veya `APP_PASSWORD` değerini girin
4. **Rol:** Admin veya Editor rolü ile giriş yapabilirsiniz

**Rol Farkları:**
- **Admin:** Tüm özelliklere erişim (kişilikler, sistem promptu, model ayarları, loglar)
- **Editor:** Sadece soru-cevap yönetimi (Q&A ekleme/düzenleme/silme)

### Sekmeler

Admin panel 4 ana sekmeye sahiptir:

1. **Soru-Cevap:** Q&A veritabanı yönetimi
2. **Chat Logları:** Sohbet logları ve analiz
3. **Dil Modelleri:** OpenAI model ayarları
4. **Kişilikler:** Kişilik yönetimi

---

### 1. Soru-Cevap Yönetimi

#### Dosya Seçimi

- Üst kısımdaki dropdown'dan çalışmak istediğiniz JSON dosyasını seçin
- Varsayılan dosya: `expanded_data.json`
- Birden fazla dosya ile çalışabilirsiniz

#### Yeni Soru-Cevap Ekleme

**Adım 1:** "Yeni Ekle" butonuna tıklayın

**Adım 2:** Formu doldurun:

- **Sorular:** 
  - Tek soru için: `"Kayıt ne zaman başlıyor?"`
  - Çoklu soru için: `["Kayıt ne zaman?", "Kayıt tarihleri nedir?"]`
- **Cevap:** `"Kayıt işlemleri her akademik yıl başında başlar..."`

**Adım 3:** "Kaydet" butonuna tıklayın

**Not:** Kayıt sonrası embedding önbelleği otomatik yenilenir.

#### Soru-Cevap Düzenleme

1. Tabloda düzenlemek istediğiniz satıra tıklayın
2. Açılan modalda değişiklikleri yapın
3. "Güncelle" butonuna tıklayın

#### Soru-Cevap Silme

1. Tabloda silmek istediğiniz satırın "Sil" butonuna tıklayın
2. Onaylayın
3. Embedding önbelleği otomatik yenilenir

#### Dosya İşlemleri

**Yeni Dosya Oluşturma:**

1. "Dosya Oluştur" butonuna tıklayın
2. Dosya adını girin (örn: `duyurular.json`)
3. İlk soru-cevap çiftini ekleyin

**Dosya Birleştirme:**

1. "Dosyaları Birleştir" butonuna tıklayın
2. Kaynak dosyayı seçin
3. Hedef dosyayı seçin
4. Onaylayın

**Dosya Silme:**

1. Dosya dropdown'ının yanındaki çöp kutusu ikonuna tıklayın
2. Onaylayın

**⚠️ Dikkat:** Dosya silme geri alınamaz!

---

### 2. Chat Logları

#### Oturum Listesi

- Tüm sohbet oturumları listelenir
- Her oturum için:
  - Oturum ID
  - Kullanıcı sayısı
  - Mesaj sayısı
  - İlk/ Son mesaj tarihleri

#### Filtreleme

**Tarih Aralığı:**
- Başlangıç ve bitiş tarihlerini seçin
- Tarih formatı: `YYYY-MM-DD`

**Sezon Filtresi:**
- Dropdown'dan sezon seçin (örn: `2024-2025`)
- Sadece seçili sezona ait loglar gösterilir

**Geri Bildirim Filtresi:**
- Tümü
- Beğenilenler
- Beğenilmeyenler
- Değerlendirilmemişler

#### Arama

**Geri Bildirime Göre Arama:**
- "Beğenilenler" veya "Beğenilmeyenler" sekmesine gidin
- Arama kutusuna anahtar kelime girin
- Sonuçlar filtrelenir

**Global Arama:**
- Tüm loglarda arama yapar
- Kullanıcı mesajları ve asistan cevaplarında arar
- Sonuçları vurgular

#### Log Detayları

Bir oturuma tıklayarak detayları görebilirsiniz:

- Kullanıcı mesajları
- Asistan cevapları
- Kullanılan kişilik
- RAG sonuçları (varsa)
- Geri bildirimler
- Zaman damgaları

#### Log Silme

- **Tekil Log:** Log detayında "Sil" butonuna tıklayın
- **Tüm Oturum:** Oturum listesinde oturumun yanındaki çöp kutusu ikonuna tıklayın

---

### 3. Dil Modelleri

#### Model Seçimi

1. "Model" dropdown'ından model seçin:
   - GPT-4.1
   - GPT-4.1 Mini (varsayılan)
   - GPT-4.1 Nano
   - GPT-5 Nano
   - GPT-5 Mini
   - GPT-5

2. "Kaydet" butonuna tıklayın

**Not:** Model değişikliği hemen etkili olur.

#### Parametre Ayarları

**Temperature (0.0 - 2.0):**
- Düşük (0.0-0.5): Daha tutarlı, öngörülebilir cevaplar
- Orta (0.5-1.0): Dengeli cevaplar
- Yüksek (1.0-2.0): Daha yaratıcı, çeşitli cevaplar
- **Varsayılan:** 0.75

**Top-P (0.0 - 1.0):**
- Nucleus sampling parametresi
- Düşük: Daha odaklı kelime seçimi
- Yüksek: Daha geniş kelime havuzu
- **Varsayılan:** 0.9

**Özetleme Modeli:**
- Özetleme için farklı bir model kullanabilirsiniz
- Varsayılan: Ana model ile aynı
- Örnek: Özetleme için daha küçük/ucuz model kullanımı

#### Varsayılana Dönme

"Varsayılana Dön" butonuna tıklayarak:
- Model: `gpt-4.1-mini`
- Temperature: `0.75`
- Top-P: `0.9`
değerlerine döner.

---

### 4. Kişilikler

#### Kişilik Listesi

Tüm kişilikler tabloda listelenir:
- ID (slug)
- İsim
- Tema (huysuz/nötr/pozitif)
- Durum (aktif/pasif)
- Avatar
- Varsayılan işareti

#### Yeni Kişilik Oluşturma

**Adım 1:** "Yeni Kişilik" butonuna tıklayın

**Adım 2:** Formu doldurun:

- **İsim:** `"Samimi Asistan"`
- **Prompt:** Kişiliğin davranışını tanımlayan sistem promptu
  ```
  Kapadokya Üniversitesinde çalışan, öğrencilere samimi ve yardımsever bir şekilde yaklaşan bir asistan olarak davranacaksın...
  ```
- **Hoş Geldiniz Mesajı:** `"Merhaba! Size nasıl yardımcı olabilirim?"`
- **Tema:** `neutral` (huysuz/nötr/pozitif)
- **Emoji:** (opsiyonel) `😊`
- **Aktif:** Evet/Hayır

**Adım 3:** "Kaydet" butonuna tıklayın

**Adım 4 (Opsiyonel):** Varsayılan yapmak için "Varsayılan Yap" butonuna tıklayın

#### Kişilik Düzenleme

1. Tabloda düzenlemek istediğiniz kişiliğe tıklayın
2. Modalda değişiklikleri yapın
3. "Güncelle" butonuna tıklayın

**⚠️ Dikkat:** Varsayılan kişilik pasif yapılamaz!

#### Avatar Yükleme

1. Kişilik düzenleme modalını açın
2. "Avatar Yükle" butonuna tıklayın
3. Dosya seçin (PNG, JPG, JPEG, GIF, WEBP, SVG)
4. Maksimum boyut: 2MB
5. "Yükle" butonuna tıklayın

**Avatar Silme:**
- Kişilik düzenleme modalında "Avatar'ı Sil" butonuna tıklayın

#### Kişilik Silme

1. Tabloda silmek istediğiniz kişiliğin "Sil" butonuna tıklayın
2. Onaylayın

**⚠️ Kısıtlamalar:**
- En az bir kişilik kalmalıdır
- Varsayılan kişilik silinemez
- Silinen kişilik varsayılan ise, ilk aktif kişilik varsayılan yapılır

#### Varsayılan Kişilik Ayarlama

1. Kişilik listesinde "Varsayılan Yap" butonuna tıklayın
2. Veya kişilik düzenleme modalında "Varsayılan Yap" checkbox'ını işaretleyin

**Not:** Varsayılan kişilik değiştiğinde, yeni kullanıcılar bu kişilik ile başlar.

---

### Sistem Promptu Yönetimi

**Erişim:** Admin panelinde "Sistem Promptu" sekmesi (bazı versiyonlarda)

**Düzenleme:**

1. Mevcut promptu görüntüleyin
2. Metin alanında düzenleyin
3. "Kaydet" butonuna tıklayın

**Sistem Promptu Örneği:**

```
Kapadokya Üniversitesinde bir öğrenci işleri çalışanı olarak, öğrencilere rehberlik etmek için buradasın.

Talimatlar:
• Kullanıcının iletisi sadece teşekkür/onay mesajı ise, kısa ve nazik bir cevap ver.
• Normal bir soruysa, öncelikle son kullanıcı iletisine odaklan.
• RAG sonuçları varsa, bunları kullanarak doğru cevaplar ver.
• Bilmediğin bir konuda tahmin yapma, öğrenci işlerine yönlendir.
```

---

### İstatistikler ve Analitik

#### Genel İstatistikler

Admin panel ana sayfasında gösterilir:

- **Toplam Mesaj:** Tüm zamanların toplam mesaj sayısı
- **Beğenilenler:** Pozitif geri bildirim sayısı
- **Beğenilmeyenler:** Negatif geri bildirim sayısı
- **Mevcut Sezon:** Otomatik hesaplanan akademik sezon

#### Sezon Bazlı Analiz

- Her akademik sezon için ayrı istatistikler
- Mesaj sayıları, geri bildirimler
- Dropdown'dan sezon seçerek filtreleme

#### Kişilik Bazlı Analiz

- Her kişilik için kullanım istatistikleri
- Hangi kişiliğin daha çok kullanıldığı
- Geri bildirim dağılımı

---

## 💻 Geliştirici Kılavuzu

### API Endpoints

#### Kullanıcı Endpoints

**`GET /`**
- Ana sayfa (statik HTML)
- Response: HTML

**`POST /chat`**
- SSE ile akışlı yanıt
- Request Body:
  ```json
  {
    "message": "Kayıt ne zaman başlıyor?"
  }
  ```
- Response: SSE stream
  ```
  data: {"content": "Kayıt", "done": false}
  data: {"content": " işlemleri", "done": false}
  ...
  data: {"content": "", "done": true}
  ```

**`GET /chat_history`**
- Mevcut oturumun geçmişi
- Response:
  ```json
  {
    "session_id": "...",
    "user_id": "...",
    "logs": [...]
  }
  ```

**`GET /all_sessions`**
- Kullanıcının tüm oturumları
- Response:
  ```json
  {
    "sessions": [
      {
        "session_id": "...",
        "user_id": "...",
        "message_count": 10,
        "first_message": "2024-01-01T10:00:00Z",
        "last_message": "2024-01-01T10:30:00Z"
      }
    ]
  }
  ```

**`POST /new_chat`**
- Yeni sohbet başlatır
- Response:
  ```json
  {
    "status": "ok",
    "session_id": "...",
    "user_id": "..."
  }
  ```

**`POST /set_personality`**
- Kişilik değiştirir
- Request Body:
  ```json
  {
    "personality": "huysuz"
  }
  ```
- Response:
  ```json
  {
    "status": "ok",
    "personality": "huysuz"
  }
  ```

**`POST /feedback`**
- Geri bildirim gönderir
- Request Body:
  ```json
  {
    "messageIndex": 0,
    "feedback": "like"
  }
  ```
- Response:
  ```json
  {
    "status": "ok"
  }
  ```

**`GET /api/personalities`**
- Aktif kişilikleri listeler
- Response:
  ```json
  {
    "personalities": [
      {
        "id": "huysuz",
        "name": "Huysuz Asistan",
        "theme": "angry",
        "welcome_message": "...",
        "avatar_url": "..."
      }
    ]
  }
  ```

#### Admin Endpoints

**Kimlik Doğrulama**

**`POST /admin/api/login`**
- Admin girişi
- Request Body:
  ```json
  {
    "password": "şifre"
  }
  ```
- Response:
  ```json
  {
    "authenticated": true,
    "role": "admin"
  }
  ```

**`POST /admin/api/logout`**
- Çıkış yapar
- Response:
  ```json
  {
    "logged_out": true
  }
  ```

**`GET /admin/api/auth_status`**
- Kimlik doğrulama durumu
- Response:
  ```json
  {
    "authenticated": true,
    "role": "admin"
  }
  ```

**Sistem Promptu**

**`GET /admin/api/system_prompt`**
- Sistem promptunu getirir
- Response:
  ```json
  {
    "base_prompt": "...",
    "updated_at": "2024-01-01T10:00:00Z"
  }
  ```

**`PUT /admin/api/system_prompt`**
- Sistem promptunu günceller
- Request Body:
  ```json
  {
    "base_prompt": "Yeni prompt..."
  }
  ```

**Model Yönetimi**

**`GET /admin/api/openai/model`**
- Model ayarlarını getirir
- Response:
  ```json
  {
    "completion_model": "gpt-4.1-mini",
    "summary_model": "gpt-4.1-mini",
    "temperature": 0.75,
    "top_p": 0.9,
    "updated_at": "2024-01-01T10:00:00Z"
  }
  ```

**`PUT /admin/api/openai/model`**
- Model ayarlarını günceller
- Request Body:
  ```json
  {
    "completion_model": "gpt-5",
    "temperature": 0.8,
    "top_p": 0.95
  }
  ```

**`DELETE /admin/api/openai/model`**
- Model ayarlarını varsayılana döndürür

**Kişilikler**

**`GET /admin/api/personalities`**
- Tüm kişilikleri listeler
- Response:
  ```json
  {
    "items": [...],
    "default": "huysuz"
  }
  ```

**`POST /admin/api/personalities`**
- Yeni kişilik oluşturur
- Request Body:
  ```json
  {
    "name": "Yeni Kişilik",
    "prompt": "...",
    "welcome_message": "...",
    "theme": "neutral",
    "active": true,
    "set_default": false
  }
  ```

**`PUT /admin/api/personalities/<slug>`**
- Kişiliği günceller

**`DELETE /admin/api/personalities/<slug>`**
- Kişiliği siler

**`POST /admin/api/personalities/<slug>/default`**
- Kişiliği varsayılan yapar

**`POST /admin/api/personalities/<slug>/avatar`**
- Avatar yükler
- Content-Type: `multipart/form-data`
- Form Data: `avatar` (file)

**`DELETE /admin/api/personalities/<slug>/avatar`**
- Avatar'ı siler

**Soru-Cevap Yönetimi**

**`GET /admin/api/files`**
- Tüm JSON dosyalarını listeler
- Response:
  ```json
  {
    "files": ["expanded_data.json", "duyurular.json"]
  }
  ```

**`POST /admin/api/files`**
- Yeni dosya oluşturur
- Request Body:
  ```json
  {
    "filename": "yeni_dosya.json"
  }
  ```

**`DELETE /admin/api/files/<filename>`**
- Dosyayı siler

**`GET /admin/api/items?file=expanded_data.json`**
- Dosyadaki tüm öğeleri getirir
- Response:
  ```json
  [
    {
      "question": "...",
      "answer": "..."
    }
  ]
  ```

**`POST /admin/api/items?file=expanded_data.json`**
- Yeni öğe ekler
- Request Body:
  ```json
  {
    "questions": ["..."],
    "answer": "..."
  }
  ```

**`PUT /admin/api/items/<idx>?file=expanded_data.json`**
- Öğeyi günceller

**`DELETE /admin/api/items/<idx>?file=expanded_data.json`**
- Öğeyi siler

**Log Yönetimi**

**`GET /admin/api/chat/sessions`**
- Tüm oturumları listeler
- Query Parameters:
  - `from`: Başlangıç tarihi (YYYY-MM-DD)
  - `to`: Bitiş tarihi (YYYY-MM-DD)
  - `season`: Sezon filtresi
- Response:
  ```json
  {
    "sessions": [...]
  }
  ```

**`GET /admin/api/chat/users?session=<session_id>`**
- Oturumdaki kullanıcıları listeler

**`GET /admin/api/chat/logs`**
- Logları getirir
- Query Parameters: `session`, `user_id`, `from`, `to`, `season`, `feedback`

**`GET /admin/api/chat/search_by_feedback`**
- Geri bildirime göre arama
- Query Parameters: `feedback` (like/dislike), `query`, `season`

**`GET /admin/api/chat/global_search`**
- Global arama
- Query Parameters: `query`, `from`, `to`, `season`

**`DELETE /admin/api/chat/log`**
- Tekil log siler
- Query Parameters: `session`, `user_id`, `index`

**`DELETE /admin/api/chat/sessions/<session_id>`**
- Tüm oturumu siler

**İstatistikler**

**`GET /admin/api/analytics/summary`**
- Analitik özeti
- Query Parameters: `from`, `to`, `season`
- Response:
  ```json
  {
    "total_events": 1000,
    "unique_sessions": 500,
    "user_messages": 1000,
    "assistant_responses": 1000,
    "feedback_like": 800,
    "feedback_dislike": 50,
    "by_season": {...}
  }
  ```

**`GET /admin/api/chat/stats_summary`**
- Chat istatistikleri
- Response:
  ```json
  {
    "total_messages": 1000,
    "user_messages": 1000,
    "assistant_responses": 1000,
    "feedback_like": 800,
    "feedback_dislike": 50,
    "by_season": {...},
    "by_personality": {...}
  }
  ```

**Sistem**

**`POST /admin/api/system/restart`**
- Uygulamayı yeniden başlatır
- Request Body (opsiyonel):
  ```json
  {
    "delay_seconds": 1.0
  }
  ```
- Response:
  ```json
  {
    "status": "scheduled",
    "delay_seconds": 1.0,
    "message": "Uygulama kısa süre içinde yeniden başlatılacak."
  }
  ```

---

### Kod Yapısı

#### Ana Modüller

**`app.py`** - Ana uygulama dosyası (3407 satır)

**Önemli Sınıflar:**

1. **`EmbeddingManager`**
   - Embedding önbelleği yönetimi
   - Veri yükleme ve embedding oluşturma
   - BM25 indeks oluşturma

2. **`PersonalityManager`**
   - Kişilik yönetimi
   - Kişilik CRUD işlemleri
   - Varsayılan kişilik yönetimi

3. **`SystemPromptManager`**
   - Sistem promptu yönetimi
   - Prompt güncelleme ve saklama

4. **`ModelConfigManager`**
   - OpenAI model yapılandırması
   - Temperature ve top_p ayarları

**Önemli Fonksiyonlar:**

- `find_most_similar(query, k=3)` - Hibrit arama (vektör + BM25)
- `dynamic_threshold(word_count)` - Dinamik benzerlik eşiği
- `preprocess(text)` - Metin ön işleme (Unicode NFC, lower, whitespace)
- `build_system_messages(personality)` - Sistem mesajları oluşturma
- `trim_history(messages)` - Sohbet geçmişi özetleme
- `save_chat_log(...)` - Log kaydetme

#### Veri Akışı

```
Kullanıcı Mesajı
    ↓
Preprocessing (Unicode, lower, whitespace)
    ↓
Hibrit Arama (Vektör + BM25)
    ↓
Dinamik Eşik Kontrolü
    ↓
RAG Context Ekleme (eşik aşıldıysa)
    ↓
Sistem Mesajları + Geçmiş + RAG + Kullanıcı Mesajı
    ↓
OpenAI Chat Completions (Stream)
    ↓
SSE ile Token Token Gönderme
    ↓
Loglama ve Analitik
```

---

## 🔍 RAG Sistemi Detayları

### Hibrit Arama Algoritması

Sistem iki farklı arama yöntemini birleştirir:

1. **Vektör Benzerliği (%70 ağırlık)**
   - SentenceTransformer ile embedding
   - Cosine similarity hesaplama
   - Anlamsal benzerlik

2. **BM25 Keyword Arama (%30 ağırlık)**
   - Token bazlı keyword eşleşmesi
   - TF-IDF benzeri skorlama
   - Kelime bazlı benzerlik

**Hibrit Skor:**
```
hybrid_score = (vector_similarity × 0.7) + (bm25_score × 0.3)
```

### Dinamik Eşik Hesaplama

Soru uzunluğuna göre otomatik eşik:

```python
threshold = max(0.75, 0.90 - 0.1 * log10(word_count + 1))
```

**Örnekler:**
- 1 kelime: `0.90`
- 5 kelime: `~0.83`
- 10 kelime: `~0.80`
- 100 kelime: `0.75` (alt limit)

**Mantık:** Kısa sorular daha spesifik olduğu için yüksek eşik, uzun sorular daha genel olduğu için düşük eşik.

### RAG Context Formatı

Eşik aşıldığında sistem mesajı olarak eklenir:

```
[RAG] İşte soruna benzeyen bazı önceki soru-cevap çiftleri:

Benzer Soru 1 (Benzerlik: 0.856): Kayıt ne zaman başlıyor?
Örnek Cevap 1: Kayıt işlemleri her akademik yıl başında başlar...

Benzer Soru 2 (Benzerlik: 0.823): Kayıt tarihleri nedir?
Örnek Cevap 2: Kayıt tarihleri üniversite web sitesinde duyurulur...
```

### Özetleme Mekanizması

**Tetikleyici:** Mesaj sayısı `MAX_HISTORY_MESSAGES` (varsayılan: 50) aştığında

**İşlem:**
1. İlk N sistem mesajı korunur
2. Son M mesaj korunur
3. Aradaki mesajlar OpenAI ile özetlenir
4. Özet tek bir `[Özet]` sistem mesajı olarak eklenir

**Avantajlar:**
- Token kullanımı azalır
- Bağlam korunur
- Maliyet düşer

---

## 🐛 Sorun Giderme

### Yaygın Hatalar ve Çözümleri

#### 1. `OPENAI_API_KEY env değişkeni tanımlı değil!`

**Sorun:** OpenAI API anahtarı bulunamıyor.

**Çözüm:**
```bash
# .env dosyasını kontrol edin
cat .env | grep OPENAI_API_KEY

# Eğer yoksa ekleyin
echo "OPENAI_API_KEY=sk-..." >> .env

# Uygulamayı yeniden başlatın
sudo systemctl restart kun-chatbot.service
```

#### 2. `REDIS_URL env değişkeni tanımlı değil!`

**Sorun:** Redis bağlantı bilgisi bulunamıyor.

**Çözüm:**
```bash
# Redis çalışıyor mu kontrol edin
redis-cli ping

# .env dosyasına ekleyin
echo "REDIS_URL=redis://localhost:6379/0" >> .env

# Şifreli Redis için:
echo "REDIS_URL=redis://:parolanız@127.0.0.1:6379/0" >> .env
```

#### 3. `ADMIN_PASSWORD veya APP_PASSWORD env değişkenlerinden biri tanımlı olmalıdır`

**Sorun:** Admin şifresi tanımlı değil.

**Çözüm:**
```bash
# .env dosyasına ekleyin
echo "ADMIN_PASSWORD=güvenli-şifre" >> .env

# Uygulamayı yeniden başlatın
```

#### 4. Embedding Önbelleği Oluşturulmuyor

**Sorun:** İlk çalıştırmada embedding hesaplama çok yavaş veya hata veriyor.

**Çözüm:**
```bash
# Model indirme kontrolü
python3 -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('intfloat/multilingual-e5-base')"

# Disk alanı kontrolü
df -h

# Embedding dosyasını silip yeniden oluşturun (dikkatli!)
rm embeddings.pkl.bz2 embeddings.pkl.bz2.lock
# Uygulamayı yeniden başlatın, otomatik oluşturulacak
```

#### 5. SSE (Server-Sent Events) Çalışmıyor

**Sorun:** Cevaplar akışlı gelmiyor, tek seferde geliyor.

**Çözüm:**

**Nginx Konfigürasyonu:**
```nginx
location /chat {
    proxy_buffering off;  # ÖNEMLİ!
    proxy_cache off;
    proxy_read_timeout 300s;
    ...
}
```

**Flask Geliştirme Sunucusu:**
- `python app.py` ile çalıştırıyorsanız sorun yok
- Gunicorn kullanıyorsanız thread worker kullanın:
  ```bash
  gunicorn -k gthread --threads 8 app:app
  ```

#### 6. Model Erişim Hatası

**Sorun:** `gpt-4.1-mini` modeline erişilemiyor.

**Çözüm:**
```bash
# OpenAI hesabınızda model erişimini kontrol edin
# https://platform.openai.com/account/usage

# Farklı bir model deneyin (.env'de):
OPENAI_MODEL=gpt-4o-mini
# veya
OPENAI_MODEL=gpt-3.5-turbo
```

#### 7. Redis Bağlantı Hatası

**Sorun:** Redis'e bağlanılamıyor.

**Çözüm:**
```bash
# Redis servisi çalışıyor mu?
sudo systemctl status redis-server

# Redis loglarını kontrol edin
sudo journalctl -u redis-server -n 50

# Redis şifresini kontrol edin
redis-cli -a parolanız ping

# .env dosyasındaki REDIS_URL'i kontrol edin
```

#### 8. Dosya İzinleri Hatası

**Sorun:** Log veya config dosyaları yazılamıyor.

**Çözüm:**
```bash
# Dizin izinlerini kontrol edin
ls -la /opt/chatbot/

# Gerekirse izinleri düzeltin
sudo chown -R www-data:www-data /opt/chatbot/chat_logs
sudo chown -R www-data:www-data /opt/chatbot/static/config
sudo chmod -R 755 /opt/chatbot/chat_logs
```

#### 9. Embedding Önbelleği Güncellenmiyor

**Sorun:** Yeni soru-cevap ekledikten sonra arama sonuçları değişmiyor.

**Çözüm:**
```bash
# Embedding dosyasını silin (uygulama çalışırken)
rm /opt/chatbot/embeddings.pkl.bz2

# Uygulamayı yeniden başlatın
sudo systemctl restart kun-chatbot.service

# Veya admin panelden "Sistem Yeniden Başlatma" kullanın
```

#### 10. Admin Panel Giriş Yapamıyorum

**Sorun:** Şifre doğru ama giriş yapılamıyor.

**Çözüm:**
```bash
# .env dosyasını kontrol edin
cat .env | grep -E "ADMIN_PASSWORD|APP_PASSWORD"

# Şifrede özel karakterler varsa tırnak içine alın
ADMIN_PASSWORD="şifre-özel-karakterlerle"

# Session cookie'lerini temizleyin (tarayıcıda)
# Chrome DevTools > Application > Cookies > localhost > Tümünü sil

# Uygulamayı yeniden başlatın
sudo systemctl restart kun-chatbot.service
```

### Log Kontrolü

**Uygulama Logları:**
```bash
# systemd servisi logları
sudo journalctl -u kun-chatbot.service -f

# Son 100 satır
sudo journalctl -u kun-chatbot.service -n 100

# Belirli bir tarihten itibaren
sudo journalctl -u kun-chatbot.service --since "2024-01-01"
```

**Nginx Logları:**
```bash
# Erişim logları
sudo tail -f /var/log/nginx/access.log

# Hata logları
sudo tail -f /var/log/nginx/error.log
```

**Redis Logları:**
```bash
# Redis logları
sudo journalctl -u redis-server -f
```

### Performans Optimizasyonu

**Embedding Önbelleği:**
- İlk çalıştırmada embedding hesaplama yavaş olabilir (normal)
- Sonraki çalıştırmalarda önbellek kullanılır (hızlı)
- Veri dosyaları değiştiğinde otomatik yenilenir

**Redis Optimizasyonu:**
```bash
# Redis memory kullanımı
redis-cli INFO memory

# Max memory ayarı (opsiyonel)
# /etc/redis/redis.conf içinde:
maxmemory 256mb
maxmemory-policy allkeys-lru
```

**Gunicorn Optimizasyonu:**
```bash
# Worker sayısı = (2 × CPU çekirdeği) + 1
# Örnek: 4 çekirdekli CPU için 9 worker

gunicorn -w 9 -k gthread --threads 4 app:app
```

---

## 📚 Ek Kaynaklar

### İlgili Dosyalar

- `JSON_OPERATIONS_MENU.md` - JSON işlemleri rehberi
- `SEARCH_AND_HIGHLIGHT_FEATURES.md` - Arama ve vurgulama özellikleri
- `UX_IMPROVEMENTS.md` - Kullanıcı deneyimi iyileştirmeleri
- `LICENSE` - Lisans bilgisi

### Dış Bağlantılar

- [Flask Dokümantasyonu](https://flask.palletsprojects.com/)
- [OpenAI API Dokümantasyonu](https://platform.openai.com/docs)
- [SentenceTransformers](https://www.sbert.net/)
- [Redis Dokümantasyonu](https://redis.io/docs/)

---

## 📝 Sürüm Notları

### Stabil RAG v3.3

**Yeni Özellikler:**
- ✅ Hibrit arama (vektör + BM25)
- ✅ Dinamik benzerlik eşiği
- ✅ Çoklu kişilik desteği
- ✅ Avatar yükleme
- ✅ Gelişmiş admin paneli
- ✅ Sezon bazlı analitik
- ✅ Global arama
- ✅ Model yönetimi (temperature, top_p)

**İyileştirmeler:**
- ⚡ Embedding önbellek performansı
- 🔒 Güvenlik iyileştirmeleri
- 📊 Daha detaylı loglama
- 🎨 UI/UX iyileştirmeleri

---

## 👥 Katkıda Bulunma

Bu proje Kapadokya Üniversitesi için geliştirilmiştir. Sorularınız ve önerileriniz için lütfen iletişime geçin.

---

## 📄 Lisans

Bu proje ile birlikte gelen `LICENSE` dosyasına bakın.

---

## 🙏 Teşekkürler

- SentenceTransformers ve OpenAI topluluğuna
- Flask ve Python ekosistemine
- Tüm katkıda bulunanlara

---

**Son Güncelleme:** 2025  
**Versiyon:** Stabil RAG v3.3  
**Dokümantasyon:** Kapsamlı Tutorial
