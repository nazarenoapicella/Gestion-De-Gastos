# Tareas — Gestion De Gastos

> Versión 1.0 · Última actualización: 2026-10-30

Trabajo partido en tareas chicas, ordenadas **por dependencia** (no por número de HU) y agrupadas en etapas. Cada una cambia pocos archivos y se puede revisar en una sola pasada.

**Estado:** `[ ]` pendiente · `[x]` hecha.
**Una tarea por vez.** No se empieza la siguiente hasta cerrar la actual (ver ciclo en `AGENTS.md`).
**"Terminada"** son siempre casos de prueba concretos, con dato y resultado esperado, sacados de la spec.

**Datos base de las pruebas de backend:** base `:memory:` con el seed de T-02 y reloj fijo en `2026-10-30` a las 12:00 (Buenos Aires), salvo que la tarea indique otro. Los importes se escriben en pesos y entre paréntesis en centavos.

---

## Etapa 1 — Fundaciones del backend

### T-01 — Esqueleto del backend y healthcheck
- **Estado:** [x] hecha
- **Agente:** Dev backend
- **Qué hace:** crea el proyecto Node (`package.json` con scripts `start`, `dev`, `test`), la app Express con `createApp({ db, reloj })`, lectura de `.env`, manejo central de errores con el formato de D-19, clase `ErrorDeNegocio`, y sirve `frontend/` como estático.
- **RN / HU:** D-19, D-21
- **Depende de:** —
- **Archivos esperados:** `backend/package.json`, `src/app.js`, `src/server.js`, `src/config.js`, `src/errores.js`, `test/health.test.js`
- **Terminada cuando:**
  1. `GET /api/health` → 200 y cuerpo `{ "estado": "ok" }`.
  2. `GET /api/inexistente` → 404 con `error.codigo = "NO_ENCONTRADO"`.
  3. `POST /api/health` con cuerpo `{rota` (JSON inválido, `Content-Type: application/json`) → 400 con `error.codigo = "JSON_INVALIDO"`.
  4. Una excepción inesperada en una ruta → 500 con `error.codigo = "ERROR_INTERNO"` y sin texto de la excepción en el cuerpo.

### T-02 — Esquema de base de datos y datos iniciales
- **Estado:** [x] hecha
- **Agente:** Dev backend
- **Qué hace:** crea `schema.sql` con las tablas `categorias`, `movimientos` y `presupuestos` (plan §3), la conexión con `foreign_keys = ON` y un seed idempotente de las categorías por defecto.
- **RN / HU:** RN-01, RN-02, RN-05, RN-06, RN-07 (seed)
- **Depende de:** T-01
- - **Archivos esperados:** `src/db/schema.sql`, `src/db/index.js`, `src/db/seed.js`, `src/utils/texto.js` (normalización de nombres), `src/server.js` (abre la base al arrancar), `test/db.test.js`
- **Terminada cuando:**
  1. Base vacía inicializada → existen las tablas `categorias`, `movimientos` y `presupuestos`.
  2. Tras el seed hay 11 categorías: 8 de tipo `GASTO` (Alimentación, Transporte, Vivienda, Servicios, Salud, Ocio, Educación, Otros gastos) y 3 de `INGRESO` (Sueldo, Ventas, Otros ingresos), todas activas.
  3. Solo "Otros gastos" y "Otros ingresos" tienen `protegida = 1`.
  4. Ejecutar el seed dos veces → sigue habiendo 11.
  5. Insertar directo una categoría `nombre_normalizado = "alimentacion"`, tipo `GASTO` → falla por `UNIQUE`.
  6. Insertar un movimiento con `monto_centavos = 0` → falla por `CHECK`; con `100000000000` → falla; con `1` → entra.
  7. Insertar un movimiento con `categoria_id = 9999` → falla por clave foránea.

### T-03 — Utilidades de dinero
- **Estado:** [ ] pendiente
- **Agente:** Dev backend
- **Qué hace:** función `validarMontoCentavos(valor)` que devuelve el entero o lanza `ErrorDeNegocio` de código `VALIDACION`, según RN-02. Se reutiliza para movimientos y presupuestos.
- **RN / HU:** RN-02
- **Depende de:** T-01
- **Archivos esperados:** `src/utils/dinero.js`, `test/dinero.test.js`
- **Terminada cuando:**
  1. `123456` → válido.
  2. `1` y `99999999999` → válidos.
  3. `0`, `-5`, `100000000000` → error.
  4. `12.5` (no entero) → error.
  5. `"100"` (texto) y `null` → error.
  6. `NaN` e `Infinity` → error.

