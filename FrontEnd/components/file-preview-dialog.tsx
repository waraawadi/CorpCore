'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { Maximize2, Minimize2, X } from 'lucide-react'

type OnlyofficeEditor = { destroyEditor?: () => void; resize?: () => void }
type OnlyofficeDocsApi = {
  DocEditor: new (elementId: string, config: Record<string, unknown>) => OnlyofficeEditor
}

export type PreviewableFile = {
  id: string
  name: string
  mimeType?: string
  source?: 'upload' | 'ged' | 'link'
  url?: string
}

type OnlyofficeConfigPayload = {
  documentServerUrl: string
  token: string
  config?: Record<string, unknown>
}

function previewKindForFile(file: PreviewableFile): 'onlyoffice' | 'pdf' | 'video' | 'audio' | 'image' | null {
  const mime = (file.mimeType || '').toLowerCase()
  const name = file.name || ''
  const ext = name.includes('.') ? (name.split('.').pop() || '').toLowerCase() : ''
  const imageExts = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif'])
  const videoExts = new Set(['mp4', 'webm', 'mov', 'm4v', 'avi', 'mkv'])
  const audioExts = new Set(['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'])
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  if (mime.startsWith('image/')) return 'image'
  if (videoExts.has(ext)) return 'video'
  if (audioExts.has(ext)) return 'audio'
  if (imageExts.has(ext)) return 'image'
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

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  file: PreviewableFile | null
  fetchPreviewUrl: (id: string) => Promise<string>
  fetchOnlyofficeConfig: (id: string) => Promise<OnlyofficeConfigPayload>
}

