class OBSWebSocketManager {
  constructor() {
    this.ws = null
    this.connected = false
    this.messageId = 1
    this.callbacks = new Map()
    this.eventHandlers = new Map()
  }

  async connect(address, password = "") {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(address)

        this.ws.onopen = async () => {
          console.log("WebSocket conectado")
        }

        this.ws.onmessage = async (event) => {
          const data = JSON.parse(event.data)

          // Manejo de identificación (OBS WebSocket 5.x)
          if (data.op === 0) {
            // Hello
            const authRequired = data.d.authentication

            if (authRequired && password) {
              // Implementar autenticación si es necesario
              const authResponse = {
                op: 1,
                d: {
                  rpcVersion: 1,
                  authentication: password,
                },
              }
              this.ws.send(JSON.stringify(authResponse))
            } else {
              const identifyMessage = {
                op: 1,
                d: {
                  rpcVersion: 1,
                },
              }
              this.ws.send(JSON.stringify(identifyMessage))
            }
          }

          // Identificado correctamente
          if (data.op === 2) {
            // Identified
            this.connected = true
            resolve(true)
          }

          // Respuesta a request
          if (data.op === 7) {
            // RequestResponse
            const callback = this.callbacks.get(data.d.requestId)
            if (callback) {
              callback(data.d)
              this.callbacks.delete(data.d.requestId)
            }
          }

          // Eventos
          if (data.op === 5) {
            // Event
            const handlers = this.eventHandlers.get(data.d.eventType)
            if (handlers) {
              handlers.forEach((handler) => handler(data.d.eventData))
            }
          }
        }

        this.ws.onerror = (error) => {
          console.error("WebSocket error:", error)
          reject(error)
        }

        this.ws.onclose = () => {
          this.connected = false
          console.log("WebSocket desconectado")
        }

        // Timeout de 5 segundos
        setTimeout(() => {
          if (!this.connected) {
            reject(new Error("Timeout de conexión"))
          }
        }, 5000)
      } catch (error) {
        reject(error)
      }
    })
  }

  sendRequest(requestType, requestData = {}) {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject(new Error("No conectado a OBS"))
        return
      }

      const requestId = `req-${this.messageId++}`

      const message = {
        op: 6, // Request
        d: {
          requestType,
          requestId,
          requestData,
        },
      }

      this.callbacks.set(requestId, (response) => {
        if (response.requestStatus.result) {
          resolve(response.responseData)
        } else {
          reject(new Error(response.requestStatus.comment || "Request failed"))
        }
      })

      this.ws.send(JSON.stringify(message))

      // Timeout de 10 segundos
      setTimeout(() => {
        if (this.callbacks.has(requestId)) {
          this.callbacks.delete(requestId)
          reject(new Error("Request timeout"))
        }
      }, 10000)
    })
  }

  async setSourceInPreview(sourceName) {
    try {
      // Crear una fuente de medios si no existe
      await this.sendRequest("CreateInput", {
        sceneName: await this.getCurrentPreviewScene(),
        inputName: "ReplaySource",
        inputKind: "ffmpeg_source",
        inputSettings: {
          local_file: sourceName,
          looping: false,
        },
      }).catch(() => {
        // Si ya existe, solo actualizar
        return this.sendRequest("SetInputSettings", {
          inputName: "ReplaySource",
          inputSettings: {
            local_file: sourceName,
          },
        })
      })

      return true
    } catch (error) {
      console.error("Error al establecer fuente en preview:", error)
      throw error
    }
  }

  async getCurrentPreviewScene() {
    try {
      const response = await this.sendRequest("GetCurrentPreviewScene")
      return response.currentPreviewSceneName
    } catch (error) {
      // Si no hay preview, usar la escena actual
      const response = await this.sendRequest("GetCurrentProgramScene")
      return response.currentProgramSceneName
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
      this.connected = false
    }
  }

  on(eventType, handler) {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, [])
    }
    this.eventHandlers.get(eventType).push(handler)
  }
}
