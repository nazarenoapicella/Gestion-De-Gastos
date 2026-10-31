# Plan técnico — GastoClaro

> Versión 1.0 · Estado: Vigente · Última actualización: 2026-10-30

Lo arma el agente **arquitecto** antes de escribir código. Responde siete preguntas. La 5 es la clave: si una regla de negocio no tiene lugar en el plan, nadie la va a programar.

## 1. ¿Cómo se organiza el sistema?

Una sola aplicación que sirve la API y los archivos del frontend.

```
Navegador (HTML + CSS + JS)  ──fetch──►  Express (backend)  ──►  SQLite
                                         │
                                         ├─ Controller  → HTTP: lee la petición, llama al service, arma la respuesta
                                         ├─ Service     → reglas de negocio (RN). Único lugar donde se decide
                                         └─ Repository  → SQL. No decide nada, solo lee y escribe
```

- **Controller:** traduce HTTP a llamadas de negocio. No tiene reglas.
- **Service:** valida y aplica las RN. Lanza `ErrorDeNegocio` con código y campos.
- **Repository:** consultas SQL parametrizadas. Sin reglas.
- **Frontend:** HTML, CSS y JavaScript sin frameworks, con módulos ES. Express lo sirve como archivos estáticos desde `frontend/`. El frontend muestra lo que la API calcula; no recalcula balances ni estados.

Estructura de carpetas prevista:

```
backend/
  src/
    app.js  server.js  config.js
    errores.js
    db/        schema.sql  index.js  seed.js
    utils/     dinero.js  fecha.js
    categorias/   categorias.controller.js  .service.js  .repository.js
    movimientos/  movimientos.controller.js  .service.js  .repository.js
    reportes/     reportes.controller.js  .service.js  .repository.js
    presupuestos/ presupuestos.controller.js  .service.js  .repository.js
  test/
frontend/
  index.html
  css/styles.css
  js/  app.js  api.js  format.js  validaciones.js  vistas/
  test/
```

## 2. ¿Qué base de datos usamos, y por qué?

**SQLite** (con la librería `better-sqlite3`). Es un solo archivo, no hay servidor que instalar, soporta transacciones y restricciones (`UNIQUE`, `CHECK`, claves foráneas) y alcanza de sobra para un único usuario. Se activa `PRAGMA foreign_keys = ON` en cada conexión. Para las pruebas se usa una base en memoria (`:memory:`).

## 3. ¿Qué datos guardamos?

**categorias**

| Campo | Tipo | Restricciones |
|---|---|---|
| id | INTEGER | Clave primaria, autoincremental |
| nombre | TEXT | No nulo, 1 a 30 caracteres. Se guarda ya normalizado en espacios |
| nombre_normalizado | TEXT | No nulo. Minúsculas, sin tildes, espacios colapsados |
| tipo | TEXT | No nulo. `CHECK` en (`INGRESO`, `GASTO`) |
| activa | INTEGER | No nulo, por defecto 1. `CHECK` en (0, 1) |
| protegida | INTEGER | No nulo, por defecto 0. `CHECK` en (0, 1) |
| | | `UNIQUE (tipo, nombre_normalizado)` |

**movimientos**

| Campo | Tipo | Restricciones |
|---|---|---|
| id | INTEGER | Clave primaria, autoincremental |
| monto_centavos | INTEGER | No nulo. `CHECK` entre 1 y 99999999999 |
| fecha | TEXT | No nulo. `AAAA-MM-DD` (sin hora, para evitar problemas de zona horaria) |
| categoria_id | INTEGER | No nulo. Clave foránea a `categorias(id)` |
| descripcion | TEXT | Nulo permitido. `CHECK` longitud ≤ 140 |
| creado_en | TEXT | No nulo. Fecha y hora UTC en formato ISO 8601 |
| | | Índices en `fecha` y en `categoria_id` |

El **tipo** del movimiento no se guarda: es el de su categoría. Así no puede haber un movimiento cuyo tipo contradiga a su categoría. La API sí exige `tipo` en el cuerpo y lo compara con el de la categoría (RN-04).

**presupuestos**

| Campo | Tipo | Restricciones |
|---|---|---|
| categoria_id | INTEGER | Clave primaria. Clave foránea a `categorias(id)` con `ON DELETE CASCADE` |
| limite_centavos | INTEGER | No nulo. `CHECK` entre 1 y 99999999999 |
| actualizado_en | TEXT | No nulo. ISO 8601 UTC |

Relaciones: una categoría tiene muchos movimientos y, si es de gasto, a lo sumo un presupuesto.

## 4. ¿Cómo se comunican front y back? (API)