export function FilePreviewDialog({ open, onOpenChange, file, fetchPreviewUrl, fetchOnlyofficeConfig }: Props) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const onlyofficeMountRef = useRef<HTMLDivElement>(null)
  const onlyofficeEditorRef = useRef<OnlyofficeEditor | null>(null)
  const fetchPreviewUrlRef = useRef(fetchPreviewUrl)
  const fetchOnlyofficeConfigRef = useRef(fetchOnlyofficeConfig)
  const kind = file ? previewKindForFile(file) : null
  const [forceIframePreview, setForceIframePreview] = useState(false)
  const useOnlyoffice = kind === 'onlyoffice' && !forceIframePreview && file?.source !== 'link'

  useEffect(() => {
    fetchPreviewUrlRef.current = fetchPreviewUrl
  }, [fetchPreviewUrl])

  useEffect(() => {
    fetchOnlyofficeConfigRef.current = fetchOnlyofficeConfig
  }, [fetchOnlyofficeConfig])

  const close = useCallback(() => {
    onlyofficeEditorRef.current?.destroyEditor?.()
    onlyofficeEditorRef.current = null
    if (onlyofficeMountRef.current) onlyofficeMountRef.current.innerHTML = ''
    setPreviewUrl((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
      return null
    })
    setLoading(false)
    setFullscreen(false)
    setForceIframePreview(false)
    onOpenChange(false)
  }, [onOpenChange])

  useEffect(() => {
    if (!open || !file || (kind === 'onlyoffice' && useOnlyoffice)) return
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const url = (file.url || '').trim() || (await fetchPreviewUrlRef.current(file.id))
        let nextUrl: string
        try {
          const res = await fetch(url)
          if (!res.ok) throw new Error('HTTP')
          const blob = await res.blob()
          nextUrl = URL.createObjectURL(blob)
        } catch {
          nextUrl = url
        }
        if (cancelled) return
        setPreviewUrl((prev) => {
          if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
          return nextUrl
        })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [open, file, kind, useOnlyoffice])

  useEffect(() => {
    if (!open || !file || !useOnlyoffice) return
    let cancelled = false
    const run = async () => {
      setLoading(true)
      onlyofficeEditorRef.current?.destroyEditor?.()
      onlyofficeEditorRef.current = null
      if (onlyofficeMountRef.current) onlyofficeMountRef.current.innerHTML = ''
      try {
        const cfg = await fetchOnlyofficeConfigRef.current(file.id)
        await loadOnlyOfficeScript(cfg.documentServerUrl)
        const api = (window as unknown as { DocsAPI?: OnlyofficeDocsApi }).DocsAPI
        if (cancelled || !api || !onlyofficeMountRef.current) return
        const holderId = `p-${file.id.replace(/-/g, '')}-${Date.now()}`
        onlyofficeMountRef.current.innerHTML = `<div id="${holderId}" class="h-full min-h-[420px] w-full" />`
        onlyofficeEditorRef.current = new api.DocEditor(holderId, {
          ...(cfg.config || {}),
          token: cfg.token,
          width: '100%',
          height: '100%',
          type: 'desktop',
        })
      } catch {
        if (!cancelled) setForceIframePreview(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
      onlyofficeEditorRef.current?.destroyEditor?.()
      onlyofficeEditorRef.current = null
    }
  }, [open, file, useOnlyoffice])

  useEffect(() => {
    if (!open || !useOnlyoffice) return
    const timer = window.setTimeout(() => {
      onlyofficeEditorRef.current?.resize?.()
    }, 100)
    return () => window.clearTimeout(timer)
  }, [open, useOnlyoffice, fullscreen])

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          'flex flex-col gap-0 overflow-hidden p-0',
          fullscreen
            ? 'fixed inset-0 z-[400] m-0 h-[100dvh] max-h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 rounded-none border-0 shadow-none sm:max-w-none'
            : 'h-[85vh] max-h-[90vh] max-w-5xl sm:max-w-5xl'
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
          <DialogHeader className="min-w-0 flex-1 space-y-0 pr-2 text-left">
            <DialogTitle className="line-clamp-1 text-base">{file?.name || 'Aperçu'}</DialogTitle>
            <DialogDescription className="sr-only">Aperçu du fichier</DialogDescription>
          </DialogHeader>
          <div className="flex shrink-0 items-center gap-2">
            <Button type="button" size="icon" variant="ghost" onClick={() => setFullscreen((v) => !v)}>
              {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            <Button type="button" size="icon" variant="ghost" onClick={() => close()}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className={cn('relative min-h-0 flex-1 overflow-auto bg-muted/20 p-2', fullscreen && 'flex min-h-0 flex-1 flex-col')}>
          {loading ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 text-sm text-muted-foreground">
              Chargement...
            </div>
          ) : null}
          {useOnlyoffice ? (
            <div ref={onlyofficeMountRef} className={cn('w-full', fullscreen ? 'h-full min-h-0' : 'h-[calc(85vh-120px)] min-h-[420px]')} />
          ) : null}
          {kind === 'pdf' && previewUrl ? (
            <iframe title={file?.name || 'pdf'} src={previewUrl} className={cn('w-full bg-background', fullscreen ? 'min-h-0 flex-1 rounded-none border-0' : 'h-[min(75vh,720px)] rounded-md border border-border/60')} />
          ) : null}
          {kind === 'video' && previewUrl ? (
            <div className={cn('flex w-full items-center justify-center', fullscreen ? 'min-h-0 flex-1' : 'h-[min(75vh,720px)]')}>
              <video src={previewUrl} controls className={cn('bg-black object-contain', fullscreen ? 'h-full w-full max-w-none rounded-none' : 'h-full w-full max-w-5xl rounded-md border border-border/60')} />
            </div>
          ) : null}
          {kind === 'audio' && previewUrl ? (
            <div className="mx-auto flex h-full min-h-[220px] w-full max-w-3xl items-center justify-center">
              <audio src={previewUrl} controls className="w-full" />
            </div>
          ) : null}
          {kind === 'image' && previewUrl ? (
            <div className={cn('flex w-full items-center justify-center', fullscreen ? 'min-h-0 flex-1' : 'h-[min(78vh,760px)]')}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="" className={cn('object-contain', fullscreen ? 'h-full w-full max-w-none rounded-none' : 'h-full w-full max-w-5xl rounded-md border border-border/60 bg-background')} />
            </div>
          ) : null}
          {!useOnlyoffice && (kind === null || kind === 'onlyoffice') && previewUrl ? (
            <iframe
              title={file?.name || 'fichier'}
              src={previewUrl}
              className={cn(
                'w-full bg-background',
                fullscreen ? 'min-h-0 flex-1 rounded-none border-0' : 'h-[min(75vh,720px)] rounded-md border border-border/60'
              )}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
