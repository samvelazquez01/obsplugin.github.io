import express from "express"
import { WebSocketServer } from "ws"
import chokidar from "chokidar"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import cors from "cors"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = 3000

app.use(cors())
app.use(express.json())
app.use(express.static(__dirname))

// Configuración de la carpeta de clips
let config = {
  clipsFolder: "",
}

// Cargar configuración si existe
const configPath = path.join(__dirname, "config.json")
if (fs.existsSync(configPath)) {
  config = JSON.parse(fs.readFileSync(configPath, "utf-8"))
}

// Estado de los clips
let clips = []
let watcher = null

// Extensiones de video soportadas
const videoExtensions = [".mp4", ".mkv", ".avi", ".mov", ".flv", ".wmv", ".webm", ".m4v"]

// Función para verificar si es un archivo de video
function isVideoFile(filename) {
  return videoExtensions.some((ext) => filename.toLowerCase().endsWith(ext))
}

// Función para escanear la carpeta de clips
function scanClipsFolder() {
  if (!config.clipsFolder || !fs.existsSync(config.clipsFolder)) {
    clips = []
    return
  }

  try {
    const files = fs.readdirSync(config.clipsFolder)
    clips = files
      .filter((file) => isVideoFile(file))
      .map((file) => {
        const filePath = path.join(config.clipsFolder, file)
        const stats = fs.statSync(filePath)
        return {
          name: file,
          path: filePath,
          size: stats.size,
          modified: stats.mtimeMs,
        }
      })
      .sort((a, b) => b.modified - a.modified)

    console.log(`[v0] Clips encontrados: ${clips.length}`)
    broadcastClipsUpdate()
  } catch (error) {
    console.error("[v0] Error al escanear carpeta:", error)
    clips = []
  }
}

// Configurar watcher para monitorear cambios en la carpeta
function setupWatcher() {
  if (watcher) {
    watcher.close()
  }

  if (!config.clipsFolder || !fs.existsSync(config.clipsFolder)) {
    return
  }

  watcher = chokidar.watch(config.clipsFolder, {
    ignored: /(^|[/\\])\../,
    persistent: true,
    ignoreInitial: true,
  })

  watcher
    .on("add", () => {
      console.log("[v0] Nuevo archivo detectado")
      scanClipsFolder()
    })
    .on("unlink", () => {
      console.log("[v0] Archivo eliminado")
      scanClipsFolder()
    })

  console.log("[v0] Watcher configurado para:", config.clipsFolder)
}

// WebSocket Server
const wss = new WebSocketServer({ noServer: true })

wss.on("connection", (ws) => {
  console.log("[v0] Cliente WebSocket conectado")

  // Enviar clips actuales al conectar
  ws.send(
    JSON.stringify({
      type: "clips",
      data: clips,
    }),
  )

  ws.on("close", () => {
    console.log("[v0] Cliente WebSocket desconectado")
  })
})

// Función para enviar actualizaciones a todos los clientes
function broadcastClipsUpdate() {
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      // OPEN
      client.send(
        JSON.stringify({
          type: "clips",
          data: clips,
        }),
      )
    }
  })
}

// API Endpoints

// Obtener configuración actual
app.get("/api/config", (req, res) => {
  res.json(config)
})

// Configurar carpeta de clips
app.post("/api/config", (req, res) => {
  const { clipsFolder } = req.body

  if (!clipsFolder) {
    return res.status(400).json({ error: "Se requiere la ruta de la carpeta" })
  }

  if (!fs.existsSync(clipsFolder)) {
    return res.status(400).json({ error: "La carpeta no existe" })
  }

  config.clipsFolder = clipsFolder
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2))

  setupWatcher()
  scanClipsFolder()

  res.json({ success: true, config })
})

// Obtener lista de clips
app.get("/api/clips", (req, res) => {
  res.json(clips)
})

// Refrescar clips manualmente
app.post("/api/refresh", (req, res) => {
  scanClipsFolder()
  res.json({ success: true, clips })
})

// Servidor HTTP
const server = app.listen(PORT, () => {
  console.log(`[v0] Servidor corriendo en http://localhost:${PORT}`)
  console.log(`[v0] Carpeta de clips: ${config.clipsFolder || "No configurada"}`)

  if (config.clipsFolder) {
    setupWatcher()
    scanClipsFolder()
  }
})

// Upgrade HTTP a WebSocket
server.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request)
  })
})
