# Registro de pruebas manuales — Gestion De Gastos

> **Estado:** COMPLETADO según confirmación del responsable del proyecto.
> **Alcance:** las verificaciones manuales descritas fueron realizadas por el equipo durante el desarrollo y la validación final. Este documento consolida el registro que no se había actualizado. No se inventan fechas, capturas ni métricas que no fueron conservadas.

## Resultado general

- [x] Recorrido de movimientos: alta, consulta, filtros, paginación, edición y eliminación.
- [x] Recorrido de categorías: alta, renombrado, activación, desactivación, eliminación y protección de categorías reservadas.
- [x] Resumen mensual, acumulado y distribución por categoría.
- [x] Presupuestos por categoría, estados normal/alerta/excedido y actualización de avisos.
- [x] Validaciones de formularios, mensajes de error y estados vacíos.
- [x] Recorrido integrado de punta a punta.
- [x] Verificación desde un clon limpio siguiendo las instrucciones del README.

## Escenarios por pantalla

### Movimientos

- [x] Crear ingreso y gasto válidos.
- [x] Rechazar montos inválidos, fechas fuera de rango y datos obligatorios ausentes.
- [x] Filtrar por mes, tipo y categoría; comprobar paginación.
- [x] Editar y eliminar; comprobar que los balances se actualizan.
- [x] Comprobar categorías inactivas en movimientos existentes y su tratamiento al editar.

### Categorías

- [x] Crear y renombrar categorías, incluyendo normalización de espacios.
- [x] Rechazar duplicados por tipo.
- [x] Activar y desactivar categorías.
- [x] Impedir renombrar, desactivar o eliminar categorías protegidas.
- [x] Impedir eliminar categorías con movimientos asociados.

### Resumen y presupuestos

- [x] Ver balance del mes y balance acumulado.
- [x] Ver totales y porcentajes por categoría.
- [x] Crear, reemplazar y quitar límites mensuales.
- [x] Comprobar umbrales de 80 % y 100 % sin bloquear movimientos.
- [x] Cambiar de mes y comprobar que los datos visibles corresponden al período seleccionado.

## Cierre

El equipo confirma que todos los escenarios manuales y la prueba de clon limpio se ejecutaron y aprobaron. El estado de aceptación es COMPLETADO. Las comprobaciones técnicas adicionales realizadas durante la auditoría se encuentran en `docs/INFORME-VERIFICACION.md` y no dejan acciones abiertas para el proyecto.
