# Glosario — GastoClaro

> Versión 0.1 · Estado: Borrador · Última actualización: 2026-10-30

Define los términos del sistema. Si una palabra puede entenderse de dos maneras, acá se fija cuál vale. Toda la documentación y el código usan estos nombres.

| Término | Definición | No confundir con |
|---|---|---|
| **Movimiento** | Registro de dinero que entra (ingreso) o sale (gasto), con tipo, monto, fecha, categoría y descripción opcional. | Una "transacción bancaria": acá no hay cuentas. |
| **Ingreso** | Movimiento de tipo `INGRESO`. Dinero que la persona recibe (sueldo, venta, etc.). | — |
| **Gasto** | Movimiento de tipo `GASTO`. Dinero que la persona paga. | — |
| **Tipo** | Clasificación del movimiento y de la categoría: `INGRESO` o `GASTO`. El tipo define el signo; el monto siempre se guarda positivo. | "Tipo de gasto" (eso es la categoría). |
| **Monto** | Cantidad de dinero de un movimiento, siempre positiva. En el sistema se guarda en centavos. | Saldo o balance. |
| **Centavos** | Unidad entera en la que se guarda el dinero. $ 1.234,56 = 123456 centavos. | — |
| **Categoría** | Rubro que agrupa movimientos (Alimentación, Sueldo…). Pertenece a un solo tipo. | Etiqueta o tag: un movimiento tiene una sola categoría. |
| **Categoría por defecto** | Categoría que viene cargada al instalar el sistema (ver RN-07). | Categoría protegida (es un subconjunto). |
| **Categoría protegida** | "Otros gastos" y "Otros ingresos". No se pueden renombrar, desactivar ni eliminar, para que siempre exista dónde clasificar. | — |
| **Categoría activa / inactiva** | Una categoría inactiva no se ofrece para movimientos nuevos, pero sus movimientos históricos se conservan y se siguen mostrando. | Eliminada: una categoría eliminada desaparece del sistema. |
| **Desactivar** | Pasar una categoría a inactiva. Reversible. | Eliminar. |
| **Eliminar** | Borrar definitivamente. Solo es posible si no hay movimientos asociados. | Desactivar. |
| **Mes calendario** | Período del día 1 al último día de un mes, identificado como `AAAA-MM` (ej. `2026-10`). | Período de 30 días corridos. |
| **Fecha del movimiento** | Día en que ocurrió el dinero, elegido por la persona. Define a qué mes pertenece. | Fecha de carga (`creadoEn`). |
| **Fecha de carga** | Momento en que se registró el movimiento en el sistema. Solo informativa. | Fecha del movimiento. |
| **Hoy** | Fecha calendario actual en la zona horaria `America/Argentina/Buenos_Aires`. | La fecha UTC del servidor. |
| **Balance del mes** | Ingresos del mes calendario menos gastos del mes calendario. Puede ser negativo. | Balance acumulado. |
| **Balance acumulado** | Suma de todos los ingresos menos todos los gastos hasta el último día del mes consultado, inclusive. No hay saldo inicial. | Balance del mes. |
| **Presupuesto** | Límite mensual de gasto de una categoría de tipo `GASTO`. Es uno solo por categoría y rige para todos los meses. | Una meta de ahorro. |
| **Gastado** | Suma de los gastos de una categoría dentro de un mes calendario. | — |
| **Consumo (%)** | Gastado ÷ límite del presupuesto × 100. | Porcentaje sobre el total de gastos (RN-13). |
| **Estado del presupuesto** | `NORMAL` (menos de 80 %), `ALERTA` (de 80 % a 100 % inclusive) o `EXCEDIDO` (más de 100 %). | — |
| **Alerta** | Aviso en pantalla cuando un presupuesto está en `ALERTA` o `EXCEDIDO`. No bloquea ninguna operación. | Notificación por email. |
| **Porcentaje sobre el total** | Participación de una categoría en el total de su tipo para el mes (RN-13). | Consumo del presupuesto. |
| **ARS** | Peso argentino, única moneda del sistema. | — |

## Historial de cambios

- [cambio] 2026-10-30 — Versión inicial del documento.
