# Especificación — GastoClaro

> Versión 1.0 · Estado: Vigente · Última actualización: 2026-10-30

Este documento es el **contrato** del sistema. Lo leen el cliente (para confirmar que es lo que quiere), el programador/analista (para construirlo) y los agentes de IA (que trabajan en base a él). Si algo no está acá, no se programa; si algo es ambiguo, se registra en `preguntas-abiertas.md` en vez de interpretarlo.

Fuentes: `ideas.md`, `decisiones.md`, `glosario.md`, `preguntas-abiertas.md`. Los términos se usan como se definen en el glosario.

## 1. Objetivo

Permitir que una persona registre sus ingresos y gastos, los vea por mes, entienda en qué categorías gasta y reciba avisos cuando se acerca o supera el límite que se puso para una categoría, desde una página web simple.

## 2. Alcance

### Incluye

- Registrar, ver, filtrar, editar y eliminar movimientos (ingresos y gastos).
- Administrar categorías (crear, renombrar, desactivar, reactivar, eliminar) con categorías por defecto.
- Ver el balance del mes y el balance acumulado.
- Ver el resumen del mes por categoría con porcentajes.
- Definir un límite mensual por categoría de gasto y ver su estado (normal, alerta, excedido).
- Interfaz web que se adapta a celular y computadora.

### No incluye (fuera de alcance)

- Usuarios, login y permisos (D-01).
- Más de una moneda (D-02).
- Cuentas, tarjetas, transferencias, cuotas y gastos recurrentes (Q-01 a Q-04).
- Gráficos (Q-08), exportación y copias de seguridad desde el sistema (D-16, Q-09).
- Notificaciones por email o push (D-15).
- Etiquetas, notas largas y adjuntos (Q-07).
- Publicación en internet (Q-10).

## 3. Actores

- **Persona usuaria:** única persona que usa el sistema. Puede hacer todas las operaciones descriptas.

## 4. Reglas de negocio

