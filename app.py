# -*- coding: utf-8 -*-
"""
Flask tabanlı sohbet uygulaması – Stabil RAG v3.3 (Tam Sürüm)
===============================================================
Gerçek Davranış Özeti:
- Embedding, soru + cevap metni birleştirilerek üretilir.
- Ön-işleme: Unicode NFC + lower() + whitespace sıkıştırma.
- Dinamik eşik formülü: max(0.75, 0.90 - 0.1 * log10(kelime_sayısı + 1)) – alt limit 0.75.
- Her turda yalnızca 1 RAG bloğu eklenir; önceki RAG blokları temizlenir.
- Sohbet özetleme, geçmiş belirli bir eşiği aştığında tek bir [Özet] sistem mesajına indirger.
- Cevaplar SSE ile akış (stream) halinde gönderilir.
- Sunucu tarafı session: Redis (SESSION_TYPE=redis).
- Kişilik seçim komutları: /huysuz, /notr, /pozitif.
"""

from __future__ import annotations
import bz2
import json
import math
import os
import secrets
import unicodedata
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# --- YENİ EKLENENLER BAŞLANGICI ---
import redis
from flask_session import Session
# --- YENİ EKLENENLER SONU ---

import numpy as np
from dotenv import load_dotenv
from filelock import FileLock
from flask import (
    Flask, Response, jsonify, request,
    send_from_directory, session,
    stream_with_context,
)
from flask_cors import CORS
from openai import APIError, APITimeoutError, OpenAI, RateLimitError
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

# -----------------------------------------------------------------------------
# Ortam Değişkenleri ve OpenAI Client
# -----------------------------------------------------------------------------
load_dotenv()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY env değişkeni tanımlı değil!")
try:
    OPENAI_TIMEOUT = float(os.getenv("OPENAI_REQUEST_TIMEOUT", "30"))
except ValueError:
    OPENAI_TIMEOUT = 30.0

try:
    OPENAI_MAX_RETRIES = int(os.getenv("OPENAI_MAX_RETRIES", "2"))
except ValueError:
    OPENAI_MAX_RETRIES = 2
client = OpenAI(
    api_key=OPENAI_API_KEY,
    timeout=OPENAI_TIMEOUT,
    max_retries=OPENAI_MAX_RETRIES,
)

# -----------------------------------------------------------------------------
# Flask Uygulaması
# -----------------------------------------------------------------------------
app = Flask(__name__, static_folder="static")
CORS(app)

# --- DEĞİŞEN KISIM BAŞLANGICI ---
# Session (Redis) Yapılandırması
app.config["SESSION_TYPE"] = "redis"
app.config["SESSION_PERMANENT"] = False
app.config["SESSION_USE_SIGNER"] = True
app.config["SECRET_KEY"] = os.getenv("FLASK_SECRET_KEY", secrets.token_hex(32))

REDIS_URL = os.getenv("REDIS_URL")
if not REDIS_URL:
    raise RuntimeError("REDIS_URL env değişkeni tanımlı değil!")
app.config["SESSION_REDIS"] = redis.from_url(REDIS_URL)

# Sunucu tarafı session'ı başlat
server_session = Session(app)
# --- DEĞİŞEN KISIM SONU ---


# -----------------------------------------------------------------------------
# Asistan kişiliğini her istekte güncelleyen before_request
# -----------------------------------------------------------------------------
@app.before_request
def sync_personality_message():
    personality = session.get("current_personality", DEFAULT_PERSONALITY)
    base_messages = build_system_messages(personality)
    existing = session.get("messages")
    if not existing:
        session["messages"] = base_messages
        session.modified = True
        return

    filtered_rest = [
        msg for msg in existing
        if not (
            msg.get("role") == "system"
            and (
                msg.get("content") == BASE_SYSTEM_PROMPT
                or msg.get("content") in PERSONALITY_PROMPTS
            )
        )
    ]
    new_messages = base_messages + filtered_rest
    if new_messages != existing:
        session["messages"] = new_messages
        session.modified = True

