# Preguntas abiertas — Gestion De Gastos

> Versión 0.2 · Estado: Respondidas (pendiente de validación del cliente) · Última actualización: 2026-10-30

Preguntas cuya respuesta puede variar según la persona. Son las que se le mandan al cliente para precisar el sistema.
Las respuestas de este documento las propuso el **analista funcional (IA)** a partir de `ideas.md` para poder cerrar la spec. Están marcadas como **Propuesta**: si el cliente contesta distinto, se registra con `[cambio]` y se actualizan `decisiones.md` y `spec.md`.

| ID | Pregunta al cliente | Por qué importa | Respuesta | Estado | Dónde quedó |
|---|---|---|---|---|---|
| Q-01 | ¿Querés separar tus movimientos por cuenta (efectivo, banco, tarjeta)? | Agrega una entidad y cambia el balance. | No. Todo se registra en una sola "bolsa" de dinero. | Propuesta | Fuera de alcance (spec §2) |
| Q-02 | ¿Hay gastos fijos que se repitan todos los meses (alquiler, servicios) y quieras que se carguen solos? | Requiere procesos automáticos. | No. Se cargan a mano cada mes. | Propuesta | Fuera de alcance (spec §2) |
| Q-03 | ¿Pagás en cuotas con tarjeta? ¿Cómo querés verlas? | Cada cuota podría ser un movimiento o uno solo repartido. | Cada cuota se carga como un gasto, con la fecha en que se paga. | Propuesta | Fuera de alcance (spec §2) |
| Q-04 | ¿Hacés transferencias entre tus propias cuentas? | Sería ni ingreso ni gasto. | No aplica: no hay cuentas (Q-01). | Propuesta | — |
| Q-05 | ¿Querés un presupuesto distinto para cada mes? | Cambia el modelo de datos de presupuestos. | No. Un límite por categoría, igual para todos los meses. | Propuesta | D-12, RN-15 |
| Q-06 | Cuando llegás al límite, ¿el sistema debe impedir nuevos gastos? | Define si es un aviso o un bloqueo. | No bloquea. Solo avisa. | Propuesta | D-13, RN-16 |
| Q-07 | ¿Necesitás etiquetas, notas largas o adjuntar comprobantes? | Más campos y almacenamiento de archivos. | No. Solo una descripción corta (140 caracteres). | Propuesta | RN-05 |
| Q-08 | ¿Querés gráficos? | Introduce librerías y reglas visuales. | No en esta versión. Tablas con porcentajes y barras de progreso simples. | Propuesta | Fuera de alcance (spec §2) |
| Q-09 | ¿Necesitás copias de seguridad o exportar? | Define si hay que construir esa función. | No. Los datos quedan en un archivo de base de datos que se puede copiar a mano. | Propuesta | D-16 |
| Q-10 | ¿Lo vas a usar desde el celular? | Afecta el diseño de pantallas. | Sí, la interfaz debe adaptarse a pantalla chica. No se publica en internet. | Propuesta | Spec §8 |
| Q-11 | ¿Va a haber más de una persona usándolo? | Cambia el sistema entero (usuarios, permisos). | No. Si ocurre, es un proyecto nuevo. | Propuesta | D-01 |
| Q-12 | Si borrás una categoría que tiene un límite de presupuesto, ¿qué querés que pase con el límite? | Evita datos huérfanos. | Se elimina junto con la categoría (solo se puede eliminar sin movimientos). | Propuesta | RN-08 |
| Q-13 | Si desactivás una categoría que tiene presupuesto, ¿se sigue avisando? | Evita alertas de algo que ya no usás. | El límite se conserva, pero no se muestra ni alerta mientras la categoría esté inactiva. | Propuesta | RN-09 |

## Historial de cambios

- [cambio] 2026-10-30 — Versión 0.1: Q-01 a Q-11 redactadas.
- [cambio] 2026-10-30 — Versión 0.2: agregadas Q-12 y Q-13 al revisar la spec; todas respondidas como propuesta.