| ID | Regla |
|---|---|
| **RN-01** | Todo movimiento es de tipo `INGRESO` o `GASTO`. No existe otro tipo. |
| **RN-02** | El monto de un movimiento es un número entero de centavos, mayor o igual a 1 ($ 0,01) y menor o igual a 99.999.999.999 ($ 999.999.999,99). Nunca es cero, negativo ni tiene más de dos decimales. El signo lo da el tipo. |
| **RN-03** | La fecha del movimiento es obligatoria, con formato `AAAA-MM-DD`, debe existir en el calendario (el 29/02 solo en años bisiestos) y estar entre el 2000-01-01 y hoy, ambos inclusive. "Hoy" se calcula en `America/Argentina/Buenos_Aires`. |
| **RN-04** | Todo movimiento tiene una categoría que debe existir, ser del **mismo tipo** que el movimiento y, al crear un movimiento, estar **activa**. |
| **RN-05** | La descripción es opcional. Se le quitan los espacios sobrantes al inicio y al final; si queda vacía se guarda como ausente (`null`). Máximo 140 caracteres. |
| **RN-06** | El nombre de una categoría es obligatorio y tiene entre 1 y 30 caracteres después de quitar espacios al inicio y al final y reducir los espacios repetidos a uno solo. No puede repetirse dentro del mismo tipo, sin distinguir mayúsculas ni tildes ("Alimentación" y "alimentacion" son el mismo nombre). El tipo de una categoría no se puede modificar. |
| **RN-07** | Al instalar el sistema existen estas categorías por defecto. **Gastos:** Alimentación, Transporte, Vivienda, Servicios, Salud, Ocio, Educación, Otros gastos. **Ingresos:** Sueldo, Ventas, Otros ingresos. "Otros gastos" y "Otros ingresos" son **protegidas**: no se pueden renombrar, desactivar ni eliminar. Las demás por defecto se tratan como cualquier categoría. |
| **RN-08** | Una categoría solo se puede eliminar si no tiene movimientos. Si tiene un presupuesto, este se elimina junto con ella. Si tiene movimientos, solo se puede desactivar. |
| **RN-09** | Una categoría inactiva no se ofrece para movimientos nuevos ni se puede elegir en ellos, pero sus movimientos existentes se conservan, se listan y suman en los reportes. Al editar un movimiento cuya categoría está inactiva, se puede dejar esa misma categoría; para cambiarla hay que elegir una activa. Su presupuesto se conserva pero no aparece en el estado de presupuestos mientras esté inactiva. |
| **RN-10** | Un movimiento se puede editar en todos sus campos con las mismas validaciones que al crearlo. Si cambia el tipo, la categoría debe ser del nuevo tipo. Eliminar un movimiento es definitivo; la interfaz pide confirmación antes. |
| **RN-11** | El listado de movimientos se ordena por fecha descendente y, ante igual fecha, por identificador descendente (el último cargado primero). Se muestra en páginas de 20. Se puede filtrar por mes, tipo y categoría, y los filtros se combinan (todos deben cumplirse). Si no se indica mes en la API, se incluyen todos los meses; la interfaz abre con el mes actual. |
| **RN-12** | **Balance del mes** = suma de ingresos − suma de gastos de los movimientos cuya fecha cae en el mes calendario consultado. Puede ser negativo. **Balance acumulado** = suma de todos los ingresos − suma de todos los gastos con fecha hasta el último día del mes consultado, inclusive. |
| **RN-13** | El resumen por categoría se calcula por separado para gastos e ingresos. Para cada categoría con movimientos en el mes muestra su total y su porcentaje sobre el total del tipo en ese mes, redondeado a un decimal (mitad hacia arriba). Se ordena por total descendente y, ante empate, por nombre. Las categorías sin movimientos en el mes no aparecen. Si el tipo no tiene movimientos en el mes, la lista está vacía. Las categorías inactivas con movimientos sí aparecen. |
| **RN-14** | La única moneda es el peso argentino. En pantalla los montos se muestran como `$ 1.234,56` y las fechas como `DD/MM/AAAA`. Al ingresar un monto se usa la coma como separador decimal. |
| **RN-15** | Una categoría de tipo `GASTO` y activa puede tener un presupuesto: un límite mensual, mayor o igual a 1 centavo y con el mismo máximo que RN-02. Hay a lo sumo un presupuesto por categoría y rige para todos los meses. Definir un presupuesto sobre una categoría que ya tiene uno lo reemplaza. Se evalúa siempre con el límite vigente, incluso para meses pasados. Se puede quitar. Las categorías de tipo `INGRESO` no tienen presupuesto. |
| **RN-16** | El **consumo** de un presupuesto en un mes es lo gastado en la categoría en ese mes ÷ el límite. Estado: `NORMAL` si es menor a 80 %; `ALERTA` si es de 80 % a 100 %, ambos inclusive; `EXCEDIDO` si es mayor a 100 %. La comparación se hace con enteros (centavos) y no con porcentajes redondeados. El porcentaje de consumo que se muestra se redondea a un decimal. Las alertas solo informan: nunca bloquean una operación. |
| **RN-17** | Los reportes y listados por mes reciben el mes como `AAAA-MM`, con mes entre 01 y 12. Un mes con formato inválido es un error. Un mes válido sin movimientos no es un error: devuelve valores en cero o listas vacías. El mes es obligatorio en el resumen y en el estado de presupuestos. |

## 5. Modelo conceptual

- **Categoría**: nombre, tipo, activa, protegida.
- **Movimiento**: monto, fecha, descripción opcional, fecha de carga; pertenece a una categoría (el tipo del movimiento es el tipo de su categoría).
- **Presupuesto**: límite mensual; pertenece a una categoría de gasto (a lo sumo uno por categoría).

El detalle técnico está en `plan.md`.

## 6. Historias de usuario y criterios de aceptación

Fecha de referencia para los ejemplos: **hoy = 2026-10-30**.

### HU-01 — Registrar un movimiento
*Como persona usuaria quiero registrar un ingreso o un gasto para saber cuánto entra y cuánto sale.*

| ID | Criterio |
|---|---|
| CA-01.1 | **Dado** la categoría activa "Alimentación" (GASTO), **cuando** registro un GASTO de $ 1.234,56 con fecha 2026-10-29 y descripción "Supermercado", **entonces** se guarda con 123456 centavos y el sistema responde que se creó, con su identificador. |
| CA-01.2 | **Cuando** registro un movimiento sin descripción o con solo espacios, **entonces** se guarda con descripción ausente. |
| CA-01.3 | **Cuando** el monto es 0, negativo o no es un entero de centavos, **entonces** se rechaza con error en el campo monto y no se guarda nada. |
| CA-01.4 | **Cuando** la fecha es 2026-10-31 (mañana), **entonces** se rechaza con error en el campo fecha. |
| CA-01.5 | **Cuando** registro un GASTO con la categoría "Sueldo" (INGRESO), **entonces** se rechaza con error en el campo categoría. |
| CA-01.6 | **Cuando** elijo una categoría inactiva, **entonces** se rechaza con error en el campo categoría. |
| CA-01.7 | **Cuando** la descripción tiene 141 caracteres, **entonces** se rechaza con error en el campo descripción. |