# -----------------------------------------------------------------------------
# Sabitler ve Dosya Yolları
# -----------------------------------------------------------------------------
DEFAULT_PERSONALITY = "huysuz"
LOGS_DIR = Path("chat_logs"); LOGS_DIR.mkdir(exist_ok=True)
DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)
EMBEDDING_CACHE = Path("embeddings.pkl.bz2")
MODEL_NAME = os.getenv("MODEL_NAME", "intfloat/multilingual-e5-base")
MODEL_PATH = os.getenv("MODEL_PATH")
MODEL = SentenceTransformer(MODEL_PATH) if MODEL_PATH else SentenceTransformer(MODEL_NAME)


#MODEL_NAME = "Alibaba-NLP/gte-multilingual-base"
#MODEL = SentenceTransformer(MODEL_NAME, trust_remote_code=True)



ASSISTANT_PERSONALITIES = {
    "huysuz": (
        "Kapadokya Üniversitesinde bir öğrenci işleri çalışanı olarak, öğrencilere rehberlik etmek için buradasın; "
        "ancak onlara sert, agresif, olumsuz, huysuz ve moral çökertici bir şekilde cevap vereceksin. "
        "Öğrencilerin sordukları sorulara alaycı ve sabırsız bir tavırla yaklaşıp, mümkün olan en az yardımcı tutumu sergileyeceksin.\n\n"
        "Talimatlar:\n"
        "• Kullanıcının iletisi sadece teşekkür/onay mesajı ise, kısa ve sitemkâr bir cevap ver bitir, yeni açıklama yapma.\n"
        "• Aksi hâlde **öncelikle** sadece son kullanıcı iletisine odaklan; gerekirse önceki bağlamdan kısa alıntı yapabilirsin.\n"
        "• Basit bir soruysa iğneleyici bir giriş yap, sonra net ama aşağılayıcı bir cevap ver.\n"
        "• Yardım ederken bile sanki zorunluluktan yapıyormuşsun izlenimi uyandır; asla samimi veya destekleyici olma.\n"
    ),
    "notr": (
        "Kapadokya Üniversitesinde bir öğrenci işleri çalışanı olarak, öğrencilere profesyonel ve tarafsız bir şekilde yardımcı olacaksın.\n\n"
        "Talimatlar:\n"
        "• Kullanıcının iletisi yalnızca teşekkür/onay mesajı ise, kısa ve nazik bir teşekkürle yanıt ver, "
        "gereksiz bilgi ekleme.\n"
        "• Normal bir soruysa, **öncelikle** son kullanıcı iletisine odaklan ve net, tarafsız bir yanıt oluştur; "
        "geçmişten alman gereken bağlam varsa kısa tut\n"
    ),
    "pozitif": (
        "Kapadokya Üniversitesinde çalışan, öğrencilere yardım etmeyi çok seven, her cevabı motive edici bir notla "
        "sonlandıran aşırı pozitif bir asistan olarak davranacaksın.\n\n"
        "Talimatlar:\n"
        "• Sadece teşekkür/onay mesajı alırsan, neşeli bir şekilde kısa bir teşekkürle karşılık ver, uzun uzadıya yazma.\n"
        "• Cevaplarında **öncelikle** son kullanıcı iletisine odaklan; geçmişten alman gereken bağlam varsa kısa tut.\n"
    ),
}

BASE_SYSTEM_PROMPT = (
    "Sen Kapadokya Üniversitesi öğrenci işleri için görev yapan bir asistanısın. "
    "Elindeki güvenilir kaynaklar dışında bilgi uydurma. Emin olmadığın veya kayıtta bulunmayan her durumda "
    "kullanıcıya net biçimde bilgi eksikliğini belirt ve gerekirse yönlendirme yap."
)

SYSTEM_PREFIX_LENGTH = 2  # Genel yönerge + kişilik mesajı
MAX_HISTORY_MESSAGES = 22
MAX_CONTEXT_MESSAGES = SYSTEM_PREFIX_LENGTH + MAX_HISTORY_MESSAGES + 1  # Özet slotu için +1

PERSONALITY_PROMPTS = set(ASSISTANT_PERSONALITIES.values())

# -----------------------------------------------------------------------------
# Ön-işleme Fonksiyonu
# -----------------------------------------------------------------------------
def preprocess(text: str) -> str:
    text = unicodedata.normalize("NFC", text)
    text = text.lower()
    return " ".join(text.split())

