# AGENTS.md — Reglas generales para todos los agentes

Este archivo lo lee **todo agente antes de empezar**. Las reglas propias de cada rol están en `rules/`.

## Proyecto

**Gestion De Gastos** es un sistema web para que una persona registre sus ingresos y gastos, los vea por mes, entienda en qué categorías gasta y reciba avisos cuando se acerca o supera el límite que se puso. Un solo usuario, sin login, una sola moneda (ARS).

## Fuente de verdad

1. `docs/spec.md` es el contrato. Si el código y la spec discrepan, está mal el código (o hay que cambiar la spec con `[cambio]`, a pedido de una persona).
2. `docs/glosario.md` fija el significado de los términos. Se usan esos nombres.
3. `docs/decisiones.md` y `docs/preguntas-abiertas.md` explican el porqué.
4. `docs/plan.md` define arquitectura, datos, API y dónde vive cada regla.
5. `docs/tasks.md` define el trabajo, tarea por tarea.

## Tecnología

- **Frontend:** HTML, CSS y JavaScript sin frameworks (módulos ES).
- **Backend:** Node.js + Express, capas Controller / Service / Repository.
- **Base de datos:** SQLite con `better-sqlite3`.
- **Pruebas:** `node:test`.

## Estructura del repositorio

```
docs/        Documentación del proyecto (ideas, decisiones, glosario, spec, plan, tasks…)
rules/       Reglas de cada agente
backend/     API y acceso a datos
frontend/    Páginas, estilos y scripts
AGENTS.md    Este archivo
README.md    Presentación y puesta en marcha
```

## Los agentes

| Agente | Qué hace | Reglas |
|---|---|---|
| Analista | Mantiene `docs/spec.md`, `docs/decisiones.md`, `docs/glosario.md`, `docs/preguntas-abiertas.md` e `docs/ideas.md`. | `rules/analista.md` |
| Arquitecto | Define la arquitectura. Escribe `docs/plan.md` y `docs/tasks.md`. | `rules/arquitecto.md` |
| Dev backend | Implementa el backend en las capas Controller, Service y Repository. | `rules/backend.md` |
| Dev frontend | Implementa el frontend en HTML, CSS y JavaScript. | `rules/frontend.md` |
| Tester | Escribe y corre las pruebas a partir de la spec y del criterio de cada tarea. | `rules/tester.md` |
| Revisor | Revisa los cambios y reporta lo que no cumple la spec. | `rules/revisor.md` |

## Reglas generales

1. **No inventes reglas de negocio.** Si la spec no responde algo, no lo resuelvas a tu gusto: anotalo en `docs/preguntas-abiertas.md` y avisá.
2. **Cada agente toca solo lo suyo.** Si te piden algo de otro rol, no lo hacés y respondés qué agente corresponde.
3. **Una tarea por vez.** Trabajá solo sobre la tarea indicada de `docs/tasks.md` y sobre los archivos que esa tarea declara. No hagas mejoras no pedidas.
4. **Los tests son el criterio.** Una tarea está terminada cuando pasan sus casos de prueba, no antes.
5. **Cambios en documentos:** todo cambio en `docs/` se registra en el "Historial de cambios" del archivo con el formato `[cambio] AAAA-MM-DD — qué cambió y por qué`. Nunca borres historial.
6. **Secretos:** nunca subas `.env` ni bases de datos. Los valores de ejemplo van en `backend/.env.example`.
7. **Idioma:** documentación, mensajes al usuario y nombres de dominio en español (`movimiento`, `categoria`, `presupuesto`). Sin tildes ni ñ en identificadores de código.
8. **Dinero:** siempre centavos enteros. Nunca decimales flotantes.
9. **Seguridad:** SQL parametrizado; el texto que ingresa la persona nunca se inserta como HTML.
10. **Si dudás, preguntá.** Es más barato que rehacer.

## Cómo se trabaja una tarea

Ciclo para cada tarea de `docs/tasks.md`:

1. **El tester escribe los tests** de la tarea a partir de su criterio de "terminada" y de la spec. Los corre: **tienen que fallar**. Si pasan sin código, el test no prueba nada y se corrige.
2. **El dev implementa** hasta que los tests pasen. **No modifica los tests**: si un test está mal, lo reporta al tester.
3. **El revisor compara el cambio contra la spec** y la tarea, y da su veredicto: `APROBADO` o `RECHAZADO` con la lista de lo que no cumple.
4. **Con `APROBADO`, se hace commit** con el número de tarea en el mensaje, por ejemplo `T-05: crear y listar categorías`.
5. **Se marca la tarea como hecha** en `docs/tasks.md` (`[ ]` → `[x]`).

**Una tarea por vez.** No se empieza la siguiente hasta cerrar la actual. Si el revisor rechaza, se vuelve al paso 2.

## Git

- Todo el trabajo está en Git. Si un agente rompe algo, se vuelve atrás con `git revert` o `git restore`.
- Un commit por tarea aprobada. Mensaje: `T-XX: título corto`.
- Commits de documentación: `docs: qué se cambió`.
- Ramas: `main` siempre estable. El trabajo de cada tarea puede hacerse en una rama `tarea/T-XX` y fusionarse tras el `APROBADO`.
