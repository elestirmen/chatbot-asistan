#!/usr/bin/env bash
set -euo pipefail

DOMAIN="asistan.kapadokya.edu.tr"
APP_DIR="/opt/chatbot"
VENV_DIR="$APP_DIR/venv"
SYSTEMD_UNIT="/etc/systemd/system/kun-chatbot.service"
NGINX_SITE_AVAIL="/etc/nginx/sites-available/${DOMAIN}.conf"
NGINX_SITE_ENABL="/etc/nginx/sites-enabled/${DOMAIN}.conf"
EMAIL="admin@kapadokya.edu.tr"

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "Hata: '$1' bulunamadı" >&2; exit 1; }
}

echo "[1/9] Paket kurulumları atlanıyor (nginx, certbot, redis, venv)";
export DEBIAN_FRONTEND=noninteractive
# İstendiği üzere paket yükleme adımları devre dışı bırakıldı.
# Aşağıdaki satırları yeniden etkinleştirerek kurulum yapılabilir:
# apt-get update -y
# apt-get install -y nginx certbot python3-certbot-nginx redis-server python3-venv

echo "[2/9] Redis başlatılıyor"
systemctl enable --now redis-server

echo "[3/9] Uygulama dizini: $APP_DIR"
if [[ ! -d "$APP_DIR" ]]; then
  echo "Hata: $APP_DIR bulunamadı. Bu dizine proje kodunu yerleştirin ve tekrar deneyin." >&2
  exit 1
fi

echo "[4/9] Sanal ortam ve bağımlılıklar"
python3 -m venv "$VENV_DIR"
source "$VENV_DIR/bin/activate"
pip install --upgrade pip
pip install -r "$APP_DIR/requirements.txt" gunicorn

if [[ ! -f "$APP_DIR/.env" ]]; then
  echo "Uyarı: $APP_DIR/.env bulunamadı. Örnek şablon oluşturuluyor. Lütfen doldurun ve servisi yeniden başlatın." >&2
  cat > "$APP_DIR/.env" <<'ENV'
OPENAI_API_KEY=
REDIS_URL=redis://127.0.0.1:6379/0
FLASK_SECRET_KEY=
ENV
  chown $(id -u):$(id -g) "$APP_DIR/.env" || true
fi

echo "[5/9] Redis yapılandırma (requirepass/bind/protected-mode)"
# REDIS_URL içinden parola çek ve Redis'e uygula (varsa)
APP_ENV_PATH="$APP_DIR/.env" REDIS_PASS=$(python3 - <<'PY'
import os, urllib.parse as up
env_path = os.environ.get('APP_ENV_PATH', '/opt/chatbot/.env')
passwd = ''
try:
    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            s = line.strip()
            if s.startswith('REDIS_URL='):
                url = s.split('=',1)[1]
                p = up.urlparse(url)
                passwd = p.password or ''
                break
except FileNotFoundError:
    pass
print(passwd)
PY
)

REDIS_CONF="/etc/redis/redis.conf"
if [[ -n "${REDIS_PASS}" ]]; then
  if grep -Eq '^[# ]*requirepass ' "$REDIS_CONF"; then
    sed -i "s|^[# ]*requirepass .*$|requirepass ${REDIS_PASS}|" "$REDIS_CONF"
  else
    echo "requirepass ${REDIS_PASS}" >> "$REDIS_CONF"
  fi
fi

if grep -Eq '^[# ]*bind ' "$REDIS_CONF"; then
  sed -i "s|^[# ]*bind .*$|bind 127.0.0.1 ::1|" "$REDIS_CONF"
else
  echo "bind 127.0.0.1 ::1" >> "$REDIS_CONF"
fi

if grep -Eq '^[# ]*protected-mode ' "$REDIS_CONF"; then
  sed -i "s|^[# ]*protected-mode .*$|protected-mode yes|" "$REDIS_CONF"
else
  echo "protected-mode yes" >> "$REDIS_CONF"
fi

systemctl restart redis-server

echo "[5/9] systemd servisi ayarlanıyor"
# Çalışan kullanıcıyı kullan
RUN_USER="${SUDO_USER:-${USER}}"
if id "$RUN_USER" >/dev/null 2>&1; then
  true
else
  echo "Hata: Kullanıcı tespit edilemedi." >&2
  exit 1
fi

cat > "$SYSTEMD_UNIT" <<SERVICE
[Unit]
Description=Kapadokya Chatbot (Gunicorn)
After=network.target redis-server.service
Wants=redis-server.service

[Service]
Type=simple
User=$RUN_USER
Group=$RUN_USER
WorkingDirectory=$APP_DIR
Environment=PYTHONUNBUFFERED=1
EnvironmentFile=$APP_DIR/.env
ExecStart=$VENV_DIR/bin/gunicorn -w 2 -k gthread --threads 8 --timeout 0 -b 127.0.0.1:5000 app:app
Restart=always
RestartSec=5
KillSignal=SIGTERM
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable --now kun-chatbot.service
systemctl restart kun-chatbot.service
sleep 1
systemctl --no-pager --full status kun-chatbot.service || true

echo "[6/9] Nginx site yapılandırması"
install -d /etc/nginx/sites-available /etc/nginx/sites-enabled
cat > "$NGINX_SITE_AVAIL" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/html;
        default_type "text/plain";
    }

    location /chat {
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_pass http://127.0.0.1:5000;
    }

    location / {
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
        proxy_pass http://127.0.0.1:5000;
    }
}
NGINX

ln -sf "$NGINX_SITE_AVAIL" "$NGINX_SITE_ENABL"
nginx -t
systemctl reload nginx

echo "[7/9] TLS sertifikası (Let's Encrypt)"
if command -v certbot >/dev/null 2>&1; then
  certbot --nginx -d "$DOMAIN" -m "$EMAIL" --agree-tos --redirect -n || true
else
  echo "Uyarı: certbot bulunamadı; HTTPS kurulamadı." >&2
fi

echo "[8/9] Doğrulama"
set +e
curl -sI http://127.0.0.1:5000/ | head -n1
curl -sI http://$DOMAIN/ | head -n1
set -e

echo "[9/9] Tamamlandı. Loglar: 'journalctl -u kun-chatbot.service -e' ve '/var/log/nginx/'"