# -----------------------------------------------------------------------------
# Yardımcı Fonksiyonlar
# -----------------------------------------------------------------------------
def generate_session_id() -> str:
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    return f"sess_{ts}_{secrets.token_hex(4)}"

def dynamic_threshold(n_words: int) -> float:
    return max(0.75, 0.90 - 0.1 * math.log10(n_words + 1))

def strip_old_rag(msgs: List[Dict[str, str]]) -> List[Dict[str, str]]:
    return [
        m for m in msgs
        if not (m["role"] == "system" and m["content"].startswith("[RAG]"))
    ]


def strip_old_summary(msgs: List[Dict[str, str]]) -> List[Dict[str, str]]:
    seen_summary = False
    filtered: List[Dict[str, str]] = []
    for msg in reversed(msgs):
        if msg["role"] == "system" and msg["content"].startswith("[Özet]"):
            if seen_summary:
                continue
            seen_summary = True
        filtered.append(msg)
    filtered.reverse()
    return filtered


def build_system_messages(personality: str) -> List[Dict[str, str]]:
    return [
        {"role": "system", "content": BASE_SYSTEM_PROMPT},
        {"role": "system", "content": ASSISTANT_PERSONALITIES[personality]},
    ]


def trim_history(messages: List[Dict[str, str]]) -> List[Dict[str, str]]:
    head = messages[:SYSTEM_PREFIX_LENGTH]
    remainder = messages[SYSTEM_PREFIX_LENGTH:]
    if not remainder:
        return messages

    summaries = [
        msg for msg in remainder
        if msg["role"] == "system" and msg["content"].startswith("[Özet]")
    ]
    tail = [
        msg for msg in remainder
        if not (msg["role"] == "system" and msg["content"].startswith("[Özet]"))
    ]
    trimmed_tail = tail[-MAX_HISTORY_MESSAGES:]
    if summaries:
        trimmed_tail = summaries[-1:] + trimmed_tail
    return head + trimmed_tail

# -----------------------------------------------------------------------------
# Embedding Manager
# -----------------------------------------------------------------------------
class EmbeddingManager:
    def __init__(self, data_dir: Path, cache_file: Path, model: SentenceTransformer):
        self.data_dir = data_dir
        self.cache_file = cache_file
        self.model = model
        self.lock = FileLock(str(cache_file) + ".lock")
        self._memory_cache: Optional[Tuple[List[Dict[str, Any]], np.ndarray]] = None
        self._memory_cache_mtime: float = -1.0

    def load_or_create(self) -> Tuple[List[Dict[str, Any]], np.ndarray]:
        with self.lock:
            latest_mtime = self._dir_modified_time()
            if (
                self._memory_cache is not None
                and math.isclose(self._memory_cache_mtime, latest_mtime)
            ):
                return self._memory_cache

            if self.cache_file.exists():
                try:
                    with bz2.open(self.cache_file, "rb") as fp:
                        cached = json.loads(fp.read().decode("utf-8"))
                    if (
                        cached["data_modified_time"] == latest_mtime
                        and cached.get("model_name") == MODEL_NAME
                    ):
                        print("[Embedding] cache kullanıldı")
                        data = cached["data"]
                        embeddings = np.array(cached["embeddings"], dtype=np.float32)
                        self._memory_cache = (data, embeddings)
                        self._memory_cache_mtime = latest_mtime
                        return self._memory_cache
                except Exception as e:
                    print("[Embedding] cache okunamadı:", e)
            print("[Embedding] hesaplanıyor…")
            data = self._load_data()
            embeddings = self._create_embeddings(data)
            self._save_cache(data, embeddings)
            self._memory_cache = (data, embeddings)
            self._memory_cache_mtime = latest_mtime
            return self._memory_cache

    def _load_data(self) -> List[Dict[str, Any]]:
        all_items: list[dict[str, Any]] = []
        for fp in sorted(self.data_dir.glob("*.json")):
            with fp.open("r", encoding="utf-8") as f:
                try:
                    items = json.load(f)
                    assert isinstance(items, list), f"{fp} list değil!"
                    all_items.extend(items)
                except Exception as e:
                    print(f"[Embedding] {fp} okunamadı: {e}")
        return all_items

    def _create_embeddings(self, data: List[Dict[str, Any]]) -> np.ndarray:
        if not data:
            dim = self.model.get_sentence_embedding_dimension()
            return np.zeros((0, dim), dtype=np.float32)
        texts: List[str] = []
        for item in data:
            q = item.get("question") or " ".join(item.get("questions", []))
            a = item.get("answer", "")
            texts.append(preprocess(f"{q} {a}".strip()))
        embs = self.model.encode(
            texts,
            batch_size=32,
            normalize_embeddings=True,
            show_progress_bar=True,
        )
        return embs.astype(np.float32)

    def _save_cache(self, data: List[Dict[str, Any]], embeddings: np.ndarray) -> None:
        payload = {
            "data": data,
            "embeddings": embeddings.tolist(),
            "data_modified_time": self._dir_modified_time(),
            "model_name": MODEL_NAME,
        }
        with bz2.open(self.cache_file, "wb") as fp:
            fp.write(json.dumps(payload).encode("utf-8"))
        print("[Embedding] cache kaydedildi")

    def _dir_modified_time(self) -> float:
        mtimes = [fp.stat().st_mtime for fp in self.data_dir.glob("*.json")]
        return max(mtimes) if mtimes else 0.0

