// Estado de la aplicación
const state = {
  clips: [],
  obsManager: null,
  folderHandle: null,
  selectedFolderPath: "",
}

// Elementos del DOM
const elements = {
  folderInput: document.getElementById("folderInput"),
  selectFolderBtn: document.getElementById("selectFolderBtn"),
  folderPath: document.getElementById("folderPath"),
  connectBtn: document.getElementById("connectBtn"),
  obsAddress: document.getElementById("obsAddress"),
  obsPassword: document.getElementById("obsPassword"),
  connectionStatus: document.getElementById("connectionStatus"),
  clipsList: document.getElementById("clipsList"),
  clipCount: document.getElementById("clipCount"),
  refreshBtn: document.getElementById("refreshBtn"),
  autoRefresh: document.getElementById("autoRefresh"),
}

// Inicialización
document.addEventListener("DOMContentLoaded", async () => {
  elements.selectFolderBtn.addEventListener("click", () => {
    elements.folderInput.click()
  })

  elements.folderInput.addEventListener("change", (event) => {
    handleFolderSelection(event)
  })

  elements.connectBtn.addEventListener("click", connectToOBS)
  elements.refreshBtn.addEventListener("click", refreshClips)

  state.obsManager = new OBSWebSocketManager()
})

async function handleFolderSelection(event) {
  const files = Array.from(event.target.files)

  if (files.length === 0) {
    return
  }

  // Obtener la ruta de la carpeta del primer archivo
  const firstFile = files[0]
  const folderPath = firstFile.webkitRelativePath.split("/")[0]

  // Filtrar solo archivos de video
  const videoExtensions = [".mp4", ".mkv", ".avi", ".mov", ".flv", ".wmv", ".webm", ".m4v"]
  const videoFiles = files.filter((file) => {
    const ext = "." + file.name.split(".").pop().toLowerCase()
    return videoExtensions.includes(ext)
  })

  if (videoFiles.length === 0) {
    alert("No se encontraron archivos de video en esta carpeta")
    return
  }

  // Convertir archivos a formato de clips
  state.clips = await Promise.all(
    videoFiles.map(async (file) => {
      return {
        name: file.name,
        path: file.webkitRelativePath,
        size: file.size,
        modified: file.lastModified,
        file: file,
      }
    }),
  )

  // Ordenar por fecha de modificación (más reciente primero)
  state.clips.sort((a, b) => b.modified - a.modified)

  // Actualizar UI
  elements.folderPath.textContent = folderPath
  state.selectedFolderPath = folderPath

  // Enviar configuración al servidor
  try {
    await fetch("http://localhost:3000/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clipsFolder: firstFile.path || folderPath,
        clipsList: state.clips.map((c) => ({ name: c.name, path: c.path, size: c.size, modified: c.modified })),
      }),
    })
  } catch (error) {
    console.error("Error al enviar configuración al servidor:", error)
  }

  renderClips()
}

function renderClips() {
  elements.clipCount.textContent = `(${state.clips.length})`

  if (state.clips.length === 0) {
    elements.clipsList.innerHTML = `
      <div class="empty-state">
        <p>No se encontraron clips de video en esta carpeta</p>
      </div>
    `
    return
  }

  elements.clipsList.innerHTML = state.clips
    .map(
      (clip, index) => `
      <div class="clip-card ${index === 0 ? "latest" : ""}" data-index="${index}">
        <div class="clip-preview">
          <div class="clip-icon">🎬</div>
          <div class="clip-format">${getFileExtension(clip.name).toUpperCase()}</div>
        </div>
        <div class="clip-info">
          <div class="clip-name" title="${clip.name}">${clip.name}</div>
          <div class="clip-meta">
            <span>${formatFileSize(clip.size)}</span>
            <span>${formatDate(clip.modified)}</span>
          </div>
          <div class="clip-actions">
            <button class="btn-preview" onclick="sendToOBSPreview(${index})" ${!state.obsManager?.connected ? "disabled" : ""}>
              Reproducir en OBS
            </button>
          </div>
        </div>
      </div>
    `,
    )
    .join("")
}

async function sendToOBSPreview(index) {
  const clip = state.clips[index]

  if (!state.obsManager?.connected) {
    alert("No estás conectado a OBS")
    return
  }

  try {
    await state.obsManager.setSourceInPreview(clip.path)
    alert(`Clip enviado a OBS: ${clip.name}`)
  } catch (error) {
    console.error("Error al enviar a OBS:", error)
    alert("Error al enviar clip a OBS: " + error.message)
  }
}

async function connectToOBS() {
  const address = elements.obsAddress.value
  const password = elements.obsPassword.value

  if (!address) {
    alert("Ingresa la dirección del WebSocket de OBS")
    return
  }

  elements.connectBtn.disabled = true
  elements.connectBtn.textContent = "Conectando..."

  try {
    await state.obsManager.connect(address, password)
    updateConnectionStatus(true)
    alert("Conectado a OBS exitosamente")
    renderClips()
  } catch (error) {
    console.error("Error de conexión:", error)
    alert("Error al conectar con OBS:\n" + error.message)
    updateConnectionStatus(false)
  } finally {
    elements.connectBtn.disabled = false
    elements.connectBtn.textContent = "Conectar a OBS"
  }
}

function updateConnectionStatus(connected) {
  const statusDot = elements.connectionStatus.querySelector(".status-dot")
  const statusText = elements.connectionStatus.querySelector("span:last-child")

  if (connected) {
    statusDot.classList.remove("disconnected")
    statusDot.classList.add("connected")
    statusText.textContent = "Conectado a OBS"
  } else {
    statusDot.classList.remove("connected")
    statusDot.classList.add("disconnected")
    statusText.textContent = "Desconectado de OBS"
  }
}

function getFileExtension(filename) {
  return filename.split(".").pop() || ""
}

function formatFileSize(bytes) {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i]
}

function formatDate(timestamp) {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now - date

  if (diff < 60000) return "Hace un momento"
  if (diff < 3600000) return `Hace ${Math.floor(diff / 60000)} min`
  if (diff < 86400000) return `Hace ${Math.floor(diff / 3600000)} h`

  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

async function refreshClips() {
  elements.folderInput.click()
}