### T-04 — Utilidades de fecha
- **Estado:** [ ] pendiente
- **Agente:** Dev backend
- **Qué hace:** `hoy(reloj)` en `America/Argentina/Buenos_Aires`; `validarFechaMovimiento(texto, hoy)`; `validarMes(texto)`; `rangoDeMes("AAAA-MM")` → `{ desde, hasta }`.
- **RN / HU:** RN-03, RN-17, D-06
- **Depende de:** T-01
- **Archivos esperados:** `src/utils/fecha.js`, `test/fecha.test.js`
- **Terminada cuando:**
  1. Reloj `2026-10-31T01:30:00Z` → `hoy` = `"2026-10-30"` (CB-11).
  2. Reloj `2026-10-30T15:00:00Z` → `hoy` = `"2026-10-30"`.
  3. Con hoy = `2026-10-30`: `"2026-10-30"` válida; `"2026-10-31"` error (futura); `"2000-01-01"` válida; `"1999-12-31"` error.
  4. `"2026-02-29"` error; `"2024-02-29"` válida (con hoy ≥ esa fecha).
  5. `"abc"`, `""`, `"2026-1-5"`, `"30/10/2026"` y `undefined` → error.
  6. `rangoDeMes("2026-10")` → `{ desde: "2026-10-01", hasta: "2026-10-31" }`; `rangoDeMes("2024-02")` → `hasta: "2024-02-29"`; `rangoDeMes("2026-02")` → `hasta: "2026-02-28"`.
  7. `validarMes("2026-13")`, `"2026-00"`, `"2026-1"`, `"26-10"` → error `MES_INVALIDO`.

---

## Etapa 2 — Categorías

### T-05 — Crear y listar categorías
- **Estado:** [ ] pendiente
- **Agente:** Dev backend
- **Qué hace:** repository, service y controller de categorías para `GET /api/categorias` (filtros `tipo` y `activa`) y `POST /api/categorias`, con normalización de nombre (RN-06).
- **RN / HU:** RN-01, RN-06 · HU-07
- **Depende de:** T-02
- **Archivos esperados:** `src/categorias/categorias.{repository,service,controller}.js`, `test/categorias.crear-listar.test.js`
- **Terminada cuando:**
  1. `GET /api/categorias` con el seed → 200 y 11 elementos; los 8 de `GASTO` primero, luego los 3 de `INGRESO`, cada grupo por nombre.
  2. `GET /api/categorias?tipo=GASTO` → 8. `?tipo=INGRESO` → 3. `?tipo=OTRO` → 400.
  3. `POST {"nombre":"  Mascotas ","tipo":"GASTO"}` → 201, `nombre = "Mascotas"`, `activa = true`, `protegida = false`.
  4. `POST {"nombre":"Alimentacion","tipo":"GASTO"}` → 409 `NOMBRE_DUPLICADO`.
  5. `POST {"nombre":"  alimentación  ","tipo":"GASTO"}` → 409 `NOMBRE_DUPLICADO` (CB-14).
  6. `POST {"nombre":"Regalos","tipo":"GASTO"}` y luego `{"nombre":"Regalos","tipo":"INGRESO"}` → ambas 201 (CB-15).
  7. `POST` con nombre `""` → 400 `VALIDACION` con `campos.nombre`; nombre de 30 caracteres → 201; de 31 → 400 (CB-16).
  8. `POST` con `tipo = "OTRO"` o sin tipo → 400 con `campos.tipo`.
  9. Con una categoría desactivada directo en la base, `GET ?activa=true` no la incluye y `?activa=false` solo devuelve esa.

