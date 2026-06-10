# Deploy na VPS

Guia de como esse projeto roda na VPS e como atualizá-lo.

## Como funciona

Este é um projeto **TanStack Start** (React full-stack com SSR), criado no Lovable.
Por isso **não é um site estático** — ele precisa de um **servidor Node rodando**.

Arquitetura na VPS:

```
Navegador  ──►  nginx (porta 3000)  ──►  servidor Node (porta 3005)  ──►  PM2 mantém de pé
```

- **Pasta do projeto:** `/var/www/gsolutions`
- **Servidor Node:** porta interna `3005`
- **nginx:** escuta na porta `3000` e repassa (proxy) pra `127.0.0.1:3005`
  - arquivo: `/etc/nginx/sites-enabled/gsolutions`
- **PM2:** mantém o app `gsolutions` rodando e sobe sozinho no reboot

> O `vite.config.ts` tem `nitro: true`. Isso é o que faz o build gerar o servidor
> Node (`.output/server/index.mjs`) ao buildar fora do ambiente Lovable. Não remova.

---

## Atualizar (deploy de novas mudanças)

Depois de mudar algo no GitHub, rode na VPS:

```bash
cd /var/www/gsolutions
git pull
npm install
NITRO_PRESET=node-server npm run build
pm2 restart gsolutions
```

Depois atualize a página no navegador (`Ctrl + F5` se não aparecer a mudança).

---

## Acesso

- Site: `http://IP_DA_VPS:3000`

---

## Comandos úteis (na VPS)

```bash
# ver status dos apps
pm2 list

# ver logs do app (erros, etc)
pm2 logs gsolutions

# reiniciar só esse app
pm2 restart gsolutions

# testar se o servidor Node responde direto
curl -I http://127.0.0.1:3005

# testar e recarregar o nginx após mudar config
sudo nginx -t
sudo systemctl reload nginx
```

---

## Primeira instalação (referência, caso precise refazer do zero)

```bash
cd /var/www
git clone https://github.com/gvpaixao12/mirror-landing-page.git gsolutions
cd gsolutions
npm install
NITRO_PRESET=node-server npm run build

# subir com PM2 na porta 3005
PORT=3005 pm2 start .output/server/index.mjs --name gsolutions
pm2 save
pm2 startup   # rode o comando que ele imprimir

# config do nginx em /etc/nginx/sites-enabled/gsolutions:
#   server {
#       listen 3000;
#       listen [::]:3000;
#       server_name _;
#       location / {
#           proxy_pass http://127.0.0.1:3005;
#           proxy_http_version 1.1;
#           proxy_set_header Host $host;
#           proxy_set_header X-Real-IP $remote_addr;
#           proxy_set_header Upgrade $http_upgrade;
#           proxy_set_header Connection "upgrade";
#           proxy_read_timeout 120s;
#       }
#   }

sudo nginx -t
sudo systemctl reload nginx
```
