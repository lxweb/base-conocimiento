# Base de conocimiento — diseño

Fecha: 2026-09-28

Herramienta personal para registrar conocimientos y validarlos. El repositorio público contiene solo el código. El conocimiento vive en el servidor de quien lo usa.

## Propósito

Registrar conocimientos ordenados y comprobar, con una cola diaria, si siguen disponibles sin mirar la fuente.

La validación combina tres técnicas:

- Repetición espaciada: el plazo entre repasos crece después de cada acierto pleno.
- Práctica de recuperación: la cola muestra la pregunta sola. La explicación aparece después de responder.
- Variación: el tipo de pregunta sube con el nivel del tema, y dentro del mismo tipo rota la pregunta usada.

## Repositorio y datos

El código va a un repositorio público. Ahí no entra conocimiento, medios, volcados de base, sesiones ni archivos `.env`.

La fuente de verdad es un servidor propio. PostgreSQL guarda el contenido y el calendario. Las imágenes y los videos van a un volumen de Docker. El escritorio guarda en SQLite el token, la sesión del día y las respuestas que el servidor todavía no confirmó. Los medios de esa sesión van a archivos locales.

## Alcance de la versión 1

Entran:

- API y PostgreSQL en Docker Compose.
- App de escritorio con Electron para Linux, Windows y macOS.
- Alta y orden de materias, ramas, temas y conocimientos.
- Preguntas escritas por la persona usuaria.
- Relaciones, archivo y restauración.
- Cola diaria, puntaje, niveles y sincronización.

Quedan para una versión posterior:

- Cliente Android con React Native. La API de esta versión es el contrato que va a usar.
- Un agente que lea el conocimiento y genere preguntas.

## Modelo de contenido

La jerarquía es Materia → Rama → Tema → Conocimiento. En cada nivel el orden es manual. Reordenar hermanos reemplaza sus posiciones por 1, 2, 3… según el orden enviado.

### Tema

Además del nombre, la rama y la posición, un tema tiene:

- Prioridad: `normal`, `alta` o `maxima`.
- Puntos: entero, mínimo 0.

La prioridad define el orden de la cola y acorta el plazo del próximo repaso. Los puntos definen el tipo de pregunta de todo el tema.

### Conocimiento

Campos:

- Título y explicación, obligatorios.
- Ejemplo y link, opcionales.
- Posición dentro del tema.
- Fecha de archivo, vacía si está activo.
- Calendario: aciertos plenos consecutivos, intervalo base en días y fecha de vencimiento. Al crearlo quedan en 0, 0 y vacía. Una fecha vacía significa que ya está vencido.

Las imágenes y los videos son medios aparte, opcionales, ligados al conocimiento. Un link se guarda como URL, no como archivo.

Un conocimiento sin ninguna pregunta no entra en la cola.

### Preguntas

Las escribe la persona usuaria. Hay tres tipos.

**Verdadero o falso.** El enunciado es la afirmación. Hay un valor correcto, verdadero o falso.

**Opción múltiple.** Cada opción es `falsa`, `verdadera` o `completa`. Hay exactamente una opción `completa`. Puede haber varias falsas y varias verdaderas.

**Respuesta escrita.** Guarda la respuesta esperada. En el repaso, la persona escribe sin verla. Después ve la respuesta esperada y marca si su texto equivale.

### Relaciones

Una relación une dos conocimientos distintos y tiene un tipo fijo: `prerrequisito`, `profundiza`, `ejemplo` o `contradice`.

Es dirigida. Que A sea prerrequisito de B no crea la relación inversa. Cada par ordenado admite una sola relación. El tipo se puede cambiar. Archivar un conocimiento no borra sus relaciones.

### Archivo

Archivar saca el conocimiento de las colas futuras, lo deja visible en el tema como archivado y conserva sus relaciones. Restaurar lo vuelve a hacer elegible según su calendario, que no se modifica al archivar ni al restaurar.

La versión 1 no elimina filas de conocimientos, temas, ramas ni materias.

## Validación

### Puntos y nivel

El puntaje pertenece al tema. Todas sus preguntas comparten el nivel.

| Resultado | Puntos del tema | Calendario del conocimiento |
| --- | --- | --- |
| Acierto pleno | +1 | Avanza el intervalo |
| Parcial | 0 | El intervalo y el vencimiento quedan igual |
| Error | −1 | Vuelve a un intervalo base de 1 día y los aciertos plenos consecutivos pasan a 0 |

