# Trazabilidad — Gestion-De-Gastos

> Última actualización: 2026-11-09

Relaciona cada historia, regla de negocio y caso borde de [`spec.md`](spec.md) con las pruebas que los mencionan y verifican. Los ids `T-xx.n` son los de los tests automáticos (`backend/test` y `frontend/test`); los ítems manuales son los de [`pruebas-manuales.md`](pruebas-manuales.md) (`T-xx #n`).

**Resultado automático registrado:** 172/172 pruebas de backend y 93/93 de frontend aprobadas. La prueba `T-22.7` verifica que cada RN y cada CB esté nombrado en algún test o ítem manual. Esa prueba no lee este archivo: la relación que sigue es la matriz de cobertura documentada.

**Importante:** la matriz indica qué casos deben revisarse; no significa que las pruebas manuales estén aprobadas. Su ejecución está pendiente y debe registrarse en `pruebas-manuales.md`.

## Historias de usuario

| HU | Tareas |
|---|---|
| HU-01 Registrar un movimiento | T-08, T-17 |
| HU-02 Ver y filtrar movimientos | T-11, T-18 |
| HU-03 Editar un movimiento | T-09, T-17 |
| HU-04 Eliminar un movimiento | T-10, T-18 |
| HU-05 Ver el balance | T-12, T-20 |
| HU-06 Ver el resumen por categoría | T-13, T-20 |
| HU-07 Administrar categorías | T-05, T-06, T-07, T-19 |
| HU-08 Definir límites de presupuesto | T-14, T-21 |
| HU-09 Recibir alertas de presupuesto | T-15, T-21 |

## Reglas de negocio

| RN | Pruebas automáticas | Ítems manuales |
|---|---|---|
| RN-01 | T-02 (CHECK), T-05.8, T-08.11, T-08.13, T-17.6 | T-17 #1 |
| RN-02 | T-02.6, T-03.1–03.7, T-08.3–08.4, T-14.4–14.5, T-16.1–16.3, T-17.1 y 17.1b | T-17 #4; T-21 #7 |
| RN-03 | T-04.1–04.6, T-08.5–08.7, T-17.2 y 17.2b, T-17.11 | T-17 #4 |
| RN-04 | T-08.8–08.9, T-08.14, T-09.2–09.5, T-17.12–17.13 | T-17 #1–2 |
| RN-05 | T-08.2, T-08.10, T-08.15–08.16, T-09.12, T-17.4–17.5, T-17.10 | T-17 #5–6 |
| RN-06 | T-02.5, T-05.3–05.8, T-06.1–06.3, T-06.9–06.11, T-19.1–19.5 | T-19 #1–3, #8–9 |
| RN-07 | T-02.2–02.3, T-06.5–06.6, T-06.12, T-07.3, T-07.8, T-19.7 | T-19 #4 |
| RN-08 | T-07.1–07.10 | T-19 #6–7 |
| RN-09 | T-06.4, T-08.9, T-09.4–09.5, T-10.7, T-11.9, T-12.8, T-13.5, T-14.6, T-14.12, T-14.15, T-15.7, T-17.12–17.13, T-18.5, T-18.11 | T-17 #2; T-19 #5; T-21 #6 |
| RN-10 | T-09.1–09.14, T-10.1–10.7, T-22.1 | T-17 #3–4; T-18 #5–6 |
| RN-11 | T-11.1–11.15, T-18.1–18.12 | T-18 #1–3 |
| RN-12 | T-12.1–12.11, T-20.4–20.6, T-22.1 | T-20 #1–2, #4 |
| RN-13 | T-13.1–13.11, T-20.1, T-20.3 | T-20 #3–4 |
| RN-14 | T-16.1–16.5, T-17.1, T-18.10, T-20.1 | T-20 #1 |
| RN-15 | T-14.1–14.15, T-15.17, T-21.4–21.5, T-22.1 | T-21 #5–6 |
| RN-16 | T-15.1–15.18, T-21.3, T-21.6, T-22.1 | T-21 #1–5 |
| RN-17 | T-04.7, T-11.8, T-11.15, T-12.7, T-12.10, T-15.11, T-15.16, T-22.5 | T-18 #1; T-20 #4 |

## Casos borde

