# Reglas para agentes · ARTO Studio AI

Este archivo lo leen los agentes que **no** leen `CLAUDE.md` (Cursor, Codex y similares). Si eres
Claude Code, tu documento es `CLAUDE.md` y es más largo.

> **Este producto está en producción en `creative.artostudio.ai` y cobra por Stripe.** Cada merge
> a `main` se despliega solo. La prudencia manda sobre la velocidad.

## 1 · Ramas y PRs

```
rama de trabajo ──PR──▶ main ──▶ producción
```

- No hay staging (decisión D2 del 2026-09-10). El preview de Vercel del PR es el ambiente de
  prueba y **se verifica antes de mergear**.
- Ramas `feat/`, `fix/`, `chore/`. Commits en español, sin em dashes.
- El CI (`lint`, `typecheck`, `build`) tiene que estar en verde. Nada se mergea en rojo.
- **Nunca push directo a `main`.**
- **No toques el PR #56 (`feat/module-4b-scraper`) ni `infra/`.**

## 2 · Lo que un agente no corrige por su cuenta

Stripe, auth, DDL de producción y email. Analiza, propón en el PR y espera el go de Victor.
Todo lo que toque dinero o seguridad lo revisa Fable antes del merge.
Desde el 2026-09-13 Code (Claude Opus 5) hace el trabajo y Fable solo audita, como subagente de
Code en solo lectura: obligatorio antes del merge en dinero, auth, DDL o email, con veredicto
PASA / FALLA / NO VERIFICABLE anclado al hash del commit, que Code revisa antes de registrarlo.

## 3 · Base de datos

DDL solo aditivo. Toda migración termina con `notify pgrst, 'reload schema';`. Las 17 tablas
tienen RLS y la anon key no debe leer nada.

## 4 · Antes de «corregir» algo

Lee `docs/DECISIONES.md`. Si el comportamiento que te parece mal tiene fila ahí, ya se analizó y
hay una persona detrás.

## 5 · Nada se cierra sin prueba

`npm run lint`, `npm run typecheck`, `npm run build` en verde, CI verde, curl al preview. No
reportes «listo» sin haberlo visto responder.

`npm test` no toca ninguna base. Las pruebas de integración solo corren con
`ASAI_INTEGRATION_DB_URL` explícita en la línea de comandos (nunca en `.env.local`); una prueba
nueva que pegue a la base se condiciona a esa variable, nunca a `DATABASE_URL` (H-45).

## 6 · Secretos

Nunca en el repo ni en el chat. Viven en Vercel. La lista está en `.env.example`.
