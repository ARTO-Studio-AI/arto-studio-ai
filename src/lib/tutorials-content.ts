import type { Tutorial } from "@/lib/tutorials";

/* Contenido de los tutoriales (2026-11-05). Uno por publico de D23: negocio de barrio, agencia
 * chica y freelancer. Los pasos citan solo prompts de TUTORIAL_PROMPTS (src/lib/tutorials.ts),
 * verificados en el catalogo. Español de México, sin em dashes. Para agregar un tutorial: un
 * objeto mas aqui, con code y slug nuevos; el indice, el sitemap y el filtro lo toman solos. */

export const TUTORIALS: Tutorial[] = [
  {
    code: "T01",
    slug: "abre-tu-cafeteria-con-ia",
    publishedAt: "2026-11-05",
    tools: ["claude", "chatgpt", "midjourney"],
    level: "beginner",
    readingMinutes: 8,
    category: "marketing",
    copy: {
      es: {
        title: "Abre tu cafetería (o negocio de barrio) con IA en una tarde",
        summary:
          "Nombre, perfil de Google, plan de lanzamiento de 30 días, mascota y un reel listo para grabar. Cinco prompts, una tarde y tus datos.",
        audience:
          "Para quien está por abrir una cafetería, panadería, taquería o cualquier negocio de barrio y no tiene equipo de marketing ni presupuesto para una agencia. Si ya abriste, también sirve: salta el paso del nombre y empieza por Google.",
        outcome: [
          "Tres nombres finalistas con frase de marca y una lista para verificar dominio, Instagram e IMPI.",
          "Tu perfil de Google Business con categorías, descripción y un plan para llegar a 30 reseñas.",
          "Un plan de lanzamiento de 30 días con presupuesto repartido y tres números para revisar cada domingo.",
          "Una mascota con personalidad, reglas de dibujo y prompts para generarla.",
          "El guion de un reel de 30 segundos y la lista de tomas para grabarlo en una hora.",
        ],
        closing:
          "Cuatro de los cinco prompts de este tutorial son gratis: con tu cuenta los abres hoy mismo. El de nombre e identidad verbal es Pro.",
        coverWord: "Abre.",
      },
      en: {
        title: "Open your coffee shop (or neighborhood business) with AI in one afternoon",
        summary:
          "Name, Google profile, 30-day launch plan, mascot and a reel ready to shoot. Five prompts, one afternoon and your own details.",
        audience:
          "For anyone about to open a coffee shop, bakery, taco stand or any neighborhood business with no marketing team and no budget for an agency. Already open? It still works: skip the naming step and start with Google.",
        outcome: [
          "Three finalist names with a tagline and a checklist to verify the domain, Instagram handle and trademark.",
          "Your Google Business profile with categories, description and a plan to reach 30 reviews.",
          "A 30-day launch plan with the budget split and three numbers to check every Sunday.",
          "A mascot with a personality, drawing rules and prompts to generate it.",
          "A 30-second reel script and the shot list to film it in one hour.",
        ],
        closing:
          "Four of the five prompts in this tutorial are free: open them today with your account. The name and verbal identity prompt is Pro.",
        coverWord: "Open.",
      },
    },
    steps: [
      {
        copy: {
          es: {
            title: "Junta tus datos en una sola nota",
            body:
              "Todos los prompts te van a pedir casi lo mismo. Escríbelo una vez y copia de ahí: qué hace distinto a tu negocio en una frase, dos tipos de cliente que quieres atraer, la colonia y quién pasa por ahí, los negocios parecidos de la zona, la fecha de apertura y cuánto puedes gastar en el lanzamiento.",
            tip: "Abre una conversación nueva en Claude o ChatGPT para este proyecto y pega la nota al principio. Así cada respuesta parte del mismo contexto.",
          },
          en: {
            title: "Put your details in a single note",
            body:
              "Every prompt will ask you for almost the same things. Write them once and copy from there: what makes your business different in one sentence, two types of customer you want to attract, the neighborhood and who walks by, similar businesses nearby, the opening date and how much you can spend on the launch.",
            tip: "Open a new conversation in Claude or ChatGPT for this project and paste the note at the top. That way every answer starts from the same context.",
          },
        },
      },
      {
        promptId: "BR-0252",
        copy: {
          es: {
            title: "Encuentra el nombre y la voz",
            body: "Este prompt trabaja como un director de naming: primero abre territorios y luego filtra, en vez de soltarte una lista de ocurrencias.",
            data: [
              "Qué hace distinta a tu cafetería: origen del café, ambiente, comida, horario o tu historia.",
              "Dos tipos de cliente que quieres atraer.",
              "Ciudad y zona.",
              "Cafeterías competidoras cercanas, con nombre.",
              "Lo que no quieres: palabras gastadas, juegos de palabras, otro idioma.",
            ],
            expect:
              "Cuatro territorios de nombre, 15 opciones ya filtradas con la razón de cada descarte, tres finalistas con una frase de marca de máximo seis palabras y cómo sonaría la marca en un pizarrón y en una respuesta a una reseña. Cierra con una lista para verificar dominio, usuario de Instagram, registro ante el IMPI y Google Maps.",
            tip: "Di los tres finalistas en voz alta como si contestaras el teléfono. El que se te traba, fuera. Si ya tienes nombre, usa el prompt solo para la frase y la voz.",
          },
          en: {
            title: "Find the name and the voice",
            body: "This prompt works like a naming director: it opens territories first and then filters, instead of handing you a list of random ideas.",
            data: [
              "What makes your coffee shop different: coffee origin, vibe, food, hours or your story.",
              "Two types of customer you want to attract.",
              "City and area.",
              "Competing coffee shops nearby, by name.",
              "What you do not want: worn-out words, puns, another language.",
            ],
            expect:
              "Four naming territories, 15 options already filtered with the reason for each cut, three finalists with a tagline of six words or fewer, and how the brand would sound on a chalkboard and in a reply to a review. It ends with a checklist for the domain, Instagram handle, trademark registration and Google Maps.",
            tip: "Say the three finalists out loud as if you were answering the phone. The one you stumble on is out. Already have a name? Use the prompt only for the tagline and the voice.",
          },
        },
      },
      {
        promptId: "MK-0256",
        copy: {
          es: {
            title: "Deja listo tu perfil de Google Business",
            body: "La mayoría de la gente de tu zona te va a encontrar en Maps antes que en Instagram. Este paso hace que el perfil trabaje para ti desde el primer día.",
            data: [
              "Nombre del negocio y giro.",
              "Colonia o ciudad.",
              "Lo que escribe la gente cuando busca lo que vendes, con sus palabras.",
              "Cómo está tu perfil hoy: fotos, reseñas, horario, publicaciones (o si aún no existe).",
            ],
            expect:
              "Categoría principal y secundarias con su porqué, la descripción en 750 caracteres, qué fotos subir y en qué orden, un plan para llegar a 30 reseñas en dos meses con el mensaje exacto para pedirlas, cómo contestar una reseña buena y una mala, y cuatro publicaciones para el primer mes.",
            tip: "Escribe lo que busca la gente como lo diría un vecino («café cerca de mí», «desayunos en la Narvarte»), no como está en tu menú.",
          },
          en: {
            title: "Get your Google Business profile ready",
            body: "Most people in your area will find you on Maps before they find you on Instagram. This step makes the profile work for you from day one.",
            data: [
              "Business name and type.",
              "Neighborhood or city.",
              "What people type when they look for what you sell, in their words.",
              "How your profile looks today: photos, reviews, hours, posts (or whether it does not exist yet).",
            ],
            expect:
              "Main and secondary categories with the reasoning, a 750-character description, which photos to upload and in what order, a plan to reach 30 reviews in two months with the exact message to ask for them, how to reply to a good and a bad review, and four posts for the first month.",
            tip: "Write what people search the way a neighbor would say it (\"coffee near me\", \"breakfast in Downtown\"), not the way it reads on your menu.",
          },
        },
      },
      {
        promptId: "MK-0251",
        copy: {
          es: {
            title: "Arma el plan de lanzamiento de 30 días",
            body: "Con nombre y perfil listos, toca ordenar las semanas alrededor de la apertura para que no se te vaya todo el presupuesto en el primer fin de semana.",
            data: [
              "Nombre y concepto en una frase (sale del paso 2).",
              "Colonia o zona y quién pasa por ahí.",
              "Fecha de apertura.",
              "Presupuesto para el lanzamiento.",
              "Redes que ya tienes.",
            ],
            expect:
              "Cuatro semanas: las dos antes de abrir (expectativa en la zona, Google Business, alianzas con tres vecinos), la de apertura (una promoción que no regala el margen y cómo conseguir las primeras 20 reseñas) y las dos siguientes para que quien vino una vez regrese. Cada semana trae acciones con día, qué publicar, cuánto gastar y quién lo hace si trabajas solo. Al final, tres números para revisar cada domingo.",
            tip: "Al terminar, pídele en la misma conversación: «pásalo a una tabla con fecha, acción y responsable». Esa tabla va directo a tu calendario.",
          },
          en: {
            title: "Build the 30-day launch plan",
            body: "With the name and profile ready, it is time to plan the weeks around the opening so the whole budget does not go into the first weekend.",
            data: [
              "Name and concept in one sentence (from step 2).",
              "Neighborhood and who walks by.",
              "Opening date.",
              "Launch budget.",
              "Social accounts you already have.",
            ],
            expect:
              "Four weeks: the two before opening (local buzz, Google Business, partnerships with three neighbors), opening week (a promotion that does not give away your margin and how to get the first 20 reviews) and the next two so first-time visitors come back. Each week comes with dated actions, what to post, how much to spend and who does it if you work alone. At the end, three numbers to check every Sunday.",
            tip: "When it is done, ask in the same conversation: \"turn this into a table with date, action and owner\". That table goes straight into your calendar.",
          },
        },
      },
      {
        promptId: "IL-0252",
        copy: {
          es: {
            title: "Crea una mascota que puedas usar tú solo",
            body: "Una mascota hace que el negocio se recuerde y te da material para redes, empaque y letrero sin llamar a un diseñador cada vez. El prompt te da las reglas y los prompts de imagen; la imagen la generas en Midjourney o en ChatGPT.",
            data: [
              "Negocio y giro.",
              "Quién compra: edad y cómo es.",
              "Personalidad de la marca en tres palabras.",
              "Dónde va a aparecer: redes, empaque, letrero, uniformes.",
            ],
            expect:
              "Tres conceptos de mascota con su riesgo, la ficha del recomendado (nombre, personalidad, cómo habla y tres cosas que nunca haría), reglas de dibujo con formas, colores y cuatro expresiones, cuatro prompts de imagen para distintas poses y diez ideas de uso para el primer mes.",
            tip: "Genera primero la pose de frente. Cuando te guste, súbela como imagen de referencia para las otras tres poses; así la mascota se ve igual en todas.",
          },
          en: {
            title: "Create a mascot you can use on your own",
            body: "A mascot makes the business memorable and gives you material for social media, packaging and signage without calling a designer every time. The prompt gives you the rules and the image prompts; you generate the image in Midjourney or ChatGPT.",
            data: [
              "Business name and type.",
              "Who buys: age and what they are like.",
              "Brand personality in three words.",
              "Where it will appear: social media, packaging, sign, uniforms.",
            ],
            expect:
              "Three mascot concepts with their risk, a sheet for the recommended one (name, personality, how it talks and three things it would never do), drawing rules with shapes, colors and four expressions, four image prompts for different poses and ten ideas to use it in the first month.",
            tip: "Generate the front pose first. Once you like it, upload it as an image reference for the other three poses so the mascot looks the same in all of them.",
          },
        },
      },
      {
        promptId: "VD-0251",
        copy: {
          es: {
            title: "Escribe y graba tu primer reel de 30 segundos",
            body: "El último paso presenta tu negocio a quien todavía no te conoce, con un video que grabas tú con el celular.",
            data: [
              "Negocio: nombre, qué vendes y dónde.",
              "Lo que te hace distinto, en una frase.",
              "Quién quieres que lo vea.",
              "Si sales tú a cámara o solo el producto o el local.",
            ],
            expect:
              "Tres ganchos para los primeros dos segundos (pregunta, visual y dato), el guion en tabla segundo por segundo con lo que se ve, lo que se dice y el texto en pantalla, la lista de tomas para grabar en una hora, el cierre con su llamado a la acción, el copy con hashtags locales y qué cambiar si a la semana tiene menos vistas que tus otros videos.",
            tip: "Graba en el orden de la lista de tomas, no en el del guion. Y pon a tu mascota en el último cuadro: es lo que la gente se va a llevar.",
          },
          en: {
            title: "Write and shoot your first 30-second reel",
            body: "The last step introduces your business to people who do not know you yet, with a video you shoot yourself on your phone.",
            data: [
              "Business: name, what you sell and where.",
              "What makes you different, in one sentence.",
              "Who you want to see it.",
              "Whether you appear on camera or only the product or the place.",
            ],
            expect:
              "Three hooks for the first two seconds (question, visual and fact), the script as a second-by-second table with what is seen, what is said and the on-screen text, the shot list to film in one hour, the ending with its call to action, the caption with local hashtags and what to change if after a week it has fewer views than your other videos.",
            tip: "Shoot in the order of the shot list, not the script. And put your mascot in the last frame: it is what people will remember.",
          },
        },
      },
    ],
  },
  {
    code: "T02",
    slug: "cotiza-cierra-y-arranca-un-proyecto",
    publishedAt: "2026-11-05",
    tools: ["claude", "chatgpt", "notion"],
    level: "intermediate",
    readingMinutes: 9,
    category: "creative_productivity",
    copy: {
      es: {
        title: "Cotiza, cierra y arranca un proyecto en tu agencia chica",
        summary:
          "Del correo del cliente al proyecto andando: cotización en tres niveles, propuesta de una página, onboarding de dos semanas, portal de cliente y qué contestar cuando piden algo fuera de alcance.",
        audience:
          "Para agencias creativas de una a diez personas y freelancers que ya tienen clientes, pero pierden tiempo o dinero entre el primer correo y el arranque: cotizaciones que no se cierran, propuestas que nadie lee y proyectos que empiezan sin accesos ni brief.",
        outcome: [
          "Una cotización en tres niveles con tabla comparativa, condiciones y el correo para mandarla.",
          "Una propuesta de una página, su correo de envío y las respuestas a tres preguntas que te van a hacer.",
          "El plan de las dos primeras semanas con el cliente: correo de bienvenida, cuestionario de 12 preguntas y agenda del kickoff.",
          "Un portal de cliente sencillo en la herramienta que ya usas.",
          "Respuestas listas para cambios fuera de alcance, una orden de cambio y una cláusula para tus contratos.",
        ],
        closing:
          "Los cinco prompts de este tutorial son Pro. Con una sola cotización que cierres en la opción de en medio, la suscripción se paga sola.",
        coverWord: "Cierra.",
      },
      en: {
        title: "Quote, close and kick off a project at your small agency",
        summary:
          "From the client's email to a running project: a three-tier quote, a one-page proposal, two-week onboarding, a client portal and what to say when they ask for something out of scope.",
        audience:
          "For creative agencies of one to ten people and freelancers who already have clients but lose time or money between the first email and the kickoff: quotes that do not close, proposals nobody reads and projects that start without access or a brief.",
        outcome: [
          "A three-tier quote with a comparison table, terms and the email to send it.",
          "A one-page proposal, its cover email and answers to three questions you will be asked.",
          "The plan for the first two weeks with the client: welcome email, 12-question questionnaire and kickoff agenda.",
          "A simple client portal in the tool you already use.",
          "Ready-to-send replies for out-of-scope requests, a change order and a clause for your contracts.",
        ],
        closing:
          "All five prompts in this tutorial are Pro. Close a single quote on the middle option and the subscription pays for itself.",
        coverWord: "Close.",
      },
    },
    steps: [
      {
        copy: {
          es: {
            title: "Ten a la mano tus números y el pedido del cliente",
            body:
              "Antes de abrir el primer prompt, junta tres cosas: el correo o mensaje con el que el cliente pidió el trabajo, tus horas estimadas y tu costo por hora. Sin esos números, cualquier cotización es una adivinanza.",
            tip: "Si no sabes tu costo por hora, divide tus gastos del mes (incluido tu sueldo) entre las horas que de verdad facturas, no entre las que trabajas.",
          },
          en: {
            title: "Have your numbers and the client's request at hand",
            body:
              "Before opening the first prompt, gather three things: the email or message where the client asked for the work, your estimated hours and your hourly cost. Without those numbers, any quote is a guess.",
            tip: "If you do not know your hourly cost, divide your monthly expenses (your salary included) by the hours you actually bill, not the hours you work.",
          },
        },
      },
      {
        promptId: "CP-0251",
        copy: {
          es: {
            title: "Cotiza en tres niveles",
            body: "Un solo precio obliga al cliente a decir sí o no. Tres opciones lo ponen a elegir cuál, y la de en medio es la que quieres vender.",
            data: [
              "Cliente y qué pidió.",
              "Lo que crees que de verdad necesita.",
              "Tus horas estimadas y tu costo por hora.",
              "Presupuesto que mencionó el cliente, si lo dijo.",
              "Fecha en que lo necesita.",
            ],
            expect:
              "Tres opciones con nombre propio, cada una con alcance, lo que no incluye, rondas de cambios, plazo, precio y la lógica de ese precio. Una tabla comparativa de una sola vista, condiciones (anticipo, forma de pago, cambios fuera de alcance y vigencia) y el correo para mandarla en menos de 150 palabras.",
            tip: "Si el prompt te dice que tus números no dan, hazle caso: recorta alcance antes que precio.",
          },
          en: {
            title: "Quote in three tiers",
            body: "A single price forces the client to say yes or no. Three options get them choosing which one, and the middle one is the one you want to sell.",
            data: [
              "Client and what they asked for.",
              "What you think they really need.",
              "Your estimated hours and hourly cost.",
              "Budget the client mentioned, if any.",
              "Date they need it by.",
            ],
            expect:
              "Three named options, each with scope, what is not included, rounds of changes, timeline, price and the logic behind that price. A one-glance comparison table, terms (deposit, payment, out-of-scope changes and validity) and the email to send it in under 150 words.",
            tip: "If the prompt says your numbers do not add up, listen: cut scope before you cut price.",
          },
        },
      },
      {
        promptId: "CW-0255",
        copy: {
          es: {
            title: "Convierte la opción recomendada en una propuesta de una página",
            body: "Las propuestas largas no se leen. Esta cabe en una página y pone al cliente a decidir con fecha.",
            data: [
              "Cliente y su negocio.",
              "Lo que te pidió, con sus palabras.",
              "Lo que crees que de verdad necesita.",
              "Lo que propones: usa el alcance, entregables y plazo de la opción de en medio del paso 2.",
              "Inversión.",
            ],
            expect:
              "La propuesta en seis bloques: lo que entendimos, lo que vamos a lograr, cómo lo hacemos en tres o cuatro etapas con fecha, lo que incluye y no incluye en dos columnas, inversión y forma de pago, y el siguiente paso con fecha límite. Después, el correo de envío en menos de 120 palabras y tres preguntas que probablemente hará el cliente, con su respuesta.",
            tip: "Copia las palabras exactas del cliente en «lo que me pidió». El primer bloque funciona cuando el cliente se reconoce en él.",
          },
          en: {
            title: "Turn the recommended option into a one-page proposal",
            body: "Long proposals do not get read. This one fits on a page and gets the client deciding by a date.",
            data: [
              "Client and their business.",
              "What they asked for, in their words.",
              "What you think they really need.",
              "What you propose: use the scope, deliverables and timeline of the middle option from step 2.",
              "Investment.",
            ],
            expect:
              "The proposal in six blocks: what we understood, what we will achieve, how we do it in three or four dated stages, what is and is not included in two columns, investment and payment, and the next step with a decision deadline. Then the cover email in under 120 words and three questions the client will probably ask, with answers.",
            tip: "Paste the client's exact words into \"what they asked for\". The first block works when the client recognizes themselves in it.",
          },
        },
      },
      {
        promptId: "CP-0252",
        copy: {
          es: {
            title: "Diseña las dos primeras semanas con el cliente",
            body: "Firmaron. Lo que pase en los primeros diez días hábiles define si el proyecto corre o se atora esperando accesos y respuestas.",
            data: [
              "Tipo de proyectos que hacen: branding, redes, sitio web, campañas.",
              "Herramientas que usan: Notion, Slack, WhatsApp, Drive, Figma.",
              "Quién participa de tu lado.",
              "Problemas que han tenido al arrancar: accesos tarde, brief incompleto, cliente que no responde.",
            ],
            expect:
              "Un plan día por día de diez días hábiles con responsable y entregable, el correo de bienvenida, un cuestionario de 12 preguntas para antes del kickoff, la agenda de la junta de arranque de 60 minutos, la lista de accesos y materiales por tipo de proyecto y cómo cerrar la segunda semana con un resumen al cliente.",
            tip: "Guárdalo como plantilla en Notion o Drive. Con el siguiente cliente solo cambias nombres y fechas.",
          },
          en: {
            title: "Design the first two weeks with the client",
            body: "They signed. What happens in the first ten business days decides whether the project runs or stalls waiting for access and answers.",
            data: [
              "Type of projects you do: branding, social media, website, campaigns.",
              "Tools you use: Notion, Slack, WhatsApp, Drive, Figma.",
              "Who is involved on your side.",
              "Problems you have had at kickoff: late access, incomplete brief, unresponsive client.",
            ],
            expect:
              "A day-by-day plan for ten business days with owner and deliverable, the welcome email, a 12-question questionnaire for before the kickoff, the agenda for a 60-minute kickoff meeting, the access and materials checklist by project type and how to close week two with a summary to the client.",
            tip: "Save it as a template in Notion or Drive. With the next client you only change names and dates.",
          },
        },
      },
      {
        promptId: "UX-0255",
        copy: {
          es: {
            title: "Arma un portal de cliente sin programar",
            body: "Si tus clientes te preguntan por correo en qué va el proyecto y dónde están los archivos, un portal sencillo te devuelve horas cada semana.",
            data: [
              "Tipo de proyectos: branding, web, contenido mensual.",
              "Cuántos clientes activos tienes.",
              "Herramientas que ya usas: Notion, Google Drive, Trello, ClickUp.",
              "Lo que más te preguntan: estado, fechas, archivos, facturas, cambios.",
            ],
            expect:
              "Máximo cinco pantallas y qué contesta cada una, lo que ve el cliente al entrar, cómo se pide un cambio o se aprueba una entrega paso a paso, la estructura exacta en tu herramienta (bases, vistas y permisos), el mensaje para presentarle el portal al cliente y lo que tienes que actualizar cada semana.",
            tip: "Estrénalo con el cliente que más correos te manda. Si funciona con ese, funciona con todos.",
          },
          en: {
            title: "Build a client portal without coding",
            body: "If clients email you to ask how the project is going and where the files are, a simple portal gives you hours back every week.",
            data: [
              "Type of projects: branding, web, monthly content.",
              "How many active clients you have.",
              "Tools you already use: Notion, Google Drive, Trello, ClickUp.",
              "What they ask most: status, dates, files, invoices, changes.",
            ],
            expect:
              "Five screens at most and what each one answers, what the client sees on arrival, how to request a change or approve a delivery step by step, the exact structure in your tool (databases, views and permissions), the message to introduce the portal to the client and what you need to update every week.",
            tip: "Launch it with the client who emails you the most. If it works with that one, it works with everyone.",
          },
        },
      },
      {
        promptId: "CP-0253",
        copy: {
          es: {
            title: "Cuando pidan algo fuera de alcance, responde sin perder al cliente",
            body: "Va a pasar. Tener la respuesta preparada evita que lo regales por pena o que lo cobres de mala manera.",
            data: [
              "Lo que se acordó: pega el alcance de la propuesta del paso 3.",
              "Lo que te piden ahora.",
              "Cómo lo pidieron y qué tan urgente lo ven.",
              "Tu relación con el cliente: nuevo, recurrente, importante.",
              "Cuánto trabajo extra implica.",
            ],
            expect:
              "Un diagnóstico de si de verdad está fuera de alcance o es zona gris, tres formas de responder (cobrarlo, cambiarlo por algo del alcance o hacerlo como excepción) con correo y versión corta para WhatsApp, una plantilla de orden de cambio de una página y una cláusula de alcance para tus siguientes contratos.",
            tip: "Pega esa cláusula en la próxima cotización del paso 2. Así el siguiente cambio ya viene previsto desde el principio.",
          },
          en: {
            title: "When they ask for something out of scope, reply without losing the client",
            body: "It will happen. Having the reply ready keeps you from giving it away out of awkwardness or charging for it the wrong way.",
            data: [
              "What was agreed: paste the scope from the step 3 proposal.",
              "What they are asking for now.",
              "How they asked and how urgent they think it is.",
              "Your relationship with the client: new, recurring, important.",
              "How much extra work it means.",
            ],
            expect:
              "A diagnosis of whether it is truly out of scope or a gray area, three ways to reply (charge it, swap it for something in scope or do it as a one-time exception) with an email and a short WhatsApp version, a one-page change order template and a scope clause for your next contracts.",
            tip: "Paste that clause into your next quote from step 2. That way the next change is covered from the start.",
          },
        },
      },
    ],
  },
  {
    code: "T03",
    slug: "tu-marca-personal-en-un-fin-de-semana",
    publishedAt: "2026-11-05",
    tools: ["claude", "chatgpt", "midjourney", "canva"],
    level: "beginner",
    readingMinutes: 8,
    category: "branding",
    copy: {
      es: {
        title: "Tu marca personal en un fin de semana",
        summary:
          "Identidad visual mínima, bio en tres largos, un mes de contenido, tu primer carrusel ilustrado y mensajes de LinkedIn que sí contestan. Sábado y domingo, cinco prompts.",
        audience:
          "Para freelancers, consultores y creativos independientes que venden servicios y necesitan verse y sonar profesionales sin contratar un proyecto de identidad. Ideal si tu perfil de LinkedIn todavía dice lo que hacías hace dos trabajos.",
        outcome: [
          "Una identidad visual mínima: paleta en HEX, dos tipografías gratuitas, estilo de foto y una mini guía de una página.",
          "Tu bio en una línea, 80 y 200 palabras, más un titular para LinkedIn.",
          "Un calendario de cuatro semanas con tres publicaciones por semana que produces en tres horas.",
          "Un carrusel ilustrado de ocho láminas listo para armar en Canva.",
          "Cuatro mensajes de prospección por LinkedIn y una hoja para darles seguimiento.",
        ],
        closing:
          "El calendario de contenido es gratis; los otros cuatro prompts son Pro. Si vendes servicios, un solo cliente que llegue por LinkedIn cubre muchos meses de suscripción.",
        coverWord: "Preséntate.",
      },
      en: {
        title: "Your personal brand in one weekend",
        summary:
          "A minimum visual identity, a bio in three lengths, a month of content, your first illustrated carousel and LinkedIn messages that get replies. Saturday and Sunday, five prompts.",
        audience:
          "For freelancers, consultants and independent creatives who sell services and need to look and sound professional without hiring a full identity project. Ideal if your LinkedIn profile still says what you did two jobs ago.",
        outcome: [
          "A minimum visual identity: HEX palette, two free typefaces, photo style and a one-page mini guide.",
          "Your bio in one line, 80 and 200 words, plus a LinkedIn headline.",
          "A four-week calendar with three posts a week you produce in three hours.",
          "An eight-slide illustrated carousel ready to put together in Canva.",
          "Four LinkedIn prospecting messages and a sheet to track them.",
        ],
        closing:
          "The content calendar is free; the other four prompts are Pro. If you sell services, one client who arrives through LinkedIn covers many months of subscription.",
        coverWord: "Show up.",
      },
    },
    steps: [
      {
        promptId: "BR-0254",
        copy: {
          es: {
            title: "Sábado en la mañana: tu identidad visual mínima",
            body: "No necesitas un logo complejo. Necesitas que todo lo que publiques se vea de la misma persona, y una guía corta para aplicarlo tú.",
            data: [
              "A qué te dedicas y a quién le vendes.",
              "Tres palabras que quieres que la gente piense de ti.",
              "Marcas o personas cuyo estilo admiras, y por qué.",
              "Dónde se va a ver: LinkedIn, Instagram, propuestas en PDF, sitio web.",
              "Lo que ya tienes: foto, logo, colores o nada.",
            ],
            expect:
              "Tus tres palabras traducidas a decisiones visuales, dos direcciones distintas (paleta de cuatro colores en HEX, dos tipografías gratuitas de Google Fonts, estilo de foto y un elemento gráfico), una recomendación, una mini guía de una página con tres reglas y tres errores a evitar, y tres prompts para generar referencias de publicaciones.",
            tip: "Elige palabras que usaría un cliente para recomendarte («clara», «puntual»), no las que pondrías en tu portafolio.",
          },
          en: {
            title: "Saturday morning: your minimum visual identity",
            body: "You do not need a complex logo. You need everything you post to look like it comes from the same person, and a short guide to apply it yourself.",
            data: [
              "What you do and who you sell to.",
              "Three words you want people to think about you.",
              "Brands or people whose style you admire, and why.",
              "Where it will be seen: LinkedIn, Instagram, PDF proposals, website.",
              "What you already have: photo, logo, colors or nothing.",
            ],
            expect:
              "Your three words translated into visual decisions, two distinct directions (a four-color HEX palette, two free Google Fonts, photo style and a graphic element), a recommendation, a one-page mini guide with three rules and three mistakes to avoid, and three prompts to generate post references.",
            tip: "Pick words a client would use to recommend you (\"clear\", \"on time\"), not the ones you would put in your portfolio.",
          },
        },
      },
      {
        promptId: "CW-0254",
        copy: {
          es: {
            title: "Sábado en la tarde: tu bio en tres largos",
            body: "La misma historia, contada a la medida de cada lugar: perfil, sitio, propuesta o presentación en un evento.",
            data: [
              "Qué haces y para quién.",
              "Resultado que logras para tus clientes, con un número si lo tienes.",
              "Trayectoria relevante: años, empresas, proyectos, clientes conocidos.",
              "Algo personal que te hace distinto.",
              "Dónde la vas a usar.",
              "Tres adjetivos de tu forma de hablar.",
            ],
            expect:
              "Una línea de máximo 20 palabras, una bio de 80 palabras y otra de 200 con una pequeña historia, cada una en primera y en tercera persona. Además, un titular para LinkedIn de máximo 120 caracteres y una frase para presentarte al inicio de una propuesta.",
            tip: "Cambia tu titular de LinkedIn y tu bio de Instagram ese mismo día. Lo que se queda en un documento no trabaja.",
          },
          en: {
            title: "Saturday afternoon: your bio in three lengths",
            body: "The same story, cut to fit each place: profile, website, proposal or an introduction at an event.",
            data: [
              "What you do and for whom.",
              "A result you get for your clients, with a number if you have one.",
              "Relevant track record: years, companies, projects, known clients.",
              "Something personal that sets you apart.",
              "Where you will use it.",
              "Three adjectives for the way you talk.",
            ],
            expect:
              "A line of 20 words or fewer, an 80-word bio and a 200-word one with a short story, each in first and third person. Plus a LinkedIn headline of up to 120 characters and a line to introduce yourself at the start of a proposal.",
            tip: "Update your LinkedIn headline and Instagram bio that same day. Whatever stays in a document does no work.",
          },
        },
      },
      {
        promptId: "MK-0253",
        copy: {
          es: {
            title: "Domingo en la mañana: un mes de contenido que sí puedes cumplir",
            body: "Nada de publicar diario. Tres publicaciones por semana, producidas en una sola sentada de tres horas.",
            data: [
              "Qué servicio das y a quién.",
              "Tu red principal: Instagram, LinkedIn o TikTok.",
              "El formato que te sale más fácil: texto, carrusel, video hablando o fotos.",
              "Qué quieres que pase con el contenido: que te escriban, que agenden, que compren.",
            ],
            expect:
              "Cuatro pilares de contenido con su objetivo y porcentaje, un calendario de cuatro semanas con tres publicaciones por semana (día, pilar, formato, gancho de la primera línea y la idea), una pieza semanal que lleve a tu llamado a la acción, la rutina de tres horas por bloques y cómo reutilizar cada pieza en otro formato.",
            tip: "Aparta el bloque de tres horas en tu calendario como si fuera una junta con un cliente. Si no tiene hora, no pasa.",
          },
          en: {
            title: "Sunday morning: a month of content you can actually keep up with",
            body: "No posting every day. Three posts a week, produced in a single three-hour sitting.",
            data: [
              "What service you offer and to whom.",
              "Your main network: Instagram, LinkedIn or TikTok.",
              "The format that comes easiest: text, carousel, talking video or photos.",
              "What you want the content to do: get messages, bookings or sales.",
            ],
            expect:
              "Four content pillars with their goal and share, a four-week calendar with three posts a week (day, pillar, format, first-line hook and the idea), one weekly piece that leads to your call to action, the three-hour routine in blocks and how to reuse each piece in another format.",
            tip: "Block the three hours in your calendar as if it were a client meeting. If it has no time slot, it does not happen.",
          },
        },
      },
      {
        promptId: "IL-0253",
        copy: {
          es: {
            title: "Domingo a mediodía: tu primer carrusel ilustrado",
            body: "Un carrusel que explica algo de tu especialidad es lo que la gente guarda y comparte. Este prompt te da el texto, las ideas visuales y los prompts de imagen con un mismo estilo.",
            data: [
              "Tu servicio: qué haces y para quién.",
              "El tema: la pregunta que más te hacen tus clientes.",
              "Tus colores y tipografías: pega la mini guía del paso 1.",
              "La herramienta de imagen que usas: Midjourney, ChatGPT, Ideogram o Canva.",
            ],
            expect:
              "La estructura en ocho láminas (gancho, problema, cinco pasos o ideas y cierre), el texto de cada lámina en máximo 20 palabras, una idea visual por lámina, un bloque de estilo fijo con un prompt por lámina, cómo armarlo en Canva o Figma con retícula y tamaño de letra mínimo para celular, y el copy con tres variantes del gancho.",
            tip: "Este carrusel es la primera publicación del calendario del paso 3. Ya tienes la semana uno resuelta.",
          },
          en: {
            title: "Sunday noon: your first illustrated carousel",
            body: "A carousel that explains something from your specialty is what people save and share. This prompt gives you the copy, the visual ideas and image prompts in one consistent style.",
            data: [
              "Your service: what you do and for whom.",
              "The topic: the question your clients ask you most.",
              "Your colors and typefaces: paste the mini guide from step 1.",
              "The image tool you use: Midjourney, ChatGPT, Ideogram or Canva.",
            ],
            expect:
              "An eight-slide structure (hook, problem, five steps or ideas and close), the copy for each slide in 20 words or fewer, one visual idea per slide, a fixed style block with one prompt per slide, how to lay it out in Canva or Figma with a grid and the minimum font size for phones, and the caption with three hook variants.",
            tip: "This carousel is the first post in the calendar from step 3. Week one is already done.",
          },
        },
      },
      {
        promptId: "CW-0256",
        copy: {
          es: {
            title: "Domingo en la tarde: mensajes de LinkedIn que sí contestan",
            body: "Con perfil, bio y contenido listos, ya puedes escribirle a posibles clientes sin que tu perfil te deje mal.",
            data: [
              "Lo que vendes: servicio y resultado.",
              "A quién le escribes: puesto, industria y tamaño de empresa.",
              "Por qué a esa persona y ahora: algo que publicó, una vacante, un lanzamiento.",
              "La prueba que tienes: un caso, un número, un cliente parecido.",
            ],
            expect:
              "La solicitud de conexión en máximo 200 caracteres sin vender, el primer mensaje de máximo 60 palabras que termina en una pregunta fácil, un seguimiento a los cinco días con algo útil, un mensaje para cerrar el tema con buena relación, frases a evitar, cuántos mensajes mandar al día y cómo llevar el registro en una hoja.",
            tip: "El «por qué ahora» se cambia para cada persona: es la línea que hace que contesten. Manda los primeros cinco el lunes.",
          },
          en: {
            title: "Sunday afternoon: LinkedIn messages that get replies",
            body: "With your profile, bio and content ready, you can write to potential clients without your profile letting you down.",
            data: [
              "What you sell: service and result.",
              "Who you are writing to: role, industry and company size.",
              "Why that person and why now: something they posted, a job opening, a launch.",
              "The proof you have: a case, a number, a similar client.",
            ],
            expect:
              "A connection request of up to 200 characters with no pitch, a first message of up to 60 words that ends in an easy question, a five-day follow-up with something useful, a message to close the thread on good terms, phrases to avoid, how many messages to send a day and how to keep track in a sheet.",
            tip: "Rewrite the \"why now\" for each person: it is the line that gets replies. Send the first five on Monday.",
          },
        },
      },
    ],
  },
];
