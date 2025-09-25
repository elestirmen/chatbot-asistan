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
import time
import uuid
import json
import math
import os
import re
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
    stream_with_context, render_template, Blueprint,
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
ANALYTICS_DIR = Path("analytics"); ANALYTICS_DIR.mkdir(exist_ok=True)
DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)
EMBEDDING_CACHE = Path("embeddings.pkl.bz2")
MODEL_NAME = os.getenv("MODEL_NAME", "intfloat/multilingual-e5-base")
MODEL_PATH = os.getenv("MODEL_PATH")
MODEL = SentenceTransformer(MODEL_PATH) if MODEL_PATH else SentenceTransformer(MODEL_NAME)
DEFAULT_QA_FILE = "expanded_data.json"
APP_VERSION = "stabil-rag-3.3"


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
# Analytics Event Logger (NDJSON – one event per line)
# -----------------------------------------------------------------------------

def _iso_utc(dt: Optional[datetime] = None) -> str:
    dt = dt or datetime.utcnow()
    # Use Zulu-style for clarity; store seconds precision
    return dt.replace(microsecond=0).isoformat() + "Z"


def _events_file_for(dt: Optional[datetime] = None) -> Path:
    dt = dt or datetime.utcnow()
    return ANALYTICS_DIR / f"events_{dt.strftime('%Y%m%d')}.ndjson"


class EventLogger:
    def __init__(self, root: Path):
        self.root = root

    def append(self, event: Dict[str, Any]) -> None:
        fpath = _events_file_for()
        lock = FileLock(str(fpath) + ".lock")
        with lock:
            with fpath.open("a", encoding="utf-8") as fp:
                fp.write(json.dumps(event, ensure_ascii=False) + "\n")


event_logger = EventLogger(ANALYTICS_DIR)

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
    # Analytics: log session start once per browser session
    if not session.get("_analytics_session_started"):
        try:
            event_logger.append(_make_event(
                "session_start",
                session_id=session.get("session_id"),
                user_id=session.get("user_id"),
                personality=session.get("current_personality", DEFAULT_PERSONALITY),
                ip=request.headers.get('X-Forwarded-For', request.remote_addr),
            ))
            session["_analytics_session_started"] = True
            session.modified = True
        except Exception:
            app.logger.exception("analytics session_start could not be logged")
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

        # Turn timing and indexing
        _turn_started_at = time.perf_counter()
        turn_index = int(session.get("turn_index", 0))

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
        rag_applied = False
        if top_sims and top_sims[0]["similarity"] >= dynamic_threshold(len(message.split())):
            rag_hits = [
                {
                    "question": sim_item["question"],
                    "answer": sim_item["answer"],
                    "similarity": sim_item["similarity"],
                }
                for sim_item in top_sims
            ]
            rag_applied = True
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

        # Analytics: log user_message event
        try:
            rag_sims = [float(x.get("similarity", 0.0)) for x in rag_hits]
            event_logger.append(_make_event(
                "user_message",
                session_id=session_id,
                user_id=user_id,
                turn_index=turn_index,
                personality=session.get("current_personality", DEFAULT_PERSONALITY),
                prompt_chars=len(message or ""),
                history_len=max(0, len(session.get("messages", [])) - SYSTEM_PREFIX_LENGTH),
                rag_applied=rag_applied,
                rag_hits_count=len(rag_hits),
                rag_similarities=rag_sims,
                rag_top_similarity=(max(rag_sims) if rag_sims else None),
            ))
        except Exception:
            app.logger.exception("analytics user_message could not be logged")
        
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
                try:
                    event_logger.append(_make_event(
                        "assistant_error",
                        session_id=current_session_id,
                        user_id=current_user_id,
                        turn_index=turn_index,
                        error_type="timeout",
                    ))
                except Exception:
                    app.logger.exception("analytics assistant_error timeout could not be logged")
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
                try:
                    event_logger.append(_make_event(
                        "assistant_error",
                        session_id=current_session_id,
                        user_id=current_user_id,
                        turn_index=turn_index,
                        error_type="rate_limit",
                    ))
                except Exception:
                    app.logger.exception("analytics assistant_error rate_limit could not be logged")
                yield f"data: {json.dumps(payload)}\n\n"
                return
            except APIError as err:
                app.logger.warning("OpenAI API hatası: %s", err)
                payload = {
                    "event": "error",
                    "message": "Yanıt oluştururken bir sorun çıktı. Lütfen tekrar dener misin?",
                }
                try:
                    event_logger.append(_make_event(
                        "assistant_error",
                        session_id=current_session_id,
                        user_id=current_user_id,
                        turn_index=turn_index,
                        error_type="api_error",
                    ))
                except Exception:
                    app.logger.exception("analytics assistant_error api_error could not be logged")
                yield f"data: {json.dumps(payload)}\n\n"
                return
            except Exception:
                app.logger.exception("OpenAI çağrısı başarısız oldu")
                payload = {
                    "event": "error",
                    "message": "Beklenmeyen bir hata oluştu. Lütfen tekrar dene.",
                }
                try:
                    event_logger.append(_make_event(
                        "assistant_error",
                        session_id=current_session_id,
                        user_id=current_user_id,
                        turn_index=turn_index,
                        error_type="unknown",
                    ))
                except Exception:
                    app.logger.exception("analytics assistant_error unknown could not be logged")
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
            # Analytics: assistant_response event & increment turn
            try:
                latency_ms = int((time.perf_counter() - _turn_started_at) * 1000)
                event_logger.append(_make_event(
                    "assistant_response",
                    session_id=current_session_id,
                    user_id=current_user_id,
                    turn_index=turn_index,
                    response_chars=len(full_resp or ""),
                    latency_ms=latency_ms,
                    rag_applied=rag_applied,
                    rag_hits_count=len(rag_hits),
                ))
                session["turn_index"] = turn_index + 1
                session.modified = True
            except Exception:
                app.logger.exception("analytics assistant_response could not be logged")
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
    try:
        event_logger.append(_make_event(
            "session_reset",
            session_id=session.get("session_id"),
            user_id=session.get("user_id"),
            personality=pers,
        ))
    except Exception:
        app.logger.exception("analytics session_reset could not be logged")
    return jsonify({"message": "Yeni sohbet başlatıldı"})

