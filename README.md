# Gestion De Gastos

Sistema web para registrar ingresos y gastos personales, ver el balance de cada mes, entender en qué categorías se gasta más y recibir avisos cuando se supera un límite propio.

> **Estado:** documentación y plan completos; implementación pendiente. El avance se sigue en [`docs/tasks.md`](docs/tasks.md).

## Qué hace

- Registrar, editar, filtrar y eliminar movimientos (ingresos y gastos).
- Administrar categorías, con categorías por defecto.
- Ver el balance del mes y el acumulado, y el resumen por categoría.
- Definir un límite mensual por categoría de gasto y recibir alertas al 80 % y al superar el 100 %.

Un solo usuario, sin login, en pesos argentinos. Lo que queda fuera de esta versión está en [`docs/spec.md`](docs/spec.md) §2.

## Tecnología

| Parte | Tecnología |
|---|---|
| Frontend | HTML, CSS y JavaScript (módulos ES, sin frameworks) |
| Backend | Node.js + Express (capas Controller, Service, Repository) |
| Base de datos | SQLite (`better-sqlite3`) |
| Pruebas | `node:test` |

## Requisitos

- Node.js 20 o superior.
- Git.

## Puesta en marcha

Los comandos se habilitan a medida que avanzan las tareas (T-01 crea el backend). Una vez disponibles:

```bash
cd backend
cp .env.example .env     # ajustá los valores si hace falta
npm install
npm run dev              # servidor en http://localhost:3000
npm test                 # corre las pruebas
```

El servidor también sirve el frontend: abrí `http://localhost:3000` en el navegador.

## Estructura

```
docs/        ideas, decisiones, preguntas abiertas, glosario, spec, plan y tareas
rules/       reglas de cada agente (analista, arquitecto, backend, frontend, tester, revisor)
backend/     API y acceso a datos
frontend/    páginas, estilos y scripts
AGENTS.md    reglas generales y ciclo de trabajo
```

## Documentación

Se lee en este orden:

1. [`docs/ideas.md`](docs/ideas.md) — qué necesita el cliente.
2. [`docs/glosario.md`](docs/glosario.md) — significado de cada término.
3. [`docs/decisiones.md`](docs/decisiones.md) y [`docs/preguntas-abiertas.md`](docs/preguntas-abiertas.md) — qué se decidió y qué se consultó.
4. [`docs/spec.md`](docs/spec.md) — **el contrato**: reglas de negocio, historias de usuario y casos borde.
5. [`docs/plan.md`](docs/plan.md) — arquitectura, datos, API y dónde vive cada regla.
6. [`docs/tasks.md`](docs/tasks.md) — trabajo dividido en tareas con sus pruebas.

## Cómo se trabaja

El desarrollo se hace con agentes de IA con roles separados (ver [`AGENTS.md`](AGENTS.md)). Cada tarea sigue el mismo ciclo: el tester escribe pruebas que fallan, el dev implementa hasta que pasan, el revisor compara contra la spec y, con `APROBADO`, se hace commit con el número de tarea.

## Licencia

Proyecto de práctica académica.