### HU-02 — Ver y filtrar movimientos
*Como persona usuaria quiero ver mis movimientos de un mes y filtrarlos para encontrar lo que busco.*

| ID | Criterio |
|---|---|
| CA-02.1 | **Dado** movimientos de varios meses, **cuando** abro la lista, **entonces** veo los del mes actual ordenados por fecha descendente y, a igual fecha, el último cargado primero. |
| CA-02.2 | **Cuando** filtro por mes, tipo y categoría a la vez, **entonces** veo solo los que cumplen los tres filtros. |
| CA-02.3 | **Dado** 25 movimientos en un mes, **entonces** la página 1 muestra 20, la página 2 muestra 5 y se informa el total (25) y la cantidad de páginas (2). |
| CA-02.4 | **Cuando** el mes no tiene movimientos, **entonces** veo una lista vacía con un mensaje y no un error. |
| CA-02.5 | **Cuando** pido una página mayor a la última, **entonces** la lista llega vacía con el total correcto. |

### HU-03 — Editar un movimiento
*Como persona usuaria quiero corregir un movimiento mal cargado.*

| ID | Criterio |
|---|---|
| CA-03.1 | **Cuando** cambio el monto de $ 1.000,00 a $ 1.500,50 y la descripción, **entonces** se guardan los nuevos valores y se conserva su identificador y fecha de carga. |
| CA-03.2 | **Cuando** cambio el tipo de GASTO a INGRESO sin cambiar la categoría (sigue siendo de gastos), **entonces** se rechaza con error en el campo categoría. |
| CA-03.3 | **Dado** un movimiento cuya categoría fue desactivada, **cuando** edito solo el monto y mantengo esa categoría, **entonces** se guarda. |
| CA-03.4 | **Cuando** edito un movimiento que no existe, **entonces** el sistema informa que no se encontró. |
| CA-03.5 | **Cuando** edito con datos inválidos, **entonces** se aplican las mismas validaciones que en CA-01.3 a CA-01.7 y el movimiento no cambia. |

### HU-04 — Eliminar un movimiento
*Como persona usuaria quiero borrar un movimiento cargado por error.*

| ID | Criterio |
|---|---|
| CA-04.1 | **Cuando** confirmo la eliminación, **entonces** el movimiento desaparece de la lista y de los totales. |
| CA-04.2 | **Cuando** cancelo la confirmación, **entonces** no se elimina nada. |
| CA-04.3 | **Cuando** elimino un movimiento que no existe, **entonces** el sistema informa que no se encontró. |

### HU-05 — Ver el balance
*Como persona usuaria quiero saber cuánto me quedó en el mes y cuánto tengo acumulado.*

| ID | Criterio |
|---|---|
| CA-05.1 | **Dado** en 2026-10 ingresos por $ 500.000,00 y gastos por $ 120.000,50, **entonces** el balance del mes es $ 379.999,50. |
| CA-05.2 | **Dado** un mes con más gastos que ingresos, **entonces** el balance del mes es negativo y se muestra con signo menos. |
| CA-05.3 | **Dado** un ingreso de $ 100.000,00 en 2026-09 y los movimientos del CA-05.1, **entonces** el balance acumulado de 2026-10 es $ 479.999,50. |
| CA-05.4 | **Dado** un mes sin movimientos, **entonces** ingresos, gastos y balance del mes son $ 0,00 y el acumulado conserva lo anterior. |
| CA-05.5 | **Cuando** el mes consultado es inválido (ej. 2026-13), **entonces** se informa error. |

### HU-06 — Ver el resumen por categoría
*Como persona usuaria quiero ver en qué categorías gasto más.*

