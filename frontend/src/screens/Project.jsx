import React, { useState, useEffect, useContext, useRef } from 'react'
import { UserContext } from '../context/user.context'
import { useNavigate, useLocation } from 'react-router-dom'
import axios from '../config/axios'
import { initializeSocket, receiveMessage, sendMessage } from '../config/socket'
import Markdown from 'markdown-to-jsx'
import hljs from 'highlight.js'
import { getWebContainer } from '../config/webContainer'
import { io as socketIO } from 'socket.io-client'
import Editor from '@monaco-editor/react'

function SyntaxHighlightedCode(props) {
    const ref = useRef(null)
    React.useEffect(() => {
        if (ref.current && props.className?.includes('lang-') && window.hljs) {
            window.hljs.highlightElement(ref.current)
            ref.current.removeAttribute('data-highlighted')
        }
    }, [ props.className, props.children ])
    return <code {...props} ref={ref} />
}

function getFileIcon(filename) {
    if (!filename) return 'ri-file-code-line'
    const ext = filename.split('.').pop()
    const map = {
        js: 'ri-javascript-line', jsx: 'ri-reactjs-line', ts: 'ri-file-code-line',
        tsx: 'ri-reactjs-line', json: 'ri-braces-line', html: 'ri-html5-line',
        css: 'ri-css3-line', md: 'ri-markdown-line', py: 'ri-code-s-slash-line',
    }
    return map[ext] || 'ri-file-code-line'
}

function getFileIconColor(filename) {
    if (!filename) return 'text-[#8b949e]'
    const ext = filename.split('.').pop()
    const map = {
        js: 'text-yellow-400', jsx: 'text-cyan-400', ts: 'text-blue-400',
        tsx: 'text-cyan-400', json: 'text-yellow-300', html: 'text-orange-400',
        css: 'text-blue-300', md: 'text-[#8b949e]', py: 'text-green-400',
    }
    return map[ext] || 'text-[#8b949e]'
}