### T-06 — Renombrar, activar y desactivar categorías
- **Estado:** [ ] pendiente
- **Agente:** Dev backend
- **Qué hace:** `PATCH /api/categorias/:id` con `nombre` y/o `activa`, respetando unicidad y categorías protegidas.
- **RN / HU:** RN-06, RN-07, RN-09 · HU-07
- **Depende de:** T-05
- **Archivos esperados:** cambios en `categorias.{repository,service,controller}.js`, `test/categorias.modificar.test.js`
- **Terminada cuando:**
  1. `PATCH` "Ocio" con `{"nombre":"Entretenimiento"}` → 200 y el nombre cambia; `GET` lo refleja.
  2. `PATCH` "Ocio" con `{"nombre":"Transporte"}` → 409 `NOMBRE_DUPLICADO`; "Ocio" no cambia.
  3. `PATCH` "Ocio" con `{"nombre":"OCIO"}` → 200 (es la misma categoría, no es duplicado).
  4. `PATCH` "Ocio" con `{"activa":false}` → 200 y `activa = false`; luego `{"activa":true}` → vuelve a `true`.
  5. `PATCH` "Otros gastos" con `{"nombre":"Varios"}` → 409 `CATEGORIA_PROTEGIDA`; con `{"activa":false}` → 409 `CATEGORIA_PROTEGIDA`.
  6. `PATCH` "Otros ingresos" con `{"activa":false}` → 409 `CATEGORIA_PROTEGIDA`.
  7. `PATCH /api/categorias/9999` → 404 `NO_ENCONTRADO`.
  8. `PATCH` con cuerpo `{}` → 400 `VALIDACION`. Con `{"tipo":"INGRESO"}` → 400 (el tipo no se modifica).
  9. `PATCH` con `{"nombre":""}` → 400 con `campos.nombre`.

### T-07 — Eliminar categorías
- **Estado:** [ ] pendiente
- **Agente:** Dev backend
- **Qué hace:** `DELETE /api/categorias/:id` dentro de una transacción: bloquea si es protegida o tiene movimientos; elimina su presupuesto si lo tiene.
- **RN / HU:** RN-07, RN-08 · HU-07
- **Depende de:** T-05
- **Archivos esperados:** cambios en `categorias.{repository,service,controller}.js`, `test/categorias.eliminar.test.js`
- **Terminada cuando:** (los movimientos y presupuestos se insertan directo en la base de prueba)
  1. `DELETE` "Salud" sin movimientos → 204 y ya no aparece en `GET /api/categorias`.
  2. `DELETE` "Alimentación" con 1 movimiento → 409 `CATEGORIA_CON_MOVIMIENTOS`; la categoría y el movimiento siguen.
  3. `DELETE` "Otros gastos" → 409 `CATEGORIA_PROTEGIDA`.
  4. `DELETE` "Educación" con presupuesto de 5000000 y sin movimientos → 204 y la fila de `presupuestos` desaparece (CB-17).
  5. `DELETE /api/categorias/9999` → 404.
  6. `DELETE` de una categoría desactivada y sin movimientos → 204.

---

## Etapa 3 — Movimientos

### T-08 — Crear movimiento
- **Estado:** [ ] pendiente
- **Agente:** Dev backend
- **Qué hace:** `POST /api/movimientos` con todas las validaciones; responde el movimiento creado; guarda `creado_en` en UTC.
- **RN / HU:** RN-01, RN-02, RN-03, RN-04, RN-05, RN-09 · HU-01
- **Depende de:** T-03, T-04, T-05
- **Archivos esperados:** `src/movimientos/movimientos.{repository,service,controller}.js`, `test/movimientos.crear.test.js`
- **Terminada cuando:**
  1. `POST {tipo:"GASTO", montoCentavos:123456, fecha:"2026-10-29", categoriaId:<Alimentación>, descripcion:"Supermercado"}` → 201 con `id`, `montoCentavos = 123456`, `categoriaNombre = "Alimentación"`.
  2. Sin `descripcion` → 201 y `descripcion = null`; con `"   "` → 201 y `null`; con `"  Café  "` → guarda `"Café"` (CA-01.2).
  3. `montoCentavos` `0`, `-100`, `12.5`, `"500"` → 400 con `campos.montoCentavos` y no se crea ninguna fila (CA-01.3, CB-01).
  4. `montoCentavos = 1` → 201; `99999999999` → 201; `100000000000` → 400 (CB-02, CB-03, CB-04).
  5. `fecha = "2026-10-30"` → 201; `"2026-10-31"` → 400 `campos.fecha` (CB-06, CB-07).
  6. `fecha = "2026-02-29"` → 400; `"2024-02-29"` → 201; `"1999-12-31"` → 400; `"2000-01-01"` → 201 (CB-08, CB-09, CB-10).
  7. Con reloj en `2026-10-31T01:30:00Z`: `fecha = "2026-10-31"` → 400; `"2026-10-30"` → 201 (CB-11).
  8. `tipo:"GASTO"` con la categoría "Sueldo" → 400 `campos.categoriaId` (CA-01.5).
  9. Categoría desactivada → 400 `campos.categoriaId`; categoría inexistente `9999` → 400 `campos.categoriaId` (CA-01.6).
  10. Descripción de 140 caracteres → 201; de 141 → 400 `campos.descripcion` (CB-13, CA-01.7).
  11. `tipo:"OTRO"` o ausente → 400 `campos.tipo`.
  12. Un cuerpo con varios errores (monto 0 y fecha futura) → 400 con `campos.montoCentavos` y `campos.fecha` a la vez.

