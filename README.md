# Gestion-De-Gastos

Sistema web para registrar ingresos y gastos personales, ver el balance de cada mes, entender en qué categorías se gasta más y recibir avisos cuando se supera un límite propio.

> **Estado (2026-11-09):** la implementación está desarrollada y los tests automáticos pasan: **172/172 en backend** y **93/93 en frontend**. La validación manual de las pantallas y el ensayo desde un clon limpio siguen pendientes; el estado detallado está en [`docs/tasks.md`](docs/tasks.md) y [`docs/pruebas-manuales.md`](docs/pruebas-manuales.md).

## Qué hace

- **Movimientos:** registrar, editar, filtrar (mes, tipo y categoría) y eliminar ingresos y gastos, con 20 por página.
- **Categorías:** viene con 11 cargadas; se pueden crear, renombrar, desactivar, reactivar y eliminar. "Otros gastos" y "Otros ingresos" están protegidas.
- **Resumen:** balance del mes, balance acumulado y totales por categoría con porcentajes.
- **Presupuestos:** un límite mensual por categoría de gasto, con aviso desde el 80 % y al superar el 100 %. El aviso se ve en todas las pantallas y nunca impide cargar movimientos.

Un solo usuario, sin login, en pesos argentinos. Lo que queda fuera de esta versión está en [`docs/spec.md`](docs/spec.md) §2.

## Tecnología

| Parte | Tecnología |
|---|---|
| Frontend | HTML, CSS y JavaScript (módulos ES, sin frameworks ni dependencias) |
| Backend | Node.js + Express, en capas Controller, Service y Repository |
| Base de datos | SQLite (`better-sqlite3`) |
| Pruebas | `node:test` |

## Requisitos

- **Node.js 20.12 o superior** (se recomienda una versión LTS: 20, 22 o 24).
- Git.

Si `npm install` falla al instalar `better-sqlite3`, casi siempre es porque Node es una versión muy nueva o muy vieja y no hay un binario precompilado para ella. Usá una versión LTS.

## Puesta en marcha

Desde la raíz del proyecto:

```bash
cd backend
cp .env.example .env     # en Windows (cmd): copy .env.example .env
npm install
npm run dev              # servidor con recarga automática
```

Abrí **http://localhost:3000** en el navegador. El mismo servidor sirve la API y la página.

- `npm start` arranca el servidor sin recarga automática.
- Para comprobar que responde: http://localhost:3000/api/health debe mostrar `{"estado":"ok"}`.

La primera vez se crea la base (`backend/data/gastos.db`) con las 11 categorías por defecto.

## Pruebas

```bash
cd backend && npm test      # 172 pruebas: API, reglas de negocio, integración y trazabilidad
cd frontend && npm test     # 93 pruebas: API cliente, formato, validaciones, categorías y seguridad (no necesita npm install)
```

Las pantallas se deben verificar a mano con las listas de [`docs/pruebas-manuales.md`](docs/pruebas-manuales.md); sus resultados todavía no están registrados. La relación entre cada regla de la spec y sus pruebas está en [`docs/trazabilidad.md`](docs/trazabilidad.md).

## Configuración

Se define en `backend/.env` (copia de `backend/.env.example`):

| Variable | Valor por defecto | Para qué sirve |
|---|---|---|
| `PORT` | `3000` | Puerto del servidor. |
| `DB_PATH` | `./data/gastos.db` | Archivo de la base de datos, relativo a `backend/`. |
| `APP_TIMEZONE` | `America/Argentina/Buenos_Aires` | Zona horaria con la que el servidor calcula "hoy". La página usa siempre Buenos Aires (decisión D-06), así que no la cambies salvo para pruebas. |

## Datos y copias de seguridad

Todos los datos están en un solo archivo: `backend/data/gastos.db`. Para hacer una copia, apagá el servidor y copiá ese archivo. Para empezar de cero, apagalo y borralo: se vuelve a crear con las categorías por defecto. El archivo no se sube a Git.

## API

Prefijo `/api`. Dinero en **centavos enteros**, fechas `AAAA-MM-DD`, meses `AAAA-MM`. El detalle de cada ruta, con sus errores, está en [`docs/plan.md`](docs/plan.md) §4.

