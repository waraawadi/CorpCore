'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useStore } from '@/lib/store'
import { getApiBaseUrl, formatApiErrorBody } from '@/lib/api'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { SearchableSelect, type SearchableOption } from '@/components/ui/searchable-select'
import {
  ChevronRight,
  Eye,
  FileArchive,
  FileAudio,
  FileCode2,
  FileImage,
  FileSpreadsheet,
  FileVideo,
  FileText,
  Folder,
  FolderPlus,
  LayoutGrid,
  List,
  Maximize2,
  Minimize2,
  MoreVertical,
  Pencil,
  Share2,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react'

type GedFolder = {
  id: string
  name: string
  parent: string | null
  created_by: number | null
  has_content?: boolean
  my_permission?: string | null
  can_share?: boolean
  created_at: string
}

type GedDocument = {
  id: string
  title: string
  description: string
  folder: string | null
  file_url: string
  original_filename: string
  mime_type: string
  file_size: number
  uploaded_by: number | null
  uploaded_by_name: string
  my_permission?: string | null
  can_share?: boolean
  created_at: string
}

type GedShare = {
  id: string
  folder: string | null
  document: string | null
  shared_with: number
  shared_with_name: string
  shared_by: number
  shared_by_name: string
  role: string
  inherited?: boolean
  share_folder_name?: string
  can_manage?: boolean
  created_at: string
}

type HrUserOption = {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  full_name: string
}

const API_BASE = getApiBaseUrl()
const ACCESS_TOKEN_KEY = 'corpcore_access_token'
const ONLYOFFICE_BASE = (process.env.NEXT_PUBLIC_ONLYOFFICE_URL || 'http://localhost:8089').trim().replace(/\/$/, '')

type OnlyofficeEditor = { destroyEditor?: () => void; resize?: () => void }
type OnlyofficeDocsApi = {
  DocEditor: new (elementId: string, config: Record<string, unknown>) => OnlyofficeEditor
}

function previewKindFor(doc: GedDocument): 'onlyoffice' | 'pdf' | 'video' | 'audio' | 'image' | null {
  const mime = (doc.mime_type || '').toLowerCase()
  const name = doc.original_filename || doc.title || ''
  const ext = name.includes('.') ? (name.split('.').pop() || '').toLowerCase() : ''
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  if (mime.startsWith('image/')) return 'image'
  if (mime === 'application/pdf' || ext === 'pdf') return 'onlyoffice'
  const ooExts = new Set([
    'doc',
    'docm',
    'docx',
    'dot',
    'dotx',
    'odt',
    'ott',
    'rtf',
    'txt',
    'htm',
    'html',
    'mht',
    'csv',
    'xls',
    'xlsx',
    'xlsm',
    'xlt',
    'xltx',
    'ppt',
    'pptx',
    'pptm',
    'ppsx',
    'odp',
    'potx',
  ])
  if (ooExts.has(ext)) return 'onlyoffice'
  return null
}

function loadOnlyOfficeScript(baseUrl: string): Promise<void> {
  const w = typeof window !== 'undefined' ? (window as unknown as { DocsAPI?: OnlyofficeDocsApi }) : null
  if (w?.DocsAPI) return Promise.resolve()
  const base = baseUrl.replace(/\/$/, '')
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = `${base}/web-apps/apps/api/documents/api.js`
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Chargement du script ONLYOFFICE impossible'))
    document.body.appendChild(s)
  })
}

async function loadOnlyOfficeScriptWithFallback(primaryBaseUrl: string): Promise<void> {
  const candidates = Array.from(
    new Set(
      [primaryBaseUrl, ONLYOFFICE_BASE, 'http://localhost:8089']
        .map((v) => (v || '').trim().replace(/\/$/, ''))
        .filter(Boolean)
    )
  )
  let lastError: Error | null = null
  for (const candidate of candidates) {
    try {
      await loadOnlyOfficeScript(candidate)
      return
    } catch (e) {
      lastError = e instanceof Error ? e : new Error('Chargement script ONLYOFFICE échoué')
    }
  }
  throw lastError || new Error('Chargement du script ONLYOFFICE impossible')
}

function formatBytes(n: number) {
  if (!n) return '0 o'
  const u = ['o', 'Ko', 'Mo', 'Go']
  let i = 0
  let v = n
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024
    i += 1
  }
  return `${v.toFixed(i ? 1 : 0)} ${u[i]}`
}

function fileExt(doc: GedDocument) {
  const name = doc.original_filename || doc.title || ''
  if (!name.includes('.')) return ''
  return (name.split('.').pop() || '').toLowerCase()
}

function isImageDoc(doc: GedDocument) {
  return (doc.mime_type || '').toLowerCase().startsWith('image/')
}

function isPdfDoc(doc: GedDocument) {
  const mime = (doc.mime_type || '').toLowerCase()
  return mime === 'application/pdf' || fileExt(doc) === 'pdf'
}

function fileIcon(doc: GedDocument) {
  const m = (doc.mime_type || '').toLowerCase()
  const ext = fileExt(doc)
  if (isImageDoc(doc)) return FileImage
  if (isPdfDoc(doc)) return FileText
  if (m.startsWith('video/')) return FileVideo
  if (m.startsWith('audio/')) return FileAudio
  if (['xls', 'xlsx', 'xlsm', 'csv', 'ods'].includes(ext)) return FileSpreadsheet
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return FileArchive
  if (['js', 'ts', 'tsx', 'json', 'xml', 'yml', 'yaml', 'py', 'java', 'php', 'go', 'rs'].includes(ext)) return FileCode2
  return FileText
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null
  const isFormData = init?.body instanceof FormData
  const method = (init?.method || 'GET').toUpperCase()
  /* DELETE sans corps : ne pas envoyer Content-Type: application/json (proxies / navigateurs). */
  const omitJsonContentType = isFormData || method === 'DELETE' || method === 'GET' || method === 'HEAD'
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(omitJsonContentType ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  })
  if (!response.ok) {
    let detail = ''
    try {
      const body = await response.json()
      detail = formatApiErrorBody(body)
    } catch {
      detail = ''
    }
    throw new Error(detail || `Requete echouee (${response.status})`)
  }
  const text = await response.text()
  return (text ? JSON.parse(text) : undefined) as T
}