### T-09 — Editar movimiento
- **Estado:** [ ] pendiente
- **Agente:** Dev backend
- **Qué hace:** `GET /api/movimientos/:id` y `PUT /api/movimientos/:id` con las mismas validaciones que el alta y la excepción de categoría inactiva ya asignada.
- **RN / HU:** RN-04, RN-09, RN-10 · HU-03
- **Depende de:** T-08
- **Archivos esperados:** cambios en `movimientos.{repository,service,controller}.js`, `test/movimientos.editar.test.js`
- **Terminada cuando:**
  1. Movimiento de $ 1.000,00 (100000) → `PUT` con `montoCentavos:150050` y `descripcion:"Nueva"` → 200; `GET` devuelve 150050 y "Nueva"; `id` y `creadoEn` no cambian (CA-03.1).
  2. `PUT` con `tipo:"INGRESO"` y la categoría "Alimentación" (de gasto) → 400 `campos.categoriaId`; el movimiento no cambia (CA-03.2).
  3. `PUT` con `tipo:"INGRESO"` y la categoría "Sueldo" → 200.
  4. Con la categoría del movimiento desactivada: `PUT` cambiando solo el monto y manteniendo esa categoría → 200 (CA-03.3, CB-18).
  5. Misma situación, cambiando a otra categoría desactivada → 400; cambiando a una activa del mismo tipo → 200.
  6. `PUT /api/movimientos/9999` → 404; `GET /api/movimientos/9999` → 404 (CA-03.4).
  7. `PUT` con monto 0 → 400 y el movimiento no cambia; con fecha futura → 400 (CA-03.5).
  8. `GET /api/movimientos/abc` → 404.

### T-10 — Eliminar movimiento
- **Estado:** [ ] pendiente
- **Agente:** Dev backend
- **Qué hace:** `DELETE /api/movimientos/:id` con borrado definitivo.
- **RN / HU:** RN-10 · HU-04
- **Depende de:** T-08
- **Archivos esperados:** cambios en `movimientos.{repository,service,controller}.js`, `test/movimientos.eliminar.test.js`
- **Terminada cuando:**
  1. `DELETE` de un movimiento existente → 204; luego `GET /api/movimientos/:id` → 404 (CA-04.1).
  2. `DELETE /api/movimientos/9999` → 404 (CA-04.3).
  3. Con 3 movimientos, eliminar uno → quedan 2 en el listado de la base.
  4. Eliminar un movimiento no elimina su categoría.

### T-11 — Listar movimientos con filtros y paginación
- **Estado:** [ ] pendiente
- **Agente:** Dev backend
- **Qué hace:** `GET /api/movimientos` con `mes`, `tipo`, `categoriaId`, `pagina`; orden y paginación en SQL.
- **RN / HU:** RN-09, RN-11, RN-17 · HU-02
- **Depende de:** T-08, T-04
- **Archivos esperados:** cambios en `movimientos.{repository,service,controller}.js`, `test/movimientos.listar.test.js`
- **Terminada cuando:** (datos: 25 gastos en octubre 2026 en "Alimentación" y "Transporte", 2 ingresos en septiembre 2026)
  1. `?mes=2026-10` → `total = 25`, `tamanioPagina = 20`, `totalPaginas = 2`, `items.length = 20`; `pagina=2` → 5 items (CA-02.3).
  2. Dos movimientos con fecha `2026-10-15`: el de mayor `id` aparece primero; y las fechas descienden a lo largo de la página (CA-02.1, CB-24).
  3. `?mes=2026-10&tipo=INGRESO` → 0 items.
  4. `?mes=2026-10&tipo=GASTO&categoriaId=<Transporte>` → solo los de Transporte, con `total` coherente (CA-02.2).
  5. `?mes=2026-09` → los 2 ingresos. `?mes=2026-11` → `items = []`, `total = 0`, 200 (CA-02.4, CB-21).
  6. Sin `mes` → `total = 27` (todos los meses).
  7. `?mes=2026-10&pagina=99` → `items = []`, `total = 25` (CA-02.5).
  8. `?mes=2026-13`, `?mes=2026-1` → 400 `MES_INVALIDO` (CB-22). `?pagina=0`, `?pagina=abc` → 400.
  9. Un movimiento de una categoría desactivada aparece con `categoriaActiva = false` (RN-09).
  10. Un movimiento del último día del mes (`2026-10-31`) aparece en `?mes=2026-10` y no en `?mes=2026-11` (CB-12).

