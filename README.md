# Punto Cero One

**Plataforma social y de productividad del ecosistema [Punto Cero System](https://www.puntocerosystem.com).**

Punto Cero One es la aplicación fundacional de Punto Cero System: una red social profesional con feed editorial, comunidades, grupos, mensajería, notificaciones, marketplace, empleos, eventos y un launcher de verticales (Legal, Medical, Commerce, Accounting…) integrado con System Core.

- **Dominio oficial:** https://www.puntocerosystem.com
- **Organización:** [github.com/Punto-Cero-System](https://github.com/Punto-Cero-System)
- **Licencia:** [MIT](./LICENSE) — Copyright (c) 2026 Punto Cero System

## Stack

| Capa | Tecnología |
| --- | --- |
| Backend | Python · FastAPI · MongoDB (Motor) · JWT (python-jose) · PassLib |
| Frontend | React 19 · Create React App (craco) · Tailwind CSS · Radix UI · Framer Motion |
| Infraestructura | MongoDB · despliegue web en `www.puntocerosystem.com` |

## Estructura del repositorio

```
punto-cero-one/
├── backend/            # API FastAPI (server.py + routes/ + services/ + tests/)
├── frontend/           # SPA React (src/pages, src/components, src/system, src/services)
├── docs/               # Documentación institucional
│   ├── architecture/   # Contratos, ADRs y arquitectura ONE ↔ Core
│   ├── governance/     # Checklists y gobierno
│   ├── audits/         # Auditorías y reportes de fase
│   └── guides/         # Guías de práctica (testing, diseño)
├── memory/             # PRD y CHANGELOG del proyecto
├── test_reports/       # Evidencia de verificación (Fase Omega)
└── tools/              # Herramientas de auditoría (tools/omega)
```

## Puesta en marcha (desarrollo local)

### Requisitos

- Python 3.11+ · Node.js 18+ · una base de MongoDB

### Backend

```bash
cd backend
python -m venv .venv && .venv\Scripts\activate   # Windows
pip install -r requirements.txt
cp .env.example .env                              # completar MONGO_URL, DB_NAME, JWT_SECRET, etc.
uvicorn server:app --reload
```

La API se sirve con el título `Punto Cero System API` (`backend/server.py`) y expone `/api`, `/api/auth`, `/api/investor-requests` y el resto de rutas bajo `/api/*`.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env   # completar REACT_APP_BACKEND_URL y REACT_APP_AUTH_BACKEND_URL
npm start              # craco start
```

## Pruebas

```bash
# Backend (pytest + xdist; ver backend/pytest.ini)
cd backend && pytest

# Frontend (Jest vía craco)
cd frontend && npm test
```

El estado de la suite de release candidate de referencia está documentado en [`docs/audits/FASE_OMEGA_RC_REPORT.md`](./docs/audits/FASE_OMEGA_RC_REPORT.md).

## Documentación

- [`memory/PRD.md`](./memory/PRD.md) — requisitos y decisiones de producto
- [`memory/CHANGELOG.md`](./memory/CHANGELOG.md) — historial de cambios por fases
- [`docs/architecture/`](./docs/architecture) — contratos de identidad, workspaces y límites One ↔ Core
- [`docs/audits/`](./docs/audits) — auditorías de fusión, identidad y readiness

## Contribución

Consulta [CONTRIBUTING.md](./CONTRIBUTING.md) antes de abrir un pull request.

## Licencia

MIT © 2026 Punto Cero System. Ver [LICENSE](./LICENSE).