| ID | Criterio |
|---|---|
| CA-06.1 | **Dado** gastos del mes: Alimentación $ 30.000,00 y Transporte $ 10.000,00, **entonces** se muestran Alimentación 75,0 % y Transporte 25,0 %, en ese orden. |
| CA-06.2 | **Dado** tres categorías con $ 100,00 cada una, **entonces** cada una muestra 33,3 %. |
| CA-06.3 | **Dado** dos categorías con el mismo total, **entonces** se ordenan alfabéticamente por nombre. |
| CA-06.4 | **Dado** un mes sin ingresos, **entonces** la lista de ingresos está vacía. |
| CA-06.5 | **Dado** una categoría inactiva con movimientos en el mes, **entonces** aparece igual en el resumen. |

### HU-07 — Administrar categorías
*Como persona usuaria quiero adaptar las categorías a mi forma de gastar.*

| ID | Criterio |
|---|---|
| CA-07.1 | **Cuando** creo "  Mascotas " de tipo GASTO, **entonces** se crea con nombre "Mascotas", activa. |
| CA-07.2 | **Cuando** creo "Alimentacion" de tipo GASTO y ya existe "Alimentación", **entonces** se rechaza por nombre duplicado. |
| CA-07.3 | **Cuando** creo "Regalos" de tipo INGRESO y ya existe "Regalos" de tipo GASTO, **entonces** se crea. |
| CA-07.4 | **Cuando** el nombre está vacío o tiene más de 30 caracteres, o el tipo no es válido, **entonces** se rechaza con error de validación. |
| CA-07.5 | **Cuando** renombro "Ocio" a "Entretenimiento", **entonces** los movimientos de esa categoría pasan a mostrar el nuevo nombre. |
| CA-07.6 | **Cuando** desactivo "Ocio", **entonces** ya no aparece para movimientos nuevos y sus movimientos viejos siguen visibles; al reactivarla vuelve a ofrecerse. |
| CA-07.7 | **Cuando** intento renombrar, desactivar o eliminar "Otros gastos" u "Otros ingresos", **entonces** se rechaza por categoría protegida. |
| CA-07.8 | **Cuando** elimino una categoría sin movimientos, **entonces** desaparece. |
| CA-07.9 | **Cuando** elimino una categoría con movimientos, **entonces** se rechaza y se sugiere desactivarla. |

### HU-08 — Definir límites de presupuesto
*Como persona usuaria quiero ponerme un tope mensual por categoría.*

| ID | Criterio |
|---|---|
| CA-08.1 | **Cuando** defino $ 50.000,00 para "Alimentación", **entonces** queda guardado como 5000000 centavos. |
| CA-08.2 | **Cuando** defino $ 60.000,00 para "Alimentación" que ya tenía límite, **entonces** reemplaza al anterior y sigue habiendo un único límite. |
| CA-08.3 | **Cuando** intento definir un límite para "Sueldo" (INGRESO), **entonces** se rechaza. |
| CA-08.4 | **Cuando** el límite es 0, negativo o inválido, **entonces** se rechaza. |
| CA-08.5 | **Cuando** intento definir un límite para una categoría inactiva, **entonces** se rechaza. |
| CA-08.6 | **Cuando** quito el límite, **entonces** la categoría deja de tener presupuesto; quitar uno inexistente informa que no se encontró. |

### HU-09 — Recibir alertas de presupuesto
*Como persona usuaria quiero que el sistema me avise cuando me estoy pasando.*

| ID | Criterio |
|---|---|
| CA-09.1 | **Dado** un límite de $ 100.000,00 y gastado de $ 79.999,99, **entonces** el estado es `NORMAL`. Con $ 80.000,00 es `ALERTA`. Con $ 100.000,00 es `ALERTA`. Con $ 100.000,01 es `EXCEDIDO`. |
| CA-09.2 | **Dado** gastos de la misma categoría en otros meses, **entonces** solo se cuenta lo gastado en el mes consultado. |
| CA-09.3 | **Dado** una categoría inactiva con presupuesto, **entonces** no aparece en el estado de presupuestos. |
| CA-09.4 | **Dado** una categoría sin presupuesto, **entonces** no aparece en el estado de presupuestos. |
| CA-09.5 | **Cuando** hay al menos un presupuesto en `ALERTA` o `EXCEDIDO` en el mes actual, **entonces** todas las pantallas muestran un aviso visible que indica cuáles. El aviso no depende solo del color. |
| CA-09.6 | **Dado** un límite que se baja por debajo de lo ya gastado, **entonces** el estado se recalcula con el nuevo límite. |

## 7. Casos borde

