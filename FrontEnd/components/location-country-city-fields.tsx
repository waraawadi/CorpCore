'use client'

import { useEffect, useMemo, useState } from 'react'
import { getApiBaseUrl } from '@/lib/api'
import { Label } from '@/components/ui/label'
import { SearchableSelect, type SearchableOption } from '@/components/ui/searchable-select'

type CountryItem = {
  code: string
  name: string
  capital?: string
  continent?: string
  currency_code?: string
  iso3?: string
}

type CityItem = {
  name: string
  region?: string
}

type Props = {
  country: string
  city: string
  onCountryChange: (countryCode: string) => void
  onCityChange: (cityName: string) => void
  countryLabel?: string
  cityLabel?: string
  countryRequired?: boolean
  cityRequired?: boolean
}

const API_BASE = getApiBaseUrl()

const RequiredMark = () => (
  <span className="ml-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
    Obligatoire
  </span>
)

export function LocationCountryCityFields({
  country,
  city,
  onCountryChange,
  onCityChange,
  countryLabel = 'Pays',
  cityLabel = 'Ville',
  countryRequired = false,
  cityRequired = false,
}: Props) {
  const [countries, setCountries] = useState<CountryItem[]>([])
  const [cities, setCities] = useState<CityItem[]>([])
  const [loadingCountries, setLoadingCountries] = useState(false)
  const [loadingCities, setLoadingCities] = useState(false)

  useEffect(() => {
    const run = async () => {
      setLoadingCountries(true)
      try {
        const response = await fetch(`${API_BASE}/public/world/countries/?limit=300`)
        if (!response.ok) return
        const data = (await response.json()) as CountryItem[]
        setCountries(data)
      } finally {
        setLoadingCountries(false)
      }
    }
    run().catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!country) {
      setCities([])
      onCityChange('')
      return
    }
    const run = async () => {
      setLoadingCities(true)
      try {
        const response = await fetch(`${API_BASE}/public/world/cities/?country=${encodeURIComponent(country)}&limit=300`)
        if (!response.ok) return
        const data = (await response.json()) as CityItem[]
        setCities(data)
      } finally {
        setLoadingCities(false)
      }
    }
    run().catch(() => undefined)
  }, [country])

  const countryOptions = useMemo<SearchableOption[]>(
    () =>
      countries.map((item) => ({
        value: item.code,
        label: `${item.name} (${item.code})`,
        keywords: `${item.capital || ''} ${item.continent || ''} ${item.currency_code || ''} ${item.iso3 || ''}`,
      })),
    [countries]
  )

  const cityOptions = useMemo<SearchableOption[]>(
    () =>
      cities.map((item) => ({
        value: item.name,
        label: item.region ? `${item.name} (${item.region})` : item.name,
        keywords: item.region || '',
      })),
    [cities]
  )

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="space-y-2">
        <Label>
          {countryLabel}
          {countryRequired ? <RequiredMark /> : null}
        </Label>
        <SearchableSelect
          value={country}
          onChange={(value) => {
            onCountryChange(value)
            onCityChange('')
          }}
          options={countryOptions}
          placeholder={loadingCountries ? 'Chargement des pays...' : 'Selectionner un pays'}
          emptyMessage="Aucun pays trouve"
        />
      </div>
      <div className="space-y-2">
        <Label>
          {cityLabel}
          {cityRequired ? <RequiredMark /> : null}
        </Label>
        <SearchableSelect
          value={city}
          onChange={onCityChange}
          options={cityOptions}
          placeholder={
            !country
              ? "Selectionnez d'abord un pays"
              : loadingCities
                ? 'Chargement des villes...'
                : 'Selectionner une ville'
          }
          emptyMessage="Aucune ville trouvee"
          disabled={!country}
        />
      </div>
    </div>
  )
}