const Project = () => {
    const location = useLocation()
    const navigate = useNavigate()

    const [ isSidePanelOpen, setIsSidePanelOpen ] = useState(false)
    const [ isModalOpen, setIsModalOpen ] = useState(false)
    const [ inviteEmail, setInviteEmail ] = useState('')
    const [ inviteStatus, setInviteStatus ] = useState(null) // { type: 'success'|'error', msg }
    const [ inviteSending, setInviteSending ] = useState(false)
    const [ project, setProject ] = useState(location.state.project)
    const [ message, setMessage ] = useState('')
    const { user } = useContext(UserContext)
    const messageBox = useRef(null)

    const [ users, setUsers ] = useState([])
    const [ messages, setMessages ] = useState([])
    const [ fileTree, setFileTree ] = useState({})
    const [ currentFile, setCurrentFile ] = useState(null)
    const [ editorValue, setEditorValue ] = useState('')
    const [ openFiles, setOpenFiles ] = useState([])
    const [ webContainer, setWebContainer ] = useState(null)
    const [ iframeUrl, setIframeUrl ] = useState(null)
    const [ runProcess, setRunProcess ] = useState(null)
    const [ activePanel, setActivePanel ] = useState('chat') // 'chat' | 'files'
    const [ isDragging, setIsDragging ] = useState(false)
    const [ newFileName, setNewFileName ] = useState('')
    const [ isCreatingFile, setIsCreatingFile ] = useState(false)
    const fileInputRef = useRef(null)
    const folderInputRef = useRef(null)
    const dragCounter = useRef(0)

    // Terminal state
    const [ termLang, setTermLang ] = useState('javascript')
    const [ termOpen, setTermOpen ] = useState(false)
    const [ runtimes, setRuntimes ] = useState([])
    const [ runLog, setRunLog ] = useState([])
    const [ isRunning, setIsRunning ] = useState(false)
    const [ termInput, setTermInput ] = useState('')
    const [ waitingInput, setWaitingInput ] = useState(false)
    const termLogRef = useRef(null)
    const termSocketRef = useRef(null)
    const sessionId = useRef(null)
    const saveDebounceRef = useRef(null)

    async function sendInvite(e) {
        e.preventDefault()
        if (!inviteEmail.trim()) return
        setInviteSending(true)
        setInviteStatus(null)
        try {
            const res = await axios.post('/invites/send', {
                projectId: project._id,
                email: inviteEmail.trim(),
            })
            setInviteStatus({ type: 'success', msg: res.data.message })
            setInviteEmail('')
        } catch (err) {
            setInviteStatus({ type: 'error', msg: err.response?.data?.error || 'Failed to send invite' })
        } finally {
            setInviteSending(false)
        }
    }

    const send = () => {
        if (!message.trim()) return
        sendMessage('project-message', { message, sender: user })
        setMessages(prev => [ ...prev, { sender: user, message } ])
        setMessage('')
    }

    function WriteAiMessage(msg) {
        try {
            const obj = JSON.parse(msg)
            return (
                <div className="overflow-auto rounded-lg bg-[#0d1117] border border-[#21262d] p-3 text-sm">
                    <Markdown children={obj.text} options={{ overrides: { code: SyntaxHighlightedCode } }} />
                </div>
            )
        } catch {
            return <p className="text-[#cdd9e5]">{msg}</p>
        }
    }

    function renderChatMessage(message, mentions = []) {
        if (!message) return null

        const parts = message.split(/(@[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|@[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|@[A-Za-z0-9._%+-]+\.[A-Za-z]{2,}|@[A-Za-z0-9._%+-]+)/g)

        return parts.map((part, index) => {
            const isMention = part.startsWith('@') && (mentions.length === 0 || mentions.some(email => part.toLowerCase().includes(email.toLowerCase())))

            if (isMention) {
                return (
                    <span key={index} className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-medium">
                        {part}
                    </span>
                )
            }

            return <span key={index}>{part}</span>
        })
    }

    function mergeFileTrees(baseTree = {}, patchTree = {}) {
        const merged = { ...baseTree }

        Object.entries(patchTree || {}).forEach(([filePath, entry]) => {
            if (entry && typeof entry === 'object' && entry.file) {
                merged[filePath] = {
                    ...baseTree[filePath],
                    ...entry,
                    file: {
                        ...(baseTree[filePath]?.file || {}),
                        ...(entry.file || {}),
                    },
                }
            } else {
                merged[filePath] = entry
            }
        })

        return merged
    }

    useEffect(() => {
        initializeSocket(project._id)

        if (!webContainer) {
            getWebContainer().then(c => {
                setWebContainer(c)
            }).catch(console.log)
        }

        receiveMessage('project-message', data => {
            if (data.sender._id === 'ai') {
                try {
                    const parsed = JSON.parse(data.message)
                    if (parsed.fileTree && typeof parsed.fileTree === 'object') {
                        setFileTree(prev => {
                            const merged = mergeFileTrees(prev, parsed.fileTree)
                            webContainer?.mount(merged)
                            return merged
                        })

                        const updatedFiles = Object.keys(parsed.fileTree)
                        if (updatedFiles.length > 0) {
                            setOpenFiles(prev => [ ...new Set([ ...prev, ...updatedFiles ]) ])
                        }
                    }
                } catch (e) { console.log('AI parse error', e) }
                setMessages(prev => [ ...prev, data ])
            } else {
                setMessages(prev => [ ...prev, data ])
            }
        })

        axios.get(`/projects/get-project/${location.state.project._id}`).then(res => {
            setProject(res.data.project)
            setFileTree(res.data.project.fileTree || {})
        })

        axios.get('/users/all').then(res => setUsers(res.data.users)).catch(console.log)

        // Load supported runtimes for the language selector
        axios.get('/execute/runtimes').then(res => setRuntimes(res.data)).catch(console.log)
    }, [])

    useEffect(() => {
        if (currentFile && fileTree[currentFile]) {
            setEditorValue(fileTree[currentFile].file.contents || '')
        } else {
            setEditorValue('')
        }
    }, [ currentFile, fileTree ])

    useEffect(() => {
        return () => {
            if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current)
        }
    }, [])

    useEffect(() => {
        if (messageBox.current) {
            messageBox.current.scrollTop = messageBox.current.scrollHeight
        }
    }, [ messages ])

    function saveFileTree(ft) {
        axios.put('/projects/update-file-tree', {
            projectId: project._id, fileTree: ft
        }).catch(console.log)
    }

    // Read a File object and return { name, contents }
    function readFileAsText(file) {
        return new Promise((resolve) => {
            const reader = new FileReader()
            reader.onload = (e) => resolve({ name: file.name, path: file.webkitRelativePath || file.name, contents: e.target.result })
            reader.readAsText(file)
        })
    }

    // Merge uploaded files into fileTree and save
    async function addFilesToTree(files) {
        const results = await Promise.all(Array.from(files).map(readFileAsText))
        setFileTree(prev => {
            const ft = { ...prev }
            results.forEach(({ path, contents }) => {
                // Use just the filename (strip folder prefix) as key
                const key = path.includes('/') ? path : path
                ft[key] = { file: { contents } }
            })
            saveFileTree(ft)
            return ft
        })
    }

    function handleFileInputChange(e) {
        if (e.target.files?.length) addFilesToTree(e.target.files)
        e.target.value = ''
    }

    function handleDragEnter(e) {
        e.preventDefault()
        dragCounter.current++
        setIsDragging(true)
    }
    function handleDragLeave(e) {
        e.preventDefault()
        dragCounter.current--
        if (dragCounter.current === 0) setIsDragging(false)
    }
    function handleDragOver(e) { e.preventDefault() }
    async function handleDrop(e) {
        e.preventDefault()
        dragCounter.current = 0
        setIsDragging(false)
        const items = e.dataTransfer.items
        if (!items) return

        const allFiles = []

        async function traverseEntry(entry, path = '') {
            if (entry.isFile) {
                await new Promise((resolve) => {
                    entry.file(file => {
                        const fullPath = path ? `${path}/${file.name}` : file.name
                        allFiles.push({ file, fullPath })
                        resolve()
                    })
                })
            } else if (entry.isDirectory) {
                const reader = entry.createReader()
                await new Promise((resolve) => {
                    reader.readEntries(async (entries) => {
                        for (const child of entries) {
                            await traverseEntry(child, path ? `${path}/${entry.name}` : entry.name)
                        }
                        resolve()
                    })
                })
            }
        }

        for (let i = 0; i < items.length; i++) {
            const entry = items[i].webkitGetAsEntry?.()
            if (entry) await traverseEntry(entry)
        }

        if (allFiles.length === 0) return

        const results = await Promise.all(allFiles.map(({ file, fullPath }) =>
            new Promise(resolve => {
                const reader = new FileReader()
                reader.onload = (e) => resolve({ path: fullPath, contents: e.target.result })
                reader.readAsText(file)
            })
        ))

        setFileTree(prev => {
            const ft = { ...prev }
            results.forEach(({ path, contents }) => { ft[path] = { file: { contents } } })
            saveFileTree(ft)
            return ft
        })
    }

    function createNewFile() {
        const name = newFileName.trim()
        if (!name) return
        const ft = { ...fileTree, [name]: { file: { contents: '' } } }
        setFileTree(ft)
        saveFileTree(ft)
        setCurrentFile(name)
        setOpenFiles(prev => [ ...new Set([ ...prev, name ]) ])
        setNewFileName('')
        setIsCreatingFile(false)
    }

    function deleteFile(filename, e) {
        e.stopPropagation()
        const ft = { ...fileTree }
        delete ft[filename]
        setFileTree(ft)
        saveFileTree(ft)
        if (currentFile === filename) {
            const remaining = Object.keys(ft)
            setCurrentFile(remaining[0] || null)
        }
        setOpenFiles(prev => prev.filter(f => f !== filename))
    }

    // Detect language from file extension
    function detectLang(filename) {
        if (!filename) return termLang
        const ext = filename.split('.').pop().toLowerCase()
        const map = {
            py: 'python', js: 'javascript', ts: 'typescript',
            java: 'java', cpp: 'cpp', cc: 'cpp', cxx: 'cpp',
            c: 'c', go: 'go', rs: 'rust', rb: 'ruby',
            php: 'php', sh: 'bash', r: 'r', swift: 'swift',
            kt: 'kotlin', cs: 'csharp', lua: 'lua',
            pl: 'perl', hs: 'haskell', scala: 'scala', dart: 'dart',
            groovy: 'groovy', gvy: 'groovy', jl: 'julia',
            exs: 'elixir', ex: 'elixir', clj: 'clojure',
            coffee: 'coffeescript', cr: 'crystal', nim: 'nim',
            pas: 'pascal', pp: 'pascal', f90: 'fortran', f: 'fortran',
            zig: 'zig', ps1: 'powershell', sql: 'sqlite',
            v: 'vlang', d: 'd', ml: 'ocaml', erl: 'erlang',
        }
        return map[ext] || termLang
    }

    function getEditorLanguage(filename) {
        if (!filename) return 'javascript'
        const ext = filename.split('.').pop().toLowerCase()
        const map = {
            js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
            json: 'json', html: 'html', css: 'css', md: 'markdown',
            py: 'python', c: 'c', cpp: 'cpp', cc: 'cpp', cxx: 'cpp',
            java: 'java', sh: 'shell', bash: 'shell', php: 'php', rb: 'ruby',
            go: 'go', rs: 'rust', lua: 'lua', pl: 'perl', sql: 'sql',
        }
        return map[ext] || 'javascript'
    }

    // Connect to terminal socket namespace (once)
    function getTermSocket() {
        if (termSocketRef.current?.connected) return termSocketRef.current
        const sock = socketIO(`${import.meta.env.VITE_API_URL}/terminal`, {
            auth: { token: localStorage.getItem('token') },
            transports: ['websocket'],
        })
        sock.on('output', ({ type, data }) => {
            setRunLog(p => [...p, { type, data }])
            setTimeout(() => {
                if (termLogRef.current)
                    termLogRef.current.scrollTop = termLogRef.current.scrollHeight
            }, 0)
        })
        sock.on('input_state', ({ waiting }) => {
            setWaitingInput(waiting)
        })
        sock.on('done', () => {
            setIsRunning(false)
            setWaitingInput(false)
        })
        termSocketRef.current = sock
        return sock
    }

    function runCode() {
        if (!currentFile || !fileTree[currentFile]) {
            setRunLog([{ type: 'error', data: 'No file open. Select a file first.\n' }])
            setTermOpen(true)
            return
        }
        const code = editorValue || fileTree[currentFile].file.contents
        if (!code?.trim()) {
            setRunLog([{ type: 'error', data: 'File is empty.\n' }])
            setTermOpen(true)
            return
        }
        const lang = detectLang(currentFile)
        setTermLang(lang)
        setRunLog([])
        setTermOpen(true)
        setIsRunning(true)
        setWaitingInput(false)
        sessionId.current = `${Date.now()}`
        const sock = getTermSocket()
        sock.emit('run', { sessionId: sessionId.current, language: lang, code })
    }

    function sendTermInput(e) {
        e.preventDefault()
        if (!termSocketRef.current || !sessionId.current) return
        // Echo input to terminal display
        setRunLog(p => [...p, { type: 'stdin', data: termInput + '\n' }])
        termSocketRef.current.emit('stdin', { sessionId: sessionId.current, data: termInput + '\n' })
        setTermInput('')
    }

    function killProcess() {
        if (termSocketRef.current && sessionId.current) {
            termSocketRef.current.emit('kill', { sessionId: sessionId.current })
        }
        setIsRunning(false)
    }

    const collaboratorCount = project.users?.length || 0

    return (
        <div className="h-screen w-screen flex flex-col bg-[#0d1117] overflow-hidden">

            {/* Top bar */}
            <header className="h-11 bg-[#161b22] border-b border-[#21262d] flex items-center justify-between px-4 shrink-0 z-20">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/')}
                        className="flex items-center gap-2 text-[#8b949e] hover:text-white"
                    >
                        <div className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center">
                            <i className="ri-code-s-slash-line text-white text-xs"></i>
                        </div>
                    </button>
                    <span className="text-[#21262d]">/</span>
                    <span className="text-white font-medium text-sm capitalize">{project.name}</span>
                    <span className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#21262d] text-[#8b949e] text-xs">
                        <i className="ri-team-line text-xs"></i>
                        {collaboratorCount}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[#8b949e] hover:text-white hover:bg-[#21262d] text-xs"
                    >
                        <i className="ri-user-add-line"></i>
                        <span className="hidden sm:inline">Add member</span>
                    </button>
                    <button
                        onClick={() => setIsSidePanelOpen(!isSidePanelOpen)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[#8b949e] hover:text-white hover:bg-[#21262d] text-xs"
                    >
                        <i className="ri-group-line"></i>
                        <span className="hidden sm:inline">Members</span>
                    </button>
                    <button
                        onClick={runCode}
                        disabled={isRunning}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium"
                    >
                        {isRunning
                            ? <><i className="ri-loader-4-line animate-spin"></i><span>Running...</span></>
                            : <><i className="ri-play-fill"></i><span>Run</span></>
                        }
                    </button>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">

                {/* ── LEFT: Chat panel ── */}
                <aside className="w-80 shrink-0 flex flex-col bg-[#161b22] border-r border-[#21262d] h-full">
                    {/* Panel tabs */}
                    <div className="flex border-b border-[#21262d] shrink-0">
                        <button
                            onClick={() => setActivePanel('chat')}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium border-b-2 transition-colors ${activePanel === 'chat' ? 'border-indigo-500 text-white' : 'border-transparent text-[#8b949e] hover:text-white'}`}
                        >
                            <i className="ri-chat-3-line"></i> Chat
                        </button>
                        <button
                            onClick={() => setActivePanel('files')}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium border-b-2 transition-colors ${activePanel === 'files' ? 'border-indigo-500 text-white' : 'border-transparent text-[#8b949e] hover:text-white'}`}
                        >
                            <i className="ri-folder-3-line"></i> Files
                        </button>
                    </div>

                    {/* Chat panel */}
                    {activePanel === 'chat' && (
                        <>
                            <div ref={messageBox} className="flex-1 overflow-y-auto p-3 space-y-3 message-box">
                                {messages.length === 0 && (
                                    <div className="flex flex-col items-center justify-center h-full text-center py-12">
                                        <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-3">
                                            <i className="ri-chat-3-line text-indigo-400 text-xl"></i>
                                        </div>
                                        <p className="text-[#8b949e] text-sm">No messages yet</p>
                                        <p className="text-[#484f58] text-xs mt-1">Type <span className="text-indigo-400 font-mono">@ai</span> to ask the AI</p>
                                    </div>
                                )}
                                {messages.map((msg, i) => {
                                    const isAi = msg.sender._id === 'ai'
                                    const isOwn = msg.sender._id === user?._id?.toString()
                                    const mentions = (() => {
                                        if (Array.isArray(msg.mentions)) return msg.mentions
                                        try {
                                            const parsed = JSON.parse(msg.message)
                                            return Array.isArray(parsed.mentions) ? parsed.mentions : []
                                        } catch {
                                            return []
                                        }
                                    })()
                                    return (
                                        <div key={i} className={`flex flex-col ${isOwn && !isAi ? 'items-end' : 'items-start'}`}>
                                            {!isOwn && (
                                                <div className="flex items-center gap-1.5 mb-1">
                                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${isAi ? 'bg-violet-600' : 'bg-indigo-600'}`}>
                                                        {isAi ? <i className="ri-sparkling-2-fill text-white text-xs"></i> : <i className="ri-user-fill text-white text-xs"></i>}
                                                    </div>
                                                    <span className="text-[#8b949e] text-xs">{isAi ? 'AI Assistant' : msg.sender.email}</span>
                                                </div>
                                            )}
                                            <div className={`max-w-[90%] rounded-xl px-3 py-2 text-sm ${
                                                isAi ? 'w-full bg-transparent p-0' :
                                                isOwn ? 'bg-indigo-600 text-white rounded-br-sm' :
                                                'bg-[#21262d] text-[#cdd9e5] rounded-bl-sm'
                                            }`}>
                                                {isAi ? WriteAiMessage(msg.message) : <p className="leading-relaxed whitespace-pre-wrap">{renderChatMessage(msg.message, mentions)}</p>}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                            {/* Input */}
                            <div className="p-3 border-t border-[#21262d] shrink-0">
                                <div className="flex items-center gap-2 bg-[#0d1117] border border-[#30363d] rounded-xl px-3 py-2 focus-within:border-indigo-500/60">
                                    <input
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
                                        className="flex-1 bg-transparent text-white text-sm placeholder-[#484f58] outline-none"
                                        placeholder="Message, @ai, or @person@example.com ..."
                                    />
                                    <button
                                        onClick={send}
                                        disabled={!message.trim()}
                                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white shrink-0"
                                    >
                                        <i className="ri-send-plane-fill text-xs"></i>
                                    </button>
                                </div>
                                <p className="text-[#484f58] text-xs mt-1.5 text-center">Use <span className="text-violet-400 font-mono">@ai</span> for AI or <span className="text-indigo-400 font-mono">@email@example.com</span> to mention a teammate</p>
                            </div>
                        </>
                    )}

                    {/* Files panel */}
                    {activePanel === 'files' && (
                        <div
                            className="flex-1 flex flex-col overflow-hidden relative"
                            onDragEnter={handleDragEnter}
                            onDragLeave={handleDragLeave}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                        >
                            {/* Hidden file inputs */}
                            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileInputChange} />
                            <input ref={folderInputRef} type="file" multiple className="hidden"
                                onChange={handleFileInputChange}
                                {...{ webkitdirectory: '', directory: '' }}
                            />

                            {/* Files toolbar */}
                            <div className="flex items-center justify-between px-3 py-2 border-b border-[#21262d] shrink-0">
                                <span className="text-[#8b949e] text-xs">{Object.keys(fileTree).length} files</span>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setIsCreatingFile(true)}
                                        title="New file"
                                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#21262d] text-[#8b949e] hover:text-white"
                                    ><i className="ri-file-add-line text-sm"></i></button>
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        title="Upload files"
                                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#21262d] text-[#8b949e] hover:text-white"
                                    ><i className="ri-upload-2-line text-sm"></i></button>
                                    <button
                                        onClick={() => folderInputRef.current?.click()}
                                        title="Upload folder"
                                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#21262d] text-[#8b949e] hover:text-white"
                                    ><i className="ri-folder-upload-line text-sm"></i></button>
                                </div>
                            </div>

                            {/* New file input */}
                            {isCreatingFile && (
                                <div className="px-3 py-2 border-b border-[#21262d] shrink-0">
                                    <div className="flex items-center gap-2 bg-[#0d1117] border border-indigo-500/60 rounded-lg px-2 py-1.5">
                                        <i className="ri-file-code-line text-[#8b949e] text-xs shrink-0"></i>
                                        <input
                                            autoFocus
                                            value={newFileName}
                                            onChange={(e) => setNewFileName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') createNewFile()
                                                if (e.key === 'Escape') { setIsCreatingFile(false); setNewFileName('') }
                                            }}
                                            placeholder="filename.js"
                                            className="flex-1 bg-transparent text-white text-xs outline-none font-mono placeholder-[#484f58]"
                                        />
                                        <button onClick={createNewFile} className="text-indigo-400 hover:text-indigo-300 text-xs shrink-0">
                                            <i className="ri-check-line"></i>
                                        </button>
                                        <button onClick={() => { setIsCreatingFile(false); setNewFileName('') }} className="text-[#8b949e] hover:text-white text-xs shrink-0">
                                            <i className="ri-close-line"></i>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Drop overlay */}
                            {isDragging && (
                                <div className="absolute inset-0 z-10 bg-indigo-600/10 border-2 border-dashed border-indigo-500 rounded-lg m-2 flex flex-col items-center justify-center pointer-events-none">
                                    <i className="ri-upload-cloud-2-line text-4xl text-indigo-400 mb-2"></i>
                                    <p className="text-indigo-300 text-sm font-medium">Drop files or folders here</p>
                                </div>
                            )}

                            {/* File list */}
                            <div className="flex-1 overflow-y-auto">
                                {Object.keys(fileTree).length === 0 && !isDragging ? (
                                    <div className="flex flex-col items-center justify-center h-full text-center py-8 px-4">
                                        <div className="w-12 h-12 rounded-xl bg-[#21262d] border border-dashed border-[#30363d] flex items-center justify-center mb-3">
                                            <i className="ri-upload-cloud-2-line text-xl text-[#484f58]"></i>
                                        </div>
                                        <p className="text-[#8b949e] text-sm font-medium mb-1">No files yet</p>
                                        <p className="text-[#484f58] text-xs leading-relaxed">
                                            Drag & drop files or folders,<br />
                                            use the upload buttons above,<br />
                                            or ask <span className="text-violet-400 font-mono">@ai</span> to generate code
                                        </p>
                                    </div>
                                ) : (
                                    Object.keys(fileTree).map((file, i) => (
                                        <div
                                            key={i}
                                            onClick={() => {
                                                setCurrentFile(file)
                                                setOpenFiles([ ...new Set([ ...openFiles, file ]) ])
                                                setActivePanel('chat')
                                            }}
                                            className={`group flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-[#21262d] ${currentFile === file ? 'bg-[#21262d]' : ''}`}
                                        >
                                            <i className={`${getFileIcon(file)} ${getFileIconColor(file)} text-sm shrink-0`}></i>
                                            <span className={`flex-1 truncate font-mono text-xs ${currentFile === file ? 'text-white' : 'text-[#8b949e]'}`}>{file}</span>
                                            <button
                                                onClick={(e) => deleteFile(file, e)}
                                                title="Delete file"
                                                className="w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-400 text-[#8b949e] shrink-0"
                                            ><i className="ri-delete-bin-line text-xs"></i></button>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Drop hint at bottom */}
                            {Object.keys(fileTree).length > 0 && (
                                <div className="px-3 py-2 border-t border-[#21262d] shrink-0">
                                    <p className="text-[#484f58] text-xs text-center">
                                        <i className="ri-drag-drop-line mr-1"></i>Drag & drop to add more files
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </aside>

                {/* ── MIDDLE: Code editor ── */}
                <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">

                    {/* File tabs */}
                    <div className="flex items-center bg-[#161b22] border-b border-[#21262d] overflow-x-auto shrink-0 h-9">
                        {openFiles.length === 0 && (
                            <span className="px-4 text-[#484f58] text-xs italic">No file open</span>
                        )}
                        {openFiles.map((file, i) => (
                            <button
                                key={i}
                                onClick={() => setCurrentFile(file)}
                                className={`flex items-center gap-2 px-4 h-full text-xs font-mono border-r border-[#21262d] shrink-0 transition-colors ${
                                    currentFile === file
                                        ? 'bg-[#0d1117] text-white border-t border-t-indigo-500'
                                        : 'text-[#8b949e] hover:text-white hover:bg-[#1c2128]'
                                }`}
                            >
                                <i className={`${getFileIcon(file)} ${getFileIconColor(file)} text-xs`}></i>
                                {file}
                                <span
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        const next = openFiles.filter(f => f !== file)
                                        setOpenFiles(next)
                                        if (currentFile === file) setCurrentFile(next[next.length - 1] || null)
                                    }}
                                    className="ml-1 opacity-40 hover:opacity-100 hover:text-red-400 text-xs leading-none"
                                >×</span>
                            </button>
                        ))}
                    </div>

                    {/* Editor body */}
                    <div className="flex-1 overflow-auto bg-[#0d1117]">
                        {currentFile && fileTree[currentFile] ? (
                            <Editor
                                height="100%"
                                language={getEditorLanguage(currentFile)}
                                theme="vs-dark"
                                value={editorValue}
                                onChange={(value) => {
                                    const nextValue = value ?? ''
                                    setEditorValue(nextValue)
                                    const ft = {
                                        ...fileTree,
                                        [currentFile]: { file: { contents: nextValue } }
                                    }
                                    setFileTree(ft)
                                    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current)
                                    saveDebounceRef.current = setTimeout(() => saveFileTree(ft), 400)
                                }}
                                options={{
                                    minimap: { enabled: false },
                                    fontSize: 13,
                                    lineHeight: 20,
                                    fontLigatures: true,
                                    automaticLayout: true,
                                    cursorSmoothCaretAnimation: 'on',
                                    smoothScrolling: true,
                                    scrollBeyondLastLine: false,
                                    wordWrap: 'off',
                                    renderWhitespace: 'selection',
                                    tabSize: 2,
                                    insertSpaces: true,
                                    bracketPairColorization: { enabled: true },
                                    guides: { indentation: true },
                                    padding: { top: 12, bottom: 96 },
                                    overviewRulerBorder: false,
                                    glyphMargin: false,
                                    folding: true,
                                    renderLineHighlight: 'all',
                                    stickyScroll: { enabled: true },
                                }}
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-center">
                                <div className="w-16 h-16 rounded-2xl bg-[#161b22] border border-[#21262d] flex items-center justify-center mb-4">
                                    <i className="ri-code-s-slash-line text-3xl text-[#484f58]"></i>
                                </div>
                                <p className="text-[#8b949e] text-sm">No file selected</p>
                                <p className="text-[#484f58] text-xs mt-1">Pick a file from the Files tab or ask <span className="text-violet-400 font-mono">@ai</span> to generate code</p>
                            </div>
                        )}
                    </div>

                    {/* Terminal */}
                    {termOpen && (
                        <div className="flex flex-col bg-[#0d1117] border-t border-[#21262d] shrink-0" style={{ height: '260px' }}>

                            {/* Header */}
                            <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#21262d] shrink-0">
                                <div className="flex items-center gap-2">
                                    <div className="flex gap-1.5">
                                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/70"></div>
                                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70"></div>
                                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/70"></div>
                                    </div>
                                    <span className="text-[#8b949e] text-xs font-medium">Terminal</span>
                                    {isRunning && <span className="flex items-center gap-1 text-emerald-400 text-xs"><i className="ri-loader-4-line animate-spin"></i>running</span>}
                                    {waitingInput && <span className="flex items-center gap-1 text-amber-400 text-xs"><i className="ri-keyboard-line"></i>waiting for input</span>}
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <select
                                        value={termLang}
                                        onChange={(e) => setTermLang(e.target.value)}
                                        className="bg-[#21262d] border border-[#30363d] text-[#8b949e] text-xs rounded px-2 py-1 outline-none"
                                    >
                                        {(runtimes.length > 0 ? runtimes : [
                                            {key:'javascript',label:'JavaScript'},{key:'typescript',label:'TypeScript'},
                                            {key:'python',label:'Python 3'},{key:'cpp',label:'C++ (g++)'},
                                            {key:'c',label:'C (gcc)'},{key:'java',label:'Java'},
                                            {key:'bash',label:'Bash'},{key:'php',label:'PHP'},
                                            {key:'ruby',label:'Ruby'},{key:'go',label:'Go'},
                                            {key:'rust',label:'Rust'},{key:'lua',label:'Lua'},{key:'perl',label:'Perl'},
                                        ]).map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
                                    </select>
                                    <button onClick={runCode} disabled={isRunning}
                                        className="flex items-center gap-1 px-2 py-1 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs rounded">
                                        {isRunning ? <><i className="ri-loader-4-line animate-spin text-xs"></i>Running</> : <><i className="ri-play-fill text-xs"></i>Run</>}
                                    </button>
                                    {isRunning && (
                                        <button onClick={killProcess} title="Kill process"
                                            className="flex items-center gap-1 px-2 py-1 bg-red-700 hover:bg-red-600 text-white text-xs rounded">
                                            <i className="ri-stop-fill text-xs"></i>Stop
                                        </button>
                                    )}
                                    <button onClick={() => setRunLog([])} title="Clear"
                                        className="w-6 h-6 flex items-center justify-center text-[#8b949e] hover:text-white hover:bg-[#21262d] rounded">
                                        <i className="ri-delete-bin-line text-xs"></i>
                                    </button>
                                    <button onClick={() => setTermOpen(false)}
                                        className="w-6 h-6 flex items-center justify-center text-[#8b949e] hover:text-white hover:bg-[#21262d] rounded">
                                        <i className="ri-close-line text-sm"></i>
                                    </button>
                                </div>
                            </div>

                            {/* Output area */}
                            <div ref={termLogRef} className="flex-1 overflow-y-auto px-3 py-2 font-mono text-xs">
                                {runLog.length === 0 && (
                                    <p className="text-[#484f58]">Press Run (▶) to execute the current file. Use the input below to send stdin while running.</p>
                                )}
                                {runLog.map((entry, i) => (
                                    <span key={i} className={`block whitespace-pre-wrap leading-5 ${
                                        entry.type === 'stdout' ? 'text-[#e6edf3]' :
                                        entry.type === 'stdin'  ? 'text-cyan-400' :
                                        entry.type === 'stderr' || entry.type === 'error' ? 'text-red-400' :
                                        'text-[#8b949e]'
                                    }`}>{entry.type === 'stdin' ? `> ${entry.data}` : entry.data}</span>
                                ))}
                            </div>

                            {/* Interactive stdin input — active while the process is running */}
                            <form onSubmit={sendTermInput}
                                className={`flex items-center gap-2 px-3 py-1.5 border-t border-[#21262d] shrink-0 transition-colors ${isRunning ? 'bg-[#0d1117]' : 'bg-[#161b22]'}`}>
                                <span className={`font-mono text-xs shrink-0 ${waitingInput ? 'text-emerald-400' : 'text-[#484f58]'}`}>
                                    {isRunning ? '>' : '─'}
                                </span>
                                <input
                                    value={termInput}
                                    onChange={(e) => setTermInput(e.target.value)}
                                    disabled={!isRunning}
                                    placeholder={
                                        isRunning
                                            ? 'Type input and press Enter while the program runs...'
                                            : 'Run a program to enable input'
                                    }
                                    className="flex-1 bg-transparent text-white text-xs font-mono outline-none placeholder-[#484f58] disabled:opacity-30 disabled:cursor-not-allowed"
                                    autoFocus={isRunning}
                                />
                                {isRunning && (
                                    <button type="submit" disabled={!termInput.trim()}
                                        className="text-emerald-400 hover:text-emerald-300 disabled:opacity-30 text-xs px-1">
                                        <i className="ri-send-plane-fill"></i>
                                    </button>
                                )}
                            </form>
                        </div>
                    )}

                    {/* Open terminal button when closed */}
                    {!termOpen && (
                        <div className="flex items-center gap-2 px-3 py-1 bg-[#161b22] border-t border-[#21262d] shrink-0">
                            <button onClick={() => setTermOpen(true)}
                                className="flex items-center gap-1.5 text-[#8b949e] hover:text-white text-xs">
                                <i className="ri-terminal-line text-xs"></i>
                                <span>Terminal</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* ── RIGHT: Preview iframe ── */}
                {iframeUrl && webContainer && (
                    <div className="flex flex-col w-96 shrink-0 border-l border-[#21262d] bg-[#161b22] h-full">
                        <div className="flex items-center gap-2 px-3 h-9 border-b border-[#21262d] shrink-0">
                            <div className="flex gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-red-500/60"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/60"></div>
                            </div>
                            <div className="flex-1 flex items-center gap-2 bg-[#0d1117] border border-[#30363d] rounded-md px-2 py-1">
                                <i className="ri-lock-line text-[#484f58] text-xs"></i>
                                <input
                                    type="text"
                                    value={iframeUrl}
                                    onChange={(e) => setIframeUrl(e.target.value)}
                                    className="flex-1 bg-transparent text-[#8b949e] text-xs outline-none font-mono truncate"
                                />
                            </div>
                            <button onClick={() => setIframeUrl(null)} className="text-[#8b949e] hover:text-white">
                                <i className="ri-close-line text-sm"></i>
                            </button>
                        </div>
                        <iframe src={iframeUrl} className="flex-1 w-full bg-white" title="preview" />
                    </div>
                )}
            </div>

            {/* Members side panel */}
            <div className={`fixed right-0 top-0 h-full w-72 bg-[#161b22] border-l border-[#21262d] z-30 flex flex-col shadow-2xl transition-transform duration-200 ${isSidePanelOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="flex items-center justify-between px-4 h-11 border-b border-[#21262d] shrink-0">
                    <div className="flex items-center gap-2">
                        <i className="ri-group-line text-[#8b949e]"></i>
                        <span className="text-white font-medium text-sm">Members</span>
                        <span className="px-1.5 py-0.5 rounded-full bg-[#21262d] text-[#8b949e] text-xs">{collaboratorCount}</span>
                    </div>
                    <button onClick={() => setIsSidePanelOpen(false)} className="text-[#8b949e] hover:text-white p-1 rounded-lg hover:bg-[#21262d]">
                        <i className="ri-close-line"></i>
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-1">
                    {project.users?.map((u, i) => (
                        <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#21262d]">
                            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
                                <span className="text-white text-xs font-semibold uppercase">
                                    {(u.email || u)[0]}
                                </span>
                            </div>
                            <div className="min-w-0">
                                <p className="text-[#cdd9e5] text-sm truncate">{u.email || u}</p>
                                {i === 0 && <p className="text-[#8b949e] text-xs">Owner</p>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            {isSidePanelOpen && (
                <div className="fixed inset-0 z-20" onClick={() => setIsSidePanelOpen(false)} />
            )}

            {/* Invite collaborator modal */}
            {isModalOpen && (
                <div className="fixed inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-50 px-4">
                    <div className="bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl w-full max-w-md">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-[#21262d]">
                            <div>
                                <h2 className="text-white font-semibold text-sm">Invite Collaborator</h2>
                                <p className="text-[#8b949e] text-xs mt-0.5">They'll receive an email with a join link</p>
                            </div>
                            <button
                                onClick={() => { setIsModalOpen(false); setInviteStatus(null); setInviteEmail('') }}
                                className="text-[#8b949e] hover:text-white p-1 rounded-lg hover:bg-[#21262d]"
                            >
                                <i className="ri-close-line text-lg"></i>
                            </button>
                        </div>

                        <form onSubmit={sendInvite} className="p-5 space-y-4">
                            <div>
                                <label className="block text-[#cdd9e5] text-xs font-medium mb-1.5">
                                    Email address
                                </label>
                                <div className="flex items-center gap-2 bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2.5 focus-within:border-indigo-500/70">
                                    <i className="ri-mail-line text-[#484f58] text-sm shrink-0"></i>
                                    <input
                                        autoFocus
                                        type="email"
                                        value={inviteEmail}
                                        onChange={(e) => { setInviteEmail(e.target.value); setInviteStatus(null) }}
                                        placeholder="teammate@example.com"
                                        required
                                        className="flex-1 bg-transparent text-white text-sm placeholder-[#484f58] outline-none"
                                    />
                                </div>
                                <p className="text-[#484f58] text-xs mt-1.5">They'll get an email — no account needed to receive the invite</p>
                            </div>

                            {/* Status feedback */}
                            {inviteStatus && (
                                <div className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-sm ${
                                    inviteStatus.type === 'success'
                                        ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                                        : 'bg-red-500/10 border border-red-500/20 text-red-400'
                                }`}>
                                    <i className={`shrink-0 mt-0.5 ${inviteStatus.type === 'success' ? 'ri-checkbox-circle-line' : 'ri-error-warning-line'}`}></i>
                                    <span>{inviteStatus.msg}</span>
                                </div>
                            )}

                            {/* How it works */}
                            <div className="bg-[#0d1117] border border-[#21262d] rounded-lg p-3 space-y-2">
                                <p className="text-[#8b949e] text-xs font-medium">How it works</p>
                                {[
                                    ['ri-mail-send-line', 'An invite email is sent to their inbox'],
                                    ['ri-user-add-line', 'If new, they create a free account first'],
                                    ['ri-cursor-line', 'They click accept and join the project'],
                                    ['ri-team-line', 'They appear as a collaborator instantly'],
                                ].map(([icon, text], i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <i className={`${icon} text-indigo-400 text-sm shrink-0`}></i>
                                        <span className="text-[#8b949e] text-xs">{text}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="flex gap-3 pt-1">
                                <button
                                    type="button"
                                    onClick={() => { setIsModalOpen(false); setInviteStatus(null); setInviteEmail('') }}
                                    className="flex-1 py-2.5 text-[#8b949e] hover:text-white hover:bg-[#21262d] rounded-lg text-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={inviteSending || !inviteEmail.trim()}
                                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                                >
                                    {inviteSending
                                        ? <><i className="ri-loader-4-line animate-spin"></i>Sending...</>
                                        : <><i className="ri-send-plane-line"></i>Send Invite</>
                                    }
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

export default Project