| Ruta | Qué hace |
|---|---|
| `GET /api/health` | Verifica que el servidor responde. |
| `GET`, `POST /api/categorias` | Lista (filtros `tipo` y `activa`) y crea categorías. |
| `PATCH`, `DELETE /api/categorias/:id` | Renombra, activa o desactiva, y elimina. |
| `GET`, `POST /api/movimientos` | Lista (filtros `mes`, `tipo`, `categoriaId` y `pagina`) y crea. |
| `GET`, `PUT`, `DELETE /api/movimientos/:id` | Consulta, edita y elimina. |
| `GET /api/resumen?mes=` | Balances del mes y totales por categoría. |
| `GET /api/presupuestos?mes=` | Estado de los límites en el mes. |
| `PUT`, `DELETE /api/presupuestos/:categoriaId` | Define o reemplaza, y quita un límite. |

Los errores tienen siempre la forma `{ "error": { "codigo", "mensaje", "campos" } }`.

## Estructura

```
docs/        ideas, decisiones, preguntas abiertas, glosario, spec, plan, tareas, pruebas manuales y trazabilidad
rules/       reglas de cada agente (analista, arquitecto, backend, frontend, tester, revisor)
backend/
  src/       app, configuración, errores y un módulo por tema (categorias, movimientos, reportes, presupuestos, db, utils)
  test/      pruebas del backend
frontend/
  index.html  css/  js/ (vistas, formato, validaciones y llamadas a la API)  test/
AGENTS.md    reglas generales y ciclo de trabajo
```

## Documentación

Se lee en este orden:

1. [`docs/ideas.md`](docs/ideas.md): qué necesita el cliente.
2. [`docs/glosario.md`](docs/glosario.md): significado de cada término.
3. [`docs/decisiones.md`](docs/decisiones.md) y [`docs/preguntas-abiertas.md`](docs/preguntas-abiertas.md): qué se decidió y qué se consultó.
4. [`docs/spec.md`](docs/spec.md): **el contrato**: reglas de negocio, historias de usuario y casos borde.
5. [`docs/plan.md`](docs/plan.md): arquitectura, datos, API y dónde vive cada regla.
6. [`docs/tasks.md`](docs/tasks.md): el trabajo dividido en tareas, con sus pruebas.
7. [`docs/pruebas-manuales.md`](docs/pruebas-manuales.md): listas para verificar las pantallas y el escenario completo.
8. [`docs/trazabilidad.md`](docs/trazabilidad.md): qué pruebas cubren cada regla, y los defectos y limitaciones conocidos.

## Cómo se trabajó

El desarrollo se organizó en tareas y roles separados (ver [`AGENTS.md`](AGENTS.md)). El ciclo previsto es: el tester escribe las pruebas, el dev implementa, el revisor compara contra la spec y, con `APROBADO`, se cierra la tarea. Las tareas T-01 a T-15 tienen sus pruebas automáticas aprobadas. T-16 a T-22 requieren completar las verificaciones manuales que figuran en `docs/pruebas-manuales.md` antes del cierre final.

## Limitaciones conocidas

- Sin usuarios ni login: cualquiera que llegue a la dirección ve y modifica todo. Está pensado para uso local.
- Si dos pedidos iguales llegan a la vez (por ejemplo, desde dos pestañas), se crean dos movimientos. La página deshabilita el botón mientras envía para evitarlo en el uso normal (D-20).
- El aviso de presupuestos se actualiza con lo que se hace desde la propia aplicación; un cambio hecho por fuera se refleja al navegar.
- El servidor también entrega los archivos de `frontend/`, incluidas sus pruebas. Si algún día se publicara en internet, habría que separarlos.
- Hay una diferencia de baja gravedad en el conteo de nombres de categoría con emojis: el límite del código JavaScript cuenta unidades UTF-16 y no caracteres Unicode. Está documentada como DEF-01 en `docs/trazabilidad.md`.

El resto está en [`docs/trazabilidad.md`](docs/trazabilidad.md).

## Licencia

Proyecto de práctica académica.