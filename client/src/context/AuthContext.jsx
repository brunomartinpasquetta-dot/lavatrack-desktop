import { createContext, useContext, useEffect, useState } from 'react'
import { get, post } from '../api.js'

// Contexto de autenticación de LavaTrack.
// Guarda el token JWT y el usuario en localStorage y valida la sesión al montar.
const TOKEN_KEY = 'lavatrack.token'
const USUARIO_KEY = 'lavatrack.usuario'

// Jerarquía de roles: ADMIN > SUPERVISOR > OPERARIO.
const JERARQUIA = { OPERARIO: 1, SUPERVISOR: 2, ADMIN: 3 }

const AuthContext = createContext(null)

function leerUsuarioGuardado() {
  try {
    const raw = localStorage.getItem(USUARIO_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function leerToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  // Estado inicial optimista: si hay usuario guardado lo usamos hasta validar con /me.
  const [usuario, setUsuario] = useState(() => leerUsuarioGuardado())
  const [cargando, setCargando] = useState(true)

  // Al montar: si hay token, validamos contra GET /api/auth/me. Si es inválido (401),
  // api.handle ya limpió el storage; acá dejamos usuario en null.
  useEffect(() => {
    let vivo = true
    const token = leerToken()
    if (!token) {
      setUsuario(null)
      setCargando(false)
      return
    }
    get('/auth/me')
      .then((data) => {
        if (!vivo) return
        const u = data?.usuario || null
        setUsuario(u)
        try {
          if (u) localStorage.setItem(USUARIO_KEY, JSON.stringify(u))
        } catch {
          // ignorar
        }
      })
      .catch(() => {
        if (vivo) setUsuario(null)
      })
      .finally(() => {
        if (vivo) setCargando(false)
      })
    return () => {
      vivo = false
    }
  }, [])

  // Login: POST /api/auth/login, guarda token + usuario.
  const login = async (usuarioInput, password) => {
    const data = await post('/auth/login', { usuario: usuarioInput, password })
    try {
      localStorage.setItem(TOKEN_KEY, data.token)
      localStorage.setItem(USUARIO_KEY, JSON.stringify(data.usuario))
    } catch {
      // ignorar
    }
    setUsuario(data.usuario)
    return data.usuario
  }

  // Logout: limpia credenciales y vuelve al login (recarga limpia el estado de la app).
  const logout = () => {
    try {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USUARIO_KEY)
    } catch {
      // ignorar
    }
    setUsuario(null)
    if (typeof window !== 'undefined') window.location.href = '/login'
  }

  // ¿El usuario actual tiene al menos el rol indicado? (según la jerarquía).
  const rolAlMenos = (rol) => {
    if (!usuario) return false
    return (JERARQUIA[usuario.rol] || 0) >= (JERARQUIA[rol] || 99)
  }

  return (
    <AuthContext.Provider value={{ usuario, cargando, login, logout, rolAlMenos }}>
      {children}
    </AuthContext.Provider>
  )
}

// Hook para consumir el contexto de auth.
export function useAuth() {
  return useContext(AuthContext)
}