---

## Etapa 4 — Reportes

### T-12 — Balance del mes y acumulado
- **Estado:** [ ] pendiente
- **Agente:** Dev backend
- **Qué hace:** `GET /api/resumen?mes=` devuelve `ingresosCentavos`, `gastosCentavos`, `balanceMesCentavos`, `balanceAcumuladoCentavos` (el campo `porCategoria` llega vacío `{ GASTO: [], INGRESO: [] }` hasta T-13).
- **RN / HU:** RN-12, RN-17 · HU-05
- **Depende de:** T-08, T-04
- **Archivos esperados:** `src/reportes/reportes.{repository,service,controller}.js`, `test/resumen.balance.test.js`
- **Terminada cuando:** (datos: 2026-09 ingreso $ 100.000,00 (10000000); 2026-10 ingreso $ 500.000,00 (50000000) y gastos $ 120.000,50 (12000050))
  1. `?mes=2026-10` → `ingresosCentavos = 50000000`, `gastosCentavos = 12000050`, `balanceMesCentavos = 37999950` (CA-05.1).
  2. Mismo pedido → `balanceAcumuladoCentavos = 47999950` (CA-05.3).
  3. Agregando un gasto de $ 900.000,00 en octubre → `balanceMesCentavos` negativo (`-52000050`) (CA-05.2).
  4. `?mes=2026-08` (sin movimientos y sin nada anterior) → todo en 0 (CA-05.4, CB-21).
  5. `?mes=2026-12` (futuro) → ingresos y gastos 0, balance del mes 0 y acumulado `47999950` (CB-23).
  6. Un gasto con fecha `2026-10-31` cuenta en octubre y no en noviembre (CB-12).
  7. `?mes=2026-13` → 400 `MES_INVALIDO`; sin `mes` → 400 `MES_REQUERIDO` (CA-05.5).
  8. Los movimientos de categorías desactivadas cuentan en los totales.

### T-13 — Resumen por categoría
- **Estado:** [ ] pendiente
- **Agente:** Dev backend
- **Qué hace:** completa `porCategoria` en `GET /api/resumen` con total y porcentaje por categoría, para gastos e ingresos.
- **RN / HU:** RN-13 · HU-06
- **Depende de:** T-12
- **Archivos esperados:** cambios en `reportes.{repository,service}.js`, `test/resumen.categorias.test.js`
- **Terminada cuando:**
  1. Gastos del mes: Alimentación $ 30.000,00 (3000000) y Transporte $ 10.000,00 (1000000) → `porCategoria.GASTO` = [Alimentación 75.0, Transporte 25.0], en ese orden (CA-06.1).
  2. Tres categorías con $ 100,00 (10000) cada una → cada `porcentaje = 33.3` (CA-06.2).
  3. Dos categorías con el mismo total → orden alfabético por nombre (CA-06.3).
  4. Mes sin ingresos → `porCategoria.INGRESO = []`; mes sin movimientos → ambas listas vacías (CA-06.4, CB-21).
  5. Categoría desactivada con movimientos en el mes → aparece (CA-06.5).
  6. Una categoría sin movimientos en el mes no aparece aunque tenga movimientos en otros meses.
  7. Totales 1 y 2 (en centavos) → porcentajes 33.3 y 66.7.
  8. Los totales por categoría suman exactamente `gastosCentavos` del mismo mes.

---

## Etapa 5 — Presupuestos

### T-14 — Definir, reemplazar y quitar límites
- **Estado:** [ ] pendiente
- **Agente:** Dev backend
- **Qué hace:** `PUT /api/presupuestos/:categoriaId` y `DELETE /api/presupuestos/:categoriaId`.
- **RN / HU:** RN-02, RN-15 · HU-08
- **Depende de:** T-03, T-05
- **Archivos esperados:** `src/presupuestos/presupuestos.{repository,service,controller}.js`, `test/presupuestos.limites.test.js`
- **Terminada cuando:**
  1. `PUT` "Alimentación" con `{"limiteCentavos":5000000}` → 200 y devuelve `{categoriaId, limiteCentavos:5000000}` (CA-08.1).
  2. Otro `PUT` con `{"limiteCentavos":6000000}` → 200; en la base hay una sola fila para esa categoría y vale 6000000 (CA-08.2).
  3. `PUT` "Sueldo" (INGRESO) → 400 `campos.categoriaId` (CA-08.3).
  4. `limiteCentavos` `0`, `-1`, `12.5`, `"100"`, `100000000000` → 400 `campos.limiteCentavos` (CA-08.4).
  5. `PUT` sobre una categoría desactivada → 400 (CA-08.5).
  6. `PUT /api/presupuestos/9999` → 404.
  7. `DELETE` de un límite existente → 204; un segundo `DELETE` → 404 (CA-08.6).
  8. `DELETE` sobre una categoría sin límite → 404.

