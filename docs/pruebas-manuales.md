# Pruebas manuales — Gestion-De-Gastos

> Última actualización: 2026-11-09

Listas de comprobación de las tareas de interfaz (T-16 a T-21) y de cierre (T-22). Las completa el tester al ejecutar cada escenario.
En la columna **Resultado**, marcá `[x]` solo si el ítem se ejecutó y salió como se esperaba. Si falla, dejalo en `[ ]` y anotá el detalle debajo de la tabla.

**Estado de esta versión:** las listas están preparadas, pero sus resultados todavía no están registrados. Los tests automáticos no reemplazan estas verificaciones en navegador.

**Preparación:** desde `backend/`, ejecutar `npm run dev` y abrir `http://localhost:3000` en el navegador. Para probar flujos con datos, usar una base de prueba limpia o anotar los datos previos y limpiar al terminar.

## T-16 — Esqueleto del frontend y navegación

Fecha de la prueba: ____________  Navegador y versión: ____________

| # | Qué se hace | Resultado esperado | Resultado |
|---|---|---|---|
| 1 | Abrir `http://localhost:3000`. | Se ve el título "Gestión de Gastos" y cuatro enlaces: Movimientos, Resumen, Categorías y Presupuestos. Movimientos está activo y se ve su pantalla. | [ ] |
| 2 | Hacer clic en "Resumen". | Se ve la pantalla de Resumen, la URL termina en `#resumen` y no se recarga el documento. | [ ] |
| 3 | Hacer clic en "Categorías". | Se ve la pantalla de Categorías; no queda el contenido en blanco ni se muestra otra vista. | [ ] |
| 4 | Hacer clic en "Presupuestos". | Se ve la pantalla de Presupuestos; no queda el contenido en blanco ni se muestra otra vista. | [ ] |
| 5 | Volver a "Movimientos" y repetir la navegación entre las cuatro opciones. | En cada caso se ve una sola vista, el enlace activo cambia y el título de la pestaña acompaña a la vista. | [ ] |
| 6 | Usar los botones "Atrás" y "Adelante" del navegador después de cambiar de vista. | La vista y el fragmento de URL vuelven a coincidir con el historial de navegación. | [ ] |
| 7 | Abrir `http://localhost:3000/#cualquiera`. | Se muestra Movimientos como vista predeterminada; la página no queda en blanco. | [ ] |
| 8 | Navegar solo con teclado (Tab y Enter). | Cada enlace recibe un contorno visible al tener foco y Enter cambia de vista. | [ ] |
| 9 | En DevTools, usar anchos de 375 px y 1280 px y recorrer las cuatro vistas. | A 375 px no hay desplazamiento horizontal; a 1280 px el contenido queda centrado y ordenado. | [ ] |
| 10 | Abrir `http://localhost:3000/api/health`. | La API responde `{"estado":"ok"}`. | [ ] |

## T-17 — Formulario de alta y edición de movimientos

Fecha de la prueba: ____________  Navegador y versión: ____________

| # | Qué se hace | Resultado esperado | Resultado |
|---|---|---|---|
| 1 | En un movimiento nuevo, elegir "Gasto" y después "Ingreso". | Para Gasto solo aparecen categorías de gasto activas; para Ingreso solo categorías de ingreso activas. Al cambiar el tipo se limpia la categoría seleccionada. | [ ] |
| 2 | Editar un movimiento cuya categoría quedó desactivada. | La categoría actual se conserva como opción para ese movimiento; no se ofrecen otras categorías inactivas. | [ ] |
| 3 | Guardar un movimiento y hacer doble clic en Guardar mientras se procesa. | El botón se deshabilita durante el pedido y vuelve a habilitarse al terminar; la interfaz evita el doble envío normal. | [ ] |
| 4 | Provocar un error de validación del servidor, por ejemplo enviar una fecha futura o un monto inválido mediante el formulario. | El mensaje en español aparece junto al campo correspondiente y los datos no se guardan. | [ ] |
| 5 | Guardar una descripción con el texto literal `<b>hola</b>` y verla en el listado o en la edición. | Se muestra exactamente como texto, sin convertirse en negrita ni interpretarse como HTML. | [ ] |
| 6 | Guardar una descripción de 140 caracteres y luego intentar guardar otra de 141. | La de 140 se acepta y la de 141 se rechaza con un error en el campo descripción. | [ ] |

