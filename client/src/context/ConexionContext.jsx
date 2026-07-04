import { createContext, useContext, useEffect, useRef, useState } from 'react'

// Contexto de conexión con el servidor.
// Hace polling a GET /api/health cada ~10s. Si falla (respuesta no ok o error de fetch),
// marca `online = false` para mostrar el banner y bloquear escrituras.
const ConexionContext = createContext({ online: true })

export function ConexionProvider({ children }) {
  const [online, setOnline] = useState(true)
  const montado = useRef(true)

  useEffect(() => {
    montado.current = true

    const chequear = async () => {
      try {
        const res = await fetch('/api/health', { cache: 'no-store' })
        if (!montado.current) return
        setOnline(res.ok)
      } catch {
        // Falla de red / servidor caído.
        if (!montado.current) return
        setOnline(false)
      }
    }

    chequear()
    const id = setInterval(chequear, 10000)
    return () => {
      montado.current = false
      clearInterval(id)
    }
  }, [])

  return <ConexionContext.Provider value={{ online }}>{children}</ConexionContext.Provider>
}

// Hook para leer el estado de conexión.
export function useConexion() {
  return useContext(ConexionContext)
}