Si el tema está en 0 y la respuesta es un error, el puntaje sigue en 0 y el calendario sí se reinicia.

Cómo se clasifica cada respuesta:

- Verdadero o falso correcto, opción `completa`, o respuesta escrita marcada como equivalente: acierto pleno.
- Opción `verdadera`: parcial.
- Verdadero o falso incorrecto, opción `falsa`, o respuesta escrita marcada como no equivalente: error.

El servidor calcula el resultado. El escritorio envía la elección, no los puntos ni el próximo intervalo. En la respuesta escrita, la marca de equivalencia es el juicio de la persona: el servidor la acepta porque en esta versión no hay corrección automática de texto libre.

Umbrales del tema:

| Puntos | Tipo pedido |
| --- | --- |
| 0–7 | Verdadero o falso |
| 8–23 | Opción múltiple |
| 24 o más | Respuesta escrita |

Si el conocimiento no tiene una pregunta del tipo pedido, se usa el tipo más avanzado que sí tenga, aunque supere el nivel del tema. Entre las preguntas de ese tipo se elige la que lleve más tiempo sin salir. Una pregunta nunca usada sale antes que una ya usada.

Los puntos de una respuesta confirmada cambian el nivel para las colas de los días siguientes. La sesión ya emitida conserva los tipos con los que se armó.

### Intervalos

El intervalo base se guarda sin aplicar la prioridad. La prioridad se aplica al confirmar un acierto pleno o un error, con la prioridad que el tema tenga en ese momento. Un cambio de prioridad no mueve vencimientos ya guardados.

Tras un acierto pleno, el intervalo base queda así:

| Aciertos plenos consecutivos | Intervalo base |
| --- | --- |
| 1 | 1 día |
| 2 | 3 días |
| 3 | 7 días |
| 4 o más | el intervalo base anterior × 2,5, redondeado. Fracción de 0,5 o más sube |

Ejemplos a partir de 7: 18, 45, 113.

El plazo efectivo es `max(1, redondeo(intervalo base × factor))`.

| Prioridad | Factor |
| --- | --- |
| normal | 1 |
| alta | 0,75 |
| maxima | 0,5 |

La fecha de vencimiento es la fecha local de la sesión más el plazo efectivo. Si la respuesta se sincroniza días después, el plazo se cuenta desde el día de la sesión, no desde el día de la sincronización.

Un parcial no modifica aciertos plenos, intervalo base ni vencimiento.

Un conocimiento nuevo es el que todavía no tiene ningún acierto pleno. Si la sesión de hoy todavía no existe, puede entrar al armarla. Si la sesión de hoy ya se guardó, entra como muy pronto mañana. Después de un error, espera a la fecha de vencimiento nueva. Después de un parcial, conserva la fecha que ya tenía: si estaba vacía, sigue vencido.

### Cola del día

La cola tiene 20 lugares. Hasta 5 son para conocimientos nuevos. Esos lugares no se completan con más conocimientos nuevos si sobran huecos. El resto son conocimientos que ya tuvieron al menos un acierto pleno y están vencidos.

Orden dentro de cada grupo: prioridad del tema (`maxima`, `alta`, `normal`), después los más vencidos, después la posición manual de materia, rama, tema y conocimiento. Un vencimiento vacío cuenta como lo más vencido.

No entran los archivados ni los que no tienen preguntas.

La primera petición de una fecha local arma la sesión y la guarda. Volver a abrir ese día devuelve la misma sesión, sin los ítems ya respondidos. Lo que se cargue o se edite después de armar la sesión entra como muy pronto en la cola del día siguiente.

## Arquitectura

Monorepo TypeScript con tres partes:

- `packages/domain`: funciones puras de puntaje, nivel, intervalo y selección de cola. No acceden a la base ni a la red.
- `server`: API Node.js y PostgreSQL. Docker Compose levanta la API, PostgreSQL y el volumen de medios. Sin la variable de entorno de la contraseña, el servidor no arranca.
- `desktop`: Electron. Tiene tres superficies: el árbol de materia, rama y tema; la ficha del conocimiento, con texto, medios, preguntas, relaciones y archivo; y la cola del día. SQLite guarda el token, la sesión descargada y la bandeja de respuestas pendientes. Los medios de la sesión van a archivos locales.