@app.route("/set_personality", methods=["POST"])
def set_personality():
    pers = request.json.get("personality")
    if pers not in ASSISTANT_PERSONALITIES:
        return jsonify({"error": "Geçersiz kişilik"}), 400
    session["current_personality"] = pers
    session["messages"] = build_system_messages(pers)
    session.modified = True
    try:
        event_logger.append(_make_event(
            "personality_change",
            session_id=session.get("session_id"),
            user_id=session.get("user_id"),
            personality=pers,
        ))
    except Exception:
        app.logger.exception("analytics personality_change could not be logged")
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
    # Analytics: log feedback update
    try:
        event_logger.append(_make_event(
            "feedback_update",
            session_id=session_id,
            user_id=user_id,
            message_index=idx,
            feedback=fb,
        ))
    except Exception:
        app.logger.exception("analytics feedback_update could not be logged")
    return jsonify({"status": "ok"})

# -----------------------------------------------------------------------------
# Admin Blueprint (/admin)
# -----------------------------------------------------------------------------


admin_bp = Blueprint("admin", __name__)


def _list_json_files() -> List[str]:
    return sorted(f.name for f in DATA_DIR.glob('*.json'))


def _canonical(items: List[dict]) -> List[dict]:
    out = []
    for it in items:
        if 'questions' in it and isinstance(it['questions'], (list, tuple)):
            qs = [str(q).strip() for q in it['questions'] if str(q).strip()]
            if qs and 'answer' in it:
                out.append({'questions': qs, 'answer': it['answer']})
        elif 'question' in it and 'answer' in it:
            q = str(it['question']).strip()
            if q:
                out.append({'questions': [q], 'answer': it['answer']})
    return out


def _load_data(filename: str = DEFAULT_QA_FILE) -> List[dict]:
    path = DATA_DIR / filename
    if not path.exists():
        return []
    try:
        raw = json.loads(path.read_text('utf-8'))
    except Exception:
        return []
    data = _canonical(raw)
    if data != raw:
        _save_data(data, filename)
    return data


def _save_data(data: List[dict], filename: str = DEFAULT_QA_FILE):
    path = DATA_DIR / filename
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), 'utf-8')


@admin_bp.route('/')
def admin_home():
    return render_template('admin.html', PY_DEFAULT_F=DEFAULT_QA_FILE)


@admin_bp.route('/api/files')
def admin_files_route():
    return jsonify(_list_json_files())


@admin_bp.route('/api/auth_status')
def admin_auth_status():
    return jsonify({'authenticated': bool(session.get('admin_authenticated', False))})