Prefijo `/api`. Cuerpos y respuestas en JSON. Dinero siempre en **centavos enteros**; fechas `AAAA-MM-DD`; meses `AAAA-MM`. Los campos usan camelCase.

| Método y ruta | Qué hace | Éxito | Errores |
|---|---|---|---|
| `GET /api/health` | Verifica que el servidor responde | 200 `{ estado: "ok" }` | — |
| `GET /api/categorias?tipo=&activa=` | Lista categorías (orden: tipo, luego nombre) | 200 `[ {id, nombre, tipo, activa, protegida} ]` | 400 filtro inválido |
| `POST /api/categorias` `{nombre, tipo}` | Crea categoría | 201 categoría | 400 validación, 409 nombre duplicado |
| `PATCH /api/categorias/:id` `{nombre?, activa?}` | Renombra y/o activa/desactiva | 200 categoría | 400, 404, 409 duplicado o protegida |
| `DELETE /api/categorias/:id` | Elimina | 204 | 404, 409 protegida o con movimientos |
| `GET /api/movimientos?mes=&tipo=&categoriaId=&pagina=` | Lista paginada | 200 `{ items, pagina, tamanioPagina, total, totalPaginas }` | 400 |
| `POST /api/movimientos` `{tipo, montoCentavos, fecha, categoriaId, descripcion?}` | Crea movimiento | 201 movimiento | 400 validación |
| `GET /api/movimientos/:id` | Obtiene uno | 200 movimiento | 404 |
| `PUT /api/movimientos/:id` (mismo cuerpo que POST) | Reemplaza los datos | 200 movimiento | 400, 404 |
| `DELETE /api/movimientos/:id` | Elimina | 204 | 404 |
| `GET /api/resumen?mes=` | Balances y resumen por categoría | 200 `{ mes, ingresosCentavos, gastosCentavos, balanceMesCentavos, balanceAcumuladoCentavos, porCategoria: { GASTO: [...], INGRESO: [...] } }` | 400 mes |
| `GET /api/presupuestos?mes=` | Estado de presupuestos del mes | 200 `{ mes, items: [ {categoriaId, categoriaNombre, limiteCentavos, gastadoCentavos, porcentajeConsumo, estado} ] }` | 400 mes |
| `PUT /api/presupuestos/:categoriaId` `{limiteCentavos}` | Define o reemplaza el límite | 200 `{categoriaId, limiteCentavos}` | 400, 404 |
| `DELETE /api/presupuestos/:categoriaId` | Quita el límite | 204 | 404 |

Elemento de `items` del listado de movimientos: `{ id, tipo, montoCentavos, fecha, categoriaId, categoriaNombre, categoriaActiva, descripcion }`.
Elemento de `porCategoria`: `{ categoriaId, nombre, totalCentavos, porcentaje }`.

**Formato de error** (D-19): `{ "error": { "codigo": "…", "mensaje": "…", "campos": { "monto": "…" } } }`.

| Código | Estado HTTP | Cuándo |
|---|---|---|
| `VALIDACION` | 400 | Un campo no cumple una regla (con `campos`) |
| `MES_INVALIDO` / `MES_REQUERIDO` | 400 | Mes mal formado / faltante (RN-17) |
| `JSON_INVALIDO` | 400 | Cuerpo que no es JSON |
| `NO_ENCONTRADO` | 404 | Recurso o ruta inexistente |
| `NOMBRE_DUPLICADO` | 409 | RN-06 |
| `CATEGORIA_PROTEGIDA` | 409 | RN-07 |
| `CATEGORIA_CON_MOVIMIENTOS` | 409 | RN-08 |
| `ERROR_INTERNO` | 500 | Falla inesperada. No expone detalles internos |

Regla de uso: **400** si el dato enviado es inválido; **409** si el dato es válido pero choca con el estado actual del sistema.

## 5. ¿Dónde vive cada regla?

