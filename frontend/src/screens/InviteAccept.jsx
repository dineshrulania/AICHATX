import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import axios from '../config/axios'

const InviteAccept = () => {
    const [ searchParams ] = useSearchParams()
    const navigate = useNavigate()
    const token = searchParams.get('token')

    const [ state, setState ] = useState('loading') // loading | preview | accepting | success | error
    const [ invite, setInvite ] = useState(null)
    const [ errorMsg, setErrorMsg ] = useState('')

    const isLoggedIn = !!localStorage.getItem('token')

    // Build redirect URL that comes back here after login/register
    const redirectBack = `/invite/accept?token=${token}`

    useEffect(() => {
        if (!token) {
            setState('error')
            setErrorMsg('Invalid invite link — no token found.')
            return
        }
        axios.get(`/invites/preview?token=${token}`)
            .then(res => { setInvite(res.data); setState('preview') })
            .catch(err => {
                setState('error')
                setErrorMsg(err.response?.data?.error || 'This invite is invalid or has expired.')
            })
    }, [ token ])

    // If user just logged in / registered and came back here, auto-accept immediately
    useEffect(() => {
        if (isLoggedIn && state === 'preview') {
            handleAccept()
        }
    }, [ isLoggedIn, state ])

    async function handleAccept() {
        setState('accepting')
        try {
            const res = await axios.get(`/invites/accept?token=${token}`)
            setInvite(prev => ({ ...prev, ...res.data }))
            setState('success')
        } catch (err) {
            const data = err.response?.data
            // Backend says user not registered yet
            if (data?.needsRegistration) {
                navigate(`/register?email=${encodeURIComponent(data.invitedEmail)}&redirect=${encodeURIComponent(redirectBack)}`)
                return
            }
            setState('error')
            setErrorMsg(data?.error || 'Failed to accept invite.')
        }
    }

    return (
        <div className="min-h-screen bg-[#0d1117] flex items-center justify-center px-4">
            <div className="w-full max-w-md">

                {/* Brand */}
                <div className="flex items-center justify-center gap-2 mb-8">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
                        <i className="ri-code-s-slash-line text-white text-sm"></i>
                    </div>
                    <span className="text-white font-bold text-lg">AIChatX</span>
                </div>

                <div className="bg-[#161b22] border border-[#21262d] rounded-xl overflow-hidden shadow-2xl">

                    {/* Loading */}
                    {(state === 'loading' || state === 'accepting') && (
                        <div className="p-12 flex flex-col items-center gap-3">
                            <i className="ri-loader-4-line animate-spin text-3xl text-indigo-400"></i>
                            <p className="text-[#8b949e] text-sm">
                                {state === 'accepting' ? 'Joining project...' : 'Loading invite...'}
                            </p>
                        </div>
                    )}

                    {/* Preview — shown only when NOT logged in */}
                    {state === 'preview' && invite && !isLoggedIn && (
                        <>
                            {/* Invite banner */}
                            <div className="bg-indigo-600/10 border-b border-indigo-500/20 px-6 py-4 flex items-start gap-3">
                                <i className="ri-mail-open-line text-indigo-400 text-lg shrink-0 mt-0.5"></i>
                                <div>
                                    <p className="text-white text-sm font-medium">You have a project invitation</p>
                                    <p className="text-[#8b949e] text-xs mt-0.5">
                                        from <span className="text-indigo-300 font-medium">{invite.invitedBy}</span>
                                    </p>
                                </div>
                            </div>

                            <div className="p-6 border-b border-[#21262d]">
                                <p className="text-[#8b949e] text-sm mb-3">You've been invited to join</p>
                                <div className="flex items-center gap-3 bg-[#0d1117] border border-[#21262d] rounded-xl px-4 py-3">
                                    <div className="w-9 h-9 rounded-lg bg-indigo-600/20 border border-indigo-500/20 flex items-center justify-center shrink-0">
                                        <i className="ri-folder-code-line text-indigo-400"></i>
                                    </div>
                                    <div>
                                        <p className="text-white font-semibold capitalize">{invite.projectName}</p>
                                        <p className="text-[#484f58] text-xs">Collaborative workspace</p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-5 space-y-4">
                                {/* What you'll get */}
                                <div className="space-y-2">
                                    {[
                                        ['ri-chat-3-line text-indigo-400', 'Real-time team chat'],
                                        ['ri-code-box-line text-emerald-400', 'Live collaborative code editor'],
                                        ['ri-sparkling-2-line text-violet-400', 'AI assistant with @ai'],
                                        ['ri-play-circle-line text-amber-400', 'Run code in the browser'],
                                    ].map(([ icon, text ], i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <i className={`${icon} text-sm shrink-0`}></i>
                                            <span className="text-[#8b949e] text-xs">{text}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Auth buttons */}
                                <div className="space-y-2 pt-2">
                                    <p className="text-[#484f58] text-xs text-center">Sign in or create an account to join</p>

                                    {/* Register — primary if they don't have account */}
                                    <button
                                        onClick={() => navigate(`/register?email=${encodeURIComponent(invite.invitedEmail)}&redirect=${encodeURIComponent(redirectBack)}`)}
                                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                                    >
                                        <i className="ri-user-add-line"></i>
                                        Create account & Join
                                    </button>

                                    {/* Login — if they already have one */}
                                    <button
                                        onClick={() => navigate(`/login?redirect=${encodeURIComponent(redirectBack)}`)}
                                        className="w-full py-2.5 bg-[#21262d] hover:bg-[#30363d] text-[#cdd9e5] rounded-lg text-sm flex items-center justify-center gap-2"
                                    >
                                        <i className="ri-login-box-line"></i>
                                        I already have an account
                                    </button>
                                </div>

                                <p className="text-[#484f58] text-xs text-center">
                                    Invite expires {new Date(invite.expiresAt).toLocaleDateString()}
                                </p>
                            </div>
                        </>
                    )}

                    {/* Success */}
                    {state === 'success' && (
                        <div className="p-10 flex flex-col items-center text-center gap-5">
                            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                                <i className="ri-checkbox-circle-line text-4xl text-emerald-400"></i>
                            </div>
                            <div>
                                <h2 className="text-white font-semibold text-xl mb-1">You're in!</h2>
                                <p className="text-[#8b949e] text-sm">
                                    Welcome to <span className="text-white font-medium capitalize">
                                        {invite?.project?.name || invite?.projectName}
                                    </span>
                                </p>
                            </div>
                            <button
                                onClick={() => navigate('/')}
                                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                            >
                                <i className="ri-arrow-right-line"></i>
                                Go to Dashboard
                            </button>
                        </div>
                    )}

                    {/* Error */}
                    {state === 'error' && (
                        <div className="p-10 flex flex-col items-center text-center gap-5">
                            <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                                <i className="ri-error-warning-line text-4xl text-red-400"></i>
                            </div>
                            <div>
                                <h2 className="text-white font-semibold text-xl mb-1">Invite unavailable</h2>
                                <p className="text-[#8b949e] text-sm">{errorMsg}</p>
                            </div>
                            <button
                                onClick={() => navigate('/')}
                                className="w-full py-2.5 bg-[#21262d] hover:bg-[#30363d] text-[#cdd9e5] rounded-lg text-sm"
                            >
                                Go to Dashboard
                            </button>
                        </div>
                    )}

                </div>
            </div>
        </div>
    )
}

export default InviteAccept