@admin_bp.route('/api/login', methods=['POST'])
def admin_login_route():
    payload = request.get_json(silent=True) or {}
    expected = os.getenv('ADMIN_PASSWORD') or os.getenv('APP_PASSWORD') or 'Kun2025'
    if payload.get('password') == expected:
        session['admin_authenticated'] = True
        session.modified = True
        return jsonify({'authenticated': True})
    session.pop('admin_authenticated', None)
    return jsonify({'authenticated': False, 'message': 'Şifre yanlış.'}), 401


@admin_bp.route('/api/logout', methods=['POST'])
def admin_logout_route():
    session.pop('admin_authenticated', None)
    session.modified = True
    return jsonify({'logged_out': True})


@admin_bp.route('/api/items', methods=['GET', 'POST'])
def admin_items_collection_route():
    fname = request.args.get('file', DEFAULT_QA_FILE)
    if request.method == 'GET':
        return jsonify(_load_data(fname))
    if not session.get('admin_authenticated'):
        return jsonify({'error': 'Unauthorized', 'message': 'Bu işlem için giriş yapmalısınız.'}), 401
    payload = request.get_json(force=True)
    if 'questions' not in payload or 'answer' not in payload:
        return jsonify({'error': 'Bad Request', 'message': 'Eksik "questions" veya "answer" alanı.'}), 400
    processed = _canonical([{'questions': payload.get('questions'), 'answer': payload.get('answer')}])
    if not processed:
        return jsonify({'error': 'Bad Request', 'message': 'Geçersiz soru/cevap formatı.'}), 400
    data = _load_data(fname)
    data.append(processed[0])
    _save_data(data, fname)
    return jsonify({'ok': True}), 201


@admin_bp.route('/api/items/<int:idx>', methods=['PUT', 'DELETE'])
def admin_item_singular_route(idx: int):
    if not session.get('admin_authenticated'):
        return jsonify({'error': 'Unauthorized', 'message': 'Bu işlem için giriş yapmalısınız.'}), 401
    fname = request.args.get('file', DEFAULT_QA_FILE)
    data = _load_data(fname)
    if not (0 <= idx < len(data)):
        return jsonify({'error': 'Geçersiz index'}), 404
    if request.method == 'PUT':
        payload = request.get_json(force=True)
        if 'questions' not in payload or 'answer' not in payload:
            return jsonify({'error': 'Bad Request', 'message': 'Eksik "questions" veya "answer" alanı.'}), 400
        processed = _canonical([{'questions': payload.get('questions'), 'answer': payload.get('answer')}])
        if not processed:
            return jsonify({'error': 'Bad Request', 'message': 'Geçersiz soru/cevap formatı.'}), 400
        data[idx] = processed[0]
        _save_data(data, fname)
        return jsonify({'ok': True})
    removed = data.pop(idx)
    _save_data(data, fname)
    return jsonify(removed)


def _list_sessions() -> List[Dict[str, Any]]:
    if not LOGS_DIR.exists():
        return []
    sessions: List[Dict[str, Any]] = []
    for p in LOGS_DIR.iterdir():
        if not (p.is_dir() and re.match(r'^(sess|session)_', p.name)):
            continue
        last_ts: Optional[datetime] = None
        # Try to infer last activity from contained files
        for f in p.glob('*.json'):
            try:
                data = json.loads(f.read_text(encoding='utf-8'))
                if isinstance(data, list) and data:
                    ts_str = data[-1].get('timestamp')
                    if ts_str:
                        try:
                            ts = datetime.strptime(ts_str, '%Y-%m-%d %H:%M:%S')
                        except Exception:
                            ts = None
                        if ts and (last_ts is None or ts > last_ts):
                            last_ts = ts
            except Exception:
                pass
        sessions.append({
            'session_id': p.name,
            'last_activity': last_ts.isoformat(sep=' ') if last_ts else None,
            'last_activity_ts': last_ts.timestamp() if last_ts else 0,
        })
    sessions.sort(key=lambda x: x.get('last_activity_ts', 0), reverse=True)
    return sessions


