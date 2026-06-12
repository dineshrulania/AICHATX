import React, { useState, useContext } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { UserContext } from '../context/user.context'
import axios from '../config/axios'

const Register = () => {
    const [ searchParams ] = useSearchParams()
    const redirect = searchParams.get('redirect') || '/'
    const prefillEmail = searchParams.get('email') || ''

    const [ email, setEmail ] = useState(prefillEmail)
    const [ password, setPassword ] = useState('')
    const [ otp, setOtp ] = useState('')
    const [ step, setStep ] = useState('credentials') // credentials | otp
    const [ error, setError ] = useState('')
    const [ info, setInfo ] = useState('')
    const [ loading, setLoading ] = useState(false)

    const { setUser } = useContext(UserContext)
    const navigate = useNavigate()

    function submitHandler(e) {
        e.preventDefault()
        setError('')
        setInfo('')
        setLoading(true)

        const request = step === 'credentials'
            ? axios.post('/users/register', { email, password })
            : axios.post('/users/register/verify-otp', { email, otp })

        request
            .then((res) => {
                if (step === 'credentials') {
                    setStep('otp')
                    setInfo(res.data?.message || 'We sent a verification code to your email.')
                    return
                }

                localStorage.setItem('token', res.data.token)
                setUser(res.data.user)
                navigate(redirect)
            })
            .catch((err) => {
                const msg = err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Registration failed'
                setError(typeof msg === 'string' ? msg : 'Registration failed')
            })
            .finally(() => setLoading(false))
    }

    function resendOtp() {
        if (!email.trim() || !password.trim()) return
        setError('')
        setInfo('')
        setLoading(true)
        axios.post('/users/register', { email, password })
            .then((res) => {
                setStep('otp')
                setInfo(res.data?.message || 'We sent a verification code to your email.')
            })
            .catch((err) => {
                const msg = err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Registration failed'
                setError(typeof msg === 'string' ? msg : 'Registration failed')
            })
            .finally(() => setLoading(false))
    }

    return (
        <div className="min-h-screen flex bg-[#0d1117]">
            {/* Left panel */}
            <div className="hidden lg:flex flex-col justify-between w-1/2 bg-[#0d1117] border-r border-[#21262d] p-12">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
                        <i className="ri-code-s-slash-line text-white text-lg"></i>
                    </div>
                    <span className="text-white font-bold text-xl tracking-tight">AIChatX</span>
                </div>
                <div>
                    <div className="space-y-6 mb-12">
                        {[
                            { icon: 'ri-team-line', color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20', title: 'Team Collaboration', desc: 'Invite teammates and work together in real time' },
                            { icon: 'ri-play-circle-line', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', title: 'Run in Browser', desc: 'Execute code instantly without any setup' },
                            { icon: 'ri-robot-2-line', color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20', title: 'Gemini AI', desc: 'Ask @ai to generate full project scaffolds' },
                        ].map((f) => (
                            <div key={f.title} className="flex items-start gap-4">
                                <div className={`w-10 h-10 rounded-lg border ${f.bg} flex items-center justify-center shrink-0`}>
                                    <i className={`${f.icon} ${f.color} text-lg`}></i>
                                </div>
                                <div>
                                    <p className="text-white font-medium text-sm">{f.title}</p>
                                    <p className="text-[#8b949e] text-sm mt-0.5">{f.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <p className="text-[#8b949e] text-sm">Join thousands of developers shipping faster together.</p>
                </div>
            </div>

            {/* Right panel */}
            <div className="flex-1 flex items-center justify-center px-6 py-12">
                <div className="w-full max-w-sm">
                    <div className="flex items-center gap-2 mb-8 lg:hidden">
                        <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center">
                            <i className="ri-code-s-slash-line text-white"></i>
                        </div>
                        <span className="text-white font-bold text-lg">AIChatX</span>
                    </div>

                    <h1 className="text-2xl font-semibold text-white mb-1">Create your account</h1>
                    <p className="text-[#8b949e] text-sm mb-8">
                        {step === 'otp'
                            ? 'Enter the verification code sent to your email'
                            : (prefillEmail ? 'Create an account to join the project' : 'Start collaborating in minutes')}
                    </p>

                    {/* Invite context banner */}
                    {prefillEmail && redirect !== '/' && (
                        <div className="mb-5 px-4 py-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm flex items-start gap-2">
                            <i className="ri-mail-open-line shrink-0 mt-0.5"></i>
                            <span>You were invited to a project. Register to accept and join your team.</span>
                        </div>
                    )}

                    {info && (
                        <div className="mb-5 px-4 py-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm flex items-center gap-2">
                            <i className="ri-mail-check-line shrink-0"></i>
                            <span>{info}</span>
                        </div>
                    )}

                    {error && (
                        <div className="mb-5 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
                            <i className="ri-error-warning-line shrink-0"></i>
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={submitHandler} className="space-y-4">
                        <div>
                            <label className="block text-[#cdd9e5] text-sm font-medium mb-1.5">Email</label>
                            <input
                                type="email" value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={step === 'otp'}
                                className="w-full px-3.5 py-2.5 rounded-lg bg-[#161b22] border border-[#30363d] text-white placeholder-[#484f58] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
                                placeholder="you@example.com" required
                            />
                        </div>
                        {step === 'credentials' && (
                            <div>
                                <label className="block text-[#cdd9e5] text-sm font-medium mb-1.5">Password</label>
                                <input
                                    type="password" value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#161b22] border border-[#30363d] text-white placeholder-[#484f58] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
                                    placeholder="Min. 3 characters" required
                                />
                            </div>
                        )}
                        {step === 'otp' && (
                            <div>
                                <label className="block text-[#cdd9e5] text-sm font-medium mb-1.5">Verification code</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#161b22] border border-[#30363d] text-white placeholder-[#484f58] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm tracking-[0.35em] text-center"
                                    placeholder="123456"
                                    required
                                />
                            </div>
                        )}
                        <button
                            type="submit" disabled={loading}
                            className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium text-sm flex items-center justify-center gap-2 mt-2"
                        >
                            {loading
                                ? <><i className="ri-loader-4-line animate-spin"></i>{step === 'otp' ? 'Verifying code...' : 'Sending code...'}</>
                                : (step === 'otp' ? 'Verify code' : 'Send verification code')}
                        </button>
                        {step === 'otp' && (
                            <button
                                type="button"
                                onClick={resendOtp}
                                disabled={loading}
                                className="w-full py-2 rounded-lg bg-[#21262d] hover:bg-[#30363d] disabled:opacity-60 disabled:cursor-not-allowed text-[#cdd9e5] font-medium text-sm"
                            >
                                Resend code
                            </button>
                        )}
                    </form>

                    <p className="text-[#8b949e] text-sm text-center mt-6">
                        Already have an account?{' '}
                        <Link to={`/login${redirect !== '/' ? `?redirect=${encodeURIComponent(redirect)}` : ''}`} className="text-indigo-400 hover:text-indigo-300 font-medium">Sign in</Link>
                    </p>
                </div>
            </div>
        </div>
    )
}

export default Register
