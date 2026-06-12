import React, { useContext, useState, useEffect } from 'react'
import { UserContext } from '../context/user.context'
import axios from "../config/axios"
import { useNavigate } from 'react-router-dom'

const COLORS = [
    'bg-indigo-500/20 border-indigo-500/30 text-indigo-400',
    'bg-emerald-500/20 border-emerald-500/30 text-emerald-400',
    'bg-violet-500/20 border-violet-500/30 text-violet-400',
    'bg-amber-500/20 border-amber-500/30 text-amber-400',
    'bg-rose-500/20 border-rose-500/30 text-rose-400',
    'bg-cyan-500/20 border-cyan-500/30 text-cyan-400',
]

function getColor(name) {
    let hash = 0
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
    return COLORS[Math.abs(hash) % COLORS.length]
}

const Home = () => {
    const { user } = useContext(UserContext)
    const [ isModalOpen, setIsModalOpen ] = useState(false)
    const [ projectName, setProjectName ] = useState('')
    const [ project, setProject ] = useState([])
    const [ error, setError ] = useState('')
    const [ creating, setCreating ] = useState(false)
    const [ search, setSearch ] = useState('')

    const navigate = useNavigate()

    function fetchProjects() {
        axios.get('/projects/all').then((res) => setProject(res.data.projects)).catch(console.log)
    }

    function createProject(e) {
        e.preventDefault()
        setError('')
        setCreating(true)
        axios.post('/projects/create', { name: projectName })
            .then(() => { setIsModalOpen(false); setProjectName(''); fetchProjects() })
            .catch((err) => {
                const msg = err.response?.data || err.message
                setError(typeof msg === 'string' ? msg : 'Failed to create project')
            })
            .finally(() => setCreating(false))
    }

    function logout() {
        axios.get('/users/logout').finally(() => {
            localStorage.removeItem('token')
            navigate('/login')
        })
    }

    useEffect(() => { fetchProjects() }, [])

    const filtered = project.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))

    return (
        <div className="min-h-screen bg-[#0d1117] flex flex-col">
            {/* Navbar */}
            <header className="bg-[#161b22] border-b border-[#21262d] px-6 h-14 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-600/30">
                        <i className="ri-code-s-slash-line text-white text-sm"></i>
                    </div>
                    <span className="text-white font-bold text-base tracking-tight">AIChatX</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[#0d1117] border border-[#30363d] rounded-lg">
                        <i className="ri-user-line text-[#8b949e] text-xs"></i>
                        <span className="text-[#8b949e] text-xs">{user?.email}</span>
                    </div>
                    <button
                        onClick={logout}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[#8b949e] hover:text-white hover:bg-[#21262d] text-sm"
                    >
                        <i className="ri-logout-box-r-line"></i>
                        <span className="hidden sm:inline text-xs">Logout</span>
                    </button>
                </div>
            </header>

            <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-white font-semibold text-lg">Your Projects</h1>
                        <p className="text-[#8b949e] text-xs mt-0.5">{project.length} project{project.length !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Search */}
                        <div className="flex items-center gap-2 px-3 py-2 bg-[#161b22] border border-[#30363d] rounded-lg w-52">
                            <i className="ri-search-line text-[#8b949e] text-sm"></i>
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search projects..."
                                className="bg-transparent text-white text-sm placeholder-[#484f58] outline-none w-full"
                            />
                        </div>
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium shadow-md shadow-indigo-600/20"
                        >
                            <i className="ri-add-line"></i>
                            <span>New Project</span>
                        </button>
                    </div>
                </div>

                {/* Empty state */}
                {filtered.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-28 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-[#161b22] border border-[#21262d] flex items-center justify-center mb-4">
                            <i className="ri-folder-3-line text-3xl text-[#484f58]"></i>
                        </div>
                        <p className="text-[#cdd9e5] font-medium">
                            {search ? `No projects matching "${search}"` : 'No projects yet'}
                        </p>
                        <p className="text-[#8b949e] text-sm mt-1">
                            {search ? 'Try a different name' : 'Create a project to get started'}
                        </p>
                    </div>
                )}

                {/* Project grid */}
                {filtered.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filtered.map((p) => {
                            const colorClass = getColor(p.name)
                            return (
                                <div
                                    key={p._id}
                                    onClick={() => navigate('/project', { state: { project: p } })}
                                    className="group bg-[#161b22] border border-[#21262d] hover:border-indigo-500/40 rounded-xl p-5 cursor-pointer hover:bg-[#1c2128] transition-all"
                                >
                                    <div className={`w-10 h-10 rounded-lg border ${colorClass} flex items-center justify-center mb-4`}>
                                        <i className="ri-folder-code-line text-lg"></i>
                                    </div>
                                    <h2 className="text-white font-semibold capitalize truncate mb-1 text-sm">{p.name}</h2>
                                    <div className="flex items-center justify-between mt-3">
                                        <div className="flex items-center gap-1.5 text-[#8b949e] text-xs">
                                            <i className="ri-team-line"></i>
                                            <span>{p.users.length} member{p.users.length !== 1 ? 's' : ''}</span>
                                        </div>
                                        <div className="flex items-center gap-1 text-[#8b949e] text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span>Open</span>
                                            <i className="ri-arrow-right-line"></i>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </main>

            {/* Create project modal */}
            {isModalOpen && (
                <div className="fixed inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-50 px-4">
                    <div className="bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl w-full max-w-md p-6">
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <h2 className="text-white font-semibold">New Project</h2>
                                <p className="text-[#8b949e] text-xs mt-0.5">Give your project a name to get started</p>
                            </div>
                            <button
                                onClick={() => { setIsModalOpen(false); setError(''); setProjectName('') }}
                                className="text-[#8b949e] hover:text-white p-1 rounded-lg hover:bg-[#21262d]"
                            >
                                <i className="ri-close-line text-xl"></i>
                            </button>
                        </div>
                        <form onSubmit={createProject}>
                            <div className="mb-5">
                                <label className="block text-[#cdd9e5] text-sm font-medium mb-1.5">Project name</label>
                                <input
                                    autoFocus
                                    value={projectName}
                                    onChange={(e) => { setProjectName(e.target.value); setError('') }}
                                    type="text"
                                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#0d1117] border border-[#30363d] text-white placeholder-[#484f58] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
                                    placeholder="my-awesome-project"
                                    required
                                />
                                {error && (
                                    <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                                        <i className="ri-error-warning-line"></i> {error}
                                    </p>
                                )}
                            </div>
                            <div className="flex gap-3 justify-end">
                                <button
                                    type="button"
                                    onClick={() => { setIsModalOpen(false); setError(''); setProjectName('') }}
                                    className="px-4 py-2 text-[#8b949e] hover:text-white hover:bg-[#21262d] rounded-lg text-sm"
                                >Cancel</button>
                                <button
                                    type="submit" disabled={creating}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-lg text-sm font-medium flex items-center gap-2"
                                >
                                    {creating ? <><i className="ri-loader-4-line animate-spin"></i>Creating...</> : 'Create project'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

export default Home