def _list_user_logs(session_id: str) -> List[Dict[str, Any]]:
    sess_dir = LOGS_DIR / session_id
    if not sess_dir.exists() or not sess_dir.is_dir():
        return []
    out: List[Dict[str, Any]] = []
    for f in sorted(sess_dir.glob('*.json')):
        m = re.match(r'^chat_log_(.+)\.json$', f.name)
        user_id = m.group(1) if m else f.stem
        total = like = dislike = unrated = 0
        last_ts = None
        try:
            data = json.loads(f.read_text(encoding='utf-8'))
            if isinstance(data, list):
                total = len(data)
                for e in data:
                    fb = e.get('feedback')
                    if fb == 'like':
                        like += 1
                    elif fb == 'dislike':
                        dislike += 1
                    else:
                        unrated += 1
                if data:
                    ts_str = data[-1].get('timestamp')
                    if ts_str:
                        try:
                            last_ts = datetime.strptime(ts_str, '%Y-%m-%d %H:%M:%S')
                        except Exception:
                            last_ts = None
        except Exception:
            pass
        out.append({
            'file': f.name,
            'user_id': user_id,
            'total': total,
            'like': like,
            'dislike': dislike,
            'unrated': unrated,
            'last_activity': last_ts.isoformat(sep=' ') if last_ts else None,
            'last_activity_ts': last_ts.timestamp() if last_ts else 0,
        })
    out.sort(key=lambda x: x.get('last_activity_ts', 0), reverse=True)
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


