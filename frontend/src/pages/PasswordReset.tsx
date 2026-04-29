import { FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'

export default function PasswordResetPage() {
  const [email, setEmail] = useState('')
  const [done, setDone] = useState(false)
  const [debug, setDebug] = useState<{ uid?: string; token?: string } | null>(null)
  const [stage, setStage] = useState<'request' | 'confirm'>('request')
  const [uid, setUid] = useState('')
  const [token, setToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const request = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      const { data } = await api.post('/auth/password-reset/', { email })
      setDone(true)
      if (data.debug_token) {
        setDebug({ uid: data.debug_uid, token: data.debug_token })
        setUid(data.debug_uid); setToken(data.debug_token); setStage('confirm')
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Error en la solicitud.')
    }
  }

  const confirm = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await api.post('/auth/password-reset/confirm/', { uid, token, new_password: newPassword })
      setDone(true); setStage('request')
      alert('Contraseña actualizada. Ahora podés iniciar sesión.')
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'No se pudo cambiar la contraseña.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <div className="w-full max-w-md card">
        <h1 className="text-xl font-semibold mb-1">Recuperar contraseña</h1>
        <p className="text-sm text-slate-500 mb-4">
          {stage === 'request'
            ? 'Te enviaremos un correo con instrucciones.'
            : 'Ingresá el token recibido y tu nueva contraseña.'}
        </p>

        {stage === 'request' ? (
          <form onSubmit={request} className="space-y-3">
            <label className="label">Email</label>
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            {error && <div className="text-sm text-red-600">{error}</div>}
            {done && !debug && <div className="text-sm text-green-700">Listo. Revisá tu correo.</div>}
            <button className="btn-primary w-full">Solicitar</button>
          </form>
        ) : (
          <form onSubmit={confirm} className="space-y-3">
            <div><label className="label">UID</label><input className="input" value={uid} onChange={(e) => setUid(e.target.value)} required /></div>
            <div><label className="label">Token</label><input className="input" value={token} onChange={(e) => setToken(e.target.value)} required /></div>
            <div><label className="label">Nueva contraseña</label><input className="input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required /></div>
            {error && <div className="text-sm text-red-600">{error}</div>}
            <button className="btn-primary w-full">Cambiar contraseña</button>
          </form>
        )}

        <div className="mt-4 text-center text-sm">
          <Link to="/login" className="text-brand-600 hover:underline">Volver al inicio de sesión</Link>
        </div>
      </div>
    </div>
  )
}
