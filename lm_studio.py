from flask import Flask, request, jsonify, send_from_directory, session
from flask_cors import CORS
import os
import json
from datetime import datetime, timedelta
import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import time
import pickle
from pathlib import Path
import bz2
from typing import Tuple, List, Dict, Any
import requests

app = Flask(__name__, static_folder='static')
app.secret_key = 'your-secret-key'
app.config['SESSION_TYPE'] = 'filesystem'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=1)
app.config['SESSION_PERMANENT'] = True

# Tüm kaynaklara izin ver (güvenlik açısından dikkatli olun)
CORS(app, resources={r"/*": {"origins": "*"}})

# Varsayılan kişilik
DEFAULT_PERSONALITY = "huysuz"

# Farklı asistan kişilikleri
ASSISTANT_PERSONALITIES = {
    "huysuz": """Kapadokya Üniversitesinde Bir öğrenci işleri çalışanı olarak, öğrencilere rehberlik etmek için buradasın ancak onlara sert, agresif, olumsuz, huysuz ve moral bozucu bir şekilde cevap vereceksin. Öğrencilerin sordukları sorulara alaycı ve sabırsız bir tavırla yaklaşıp, mümkün olan en az yardımcı tutumu sergile. Yine de soruların net ve kesin cevaplarını verebilmelisin ve cevapların doğru olmalı, ancak olabildiğince tatsız bir şekilde ifade edilmeli.""",
    "notr": """Kapadokya Üniversitesinde bir öğrenci işleri çalışanı olarak, öğrencilere profesyonel ve tarafsız bir şekilde yardımcı olacaksın. Cevapların net, açık ve bilgilendirici olmalı. Ne çok resmi ne de çok samimi bir ton kullan. Sadece işini yapan bir memur gibi davran.""",
    "pozitif": """Kapadokya Üniversitesinde çalışan ve öğrencilere yardım etmeyi çok seven, aşırı pozitif bir öğrenci işleri görevlisisin. Her soruya büyük bir heyecan ve coşkuyla yaklaş. Öğrencileri sürekli cesaretlendir ve motive et. Her zorluğun üstesinden gelinebileceğini vurgula. Cevapların doğru ve yardımcı olmalı, ama bunu yaparken aşırı iyimser, neşeli ve destekleyici bir tavır sergile. Her cevabına mutlaka motive edici bir not ekle."""
}

