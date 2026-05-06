'use client'

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'

import { MarketingHeader } from '@/components/marketing-header'
import { useStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { DateTimeField } from '@/components/ui/date-time-field'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SearchableSelect, type SearchableOption } from '@/components/ui/searchable-select'
import { getApiBaseUrl } from '@/lib/api'

type OnboardingForm = {
  company_name: string
  slug: string
  admin_email: string
  admin_phone: string
  admin_password: string
  admin_nationality: string
  admin_date_of_birth: string
  admin_place_of_birth: string
  admin_gender: 'male' | 'female' | 'other'
  admin_marital_status: 'single' | 'married' | 'divorced' | 'widowed'
  admin_national_id_number: string
  admin_id_document_type: string
  admin_job_title: string
  admin_department: string
  admin_employee_number: string
  admin_hire_date: string
  admin_residential_country: string
  admin_residential_city: string
  admin_residential_address: string
  first_name: string
  last_name: string
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
  representative_full_name: string
  representative_role: string
  representative_id_number: string
  currency_code: string
}

const initialForm: OnboardingForm = {
  company_name: '',
  slug: '',
  admin_email: '',
  admin_phone: '',
  admin_password: '',
  admin_nationality: '',
  admin_date_of_birth: '',
  admin_place_of_birth: '',
  admin_gender: 'male',
  admin_marital_status: 'single',
  admin_national_id_number: '',
  admin_id_document_type: '',
  admin_job_title: '',
  admin_department: '',
  admin_employee_number: '',
  admin_hire_date: '',
  admin_residential_country: '',
  admin_residential_city: '',
  admin_residential_address: '',
  first_name: '',
  last_name: '',
  legal_name: '',
  registration_number: '',
  tax_identification_number: '',
  legal_status: '',
  industry: '',
  country: '',
  city: '',
  address_line: '',
  postal_code: '',
  company_email: '',
  company_phone: '',
  representative_full_name: '',
  representative_role: '',
  representative_id_number: '',
  currency_code: 'XOF',
}

type PublicCountry = {
  code: string
  iso3: string
  name: string
  continent: string
  capital: string
  currency_code: string
  phone_prefix: string
}

type PublicCity = {
  geoname_id: number
  name: string
  region: string
  country_code: string
}

const API_BASE_URL = getApiBaseUrl()
const COUNTRY_CACHE_KEY = 'corpcore_world_countries_v1'
const CITY_CACHE_KEY_PREFIX = 'corpcore_world_cities_v1_'
const RequiredMark = () => <span className="ml-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">Obligatoire</span>
const STEP_TITLES = [
  "Informations legales de l'entreprise",
  "Profil legal et professionnel de l'admin (employe)",
  "Admin entreprise",
  "Entreprise creee avec succes",
] as const
const GENDER_OPTIONS: SearchableOption[] = [
  { value: 'male', label: 'Homme' },
  { value: 'female', label: 'Femme' },
  { value: 'other', label: 'Autre' },
]
const MARITAL_STATUS_OPTIONS: SearchableOption[] = [
  { value: 'single', label: 'Celibataire' },
  { value: 'married', label: 'Marie(e)' },
  { value: 'divorced', label: 'Divorce(e)' },
  { value: 'widowed', label: 'Veuf/Veuve' },
]

