# auto-handoff: un relevo ordenado para tus conversaciones largas con Claude

| Versión revisada por ASAI |  |
| --- | --- |
| Mod | auto-handoff |
| Autor | Alex Hillman ([@alexknowshtml](https://github.com/alexknowshtml)) · licencia MIT |
| Versión | 0.8.6-asai.2 (ajuste de ASAI sobre la 0.8.6 del autor) |
| Commit revisado | <code>8d762ce726c962268e2dbe24c1c60f0889a2fcde</code> |
| Fecha de revisión | 26 de octubre de 2026 |
| Veredicto | Revisado, listo (con el visor apagado) |
| Alcance | Mac, con la app de escritorio de Claude y Claude Code 2.1.308 |
| Estado | Vigente |

## Qué es

auto-handoff es un mod para Claude Code (un mod, o plugin, es un complemento que le agrega una función a Claude Code). Antes de que una conversación larga llegue a su límite, le pide a un modelo de Claude (Sonnet, el que recomendamos, o Haiku: tú eliges) un parte con lo que se hizo, lo que se decidió, las reglas que diste y lo que queda pendiente; después limpia la sesión y abre una nueva que lee ese parte y sigue trabajando.

Piensa en el cambio de turno de una guardia: quien se va le deja al que llega una nota de relevo con lo que pasó, lo que quedó a medias y lo que no se debe tocar. auto-handoff escribe esa nota por ti. Es una alternativa a la compactación automática, que es lo que Claude Code hace por su cuenta cuando la conversación se llena.

## Para qué te sirve

- <b>Proyectos largos.</b> Llevas horas con Claude en el mismo trabajo y la conversación se acerca a su límite. En lugar de quedarte con un resumen que no elegiste, la sesión nueva arranca con un parte ordenado: qué estaba en curso, qué decisiones se tomaron y cuál es el siguiente paso.
- <b>Decisiones que no quieres repetir.</b> Ya acordaste un formato, un nombre o una regla ("no borres nada sin preguntarme"). Las plantillas de ASAI piden que el parte copie esas reglas en su propia sección para que la sesión nueva las siga aplicando.
- <b>Retomar donde lo dejaste.</b> El parte queda guardado como archivo en tu computadora. Si mañana quieres saber en qué ibas, lo abres y lo lees.
- <b>Un equipo que comparte método.</b> Si varias personas del equipo instalan la misma versión con las mismas plantillas, todos los partes siguen la misma estructura: trabajo en curso, decisiones, reglas, pendientes numerados y qué falta anotar en el registro del proyecto (la plantilla le pide al modelo que omita las secciones vacías).

Lo que no te prometemos: que el parte lo capture todo. Es un resumen escrito por un modelo y puede omitir cosas. Por eso las plantillas piden reglas, trazabilidad y pendientes numerados, y por eso te recomendamos leer con calma tu primer parte real.

## Qué necesitas antes de empezar

- <b>Una Mac.</b> El mod lo probamos en vivo en Mac, con la app de escritorio y Claude Code 2.1.308.
- <b>La app de escritorio de Claude con Claude Code.</b> La instalación la hace Claude desde una sesión de Claude Code; está pensada para que no tengas que abrir la Terminal. Si tu sesión no encuentra el programa de Claude Code, el Paso 5 te dice qué hacer.
- <b>Un plan de Claude con margen.</b> Cada relevo usa una llamada al modelo que elijas, Sonnet o Haiku, con buena parte de la conversación (ver «Sonnet o Haiku: quién escribe el parte»).
- <b>Tiempo.</b> Unos 10 minutos (es una estimación nuestra, no una medición).

## Instalación desde Claude Code

No vas a escribir comandos. Le vas a pasar a Claude un mensaje con los pasos exactos; Claude los corre, te enseña el resultado de cada uno y se detiene si algo no sale.

### Paso 1 · Descarga el paquete

Descárgalo desde el botón de esta página. Queda en tu carpeta Descargas como un archivo <code>.zip</code> (o, si usas Safari, ya como una carpeta <code>asai-mods</code>). No tienes que abrirlo: Claude lo hace.

Adentro vienen tres cosas: el código del mod del autor con nuestro ajuste (cada cambio marcado y explicado en <code>CAMBIOS-ASAI.md</code>), la lista de huellas para comprobar que nadie cambió el código ni las plantillas, y nuestras plantillas del parte en español y en inglés (este mensaje instala las de español, así que el parte y la primera respuesta de la sesión nueva salen en español).

### Paso 2 · Abre una sesión de Claude Code en la app

Abre la app de escritorio de Claude y empieza una sesión nueva de Claude Code, en cualquier carpeta.

### Paso 3 · Pega este mensaje y envíalo

Copia todo el recuadro, pégalo en la sesión y envíalo. Antes del paso 8, Claude te va a preguntar qué modelo quieres que escriba el parte; nosotros recomendamos Sonnet (ver «Sonnet o Haiku: quién escribe el parte»).

```txt
Instala el mod auto-handoff 0.8.6-asai.2 revisado por ASAI. Corre estos comandos uno por uno, en este orden y sin cambiarlos; lo único que cambias es la palabra MODELO del paso 8. Muéstrame el resultado de cada uno. Si alguno falla, o si un resultado no es el que te digo, detente y explícame qué pasó; no intentes otra vía. No toques ningún otro archivo.

1. Revisar que no haya una instalación anterior. Si dice "YA EXISTE", detente y pregúntame:
test -e ~/asai-mods && echo "YA EXISTE ~/asai-mods" || echo "libre"

2. Poner el paquete en mi carpeta personal:
if [ -d ~/Downloads/asai-mods ]; then mv ~/Downloads/asai-mods ~/asai-mods; else Z=$(ls -t ~/Downloads/*asai-mods*.zip | head -1) && mkdir -p ~/Downloads/asai-mods-descomprimido && unzip -q -o "$Z" -d ~/Downloads/asai-mods-descomprimido && mv ~/Downloads/asai-mods-descomprimido/asai-mods ~/asai-mods && rmdir ~/Downloads/asai-mods-descomprimido; fi

3. Comprobar las huellas. Tienen que salir 25 líneas OK y al final "HUELLAS CORRECTAS". Si sale FAILED o "did NOT match", detente y no instales nada:
cd ~/asai-mods/plugins/auto-handoff && shasum -a 256 -c ~/asai-mods/SHA256SUMS.txt && echo "HUELLAS CORRECTAS"

4. Preparar las carpetas:
mkdir -p ~/.claude/auto-handoff ~/.claude/state/auto-handoff && chmod 700 ~/.claude/state/auto-handoff

5. Copiar las plantillas en español sin pisar las que ya tenga:
for f in brief.md instructions.md; do if [ -e ~/.claude/auto-handoff/$f ]; then echo "YA EXISTE $f, no lo toco"; else cp ~/asai-mods/plantillas/$f ~/.claude/auto-handoff/ && echo "copiada $f"; fi; done

6. Registrar el mercado de ASAI:
"${CLAUDE_CODE_EXECPATH:-claude}" plugin marketplace add ~/asai-mods

7. Instalar el mod (es normal un aviso de "7 userConfig options not yet set"):
"${CLAUDE_CODE_EXECPATH:-claude}" plugin install auto-handoff@asai-mods

8. Antes de correr este paso, pregúntame qué modelo quiero que escriba el parte: Sonnet, el que recomienda ASAI (en su prueba a ciegas con 5 sesiones largas ganó en 4 y tuvo la mitad de errores; unos USD 0.22 por relevo), o Haiku, el del autor original (unos USD 0.012 por relevo, pero con más errores). Si no contesto o no sé, usa sonnet. Cambia MODELO por sonnet o haiku, en minúsculas, y corre el comando para apagar el visor, fijar el umbral en 160,000 y fijar el modelo:
echo '{"viewer": "off", "threshold": "160000", "briefModel": "MODELO"}' | "${CLAUDE_CODE_EXECPATH:-claude}" plugin configure auto-handoff@asai-mods --values-stdin

9. Confirmar la instalación. Tiene que aparecer auto-handoff@asai-mods con Version 0.8.6-asai.2 y Status enabled:
"${CLAUDE_CODE_EXECPATH:-claude}" plugin list

Al terminar, dime en una línea si todo salió bien y con qué modelo quedó, y recuérdame cerrar la app de Claude por completo (Cmd + Q) y volver a abrirla.
```

### Paso 4 · Acepta los permisos

Claude Code puede pedirte permiso antes de correr cada comando. Revisa que sea el del paso que toca y acéptalo.

### Paso 5 · Revisa lo que te dice Claude

Si todo salió bien, Claude te dice que el mod quedó instalado con la versión 0.8.6-asai.2 y con qué modelo. Si se detuvo, te explica en qué paso y por qué. Los casos más comunes:

- <b>"YA EXISTE \~/asai-mods" (paso 1):</b> ya habías instalado o empezado antes. Pídele a Claude que te muestre qué hay en esa carpeta antes de decidir.
- <b>Huellas con FAILED (paso 3):</b> el código no es el que revisamos. No sigas y escríbenos.
- <b>"command not found: claude" (paso 6):</b> la sesión no encontró el programa de Claude Code. Escríbenos y te damos la instalación desde la Terminal.
- <b>"YA EXISTE </b><code>brief.md</code><b>" (paso 5):</b> ya habías usado auto-handoff y se quedan tus plantillas. Si quieres las nuestras en español, pídele a Claude que te muestre esos dos archivos antes de cambiarlos.

### Paso 6 · Reinicia la app

Cierra la app de Claude por completo (Cmd + Q, no solo la ventana) y vuelve a abrirla. Las sesiones de Claude Code que abras a partir de ahora cargan el mod.

<b>Importante:</b> no muevas ni borres la carpeta <code>asai-mods</code> de tu carpeta personal. Claude Code lee el mod desde ahí.

## Cómo saber que ya funciona

Con honestidad: <b>mientras la conversación no llega al umbral, el mod no muestra nada.</b> No hay un ícono ni un aviso permanente. Lo que sí puedes comprobar:

1. <b>Que está instalado y encendido:</b> pídele a Claude en cualquier sesión que corra <code>"${CLAUDE_CODE_EXECPATH:-claude}" plugin list</code> y te diga si auto-handoff aparece como enabled.
2. <b>Cuando llega al umbral:</b> el mod avisa, espera a que el modelo escriba el parte (Sonnet: de 12 a 16 segundos en vivo dentro del mod y de 19 a 31 en la prueba a ciegas; Haiku: de 43 a 64 en la prueba a ciegas, no lo corrimos en vivo) y pasa a una sesión nueva, que abre diciendo de qué sesión viene. Esa es la señal de que funcionó.
3. <b>Que el parte quedó guardado:</b> después de tu primer relevo, en <code>~/.claude/state/auto-handoff</code> hay un archivo <code>.md</code> por cada parte, además de una carpeta <code>pages</code> y un archivo <code>auto-handoff.log</code>; esos dos son normales.

Con el umbral de 160,000 puede pasar un buen rato antes del primer relevo. Es normal.

## Sonnet o Haiku: quién escribe el parte

Al instalarlo eliges qué modelo escribe el parte. <b>Te recomendamos Sonnet</b>, y no por intuición: lo probamos.

- <b>Cómo lo probamos.</b> El 26 de octubre de 2026 tomamos 5 sesiones reales de unos 400,000 tokens, de cinco proyectos distintos. Para cada una escribimos dos partes, uno con Sonnet y otro con Haiku, cada uno con sus límites de lectura. Fueron llamadas sueltas, sin el tope de respuesta ni el minuto de espera que la opción Haiku sí aplica dentro del mod (en una de las 5 sesiones, Haiku pasó del minuto). Los barajamos y un revisor independiente los calificó contra el registro completo de la sesión sin saber cuál era cuál.
- <b>Qué salió.</b> El parte de Sonnet ganó en 4 de las 5 y tuvo la mitad de errores (11 contra 21). El de Haiku era más largo y cubría más temas, pero varias veces daba por pendiente algo que ya estaba resuelto, y eso pone a la sesión nueva a repetir trabajo.
- <b>Cuánto cuesta.</b> En la prueba, unos USD 0.22 por relevo con Sonnet (de 0.17 a 0.30) y unos USD 0.012 con Haiku: unas 19 veces menos. Sale de tu plan, igual que el resto de la conversación. Un relevo llega después de una conversación larga que ya gastó mucho más que eso, y un parte equivocado se paga con trabajo repetido.
- <b>Cuánto ve cada uno.</b> Sonnet lee los últimos 400 mensajes y hasta 600,000 caracteres; Haiku, los 120 mensajes y 150,000 caracteres del original.
- <b>Cuándo tiene sentido Haiku:</b> si tu plan va justo y haces muchos relevos, o si prefieres el comportamiento del autor tal cual.

<b>Para cambiarlo después,</b> pídele a Claude que corra este comando (con haiku o sonnet) y luego reinicia la app:

```txt
echo '{"briefModel": "haiku"}' | "${CLAUDE_CODE_EXECPATH:-claude}" plugin configure auto-handoff@asai-mods --values-stdin
```

## Cómo elegir el umbral

El umbral es el tamaño de conversación, medido en tokens (pedacitos de texto que cuenta Claude), en el que el mod hace el relevo. La ventana de contexto es lo máximo que cabe en una conversación, también en tokens. La regla simple:

- <b>Ventana de 200,000 tokens:</b> umbral de 160,000. Es el valor que deja la instalación.
- <b>Ventana de 1,000,000 de tokens:</b> umbral de 400,000. No uses el 80% (800,000): el mod le pasa al modelo como máximo los últimos 600,000 caracteres de la conversación con Sonnet (150,000 con Haiku), así que con un umbral tan alto el parte dejaría fuera buena parte de lo anterior.
- <b>Si no sabes cuál es tu ventana:</b> deja 160,000.

<b>Por qué un umbral muy bajo encadena relevos:</b> una sesión nueva no empieza vacía. Ya trae las herramientas, los conectores y el propio parte; en nuestra Mac arrancaba en unos 46,000 tokens. Si el umbral queda cerca de ese número, la sesión nueva llega al límite casi de inmediato y vuelve a hacer relevo. El mod se protege: no hace un relevo nuevo hasta que la sesión crece al menos 40,000 tokens desde su arranque, y se pausa después de 2 relevos seguidos sin que escribas nada. Aun así, no lo bajes de unos 90,000.

<b>Para cambiarlo,</b> pídele a Claude que corra este comando (ejemplo con 400,000) y luego reinicia la app:

```txt
echo '{"threshold": "400000"}' | "${CLAUDE_CODE_EXECPATH:-claude}" plugin configure auto-handoff@asai-mods --values-stdin
```

## Cómo apagarlo o quitarlo

En todos los casos, pídele a Claude que corra el comando y después reinicia la app.

<b>Apagarlo un tiempo</b> (queda instalado, pero no actúa):

```txt
"${CLAUDE_CODE_EXECPATH:-claude}" plugin disable auto-handoff@asai-mods --scope user
```

<b>Volver a encenderlo:</b>

```txt
"${CLAUDE_CODE_EXECPATH:-claude}" plugin enable auto-handoff@asai-mods --scope user
```

<b>Quitarlo del todo</b> (dos comandos, en este orden):

```txt
"${CLAUDE_CODE_EXECPATH:-claude}" plugin uninstall auto-handoff@asai-mods --scope user
```

```txt
"${CLAUDE_CODE_EXECPATH:-claude}" plugin marketplace remove asai-mods
```

Después ya puedes mandar a la Papelera la carpeta <code>asai-mods</code> de tu carpeta personal. Las plantillas se quedan en <code>~/.claude/auto-handoff</code>; si también quieres quitarlas, bórralas desde el Finder.

<b>Borrar los partes viejos:</b> pídele a Claude que abra la carpeta en el Finder con <code>open ~/.claude/state/auto-handoff</code> (comando de la Mac; no lo probamos en esta corrida) y manda a la Papelera los <code>.md</code> y la carpeta <code>pages</code> que ya no necesites.

## Lo que debes saber

- <b>Los partes guardan texto de tus conversaciones en claro</b>, en tu propia computadora, dentro de <code>~/.claude/state/auto-handoff</code>. Cualquiera con acceso a tu usuario puede leerlos.
- <b>Además del </b><b><code>.md</code></b><b>, el mod guarda una página </b><b><code>.html</code></b><b> de cada parte</b> en la carpeta <code>pages</code>. Si la abres en el navegador, carga tipografías de Google y dos librerías de cdnjs desde internet. El texto del parte no sale de tu computadora, pero la visita sí queda registrada en esos servicios. Para leer el parte, abre el <code>.md</code>. Ojo: el enlace que el mod muestra al hacer el relevo abre esa página <code>.html</code>.
- <b>No pegues claves ni contraseñas en el chat.</b> Nuestras plantillas le piden al modelo que escriba <code>[secreto omitido]</code> en lugar de copiarlas, pero la forma segura es que nunca estén en la conversación.
- <b>Cada relevo usa una llamada al modelo que elegiste</b>, que cuenta en tu plan. En nuestra prueba, unos USD 0.22 por relevo con Sonnet y unos USD 0.012 con Haiku. No lo medimos en un plan de suscripción.
- <b>Mientras se escribe el parte, Claude no puede usar herramientas.</b> Sonnet: de 12 a 16 segundos en vivo dentro del mod y de 19 a 31 en la prueba a ciegas. Haiku: de 43 a 64 en la prueba a ciegas (no lo corrimos en vivo). El límite es de 3 minutos con Sonnet y de 1 minuto con Haiku. Si se queda así un momento, es normal: no cierres la sesión.
- <b>Si el modelo no contesta</b> (porque pasa su límite de tiempo o porque tu organización no permite ese modelo), el mod hace el relevo igual, con un parte más corto que solo trae los datos de la sesión.
- <b>Con Haiku y sesiones largas, el relevo puede salir solo con hechos.</b> Si Haiku pasa su minuto, el mod usa el parte corto con los datos de la sesión; en nuestra prueba, una de 5 sesiones tardó más de un minuto.
- <b>El parte puede omitir cosas.</b> Lee el primero con atención. Si algo importante no quedó, anótalo en el registro de tu proyecto.
- <b>No se actualiza solo, y es a propósito.</b> Instalas la versión que revisamos y se queda así hasta que tú instales otra.
- <b>Solo está probado en lo que indica el recuadro:</b> Mac, app de escritorio de Claude, Claude Code 2.1.308. No lo hemos probado en Windows ni en Linux, ni en otras versiones de Claude Code. En nuestra revisión, el Claude Code 2.1.77 de la Terminal no lo cargaba.

## Por qué ASAI

Un mod corre código en tu computadora, dentro de tus sesiones de Claude. Por eso no lo recomendamos solo porque alguien lo publicó: <b>revisamos cada versión antes de recomendarla.</b>

<b>Qué revisamos, en concreto:</b>

- Leemos el código de una <b>versión exacta</b> (un commit, que es una foto fija del código en GitHub) y anotamos cuál.
- Buscamos si hace llamadas a internet, si ejecuta comandos, qué archivos lee y escribe, qué datos tuyos salen y a dónde, y si carga recursos de terceros.
- Anotamos cada hallazgo con su riesgo y su mitigación, es decir, el ajuste o la regla de uso que lo resuelve.
- Lo probamos en vivo antes de recomendarlo.
- Decimos por escrito <b>qué no verificamos.</b> En esta versión: el costo exacto en el plan, los servicios de Sonnet y de Haiku, la opción Haiku en vivo (sí en las pruebas automáticas y en la instalación), la instalación pegando el mensaje dentro de la app en una Mac nueva (los comandos sí los corrimos tal cual en una Mac, con una carpeta personal vacía) y cualquier versión posterior a la indicada. La versión con Sonnet la usamos en nuestro propio equipo desde el 26 de octubre de 2026.

<b>Qué ajustamos nosotros (y solo esto):</b>

- <b>Tú eliges quién escribe el parte, y te recomendamos Sonnet con datos.</b> En el original siempre lo escribe Haiku. Con Sonnet, el parte ve los últimos 400 mensajes y hasta 600,000 caracteres (el original, 120 y 150,000). Lo probamos a ciegas con 5 sesiones reales de unos 400,000 tokens: el parte de Sonnet ganó en 4 y tuvo la mitad de errores; el de Haiku cubría más, pero varias veces daba por pendiente lo que ya estaba resuelto.
- <b>Un error del original, corregido:</b> si la llamada al modelo fallaba, el relevo se quedaba atascado y Claude no podía usar herramientas. Ahora cae a un parte con los datos de la sesión y sigue.
- <b>Visor apagado en la instalación.</b> Nuestro mensaje lo apaga (paso 8); el código del autor lo trae encendido y, encendido, el mod abre una página web sin contraseña para leer los partes y, en nuestra prueba, dejó ese proceso funcionando al cerrar la sesión.
- <b>Plantillas del parte en español y en inglés,</b> con reglas duras, trazabilidad (qué falta anotar en el registro del proyecto), pendientes numerados y la instrucción de no copiar secretos.
- <b>Una guía de umbral</b> según el tamaño de tu ventana.
- <b>Una instalación que hace Claude por ti,</b> con los comandos que corrimos tal cual, de principio a fin, en entornos limpios (Linux y Mac, Claude Code 2.1.308).

<b>Del código del autor solo cambia lo que explica </b><b><code>CAMBIOS-ASAI.md</code></b><b>:</b> la opción de modelo, cuánto ve y cuánto espera cada uno, y la caída al parte de hechos. Cada cambio está marcado con <code>ASAI:</code> y explicado en <code>CAMBIOS-ASAI.md</code>, dentro del paquete. Lo pasamos por una auditoría independiente y por las pruebas automáticas del autor más seis nuestras (87 de 87). El paquete lleva huellas SHA256 para que se compruebe que es el que revisamos (paso 3 del mensaje).

<b>Nuestro compromiso:</b> cuando salga una versión nueva, la revisamos antes de cambiar esta página. El sello vale solo para la versión que se indica.

<b>Última revisión:</b> 26 de octubre de 2026 · versión 0.8.6-asai.2 · sobre el commit <code>8d762ce</code>.

Cuando haya una versión nueva en revisión, verás arriba de esta página: <i>"Versión nueva en revisión. Mientras tanto, el paquete y estas instrucciones siguen siendo de la versión indicada arriba, que es la que revisamos."</i> La página cambia solo cuando la versión nueva pasa la revisión.

## Crédito y licencia

auto-handoff es obra de <b>Alex Hillman</b> ([@alexknowshtml](https://github.com/alexknowshtml)). Repositorio original: [github.com/alexknowshtml/claude-auto-handoff](https://github.com/alexknowshtml/claude-auto-handoff). Se distribuye con licencia <b>MIT</b>; el texto completo viene en el paquete, en <code>plugins/auto-handoff/LICENSE</code>. ASAI no es autor del mod: lo nuestro es la revisión, el ajuste de modelo (Sonnet por defecto, Haiku opcional), las plantillas en español y en inglés, y estas instrucciones. El <code>README.md</code> del paquete es el del autor y describe la versión original; donde dice Haiku, en esta versión es el modelo que elegiste (Sonnet si no lo cambiaste). Los cambios están en <code>CAMBIOS-ASAI.md</code>.