export default function GedPage() {
  const authUser = useStore((s) => s.authUser)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [folders, setFolders] = useState<GedFolder[]>([])
  const [documents, setDocuments] = useState<GedDocument[]>([])
  const [thumbByDocId, setThumbByDocId] = useState<Record<string, string | null>>({})
  const [hrUsers, setHrUsers] = useState<HrUserOption[]>([])
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [folderPath, setFolderPath] = useState<GedFolder[]>([])
  const [driveScope, setDriveScope] = useState<'drive' | 'shared'>('drive')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const [folderDialogOpen, setFolderDialogOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadDescription, setUploadDescription] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [createOfficeDialogOpen, setCreateOfficeDialogOpen] = useState(false)
  const [createOfficeType, setCreateOfficeType] = useState<'docx' | 'xlsx' | 'pptx'>('docx')
  const [createOfficeTitle, setCreateOfficeTitle] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [pendingDelete, setPendingDelete] = useState<GedDocument | null>(null)
  const [docSearch, setDocSearch] = useState('')
  const [renameFolder, setRenameFolder] = useState<GedFolder | null>(null)
  const [renameFolderName, setRenameFolderName] = useState('')
  const [pendingDeleteFolder, setPendingDeleteFolder] = useState<GedFolder | null>(null)

  const [shareTarget, setShareTarget] = useState<{ type: 'folder' | 'document'; item: GedFolder | GedDocument } | null>(
    null
  )
  const [shares, setShares] = useState<GedShare[]>([])
  const [shareUserId, setShareUserId] = useState('')
  const [shareRole, setShareRole] = useState<'viewer' | 'editor'>('viewer')
  const [loadingShares, setLoadingShares] = useState(false)

  const [preview, setPreview] = useState<{
    doc: GedDocument
    kind: 'onlyoffice' | 'pdf' | 'video' | 'audio' | 'image'
  } | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewFullscreen, setPreviewFullscreen] = useState(false)
  const onlyofficeMountRef = useRef<HTMLDivElement>(null)
  const onlyofficeEditorRef = useRef<OnlyofficeEditor | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const audioAnalyserRef = useRef<AnalyserNode | null>(null)
  const audioSourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const audioSourceElementRef = useRef<HTMLAudioElement | null>(null)
  const audioFreqRef = useRef<Uint8Array | null>(null)
  const audioRafRef = useRef<number | null>(null)

  const loadFolders = useCallback(async () => {
    const params = new URLSearchParams()
    if (driveScope === 'shared') params.set('scope', 'shared')
    const qs = params.toString()
    const data = await apiRequest<GedFolder[]>(`/ged/folders/${qs ? `?${qs}` : ''}`)
    setFolders(data)
  }, [driveScope])

  const loadDocuments = useCallback(async () => {
    const params = new URLSearchParams()
    if (currentFolderId === null) params.set('folder', '')
    else params.set('folder', currentFolderId)
    const q = docSearch.trim()
    if (q) params.set('search', q)
    if (driveScope === 'shared') params.set('scope', 'shared')
    const data = await apiRequest<GedDocument[]>(`/ged/documents/?${params.toString()}`)
    setDocuments(data)
  }, [currentFolderId, docSearch, driveScope])

  const loadHrUsers = useCallback(async () => {
    try {
      const data = await apiRequest<HrUserOption[]>('/hr/users/')
      setHrUsers(data)
    } catch {
      setHrUsers([])
    }
  }, [])

  const refreshAll = useCallback(async () => {
    setError(null)
    try {
      await Promise.all([loadFolders(), loadDocuments()])
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur de chargement'
      setError(msg)
      notify.error(msg)
    }
  }, [loadFolders, loadDocuments])

  useEffect(() => {
    void loadHrUsers()
  }, [loadHrUsers])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        await loadFolders()
        if (!cancelled) setError(null)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erreur de chargement'
        if (!cancelled) {
          setError(msg)
          notify.error(msg)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [loadFolders])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        await loadDocuments()
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erreur documents'
        if (!cancelled) {
          setError(msg)
          notify.error(msg)
        }
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [loadDocuments])

  useEffect(() => {
    const targets = documents.filter((d) => (isImageDoc(d) || isPdfDoc(d)) && !(d.id in thumbByDocId))
    if (!targets.length) return
    let cancelled = false
    const run = async () => {
      for (const d of targets) {
        try {
          const data = await apiRequest<{ url: string }>(`/ged/documents/${d.id}/preview-url/`)
          if (cancelled) return
          setThumbByDocId((prev) => ({ ...prev, [d.id]: data.url || null }))
        } catch {
          if (cancelled) return
          setThumbByDocId((prev) => ({ ...prev, [d.id]: null }))
        }
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [documents, thumbByDocId])

  const folderById = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders])

  const rebuildPath = useCallback(
    (folderId: string | null) => {
      if (!folderId) {
        setFolderPath([])
        return
      }
      const path: GedFolder[] = []
      let cur: GedFolder | undefined = folderById.get(folderId)
      while (cur) {
        path.unshift(cur)
        cur = cur.parent ? folderById.get(cur.parent) : undefined
      }
      setFolderPath(path)
    },
    [folderById]
  )

  useEffect(() => {
    rebuildPath(currentFolderId)
  }, [currentFolderId, rebuildPath])

  const childFolders = useMemo(
    () => folders.filter((f) => (currentFolderId === null ? f.parent == null : f.parent === currentFolderId)),
    [folders, currentFolderId]
  )

  const userOptions = useMemo<SearchableOption[]>(() => {
    const blocked = new Set<number>()
    if (authUser?.id) blocked.add(authUser.id)
    for (const s of shares) blocked.add(s.shared_with)
    if (shareTarget?.type === 'folder') {
      const f = shareTarget.item as GedFolder
      if (f.created_by != null) blocked.add(f.created_by)
    }
    if (shareTarget?.type === 'document') {
      const d = shareTarget.item as GedDocument
      if (d.uploaded_by != null) blocked.add(d.uploaded_by)
    }
    return hrUsers
      .filter((u) => !blocked.has(u.id))
      .map((u) => ({
        value: String(u.id),
        label: u.full_name || [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || u.username,
        keywords: `${u.email} ${u.username}`,
      }))
  }, [hrUsers, authUser?.id, shares, shareTarget])

  const enterFolder = (id: string) => {
    setCurrentFolderId(id)
  }

  const goToCrumb = (index: number) => {
    if (index < 0) {
      setCurrentFolderId(null)
      return
    }
    setCurrentFolderId(folderPath[index]?.id ?? null)
  }

  const goDriveRoot = () => {
    setDriveScope('drive')
    setCurrentFolderId(null)
  }

  const goShared = () => {
    setDriveScope('shared')
    setCurrentFolderId(null)
  }

  const submitFolder = async (e: FormEvent) => {
    e.preventDefault()
    if (!newFolderName.trim()) {
      notify.warning('Nom du dossier requis.')
      return
    }
    setSubmitting(true)
    try {
      await apiRequest('/ged/folders/', {
        method: 'POST',
        body: JSON.stringify({
          name: newFolderName.trim(),
          parent: currentFolderId,
        }),
      })
      setNewFolderName('')
      setFolderDialogOpen(false)
      await refreshAll()
      notify.success('Dossier cree')
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSubmitting(false)
    }
  }

  const submitUpload = async (e: FormEvent) => {
    e.preventDefault()
    if (!uploadTitle.trim() || !uploadFile) {
      notify.warning('Titre et fichier sont obligatoires.')
      return
    }
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('title', uploadTitle.trim())
      fd.append('description', uploadDescription)
      if (currentFolderId) fd.append('folder', currentFolderId)
      fd.append('file', uploadFile)
      await apiRequest('/ged/documents/', { method: 'POST', body: fd })
      setUploadTitle('')
      setUploadDescription('')
      setUploadFile(null)
      setUploadDialogOpen(false)
      await refreshAll()
      notify.success('Document envoye')
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Erreur envoi')
    } finally {
      setSubmitting(false)
    }
  }

  const submitCreateOffice = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const created = await apiRequest<GedDocument>('/ged/documents/create-office/', {
        method: 'POST',
        body: JSON.stringify({
          kind: createOfficeType,
          title: createOfficeTitle.trim() || undefined,
          folder: currentFolderId,
        }),
      })
      setCreateOfficeDialogOpen(false)
      setCreateOfficeTitle('')
      setCreateOfficeType('docx')
      await refreshAll()
      notify.success('Fichier cree')
      await openPreview(created)
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Erreur creation fichier')
    } finally {
      setSubmitting(false)
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setSubmitting(true)
    try {
      await apiRequest(`/ged/documents/${pendingDelete.id}/`, { method: 'DELETE' })
      setPendingDelete(null)
      await refreshAll()
      notify.success('Document supprime')
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Erreur suppression')
    } finally {
      setSubmitting(false)
    }
  }

  const canDelete = (doc: GedDocument) => {
    if (!authUser) return false
    if (authUser.is_staff || authUser.is_superuser) return true
    return doc.my_permission === 'owner' || doc.my_permission === 'editor'
  }

  const canDeleteFolder = (f: GedFolder) => {
    if (!authUser) return false
    if (!canEditFolder(f)) return false
    if (authUser.is_staff || authUser.is_superuser) return true
    return f.has_content === false
  }

  const canEditFolder = (f: GedFolder) => f.my_permission === 'owner' || f.my_permission === 'editor'

  const closePreview = useCallback(() => {
    onlyofficeEditorRef.current?.destroyEditor?.()
    onlyofficeEditorRef.current = null
    if (onlyofficeMountRef.current) onlyofficeMountRef.current.innerHTML = ''
    setPreviewUrl((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
      return null
    })
    setPreview(null)
    setPreviewLoading(false)
    setPreviewFullscreen(false)
  }, [])

  const openPreview = useCallback(async (doc: GedDocument) => {
    const kind = previewKindFor(doc)
    if (!kind) {
      notify.error('Apercu non disponible pour ce type de fichier.')
      return
    }
    if (kind === 'onlyoffice') {
      setPreviewUrl(null)
      setPreview({ doc, kind })
      return
    }
    setPreviewLoading(true)
    try {
      const { url } = await apiRequest<{ url: string }>(`/ged/documents/${doc.id}/preview-url/`)
      let nextUrl: string
      try {
        const res = await fetch(url)
        if (!res.ok) throw new Error('HTTP')
        const blob = await res.blob()
        nextUrl = URL.createObjectURL(blob)
      } catch {
        /* Sans blob: iframe vers l’API — le backend doit autoriser l’embedding (X-Frame-Options). */
        nextUrl = url
      }
      setPreviewUrl((prev) => {
        if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
        return nextUrl
      })
      setPreview({ doc, kind })
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Impossible de preparer l\'apercu')
    } finally {
      setPreviewLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!preview || preview.kind !== 'onlyoffice') return
    let cancelled = false
    const run = async () => {
      setPreviewLoading(true)
      onlyofficeEditorRef.current?.destroyEditor?.()
      onlyofficeEditorRef.current = null
      if (onlyofficeMountRef.current) onlyofficeMountRef.current.innerHTML = ''
      try {
        const cfg = await apiRequest<{ documentServerUrl: string; token: string; config?: Record<string, unknown> }>(
          `/ged/documents/${preview.doc.id}/onlyoffice-config/`
        )
        await loadOnlyOfficeScriptWithFallback(cfg.documentServerUrl)
        const api = (window as unknown as { DocsAPI?: OnlyofficeDocsApi }).DocsAPI
        if (cancelled || !onlyofficeMountRef.current || !api) return
        const holderId = `oo-${preview.doc.id.replace(/-/g, '')}-${Date.now()}`
        onlyofficeMountRef.current.innerHTML = `<div id="${holderId}" class="h-full min-h-[520px] w-full" />`
        const editorConfig = {
          ...(cfg.config || {}),
          token: cfg.token,
          width: '100%',
          height: '100%',
          type: 'desktop',
        }
        onlyofficeEditorRef.current = new api.DocEditor(holderId, {
          ...editorConfig,
        })
      } catch (e) {
        if (!cancelled) {
          notify.error(e instanceof Error ? e.message : 'Erreur ONLYOFFICE')
          setPreview(null)
        }
      } finally {
        if (!cancelled) setPreviewLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
      onlyofficeEditorRef.current?.destroyEditor?.()
      onlyofficeEditorRef.current = null
    }
  }, [preview])

  useEffect(() => {
    if (!preview || preview.kind !== 'onlyoffice') return
    const timer = window.setTimeout(() => {
      onlyofficeEditorRef.current?.resize?.()
    }, 120)
    return () => window.clearTimeout(timer)
  }, [preview, previewFullscreen])

  useEffect(() => {
    if (!preview || preview.kind !== 'audio' || !previewUrl) return
    const audioEl = audioRef.current
    const canvas = audioCanvasRef.current
    if (!audioEl || !canvas || typeof window === 'undefined') return

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return

    if (!audioCtxRef.current) audioCtxRef.current = new AudioCtx()
    const ctx = audioCtxRef.current
    if (!ctx) return

    if (!audioAnalyserRef.current) {
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.82
      audioAnalyserRef.current = analyser
      audioFreqRef.current = new Uint8Array(analyser.frequencyBinCount)
    }
    const analyser = audioAnalyserRef.current
    const freq = audioFreqRef.current
    if (!analyser || !freq) return

    const sourceElementChanged = audioSourceElementRef.current && audioSourceElementRef.current !== audioEl
    if (sourceElementChanged) {
      audioSourceRef.current?.disconnect()
      audioSourceRef.current = null
      audioSourceElementRef.current = null
    }

    if (!audioSourceRef.current || audioSourceElementRef.current !== audioEl) {
      const source = ctx.createMediaElementSource(audioEl)
      source.connect(analyser)
      analyser.connect(ctx.destination)
      audioSourceRef.current = source
      audioSourceElementRef.current = audioEl
    }

    const c2d = canvas.getContext('2d')
    if (!c2d) return

    const render = () => {
      analyser.getByteFrequencyData(freq)
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      c2d.clearRect(0, 0, w, h)
      const bg = c2d.createLinearGradient(0, 0, 0, h)
      bg.addColorStop(0, 'rgba(15, 23, 42, 0.88)')
      bg.addColorStop(1, 'rgba(30, 41, 59, 0.72)')
      c2d.fillStyle = bg
      c2d.fillRect(0, 0, w, h)

      const bars = 56
      const step = Math.max(1, Math.floor(freq.length / bars))
      const gap = 3
      const bw = Math.max(2, (w - gap * (bars - 1)) / bars)
      for (let i = 0; i < bars; i += 1) {
        const v = freq[i * step] / 255
        const bh = Math.max(8, v * (h - 14))
        const x = i * (bw + gap)
        const y = h - bh
        const hue = 188 + Math.floor(v * 70)
        c2d.fillStyle = `hsl(${hue} 92% ${52 + Math.floor(v * 16)}%)`
        c2d.fillRect(x, y, bw, bh)
      }
      audioRafRef.current = window.requestAnimationFrame(render)
    }

    const onPlay = async () => {
      if (ctx.state === 'suspended') await ctx.resume()
    }
    audioEl.addEventListener('play', onPlay)
    void onPlay()
    audioRafRef.current = window.requestAnimationFrame(render)

    return () => {
      audioEl.removeEventListener('play', onPlay)
      if (audioRafRef.current) {
        window.cancelAnimationFrame(audioRafRef.current)
        audioRafRef.current = null
      }
    }
  }, [preview, previewUrl])

  useEffect(() => {
    if (preview?.kind === 'audio') return
    if (audioRafRef.current) window.cancelAnimationFrame(audioRafRef.current)
    audioRafRef.current = null
    audioSourceRef.current?.disconnect()
    audioSourceRef.current = null
    audioSourceElementRef.current = null
    audioAnalyserRef.current?.disconnect()
    audioAnalyserRef.current = null
    audioFreqRef.current = null
    void audioCtxRef.current?.close()
    audioCtxRef.current = null
  }, [preview])

  useEffect(() => {
    return () => {
      if (audioRafRef.current) window.cancelAnimationFrame(audioRafRef.current)
      audioRafRef.current = null
      audioSourceRef.current?.disconnect()
      audioAnalyserRef.current?.disconnect()
      audioSourceRef.current = null
      audioSourceElementRef.current = null
      audioAnalyserRef.current = null
      audioFreqRef.current = null
      void audioCtxRef.current?.close()
      audioCtxRef.current = null
    }
  }, [])

  const submitRenameFolder = async (e: FormEvent) => {
    e.preventDefault()
    if (!renameFolder || !renameFolderName.trim()) return
    setSubmitting(true)
    try {
      await apiRequest(`/ged/folders/${renameFolder.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ name: renameFolderName.trim() }),
      })
      setRenameFolder(null)
      setRenameFolderName('')
      await refreshAll()
      notify.success('Dossier renomme')
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSubmitting(false)
    }
  }

  const confirmDeleteFolder = async () => {
    if (!pendingDeleteFolder) return
    setSubmitting(true)
    try {
      await apiRequest(`/ged/folders/${pendingDeleteFolder.id}/`, { method: 'DELETE' })
      if (pendingDeleteFolder.id === currentFolderId) {
        setCurrentFolderId(pendingDeleteFolder.parent)
      }
      setPendingDeleteFolder(null)
      await refreshAll()
      notify.success('Dossier supprime')
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Erreur suppression')
    } finally {
      setSubmitting(false)
    }
  }

  const openShare = async (type: 'folder' | 'document', item: GedFolder | GedDocument) => {
    setShareTarget({ type, item })
    setShares([])
    setShareUserId('')
    setShareRole('viewer')
    setLoadingShares(true)
    try {
      const q = type === 'folder' ? `folder=${item.id}` : `document=${item.id}`
      const data = await apiRequest<GedShare[]>(`/ged/shares/?${q}`)
      setShares(data)
    } catch {
      setShares([])
    } finally {
      setLoadingShares(false)
    }
  }

  const addShare = async (e: FormEvent) => {
    e.preventDefault()
    if (!shareTarget || !shareUserId) return
    setSubmitting(true)
    try {
      const body =
        shareTarget.type === 'folder'
          ? { folder: shareTarget.item.id, shared_with: Number(shareUserId), role: shareRole }
          : { document: shareTarget.item.id, shared_with: Number(shareUserId), role: shareRole }
      await apiRequest('/ged/shares/', { method: 'POST', body: JSON.stringify(body) })
      setShareUserId('')
      await openShare(shareTarget.type, shareTarget.item)
      await refreshAll()
      notify.success('Partage ajoute')
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSubmitting(false)
    }
  }

  const removeShare = async (s: GedShare) => {
    setSubmitting(true)
    try {
      await apiRequest(`/ged/shares/${s.id}/`, { method: 'DELETE' })
      if (shareTarget) await openShare(shareTarget.type, shareTarget.item)
      await refreshAll()
      notify.success('Partage retire')
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSubmitting(false)
    }
  }

  const updateShareRole = async (s: GedShare, role: 'viewer' | 'editor') => {
    setSubmitting(true)
    try {
      await apiRequest(`/ged/shares/${s.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      })
      if (shareTarget) await openShare(shareTarget.type, shareTarget.item)
      await refreshAll()
      notify.success('Droit mis a jour')
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSubmitting(false)
    }
  }

  const displayDate = (iso: string) => {
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('fr-FR')
  }

  const sortedItems = useMemo(() => {
    const fs = childFolders.map((f) => ({ kind: 'folder' as const, data: f }))
    const ds = documents.map((d) => ({ kind: 'doc' as const, data: d }))
    return [...fs, ...ds].sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1
      const na = a.kind === 'folder' ? a.data.name : a.data.title
      const nb = b.kind === 'folder' ? b.data.name : b.data.title
      return na.localeCompare(nb, 'fr', { sensitivity: 'base' })
    })
  }, [childFolders, documents])

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col md:flex-row">
      <aside className="w-full shrink-0 border-b border-border md:w-56 md:border-b-0 md:border-r md:bg-muted/30">
        <div className="flex gap-1 p-2 md:flex-col md:p-3">
          <Button
            type="button"
            variant={driveScope === 'drive' ? 'secondary' : 'ghost'}
            className="w-full justify-start gap-2"
            onClick={goDriveRoot}
          >
            <Folder className="h-4 w-4 text-blue-600" />
            Mon Drive
          </Button>
          <Button
            type="button"
            variant={driveScope === 'shared' ? 'secondary' : 'ghost'}
            className="w-full justify-start gap-2"
            onClick={goShared}
          >
            <Users className="h-4 w-4 text-emerald-600" />
            Partages avec moi
          </Button>
        </div>
      </aside>

      <div className="min-w-0 flex-1 space-y-4 p-4 md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Drive</h1>
            <p className="text-sm text-muted-foreground">Documents partages au sein de votre entreprise.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={viewMode === 'grid' ? 'secondary' : 'outline'}
              size="icon"
              aria-label="Grille"
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={viewMode === 'list' ? 'secondary' : 'outline'}
              size="icon"
              aria-label="Liste"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button type="button" variant="outline" onClick={() => setFolderDialogOpen(true)} disabled={driveScope === 'shared'}>
              <FolderPlus className="mr-2 h-4 w-4" />
              Nouveau dossier
            </Button>
            <Button type="button" variant="outline" onClick={() => setCreateOfficeDialogOpen(true)} disabled={driveScope === 'shared'}>
              <FileText className="mr-2 h-4 w-4" />
              Nouveau fichier
            </Button>
            <Button type="button" onClick={() => setUploadDialogOpen(true)} disabled={driveScope === 'shared'}>
              <Upload className="mr-2 h-4 w-4" />
              Importer
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <nav className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
            <button type="button" className="hover:text-foreground" onClick={() => goToCrumb(-1)}>
              {driveScope === 'shared' ? 'Partages' : 'Mon Drive'}
            </button>
            {folderPath.map((f, i) => (
              <span key={f.id} className="flex items-center gap-1">
                <ChevronRight className="h-4 w-4 shrink-0" />
                <button type="button" className="hover:text-foreground" onClick={() => goToCrumb(i)}>
                  {f.name}
                </button>
              </span>
            ))}
          </nav>
          <Input
            value={docSearch}
            onChange={(e) => setDocSearch(e.target.value)}
            placeholder="Rechercher dans ce dossier..."
            className="sm:max-w-sm"
          />
        </div>

        {loading ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Chargement...</p>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {sortedItems.map((entry) =>
              entry.kind === 'folder' ? (
                <div
                  key={`f-${entry.data.id}`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && enterFolder(entry.data.id)}
                  onClick={() => enterFolder(entry.data.id)}
                  className="group flex cursor-pointer flex-col items-center rounded-xl border border-border/70 bg-card p-4 text-center shadow-sm transition hover:border-primary/40 hover:shadow-md"
                >
                  <div className="relative mb-2 flex h-14 w-14 items-center justify-center rounded-lg bg-blue-500/15">
                    <Folder className="h-10 w-10 text-blue-600" />
                    <div className="absolute right-0 top-0 opacity-0 transition group-hover:opacity-100">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button type="button" size="icon" variant="secondary" className="h-7 w-7">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          {entry.data.can_share ? (
                            <DropdownMenuItem onClick={() => void openShare('folder', entry.data)}>
                              <Share2 className="mr-2 h-4 w-4" /> Partager
                            </DropdownMenuItem>
                          ) : null}
                          {canEditFolder(entry.data) ? (
                            <DropdownMenuItem onClick={() => { setRenameFolder(entry.data); setRenameFolderName(entry.data.name) }}>
                              <Pencil className="mr-2 h-4 w-4" /> Renommer
                            </DropdownMenuItem>
                          ) : null}
                          {canDeleteFolder(entry.data) ? (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setPendingDeleteFolder(entry.data)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Supprimer
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <span className="line-clamp-2 w-full text-sm font-medium leading-tight">{entry.data.name}</span>
                </div>
              ) : (
                <div
                  key={`d-${entry.data.id}`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && void openPreview(entry.data)}
                  onClick={() => void openPreview(entry.data)}
                  className="group flex cursor-pointer flex-col items-center rounded-xl border border-border/70 bg-card p-4 text-center shadow-sm transition hover:border-primary/40 hover:shadow-md"
                >
                  <div className="relative mb-2 flex h-14 w-14 items-center justify-center rounded-lg bg-muted">
                    {(() => {
                      const thumb = thumbByDocId[entry.data.id]
                      if (isImageDoc(entry.data) && thumb) {
                        return (
                          // eslint-disable-next-line @next/next/no-img-element -- URL signee API
                          <img src={thumb} alt="" className="h-12 w-12 rounded object-cover" />
                        )
                      }
                      if (isPdfDoc(entry.data) && thumb) {
                        return (
                          <iframe
                            title={`thumb-${entry.data.id}`}
                            src={`${thumb}#page=1&toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                            className="h-12 w-12 rounded border-0 bg-white"
                          />
                        )
                      }
                      const Icon = fileIcon(entry.data)
                      return <Icon className="h-10 w-10 text-muted-foreground" />
                    })()}
                    <div className="absolute right-0 top-0 opacity-0 transition group-hover:opacity-100">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button type="button" size="icon" variant="secondary" className="h-7 w-7">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          {previewKindFor(entry.data) ? (
                            <DropdownMenuItem
                              onClick={() => {
                                void openPreview(entry.data)
                              }}
                            >
                              <Eye className="mr-2 h-4 w-4" /> Apercu
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuItem asChild>
                            <a href={entry.data.file_url} target="_blank" rel="noopener noreferrer">
                              Ouvrir
                            </a>
                          </DropdownMenuItem>
                          {entry.data.can_share ? (
                            <DropdownMenuItem onClick={() => void openShare('document', entry.data)}>
                              <Share2 className="mr-2 h-4 w-4" /> Partager
                            </DropdownMenuItem>
                          ) : null}
                          {canDelete(entry.data) ? (
                            <DropdownMenuItem className="text-destructive" onClick={() => setPendingDelete(entry.data)}>
                              <Trash2 className="mr-2 h-4 w-4" /> Supprimer
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <span className="line-clamp-2 w-full text-sm font-medium leading-tight">{entry.data.title}</span>
                  <span className="mt-1 text-xs text-muted-foreground">{formatBytes(entry.data.file_size)}</span>
                </div>
              )
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border/80">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Nom</th>
                  <th className="hidden px-4 py-3 sm:table-cell">Proprietaire</th>
                  <th className="hidden px-4 py-3 md:table-cell">Modifie</th>
                  <th className="px-4 py-3 text-right">Taille</th>
                  <th className="w-12 px-2" />
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((entry) =>
                  entry.kind === 'folder' ? (
                    <tr
                      key={`f-${entry.data.id}`}
                      className="cursor-pointer border-t border-border/60 hover:bg-muted/40"
                      onClick={() => enterFolder(entry.data.id)}
                    >
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2 font-medium">
                          <Folder className="h-5 w-5 shrink-0 text-blue-600" />
                          {entry.data.name}
                        </div>
                      </td>
                      <td className="hidden px-4 py-2 text-muted-foreground sm:table-cell">—</td>
                      <td className="hidden px-4 py-2 text-muted-foreground md:table-cell">{displayDate(entry.data.created_at)}</td>
                      <td className="px-4 py-2 text-right text-muted-foreground">—</td>
                      <td className="px-2 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button type="button" size="icon" variant="ghost" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {entry.data.can_share ? (
                              <DropdownMenuItem onClick={() => void openShare('folder', entry.data)}>
                                <Share2 className="mr-2 h-4 w-4" /> Partager
                              </DropdownMenuItem>
                            ) : null}
                            {canEditFolder(entry.data) ? (
                              <DropdownMenuItem onClick={() => { setRenameFolder(entry.data); setRenameFolderName(entry.data.name) }}>
                                <Pencil className="mr-2 h-4 w-4" /> Renommer
                              </DropdownMenuItem>
                            ) : null}
                            {canDeleteFolder(entry.data) ? (
                              <DropdownMenuItem className="text-destructive" onClick={() => setPendingDeleteFolder(entry.data)}>
                                <Trash2 className="mr-2 h-4 w-4" /> Supprimer
                              </DropdownMenuItem>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ) : (
                    <tr key={`d-${entry.data.id}`} className="border-t border-border/60 hover:bg-muted/40">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2 font-medium">
                          {(() => {
                            const thumb = thumbByDocId[entry.data.id]
                            if (isImageDoc(entry.data) && thumb) {
                              return (
                                // eslint-disable-next-line @next/next/no-img-element -- URL signee API
                                <img src={thumb} alt="" className="h-6 w-6 shrink-0 rounded object-cover" />
                              )
                            }
                            if (isPdfDoc(entry.data) && thumb) {
                              return (
                                <iframe
                                  title={`thumb-row-${entry.data.id}`}
                                  src={`${thumb}#page=1&toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                                  className="h-6 w-6 shrink-0 rounded border-0 bg-white"
                                />
                              )
                            }
                            const Icon = fileIcon(entry.data)
                            return <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
                          })()}
                          <button
                            type="button"
                            className="text-left hover:underline"
                            onClick={() => void openPreview(entry.data)}
                          >
                            {entry.data.title}
                          </button>
                        </div>
                      </td>
                      <td className="hidden px-4 py-2 text-muted-foreground sm:table-cell">{entry.data.uploaded_by_name || '—'}</td>
                      <td className="hidden px-4 py-2 text-muted-foreground md:table-cell">{displayDate(entry.data.created_at)}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{formatBytes(entry.data.file_size)}</td>
                      <td className="px-2 py-2 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button type="button" size="icon" variant="ghost" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {previewKindFor(entry.data) ? (
                              <DropdownMenuItem onClick={() => void openPreview(entry.data)}>
                                <Eye className="mr-2 h-4 w-4" /> Apercu
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuItem asChild>
                              <a href={entry.data.file_url} target="_blank" rel="noopener noreferrer">
                                Ouvrir
                              </a>
                            </DropdownMenuItem>
                            {entry.data.can_share ? (
                              <DropdownMenuItem onClick={() => void openShare('document', entry.data)}>
                                <Share2 className="mr-2 h-4 w-4" /> Partager
                              </DropdownMenuItem>
                            ) : null}
                            {canDelete(entry.data) ? (
                              <DropdownMenuItem className="text-destructive" onClick={() => setPendingDelete(entry.data)}>
                                <Trash2 className="mr-2 h-4 w-4" /> Supprimer
                              </DropdownMenuItem>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
            {sortedItems.length === 0 && (
              <p className="py-12 text-center text-sm text-muted-foreground">Ce dossier est vide.</p>
            )}
          </div>
        )}

        <Dialog open={Boolean(preview)} onOpenChange={(o) => !o && closePreview()}>
          <DialogContent
            showCloseButton={false}
            className={cn(
              'flex flex-col gap-0 overflow-hidden p-0',
              previewFullscreen
                ? // Base DialogContent impose sm:max-w-lg — il faut l’annuler sur tous les breakpoints
                  'fixed inset-0 z-[400] m-0 flex h-[100dvh] max-h-[100dvh] min-h-0 w-screen min-w-0 max-w-none translate-x-0 translate-y-0 rounded-none border-0 p-0 shadow-none sm:max-w-none md:max-w-none lg:max-w-none xl:max-w-none 2xl:max-w-none'
                : 'h-[85vh] max-h-[90vh] max-w-5xl sm:max-w-5xl'
            )}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3 sm:gap-4">
              <DialogHeader className="min-w-0 flex-1 space-y-0 pr-2 text-left">
                <DialogTitle className="line-clamp-1 text-base">{preview?.doc.title}</DialogTitle>
                <DialogDescription className="sr-only">Apercu du document</DialogDescription>
              </DialogHeader>
              <div className="flex shrink-0 items-center gap-4 pl-1 pr-1 sm:gap-5">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-10 w-10 shrink-0"
                  aria-label={previewFullscreen ? 'Quitter le plein ecran' : 'Plein ecran'}
                  onClick={() => setPreviewFullscreen((v) => !v)}
                >
                  {previewFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-10 w-10 shrink-0"
                  aria-label="Fermer"
                  onClick={() => closePreview()}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div
              className={cn(
                'relative min-h-0 flex-1 overflow-auto bg-muted/20 p-2',
                previewFullscreen && 'flex min-h-0 flex-1 flex-col'
              )}
            >
              {previewLoading ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 text-sm text-muted-foreground">
                  Chargement...
                </div>
              ) : null}
              {preview?.kind === 'onlyoffice' ? (
                <div
                  ref={onlyofficeMountRef}
                  className={cn(
                    'w-full',
                    previewFullscreen ? 'h-full min-h-0' : 'h-[calc(85vh-120px)] min-h-[420px] max-h-[calc(90vh-120px)]'
                  )}
                />
              ) : null}
              {preview?.kind === 'pdf' && previewUrl ? (
                <iframe
                  title={preview.doc.title}
                  src={previewUrl}
                  className={cn(
                    'w-full bg-background',
                    previewFullscreen
                      ? 'min-h-0 flex-1 rounded-none border-0'
                      : 'h-[min(75vh,720px)] rounded-md border border-border/60'
                  )}
                />
              ) : null}
              {preview?.kind === 'video' && previewUrl ? (
                <div className={cn('flex w-full items-center justify-center', previewFullscreen ? 'min-h-0 flex-1' : 'h-[min(75vh,720px)]')}>
                  <video
                    src={previewUrl}
                    controls
                    className={cn(
                      'bg-black object-contain',
                      previewFullscreen
                        ? 'h-full w-full max-w-none rounded-none'
                        : 'h-full w-full max-w-5xl rounded-md border border-border/60'
                    )}
                  />
                </div>
              ) : null}
              {preview?.kind === 'audio' && previewUrl ? (
                <div className="mx-auto flex h-full min-h-[260px] w-full max-w-4xl flex-col items-center justify-center gap-4 rounded-lg border border-border/60 bg-background/70 p-4">
                  <canvas
                    ref={audioCanvasRef}
                    className="h-36 w-full rounded-md border border-border/50 bg-slate-900/10"
                    aria-hidden="true"
                  />
                  <audio ref={audioRef} src={previewUrl} controls className="w-full" />
                </div>
              ) : null}
              {preview?.kind === 'image' && previewUrl ? (
                <div className={cn('flex w-full items-center justify-center', previewFullscreen ? 'min-h-0 flex-1' : 'h-[min(78vh,760px)]')}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- URL signee API */}
                  <img
                    src={previewUrl}
                    alt=""
                    className={cn(
                      'object-contain',
                      previewFullscreen
                        ? 'h-full w-full max-w-none rounded-none'
                        : 'h-full w-full max-w-5xl rounded-md border border-border/60 bg-background'
                    )}
                  />
                </div>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouveau dossier</DialogTitle>
              <DialogDescription>Cree un sous-dossier dans l&apos;emplacement actuel.</DialogDescription>
            </DialogHeader>
            <form className="grid gap-3" onSubmit={submitFolder}>
              <div className="space-y-2">
                <Label>Nom</Label>
                <Input
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Sans titre"
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setFolderDialogOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={submitting}>
                  Creer
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Importer un fichier</DialogTitle>
              <DialogDescription>Ajoute un document dans le dossier ouvert.</DialogDescription>
            </DialogHeader>
            <form className="grid gap-3" onSubmit={submitUpload}>
              <div className="space-y-2">
                <Label>Titre</Label>
                <Input value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={uploadDescription} onChange={(e) => setUploadDescription(e.target.value)} rows={2} />
              </div>
              <div className="space-y-2">
                <Label>Fichier</Label>
                <Input type="file" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} required />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setUploadDialogOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={submitting}>
                  Importer
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={createOfficeDialogOpen} onOpenChange={setCreateOfficeDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Nouveau fichier Office</DialogTitle>
              <DialogDescription>Cree un document vide dans le dossier courant.</DialogDescription>
            </DialogHeader>
            <form className="grid gap-3" onSubmit={submitCreateOffice}>
              <div className="space-y-2">
                <Label>Type</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={createOfficeType}
                  onChange={(e) => setCreateOfficeType(e.target.value as 'docx' | 'xlsx' | 'pptx')}
                >
                  <option value="docx">Document Word (.docx)</option>
                  <option value="xlsx">Classeur Excel (.xlsx)</option>
                  <option value="pptx">Presentation PowerPoint (.pptx)</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Titre (optionnel)</Label>
                <Input
                  value={createOfficeTitle}
                  onChange={(e) => setCreateOfficeTitle(e.target.value)}
                  placeholder={`Nouveau ${createOfficeType.toUpperCase()}`}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setCreateOfficeDialogOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={submitting}>
                  Creer
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog
          open={Boolean(renameFolder)}
          onOpenChange={(o) => {
            if (!o) {
              setRenameFolder(null)
              setRenameFolderName('')
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Renommer le dossier</DialogTitle>
            </DialogHeader>
            <form className="grid gap-3" onSubmit={submitRenameFolder}>
              <div className="space-y-2">
                <Label>Nom</Label>
                <Input value={renameFolderName} onChange={(e) => setRenameFolderName(e.target.value)} required />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setRenameFolder(null)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={submitting}>
                  Enregistrer
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={Boolean(shareTarget)} onOpenChange={(o) => !o && setShareTarget(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Partager</DialogTitle>
              <DialogDescription>
                {shareTarget
                  ? shareTarget.type === 'folder'
                    ? `Dossier : ${(shareTarget.item as GedFolder).name}`
                    : `Fichier : ${(shareTarget.item as GedDocument).title}`
                  : ''}
              </DialogDescription>
            </DialogHeader>
            <form className="grid gap-3 border-b border-border pb-4" onSubmit={addShare}>
              <div className="space-y-2">
                <Label>Personne</Label>
                <SearchableSelect
                  value={shareUserId}
                  onChange={setShareUserId}
                  options={userOptions}
                  placeholder="Choisir un collegue"
                  emptyMessage="Aucun utilisateur"
                />
              </div>
              <div className="space-y-2">
                <Label>Droit</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={shareRole}
                  onChange={(e) => setShareRole(e.target.value as 'viewer' | 'editor')}
                >
                  <option value="viewer">Lecture seule</option>
                  <option value="editor">Modification</option>
                </select>
              </div>
              <Button type="submit" disabled={submitting || !shareUserId}>
                Ajouter
              </Button>
            </form>
            <div className="space-y-2">
              <p className="text-sm font-medium">Personnes ayant acces</p>
              {loadingShares ? (
                <p className="text-sm text-muted-foreground">Chargement...</p>
              ) : shares.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun partage.</p>
              ) : (
                <ul className="space-y-2">
                  {shares.map((s) => (
                    <li
                      key={s.id}
                      className="flex flex-col gap-2 rounded-md border border-border/60 p-2 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="text-sm font-medium">{s.shared_with_name}</p>
                        <p className="text-xs text-muted-foreground">Par {s.shared_by_name}</p>
                        {s.inherited && s.share_folder_name ? (
                          <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-500">
                            Acces herite du dossier « {s.share_folder_name} »
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                          value={s.role}
                          onChange={(e) => void updateShareRole(s, e.target.value as 'viewer' | 'editor')}
                          disabled={s.can_manage === false}
                        >
                          <option value="viewer">Lecture</option>
                          <option value="editor">Modification</option>
                        </select>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          disabled={s.can_manage === false}
                          onClick={() => void removeShare(s)}
                        >
                          Retirer
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(o) => !o && setPendingDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer ce fichier ?</AlertDialogTitle>
              <AlertDialogDescription>
                {pendingDelete ? `« ${pendingDelete.title} » sera supprime.` : ''}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={() => void confirmDelete()}>Supprimer</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={Boolean(pendingDeleteFolder)} onOpenChange={(o) => !o && setPendingDeleteFolder(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer ce dossier ?</AlertDialogTitle>
              <AlertDialogDescription>
                {pendingDeleteFolder ? (
                  authUser?.is_staff || authUser?.is_superuser ? (
                    <>
                      « {pendingDeleteFolder.name} » et tout son contenu seront supprimes definitivement.
                    </>
                  ) : (
                    <>Le dossier « {pendingDeleteFolder.name} » doit etre vide.</>
                  )
                ) : (
                  ''
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={() => void confirmDeleteFolder()}>Supprimer</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