### T-15 — Estado de presupuestos del mes
- **Estado:** [ ] pendiente
- **Agente:** Dev backend
- **Qué hace:** `GET /api/presupuestos?mes=` con gastado, porcentaje de consumo y estado por categoría, comparando con enteros.
- **RN / HU:** RN-09, RN-16, RN-17 · HU-09
- **Depende de:** T-14, T-12
- **Archivos esperados:** cambios en `presupuestos.{repository,service,controller}.js`, `test/presupuestos.estado.test.js`
- **Terminada cuando:** (límite de "Alimentación" = $ 100.000,00 = 10000000)
  1. Gastado 7999999 → `estado = "NORMAL"`, `porcentajeConsumo = 80.0` (se redondea para mostrar, pero el estado sigue `NORMAL`) (CA-09.1).
  2. Gastado 8000000 → `ALERTA`, 80.0.
  3. Gastado 10000000 → `ALERTA`, 100.0 (CB-19).
  4. Gastado 10000001 → `EXCEDIDO`, 100.0 (CB-20).
  5. Gastado 0 → `NORMAL`, 0.0.
  6. Gastos en otro mes no suman al mes consultado (CA-09.2).
  7. Categoría desactivada con presupuesto → no aparece (CA-09.3). Al reactivarla, vuelve a aparecer.
  8. Categoría sin presupuesto → no aparece (CA-09.4).
  9. Bajar el límite de 10000000 a 5000000 con gastado 6000000 → `EXCEDIDO` (CA-09.6).
  10. Con dos presupuestos, el listado viene ordenado por `porcentajeConsumo` descendente.
  11. `?mes=2026-13` → 400 `MES_INVALIDO`; sin `mes` → 400 `MES_REQUERIDO`; `?mes=2027-01` → 200 con gastado 0.

---

## Etapa 6 — Frontend

### T-16 — Esqueleto del frontend y utilidades de formato
- **Estado:** [ ] pendiente
- **Agente:** Dev frontend
- **Qué hace:** `index.html` con navegación por vistas (Movimientos, Resumen, Categorías, Presupuestos), estilos base responsive, `api.js` (cliente `fetch` que traduce el formato de error) y `format.js` con funciones puras.
- **RN / HU:** RN-14
- **Depende de:** T-01
- **Archivos esperados:** `frontend/index.html`, `css/styles.css`, `js/app.js`, `js/api.js`, `js/format.js`, `test/format.test.js`
- **Terminada cuando:**
  1. `formatearMonto(123456)` → `"$ 1.234,56"`; `formatearMonto(1)` → `"$ 0,01"`; `formatearMonto(0)` → `"$ 0,00"`; `formatearMonto(-5200005)` → `"-$ 52.000,05"`.
  2. `parsearMonto("1.234,56")` → `123456`; `"1234,56"` → `123456`; `"1234"` → `123400`; `"0,01"` → `1`; `"12,5"` → `1250`; `"1.234.567,89"` → `123456789`.
  3. `parsearMonto` devuelve `null` para `"12,345"`, `"-5"`, `"abc"`, `""`, `"1.23,4"`, `"1234.56"` (CB-05).
  4. `formatearFecha("2026-10-30")` → `"30/10/2026"`; `formatearFecha("2026-01-05")` → `"05/01/2026"`.
  5. `formatearMes("2026-10")` → `"octubre 2026"`.
  6. Manual: abrir `/` en el navegador muestra la navegación y cambia de vista sin recargar; en ancho de 375 px no hay desplazamiento horizontal.

