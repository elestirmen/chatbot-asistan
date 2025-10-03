# Kapadokya Üniversitesi Chatbot (Stabil RAG v3.3)

Flask tabanlı, RAG destekli ve SSE (Server‑Sent Events) ile akışlı cevaplar veren bir sohbet uygulaması. Sunucu tarafı oturum yönetimi Redis ile yapılır; vektör arama için SentenceTransformers, yanıt üretimi için OpenAI kullanılır.

Bu doküman kurulum, kullanım ve çalışma mantığını kapsayan teknik bir rehberdir.

## Özellikler
- RAG: Soruya en benzer 3 kayıt alınır; eşik dinamik formülle hesaplanır.
- Embedding: Soru + cevap birleştirilerek tek metin şeklinde gömülür.
- Akışlı yanıt: SSE ile token bazlı akış, frontend anlık günceller.
- Özetleme: Geçmiş belirli eşiği aştığında tek bir [Özet] mesajına indirgenir.
- Kişilikler: Sohbet içinde `/huysuz`, `/notr`, `/pozitif` komutlarıyla değiştirilebilir.
- Oturum: Redis tabanlı server‑side session.

## Mimari
- Backend: `Flask` + `Flask-Session` (Redis) + `flask-cors`
- LLM İstemcisi: `openai` Chat Completions (model: `gpt-4.1-mini`, stream)
- RAG: `sentence-transformers` + `scikit-learn` (cosine similarity)
- Önbellek: `embeddings.pkl.bz2` (bz2 sıkıştırmalı JSON), `filelock` ile kilitli
- Frontend: Statik HTML/JS (`static/index.html`) + SSE

## Hızlı Başlangıç (Yerel)
Önkoşullar:
- Python 3.10+
- Çalışan bir Redis örneği (örn. `redis://localhost:6379/0`)

Adımlar:
1) Sanal ortam ve bağımlılıklar
   - `python -m venv .venv && source .venv/bin/activate`
   - `pip install -r requirements.txt`
2) Çevre değişkenleri (`.env` önerilir)
   - Zorunlu: `OPENAI_API_KEY`, `REDIS_URL`
   - İsteğe bağlı: `FLASK_SECRET_KEY`, `OPENAI_REQUEST_TIMEOUT`, `OPENAI_MAX_RETRIES`, `MODEL_NAME`, `MODEL_PATH`, `DEFAULT_PERSONALITY`, `ADMIN_PASSWORD`/`APP_PASSWORD`
3) Çalıştırma (geliştirme)
   - `python app.py`
   - Tarayıcı: `http://localhost:5000`

Üretimde `gunicorn` önerilir: `gunicorn -w 2 -k gthread --threads 8 -b 0.0.0.0:5000 app:app`

## Sunucuya Kurulum (Nginx + systemd)
Ubuntu 22.04+ üzerinde otomatik kurulum için `deploy/install_on_server.sh` kullanılabilir.

Önkoşullar:
- Alan adı DNS’i sunucunuza yönlendirilmeli (A/AAAA kayıtları)
- 80/443 portları açık olmalı
- OpenAI API anahtarınız hazır olmalı

Değiştirmeniz gerekenler:
- `deploy/install_on_server.sh` içinde `DOMAIN` ve `EMAIL` değerlerini güncelleyin.
- Kodun bulunduğu dizin varsayılan olarak `/opt/chatbot` (script bunu bekler). Gerekirse `APP_DIR` değiştirin.

Kurulum (root ile):
```bash
bash deploy/install_on_server.sh
```
Script’in yaptığı başlıca işlemler:
- Redis servisinin etkinleştirilmesi ve güvenli bağlanma (requirepass/bind/protected‑mode)
- Sanal ortam, `pip install -r requirements.txt` ve `gunicorn` kurulumu
- `.env` şablonunun `/opt/chatbot/.env` olarak oluşturulması (yoksa)
- `systemd` servisi: `kun-chatbot.service` (127.0.0.1:5000 üzerinde gunicorn)
- Nginx site konfigürasyonu (SSE için `/chat` konumunda `proxy_buffering off`)
- İsteğe bağlı Let’s Encrypt TLS kurulumu (certbot varsa)

Notlar:
- Script içinde `apt-get` adımları yorum satırına alınmış durumda. Gerekirse açıp paketleri (nginx, certbot, redis, venv) kurabilirsiniz.
- `.env` içine en az `OPENAI_API_KEY`, `REDIS_URL`, `FLASK_SECRET_KEY` değerlerini girin. `ADMIN_PASSWORD` de eklemeniz tavsiye edilir.
- Servis logları: `journalctl -u kun-chatbot.service -e` ve Nginx için `/var/log/nginx/`.

Güncelleme / Yeniden başlatma:
- `sudo systemctl restart kun-chatbot.service`
- `sudo nginx -t && sudo systemctl reload nginx`

## Çevre Değişkenleri
- `OPENAI_API_KEY`: OpenAI API anahtarı (zorunlu)
- `REDIS_URL`: Redis bağlantısı, örn. `redis://[:parola]@127.0.0.1:6379/0` (zorunlu)
- `FLASK_SECRET_KEY`: Flask gizli anahtar (sağlanmazsa rastgele üretilir)
- `OPENAI_REQUEST_TIMEOUT`: OpenAI istek zaman aşımı (varsayılan: 30)
- `OPENAI_MAX_RETRIES`: OpenAI tekrar deneme sayısı (varsayılan: 2)
- `MODEL_NAME`: SentenceTransformer model adı (varsayılan: `intfloat/multilingual-e5-base`)
- `MODEL_PATH`: Yerel model dizini (varsa `MODEL_NAME` yerine kullanılır)
- `DEFAULT_PERSONALITY`: Varsayılan kişilik (`huysuz` | `notr` | `pozitif`)
- `ADMIN_PASSWORD` veya `APP_PASSWORD`: Admin panel giriş şifresi (aksi halde varsayılan `Kun2025` kabul edilir)
- `AVATAR_MAX_BYTES`: Admin panelden yüklenen avatar dosyaları için maksimum byte
- `OPENAI_MODEL`: Sadece log metadatası için kullanılır; model çağrısı kodda `gpt-4.1-mini` ile yapılır

