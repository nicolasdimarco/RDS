# RDS Solar — Stock, compras, proyectos y ventas

Webapp full-stack para gestionar insumos solares: catálogo y stock con costo
promedio, compras a proveedores con actualización automática de stock,
proyectos/ventas con cálculo de margen y conversión de moneda en tiempo real
(ARS/USD vía DolarAPI), control de usuarios con roles y dashboard con métricas
en USD.

## Stack

- **Backend:** Django 5 + Django REST Framework + SimpleJWT, SQLite por defecto
  (PostgreSQL listo vía `DATABASE_URL`).
- **Frontend:** React 18 + Vite + TypeScript, Tailwind CSS, TanStack Query,
  Zustand, Recharts.
- **Tests:** Pytest (backend) y Vitest + React Testing Library (frontend).

## Estructura

```
backend/    Django project (apps: accounts, products, purchases, projects, stock,
            currency, dashboard, files, audit) + tests/
frontend/   React + Vite app
```

## Requisitos

- Python 3.12+
- Node.js 20+
- npm 10+

## Backend

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt        # ver lista en backend/requirements.txt
cp .env.example .env                              # ajustar SECRET_KEY si va a producción
.venv/bin/python manage.py migrate
.venv/bin/python manage.py seed_demo              # crea admin y datos de prueba
.venv/bin/python manage.py runserver 127.0.0.1:8000
```

Variables de entorno relevantes (ver `backend/.env.example`):

| Variable | Descripción |
| --- | --- |
| `SECRET_KEY` | Clave secreta Django (obligatoria en producción) |
| `DEBUG` | `True` en desarrollo |
| `DATABASE_URL` | `sqlite:///db.sqlite3` por defecto; soporta Postgres |
| `CORS_ALLOWED_ORIGINS` | Origenes permitidos para el frontend |
| `DOLAR_API_URL` | Endpoint de DolarAPI (oficial por defecto) |
| `DOLAR_CACHE_SECONDS` | Cache server-side de la cotización |

### API

Base: `http://127.0.0.1:8000/api/v1/`

| Recurso | Endpoint |
| --- | --- |
| Login / refresh / logout | `auth/login/`, `auth/refresh/`, `auth/logout/` |
| Reset de contraseña | `auth/password-reset/`, `auth/password-reset/confirm/` |
| Perfil propio | `auth/me/` (GET, PATCH) |
| Usuarios / grupos | `users/`, `groups/` (admin) |
| Cotización viva | `currency/current/`, `exchange-rates/` |
| Productos / categorías / marcas | `products/`, `categories/`, `brands/` |
| Compras / proveedores | `purchases/`, `suppliers/` |
| Proyectos / clientes | `projects/`, `project-items/`, `clients/` |
| Stock | `stock-movements/`, `stock/summary/`, `stock/low/` |
| Dashboard | `dashboard/` |
| Auditoría | `audit/` |

### Tests backend

```bash
cd backend
.venv/bin/python -m pytest tests/
```

## Frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

Variables del frontend (`frontend/.env` opcional):

```
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
```

### Build de producción

```bash
npm run build        # genera frontend/dist
npm run preview      # sirve el build local
```

El bundle viene code-split: `react-vendor`, `data` (query/axios/zustand) y
`charts` (recharts) se separan, y cada página se carga bajo demanda con
`React.lazy`.

### Tests frontend

```bash
npm test             # corrida única
npm run test:watch   # modo watch
```

Cubren login, guardas de rutas (`Protected` / `AdminOnly`), cálculo de totales
y márgenes de proyectos/compras, y el `CurrencyPicker` con DolarAPI.

## Credenciales demo

Tras `seed_demo`:

- Usuario: `admin`
- Contraseña: `admin1234`

## Funcionalidades clave

- **Auth con JWT** y permisos por rol (admin / usuario).
- **Catálogo** con costo promedio, costo último, margen sugerido, precio sugerido,
  conversión USD para reporting unificado.
- **Compras**: al pasar a *Recibida* se generan movimientos de stock y se
  recalculan costos promedio.
- **Proyectos**: editor dinámico con cálculo en vivo de subtotal, total, costo,
  ganancia y margen %; al pasar a *Completado* descuenta stock automáticamente.
- **Stock**: resumen, alertas de stock bajo, historial de movimientos y
  ajustes manuales.
- **Dashboard**: KPIs en USD, ventas y compras mensuales, distribución por
  estado de proyecto, top clientes.
- **Cotización ARS/USD** vía DolarAPI con caché y override manual por
  documento.
- **Modo oscuro** persistente, layout responsive (mobile / tablet / desktop).