### T-17 — Formulario de alta y edición de movimientos
- **Estado:** [ ] pendiente
- **Agente:** Dev frontend
- **Qué hace:** formulario de movimiento (tipo, monto, fecha, categoría, descripción) con validación espejo de la spec, selector de categorías filtrado por tipo y activas, errores junto al campo y botón deshabilitado mientras envía.
- **RN / HU:** RN-02, RN-03, RN-04, RN-05, RN-09, RN-14 · HU-01, HU-03
- **Depende de:** T-16, T-08, T-09
- **Archivos esperados:** `js/validaciones.js`, `js/vistas/movimiento-form.js`, `test/validaciones.test.js`
- **Terminada cuando:**
  1. `validarMovimiento` con monto `"0"` → `errores.monto`; con `"12,345"` → `errores.monto`; con `"1.234,56"` → sin error y `payload.montoCentavos = 123456`.
  2. Con hoy = `2026-10-30`: fecha `"2026-10-31"` → `errores.fecha`; `"2026-10-30"` → sin error; vacía → `errores.fecha`.
  3. Sin categoría → `errores.categoriaId`. Descripción de 141 caracteres → `errores.descripcion`; de 140 → sin error.
  4. Un formulario válido devuelve `{ ok: true, payload }` con `payload.descripcion = null` si estaba vacía.
  5. Manual: al elegir tipo "Gasto" el selector muestra solo categorías de gasto activas; al cambiar a "Ingreso", solo las de ingreso activas y la categoría elegida se limpia.
  6. Manual: en edición de un movimiento con categoría desactivada, el selector muestra esa categoría además de las activas del tipo.
  7. Manual: al guardar, el botón queda deshabilitado hasta recibir respuesta (CB-25).
  8. Manual: un error `VALIDACION` del servidor se muestra junto al campo correspondiente.
  9. Manual: una descripción `<b>hola</b>` se muestra literal, sin negrita (CB-26).

### T-18 — Listado de movimientos, filtros y eliminación
- **Estado:** [ ] pendiente
- **Agente:** Dev frontend
- **Qué hace:** tabla de movimientos (en tarjetas en pantallas chicas) con selector de mes (por defecto, el actual), filtros de tipo y categoría, paginación de 20 y eliminación con confirmación.
- **RN / HU:** RN-10, RN-11 · HU-02, HU-04
- **Depende de:** T-17, T-11, T-10
- **Archivos esperados:** `js/vistas/movimientos.js`, `js/consulta.js`, `test/consulta.test.js`
- **Terminada cuando:**
  1. `construirQuery({ mes:"2026-10", tipo:"GASTO", categoriaId:3, pagina:2 })` → `"mes=2026-10&tipo=GASTO&categoriaId=3&pagina=2"`.
  2. `construirQuery({ mes:"2026-10", tipo:"", categoriaId:null })` → `"mes=2026-10"` (omite vacíos).
  3. Manual: al abrir con hoy = 30/10/2026 el selector muestra "octubre 2026" y la lista corresponde a ese mes.
  4. Manual: con 25 movimientos, la página 1 muestra 20 y existe control para ir a la página 2, que muestra 5.
  5. Manual: mes sin movimientos → mensaje "No hay movimientos en este mes" y no un error.
  6. Manual: "Eliminar" abre una confirmación; "Cancelar" no elimina; "Confirmar" elimina y actualiza la lista y la página.
  7. Manual: los movimientos de gasto y de ingreso se distinguen por un texto o signo, no solo por color.

### T-19 — Pantalla de categorías
- **Estado:** [ ] pendiente
- **Agente:** Dev frontend
- **Qué hace:** lista de categorías por tipo con alta, renombrar, activar/desactivar y eliminar; muestra el mensaje del servidor ante errores; sin acciones para las protegidas.
- **RN / HU:** RN-06, RN-07, RN-08, RN-09 · HU-07
- **Depende de:** T-16, T-06, T-07
- **Archivos esperados:** `js/vistas/categorias.js`
- **Terminada cuando:** (verificación manual con el seed)
  1. Crear "Mascotas" (Gasto) → aparece en la lista de gastos.
  2. Crear "alimentacion" (Gasto) → se muestra el error de nombre duplicado junto al campo; no se crea.
  3. Crear "Regalos" en Gasto y en Ingreso → ambas se crean.
  4. "Otros gastos" y "Otros ingresos" no muestran botones de renombrar, desactivar ni eliminar.
  5. Desactivar "Ocio" → se marca como inactiva; en el formulario de nuevo movimiento ya no aparece; reactivar → vuelve a aparecer.
  6. Eliminar "Salud" sin movimientos → desaparece tras confirmar.
  7. Eliminar "Alimentación" con movimientos → mensaje que sugiere desactivarla; la categoría sigue.

