# Agente de Instagram de Pipe Games

Responde los mensajes directos de @pipe_games_ con Claude, usando el catálogo con stock en vivo (`catalogo-meta.csv`).

- Código del Worker de Cloudflare: `worker.js` (las variables necesarias están al inicio del archivo).
- Webhook para Meta: `https://<tu-worker>.workers.dev/webhook`
- Revisión rápida: `https://<tu-worker>.workers.dev/salud`
- Política de privacidad para la app de Meta: https://pipegames.com.co/privacidad.html

Comportamiento:
- Si Felipe responde a mano en un chat, el agente se calla en ese chat 12 horas (`HORAS_PAUSA`).
- Si el cliente quiere pagar, separar, reclamar o hablar con una persona, el agente avisa que Felipe responde y se calla en ese chat 12 horas.
- Para apagarlo sin borrar nada: variable `AGENTE_ACTIVO` = `no`.
- Fotos, audios e historias no se responden solos: quedan para Felipe.