## T-18 — Listado de movimientos, filtros y eliminación

Fecha de la prueba: ____________  Navegador y versión: ____________

| # | Qué se hace | Resultado esperado | Resultado |
|---|---|---|---|
| 1 | Abrir Movimientos con el mes actual y cargar movimientos de más de un mes. | El selector inicia en el mes actual y la lista muestra solo los movimientos de ese mes. | [ ] |
| 2 | Preparar 25 movimientos en un mismo mes. | La página 1 muestra 20 y la página 2 muestra 5; el total informado es 25. | [ ] |
| 3 | Combinar filtros de mes, tipo y categoría. | Solo aparecen movimientos que cumplen simultáneamente los filtros elegidos. | [ ] |
| 4 | Seleccionar un mes sin movimientos. | Aparece el mensaje "No hay movimientos en este mes" y no se presenta como un error. | [ ] |
| 5 | Elegir "Eliminar" y luego "Cancelar" en la confirmación. | El movimiento sigue existiendo y permanece en la lista. | [ ] |
| 6 | Elegir "Eliminar" y luego confirmar. | El movimiento desaparece y la lista y la paginación se actualizan correctamente. | [ ] |
| 7 | Comparar un ingreso y un gasto en la lista. | Se distinguen mediante texto o signo, no únicamente por color. | [ ] |

## T-19 — Pantalla de categorías

Fecha de la prueba: ____________  Navegador y versión: ____________

| # | Qué se hace | Resultado esperado | Resultado |
|---|---|---|---|
| 1 | Crear la categoría "Mascotas" de tipo Gasto. | Se crea y aparece en el grupo de categorías de gasto. | [ ] |
| 2 | Intentar crear "alimentacion" de tipo Gasto cuando existe "Alimentación". | Se informa que el nombre está duplicado, el mensaje queda junto al campo y no se crea otra categoría. | [ ] |
| 3 | Crear "Regalos" una vez como Gasto y otra como Ingreso. | Se permiten ambas categorías porque pertenecen a tipos distintos. | [ ] |
| 4 | Revisar las acciones disponibles para "Otros gastos" y "Otros ingresos". | Las categorías protegidas no muestran acciones para renombrar, desactivar ni eliminar. | [ ] |
| 5 | Desactivar "Ocio", revisar el selector de un movimiento nuevo y volver a activarla. | Inactiva, no se ofrece para movimientos nuevos; al reactivarla vuelve a aparecer. | [ ] |
| 6 | Eliminar "Salud" sin movimientos asociados y confirmar. | La categoría desaparece de la lista. | [ ] |
| 7 | Intentar eliminar "Alimentación" cuando tiene movimientos asociados. | La eliminación se rechaza, la categoría se conserva y el mensaje sugiere desactivarla. | [ ] |
| 8 | Crear una categoría con nombre de 30 caracteres y luego intentar otra de 31. | La de 30 se acepta y la de 31 se rechaza con un error de validación. | [ ] |
| 9 | Probar nombres con espacios al inicio/final y espacios repetidos en el medio. | Se guardan sin espacios sobrantes y los espacios repetidos se reducen a uno. | [ ] |

## T-20 — Pantalla de resumen

Fecha de la prueba: ____________  Navegador y versión: ____________