| RN | Dónde se programa | Capa | Tareas |
|---|---|---|---|
| RN-01 | Validación del tipo; `CHECK` en la tabla de categorías | Service + BD | T-02, T-05, T-08 |
| RN-02 | `utils/dinero.js`; `CHECK` en la tabla. El frontend la espeja solo para avisar rápido | Service + BD (+ UX) | T-02, T-03, T-08, T-14, T-17 |
| RN-03 | `utils/fecha.js` (con reloj inyectable). El frontend la espeja para avisar rápido | Service (+ UX) | T-04, T-08, T-17 |
| RN-04 | Service de movimientos consulta la categoría vía su repository | Service | T-08, T-09 |
| RN-05 | Service de movimientos; `CHECK` en la tabla | Service + BD | T-02, T-08 |
| RN-06 | Service de categorías (normalización) + `UNIQUE (tipo, nombre_normalizado)` | Service + BD | T-02, T-05, T-06 |
| RN-07 | `db/seed.js` + Service de categorías (protegida) | Seed + Service | T-02, T-06, T-07 |
| RN-08 | Service de categorías, dentro de una transacción | Service | T-07 |
| RN-09 | Service de categorías y movimientos; el listado y reportes incluyen inactivas; los selectores del frontend muestran solo activas | Service + Repository + UX | T-06, T-08, T-09, T-15, T-17, T-19 |
| RN-10 | Service de movimientos | Service | T-09, T-10, T-18 |
| RN-11 | `ORDER BY` y `LIMIT/OFFSET` en el repository; filtros en el service | Repository + Service | T-11, T-18 |
| RN-12 | Service de reportes (consultas con `SUM` por rango de fechas) | Service + Repository | T-12, T-20 |
| RN-13 | Service de reportes | Service | T-13, T-20 |
| RN-14 | `frontend/js/format.js` | Frontend | T-16, T-17 |
| RN-15 | Service de presupuestos | Service | T-14 |
| RN-16 | Service de presupuestos, comparación con enteros | Service | T-15, T-21 |
| RN-17 | `utils/fecha.js` y los controllers que leen `mes` | Utils + Controller | T-04, T-11, T-12, T-15 |

## 6. ¿Cómo resolvemos las partes difíciles?

**Concurrencia.** Aunque haya una sola persona, puede tener dos pestañas abiertas o hacer doble clic.
- La unicidad de nombres de categoría se garantiza con `UNIQUE` en la base, no solo con un chequeo previo; el error de la base se traduce a `NOMBRE_DUPLICADO` (409).
- Las operaciones que leen y luego escriben (eliminar una categoría tras contar sus movimientos) se hacen dentro de una transacción de `better-sqlite3`.
- Doble clic: el frontend deshabilita el botón mientras envía. El backend no deduplica (D-20). En edición gana la última escritura.

**Manejo del tiempo.**
- "Hoy" se calcula en `America/Argentina/Buenos_Aires` (D-06), no con la fecha UTC del servidor. El reloj se inyecta (`createApp({ reloj })`) para fijarlo en las pruebas.
- Las fechas de movimientos son texto `AAAA-MM-DD` sin hora: no hay conversiones de zona. Los rangos de mes se comparan como texto.
- En el frontend nunca se usa `new Date("AAAA-MM-DD")` para mostrar una fecha (se interpreta en UTC y puede mostrar el día anterior); se formatea separando el texto.
- `creado_en` se guarda en UTC y es informativo.

**Dinero.**
- Todo en centavos enteros. Los umbrales de presupuesto se comparan con enteros (`gastado * 100 >= limite * 80`); el porcentaje solo se calcula para mostrarlo. El valor máximo por 100 sigue siendo menor al límite de enteros seguros de JavaScript.

**Normalización de nombres.** Minúsculas, sin tildes (`normalize('NFD')` y quitar marcas diacríticas) y espacios colapsados; esa forma se guarda en `nombre_normalizado`.

**Emails.** No hay emails en esta versión (D-15). Si se agregaran, requieren una decisión nueva y tareas nuevas.

**Seguridad básica.** SQL siempre parametrizado. En el frontend el texto de la persona se inserta con `textContent`, nunca con `innerHTML` (CB-26).

**Pruebas.**
- Backend: `node:test` y `fetch` contra la aplicación levantada en un puerto aleatorio, base `:memory:` por prueba y reloj fijo en 2026-10-30.
- Frontend: la lógica pura (formato, parseo, validación, armado de consultas) vive en módulos sin DOM y se prueba con `node:test`. Las pantallas se verifican con una lista de comprobación manual definida en cada tarea.

## 7. ¿Qué dudas quedan para el analista?

Ninguna bloquea tareas. Se avanza con el supuesto indicado.

| # | Duda | Supuesto adoptado |
|---|---|---|
| 1 | Texto exacto de los mensajes de error y de las alertas. | Los redacta el dev frontend y backend en español claro; el analista los revisa en T-22. |
| 2 | ¿La fecha mínima 2000-01-01 es adecuada para el cliente? | Sí (RN-03). Se ajusta con `[cambio]` si el cliente pide otra. |
| 3 | ¿Navegadores a soportar? | Versiones actuales de Chrome, Edge y Firefox (spec §8). |

## Historial de cambios

- [cambio] 2026-10-30 — Versión 1.0 del plan, a partir de `spec.md` v1.0.
