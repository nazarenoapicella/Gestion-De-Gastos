# Preguntas relevadas y cerradas — Gestión de Gastos

> Versión 1.1 · Estado: sin preguntas pendientes para el MVP · Última actualización: 2026-11-16

Este documento conserva las preguntas que se habrían formulado durante el relevamiento. Las respuestas son **supuestos funcionales adoptados por el equipo para el MVP académico**; no se presentan como respuestas textuales ni como validación formal de un cliente real.

La columna **impacto si no se resolvía** explica qué parte del sistema quedaba ambigua. La prioridad ordena las preguntas por el riesgo funcional o técnico que generaban durante el análisis. Todas las preguntas están cerradas; las ampliaciones excluidas no son pendientes del MVP.

| Prioridad | ID | Pregunta | RN / HU afectadas | Impacto si no se resolvía | Respuesta adoptada para el MVP | Estado / destino |
|---|---|---|---|---|---|---|
| Crítica | Q-10 | ¿Se usará desde un celular y cómo se publicará para que pueda evaluarse? | RN-17; requisitos no funcionales; HU-01 a HU-09 | Sin definir la publicación y el acceso, no se podría determinar cómo probar el sistema ni advertir los riesgos de una aplicación sin login. | La interfaz es responsive. Se admite una demo pública únicamente para evaluación académica, con datos ficticios/de prueba. No es una publicación de producción ni debe usarse con información real. | Cerrada · `spec.md` §2 y §8; D-023 |
| Alta | Q-11 | ¿Va a haber más de una persona usándolo? | RN-01 a RN-17; todas las HU | Cambia el modelo de datos, la propiedad de movimientos y presupuestos, y los permisos. | No. El MVP tiene una sola persona usuaria, sin cuentas ni separación de datos. El uso multiusuario requiere otro alcance. | Cerrada · D-01; fuera de alcance |
| Alta | Q-01 | ¿Querés separar tus movimientos por cuenta (efectivo, banco, tarjeta)? | RN-12, RN-13; HU-05, HU-06 | Afecta el modelo de datos y el cálculo del balance; no se podría definir qué saldo se resume. | No. Todo se registra en una sola bolsa de dinero, sin cuentas. | Cerrada · fuera de alcance en `spec.md` §2 |
| Alta | Q-02 | ¿Hay gastos fijos que se repitan todos los meses y quieras que se carguen solos? | RN-03, RN-11, RN-12; HU-01, HU-02, HU-05 | Requiere definir periodicidad, fechas de generación, duplicados y comportamiento ante meses sin uso. | No. Los movimientos recurrentes no se generan automáticamente; cada movimiento se carga manualmente. | Cerrada · fuera de alcance en `spec.md` §2 |
| Alta | Q-03 | ¿Pagás en cuotas con tarjeta? ¿Cómo querés verlas? | RN-02, RN-03, RN-11, RN-12; HU-01, HU-05 | Podría requerir plan de cuotas, vencimientos y una regla para distribuir importes entre meses. | Cada cuota se carga manualmente como un gasto independiente con la fecha en que se paga. No hay gestión de planes de cuotas. | Cerrada · fuera de alcance en `spec.md` §2 |
| Alta | Q-05 | ¿Querés un presupuesto distinto para cada mes? | RN-15, RN-16; HU-08, HU-09 | Cambia la clave del presupuesto y la forma de evaluar meses pasados. | No. Hay un límite por categoría de gasto, vigente para todos los meses; el estado mensual se calcula usando el límite vigente. | Cerrada · D-12; RN-15 y RN-16 |
| Alta | Q-06 | Cuando llegás al límite, ¿el sistema debe impedir nuevos gastos? | RN-16; HU-09 | Determina si la regla es una alerta informativa o un bloqueo transaccional. | No bloquea. Informa desde el 80 % y marca excedido por encima del 100 %. | Cerrada · D-13; RN-16 |
| Media | Q-12 | Si borrás una categoría que tiene un límite de presupuesto, ¿qué pasa con ese límite? | RN-08; HU-07, HU-08 | Podría quedar un presupuesto huérfano o habría que definir una política de conservación. | Una categoría solo se elimina si no tiene movimientos; si tiene presupuesto, se elimina junto con la categoría. | Cerrada · RN-08 |
| Media | Q-13 | Si desactivás una categoría que tiene presupuesto, ¿se sigue avisando? | RN-09, RN-16; HU-07, HU-09 | Podrían mostrarse avisos sobre una categoría que la persona decidió dejar de usar. | El presupuesto se conserva, pero no aparece ni genera avisos mientras la categoría esté inactiva. | Cerrada · RN-09 |
| Media | Q-04 | ¿Hacés transferencias entre tus propias cuentas? | RN-01, RN-12; HU-01, HU-05 | Una transferencia no es ingreso ni gasto y requeriría cuentas y una operación distinta. | No aplica al MVP porque no existen cuentas ni transferencias. | Cerrada · dependiente de Q-01; fuera de alcance |
| Media | Q-07 | ¿Necesitás etiquetas, notas largas o adjuntar comprobantes? | RN-05; HU-01, HU-02, HU-03 | Afecta los campos, los límites de validación y el almacenamiento de archivos. | No. Solo se admite una descripción breve de hasta 140 caracteres; no hay etiquetas ni adjuntos. | Cerrada · RN-05; fuera de alcance parcial |
| Baja | Q-08 | ¿Querés gráficos? | RN-13; HU-06 | Habría que definir indicadores, escalas, filtros y una representación visual adicional. | No en esta versión. Se muestran totales, porcentajes y barras simples. | Cerrada · fuera de alcance parcial en `spec.md` §2 |
| Baja | Q-09 | ¿Necesitás copias de seguridad o exportar datos desde la aplicación? | RN-17; HU-01 a HU-09 | Requiere definir formatos de exportación, frecuencia y restauración. | No hay exportación ni copia automática desde el sistema. La base local puede copiarse manualmente; la demo alojada es temporal y no debe usarse como almacenamiento. | Cerrada · D-16; fuera de alcance |

## Estado de cierre

Las preguntas Q-01 a Q-13 están respondidas y sus decisiones se reflejan en `decisiones.md`, `spec.md` y `plan.md`. **No quedan preguntas abiertas que bloqueen la implementación o la entrega del MVP.** Las funciones excluidas son límites de alcance deliberados, no tareas incompletas. Si se cambia una respuesta, se registra una nueva decisión y se actualizan los documentos vinculados antes de modificar el código.

## Historial de cambios

- [cambio] 2026-10-30 — Versión 0.1: Q-01 a Q-11 redactadas.
- [cambio] 2026-10-30 — Versión 0.2: agregadas Q-12 y Q-13 al revisar la spec; respuestas adoptadas como propuesta del equipo.
- [cambio] 2026-11-15 — Se cierra el documento como supuestos adoptados por el equipo para el MVP, sin atribuir validación formal al cliente.
- [cambio] 2026-11-16 — Se agrega prioridad, reglas/historias afectadas e impacto de cada pregunta; Q-10 se alinea con la demo académica pública sin datos reales.
