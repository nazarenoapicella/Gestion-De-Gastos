# Gestion-De-Gastos

Sistema web para registrar ingresos y gastos personales, ver el balance de cada mes, entender en qué categorías se gasta más y recibir avisos cuando se supera un límite propio.

> **Estado (2026-11-16): COMPLETADO.** El equipo confirma la aprobación de las suites automatizadas completas (**175/175 backend y 93/93 frontend**), los escenarios manuales, el recorrido integral y la ejecución desde un clon limpio. La verificación técnica adicional y el detalle del cierre se encuentran en [`docs/INFORME-VERIFICACION.md`](docs/INFORME-VERIFICACION.md), [`docs/tasks.md`](docs/tasks.md) y [`docs/pruebas-manuales.md`](docs/pruebas-manuales.md).

## Demo en línea

**Aplicación publicada:** https://gestion-de-gastos-yk18.onrender.com/

El diseño previsto para la demo es un único servicio que sirve la API y la página desde el mismo origen. El navegador llama a rutas relativas `/api`, por lo que CORS no se configura ni se necesita en esta arquitectura. Si frontend y backend se separaran, habría que habilitar una allowlist estricta del origen del frontend; nunca `*`.

- Si nadie la usó en los últimos 15 minutos, el primer acceso puede demorar alrededor de un minuto mientras el servicio se reactiva.
- La base SQLite vive en el disco temporal del servicio: los datos cargados se pierden cuando el servicio se reinicia o se vuelve a desplegar, y se recrean las 11 categorías por defecto.
- Variable de entorno configurada en el panel de Render (no está en el repositorio): `NODE_VERSION=22`.
- La demo no tiene login: cualquiera que conozca la dirección puede ver y modificar los datos. La publicación es solo para evaluación académica; usá exclusivamente datos ficticios/de prueba, nunca información financiera real.

**Recorrido sugerido para probarla:** registrar un gasto y un ingreso, mirar el balance en el resumen, definir un límite de presupuesto para una categoría y cargar gastos hasta superar el 80 % para ver el aviso.

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
cd backend && npm test      # API, reglas de negocio, integración y trazabilidad
cd frontend && npm test     # 93 pruebas: API cliente, formato, validaciones, categorías y seguridad (no necesita npm install)
```

Las verificaciones manuales se completaron según la confirmación del equipo; el registro de escenarios y resultados declarados está en [`docs/pruebas-manuales.md`](docs/pruebas-manuales.md). La relación entre cada regla de la spec y sus pruebas está en [`docs/trazabilidad.md`](docs/trazabilidad.md).

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

1. [`docs/idea.md`](docs/idea.md): qué necesita el cliente.
2. [`docs/glosario.md`](docs/glosario.md): significado de cada término.
3. [`docs/decisiones.md`](docs/decisiones.md) y [`docs/preguntas-abiertas.md`](docs/preguntas-abiertas.md): qué se decidió y qué se consultó.
4. [`docs/spec.md`](docs/spec.md): **el contrato**: reglas de negocio, historias de usuario y casos borde.
5. [`docs/plan.md`](docs/plan.md): arquitectura, datos, API y dónde vive cada regla.
6. [`docs/tasks.md`](docs/tasks.md): el trabajo dividido en tareas, con sus pruebas.
7. [`docs/pruebas-manuales.md`](docs/pruebas-manuales.md): listas para verificar las pantallas y el escenario completo.
8. [`docs/trazabilidad.md`](docs/trazabilidad.md): cobertura de reglas, historias y casos borde, además de las decisiones de alcance aceptadas.

## Cómo se trabajó

El desarrollo se organizó en tareas y roles separados (ver [`AGENTS.md`](AGENTS.md)). El ciclo previsto es: el tester escribe las pruebas, el dev implementa, el revisor compara contra la spec y, con `APROBADO`, se cierra la tarea. Las tareas T-01 a T-22, las verificaciones automáticas integrales y las verificaciones manuales están completadas según la confirmación del equipo. El informe técnico distingue el resultado integral registrado por el equipo de las comprobaciones adicionales reproducidas durante esta revisión.

## Limitaciones conocidas

- Sin usuarios ni login: cualquiera que llegue a la dirección ve y modifica todo. Está pensado para uso local; la demo pública se publica solo con fines de evaluación académica.
- Si dos pedidos iguales llegan a la vez (por ejemplo, desde dos pestañas), se crean dos movimientos. La página deshabilita el botón mientras envía para evitarlo en el uso normal (D-20).
- El aviso de presupuestos se actualiza con lo que se hace desde la propia aplicación; un cambio hecho por fuera se refleja al navegar.
- Los archivos fuente de `frontend/test/` no se exponen por HTTP: el servidor bloquea expresamente el acceso a esa ruta. Las pruebas permanecen dentro del repositorio para su ejecución local.
- El nombre de categoría se mide en puntos de código Unicode tanto en frontend como en backend; la prueba T-19.5 cubre el límite con emojis.

El resto está en [`docs/trazabilidad.md`](docs/trazabilidad.md).

## Licencia

Proyecto de práctica académica.
