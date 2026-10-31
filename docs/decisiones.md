# Decisiones — GastoClaro

> Versión 0.1 · Estado: Vigente · Última actualización: 2026-10-30

Preguntas que el sistema debe responder y la respuesta que se decidió. Si algo cambia, **no se borra la decisión anterior**: se marca `[cambio]` y se registra en el historial.
Las preguntas cuya respuesta depende de la persona están en `preguntas-abiertas.md` y, una vez respondidas, terminan acá o en la spec.

## 1. Alcance y usuarios

| ID | Pregunta | Decisión | Motivo |
|---|---|---|---|
| D-01 | ¿Cuántas personas usan el sistema? | Una sola, sin registro ni login. | Mantiene el sistema simple. Si se agrega multiusuario, es un proyecto nuevo (afecta todas las tablas). |
| D-15 | ¿Se avisa por email o notificación? | No. Las alertas se ven solo en pantalla. | Evita servicios externos y tareas en segundo plano. |
| D-16 | ¿Se pueden exportar los datos? | No en esta versión. | No fue pedido; se puede sumar después. |

## 2. Dinero y tiempo

| ID | Pregunta | Decisión | Motivo |
|---|---|---|---|
| D-02 | ¿Qué moneda se usa? | Pesos argentinos (ARS), única moneda. | Evita reglas de conversión. |
| D-03 | ¿Cómo se guarda el dinero? | Como números enteros de centavos (nunca decimales flotantes). | Evita errores de redondeo. $ 1.234,56 = 123456. |
| D-05 | ¿Se puede registrar un movimiento con fecha futura? | No. Se permite desde el 01/01/2000 hasta hoy, inclusive. | Un movimiento futuro distorsiona el balance del mes. |
| D-06 | ¿Qué se considera "hoy"? | La fecha calendario en `America/Argentina/Buenos_Aires`. | A las 22:30 del 30/10 en Argentina, el servidor en UTC ya está en el 31/10; no puede decidir por la fecha UTC. |
| D-07 | ¿A qué mes pertenece un movimiento? | Al mes de su **fecha del movimiento**, no al de su fecha de carga. | Permite cargar con retraso sin alterar el mes real. |
| D-14 | ¿El balance acumulado parte de un saldo inicial? | No. Parte de cero. | El sistema no conoce cuentas ni saldos bancarios. |
| D-18 | ¿Cómo se muestran montos y fechas? | Montos `$ 1.234,56`; fechas `DD/MM/AAAA` en pantalla. En la API: centavos enteros y `AAAA-MM-DD`. | Formato local para la persona; formato inequívoco entre sistemas. |

## 3. Movimientos

| ID | Pregunta | Decisión | Motivo |
|---|---|---|---|
| D-04 | ¿Cómo se distingue un ingreso de un gasto? | Por el tipo (`INGRESO` / `GASTO`). El monto siempre es positivo. | Evita montos negativos ambiguos. |
| D-11 | ¿Cómo se elimina un movimiento? | Borrado definitivo, con confirmación en pantalla. No hay papelera. | Evita estados extra; la confirmación previene el error. |
| D-19 | ¿Cómo se informan los errores? | Respuesta JSON `{ "error": { "codigo", "mensaje", "campos" } }` con mensajes en español. | Permite mostrar el error junto al campo correspondiente. |
| D-20 | ¿Qué pasa si se envía dos veces lo mismo (doble clic) o se edita desde dos pestañas? | La interfaz deshabilita el botón mientras envía. El sistema no detecta duplicados; en edición gana la última escritura. | Es un solo usuario; un control de versiones sería exceso. Se documenta como limitación conocida. |

## 4. Categorías

| ID | Pregunta | Decisión | Motivo |
|---|---|---|---|
| D-08 | ¿Las categorías son fijas o libres? | Vienen precargadas y la persona puede crear, renombrar, desactivar y eliminar (con restricciones). | Cubre el uso común sin obligar a configurar. |
| D-09 | ¿Una categoría puede servir para ingresos y gastos? | No. Cada categoría tiene un único tipo, que no se puede cambiar. Puede haber dos categorías con el mismo nombre si son de distinto tipo. | Mantiene coherentes los reportes por tipo. |
| D-10 | ¿Se puede eliminar una categoría con movimientos? | No. Solo se desactiva. Si no tiene movimientos, se puede eliminar. | No perder historia ni reasignar a escondidas. |

## 5. Presupuestos

| ID | Pregunta | Decisión | Motivo |
|---|---|---|---|
| D-12 | ¿Hay presupuestos? | Sí: un límite mensual por categoría de gasto, vigente para todos los meses. | Responde al pedido de "que me avise si me paso". |
| D-13 | ¿Cuándo se alerta? | `ALERTA` desde 80 % hasta 100 % inclusive; `EXCEDIDO` por encima de 100 %. | Umbrales simples y comprensibles. |

## 6. Técnicas

| ID | Pregunta | Decisión | Motivo |
|---|---|---|---|
| D-17 | ¿Cuántos movimientos se muestran por página? | 20. | Equilibrio entre cantidad y rendimiento. |
| D-21 | ¿Qué tecnología se usa? | Frontend: HTML, CSS y JavaScript sin frameworks. Backend: Node.js + Express. Base de datos: SQLite. (Detalle en `plan.md`.) | Un solo lenguaje y cero servidores de base de datos que instalar. |

## Historial de cambios

- [cambio] 2026-10-30 — Versión inicial. Decisiones D-01 a D-21 ordenadas por tema para mayor claridad.