| # | Qué se hace | Resultado esperado | Resultado |
|---|---|---|---|
| 1 | Preparar para octubre de 2026 ingresos por $ 500.000,00 y gastos por $ 120.000,50. | Se muestran ingresos $ 500.000,00, gastos $ 120.000,50, balance del mes $ 379.999,50 y, agregando $ 100.000,00 de septiembre, balance acumulado $ 479.999,50. | [ ] |
| 2 | Consultar un mes cuyo total de gastos supere los ingresos. | El balance se muestra con signo menos y con una etiqueta como "Déficit"; no depende solo del color. | [ ] |
| 3 | Preparar gastos de Alimentación por $ 30.000,00 y Transporte por $ 10.000,00 en el mismo mes. | Se muestran Alimentación con 75,0 % y Transporte con 25,0 %, en ese orden. | [ ] |
| 4 | Consultar un mes sin movimientos. | Los importes se muestran en $ 0,00 y las tablas muestran "Sin movimientos". | [ ] |
| 5 | Cambiar el mes seleccionado. | Se actualizan las tarjetas y las tablas sin recargar el documento. | [ ] |

## T-21 — Pantalla de presupuestos y aviso de alertas

Fecha de la prueba: ____________  Navegador y versión: ____________

Usar como referencia un límite de Alimentación de $ 100.000,00.

| # | Qué se hace | Resultado esperado | Resultado |
|---|---|---|---|
| 1 | Consultar el presupuesto con $ 79.999,99 gastados. | La fila dice "Normal" y no aparece un aviso de alerta. | [ ] |
| 2 | Consultar el presupuesto con $ 80.000,00 gastados y recorrer las cuatro vistas. | La fila dice "Alerta" y el aviso nombra Alimentación en todas las pantallas. | [ ] |
| 3 | Consultar el presupuesto con $ 100.000,01 gastados. | La fila y el aviso dicen "Excedido" aunque el porcentaje mostrado sea 100,0 %; el texto deja claro el estado. | [ ] |
| 4 | Consultar un presupuesto cuyo consumo supera el 100 %. | La barra no supera el ancho de su contenedor y el texto conserva el porcentaje real. | [ ] |
| 5 | Definir un límite nuevo, reemplazarlo y quitarlo. | El nuevo límite aparece, el segundo reemplaza al primero y al quitarlo deja de mostrarse. | [ ] |
| 6 | Revisar las opciones para definir un límite. | Solo se ofrecen categorías de gasto activas; las categorías de ingreso e inactivas no se ofrecen. | [ ] |
| 7 | Intentar guardar un límite `0` y otro con formato inválido `12,345`. | Ambos se rechazan con un mensaje junto al campo y no se guarda el límite. | [ ] |

## T-22 — Prueba de punta a punta y cierre

Fecha de la prueba: ____________  Navegador y versión: ____________

**Preparación:** esta prueba parte de un clon limpio del repositorio, sin la base de datos ni `node_modules` de la carpeta de trabajo. Desde la carpeta que contiene a `Gestion-De-Gastos`:

```bash
git clone Gestion-De-Gastos Gestion-De-Gastos-limpio
cd Gestion-De-Gastos-limpio
```

Todo lo que sigue se hace en `Gestion-De-Gastos-limpio`, siguiendo el `README.md`.

### Instalación y arranque (README)

| # | Qué se hace | Resultado esperado | Resultado |
|---|---|---|---|
| 1 | En `Gestion-De-Gastos-limpio/backend`: copiar `.env.example` a `.env`, ejecutar `npm install` y `npm run dev`. | La instalación termina sin errores, el servidor informa que escucha en `http://localhost:3000` y se crea `backend/data/gastos.db`. | [ ] |
| 2 | Abrir `http://localhost:3000/api/health`. | Muestra `{"estado":"ok"}`. | [ ] |
| 3 | Abrir `http://localhost:3000`. | Se ve la aplicación con las cuatro secciones; los enlaces Resumen, Categorías y Presupuestos no dejan la pantalla en blanco. | [ ] |
| 4 | Desde `backend/`, ejecutar `npm test`; desde `frontend/`, ejecutar `npm test`. | Ambos comandos terminan sin fallas: 172 pruebas en backend y 93 en frontend. | [ ] |
| 5 | Ejecutar `git status` en el clon. | No aparecen `.env`, `node_modules` ni `backend/data/gastos.db` como archivos versionados o sin seguimiento. | [ ] |

