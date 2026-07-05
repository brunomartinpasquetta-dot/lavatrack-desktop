import { useState } from 'react'

// Input de códigos "barcode-ready" (sin librerías). Acepta ENTER como separador
// (lector USB keyboard-wedge escribe el código y manda un Enter al final), muestra
// chips y permite borrar uno. Valida contra la cantidad de la línea: si el nº de
// códigos supera la cantidad, avisa en rose. Los códigos se propagan por onChange.
export default function CodigosInput({ codigos = [], onChange, cantidad, disabled = false }) {
  const [texto, setTexto] = useState('')

  const excede = cantidad != null && codigos.length > Number(cantidad)

  const agregar = (raw) => {
    // Un lector puede pegar varios códigos separados por espacios/comas/enter.
    const nuevos = String(raw)
      .split(/[\s,;]+/)
      .map((c) => c.trim())
      .filter(Boolean)
    if (!nuevos.length) return
    const set = new Set(codigos)
    const merged = [...codigos]
    nuevos.forEach((c) => {
      if (!set.has(c)) {
        set.add(c)
        merged.push(c)
      }
    })
    onChange(merged)
    setTexto('')
  }

  const quitar = (cod) => onChange(codigos.filter((c) => c !== cod))

  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      if (texto.trim()) {
        e.preventDefault()
        agregar(texto)
      }
    } else if (e.key === 'Backspace' && !texto && codigos.length) {
      // Backspace con input vacío borra el último chip.
      onChange(codigos.slice(0, -1))
    }
  }

  return (
    <div>
      <div
        className={
          'flex min-h-[44px] flex-wrap items-center gap-1.5 rounded-lg border bg-white px-2 py-1.5 ' +
          (excede ? 'border-rose-400 ring-1 ring-rose-300' : 'border-slate-300')
        }
      >
        {codigos.map((c) => (
          <span
            key={c}
            className="inline-flex items-center gap-1 rounded-md bg-teal-50 px-2 py-1 text-xs font-medium text-teal-700 ring-1 ring-teal-200"
          >
            {c}
            {!disabled && (
              <button
                type="button"
                onClick={() => quitar(c)}
                className="text-teal-500 hover:text-rose-600"
                title="Quitar código"
                aria-label={`Quitar ${c}`}
              >
                ×
              </button>
            )}
          </span>
        ))}
        {!disabled && (
          <input
            type="text"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={() => texto.trim() && agregar(texto)}
            placeholder={codigos.length ? 'Otro código…' : 'Escaneá o escribí y Enter'}
            className="min-w-[8rem] flex-1 bg-transparent px-1 py-1 text-sm text-slate-700 focus:outline-none"
            autoComplete="off"
          />
        )}
      </div>
      {excede && (
        <p className="mt-1 text-xs font-medium text-rose-600">
          {codigos.length} códigos para {cantidad} {Number(cantidad) === 1 ? 'unidad' : 'unidades'}: hay más códigos que la cantidad de la línea.
        </p>
      )}
    </div>
  )
}