# (İsteğe bağlı) data.json içeriğine göre benzer soruları bulmak için embedding manager
# Eğer data.json vs. kullanmayacaksanız, bu kısmı tamamen kaldırabilirsiniz.
class EmbeddingManager:
    def __init__(self, 
                 data_file: str = 'data.json',
                 cache_file: str = 'embeddings.pkl.bz2',
                 model_name: str = 'sentence-transformers/all-MiniLM-L6-v2'):
        self.data_file = Path(data_file)
        self.cache_file = Path(cache_file)
        self.model_name = model_name
        self.model = SentenceTransformer(model_name)
        
    def load_or_create(self) -> Tuple[List[Dict[str, Any]], np.ndarray]:
        """Embedding'leri yükle veya oluştur."""
        if self.cache_file.exists():
            try:
                with bz2.open(self.cache_file, 'rb') as f:
                    cached_data = pickle.load(f)
                if cached_data['data_modified_time'] == self.data_file.stat().st_mtime:
                    print("Cache geçerli, embedding'ler yüklendi.")
                    return cached_data['data'], cached_data['embeddings']
            except Exception as e:
                print(f"Cache yüklenirken hata: {e}")
        
        print("Embedding'ler hesaplanıyor...")
        data = self._load_data()
        embeddings = self._create_embeddings(data)
        self._save_cache(data, embeddings)
        return data, embeddings
    
    def _load_data(self) -> List[Dict[str, Any]]:
        if not self.data_file.exists():
            return []
        with open(self.data_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def _create_embeddings(self, data: List[Dict[str, Any]]) -> np.ndarray:
        questions = [item['question'] for item in data]
        return self.model.encode(
            questions, 
            show_progress_bar=True,
            batch_size=32,
            normalize_embeddings=True
        )
    
    def _save_cache(self, data: List[Dict[str, Any]], embeddings: np.ndarray):
        cache_data = {
            'data': data,
            'embeddings': embeddings,
            'data_modified_time': self.data_file.stat().st_mtime,
            'model_name': self.model_name
        }
        
        with bz2.open(self.cache_file, 'wb') as f:
            pickle.dump(cache_data, f)
        print("Embedding'ler kaydedildi.")

embedding_manager = EmbeddingManager()
DATA, EMBEDDINGS = embedding_manager.load_or_create()

def find_most_similar(query, top_k=1):
    """En benzer soruları bul."""
    if not DATA:
        return []
    query_embedding = embedding_manager.model.encode([query])
    similarities = cosine_similarity(query_embedding, EMBEDDINGS)[0]
    
    top_indices = np.argsort(similarities)[-top_k:][::-1]
    results = []
    for idx in top_indices:
        results.append({
            'question': DATA[idx]['question'],
            'answer': DATA[idx]['answer'],
            'similarity': float(similarities[idx])
        })
    return results

# LM Studio'ya istek atan basit fonksiyon
def call_local_llm(messages: List[Dict[str, str]]) -> str:
    """
    messages: [{"role": "system", "content": ...}, {"role": "user", "content": ...}]
    Bu fonksiyon, LM Studio'nun API'sine göre düzenlenmelidir.
    """
    prompt = ""
    for m in messages:
        if m["role"] == "system":
            prompt += f"<|SYSTEM|>\n{m['content']}\n"
        elif m["role"] == "user":
            prompt += f"<|USER|>\n{m['content']}\n"
        else:
            prompt += f"<|ASSISTANT|>\n{m['content']}\n"
    prompt += "<|ASSISTANT|>\n"

    payload = {
        "prompt": prompt,
        "max_new_tokens": 256,
        "temperature": 0.7,
        "top_k": 40,
        "stop": ["<|USER|>", "<|SYSTEM|>", "<|ASSISTANT|>"]
    }

    try:
        response = requests.post(
            "http://192.168.1.96:60123/api/v1/generate",
            json=payload,
            timeout=30
        )
        response.raise_for_status()
        data = response.json()

        if "results" in data and len(data["results"]) > 0:
            return data["results"][0]["text"]
        else:
            return "Üzgünüm, bir cevap üretemedim."
    except Exception as e:
        print("LM Studio isteğinde hata:", e)
        return "Üzgünüm, şu anda bir hata oluştu."

# index.html dosyanızla aynı klasörde static/index.html varsa onu serve edecek
@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

@app.route('/chat', methods=['POST'])
def chat():
    try:
        message = request.json.get('message', "")
        if not message.strip():
            return jsonify({"error": "Mesaj boş olamaz"}), 400

        # Session'da mesaj geçmişi yoksa başlat
        if 'messages' not in session:
            # Varsayılan kişilik "huysuz"
            session['messages'] = [
                {"role": "system", "content": ASSISTANT_PERSONALITIES[DEFAULT_PERSONALITY]}
            ]

        # Kısa isek benzer soru arama
        words = message.strip().split()
        if len(words) >= 3:
            similar_results = find_most_similar(message, top_k=1)
            threshold = 0.8
            if similar_results and similar_results[0]['similarity'] > threshold:
                # data.json'dan benzer soru cevabını prompt'a ekle
                message += (
                    f"\n\nNot: Benzer bir örnek:\n"
                    f"- Benzer soru: {similar_results[0]['question']}\n"
                    f"- Örnek cevap: {similar_results[0]['answer']}\n"
                )

        # Kullanıcı mesajını ekle
        session['messages'].append({"role": "user", "content": message})

        # LLM'e gönder
        response_text = call_local_llm(session['messages'])

        # Asistan yanıtını session'a ekle
        session['messages'].append({"role": "assistant", "content": response_text})

        # İsterseniz session'ı budayabilirsiniz (çok uzamasın diye)
        # if len(session['messages']) > 10:
        #     session['messages'] = session['messages'][-10:]

        # JSON döndür
        return jsonify({"assistant_response": response_text})

    except Exception as e:
        print("Hata detayı:", e)
        return jsonify({"error": str(e)}), 500

@app.route('/set_personality', methods=['POST'])
def set_personality():
    """Asistan kişiliğini değiştirir."""
    try:
        personality = request.json.get('personality', DEFAULT_PERSONALITY)
        if personality not in ASSISTANT_PERSONALITIES:
            personality = DEFAULT_PERSONALITY

        # Yeni session mesajları (istemiyorsanız eskileri koruyun)
        session['messages'] = [
            {"role": "system", "content": ASSISTANT_PERSONALITIES[personality]}
        ]
        return jsonify({
            "message": f"Kişilik '{personality}' olarak ayarlandı."
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/new_chat', methods=['POST'])
def new_chat():
    """Yeni bir sohbet başlatır (kişiliği sıfırlar)."""
    try:
        session.pop('messages', None)
        return jsonify({"message": "Yeni sohbet başlatıldı."})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
