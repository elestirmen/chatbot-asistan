# Kapadokya Üniversitesi Chatbot (Stabil RAG v3.3)

Flask tabanlı, RAG destekli, SSE (Server‑Sent Events) ile akışlı cevaplar veren bir sohbet uygulaması. Sunucu tarafı oturum yönetimi Redis ile yapılır, vektör arama için SentenceTransformers kullanılır ve OpenAI üzerinden yanıt üretilir.

Bu doküman, kodun gerçek davranışıyla uyumludur.

**Öne Çıkanlar**
- RAG: Soruya en benzer 3 kayıt çekilir; eşik dinamik hesaplanır.
- Embedding: Soru + cevap birleştirilerek gömülür (tek metin olarak).
- Akışlı yanıt: SSE ile parça parça iletilir, frontend anlık günceller.
- Özetleme: Tarihçe sınırı aşınca geçmiş tek bir [Özet] mesajına indirgenir.
- Kişilikler: `/huysuz`, `/notr`, `/pozitif` komutlarıyla değiştirilebilir.
- Oturum: Redis tabanlı server‑side session.

---

**Mimari**
- Backend: `Flask` + `flask-session` (Redis) + `flask-cors`
- LLM İstemcisi: `openai` (Chat Completions, model: `gpt-4.1-mini`, stream)
- RAG: `sentence-transformers` + `scikit-learn` (cosine similarity)
- Önbellek: `embeddings.pkl.bz2` (bz2 sıkıştırmalı JSON), `filelock` ile korumalı
- Frontend: Statik HTML/JS (`static/index.html`) + SSE

---

**Kurulum**
- Python 3.10+ önerilir.
- Gerekli paketler: `requirements.txt`

Adımlar:
1) Sanal ortam ve bağımlılıklar
   - `python -m venv .venv && source .venv/bin/activate`
   - `pip install -r requirements.txt`
2) Çevre değişkenleri
   - Zorunlu: `OPENAI_API_KEY`, `REDIS_URL`
   - İsteğe bağlı: `FLASK_SECRET_KEY`, `OPENAI_REQUEST_TIMEOUT`, `OPENAI_MAX_RETRIES`, `MODEL_NAME`, `MODEL_PATH`
3) Redis
   - Örnek: `redis://localhost:6379/0` (Docker veya yerel Redis)
4) Çalıştırma
   - `python app.py`
   - Tarayıcıdan `http://localhost:5000` adresine gidin.

Not: Üretimde `gunicorn` kullanabilirsiniz (örn. `gunicorn -w 2 -b 0.0.0.0:5000 app:app`).

---

**Çevre Değişkenleri**
- `OPENAI_API_KEY`: OpenAI API anahtarı (zorunlu)
- `OPENAI_REQUEST_TIMEOUT`: OpenAI istek zaman aşımı (varsayılan: 30)
- `OPENAI_MAX_RETRIES`: OpenAI tekrar deneme sayısı (varsayılan: 2)
- `REDIS_URL`: Redis bağlantı adresi, örn. `redis://localhost:6379/0` (zorunlu)
- `FLASK_SECRET_KEY`: Flask gizli anahtar (sağlanmazsa rastgele üretilir)
- `MODEL_NAME`: SentenceTransformer model adı (varsayılan: `intfloat/multilingual-e5-base`)
- `MODEL_PATH`: Yerel model dizini (varsa `MODEL_NAME` yerine kullanılır)

---

**Çalışma Mantığı**
- Başlangıç: `app.py` başında embedding önbelleği yüklenir/oluşturulur. İlk çalıştırma uzun sürebilir.
- RAG Eşiği: `dynamic_threshold(n) = max(0.75, 0.90 - 0.1 * log10(n+1))` (app.py:187). Alt limit 0.75’tir.
- Üstü örtülü detaylar: 
  - Sistem mesajları: Genel yönerge + kişilik (app.py:160, app.py:166)
  - Kişilikler: `ASSISTANT_PERSONALITIES` (app.py:132)
  - Özetleme: Mesaj sayısı `MAX_HISTORY_MESSAGES` sınırını aşınca tek bir `[Özet]` mesajı eklenir.
  - SSE: `/chat` uç noktası parçalı veri döner; frontend akış halinde işler.