def _parse_dt(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    s = s.strip()
    for fmt in ('%Y-%m-%d', '%Y-%m-%d %H:%M:%S'):
        try:
            dt = datetime.strptime(s, fmt)
            if fmt == '%Y-%m-%d':
                return datetime(dt.year, dt.month, dt.day)
            return dt
        except Exception:
            continue
    return None


def _season_from_ts(ts_str: Optional[str]) -> Optional[str]:
    """Akademik sezonu (YYYY-YYYY+1) zaman damgasından türet.
    Eylül (9) ve sonrası yeni sezon başlangıcı kabul edilir.
    """
    if not ts_str:
        return None
    try:
        ts = datetime.strptime(ts_str, '%Y-%m-%d %H:%M:%S')
    except Exception:
        return None
    year = ts.year
    if ts.month >= 9:
        return f"{year}-{year+1}"
    else:
        return f"{year-1}-{year}"


def _season_from_dt(dt: Optional[datetime]) -> Optional[str]:
    if not dt:
        return None
    year = dt.year
    if dt.month >= 9:
        return f"{year}-{year+1}"
    else:
        return f"{year-1}-{year}"


def _make_event(event_type: str, session_id: Optional[str], user_id: Optional[str], **fields: Any) -> Dict[str, Any]:
    now = datetime.utcnow()
    base = {
        "event_id": uuid.uuid4().hex,
        "event_type": event_type,
        "ts": _iso_utc(now),
        "session_id": session_id,
        "user_id": user_id,
        "season": _season_from_dt(now),
        "app_version": APP_VERSION,
        "model": os.getenv("OPENAI_MODEL", "gpt-4.1-mini"),
    }
    base.update(fields)
    return base
    try:
        ts = datetime.strptime(ts_str, '%Y-%m-%d %H:%M:%S')
    except Exception:
        return None
    year = ts.year
    if ts.month >= 9:
        return f"{year}-{year+1}"
    else:
        return f"{year-1}-{year}"


@admin_bp.route('/api/chat/logs_advanced')
def admin_api_chat_logs_advanced():
    if not session.get('admin_authenticated'):
        return jsonify({'error': 'Unauthorized'}), 401
    sess = request.args.get('session', '')
    user_id = request.args.get('user_id', '')
    fb = (request.args.get('feedback') or 'any').lower()
    q = (request.args.get('q') or '').strip().lower()
    rng = (request.args.get('range') or '').lower()
    from_s = request.args.get('from')
    to_s = request.args.get('to')
    season_filter = (request.args.get('season') or '').strip()
    
    # Pagination and sorting parameters
    try:
        page = max(1, int(request.args.get('page', 1)))
        per_page = min(1000, max(10, int(request.args.get('per_page', 25))))
    except ValueError:
        page = 1
        per_page = 25
    
    # Sorting parameter
    sort_order = request.args.get('sort', 'desc').lower()
    if sort_order not in ['asc', 'desc']:
        sort_order = 'desc'
    order_by = (request.args.get('order_by') or 'timestamp').lower()
    if order_by not in ['timestamp', 'natural']:
        order_by = 'timestamp'

    entries = _load_logs(sess, user_id)

    now = datetime.now()  # Use local time
    if rng == 'today':
        from_dt = datetime(now.year, now.month, now.day, 0, 0, 0)
        to_dt = datetime(now.year, now.month, now.day, 23, 59, 59)
    elif rng == '7d':
        from_dt = now - timedelta(days=7)
        to_dt = now
    elif rng == '30d':
        from_dt = now - timedelta(days=30)
        to_dt = now
    else:
        from_dt = _parse_dt(from_s)
        to_dt = _parse_dt(to_s)
        if to_dt and (to_s and len(to_s) == 10):
            to_dt = to_dt.replace(hour=23, minute=59, second=59)

    filtered: List[Dict[str, Any]] = []
    for e in entries:
        ts_ok = True
        ts_str = e.get('timestamp')
        if ts_str and (from_dt or to_dt):
            try:
                ts = datetime.strptime(ts_str, '%Y-%m-%d %H:%M:%S')
            except Exception:
                ts = None
            if ts is not None:
                if from_dt and ts < from_dt:
                    ts_ok = False
                if to_dt and ts > to_dt:
                    ts_ok = False
        if not ts_ok:
            continue
        if season_filter:
            sez = _season_from_ts(ts_str)
            if sez != season_filter:
                continue
        if fb in ('like', 'dislike', 'unrated'):
            fval = e.get('feedback')
            if fb == 'unrated' and fval:
                continue
            if fb in ('like', 'dislike') and fval != fb:
                continue
        if q:
            um = (e.get('user_message') or '').lower()
            ar = (e.get('assistant_response') or '').lower()
            if q not in um and q not in ar:
                continue
        filtered.append(e)

    # Sorting
    if order_by == 'timestamp':
        filtered.sort(key=lambda x: x.get('timestamp', ''), reverse=(sort_order == 'desc'))
    else:
        # natural (original file order). If desc, reverse after filtering
        if sort_order == 'desc':
            filtered.reverse()

    # Apply pagination to filtered results
    total_filtered = len(filtered)
    start_idx = (page - 1) * per_page
    end_idx = start_idx + per_page
    paginated_entries = filtered[start_idx:end_idx]
    
    summary = {
        'total': total_filtered,
        'like': sum(1 for e in filtered if e.get('feedback') == 'like'),
        'dislike': sum(1 for e in filtered if e.get('feedback') == 'dislike'),
        'unrated': sum(1 for e in filtered if not e.get('feedback')),
    }
    
    items = []
    for i, e in enumerate(paginated_entries, start=start_idx):
        items.append({
            'idx': i,
            'timestamp': e.get('timestamp'),
            'feedback': e.get('feedback'),
            'user_message': e.get('user_message'),
            'assistant_response': e.get('assistant_response'),
            'session_id': sess,
            'user_id': user_id,
            'season': _season_from_ts(e.get('timestamp')),
        })
    
    pagination = {
        'page': page,
        'per_page': per_page,
        'total': total_filtered,
        'pages': math.ceil(total_filtered / per_page) if total_filtered > 0 else 1,
        'has_prev': page > 1,
        'has_next': page < math.ceil(total_filtered / per_page) if total_filtered > 0 else False
    }
    
    return jsonify({
        'items': items,
        'summary': summary,
        'pagination': pagination
    })


# -----------------------------------------------------------------------------
# Analytics Summary (NDJSON-based)
# -----------------------------------------------------------------------------

def _iter_event_files():
    if not ANALYTICS_DIR.exists():
        return []
    return sorted(ANALYTICS_DIR.glob('events_*.ndjson'))


def _parse_iso_z(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        if s.endswith('Z'):
            s = s[:-1]
        return datetime.strptime(s, '%Y-%m-%dT%H:%M:%S')
    except Exception:
        return None


@admin_bp.route('/api/analytics/summary')
def admin_api_analytics_summary():
    if not session.get('admin_authenticated'):
        return jsonify({'error': 'Unauthorized'}), 401

    from_s = request.args.get('from')
    to_s = request.args.get('to')
    season_filter = (request.args.get('season') or '').strip()
    from_dt = _parse_dt(from_s)
    to_dt = _parse_dt(to_s)
    if to_dt and (to_s and len(to_s) == 10):
        to_dt = to_dt.replace(hour=23, minute=59, second=59)

    stats = {
        'total_events': 0,
        'unique_sessions': 0,
        'user_messages': 0,
        'assistant_responses': 0,
        'errors': 0,
        'errors_by_type': {},
        'feedback_like': 0,
        'feedback_dislike': 0,
        'avg_latency_ms': 0,
        'by_season': {},
        'range': {'from': None, 'to': None},
    }
    sessions_seen = set()
    latency_sum = 0
    latency_count = 0
    first_ts = None
    last_ts = None

    # Use chat logs directly for accurate stats (skip NDJSON analytics)
    # NDJSON analytics may be incomplete, so we rely on actual chat log files
    for sess in _list_sessions():
        sess_id = sess['session_id'] if isinstance(sess, dict) else sess
        sessions_seen.add(sess_id)
        for u in _list_user_logs(sess_id):
            entries = _load_logs(sess_id, u['user_id'])
            for e in entries:
                # Date filter
                ts_str = e.get('timestamp')
                ts = None
                if ts_str:
                    try:
                        ts = datetime.strptime(ts_str, '%Y-%m-%d %H:%M:%S')
                    except Exception:
                        pass
                
                if ts and ((from_dt and ts < from_dt) or (to_dt and ts > to_dt)):
                    continue
                
                # Season filter
                season = _season_from_ts(ts_str)
                if season_filter and season != season_filter:
                    continue
                
                stats['user_messages'] += 1
                stats['assistant_responses'] += 1
                
                # Feedback stats
                fb = e.get('feedback')
                if fb == 'like':
                    stats['feedback_like'] += 1
                elif fb == 'dislike':
                    stats['feedback_dislike'] += 1
                
                # Season stats
                if season:
                    s = stats['by_season'].setdefault(season, {
                        'events': 0,
                        'user_messages': 0,
                        'assistant_responses': 0,
                        'feedback_like': 0,
                        'feedback_dislike': 0,
                    })
                    s['user_messages'] += 1
                    s['assistant_responses'] += 1
                    if fb == 'like':
                        s['feedback_like'] += 1
                    elif fb == 'dislike':
                        s['feedback_dislike'] += 1
                
                # Track time range
                if ts:
                    if first_ts is None or ts < first_ts:
                        first_ts = ts
                    if last_ts is None or ts > last_ts:
                        last_ts = ts

    stats['unique_sessions'] = len(sessions_seen)
    stats['avg_latency_ms'] = int(latency_sum / latency_count) if latency_count > 0 else 0
    stats['range']['from'] = first_ts.isoformat(sep=' ') if first_ts else None
    stats['range']['to'] = last_ts.isoformat(sep=' ') if last_ts else None
    return jsonify(stats)


@admin_bp.route('/api/chat/stats_summary')
def admin_api_chat_stats_summary():
    """Get statistics directly from chat log files for accurate counts"""
    if not session.get('admin_authenticated'):
        return jsonify({'error': 'Unauthorized'}), 401
    
    stats = {
        'total_messages': 0,
        'user_messages': 0,
        'assistant_responses': 0,
        'feedback_like': 0,
        'feedback_dislike': 0,
        'feedback_unrated': 0,
        'unique_sessions': 0,
        'by_season': {},
        'by_personality': {}
    }
    
    sessions_seen = set()
    first_ts = None
    last_ts = None
    
    for sess in _list_sessions():
        sess_id = sess['session_id'] if isinstance(sess, dict) else sess
        sessions_seen.add(sess_id)
        
        for u in _list_user_logs(sess_id):
            entries = _load_logs(sess_id, u['user_id'])
            
            for e in entries:
                # Count messages
                stats['user_messages'] += 1
                stats['assistant_responses'] += 1
                stats['total_messages'] += 1  # Each entry represents one user-assistant exchange
                
                # Parse timestamp
                ts_str = e.get('timestamp')
                ts = None
                if ts_str:
                    try:
                        ts = datetime.strptime(ts_str, '%Y-%m-%d %H:%M:%S')
                    except Exception:
                        pass
                
                # Track time range
                if ts:
                    if first_ts is None or ts < first_ts:
                        first_ts = ts
                    if last_ts is None or ts > last_ts:
                        last_ts = ts
                
                # Feedback stats
                fb = e.get('feedback')
                if fb == 'like':
                    stats['feedback_like'] += 1
                elif fb == 'dislike':
                    stats['feedback_dislike'] += 1
                else:
                    stats['feedback_unrated'] += 1
                
                # Season stats
                season = _season_from_ts(ts_str)
                if season:
                    s = stats['by_season'].setdefault(season, {
                        'messages': 0,
                        'likes': 0,
                        'dislikes': 0,
                        'unrated': 0
                    })
                    s['messages'] += 1
                    if fb == 'like':
                        s['likes'] += 1
                    elif fb == 'dislike':
                        s['dislikes'] += 1
                    else:
                        s['unrated'] += 1
                
                # Personality stats
                pers = e.get('assistant_personality')
                if pers:
                    p = stats['by_personality'].setdefault(pers, {
                        'messages': 0,
                        'likes': 0,
                        'dislikes': 0,
                        'unrated': 0
                    })
                    p['messages'] += 1
                    if fb == 'like':
                        p['likes'] += 1
                    elif fb == 'dislike':
                        p['dislikes'] += 1
                    else:
                        p['unrated'] += 1
    
    stats['unique_sessions'] = len(sessions_seen)
    stats['range'] = {
        'from': first_ts.isoformat(sep=' ') if first_ts else None,
        'to': last_ts.isoformat(sep=' ') if last_ts else None
    }
    
    return jsonify(stats)


@admin_bp.route('/api/chat/sessions')
def admin_api_chat_sessions():
    if not session.get('admin_authenticated'):
        return jsonify({'error': 'Unauthorized'}), 401
    return jsonify(_list_sessions())


@admin_bp.route('/api/chat/users')
def admin_api_chat_users():
    if not session.get('admin_authenticated'):
        return jsonify({'error': 'Unauthorized'}), 401
    sess = request.args.get('session', '')
    return jsonify(_list_user_logs(sess))


@admin_bp.route('/api/chat/logs')
def admin_api_chat_logs():
    if not session.get('admin_authenticated'):
        return jsonify({'error': 'Unauthorized'}), 401
    sess = request.args.get('session', '')
    user_id = request.args.get('user_id', '')
    fb = (request.args.get('feedback') or 'any').lower()
    entries = _load_logs(sess, user_id)
    entries = _filter_feedback(entries, fb)
    out = []
    for i, e in enumerate(entries):
        out.append({
            'idx': i,
            'timestamp': e.get('timestamp'),
            'feedback': e.get('feedback'),
            'user_message': e.get('user_message'),
            'assistant_response': e.get('assistant_response'),
            'session_id': sess,
            'user_id': user_id,
            'season': _season_from_ts(e.get('timestamp')),
        })
    return jsonify(out)


@admin_bp.route('/api/chat/search_by_feedback')
def admin_api_chat_search_by_feedback():
    if not session.get('admin_authenticated'):
        return jsonify({'error': 'Unauthorized'}), 401
    fb = (request.args.get('feedback') or 'like').lower()
    season_filter = (request.args.get('season') or '').strip()
    sort_order = request.args.get('sort', 'desc').lower()
    try:
        limit = int(request.args.get('limit', '200'))
    except ValueError:
        limit = 200
    results: List[Dict[str, Any]] = []
    for sess in _list_sessions():
        sess_id = sess['session_id'] if isinstance(sess, dict) else sess
        for u in _list_user_logs(sess_id):
            entries = _load_logs(sess_id, u['user_id'])
            filtered = _filter_feedback(entries, fb)
            for idx, e in enumerate(filtered):
                if season_filter:
                    sez = _season_from_ts(e.get('timestamp'))
                    if sez != season_filter:
                        continue
                results.append({
                    'session_id': sess_id,
                    'user_id': u['user_id'],
                    'idx': idx,
                    'timestamp': e.get('timestamp'),
                    'feedback': e.get('feedback'),
                    'user_message': e.get('user_message'),
                    'assistant_response': e.get('assistant_response'),
                    'assistant_personality': e.get('assistant_personality'),
                    'retrieval_hits': e.get('retrieval_hits'),
                    'season': _season_from_ts(e.get('timestamp')),
                })
                if len(results) >= limit:
                    break
            if len(results) >= limit:
                break
        if len(results) >= limit:
            break
    
    # Sort results by timestamp
    if sort_order == 'desc':
        results.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
    else:
        results.sort(key=lambda x: x.get('timestamp', ''))
    
    return jsonify(results)


@admin_bp.route('/api/chat/global_search')
def admin_api_chat_global_search():
    """Global search across all chat logs with enhanced filtering"""
    if not session.get('admin_authenticated'):
        return jsonify({'error': 'Unauthorized'}), 401
    
    q = (request.args.get('q') or '').strip().lower()
    season_filter = (request.args.get('season') or '').strip()
    feedback_filter = (request.args.get('feedback') or '').strip().lower()
    personality_filter = (request.args.get('personality') or '').strip().lower()
    from_s = request.args.get('from')
    to_s = request.args.get('to')
    rng = (request.args.get('range') or '').lower()
    sort_order = request.args.get('sort', 'desc').lower()
    
    try:
        limit = int(request.args.get('limit', '100'))
        page = max(1, int(request.args.get('page', 1)))
        per_page = min(100, max(10, int(request.args.get('per_page', 25))))
    except ValueError:
        limit = 100
        page = 1
        per_page = 25
    
    # Parse date range - use local time instead of UTC
    now = datetime.now()  # Local time
    if rng == 'today':
        # Today: from 00:00:00 to 23:59:59
        from_dt = datetime(now.year, now.month, now.day, 0, 0, 0)
        to_dt = datetime(now.year, now.month, now.day, 23, 59, 59)
    elif rng == '7d':
        # Last 7 days
        from_dt = now - timedelta(days=7)
        to_dt = now
    elif rng == '30d':
        # Last 30 days  
        from_dt = now - timedelta(days=30)
        to_dt = now
    else:
        from_dt = _parse_dt(from_s)
        to_dt = _parse_dt(to_s)
        if to_dt and (to_s and len(to_s) == 10):
            to_dt = to_dt.replace(hour=23, minute=59, second=59)
    
    results: List[Dict[str, Any]] = []
    
    for sess in _list_sessions():
        sess_id = sess['session_id'] if isinstance(sess, dict) else sess
        for u in _list_user_logs(sess_id):
            entries = _load_logs(sess_id, u['user_id'])
            
            for idx, e in enumerate(entries):
                # Date filter
                ts_ok = True
                ts_str = e.get('timestamp')
                if ts_str and (from_dt or to_dt):
                    try:
                        ts = datetime.strptime(ts_str, '%Y-%m-%d %H:%M:%S')
                    except Exception:
                        ts = None
                    if ts is not None:
                        if from_dt and ts < from_dt:
                            ts_ok = False
                        if to_dt and ts > to_dt:
                            ts_ok = False
                if not ts_ok:
                    continue
                
                # Season filter
                if season_filter:
                    sez = _season_from_ts(ts_str)
                    if sez != season_filter:
                        continue
                
                # Text search filter
                if q:
                    um = (e.get('user_message') or '').lower()
                    ar = (e.get('assistant_response') or '').lower()
                    if q not in um and q not in ar:
                        continue
                
                # Feedback filter
                if feedback_filter:
                    fb = e.get('feedback')
                    if feedback_filter == 'unrated' and fb:
                        continue
                    if feedback_filter in ('like', 'dislike') and fb != feedback_filter:
                        continue
                
                # Personality filter
                if personality_filter:
                    pers = (e.get('assistant_personality') or '').lower()
                    if pers != personality_filter:
                        continue
                
                results.append({
                    'session_id': sess_id,
                    'user_id': u['user_id'],
                    'idx': idx,
                    'timestamp': e.get('timestamp'),
                    'feedback': e.get('feedback'),
                    'user_message': e.get('user_message'),
                    'assistant_response': e.get('assistant_response'),
                    'assistant_personality': e.get('assistant_personality'),
                    'retrieval_hits': e.get('retrieval_hits'),
                    'season': _season_from_ts(e.get('timestamp')),
                })
                
                # Early break for efficiency
                if len(results) >= limit:
                    break
            
            if len(results) >= limit:
                break
        
        if len(results) >= limit:
            break
    
    # Sort results
    if sort_order == 'desc':
        results.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
    else:
        results.sort(key=lambda x: x.get('timestamp', ''))
    
    # Log result count for debugging if needed
    # print(f"Global search found {len(results)} results for range: {rng}")
    
    # Apply pagination
    total = len(results)
    start_idx = (page - 1) * per_page
    end_idx = start_idx + per_page
    paginated_results = results[start_idx:end_idx]
    
    # Build pagination info
    pagination = {
        'page': page,
        'per_page': per_page,
        'total': total,
        'pages': math.ceil(total / per_page) if total > 0 else 1,
        'has_prev': page > 1,
        'has_next': page < math.ceil(total / per_page) if total > 0 else False
    }
    
    return jsonify({
        'items': paginated_results,
        'pagination': pagination,
        'summary': {
            'total': total,
            'like': sum(1 for e in results if e.get('feedback') == 'like'),
            'dislike': sum(1 for e in results if e.get('feedback') == 'dislike'),
            'unrated': sum(1 for e in results if not e.get('feedback')),
        }
    })


# Register blueprint
app.register_blueprint(admin_bp, url_prefix='/admin')
# -----------------------------------------------------------------------------
# Uygulamayı başlatma
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