Hay una sola persona usuaria. La contraseña llega en la variable de entorno `AUTH_PASSWORD`. Canjearla devuelve un token opaco que dura 30 días. Android, cuando exista, usará este mismo acceso y esta misma API.

Límites de medios: 10 MB por imagen y 100 MB por video. Si la subida falla, el conocimiento queda guardado y ese medio queda sin adjuntar. Se puede reintentar la subida.

## Recorrido de un día

1. El escritorio envía la fecha local `YYYY-MM-DD`.
2. El servidor devuelve la sesión de esa fecha. Si no existía, la crea.
3. Con la sesión llega la pregunta, la clave de corrección y el conocimiento que la respalda: título, explicación, ejemplo, link y medios. La interfaz oculta la clave y el conocimiento hasta que la persona responde. Esa copia queda en el escritorio para poder revelarla sin red. Los medios de la sesión también quedan en el disco.
4. La persona responde. En la escrita, la marca de equivalencia forma parte de la misma respuesta. Hasta que no marca, no se encola para sincronizar.
5. El escritorio muestra el resultado y el conocimiento de respaldo.
6. La respuesta se escribe en SQLite con un UUID generado en el escritorio.
7. El escritorio la envía hasta recibir confirmación de ese UUID. Recién entonces la borra de la bandeja.

Sin red se puede terminar una sesión ya descargada. Si el medio no alcanzó a guardarse en el disco, la pregunta igual se responde y el medio se ve al recuperar la red. Sin una sesión descargada, el día no empieza.

Al confirmar, el servidor califica contra la copia guardada en la sesión. Una edición o un borrado posterior de la pregunta viva no cambia esa copia ni la corrección.

Un lote de respuestas se aplica en orden de hora de respuesta y, si empatan, por UUID. El piso de 0 puntos se aplica en cada respuesta de esa secuencia.

La bandeja se reintenta al volver la red, al abrir la app y cada 60 segundos mientras queden pendientes.

## Errores y reglas de borde

- El mismo UUID de respuesta se aplica una vez. Una repetición responde éxito y no vuelve a mover puntos ni calendario.
- Una respuesta cuyo ítem no está en la sesión de esa fecha se rechaza. El escritorio la saca de la bandeja y no la reintenta.
- Si el conocimiento se archivó después de emitir la sesión, la respuesta se acepta y mueve los puntos. No modifica aciertos plenos, intervalo base ni vencimiento.
- Un token inválido o vencido hace que el escritorio pida la contraseña de nuevo. La bandeja local sigue intacta.
- No se admite una relación de un conocimiento consigo mismo.
- Se puede editar o borrar una pregunta viva. Editar actualiza el enunciado y la clave. Si se borra la última pregunta, el conocimiento deja de entrar en colas futuras. La sesión ya emitida sigue vigente.

## Pruebas

Dominio, sin base de datos:

- Tramos 0–7, 8–23 y 24 o más.
- Piso de puntos en 0, con reinicio del calendario en el error.
- Intervalos base 1, 3 y 7, y los siguientes 18, 45 y 113.
- Factores de prioridad y el mínimo de 1 día.
- Parcial: no cambia puntos, aciertos, intervalo ni vencimiento.
- Cola de 20 con tope de 5 nuevos, sin rellenar el resto con más nuevos.
- Exclusión de archivados y de conocimientos sin preguntas.
- Caída al tipo más avanzado disponible cuando falta el tipo del nivel.

API:

- La misma fecha local devuelve la misma sesión.
- El mismo UUID no se aplica dos veces.
- Una respuesta de otra sesión se rechaza.
- Archivar después de emitir la sesión suma o resta puntos y no reprograma.
- La corrección usa la copia de la sesión aunque la pregunta viva haya cambiado.

Escritorio:

- Una respuesta permanece en SQLite hasta la confirmación del servidor.
- Pedir la contraseña de nuevo no borra la bandeja.

## Decisiones de esta versión

- Primero servidor y escritorio. Android después, contra esta API.
- Las preguntas las escribe la persona usuaria.
- El multiplicador del intervalo, después de los tres primeros aciertos plenos, es el constante 2,5. No hay un factor de facilidad que suba y baje en cada repaso.
- La variación de esta versión es el cambio de tipo según los puntos del tema y la rotación entre preguntas ya escritas.
