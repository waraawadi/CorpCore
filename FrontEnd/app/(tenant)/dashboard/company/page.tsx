'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useStore } from '@/lib/store'
import { getApiBaseUrl, formatApiErrorBody } from '@/lib/api'
import { notify } from '@/lib/notify'

const ACCESS_TOKEN_KEY = 'corpcore_access_token'

type CompanyProfilePayload = {
  name: string
  slug: string
  currency_code: string
  slogan: string
  logo_url: string
  hero_image_url: string
  legal_name: string
  registration_number: string
  tax_identification_number: string
  legal_status: string
  industry: string
  country: string
  city: string
  address_line: string
  postal_code: string
  company_email: string
  company_phone: string
  admin_phone: string
  representative_full_name: string
  representative_role: string
  representative_id_number: string
}

export default function CompanyProfilePage() {
  const { authUser, updateTenant } = useStore()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState<CompanyProfilePayload | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [heroFile, setHeroFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState('')
  const [heroPreview, setHeroPreview] = useState('')

  const canEdit = Boolean(authUser?.is_company_admin)

  const loadProfile = async () => {
    setLoading(true)
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null
      if (!token) throw new Error('Session expirée.')
      const res = await fetch(`${getApiBaseUrl()}/company/profile/`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        let detail = `Erreur API (${res.status})`
        try {
          detail = formatApiErrorBody(await res.json()) || detail
        } catch {
          // keep fallback
        }
        throw new Error(detail)
      }
      const payload = (await res.json()) as CompanyProfilePayload
      setProfile(payload)
      setLogoPreview(payload.logo_url || '')
      setHeroPreview(payload.hero_image_url || '')
    } catch (e) {
      notify.error('Chargement impossible', e instanceof Error ? e.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadProfile()
  }, [])

  const onLogoChange = (file: File | null) => {
    setLogoFile(file)
    if (!file) {
      setLogoPreview(profile?.logo_url || '')
      return
    }
    setLogoPreview(URL.createObjectURL(file))
  }

  const onHeroChange = (file: File | null) => {
    setHeroFile(file)
    if (!file) {
      setHeroPreview(profile?.hero_image_url || '')
      return
    }
    setHeroPreview(URL.createObjectURL(file))
  }

  const updateField = (key: keyof CompanyProfilePayload, value: string) => {
    setProfile((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  const submit = async () => {
    if (!profile) return
    if (!canEdit) {
      notify.error('Accès refusé', 'Seul un admin entreprise peut modifier ces informations.')
      return
    }
    setSaving(true)
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null
      if (!token) throw new Error('Session expirée.')
      const form = new FormData()
      ;[
        'name',
        'currency_code',
        'slogan',
        'legal_name',
        'registration_number',
        'tax_identification_number',
        'legal_status',
        'industry',
        'country',
        'city',
        'address_line',
        'postal_code',
        'company_email',
        'company_phone',
        'admin_phone',
        'representative_full_name',
        'representative_role',
        'representative_id_number',
      ].forEach((key) => form.append(key, profile[key as keyof CompanyProfilePayload] || ''))
      if (logoFile) form.append('logo', logoFile)
      if (heroFile) form.append('hero_image', heroFile)

      const res = await fetch(`${getApiBaseUrl()}/company/profile/`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })
      if (!res.ok) {
        let detail = `Erreur API (${res.status})`
        try {
          detail = formatApiErrorBody(await res.json()) || detail
        } catch {
          // keep fallback
        }
        throw new Error(detail)
      }
      const payload = (await res.json()) as CompanyProfilePayload
      setProfile(payload)
      setLogoFile(null)
      setHeroFile(null)
      setLogoPreview(payload.logo_url || '')
      setHeroPreview(payload.hero_image_url || '')
      updateTenant({
        ...useStore.getState().tenant,
        name: payload.name,
        currencyCode: payload.currency_code,
        slogan: payload.slogan,
        logoUrl: payload.logo_url || null,
        heroImageUrl: payload.hero_image_url || null,
      })
      notify.success('Informations entreprise mises à jour')
    } catch (e) {
      notify.error('Enregistrement impossible', e instanceof Error ? e.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  if (!canEdit) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-4 p-4 md:p-6">
        <h1 className="text-xl font-semibold">Entreprise</h1>
        <p className="text-sm text-muted-foreground">Accès réservé à l’administrateur de l’entreprise.</p>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Profil entreprise</h1>
        <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
          Retour dashboard
        </Link>
      </div>

      {loading || !profile ? (
        <p className="text-sm text-muted-foreground">Chargement...</p>
      ) : (
        <>
          <div className="grid gap-4 rounded-md border p-4 md:grid-cols-2">
            <Field label="Nom entreprise">
              <input className="w-full rounded border bg-background px-3 py-2 text-sm" value={profile.name} onChange={(e) => updateField('name', e.target.value)} />
            </Field>
            <Field label="Slogan">
              <input className="w-full rounded border bg-background px-3 py-2 text-sm" value={profile.slogan || ''} onChange={(e) => updateField('slogan', e.target.value)} />
            </Field>
            <Field label="Devise (ISO)">
              <input className="w-full rounded border bg-background px-3 py-2 text-sm uppercase" value={profile.currency_code} onChange={(e) => updateField('currency_code', e.target.value.toUpperCase())} />
            </Field>
            <Field label="Slug (lecture seule)">
              <input className="w-full rounded border bg-muted px-3 py-2 text-sm" value={profile.slug} readOnly />
            </Field>
          </div>

          <div className="grid gap-4 rounded-md border p-4 md:grid-cols-2">
            <Field label="Logo entreprise">
              <input type="file" accept="image/*" onChange={(e) => onLogoChange(e.target.files?.[0] || null)} />
              {logoPreview ? <img src={logoPreview} alt="Logo entreprise" className="mt-2 h-20 w-20 rounded border object-cover" /> : null}
            </Field>
            <Field label="Photo entreprise">
              <input type="file" accept="image/*" onChange={(e) => onHeroChange(e.target.files?.[0] || null)} />
              {heroPreview ? <img src={heroPreview} alt="Bannière entreprise" className="mt-2 h-28 w-full rounded border object-cover" /> : null}
            </Field>
          </div>

          <div className="grid gap-4 rounded-md border p-4 md:grid-cols-2">
            <Field label="Raison sociale"><input className="w-full rounded border bg-background px-3 py-2 text-sm" value={profile.legal_name} onChange={(e) => updateField('legal_name', e.target.value)} /></Field>
            <Field label="N° registre"><input className="w-full rounded border bg-background px-3 py-2 text-sm" value={profile.registration_number || ''} onChange={(e) => updateField('registration_number', e.target.value)} /></Field>
            <Field label="NIF"><input className="w-full rounded border bg-background px-3 py-2 text-sm" value={profile.tax_identification_number || ''} onChange={(e) => updateField('tax_identification_number', e.target.value)} /></Field>
            <Field label="Statut légal"><input className="w-full rounded border bg-background px-3 py-2 text-sm" value={profile.legal_status || ''} onChange={(e) => updateField('legal_status', e.target.value)} /></Field>
            <Field label="Secteur"><input className="w-full rounded border bg-background px-3 py-2 text-sm" value={profile.industry || ''} onChange={(e) => updateField('industry', e.target.value)} /></Field>
            <Field label="Pays"><input className="w-full rounded border bg-background px-3 py-2 text-sm" value={profile.country} onChange={(e) => updateField('country', e.target.value)} /></Field>
            <Field label="Ville"><input className="w-full rounded border bg-background px-3 py-2 text-sm" value={profile.city || ''} onChange={(e) => updateField('city', e.target.value)} /></Field>
            <Field label="Adresse"><input className="w-full rounded border bg-background px-3 py-2 text-sm" value={profile.address_line} onChange={(e) => updateField('address_line', e.target.value)} /></Field>
            <Field label="Code postal"><input className="w-full rounded border bg-background px-3 py-2 text-sm" value={profile.postal_code || ''} onChange={(e) => updateField('postal_code', e.target.value)} /></Field>
            <Field label="Email entreprise"><input className="w-full rounded border bg-background px-3 py-2 text-sm" value={profile.company_email} onChange={(e) => updateField('company_email', e.target.value)} /></Field>
            <Field label="Téléphone entreprise"><input className="w-full rounded border bg-background px-3 py-2 text-sm" value={profile.company_phone || ''} onChange={(e) => updateField('company_phone', e.target.value)} /></Field>
            <Field label="Téléphone admin"><input className="w-full rounded border bg-background px-3 py-2 text-sm" value={profile.admin_phone || ''} onChange={(e) => updateField('admin_phone', e.target.value)} /></Field>
            <Field label="Représentant"><input className="w-full rounded border bg-background px-3 py-2 text-sm" value={profile.representative_full_name} onChange={(e) => updateField('representative_full_name', e.target.value)} /></Field>
            <Field label="Rôle représentant"><input className="w-full rounded border bg-background px-3 py-2 text-sm" value={profile.representative_role || ''} onChange={(e) => updateField('representative_role', e.target.value)} /></Field>
            <Field label="ID représentant"><input className="w-full rounded border bg-background px-3 py-2 text-sm" value={profile.representative_id_number || ''} onChange={(e) => updateField('representative_id_number', e.target.value)} /></Field>
          </div>

          <div className="flex justify-end">
            <button type="button" onClick={() => void submit()} disabled={saving} className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}