export default function CompanySignupPage() {
  const { onboardCompany, onboardingLoading, onboardingResult, apiError, resetOnboardingState } = useStore()
  const [form, setForm] = useState<OnboardingForm>(initialForm)
  const [countries, setCountries] = useState<PublicCountry[]>([])
  const [companyCities, setCompanyCities] = useState<PublicCity[]>([])
  const [adminCities, setAdminCities] = useState<PublicCity[]>([])
  const [locationLoading, setLocationLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1)
  const cityCacheRef = useRef<Record<string, PublicCity[]>>({})
  const autoPhonePrefixRef = useRef('')

  useEffect(() => {
    // Avoid showing stale success state when user revisits the page.
    resetOnboardingState()
  }, [resetOnboardingState])

  useEffect(() => {
    if (onboardingResult) {
      setCurrentStep(4)
    }
  }, [onboardingResult])

  const canSubmit = useMemo(
    () =>
      Boolean(
        form.company_name.trim() &&
          form.slug.trim() &&
          form.admin_email.trim() &&
          form.admin_phone.trim() &&
          form.admin_password.trim() &&
          form.admin_nationality.trim() &&
          form.admin_date_of_birth.trim() &&
          form.admin_place_of_birth.trim() &&
          form.admin_national_id_number.trim() &&
          form.admin_job_title.trim() &&
          form.admin_department.trim() &&
          form.admin_hire_date.trim() &&
          form.admin_residential_country.trim() &&
          form.admin_residential_city.trim() &&
          form.admin_residential_address.trim() &&
          form.legal_name.trim() &&
          form.country.trim() &&
          form.address_line.trim() &&
          form.company_email.trim() &&
          form.representative_full_name.trim()
      ),
    [form]
  )

  useEffect(() => {
    const run = async () => {
      const fromCache = typeof window !== 'undefined' ? sessionStorage.getItem(COUNTRY_CACHE_KEY) : null
      if (fromCache) {
        try {
          const parsed = JSON.parse(fromCache) as PublicCountry[]
          if (parsed.length) {
            setCountries(parsed)
          }
        } catch {
          // Ignore invalid cache and continue with API call.
        }
      }
      setLocationLoading(true)
      try {
        let response = await fetch(`${API_BASE_URL}/public/world/countries/?limit=300`)
        if (!response.ok) {
          response = await fetch(`/api/public/world/countries/?limit=300`)
        }
        if (!response.ok) throw new Error('Failed to load countries')
        const data = (await response.json()) as PublicCountry[]
        setCountries(data)
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(COUNTRY_CACHE_KEY, JSON.stringify(data))
        }
      } catch {
        setCountries([])
      } finally {
        setLocationLoading(false)
      }
    }
    run().catch(() => undefined)
  }, [])

  const fetchCitiesByCountry = async (countryCodeRaw: string): Promise<PublicCity[]> => {
    const countryCode = countryCodeRaw.toUpperCase()
    if (!countryCode) {
      return []
    }
    const cacheKey = `${CITY_CACHE_KEY_PREFIX}${countryCode}`
    const memoryCached = cityCacheRef.current[countryCode]
    if (memoryCached) {
      return memoryCached
    }
    const sessionCached = typeof window !== 'undefined' ? sessionStorage.getItem(cacheKey) : null
    if (sessionCached) {
      try {
        const parsed = JSON.parse(sessionCached) as PublicCity[]
        cityCacheRef.current[countryCode] = parsed
        return parsed
      } catch {
        // Ignore cache parsing errors and use API.
      }
    }
    let response = await fetch(`${API_BASE_URL}/public/world/cities/?country=${encodeURIComponent(countryCode)}&limit=300`)
    if (!response.ok) {
      response = await fetch(`/api/public/world/cities/?country=${encodeURIComponent(countryCode)}&limit=300`)
    }
    if (!response.ok) {
      return []
    }
    const data = (await response.json()) as PublicCity[]
    cityCacheRef.current[countryCode] = data
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(cacheKey, JSON.stringify(data))
    }
    return data
  }

  useEffect(() => {
    if (!form.country) {
      setCompanyCities([])
      setForm((prev) => ({ ...prev, city: '' }))
      return
    }
    fetchCitiesByCountry(form.country)
      .then((items) => setCompanyCities(items))
      .catch(() => setCompanyCities([]))
  }, [form.country])

  useEffect(() => {
    if (!form.admin_residential_country) {
      setAdminCities([])
      setForm((prev) => ({ ...prev, admin_residential_city: '' }))
      return
    }
    fetchCitiesByCountry(form.admin_residential_country)
      .then((items) => setAdminCities(items))
      .catch(() => setAdminCities([]))
  }, [form.admin_residential_country])

  useEffect(() => {
    const sourceCode = form.admin_residential_country || form.admin_nationality || form.country
    if (!sourceCode) return
    const sourceCountry = countries.find((country) => country.code === sourceCode)
    if (!sourceCountry?.phone_prefix) return
    const digits = sourceCountry.phone_prefix.replace(/\D/g, '')
    if (!digits) return
    const computedPrefix = `+${digits}`
    setForm((prev) => {
      const current = prev.admin_phone.trim()
      const isAutoValue =
        !current ||
        current === autoPhonePrefixRef.current ||
        current === `${autoPhonePrefixRef.current} `
      if (!isAutoValue) {
        autoPhonePrefixRef.current = computedPrefix
        return prev
      }
      autoPhonePrefixRef.current = computedPrefix
      return { ...prev, admin_phone: `${computedPrefix} ` }
    })
  }, [form.country, form.admin_nationality, form.admin_residential_country, countries])

  useEffect(() => {
    if (!form.country) return
    const selectedCountry = countries.find((country) => country.code === form.country)
    const inferredCurrency = (selectedCountry?.currency_code || '').trim().toUpperCase()
    if (!inferredCurrency) return
    setForm((prev) => (prev.currency_code === inferredCurrency ? prev : { ...prev, currency_code: inferredCurrency }))
  }, [form.country, countries])

  const countryOptions = useMemo<SearchableOption[]>(
    () =>
      countries.map((country) => ({
        value: country.code,
        label: `${country.name} (${country.code})`,
        keywords: `${country.capital} ${country.continent} ${country.currency_code} ${country.iso3}`,
      })),
    [countries]
  )

  const companyCityOptions = useMemo<SearchableOption[]>(
    () =>
      companyCities.map((city) => ({
        value: city.name,
        label: city.region ? `${city.name} (${city.region})` : city.name,
        keywords: city.region,
      })),
    [companyCities]
  )

  const adminCityOptions = useMemo<SearchableOption[]>(
    () =>
      adminCities.map((city) => ({
        value: city.name,
        label: city.region ? `${city.name} (${city.region})` : city.name,
        keywords: city.region,
      })),
    [adminCities]
  )

  const currencyOptions = useMemo<SearchableOption[]>(() => {
    const seen = new Set<string>()
    countries.forEach((country) => {
      const code = (country.currency_code || '').trim().toUpperCase()
      if (code) seen.add(code)
    })
    if (!seen.size) seen.add('XOF')
    return Array.from(seen)
      .sort((a, b) => a.localeCompare(b))
      .map((code) => ({ value: code, label: code }))
  }, [countries])

  const canGoStep2 = useMemo(
    () =>
      Boolean(
        form.legal_name.trim() &&
          form.currency_code.trim() &&
          form.country.trim() &&
          form.address_line.trim() &&
          form.company_email.trim() &&
          form.representative_full_name.trim()
      ),
    [form]
  )

  const canGoStep3 = useMemo(
    () =>
      Boolean(
        form.admin_nationality.trim() &&
          form.admin_date_of_birth.trim() &&
          form.admin_place_of_birth.trim() &&
          form.admin_national_id_number.trim() &&
          form.admin_job_title.trim() &&
          form.admin_department.trim() &&
          form.admin_hire_date.trim() &&
          form.admin_residential_country.trim() &&
          form.admin_residential_city.trim() &&
          form.admin_residential_address.trim()
      ),
    [form]
  )

  const isDone = Boolean(onboardingResult)
  const progressPercent = ((currentStep - 1) / 3) * 100
  const tenantLoginHref = useMemo(() => {
    const domain = onboardingResult?.domain?.trim()
    if (!domain) {
      return '/login'
    }

    const hasProtocol = /^https?:\/\//i.test(domain)
    try {
      if (hasProtocol) {
        const url = new URL(domain)
        url.pathname = '/login'
        url.search = ''
        url.hash = ''
        return url.toString()
      }

      const protocol = typeof window !== 'undefined' ? window.location.protocol : 'https:'
      let host = domain
      const shouldAppendCurrentPort =
        typeof window !== 'undefined' &&
        domain.endsWith('.localhost') &&
        !domain.includes(':') &&
        Boolean(window.location.port)

      if (shouldAppendCurrentPort) {
        host = `${domain}:${window.location.port}`
      }
      return `${protocol}//${host}/login`
    } catch {
      return '/login'
    }
  }, [onboardingResult?.domain])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit) return
    const selectedCountry = countries.find((country) => country.code === form.country)
    const selectedNationality = countries.find((country) => country.code === form.admin_nationality)
    const selectedResidentialCountry = countries.find((country) => country.code === form.admin_residential_country)
    await onboardCompany({
      ...form,
      currency_code: form.currency_code || 'XOF',
      country: selectedCountry?.name || form.country,
      admin_nationality: selectedNationality?.name || form.admin_nationality,
      admin_residential_country: selectedResidentialCountry?.name || form.admin_residential_country,
    })
  }

  const goNext = () => {
    if (currentStep === 1 && canGoStep2) {
      setCurrentStep(2)
      return
    }
    if (currentStep === 2 && canGoStep3) {
      setCurrentStep(3)
    }
  }

  const goBack = () => {
    if (currentStep === 4) {
      setCurrentStep(3)
      return
    }
    if (currentStep === 3) {
      setCurrentStep(2)
      return
    }
    if (currentStep === 2) {
      setCurrentStep(1)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <main className="container mx-auto px-4 py-10 md:py-14">
        <div className="mx-auto max-w-4xl space-y-6">
          {currentStep <= 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Creation automatique de votre entreprise</CardTitle>
              <CardDescription>
                Nous creons le tenant, le sous-domaine, le compte admin et activons 30 jours gratuits sur tous les modules.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="rounded-xl border bg-muted/20 p-4 md:p-5 space-y-4">
                  <div className="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
                    <span>Progression onboarding</span>
                    <span>{Math.round(progressPercent)}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-primary to-blue-500 transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {STEP_TITLES.map((title, index) => {
                      const stepNumber = (index + 1) as 1 | 2 | 3 | 4
                      const isActive = currentStep === stepNumber
                      const isDoneStep = currentStep > stepNumber
                      return (
                        <button
                          key={title}
                          type="button"
                          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition ${
                            isActive ? 'border-primary bg-primary/10' : 'border-border bg-background'
                          }`}
                          onClick={() => {
                            if (stepNumber === 4) {
                              if (onboardingResult) {
                                setCurrentStep(4)
                              }
                              return
                            }
                            setCurrentStep(stepNumber)
                          }}
                        >
                          <span
                            className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                              isDoneStep
                                ? 'bg-primary text-primary-foreground'
                                : isActive
                                  ? 'bg-primary/20 text-primary'
                                  : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {stepNumber}
                          </span>
                          <span className="text-[11px] leading-tight">{title}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {currentStep === 1 && (
                  <div className="border rounded-lg p-4 space-y-4">
                    <h3 className="font-semibold">1 - Informations legales de l'entreprise</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="company_name">Nom commercial<RequiredMark /></Label>
                        <Input
                          id="company_name"
                          required
                          placeholder="Ex: CorpCore Afrique"
                          value={form.company_name}
                          onChange={(e) => setForm((p) => ({ ...p, company_name: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="slug">Sous-domaine souhaite<RequiredMark /></Label>
                        <Input
                          id="slug"
                          required
                          placeholder="Ex: acme (donnera acme.corpcore.app)"
                          value={form.slug}
                          onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="legal_name">Raison sociale<RequiredMark /></Label>
                        <Input
                          id="legal_name"
                          required
                          placeholder="Ex: CORPCORE SA"
                          value={form.legal_name}
                          onChange={(e) => setForm((p) => ({ ...p, legal_name: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="registration_number">Numero registre</Label>
                        <Input
                          id="registration_number"
                          placeholder="Ex: RCCM-ABJ-2026-B-12345"
                          value={form.registration_number}
                          onChange={(e) => setForm((p) => ({ ...p, registration_number: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="tax_identification_number">Identifiant fiscal</Label>
                        <Input
                          id="tax_identification_number"
                          placeholder="Ex: IFU123456789"
                          value={form.tax_identification_number}
                          onChange={(e) => setForm((p) => ({ ...p, tax_identification_number: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="legal_status">Forme juridique</Label>
                        <Input
                          id="legal_status"
                          placeholder="Ex: SARL, SA, SAS..."
                          value={form.legal_status}
                          onChange={(e) => setForm((p) => ({ ...p, legal_status: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="industry">Secteur</Label>
                        <Input
                          id="industry"
                          placeholder="Ex: Technologie, Commerce, Sante..."
                          value={form.industry}
                          onChange={(e) => setForm((p) => ({ ...p, industry: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Devise<RequiredMark /></Label>
                        <SearchableSelect
                          value={form.currency_code}
                          onChange={(value) => setForm((prev) => ({ ...prev, currency_code: value.toUpperCase() }))}
                          options={currencyOptions}
                          placeholder="Selectionner la devise"
                          emptyMessage="Aucune devise trouvee"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="country">Pays<RequiredMark /></Label>
                        <SearchableSelect
                          value={form.country}
                          onChange={(value) => setForm((prev) => ({ ...prev, country: value, city: '' }))}
                          options={countryOptions}
                          placeholder={locationLoading ? 'Chargement des pays...' : 'Rechercher puis selectionner un pays'}
                          emptyMessage="Aucun pays trouve"
                          disabled={locationLoading}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="city">Ville</Label>
                        <SearchableSelect
                          value={form.city}
                          onChange={(value) => setForm((prev) => ({ ...prev, city: value }))}
                          options={companyCityOptions}
                          placeholder={form.country ? 'Rechercher puis selectionner une ville' : "Selectionne d'abord un pays"}
                          emptyMessage="Aucune ville trouvee"
                          disabled={!form.country}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="postal_code">Code postal</Label>
                        <Input
                          id="postal_code"
                          placeholder="Ex: 01 BP 1234"
                          value={form.postal_code}
                          onChange={(e) => setForm((p) => ({ ...p, postal_code: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="address_line">Adresse<RequiredMark /></Label>
                        <Textarea
                          id="address_line"
                          required
                          placeholder="Ex: Cocody, Rue des Jardins, Immeuble Delta"
                          value={form.address_line}
                          onChange={(e) => setForm((p) => ({ ...p, address_line: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="company_email">Email entreprise<RequiredMark /></Label>
                        <Input
                          id="company_email"
                          type="email"
                          required
                          placeholder="Ex: contact@entreprise.com"
                          value={form.company_email}
                          onChange={(e) => setForm((p) => ({ ...p, company_email: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="company_phone">Telephone entreprise</Label>
                        <Input
                          id="company_phone"
                          placeholder="Ex: +225 27 22 00 00 00"
                          value={form.company_phone}
                          onChange={(e) => setForm((p) => ({ ...p, company_phone: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="representative_full_name">Representant legal<RequiredMark /></Label>
                        <Input
                          id="representative_full_name"
                          required
                          placeholder="Ex: Awa Koffi"
                          value={form.representative_full_name}
                          onChange={(e) => setForm((p) => ({ ...p, representative_full_name: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="representative_role">Fonction representant</Label>
                        <Input
                          id="representative_role"
                          placeholder="Ex: DG, Gerant, CEO"
                          value={form.representative_role}
                          onChange={(e) => setForm((p) => ({ ...p, representative_role: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="representative_id_number">Piece d'identite representant</Label>
                        <Input
                          id="representative_id_number"
                          placeholder="Ex: CNI1234567890"
                          value={form.representative_id_number}
                          onChange={(e) => setForm((p) => ({ ...p, representative_id_number: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {currentStep === 2 && (
                  <div className="border rounded-lg p-4 space-y-4">
                    <h3 className="font-semibold">2 - Profil legal et professionnel de l'admin (employe)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Nationalite<RequiredMark /></Label>
                        <SearchableSelect
                          value={form.admin_nationality}
                          onChange={(value) => setForm((prev) => ({ ...prev, admin_nationality: value }))}
                          options={countryOptions}
                          placeholder="Selectionner la nationalite"
                          emptyMessage="Aucun pays trouve"
                          disabled={locationLoading}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="admin_place_of_birth">Lieu de naissance<RequiredMark /></Label>
                        <Input
                          id="admin_place_of_birth"
                          required
                          placeholder="Ex: Abidjan"
                          value={form.admin_place_of_birth}
                          onChange={(e) => setForm((p) => ({ ...p, admin_place_of_birth: e.target.value }))}
                        />
                      </div>
                      <DateTimeField
                        id="admin_date_of_birth"
                        label={<><span>Date de naissance</span><RequiredMark /></>}
                        value={form.admin_date_of_birth}
                        onChange={(value) => setForm((p) => ({ ...p, admin_date_of_birth: value }))}
                        required
                      />
                      <div className="space-y-2">
                        <Label>Genre<RequiredMark /></Label>
                        <SearchableSelect
                          value={form.admin_gender}
                          onChange={(value) => setForm((prev) => ({ ...prev, admin_gender: value as OnboardingForm['admin_gender'] }))}
                          options={GENDER_OPTIONS}
                          placeholder="Selectionner le genre"
                          emptyMessage="Aucune option"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Situation matrimoniale<RequiredMark /></Label>
                        <SearchableSelect
                          value={form.admin_marital_status}
                          onChange={(value) =>
                            setForm((prev) => ({ ...prev, admin_marital_status: value as OnboardingForm['admin_marital_status'] }))
                          }
                          options={MARITAL_STATUS_OPTIONS}
                          placeholder="Selectionner la situation"
                          emptyMessage="Aucune option"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="admin_national_id_number">Numero de piece d'identite<RequiredMark /></Label>
                        <Input
                          id="admin_national_id_number"
                          required
                          placeholder="Ex: CNI123456789"
                          value={form.admin_national_id_number}
                          onChange={(e) => setForm((p) => ({ ...p, admin_national_id_number: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="admin_id_document_type">Type de piece</Label>
                        <Input
                          id="admin_id_document_type"
                          placeholder="Ex: Carte nationale, Passeport"
                          value={form.admin_id_document_type}
                          onChange={(e) => setForm((p) => ({ ...p, admin_id_document_type: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="admin_employee_number">Matricule employe</Label>
                        <Input
                          id="admin_employee_number"
                          placeholder="Ex: EMP-0001"
                          value={form.admin_employee_number}
                          onChange={(e) => setForm((p) => ({ ...p, admin_employee_number: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="admin_job_title">Poste<RequiredMark /></Label>
                        <Input
                          id="admin_job_title"
                          required
                          placeholder="Ex: Directeur general"
                          value={form.admin_job_title}
                          onChange={(e) => setForm((p) => ({ ...p, admin_job_title: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="admin_department">Departement<RequiredMark /></Label>
                        <Input
                          id="admin_department"
                          required
                          placeholder="Ex: Direction / Operations"
                          value={form.admin_department}
                          onChange={(e) => setForm((p) => ({ ...p, admin_department: e.target.value }))}
                        />
                      </div>
                      <DateTimeField
                        id="admin_hire_date"
                        label={<><span>Date d'embauche</span><RequiredMark /></>}
                        value={form.admin_hire_date}
                        onChange={(value) => setForm((p) => ({ ...p, admin_hire_date: value }))}
                        required
                      />
                      <div className="space-y-2">
                        <Label>Pays de residence<RequiredMark /></Label>
                        <SearchableSelect
                          value={form.admin_residential_country}
                          onChange={(value) => setForm((prev) => ({ ...prev, admin_residential_country: value, admin_residential_city: '' }))}
                          options={countryOptions}
                          placeholder="Selectionner le pays de residence"
                          emptyMessage="Aucun pays trouve"
                          disabled={locationLoading}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="admin_residential_city">Ville de residence<RequiredMark /></Label>
                        <SearchableSelect
                          value={form.admin_residential_city}
                          onChange={(value) => setForm((prev) => ({ ...prev, admin_residential_city: value }))}
                          options={adminCityOptions}
                          placeholder={form.admin_residential_country ? 'Selectionner une ville de residence' : "Selectionne d'abord un pays"}
                          emptyMessage="Aucune ville trouvee"
                          disabled={!form.admin_residential_country}
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="admin_residential_address">Adresse de residence<RequiredMark /></Label>
                        <Textarea
                          id="admin_residential_address"
                          required
                          placeholder="Ex: Cocody Angre, 8e tranche, villa 12"
                          value={form.admin_residential_address}
                          onChange={(e) => setForm((p) => ({ ...p, admin_residential_address: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {currentStep === 3 && (
                  <div className="border rounded-lg p-4 space-y-4">
                    <h3 className="font-semibold">3 - Admin entreprise</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="admin_email">Email admin<RequiredMark /></Label>
                        <Input
                          id="admin_email"
                          type="email"
                          required
                          placeholder="Ex: admin@votre-entreprise.com"
                          value={form.admin_email}
                          onChange={(e) => setForm((p) => ({ ...p, admin_email: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="admin_phone">Telephone admin<RequiredMark /></Label>
                        <Input
                          id="admin_phone"
                          required
                          placeholder="Ex: +225 07 00 00 00 00"
                          value={form.admin_phone}
                          onChange={(e) => setForm((p) => ({ ...p, admin_phone: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="admin_password">Mot de passe admin<RequiredMark /></Label>
                        <Input
                          id="admin_password"
                          type="password"
                          required
                          placeholder="Min 8 caracteres"
                          value={form.admin_password}
                          onChange={(e) => setForm((p) => ({ ...p, admin_password: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="first_name">Prenom admin</Label>
                        <Input
                          id="first_name"
                          placeholder="Ex: Awa"
                          value={form.first_name}
                          onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="last_name">Nom admin</Label>
                        <Input
                          id="last_name"
                          placeholder="Ex: Koffi"
                          value={form.last_name}
                          onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {apiError && <p className="text-sm text-destructive">{apiError}</p>}

                {!isDone && currentStep <= 3 && (
                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                    <Button type="button" variant="outline" onClick={goBack} disabled={currentStep === 1 || onboardingLoading}>
                      Retour
                    </Button>
                    {currentStep < 3 ? (
                      <Button
                        type="button"
                        onClick={goNext}
                        disabled={
                          onboardingLoading ||
                          (currentStep === 1 && !canGoStep2) ||
                          (currentStep === 2 && !canGoStep3)
                        }
                      >
                        Continuer
                      </Button>
                    ) : (
                      <Button type="submit" disabled={!canSubmit || onboardingLoading}>
                        {onboardingLoading ? 'Creation en cours...' : 'Creer mon entreprise'}
                      </Button>
                    )}
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
          )}

          {onboardingResult && currentStep === 4 && (
            <Card>
              <CardHeader>
                <CardTitle>4 - Entreprise creee avec succes</CardTitle>
                <CardDescription>
                  Votre essai gratuit de {onboardingResult.trial_offer_days} jours est actif.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="rounded-xl border bg-muted/20 p-4 md:p-5 space-y-4">
                  <div className="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
                    <span>Progression onboarding</span>
                    <span>{Math.round(progressPercent)}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-primary to-blue-500 transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {STEP_TITLES.map((title, index) => {
                      const stepNumber = (index + 1) as 1 | 2 | 3 | 4
                      const isActive = currentStep === stepNumber
                      const isDoneStep = currentStep > stepNumber
                      return (
                        <button
                          key={`success-${title}`}
                          type="button"
                          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition ${
                            isActive ? 'border-primary bg-primary/10' : 'border-border bg-background'
                          }`}
                          onClick={() => {
                            if (stepNumber === 4) {
                              setCurrentStep(4)
                              return
                            }
                            setCurrentStep(stepNumber)
                          }}
                        >
                          <span
                            className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                              isDoneStep
                                ? 'bg-primary text-primary-foreground'
                                : isActive
                                  ? 'bg-primary/20 text-primary'
                                  : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {stepNumber}
                          </span>
                          <span className="text-[11px] leading-tight">{title}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
                <p><strong>Tenant:</strong> {onboardingResult.name}</p>
                <p><strong>Domaine:</strong> {onboardingResult.domain}</p>
                <p><strong>Fin d'essai:</strong> {onboardingResult.paid_until || '-'}</p>
                <p className="text-muted-foreground">
                  Connecte-toi ensuite avec le compte admin pour gerer les modules et paiements.
                </p>
                <div className="flex gap-3">
                  <Link href={tenantLoginHref}>
                    <Button>Aller a la connexion</Button>
                  </Link>
                  <Link href="/">
                    <Button variant="outline">Retour accueil</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}