### Escenario de punta a punta

Con la base nueva, usá una misma fecha válida para los movimientos y consultá ese mes.

| # | Qué se hace | Resultado esperado | Resultado |
|---|---|---|---|
| 6 | En `#categorias`, crear "Mascotas" (Gasto). Luego, en `#movimientos`, cargar un ingreso "Sueldo" de $ 500.000,00 y un gasto "Alimentación" de $ 80.000,00. | Los dos se guardan. En el selector de categorías de gasto aparece "Mascotas". | [ ] |
| 7 | Abrir `#resumen` para el mes de los movimientos. | Ingresos $ 500.000,00, gastos $ 80.000,00, balance del mes y balance acumulado $ 420.000,00, ambos con "Superávit". No hay aviso de presupuesto. | [ ] |
| 8 | En `#presupuestos`, definir $ 100.000,00 para Alimentación. | La fila dice "Alerta", muestra 80,0 % y la barra está al 80 %. Aparece, sin recargar, el aviso de presupuesto con Alimentación. | [ ] |
| 9 | Recorrer Movimientos, Resumen, Categorías y Presupuestos. | El aviso se ve en las cuatro pantallas. | [ ] |
| 10 | En el listado, editar el gasto a $ 100.000,01. | La fila de Presupuestos dice "Excedido" y 100,0 %; el aviso también informa el estado Excedido. | [ ] |
| 11 | Eliminar ese gasto con confirmación. | El aviso desaparece. En Resumen, el balance del mes y el acumulado vuelven a $ 500.000,00. | [ ] |
| 12 | Cargar un gasto de $ 10.000,00 en Alimentación y desactivar la categoría. | Ya no se ofrece en el alta; el movimiento sigue en el listado y en el resumen; el presupuesto deja de aparecer mientras la categoría está inactiva. | [ ] |
| 13 | Reactivar Alimentación. | Vuelve a ofrecerse y reaparece su límite de $ 100.000,00, con 10,0 % y estado Normal. | [ ] |
| 14 | Apagar el servidor, volver a arrancarlo con `npm run dev` y recargar la página. | Siguen la categoría Mascotas, los movimientos y el límite de Alimentación. | [ ] |

### Revisión final de la interfaz y de los textos

| # | Qué se hace | Resultado esperado | Resultado |
|---|---|---|---|
| 15 | Provocar errores de monto, fecha futura, categoría duplicada, límite inválido y servidor apagado. | Los mensajes están en español claro, son comprensibles y aparecen junto al campo o como aviso general cuando corresponde. | [ ] |
| 16 | Recorrer las cuatro pantallas con ancho de 375 px. | No hay desplazamiento horizontal; el contenido se lee y los botones se pueden usar. | [ ] |
| 17 | Recorrer las cuatro pantallas con ancho de 1280 px. | Todas se ven ordenadas y las cifras no se cortan. | [ ] |
| 18 | Recorrer la aplicación solo con teclado (Tab, Enter y Esc). | Las operaciones principales se pueden realizar y siempre hay un contorno de foco visible. | [ ] |
| 19 | Verificar que todas las listas manuales T-16 a T-21 de este archivo fueron ejecutadas y tienen resultado registrado. | No queda ningún ítem sin ejecutar; los fallos tienen su detalle anotado debajo de la tabla correspondiente. | [ ] |

## Registro de incidencias

Anotá acá la fecha, el caso, el navegador, los pasos para reproducirlo y el resultado observado. No marques un ítem como aprobado hasta volver a ejecutarlo después de corregirlo.

| Fecha | Caso | Resultado observado / incidencia | Corrección y revalidación |
|---|---|---|---|

## Historial de cambios

- [cambio] 2026-11-09 — Se completaron las listas manuales T-17 a T-21 que faltaban y se actualizó el cierre T-22. Se corrigió el total esperado de pruebas automáticas a 172 en backend y 93 en frontend. Los resultados quedan sin marcar hasta ejecutar las verificaciones en navegador.
