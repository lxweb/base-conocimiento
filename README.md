# Base de conocimiento

Herramienta personal para registrar conocimientos y validarlos con una cola diaria.

Este repositorio contiene solo el código. El conocimiento no se versiona acá.

El diseño de la versión 1 está en [docs/superpowers/specs/2026-09-28-base-conocimiento-design.md](docs/superpowers/specs/2026-09-28-base-conocimiento-design.md).

## Despliegue (homelab)

Operación documentada en Obsidian: `KnowledgeVault/Services/base-conocimiento/Index.md`.

- **UI web:** http://conocimiento.home.lan (fallback http://192.168.1.9:10800)
- Stack: `docker compose` con override en `/home/lisandro/Services/base-conocimiento/` (`ENV_FILE` apunta al `.env` del servidor)
- Escritorio (opcional): `API_URL=http://conocimiento.home.lan npm start -w @base/desktop`
- Desarrollo: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db`

## Frontend web

La UI se sirve desde el mismo contenedor `api` (`web/dist/`). Build local:

```bash
npm run build -w @base/web
```

La bandeja de respuestas pendientes usa `localStorage` en el navegador.