---

**Veri ve Embedding**
- Veri klasörü: `data/` içindeki `*.json` dosyaları toplanır.
- Beklenen şema (liste):
  - `{"question": "...", "answer": "..."}` veya
  - `{"questions": ["...", "..."], "answer": "..."}`
- Embedding: Soru(lar) + cevap tek metne birleştirilip gömülür (app.py:202–214). Varsayılan model çok dilli desteklidir.
- Önbellek: `embeddings.pkl.bz2` içine hem veri hem embedding vektörleri kaydedilir.
  - Model adı veya veri dosyaları değişirse önbellek otomatik yenilenir.

---

**Kişilikler ve Komutlar**
- Kişilikler: `huysuz`, `notr`, `pozitif`.
- Sohbet içinde `/<kişilik>` yazarak değiştirin, örn. `/notr`.

---

**Uç Noktalar**
- `GET /` → Arayüz (statik)
- `POST /chat` → SSE ile akışlı yanıt (girdi: `{message: string}`)
- `GET /chat_history` → Mevcut oturumun geçmiş logları
- `GET /all_sessions` → Kullanıcının tüm oturumları ve logları
- `POST /new_chat` → Yeni sohbet başlatır
- `POST /set_personality` → `{personality: "huysuz|notr|pozitif"}`
- `POST /feedback` → `{messageIndex: number, feedback: "like"|"dislike"}`

Not: `feedback` uç noktası, istemcinin gönderdiği indeks ile log dizinindeki sırayı eşler. Farklı oturumlar/önceki loglar varsa indeks eşleşmesi değişebilir.

---

**Güncel Frontend Davranışları**
- XSS koruması: Metin önce `escapeHTML` ile kaçırılır, ardından `linkify` uygulanır.
- Linkify düzeltmesi: Cümlenin sonundaki `.` `,` `;` `:` `!` `?` `…` ve fazla `)` link dışına alınır; yanlış tıklama engellenir (static/index.html:1073 civarı).

---

**Güvenlik ve Üretim Notları**
- Çerezler: Üretimde `SESSION_COOKIE_SECURE=True` ve uygun `SESSION_COOKIE_SAMESITE` ayarlarını kullanın.
- CORS: Varsayılan açık ayarları ihtiyaçlarınıza göre daraltın; farklı origin ve cookie kullanılacaksa `supports_credentials=True` düşünün.
- SSE ve proxy: Uzun yanıtlar/proxy arkasında `Cache-Control: no-cache` ve buffer’ı kapatma ayarlarına ihtiyaç duyabilirsiniz (Nginx `X-Accel-Buffering: no`).

---

**Sorun Giderme**
- `OPENAI_API_KEY env değişkeni tanımlı değil!` → `.env` veya ortam değişkeni ekleyin.
- `REDIS_URL env değişkeni tanımlı değil!` → Çalışan Redis ve doğru URL gerekli.
- Model hatası: `gpt-4.1-mini` Chat Completions ile kullanılır. Erişim sorunu yaşıyorsanız proje kodunu değiştirmeden önce hesabınızın model erişimini doğrulayın; gerekirse `gpt-4o-mini` gibi alternatif deneyin.
- İlk çalıştırma çok yavaş: Embedding önbelleği oluşturuluyor; bir sonraki çalıştırmada hızlanır.

---

**Lisans**
- Bu proje ile birlikte gelen `LICENSE` dosyasına bakın.

---

**Teşekkürler**
- SentenceTransformers ve OpenAI topluluğuna teşekkürler.