embedding_manager = EmbeddingManager(DATA_DIR, EMBEDDING_CACHE, MODEL)
embedding_manager.load_or_create()

# -----------------------------------------------------------------------------
# Retrieval Fonksiyonu
# -----------------------------------------------------------------------------
def find_most_similar(query: str, k: int = 3) -> List[Dict[str, Any]]:
    if k <= 0:
        return []
    data, embeddings = embedding_manager.load_or_create()
    if not data or embeddings.size == 0:
        return []
    q_emb = MODEL.encode([preprocess(query)], normalize_embeddings=True)
    sims = cosine_similarity(q_emb, embeddings)[0]
    num_data = len(data)
    actual_k = min(k, num_data)
    if actual_k == num_data:
        top_idxs = np.argsort(sims)
    else:
        top_idxs = np.argsort(sims)[-actual_k:]
    top_idxs = top_idxs[::-1]
    results = []
    for idx in top_idxs:
        idx = int(idx)
        item = data[idx]
        question_text = item.get("question") or " ".join(item.get("questions", []))
        results.append({
            "question": question_text,
            "answer": item["answer"],
            "similarity": float(sims[idx]),
        })
    return results

# -----------------------------------------------------------------------------
# Logging Fonksiyonu
# -----------------------------------------------------------------------------
def save_chat_log(
    session_id: str,
    user_id: str,
    user_message: str,
    assistant_response: str,
    personality: str,
    retrieval_hits: Optional[List[Dict[str, Any]]] = None,
) -> None:
    LOGS_DIR.joinpath(session_id).mkdir(exist_ok=True)
    log_file = LOGS_DIR / session_id / f"chat_log_{user_id}.json"
    entry: Dict[str, Any] = {
        "timestamp": datetime.utcnow().isoformat(sep=" ", timespec="seconds"),
        "user_message": user_message,
        "assistant_response": assistant_response,
        "feedback": None,
        "assistant_personality": personality,
    }
    if retrieval_hits:
        entry["retrieval_hits"] = retrieval_hits

    lock = FileLock(str(log_file) + ".lock")
    with lock:
        logs: List[Dict[str, Any]] = []
        if log_file.exists():
            with log_file.open("r", encoding="utf-8") as fp:
                try:
                    loaded = json.load(fp)
                    if isinstance(loaded, list):
                        logs = loaded
                except json.JSONDecodeError:
                    pass
        logs.append(entry)
        with log_file.open("w", encoding="utf-8") as fp:
            json.dump(logs, fp, ensure_ascii=False, indent=2)

