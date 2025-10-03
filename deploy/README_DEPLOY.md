Bu klasör, uygulamayı `https://asistan.kapadokya.edu.tr/` altında yayınlamak için gerekli sunucu kurulum adımlarını ve örnek yapılandırma dosyalarını içerir. Özetle; uygulama Gunicorn ile `127.0.0.1:5000` üzerinde çalışacak, Nginx ise 80/443 portlarından gelen trafiği uygulamaya reverse‑proxy edecektir. TLS (Let's Encrypt) ile otomatik sertifika sağlanır.

ÖNEMLİ: Aşağıdaki adımlar Ubuntu/Debian tabanlı bir sunucu için hazırlanmıştır ve kök dizin `/opt/chatbot` varsayımı ile yazılmıştır. Gerekirse yolları/kimlikleri uyarlayın.

1) DNS
- `asistan.kapadokya.edu.tr` için A kaydı oluşturun ve sunucu IP’sine (örn. `85.111.102.147`) yönlendirin.
- DNS yayılımı tamamlanmadan TLS kurulumu başarısız olabilir; gerekirse birkaç dakika bekleyin.

2) Sunucu Önkoşulları
- Sistem paketleri ve servisler:
  - `sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx redis-server python3-venv`
- Güvenlik duvarı (varsa):
  - `sudo ufw allow 'Nginx Full'`
  - (İsteğe bağlı) Uygulama portunu dış erişime kapatın: `sudo ufw deny 5000`

3) Uygulama Hazırlığı
- Kodun bulunduğu dizin: `/opt/chatbot` (gerekirse taşıyın)
- Sanal ortam ve bağımlılıklar:
  - `cd /opt/chatbot`
  - `python3 -m venv venv`
  - `source venv/bin/activate`
  - `pip install --upgrade pip`
  - `pip install -r requirements.txt`

4) Ortam Değişkenleri (.env)
- `.env` dosyasını `/opt/chatbot/.env` konumunda tutun. Aşağıdaki anahtarları içermelidir:
  - `OPENAI_API_KEY=...` (gizli anahtarınızı yazın)
  - `REDIS_URL=redis://[:parola]@127.0.0.1:6379/0` (Redis varsa parola belirleyin)
  - (Önerilir) `FLASK_SECRET_KEY=$(python3 - <<'PY'\nimport secrets; print(secrets.token_hex(32))\nPY\n)`
- Not: Gizli anahtarları kesinlikle Git’e koymayın. `.env` zaten `.gitignore`’da.

5) Redis
- `sudo systemctl enable --now redis-server`
- `/etc/redis/redis.conf` içinde aşağıdaki ayarları öneririz (yeniden başlatma gerekir):
  - `bind 127.0.0.1 ::1`
  - `protected-mode yes`
  - (İsteğe bağlı) `requirepass <güçlü-parola>` ve `.env` içindeki `REDIS_URL`’ü buna göre güncelleyin.
- `sudo systemctl restart redis-server`

6) Gunicorn Servisi (systemd)
- Dosyayı kopyalayın: `sudo cp /opt/chatbot/deploy/systemd/kun-chatbot.service /etc/systemd/system/`
- Gerekirse `User`/`Group` ve `WorkingDirectory` yollarını düzenleyin.
- Servisi etkinleştirip başlatın:
  - `sudo systemctl daemon-reload`
  - `sudo systemctl enable --now kun-chatbot.service`
  - Durumu kontrol: `systemctl status kun-chatbot.service`

7) Nginx Reverse Proxy
- Nginx site yapılandırmasını yerleştirin:
  - `sudo cp /opt/chatbot/deploy/nginx/asistan.kapadokya.edu.tr.conf /etc/nginx/sites-available/`
  - `sudo ln -s /etc/nginx/sites-available/asistan.kapadokya.edu.tr.conf /etc/nginx/sites-enabled/`
  - Test: `sudo nginx -t`
  - Uygula: `sudo systemctl reload nginx`

8) TLS (Let's Encrypt)
- Sertifikayı alın ve otomatik HTTPS yönlendirmesi kurun:
  - `sudo certbot --nginx -d asistan.kapadokya.edu.tr -m admin@kapadokya.edu.tr --agree-tos --redirect`
- Sertifika yenilemesi otomatik olarak zamanlanır, manuel test: `sudo certbot renew --dry-run`

9) Doğrulama
- Uygulama portu yerel loopback’te dinliyor olmalı: `ss -lntp | grep 5000`
- `curl -I http://127.0.0.1:5000/` ile yerelde cevap alındığını kontrol edin.
- `curl -I https://asistan.kapadokya.edu.tr/` ile dışarıdan erişimi doğrulayın.
- SSE için (proxy buffering kapalı): `curl -N -H 'Accept: text/event-stream' -X POST https://asistan.kapadokya.edu.tr/chat -H 'Content-Type: application/json' --data '{"message":"merhaba"}'`

10) Güvenlik ve İnce Ayarlar
- 5000 portunu dış dünyaya kapatın veya yalnızca `127.0.0.1`’e bind edin (bu dosyadaki Gunicorn komutu zaten `127.0.0.1` kullanır).
- Nginx içinde `location /chat` için `proxy_buffering off` ayarlı; SSE için gereklidir.
- Uzun yanıtlar için `proxy_read_timeout` artırılmıştır.

Sorun Giderme
- `journalctl -u kun-chatbot.service -e` ile uygulama logları
- `sudo tail -f /var/log/nginx/access.log /var/log/nginx/error.log` ile Nginx logları
- `systemctl status redis-server` Redis durumu

