# Deploy en Railway

Arquitectura: **1 proyecto** con **3 piezas** → `postgres` (plugin) + `backend` (Django) + `frontend` (Vite static). Costo esperado: ~$5/mes con el crédito hobby.

---

## 1. Crear el proyecto

1. Entrar a https://railway.app y crear cuenta (login con GitHub).
2. Activar el plan **Hobby** ($5/mes, incluye $5 de uso) en Settings → Plans.
3. **New Project** → **Deploy from GitHub repo** → seleccionar `nicolasdimarco/RDS`.
4. Cuando pregunte qué deployar, **cancelar el deploy automático** (los servicios se crean a mano para apuntar a los subdirectorios `backend/` y `frontend/`).

## 2. Postgres

1. En el canvas del proyecto: **+ New** → **Database** → **Add PostgreSQL**.
2. Esperar 30 s a que arranque. Esto crea automáticamente la variable `DATABASE_URL` que se inyecta en cualquier servicio que la referencie.

## 3. Servicio `backend`

1. **+ New** → **GitHub Repo** → `nicolasdimarco/RDS`.
2. Click en el servicio recién creado → **Settings**:
   - **Service Name**: `backend`
   - **Root Directory**: `backend`
   - **Branch**: `main`
3. **Variables** (pestaña del servicio) → agregar:

```
SECRET_KEY=<correr: python -c "import secrets; print(secrets.token_urlsafe(64))">
DEBUG=False
ALLOWED_HOSTS=${{RAILWAY_PUBLIC_DOMAIN}}
CSRF_TRUSTED_ORIGINS=https://${{RAILWAY_PUBLIC_DOMAIN}}
CORS_ALLOWED_ORIGINS=<se completa en paso 5 con la URL del frontend>
DATABASE_URL=${{Postgres.DATABASE_URL}}
MEDIA_ROOT=/app/media
RDS_ADMIN_USERNAME=rodrigo
RDS_ADMIN_EMAIL=rodrigo@rds.local
RDS_ADMIN_PASSWORD=RDSsolar2026
LANGUAGE_CODE=es-ar
TIME_ZONE=America/Argentina/Buenos_Aires
SECURE_SSL_REDIRECT=True
```

> Las referencias `${{...}}` las resuelve Railway automáticamente.

4. **Settings → Networking** → **Generate Domain** (queda algo como `rds-backend-production.up.railway.app`).
5. **Settings → Volumes** → **+ Add Volume** → mount path `/app/media`, size `1 GB`.
6. **Deploy**. La primera build instala dependencias, corre el `release` del Procfile (migrate + collectstatic + ensure_admin) y arranca gunicorn.
7. Verificar en los logs: deberías ver `Admin 'rodrigo' creado.` y `Listening at: http://0.0.0.0:<port>`.

## 4. Cargar datos iniciales (una sola vez)

Desde tu máquina local, instalar el CLI y cargar el fixture:

```bash
npm i -g @railway/cli
railway login
cd backend
railway link  # elegir el proyecto y el servicio backend
railway run python manage.py loaddata initial_data.json
```

`initial_data.json` ya está generado en tu repo (gitignored). Si querés regenerarlo:

```bash
cd backend
.venv/bin/python manage.py dumpdata --natural-foreign --natural-primary \
  --exclude=contenttypes --exclude=auth.permission \
  --exclude=sessions --exclude=admin.logentry \
  --indent=2 -o initial_data.json
```

## 5. Servicio `frontend`

1. **+ New** → **GitHub Repo** → `nicolasdimarco/RDS` (mismo repo).
2. Settings:
   - **Service Name**: `frontend`
   - **Root Directory**: `frontend`
3. **Variables**:

```
VITE_API_BASE_URL=https://<dominio-del-backend>/api/v1
```

> Usar la URL exacta del paso 3.4. Por ejemplo: `https://rds-backend-production.up.railway.app/api/v1`.

4. **Settings → Networking** → **Generate Domain**.
5. **Deploy**. Tarda ~2 min (instala node_modules, build de Vite, levanta `serve`).
6. Volver al servicio `backend` → Variables → completar:

```
CORS_ALLOWED_ORIGINS=https://<dominio-del-frontend>
```

7. **Redeploy** del backend para que tome el nuevo CORS.

## 6. Probar

Entrar al dominio del frontend (`https://rds-frontend-production.up.railway.app`). Login con `rodrigo` / `RDSsolar2026`. Debería cargar el dashboard con los datos migrados.

---

## Dominio propio (después)

Cuando lo tengas:

1. **Backend** → Settings → Networking → **+ Custom Domain** → ej. `api.tu-dominio.com`. Railway te da un CNAME que apuntás desde el panel del dominio.
2. **Frontend** → idem con `app.tu-dominio.com` o el ápex.
3. Agregar los nuevos hosts a las variables del backend:
   - `ALLOWED_HOSTS=api.tu-dominio.com,${{RAILWAY_PUBLIC_DOMAIN}}`
   - `CSRF_TRUSTED_ORIGINS=https://api.tu-dominio.com,https://app.tu-dominio.com`
   - `CORS_ALLOWED_ORIGINS=https://app.tu-dominio.com`
4. Actualizar `VITE_API_BASE_URL` del frontend a `https://api.tu-dominio.com/api/v1` y redeploy.

---

## Operación diaria

- **Logs**: cada servicio tiene pestaña **Deployments → Logs**.
- **Redeploy automático**: cualquier push a `main` dispara nuevo build.
- **Variables**: cambiar una variable redeployea el servicio automáticamente.
- **Backup DB**: Settings del Postgres → **Backups** (incluido en hobby plan).
- **CLI útil**:
  ```bash
  railway logs --service backend
  railway run --service backend python manage.py shell
  railway run --service backend python manage.py createsuperuser
  ```