| ID | Situación | Resultado esperado | RN |
|---|---|---|---|
| CB-01 | Monto `0,00` | Error en monto | RN-02 |
| CB-02 | Monto `0,01` | Se guarda con 1 centavo | RN-02 |
| CB-03 | Monto $ 999.999.999,99 | Se guarda | RN-02 |
| CB-04 | Monto $ 1.000.000.000,00 | Error en monto | RN-02 |
| CB-05 | Monto con tres decimales (`12,345`) | La interfaz lo rechaza; la API nunca lo recibe | RN-02, RN-14 |
| CB-06 | Fecha de hoy | Se guarda | RN-03 |
| CB-07 | Fecha de mañana | Error en fecha | RN-03 |
| CB-08 | `2026-02-29` (no bisiesto) | Error en fecha | RN-03 |
| CB-09 | `2024-02-29` | Se guarda | RN-03 |
| CB-10 | `1999-12-31` y `2000-01-01` | La primera da error; la segunda se guarda | RN-03 |
| CB-11 | Son las 22:30 del 30/10 en Argentina (01:30 UTC del 31/10) | "Hoy" es 2026-10-30; un movimiento del 31 se rechaza | RN-03 |
| CB-12 | Movimiento del último día del mes | Cuenta en ese mes, no en el siguiente | RN-12 |
| CB-13 | Descripción de 140 y de 141 caracteres | 140 se guarda; 141 da error | RN-05 |
| CB-14 | Nombre de categoría `"  alimentación  "` | Se normaliza y se detecta duplicado | RN-06 |
| CB-15 | Mismo nombre en distinto tipo | Se permite | RN-06 |
| CB-16 | Nombre de categoría con 30 y con 31 caracteres | 30 se guarda; 31 da error | RN-06 |
| CB-17 | Eliminar categoría con presupuesto y sin movimientos | Se elimina la categoría y su presupuesto | RN-08 |
| CB-18 | Desactivar una categoría y editar un movimiento viejo de ella | Se puede dejar la categoría o cambiarla por una activa | RN-09 |
| CB-19 | Presupuesto con gastado exactamente al 80 % y al 100 % | `ALERTA` en ambos | RN-16 |
| CB-20 | Presupuesto con gastado al 100,0001 % (un centavo de más) | `EXCEDIDO` aunque el porcentaje mostrado sea 100,0 % | RN-16 |
| CB-21 | Mes sin movimientos | Ceros y listas vacías, sin error | RN-17 |
| CB-22 | Mes `2026-13`, `2026-00` o `2026-1` | Error de mes inválido | RN-17 |
| CB-23 | Mes futuro (`2027-01`) | Ceros; el acumulado conserva lo anterior | RN-12, RN-17 |
| CB-24 | Dos movimientos con la misma fecha | Se muestra primero el cargado último | RN-11 |
| CB-25 | Doble clic en "Guardar" | La interfaz deshabilita el botón mientras envía; si llegan dos, se crean dos | D-20 |
| CB-26 | Descripción con caracteres especiales (`<script>`, comillas) | Se muestra como texto, nunca se interpreta como código | Seguridad |

## 8. Requisitos no funcionales

- **Validación en el servidor:** toda regla se valida en el backend aunque la interfaz también la valide.
- **Interfaz:** adaptable a pantallas de celular y computadora; los campos tienen etiqueta; el estado de un presupuesto o el signo de un balance nunca se comunican solo por color.
- **Seguridad básica:** consultas a la base de datos parametrizadas; el texto ingresado por la persona nunca se inserta como HTML.
- **Rendimiento:** listados y reportes responden en menos de 1 segundo con hasta 10.000 movimientos.
- **Navegadores:** versiones actuales de Chrome, Edge y Firefox.

## 9. Pendientes y ambigüedades

Sin pendientes que bloqueen el desarrollo. Las dudas menores están en `plan.md` §7 con el supuesto adoptado.

## Historial de cambios

- [cambio] 2026-10-30 — Versión 0.1: objetivo, alcance, reglas de negocio e historias de usuario, a partir de `ideas.md`, `decisiones.md` y `glosario.md`.
- [cambio] 2026-10-30 — Versión 1.0: resueltos los pendientes marcados (Q-12, Q-13: qué pasa con presupuestos al eliminar o desactivar; RN-17: mes obligatorio en reportes). Agregados casos borde CB-01 a CB-26.