## Kullanım ve Uç Noktalar
- `GET /` → Arayüz (statik)
- `POST /chat` → SSE ile akışlı yanıt (girdi: `{"message": "metin"}`)
- `GET /chat_history` → Mevcut oturumun geçmiş logları
- `GET /all_sessions` → Kullanıcının tüm oturumları ve logları
- `POST /new_chat` → Yeni sohbet başlatır
- `POST /set_personality` → `{"personality": "huysuz|notr|pozitif"}`
- `POST /feedback` → `{"messageIndex": number, "feedback": "like"|"dislike"}`

Admin Panel (`/admin`):
- Giriş: `POST /admin/api/login` (body: `{ "password": "..." }`)
- Sistem promptu: `GET/PUT /admin/api/system_prompt`
- Kişilikler: `GET/POST /admin/api/personalities`, `PUT/DELETE /admin/api/personalities/<slug>`
- Varsayılan kişilik: `POST /admin/api/personalities/<slug>/default`
- Avatar yükleme/silme: `POST/DELETE /admin/api/personalities/<slug>/avatar`
- Veri dosyaları: `GET /admin/api/files`
- Soru‑cevap maddeleri: `GET/POST /admin/api/items?file=...`, `PUT/DELETE /admin/api/items/<idx>?file=...`
- Log listeleri/filtreleme: `GET /admin/api/chat/sessions`, `GET /admin/api/chat/users?session=...`, `GET /admin/api/chat/logs?...`
- Log arama/özetler: `GET /admin/api/chat/search_by_feedback`, `GET /admin/api/chat/global_search`, `GET /admin/api/analytics/summary`, `GET /admin/api/chat/stats_summary`

SSE kullanım notu: Proxy arkasında `/chat` konumu için `proxy_buffering off` ve uzun `read_timeout` ayarlanmıştır.

## RAG ve Nasıl Çalışır
- Ön‑işleme: Unicode NFC + `lower()` + boşluk sıkıştırma.
- Gömme: Her kayıt için (sorular birleştirilip + cevap) tek metin üretilir ve vectorize edilir.
- Benzerlik: Kullanıcı sorusu encode edilir, cosine similarity ile en benzer k kayıt seçilir (k=3).
- Dinamik eşik: `max(0.75, 0.90 - 0.1 * log10(kelime_sayısı + 1))`; eşik aşılırsa tek bir `[RAG]` sistem mesajı olarak bağlama eklenir.
- Özetleme: Tarihçe sınırı aşınca önceki konuşmalar kısa bir `[Özet]` sistem mesajına indirgenir.
- Kişilik: Sistem mesajları her istekte güncellenir; `/huysuz`, `/notr`, `/pozitif` ile değiştirilebilir.
- Yanıt üretimi: OpenAI Chat Completions akış (stream) ile kullanılır; hatalarda kullanıcıya uygun mesaj ve analitik kaydı yazılır.

## Veri ve Embedding
- Veri klasörü: `data/*.json`
- Şema:
  - `{ "question": "...", "answer": "..." }` veya
  - `{ "questions": ["...", "..."], "answer": "..." }`
- Önbellek: `embeddings.pkl.bz2` içinde hem veri hem vektörler saklanır.
- Geçersiz bırakma: Veri dosyaları veya model adı değişirse önbellek otomatik yeniden oluşturulur.

## Loglama ve Analitik
- Sohbet logları: `chat_logs/<session_id>/chat_log_<user_id>.json`
- Analitik NDJSON: `analytics/events_YYYYMMDD.ndjson` (gün bazlı)
- Admin API’leri üzerinden oturum/listeler/filtreleme/özetleme yapılabilir.

## Güvenlik ve Üretim Notları
- Çerezler: Üretimde `SESSION_COOKIE_SECURE=True` ve uygun `SameSite` politikası önerilir.
- CORS: Gerekli origin’lere daraltın; cookie kullanacaksanız `supports_credentials=True` değerlendirin.
- Nginx: `/chat` için buffer kapalı, SSE’ye uygun timeout’lar ayarlı.
- Redis: Script, `REDIS_URL` içindeki parolayı tespit edip `requirepass` olarak uygular; bağlama `127.0.0.1` ve `protected-mode yes` kullanılır.

## Sorun Giderme
- `OPENAI_API_KEY env değişkeni tanımlı değil!` → `.env`/ortam değişkeni ekleyin.
- `REDIS_URL env değişkeni tanımlı değil!` → Çalışan Redis ve doğru URL gerekli.
- Model erişimi: `gpt-4.1-mini` erişiminizi doğrulayın; sorun varsa hesabınızın model erişim durumunu kontrol edin.
- İlk çalıştırma yavaş: Embedding önbelleği oluşturuluyor; sonraki çalıştırmalarda hızlanır.
- Servis ayakta mı? → `systemctl status kun-chatbot.service` ve Nginx test: `nginx -t`.

## Lisans
Bu proje ile birlikte gelen `LICENSE` dosyasına bakın.

## Teşekkürler
SentenceTransformers ve OpenAI topluluğuna teşekkürler.