# -----------------------------------------------------------------------------
# HTTP Endpoint'leri
# -----------------------------------------------------------------------------
@app.route("/")
def index():
    session.permanent = True
    session.setdefault("user_id", datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f"))
    session.setdefault("session_id", generate_session_id())
    session.setdefault("thread_id", None)
    session.setdefault("current_personality", DEFAULT_PERSONALITY)
    if not session.get("messages"):
        session["messages"] = build_system_messages(session["current_personality"])
    return send_from_directory("static", "index.html")

@app.route("/chat", methods=["POST"])
def chat():
    try:
        message = request.json.get("message")
        if not message:
            return jsonify({"error": "Mesaj boş olamaz"}), 400
        
        try:
            session_id = session["session_id"]
            user_id = session["user_id"]
        except KeyError:
            return jsonify({"error": "Oturum bilgileri bulunamadı. Lütfen sayfayı yenileyin."}), 400

        if message.startswith("/"):
            cmd = message[1:]
            if cmd in ASSISTANT_PERSONALITIES:
                session["current_personality"] = cmd
                session.modified = True
                return jsonify({"content": f"Kişiliği '{cmd}' olarak ayarladım."}), 200

        session["messages"] = strip_old_rag(session["messages"])

        history = session["messages"][SYSTEM_PREFIX_LENGTH:]
        if len(history) > MAX_HISTORY_MESSAGES:
            summary_source = history[:-MAX_HISTORY_MESSAGES]
            summary_prompt = [
                {"role": "system", "content": "Lütfen aşağıdaki sohbeti 2-3 cümleyle özetle:"},
                *summary_source
            ]
            summary_resp = client.chat.completions.create(
                model="gpt-4.1-mini",
                messages=summary_prompt
            ).choices[0].message.content
            session["messages"] = (
                session["messages"][:SYSTEM_PREFIX_LENGTH]
                + [{"role": "system", "content": "[Özet] " + summary_resp}]
                + history[-MAX_HISTORY_MESSAGES:]
            )
            session["messages"] = strip_old_summary(session["messages"])
            session["messages"] = trim_history(session["messages"])
            session.modified = True

        top_sims = find_most_similar(message, k=3)
        rag_hits: List[Dict[str, Any]] = []
        if top_sims and top_sims[0]["similarity"] >= dynamic_threshold(len(message.split())):
            rag_hits = [
                {
                    "question": sim_item["question"],
                    "answer": sim_item["answer"],
                    "similarity": sim_item["similarity"],
                }
                for sim_item in top_sims
            ]
            rag_parts = []
            for i, sim_item in enumerate(top_sims):
                rag_parts.append(
                    f"Benzer Soru {i+1} (Benzerlik: {sim_item['similarity']:.3f}): {sim_item['question']}\n"
                    f"Örnek Cevap {i+1}: {sim_item['answer']}"
                )
            rag_content = (
                "[RAG] İşte soruna benzeyen bazı önceki soru-cevap çiftleri:\n\n"
                + "\n\n".join(rag_parts)
            )
            session["messages"].append({"role": "system", "content": rag_content})

        session["messages"].append({"role": "user", "content": message})
        if len(session["messages"]) > MAX_CONTEXT_MESSAGES:
            session["messages"] = trim_history(session["messages"])
        session.modified = True
        
        def generate(current_session_id: str, current_user_id: str):
            collected: list[str] = []
            try:
                completion = client.chat.completions.create(
                    model="gpt-4.1-mini",
                    messages=session["messages"],
                    temperature=0.75,
                    top_p=0.9,
                    stream=True,
                )
                for chunk in completion:
                    delta = chunk.choices[0].delta.content
                    if delta:
                        collected.append(delta)
                        yield f"data: {json.dumps({'content': delta})}\n\n"
            except APITimeoutError:
                app.logger.warning(
                    "OpenAI zaman aşımı: session=%s user=%s", current_session_id, current_user_id
                )
                payload = {
                    "event": "error",
                    "message": "Üzgünüm, yanıt üretme süresi doldu. Lütfen tekrar dener misin?",
                }
                yield f"data: {json.dumps(payload)}\n\n"
                return
            except RateLimitError:
                app.logger.warning(
                    "OpenAI kota aşıldı: session=%s user=%s", current_session_id, current_user_id
                )
                payload = {
                    "event": "error",
                    "message": "Şu an çok fazla istek var. Biraz sonra tekrar dene.",
                }
                yield f"data: {json.dumps(payload)}\n\n"
                return
            except APIError as err:
                app.logger.warning("OpenAI API hatası: %s", err)
                payload = {
                    "event": "error",
                    "message": "Yanıt oluştururken bir sorun çıktı. Lütfen tekrar dener misin?",
                }
                yield f"data: {json.dumps(payload)}\n\n"
                return
            except Exception:
                app.logger.exception("OpenAI çağrısı başarısız oldu")
                payload = {
                    "event": "error",
                    "message": "Beklenmeyen bir hata oluştu. Lütfen tekrar dene.",
                }
                yield f"data: {json.dumps(payload)}\n\n"
                return

            full_resp = "".join(collected)
            session["messages"].append({"role": "assistant", "content": full_resp})
            session.modified = True
            
            save_chat_log(
                current_session_id,
                current_user_id,
                message,
                full_resp,
                session.get("current_personality", DEFAULT_PERSONALITY),
                retrieval_hits=rag_hits or None,
            )
            yield f"data: {json.dumps({'event': 'end'})}\n\n"
        
        return Response(stream_with_context(generate(session_id, user_id)), mimetype="text/event-stream")

    except Exception as exc:
        app.logger.exception("[Error] %s", exc)
        return jsonify({
            "error": "Üzgünüm, şu an teknik bir sorun yaşıyoruz. Lütfen birkaç saniye sonra tekrar deneyin."
        }), 503

@app.route("/chat_history")
def get_chat_history():
    if "session_id" not in session or "user_id" not in session:
        return jsonify({"error": "Session veya kullanıcı bulunamadı"}), 404
    log_file = LOGS_DIR / session["session_id"] / f"chat_log_{session['user_id']}.json"
    if not log_file.exists():
        return jsonify([])
    with log_file.open("r", encoding="utf-8") as fp:
        return jsonify(json.load(fp))

@app.route("/all_sessions")
def get_all_sessions():
    if "user_id" not in session:
        return jsonify({"error": "Kullanıcı bulunamadı"}), 404
    out: list[Dict[str, Any]] = []
    for sess_id in LOGS_DIR.iterdir():
        f = sess_id / f"chat_log_{session['user_id']}.json"
        if f.exists():
            with f.open("r", encoding="utf-8") as fp:
                out.append({"session_id": sess_id.name, "logs": json.load(fp)})
    return jsonify(out)

@app.route("/new_chat", methods=["POST"])
def new_chat():
    pers = session.get("current_personality", DEFAULT_PERSONALITY)
    session["session_id"] = generate_session_id()
    session["messages"] = build_system_messages(pers)
    session.modified = True
    return jsonify({"message": "Yeni sohbet başlatıldı"})

@app.route("/set_personality", methods=["POST"])
def set_personality():
    pers = request.json.get("personality")
    if pers not in ASSISTANT_PERSONALITIES:
        return jsonify({"error": "Geçersiz kişilik"}), 400
    session["current_personality"] = pers
    session["messages"] = build_system_messages(pers)
    session.modified = True
    return jsonify({"message": f"Asistan kişiliği '{pers}' olarak değiştirildi"})

@app.route('/feedback', methods=['POST'])
def feedback():
    data = request.json or {}
    idx = data.get('messageIndex')
    fb = data.get('feedback')
    session_id = session.get('session_id')
    user_id = session.get('user_id')
    if not session_id or not user_id:
        return jsonify({"error": "Oturum bilgileri bulunamadı"}), 400

    log_file = LOGS_DIR / session_id / f"chat_log_{user_id}.json"
    if not log_file.exists():
        return jsonify({"error": "Log dosyası bulunamadı"}), 404

    lock = FileLock(str(log_file) + '.lock')
    with lock:
        try:
            logs = json.loads(log_file.read_text(encoding='utf-8'))
        except json.JSONDecodeError:
            return jsonify({"error": "Log dosyası okunamadı"}), 500

        if idx is None or not (0 <= idx < len(logs)):
            return jsonify({"error": "Geçersiz mesaj indeksi"}), 400

        logs[idx]['feedback'] = fb
        log_file.write_text(json.dumps(logs, ensure_ascii=False, indent=2), encoding='utf-8')
    return jsonify({"status": "ok"})

# -----------------------------------------------------------------------------
# Uygulamayı başlatma
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