### T-20 — Pantalla de resumen
- **Estado:** [ ] pendiente
- **Agente:** Dev frontend
- **Qué hace:** selector de mes, tarjetas de ingresos, gastos, balance del mes y balance acumulado, y tablas por categoría con porcentajes.
- **RN / HU:** RN-12, RN-13, RN-14 · HU-05, HU-06
- **Depende de:** T-16, T-13
- **Archivos esperados:** `js/vistas/resumen.js`
- **Terminada cuando:** (verificación manual con los datos de CA-05.1 y CA-06.1)
  1. Octubre 2026 muestra ingresos "$ 500.000,00", gastos "$ 120.000,50", balance del mes "$ 379.999,50" y acumulado "$ 479.999,50".
  2. Un mes con balance negativo lo muestra con signo menos y con el texto "Déficit" o similar, no solo en rojo.
  3. Alimentación $ 30.000,00 y Transporte $ 10.000,00 se listan con "75,0 %" y "25,0 %", en ese orden.
  4. Mes sin movimientos → importes en "$ 0,00" y mensaje "Sin movimientos" en cada tabla.
  5. Cambiar de mes actualiza todo sin recargar.

### T-21 — Pantalla de presupuestos y aviso de alertas
- **Estado:** [ ] pendiente
- **Agente:** Dev frontend
- **Qué hace:** lista de presupuestos con barra de progreso y estado en texto, formulario para definir, reemplazar y quitar límites, y un aviso visible en todas las pantallas cuando hay presupuestos en `ALERTA` o `EXCEDIDO` en el mes actual.
- **RN / HU:** RN-15, RN-16 · HU-08, HU-09
- **Depende de:** T-16, T-14, T-15
- **Archivos esperados:** `js/vistas/presupuestos.js`, `js/aviso-alertas.js`
- **Terminada cuando:** (verificación manual, hoy = 30/10/2026, límite de Alimentación $ 100.000,00)
  1. Con gastado $ 79.999,99 la fila dice "Normal" y no hay aviso.
  2. Con $ 80.000,00 dice "Alerta" y aparece el aviso con "Alimentación" en todas las pantallas.
  3. Con $ 100.000,01 dice "Excedido" y el aviso lo indica; el texto de estado está presente sin depender del color.
  4. La barra de progreso nunca desborda su contenedor aunque el consumo supere el 100 %.
  5. Definir un límite nuevo lo agrega; volver a definirlo lo reemplaza; "Quitar límite" lo elimina y deja de mostrarse.
  6. Solo se ofrecen categorías de gasto activas para definir límites.
  7. Se guarda un límite inválido (`0` o `12,345`) → error junto al campo.

---

## Etapa 7 — Cierre

### T-22 — Prueba de punta a punta y cierre de documentación
- **Estado:** [ ] pendiente
- **Agente:** Tester (ejecuta) y Revisor (verifica trazabilidad)
- **Qué hace:** recorre un escenario completo en el sistema real, actualiza `README.md` con los comandos reales y verifica que cada RN, HU y caso borde de la spec quedó cubierto por alguna tarea hecha.
- **RN / HU:** todas
- **Depende de:** T-01 a T-21
- **Archivos esperados:** `README.md`, `docs/pruebas-manuales.md`
- **Terminada cuando:**
  1. Con base nueva: crear "Mascotas" (Gasto), cargar un ingreso "Sueldo" de $ 500.000,00 el 2026-10-05 y un gasto "Alimentación" de $ 80.000,00 el 2026-10-10 → el resumen de octubre muestra balance del mes $ 420.000,00.
  2. Definir límite $ 100.000,00 en Alimentación → estado "Alerta" (80,0 %) y aviso visible.
  3. Editar el gasto a $ 100.000,01 → "Excedido".
  4. Eliminar ese gasto con confirmación → el aviso desaparece y el balance vuelve a $ 500.000,00.
  5. Desactivar "Alimentación" tras cargarle un movimiento → no se ofrece en el alta, el movimiento sigue en la lista y en el resumen.
  6. Reiniciar el servidor → todos los datos siguen.
  7. `npm test` en `backend/` y en `frontend/` termina sin fallas.
  8. `docs/pruebas-manuales.md` contiene las listas manuales de T-16 a T-21 con resultado de cada ítem.
  9. Cada RN-01 a RN-17 y cada CB-01 a CB-26 está nombrado en al menos un test o ítem manual; las que no, se listan como defecto.
  10. El `README.md` tiene los comandos de instalación, arranque y prueba verificados en una máquina limpia.
