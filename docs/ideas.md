# Ideas — GastoClaro

> Versión 0.1 · Estado: Borrador · Última actualización: 2026-10-30

Este documento recoge lo que el cliente necesita (o creemos que necesita). **No es un contrato**: el contrato es `spec.md`. Acá se piensa en voz alta.

## 1. Problema

Una persona anota sus gastos en el celular, en papeles o de memoria. A fin de mes no sabe en qué se le fue la plata, si gastó más de lo que cobró, ni en qué categoría se está pasando.

## 2. Qué dijo el cliente (resumen)

- Quiere registrar lo que gasta y lo que cobra.
- Quiere ver cuánto le quedó en el mes.
- Quiere saber en qué rubros gasta más.
- Quiere que el sistema le avise si se está pasando en algún rubro.
- Quiere algo simple, en una página web, que no le haga perder tiempo.

## 3. Qué creemos que necesita (no lo dijo, lo inferimos)

- Categorías ya cargadas para no arrancar de cero, pero poder crear las propias.
- Poder corregir o borrar un movimiento mal cargado.
- Ver la información por mes, con el mes actual por defecto.
- Montos con formato argentino ($ 1.234,56) y fechas DD/MM/AAAA.
- Que el sistema no deje cargar datos absurdos (montos negativos, fechas futuras, categorías que no corresponden).
- Que los números cierren: lo que muestra el balance debe coincidir con la suma de los movimientos.

## 4. Qué podría inventar la IA si no se lo decimos

Si se le pide "hacé una app de gastos personales" sin más, la IA suele agregar cosas que nadie pidió o resolver a su gusto lo que no se aclaró. Se listan para decidir cada una explícitamente.

| La IA podría inventar… | Riesgo | Decisión (ver `decisiones.md`) |
|---|---|---|
| Registro de usuarios y login con contraseñas | Complejidad de seguridad innecesaria | Fuera de alcance: un solo usuario, sin login (D-01) |
| Múltiples monedas y conversión | Reglas de cambio que nadie definió | Solo pesos argentinos (D-02) |
| Montos con decimales flotantes | Errores de redondeo (0,1 + 0,2) | Se guardan centavos enteros (D-03) |
| Gastos a futuro o "programados" | Rompe el balance del mes | No se permiten fechas futuras (D-05) |
| Cuentas bancarias, tarjetas y transferencias | Duplica el modelo de datos | Fuera de alcance (Q-01, Q-04) |
| Gastos recurrentes automáticos | Procesos en segundo plano | Fuera de alcance (Q-02) |
| Cuotas de tarjeta | Reglas de vencimiento y recargos | Fuera de alcance (Q-03) |
| Gráficos y dashboards complejos | Dependencias y tiempo | Solo tablas y barras de progreso en CSS (Q-08) |
| Exportar a Excel/PDF | Formatos y encoding | Fuera de alcance (D-16) |
| Notificaciones por email o push | Servicios externos | Solo alertas en pantalla (D-15) |
| Borrado lógico con papelera | Estados extra en cada tabla | Borrado definitivo con confirmación (D-11) |
| Borrar categorías con movimientos en cascada | Pérdida silenciosa de datos | Solo se pueden desactivar (D-10) |

## 5. Usuario

Una única persona usuaria final, sin conocimientos técnicos, que usa el sistema desde una computadora o desde el celular en la misma red.

## 6. Cómo sabemos que funciona

- Cargar un gasto toma menos de 30 segundos.
- El balance del mes coincide siempre con la suma de ingresos menos gastos.
- Ningún dato inválido llega a la base de datos.
- La persona se entera cuando una categoría llega al 80 % de su límite.

## Historial de cambios

- [cambio] 2026-10-30 — Versión inicial del documento.
