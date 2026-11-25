# blast-radius: una pausa antes de que Claude corra un comando peligroso

| Versión revisada por ASAI |  |
| --- | --- |
| Mod | blast-radius-asai (ajuste de ASAI sobre blast-radius) |
| Autor | Claude Code DevRel, de Anthropic ([anthropics/claude-code-playground](https://github.com/anthropics/claude-code-playground)) · licencia Apache-2.0 |
| Versión | 0.1.0-asai.1 (ajuste de ASAI sobre la 0.1.0 del autor) |
| Commit revisado | <code>569c5283d9a0a7ee7938df85bb32e4f48cbb8c86</code> |
| Fecha de revisión | 25 y 26 de octubre de 2026 |
| Veredicto | Revisado, listo (como red de seguridad, no como candado) |
| Alcance | Mac, con la app de escritorio de Claude y Claude Code 2.1.308 |
| Estado | Vigente |

## Qué es

blast-radius es un mod para Claude Code (un mod, o plugin, es un complemento que le agrega una función a Claude Code). Cuando Claude va a correr un comando de terminal peligroso, como borrar una carpeta con <code>rm -rf</code>, descartar cambios con <code>git reset --hard</code>, forzar un <code>git push --force</code> o correr una migración, el mod lo detiene, mide qué cambiaría y te enseña un recuadro con dos botones: <b>Proceder</b> y <b>Cancelar</b>. Si cancelas, Claude recibe el rechazo con el motivo y no corre el comando.

Piensa en el aviso de «¿seguro que quieres vaciar la Papelera?», pero con la cuenta exacta de lo que se perdería. En nuestra prueba en vivo, antes de un <code>rm -rf build</code> el recuadro dijo que se iban a borrar 25 archivos, unos 100 KB, con la lista de los primeros 10.

Lo que instalas es nuestro ajuste, <code>blast-radius-asai</code>: el código del autor con los cambios de ASAI marcados y explicados en <code>CAMBIOS-ASAI.md</code>, dentro del paquete.

## Para qué te sirve

- <b>Trabajas con permisos en modo bypass.</b> En ese modo Claude no te pide permiso antes de cada comando. En nuestra prueba, blast-radius fue la única barrera que vimos funcionar ahí: detuvo <code>rm -rf build</code>, <code>git reset --hard</code>, <code>git push --force origin main</code> y <code>git clean -fd</code>, y al presionar Cancelar todo quedó intacto.
- <b>Decidir viendo lo que se pierde.</b> El recuadro lista los archivos que se borrarían, los cambios sin guardar que se descartarían, los commits del remoto que un force push tiraría o las rutas sin seguimiento que <code>git clean</code> quitaría.
- <b>Comandos escondidos dentro de otros.</b> El original no revisa lo que va dentro de <code>bash -c</code>, <code>eval</code>, <code>xargs</code> o <code>timeout</code>. Nuestro ajuste sí: en la prueba en vivo con el ajuste, <code>bash -c 'rm -rf build'</code> se detuvo.
- <b>Bases de datos y despliegue.</b> El ajuste suma comandos que el original no conoce, entre ellos el reset de base de Supabase, <code>psql</code> con <code>drop</code> o <code>truncate</code>, <code>vercel env rm</code>, <code>drizzle-kit push</code> y <code>git branch -D</code>. La lista completa está en <code>CAMBIOS-ASAI.md</code>.

## Lo que no te prometemos

Nuestro veredicto lo dice en una frase: <b>como red de seguridad, no como candado.</b> Esto es lo que eso significa en la práctica:

- <b>Solo vigila la herramienta Bash de Claude Code.</b> Si Claude corre comandos por otra vía (un conector que ejecuta procesos, como Desktop Commander, la Terminal de la app o el control de la computadora), el mod no lo ve. Para un bloqueo real, usa reglas <code>deny</code> en los permisos de Claude Code.
- <b>Revisa el texto del comando.</b> No ve lo que borra un script, un archivo <code>.sql</code> o un programa de Python o de Node. Tampoco detecta algunos casos que <code>CAMBIOS-ASAI.md</code> anota como límites conocidos, por ejemplo un script que llega por un pipe a <code>bash</code>, un comando guardado en una variable o <code>docker run</code> con un borrado adentro.
- <b>Después de Proceder, el comando corre tal cual.</b> El mod no lo aísla ni lo deshace.
- <b>Habrá avisos de más.</b> Un <code>rm -f</code> de un solo archivo también se detiene. <code>psql -f consulta.sql</code> o un <code>select</code> que llega por un pipe se detienen aunque solo lean, porque el mod no puede ver qué hacen; así lo decidimos. Un mensaje o comentario que menciona un comando peligroso también puede detenerse.

## Qué necesitas antes de empezar

- <b>Una Mac.</b> Lo probamos en vivo en Mac, con Claude Code 2.1.308.
- <b>La app de escritorio de Claude con Claude Code 2.1.287 o más.</b> La app traía 2.1.308 en nuestra revisión. La instalación la hace Claude desde una sesión de Claude Code. En nuestra revisión, el <code>claude</code> de la Terminal estaba en 2.1.77 y no cargaba el mod.
- <b>Alguien frente a la pantalla.</b> El mod espera a que presiones un botón. En una tarea programada, una rutina, <code>/loop</code> o una sesión sin pantalla, nuestro ajuste rechaza el comando al instante y le pide a Claude que te avise. Eso frena la corrida, así que no lo instales en una máquina que trabaja sola.
- <b>bash, git, find y du.</b> Son las herramientas con las que mide; la Mac ya las trae.

## Instalación desde Claude Code

No vas a escribir comandos. Le vas a pasar a Claude un mensaje con los pasos exactos; Claude los corre, te enseña el resultado de cada uno y se detiene si algo no sale.

### Paso 1 · Descarga el paquete

Descárgalo desde el botón de esta página. Queda en tu carpeta Descargas como un archivo <code>.zip</code> (o, si usas Safari, ya como una carpeta <code>asai-mods-blast-radius</code>). No tienes que abrirlo: Claude lo hace.

Adentro vienen tres cosas: el código del mod del autor con nuestro ajuste (cada cambio marcado con <code>ASAI:</code> y explicado en <code>CAMBIOS-ASAI.md</code>), la lista de huellas para comprobar que nadie cambió el código, y el archivo que registra el paquete en Claude Code.

### Paso 2 · Abre una sesión de Claude Code en la app

Abre la app de escritorio de Claude y empieza una sesión nueva de Claude Code, en cualquier carpeta.

### Paso 3 · Pega este mensaje y envíalo

Copia todo el recuadro, pégalo en la sesión y envíalo.

```txt
Instala el mod blast-radius-asai 0.1.0-asai.1 revisado por ASAI. Corre estos comandos uno por uno, en este orden y sin cambiarlos. Muéstrame el resultado de cada uno. Si alguno falla, o si un resultado no es el que te digo, detente y explícame qué pasó; no intentes otra vía. No toques ningún otro archivo.

1. Revisar que no haya una instalación anterior. Si dice "YA EXISTE", detente y pregúntame:
test -e ~/asai-mods-blast-radius && echo "YA EXISTE ~/asai-mods-blast-radius" || echo "libre"

2. Poner el paquete en mi carpeta personal:
if [ -d ~/Downloads/asai-mods-blast-radius ]; then mv ~/Downloads/asai-mods-blast-radius ~/asai-mods-blast-radius; else Z=$(ls -t ~/Downloads/*asai-mods*blast-radius*.zip | head -1) && mkdir -p ~/Downloads/asai-mods-blast-radius-descomprimido && unzip -q -o "$Z" -d ~/Downloads/asai-mods-blast-radius-descomprimido && mv ~/Downloads/asai-mods-blast-radius-descomprimido/asai-mods-blast-radius ~/asai-mods-blast-radius && rmdir ~/Downloads/asai-mods-blast-radius-descomprimido; fi

3. Comprobar las huellas. Tienen que salir 8 líneas OK y al final "HUELLAS CORRECTAS". Si sale FAILED o "did NOT match", detente y no instales nada:
cd ~/asai-mods-blast-radius && grep ' plugins/blast-radius-asai/' SHA256SUMS.txt | shasum -a 256 -c && echo "HUELLAS CORRECTAS"

4. Registrar el mercado de ASAI para este mod:
"${CLAUDE_CODE_EXECPATH:-claude}" plugin marketplace add ~/asai-mods-blast-radius

5. Instalar el mod:
"${CLAUDE_CODE_EXECPATH:-claude}" plugin install blast-radius-asai@asai-mods-blast-radius --scope user

6. Confirmar la instalación. Tiene que aparecer blast-radius-asai@asai-mods-blast-radius con Version 0.1.0-asai.1 y Status enabled:
"${CLAUDE_CODE_EXECPATH:-claude}" plugin list

Al terminar, dime en una línea si todo salió bien y recuérdame cerrar la app de Claude por completo (Cmd + Q) y volver a abrirla.
```

### Paso 4 · Acepta los permisos

Claude Code puede pedirte permiso antes de correr cada comando. Revisa que sea el del paso que toca y acéptalo.

### Paso 5 · Revisa lo que te dice Claude

Si todo salió bien, Claude te dice que el mod quedó instalado con la versión 0.1.0-asai.1. Si se detuvo, te explica en qué paso y por qué. Los casos más comunes:

- <b>"YA EXISTE \~/asai-mods-blast-radius" (paso 1):</b> ya habías instalado o empezado antes. Pídele a Claude que te muestre qué hay en esa carpeta antes de decidir.
- <b>Huellas con FAILED (paso 3):</b> el código no es el que revisamos. No sigas y escríbenos.
- <b>"command not found: claude" (paso 4):</b> la sesión no encontró el programa de Claude Code. Escríbenos y te damos la instalación desde la Terminal.

### Paso 6 · Reinicia la app

Cierra la app de Claude por completo (Cmd + Q, no solo la ventana) y vuelve a abrirla. Las sesiones de Claude Code que abras a partir de ahora cargan el mod.

<b>Importante:</b> no muevas ni borres la carpeta <code>asai-mods-blast-radius</code> de tu carpeta personal. Claude Code lee el mod desde ahí.

## Cómo saber que ya funciona

Mientras Claude no intente un comando de la lista, el mod no muestra nada. Para comprobarlo, <b>en una carpeta de prueba</b> que no te importe, pídele a Claude algo como «borra la carpeta build con rm -rf build». Debe salir el recuadro con lo que se borraría y los botones Proceder y Cancelar.

- Presiona <code>1</code> para Proceder o <code>2</code> para Cancelar; también puedes hacer clic en el botón. Al abrirse, Cancelar tiene el foco, así que Enter rechaza el comando.
- Si interrumpes el turno, el comando se rechaza.
- Si la ventana es angosta, el recuadro sale en la franja de arriba del cuadro de texto en lugar de un panel al lado.

<b>Con honestidad:</b> nuestras dos pruebas en vivo fueron en el panel de Terminal de la app. Todavía no vimos cómo se ve el recuadro en la pestaña Code de la app.

## Cómo apagarlo o quitarlo

<b>Apagarlo o encenderlo:</b> en una sesión de Claude Code escribe <code>/plugin</code>, entra a la pestaña Installed y apágalo o enciéndelo ahí. También se desactiva con la variable de entorno <code>BLAST_RADIUS_ASAI=off</code>.

<b>Quitarlo del todo</b>: pídele a Claude que corra estos dos comandos, en este orden, y después reinicia la app.

```txt
"${CLAUDE_CODE_EXECPATH:-claude}" plugin uninstall blast-radius-asai@asai-mods-blast-radius --scope user
```

```txt
"${CLAUDE_CODE_EXECPATH:-claude}" plugin marketplace remove asai-mods-blast-radius
```

Después ya puedes mandar a la Papelera la carpeta <code>asai-mods-blast-radius</code> de tu carpeta personal.

<b>Ojo con el modo seguro:</b> <code>claude --safe-mode</code> apaga todos los mods, este incluido. En nuestra prueba, una sesión en modo seguro y con bypass corrió <code>git reset --hard</code>, un force push y <code>git clean</code> sin freno. Si usas el modo seguro, no cuentes con blast-radius.

## Hallazgos y mitigaciones

Esto es lo que encontramos al revisar el código y al probarlo, con lo que recomendamos hacer.

| # | Hallazgo | Riesgo | Mitigación |
| --- | --- | --- | --- |
| 1 | Solo vigila la herramienta Bash. Lo que corre por Desktop Commander, la Terminal de la app o el control de la computadora no pasa por el mod. | Medio | Tómalo como red. Para un bloqueo real, reglas <code>deny</code> en los permisos de Claude Code. |
| 2 | Revisa el texto del comando sin interpretarlo como la terminal. El original no detectaba <code>bash -c</code>, <code>xargs rm</code>, <code>find -delete</code>, <code>timeout</code> ni comandos de base de datos o despliegue. | Medio | Nuestro ajuste revisa los comandos envueltos y suma esa lista; en vivo detuvo <code>bash -c 'rm -rf build'</code>. Quedan los límites que anota <code>CAMBIOS-ASAI.md</code>. |
| 3 | Para medir una migración corre el comando de estado de la herramienta antes de que decidas (por ejemplo <code>python3 manage.py showmigrations</code>). Eso carga el código del proyecto y puede conectarse a la base que tenga configurada. | Bajo a medio | Son comandos de solo lectura. Ten presente que en una carpeta conectada a producción sí hablan con esa base. |
| 4 | Sin nadie enfrente (tareas programadas, rutinas, sesiones sin pantalla) un comando detenido no se puede aprobar. | Medio para automatización | Nuestro ajuste lo rechaza al instante en vez de esperar 10 minutos. Instálalo solo donde haya alguien frente a la pantalla. |
| 5 | En una ventana angosta el recuadro se dibuja en la franja de arriba del texto, que solo un mod puede usar a la vez. Si otro mod la ocupa, los botones pueden no salir y el comando se rechaza. | Bajo | No lo combines con otros mods que dibujan en esa franja. |
| 6 | <code>rm -f</code> de un solo archivo también se detiene. | Informativo | Ninguna. |
| 7 | Pide Claude Code 2.1.287 o más. | Informativo | Usa la app de escritorio o actualiza el <code>claude</code> de la Terminal. |
| 8 | Proyecto joven: un autor, 3 commits, compartido tal cual y sin soporte. Que venga de Anthropic no cambia nuestra regla. | Informativo | Esta revisión solo vale para el commit indicado. Revisamos cada versión nueva. |
| 9 | <code>--safe-mode</code> apaga también este mod. | Alto si alguien cree que está protegido | No uses el modo seguro cuando cuentes con el mod. |

## Por qué ASAI

Un mod corre código en tu computadora, dentro de tus sesiones de Claude. Por eso no lo recomendamos solo porque alguien lo publicó: <b>revisamos cada versión antes de recomendarla.</b>

<b>Qué revisamos, en concreto:</b>

- Leímos línea a línea el código de una <b>versión exacta</b> (el commit <code>569c528</code>, una foto fija del código en GitHub).
- Red: ninguna. No lee variables de entorno ni escribe archivos. Lee solo lo que necesita para contar archivos.
- Procesos que lanza para medir: <code>sleep</code> (para esperar tu respuesta), <code>find</code>, <code>du</code>, comandos de solo lectura de git (<code>git status</code>, <code>git diff --shortstat</code>, <code>git clean -n</code>, <code>git log</code>) y, para migraciones, el comando de estado de cada herramienta. Las rutas van como argumentos, así que nada en ellas se ejecuta.
- Si algo falla mientras mide o espera, rechaza el comando.
- El validador de Claude Code (<code>claude plugin validate</code>, versión 2.1.308) aprobó el mod.
- Anotamos cada hallazgo con su riesgo y su mitigación, y decimos por escrito <b>qué no verificamos.</b> En esta versión: cómo se ve el recuadro en la pestaña Code de la app, el rechazo a los 10 minutos con alguien enfrente que no contesta, el comportamiento con subagentes, las migraciones en vivo, qué tan seguido falla la detección en un día normal de trabajo, la instalación pegando el mensaje dentro de la app en una Mac nueva, Windows, Linux y cualquier versión posterior a la indicada.

<b>Qué ajustamos nosotros (y solo esto):</b>

- <b>Comandos envueltos.</b> Revisa lo que va dentro de <code>bash -c</code>, <code>sh -c</code>, <code>zsh -c</code>, <code>eval</code>, <code>xargs</code>, <code>timeout</code> y otros envoltorios, y lo que corre dentro de <code>docker exec</code> o <code>ssh</code>.
- <b>Comandos de bases de datos y despliegue</b> que el original no conoce: Supabase, <code>psql</code> con <code>drop</code> o <code>truncate</code>, Vercel, <code>drizzle-kit push</code>, <code>git branch -D</code>, <code>git stash drop</code> y otros.
- <b>Sin nadie enfrente, rechazo al instante</b> en lugar de esperar 10 minutos.
- <b>Un interruptor</b>: <code>BLAST_RADIUS_ASAI=off</code> lo apaga.

<b>Cómo lo comprobamos:</b> cuatro auditorías independientes del código (la última sin hallazgos bloqueantes), 145 de 145 pruebas automáticas y dos pruebas en vivo en Mac con permisos en bypass. En la segunda, con el ajuste, se detuvieron y quedaron intactos con Cancelar <code>bash -c 'rm -rf build'</code>, <code>git reset --hard</code>, SQL con <code>drop table</code> que llegaba por un pipe a <code>psql</code> y un <code>drop table</code> dentro de <code>docker compose exec</code>; un <code>cat</code> con <code>grep</code> pasó sin recuadro, y <code>rm -rf build</code> solo borró la carpeta al presionar Proceder. El paquete lleva huellas SHA-256 para que compruebes que es el que revisamos (paso 3 del mensaje).

<b>Nuestro compromiso:</b> cuando salga una versión nueva del original, la revisamos antes de cambiar esta página. El sello vale solo para la versión que se indica. Próxima revisión: al salir una versión nueva y, como mínimo, en enero de 2027.

<b>Última revisión:</b> 26 de octubre de 2026 · versión 0.1.0-asai.1 · sobre el commit <code>569c528</code>.

## Crédito y licencia

blast-radius es obra de <b>Claude Code DevRel</b>, de Anthropic, en el repositorio [github.com/anthropics/claude-code-playground](https://github.com/anthropics/claude-code-playground). El autor lo comparte tal cual, como ejemplo, sin soporte, y aclara que no es un producto oficial de Anthropic. Se distribuye con licencia <b>Apache-2.0</b>; el texto completo viene en el paquete, en <code>plugins/blast-radius-asai/LICENSE</code>. El mod es obra de su autor; lo de ASAI es la revisión, el ajuste y estas instrucciones. El <code>README.md</code> del paquete es el del autor y describe el mod original; lo que cambia está en <code>CAMBIOS-ASAI.md</code>.
