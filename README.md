# OBS Replay Manager

Aplicación web para gestionar y reproducir clips de OBS mediante WebSocket.

## Características

- Monitoreo automático de carpeta de clips
- Detección en tiempo real de nuevos clips
- Conexión con OBS via WebSocket
- Envío de clips al preview de OBS
- Interfaz ligera sin carga de videos

## Instalación

1. Instalar dependencias:
\`\`\`bash
npm install
\`\`\`

2. Iniciar el servidor:
\`\`\`bash
npm start
\`\`\`

3. Abrir en el navegador:
\`\`\`
http://localhost:3000
\`\`\`

## Configuración

### 1. Configurar carpeta de clips

En la interfaz web, ingresa la ruta completa donde OBS guarda los clips:
- Windows: `C:\Videos\OBS\Replays`
- Mac/Linux: `/Users/tu-usuario/Videos/OBS/Replays`

### 2. Conectar con OBS

1. Asegúrate de tener **obs-websocket** instalado en OBS
2. En OBS, ve a: Herramientas → WebSocket Server Settings
3. Anota la dirección y contraseña (si la hay)
4. En la web, ingresa la dirección (ej: `ws://localhost:4455`)
5. Haz clic en "Conectar a OBS"

### 3. Usar replays

- Los clips se actualizan automáticamente cuando se agregan nuevos
- El último clip siempre aparece primero
- Haz clic en "Reproducir en OBS" para enviar el clip al preview

## Requisitos

- Node.js 16 o superior
- OBS Studio con obs-websocket
- Navegador moderno (Chrome, Edge, Firefox)

## Notas

- El servidor debe estar corriendo para que funcione la aplicación
- La carpeta de clips debe existir y ser accesible
- Los clips no se cargan en la web, solo se envían las rutas a OBS