| CB | Pruebas automáticas | Ítems manuales |
|---|---|---|
| CB-01 | T-03.3, T-08.3, T-17.1b | T-17 #4 |
| CB-02 | T-03.2, T-08.4, T-17.1b | — |
| CB-03 | T-03.2, T-08.4, T-16.2b, T-17.1b | — |
| CB-04 | T-03.3, T-08.4, T-17.1b | T-17 #4 |
| CB-05 | T-16.3, T-17.1 (la interfaz lo rechaza; la API nunca lo recibe) | T-17 #4 |
| CB-06 | T-08.5, T-17.2 | T-17 #4 |
| CB-07 | T-08.5, T-17.2 | T-17 #4 |
| CB-08 | T-04.4, T-08.6, T-17.2b | — |
| CB-09 | T-04.4, T-08.6, T-17.2b | — |
| CB-10 | T-04.3, T-08.6, T-17.2b | — |
| CB-11 | T-04.1, T-08.7, T-17.11 | — |
| CB-12 | T-11.10, T-12.6, T-15.13 | T-18 #1; T-20 #1 |
| CB-13 | T-08.10, T-17.4 | T-17 #6 |
| CB-14 | T-05.5 | T-19 #2 |
| CB-15 | T-05.6, T-06.11 | T-19 #3 |
| CB-16 | T-05.7, T-19.3 | T-19 #8 |
| CB-17 | T-07.4 | T-19 #6 |
| CB-18 | T-09.4–09.5 | T-17 #2 |
| CB-19 | T-15.2–15.3 | T-21 #2 |
| CB-20 | T-15.4, T-21.3b, T-21.6d | T-21 #3 |
| CB-21 | T-11.5, T-12.4, T-13.4, T-20.6, T-22.5 | T-18 #4; T-20 #4 |
| CB-22 | T-04.7, T-11.8, T-12.7, T-15.11, T-22.5 | — |
| CB-23 | T-12.5, T-15.11, T-20.6 | T-20 #4 |
| CB-24 | T-11.2 | T-18 #2 |
| CB-25 | T-10.6, T-22.3 | T-17 #3; T-18 #5–6 |
| CB-26 | T-20.3b, T-22.4, T-22.6 | T-17 #5 |

## Defectos y limitaciones conocidos

### Defectos

| ID | Gravedad | Descripción | Qué hacer |
|---|---|---|---|
| DEF-01 | Baja | **El largo del nombre de una categoría y el de una descripción se miden distinto.** La spec dice "caracteres" en RN-05 (descripción, hasta 140) y en RN-06 (nombre, hasta 30). La descripción se mide en caracteres reales (`Array.from`), pero el nombre de la categoría, en el servidor (`revisarNombre`) y en el formulario (`validarNombre`), se mide con `.length`, que cuenta cada emoji como 2 unidades UTF-16. Un nombre de 16 emojis se rechaza aunque contiene 16 caracteres Unicode. Con letras y tildes comunes no ocurre. El test T-19.5 documenta el comportamiento actual. | Resolver en una tarea posterior: corregir la medición para contar caracteres Unicode de manera consistente, con pruebas de backend y frontend; o modificar RN-06 mediante una decisión explícita para definir la unidad de medida. |

### Limitaciones (decididas, no son defectos)

| ID | Descripción | Origen |
|---|---|---|
| LIM-01 | Un solo usuario, sin login: quien llegue a la dirección ve y modifica todo. | D-01 |
| LIM-02 | Dos pedidos iguales a la vez crean dos movimientos; en edición, la última escritura gana. La interfaz solo evita el doble clic. | D-20, CB-25 |
| LIM-03 | El aviso de presupuestos se actualiza con lo que se hace desde la aplicación; un cambio hecho por fuera (otra pestaña, la consola) se refleja al navegar. | plan §1 |
| LIM-04 | El servidor entrega todo `frontend/`, incluidos `package.json` y `test/`. Sin riesgo en uso local; habría que separarlos para publicarlo. | T-16 |
| LIM-05 | No hay exportación ni copias de seguridad desde el sistema: se copia el archivo de la base a mano. | D-16, Q-09 |

## Historial de cambios

- [cambio] 2026-11-09 — Se actualizó la matriz para que las referencias manuales coincidan con las listas T-16 a T-21 incorporadas en `pruebas-manuales.md`. Se registraron los resultados automáticos de 172 pruebas de backend y 93 de frontend. Se aclaró que la matriz no implica aprobación manual.
