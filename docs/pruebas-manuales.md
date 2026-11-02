# Pruebas manuales — Gestion-De-Gastos

> Última actualización: 2026-11-02

Listas de comprobación de las tareas de interfaz (T-16 a T-21). Las completa el tester al cerrar cada tarea.
En la columna **Resultado**, marcá `[x]` si el ítem salió como se esperaba. Si falla, dejalo en `[ ]` y anotá el detalle debajo de la tabla.

**Preparación:** desde `backend/`, ejecutar `npm run dev` y abrir `http://localhost:3000` en el navegador.

## T-16 — Esqueleto del frontend

Fecha de la prueba: ____________  Navegador: ____________

| # | Qué se hace | Resultado esperado | Resultado |
|---|---|---|---|
| 1 | Abrir `http://localhost:3000`. | Se ve el título "Gestión de Gastos" y cuatro enlaces: Movimientos, Resumen, Categorías y Presupuestos. "Movimientos" está resaltado (fondo blanco y negrita) y se ve su pantalla. | [ ] |
| 2 | Hacer clic en "Resumen". | Cambia el contenido a "Resumen", la URL termina en `#resumen` y la página no se recarga (no parpadea y en la pestaña Red de DevTools no aparece un pedido nuevo del documento). | [ ] |
| 3 | Repetir con Categorías, Presupuestos y Movimientos. | En cada caso se ve solo esa pantalla, el enlace activo cambia y el título de la pestaña cambia (ej. "Categorías · Gestión de Gastos"). | [ ] |
| 4 | Usar el botón "Atrás" del navegador. | Vuelve a la pantalla anterior. | [ ] |
| 5 | Abrir `http://localhost:3000/#cualquiera`. | Se muestra la pantalla de Movimientos. | [ ] |
| 6 | Navegar solo con el teclado (Tab y Enter). | Cada enlace muestra un contorno visible al recibir el foco y Enter cambia de pantalla. | [ ] |
| 7 | En DevTools (Ctrl+Shift+M), poner el ancho en 375 px y recorrer las cuatro pantallas. | No aparece barra de desplazamiento horizontal en ninguna, y los enlaces se acomodan en más de una fila si hace falta. | [ ] |
| 8 | Poner el ancho en 1280 px. | El contenido queda centrado con ancho máximo y el título y los enlaces comparten una fila. | [ ] |
| 9 | Abrir `http://localhost:3000/api/health`. | Muestra `{"estado":"ok"}` (la API sigue funcionando). | [ ] |