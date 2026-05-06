'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useStore } from '@/lib/store'
import { getApiBaseUrl, formatApiErrorBody } from '@/lib/api'
import { notify } from '@/lib/notify'
import { normalizeCurrencyCode } from '@/lib/currency'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DateTimeField } from '@/components/ui/date-time-field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
import { LocationCountryCityFields } from '@/components/location-country-city-fields'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DataPagination } from '@/components/ui/data-pagination'

type Employee = {
  id: string
  user: number
  user_name?: string
  user_full_name?: string
  user_first_name?: string
  user_last_name?: string
  user_email?: string
  employee_number: string
  professional_email: string
  job_title: string
  department: string
  nationality: string
  date_of_birth: string
  place_of_birth: string
  gender: 'male' | 'female' | 'other'
  marital_status: 'single' | 'married' | 'divorced' | 'widowed'
  national_id_number: string
  id_document_type: string
  profile_photo?: string | null
  hire_date: string
  phone_number: string
  residential_country: string
  residential_city: string
  residential_address: string
  manager?: number | null
  manager_name?: string
  annual_leave_entitlement_days?: string
}
type HrUserOption = {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  full_name: string
}
type LeaveBalanceRow = {
  employee_id: string
  employee_name: string
  year: number
  entitlement: string
  used: string
  pending: string
  remaining: string
}
type Department = { id: string; name: string; code: string; description: string; is_active: boolean }
type Contract = {
  id: string
  employee: string
  employee_name?: string
  position?: string | null
  contract_type: string
  start_date: string
  end_date?: string | null
  salary: string
  currency: string
  status: string
  notes: string
}
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
type PayrollRule = {
  id: string
  name: string
  code: string
  category: 'bonus' | 'benefit' | 'deduction'
  default_amount: string
  is_active: boolean
}
type PayrollComponent = { rule: string; category: 'bonus' | 'benefit' | 'deduction'; amount: string }
type Payroll = {
  id: string
  employee: string
  employee_name?: string
  period_month: number
  period_year: number
  base_salary: string
  gross_salary: string
  net_salary: string
  status: string
  note: string
  components?: PayrollComponent[]
  selected_bonus_rule_ids?: string[]
  selected_benefit_rule_ids?: string[]
  selected_deduction_rule_ids?: string[]
}

type LeaveRequest = {
  id: string
  employee: string
  employee_name?: string
  employee_manager_id?: number | null
  leave_type: string
  start_date: string
  end_date: string
  days: string
  status: string
  reason: string
  approved_by: number | null
  approved_by_name?: string
  approved_at: string | null
  created_at: string
}

type PayrollForm = {
  employee: string
  period_month: number
  period_year: number
  status: string
  note: string
  bonus_rule_ids: string[]
  benefit_rule_ids: string[]
  deduction_rule_ids: string[]
  bonus_amount_overrides: Record<string, string>
  benefit_amount_overrides: Record<string, string>
  deduction_amount_overrides: Record<string, string>
}

type PayrollRuleForm = {
  name: string
  code: string
  category: 'bonus' | 'benefit' | 'deduction'
  default_amount: string
  is_active: boolean
}

type HrTab = 'payroll-settings' | 'payrolls' | 'employees' | 'contracts' | 'departments' | 'leaves'
type PendingDelete = { path: string; label: string } | null

const HR_TAB_PATHS: Record<HrTab, string> = {
  employees: '/dashboard/hr/employees',
  departments: '/dashboard/hr/departments',
  contracts: '/dashboard/hr/contracts',
  leaves: '/dashboard/hr/leaves',
  'payroll-settings': '/dashboard/hr/payroll-settings',
  payrolls: '/dashboard/hr/payrolls',
}

const resolveHrTabFromPath = (pathname: string): HrTab => {
  if (pathname.startsWith('/dashboard/hr/departments')) return 'departments'
  if (pathname.startsWith('/dashboard/hr/contracts')) return 'contracts'
  if (pathname.startsWith('/dashboard/hr/leaves')) return 'leaves'
  if (pathname.startsWith('/dashboard/hr/payroll-settings')) return 'payroll-settings'
  if (pathname.startsWith('/dashboard/hr/payrolls')) return 'payrolls'
  return 'employees'
}

type DepartmentForm = {
  name: string
  code: string
  description: string
  is_active: boolean
}

type EmployeeForm = {
  first_name: string
  last_name: string
  personal_email: string
  send_whatsapp: boolean
  employee_number: string
  nationality: string
  date_of_birth: string
  place_of_birth: string
  gender: 'male' | 'female' | 'other'
  marital_status: 'single' | 'married' | 'divorced' | 'widowed'
  national_id_number: string
  id_document_type: string
  job_title: string
  department: string
  hire_date: string
  professional_email: string
  phone_number: string
  residential_country: string
  residential_city: string
  residential_address: string
  manager: string
  annual_leave_entitlement_days: string
}

type ContractForm = {
  employee: string
  contract_type: string
  start_date: string
  end_date: string
  salary: string
  currency: string
  status: string
  notes: string
}

const API_BASE = getApiBaseUrl()
const ACCESS_TOKEN_KEY = 'corpcore_access_token'

const emptyPayroll: PayrollForm = {
  employee: '',
  period_month: new Date().getMonth() + 1,
  period_year: new Date().getFullYear(),
  status: 'draft',
  note: '',
  bonus_rule_ids: [],
  benefit_rule_ids: [],
  deduction_rule_ids: [],
  bonus_amount_overrides: {},
  benefit_amount_overrides: {},
  deduction_amount_overrides: {},
}

const emptyPayrollRule: PayrollRuleForm = {
  name: '',
  code: '',
  category: 'bonus',
  default_amount: '0',
  is_active: true,
}

const emptyDepartment: DepartmentForm = {
  name: '',
  code: '',
  description: '',
  is_active: true,
}

const emptyEmployee: EmployeeForm = {
  first_name: '',
  last_name: '',
  personal_email: '',
  send_whatsapp: true,
  employee_number: '',
  nationality: '',
  date_of_birth: '',
  place_of_birth: '',
  gender: 'male',
  marital_status: 'single',
  national_id_number: '',
  id_document_type: '',
  job_title: '',
  department: '',
  hire_date: '',
  professional_email: '',
  phone_number: '',
  residential_country: '',
  residential_city: '',
  residential_address: '',
  manager: '',
  annual_leave_entitlement_days: '25',
}

const emptyContract: ContractForm = {
  employee: '',
  contract_type: 'permanent',
  start_date: '',
  end_date: '',
  salary: '0',
  currency: 'XOF',
  status: 'draft',
  notes: '',
}

type LeaveForm = {
  employee: string
  leave_type: string
  start_date: string
  end_date: string
  reason: string
}

const emptyLeave: LeaveForm = {
  employee: '',
  leave_type: 'annual',
  start_date: '',
  end_date: '',
  reason: '',
}

const RequiredMark = () => (
  <span className="ml-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
    Obligatoire
  </span>
)

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null
  const isFormData = init?.body instanceof FormData
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
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

const amountNumber = (v: string | number | null | undefined) => {
  const n = Number(v || 0)
  return Number.isFinite(n) ? n : 0
}
const DEFAULT_CURRENCY = 'XOF'

/** Jours de conge sans decimales inutiles (ex. 25 au lieu de 25.00). */
const formatLeaveDaysDisplay = (value: string | number | null | undefined) => {
  const n = Number(value ?? 0)
  if (!Number.isFinite(n)) return '—'
  const rounded = Math.round(n * 10) / 10
  return Number.isInteger(rounded) ? String(Math.round(rounded)) : rounded.toFixed(1).replace(/\.0$/, '')
}

type SortDirection = 'asc' | 'desc'

const normalizeText = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

const compareValues = (a: unknown, b: unknown, direction: SortDirection) => {
  const left = normalizeText(a)
  const right = normalizeText(b)
  if (left === right) return 0
  if (direction === 'asc') return left > right ? 1 : -1
  return left < right ? 1 : -1
}

const resolveCountryCode = (value: string, countries: CountryItem[]) => {
  if (!value) return ''
  const byCode = countries.find((country) => country.code === value)
  if (byCode) return byCode.code
  const byName = countries.find((country) => normalizeText(country.name) === normalizeText(value))
  return byName?.code || ''
}

export default function HrPage() {
  const pathname = usePathname()
  const router = useRouter()
  const authUser = useStore((s) => s.authUser)
  const tenant = useStore((s) => s.tenant)
  const tenantCurrency = normalizeCurrencyCode(tenant.currencyCode)
  const [activeTab, setActiveTab] = useState<HrTab>(() => resolveHrTabFromPath(pathname))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [employees, setEmployees] = useState<Employee[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [payrolls, setPayrolls] = useState<Payroll[]>([])
  const [payrollRules, setPayrollRules] = useState<PayrollRule[]>([])
  const [leaves, setLeaves] = useState<LeaveRequest[]>([])
  const [hrUsers, setHrUsers] = useState<HrUserOption[]>([])
  const [leaveBalanceYear, setLeaveBalanceYear] = useState(() => new Date().getFullYear())
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalanceRow[]>([])
  const [loadingLeaveSummary, setLoadingLeaveSummary] = useState(false)
  const [countries, setCountries] = useState<CountryItem[]>([])
  const [loadingCountries, setLoadingCountries] = useState(false)
  const [birthCities, setBirthCities] = useState<CityItem[]>([])
  const [loadingBirthCities, setLoadingBirthCities] = useState(false)

  const [payrollForm, setPayrollForm] = useState<PayrollForm>(emptyPayroll)
  const [payrollRuleForm, setPayrollRuleForm] = useState<PayrollRuleForm>(emptyPayrollRule)
  const [departmentForm, setDepartmentForm] = useState<DepartmentForm>(emptyDepartment)
  const [employeeForm, setEmployeeForm] = useState<EmployeeForm>(emptyEmployee)
  const [contractForm, setContractForm] = useState<ContractForm>(emptyContract)

  const [editingPayrollId, setEditingPayrollId] = useState<string | null>(null)
  const [editingPayrollRuleId, setEditingPayrollRuleId] = useState<string | null>(null)
  const [editingDepartmentId, setEditingDepartmentId] = useState<string | null>(null)
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null)
  const [editingContractId, setEditingContractId] = useState<string | null>(null)
  const [payrollDialogOpen, setPayrollDialogOpen] = useState(false)
  const [payrollRuleDialogOpen, setPayrollRuleDialogOpen] = useState(false)
  const [departmentDialogOpen, setDepartmentDialogOpen] = useState(false)
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false)
  const [employeeDetailsDialogOpen, setEmployeeDetailsDialogOpen] = useState(false)
  const [contractDialogOpen, setContractDialogOpen] = useState(false)
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false)
  const [editingLeaveId, setEditingLeaveId] = useState<string | null>(null)
  const [leaveForm, setLeaveForm] = useState<LeaveForm>(emptyLeave)
  const [leaveActionLoading, setLeaveActionLoading] = useState<string | null>(null)
  const [selectedEmployeeDetails, setSelectedEmployeeDetails] = useState<Employee | null>(null)
  const [employeePhotoFile, setEmployeePhotoFile] = useState<File | null>(null)
  const [employeePhotoPreview, setEmployeePhotoPreview] = useState('')
  const [removeEmployeePhoto, setRemoveEmployeePhoto] = useState(false)

  const [bonusRuleToAdd, setBonusRuleToAdd] = useState('')
  const [benefitRuleToAdd, setBenefitRuleToAdd] = useState('')
  const [deductionRuleToAdd, setDeductionRuleToAdd] = useState('')
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [departmentSearch, setDepartmentSearch] = useState('')
  const [contractSearch, setContractSearch] = useState('')
  const [payrollRuleSearch, setPayrollRuleSearch] = useState('')
  const [payrollSearch, setPayrollSearch] = useState('')
  const [leaveSearch, setLeaveSearch] = useState('')

  const [employeeSort, setEmployeeSort] = useState<{ key: 'employee' | 'job_title' | 'department' | 'professional_email'; direction: SortDirection }>({ key: 'employee', direction: 'asc' })
  const [departmentSort, setDepartmentSort] = useState<{ key: 'name' | 'code' | 'description' | 'is_active'; direction: SortDirection }>({ key: 'name', direction: 'asc' })
  const [contractSort, setContractSort] = useState<{ key: 'employee_name' | 'contract_type' | 'period' | 'salary' | 'status'; direction: SortDirection }>({ key: 'employee_name', direction: 'asc' })
  const [payrollRuleSort, setPayrollRuleSort] = useState<{ key: 'category' | 'name' | 'default_amount' | 'is_active'; direction: SortDirection }>({ key: 'name', direction: 'asc' })
  const [payrollSort, setPayrollSort] = useState<{ key: 'employee_name' | 'period' | 'base_salary' | 'gross_salary' | 'net_salary' | 'status'; direction: SortDirection }>({ key: 'period', direction: 'desc' })
  const [leaveSort, setLeaveSort] = useState<{
    key: 'employee_name' | 'period' | 'days' | 'status' | 'leave_type'
    direction: SortDirection
  }>({ key: 'period', direction: 'desc' })
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)
  const [employeePage, setEmployeePage] = useState(1)
  const [employeePageSize, setEmployeePageSize] = useState(10)
  const [departmentPage, setDepartmentPage] = useState(1)
  const [departmentPageSize, setDepartmentPageSize] = useState(10)
  const [contractPage, setContractPage] = useState(1)
  const [contractPageSize, setContractPageSize] = useState(10)
  const [leavePage, setLeavePage] = useState(1)
  const [leavePageSize, setLeavePageSize] = useState(10)
  const [payrollRulePage, setPayrollRulePage] = useState(1)
  const [payrollRulePageSize, setPayrollRulePageSize] = useState(10)
  const [payrollPage, setPayrollPage] = useState(1)
  const [payrollPageSize, setPayrollPageSize] = useState(10)

  const formatCurrency = useCallback(
    (value: string | number | null | undefined, currency?: string | null) =>
      `${amountNumber(value).toFixed(2)} ${normalizeCurrencyCode(currency || tenantCurrency || DEFAULT_CURRENCY)}`,
    [tenantCurrency]
  )

  const employeeOptions = useMemo<SearchableOption[]>(
    () =>
      employees.map((e) => ({
        value: e.id,
        label: e.user_full_name || e.user_name || e.employee_number || e.professional_email,
      })),
    [employees]
  )
  const departmentOptions = useMemo<SearchableOption[]>(
    () =>
      departments.map((d) => ({
        value: d.id,
        label: d.name || d.code || d.id,
      })),
    [departments]
  )

  const payrollRuleMap = useMemo(() => new Map(payrollRules.map((rule) => [rule.id, rule])), [payrollRules])

  const makeRuleOptions = (category: PayrollRule['category']) =>
    payrollRules
      .filter((r) => r.is_active && r.category === category)
      .map((r) => ({ value: r.id, label: `${r.name} (${formatCurrency(r.default_amount)})`, keywords: r.code }))

  const bonusRuleOptions = useMemo(() => makeRuleOptions('bonus'), [payrollRules])
  const benefitRuleOptions = useMemo(() => makeRuleOptions('benefit'), [payrollRules])
  const deductionRuleOptions = useMemo(() => makeRuleOptions('deduction'), [payrollRules])

  const selectedBonusRules = useMemo(() => payrollForm.bonus_rule_ids.map((id) => payrollRuleMap.get(id)).filter(Boolean) as PayrollRule[], [payrollForm.bonus_rule_ids, payrollRuleMap])
  const selectedBenefitRules = useMemo(() => payrollForm.benefit_rule_ids.map((id) => payrollRuleMap.get(id)).filter(Boolean) as PayrollRule[], [payrollForm.benefit_rule_ids, payrollRuleMap])
  const selectedDeductionRules = useMemo(() => payrollForm.deduction_rule_ids.map((id) => payrollRuleMap.get(id)).filter(Boolean) as PayrollRule[], [payrollForm.deduction_rule_ids, payrollRuleMap])

  const getEmployeeContractSalary = (employeeId: string) => {
    const activeContract = contracts.find((c) => c.employee === employeeId && c.status === 'active')
    if (activeContract) return amountNumber(activeContract.salary)
    const latestContract = contracts.filter((c) => c.employee === employeeId).sort((a, b) => b.start_date.localeCompare(a.start_date))[0]
    return latestContract ? amountNumber(latestContract.salary) : 0
  }
  const getEmployeeContractCurrency = (employeeId: string) => {
    const activeContract = contracts.find((c) => c.employee === employeeId && c.status === 'active')
    if (activeContract?.currency) return activeContract.currency
    const latestContract = contracts.filter((c) => c.employee === employeeId).sort((a, b) => b.start_date.localeCompare(a.start_date))[0]
    return latestContract?.currency || tenantCurrency
  }

  const baseSalaryPreview = useMemo(() => getEmployeeContractSalary(payrollForm.employee), [payrollForm.employee, contracts])
  const payrollPreviewCurrency = useMemo(() => getEmployeeContractCurrency(payrollForm.employee), [payrollForm.employee, contracts])
  const resolveRuleAmount = (
    rule: PayrollRule,
    overrides: Record<string, string>
  ) => amountNumber(overrides[rule.id] ?? rule.default_amount)

  const bonusesTotalPreview = useMemo(
    () => selectedBonusRules.reduce((sum, r) => sum + resolveRuleAmount(r, payrollForm.bonus_amount_overrides), 0),
    [selectedBonusRules, payrollForm.bonus_amount_overrides]
  )
  const benefitsTotalPreview = useMemo(
    () => selectedBenefitRules.reduce((sum, r) => sum + resolveRuleAmount(r, payrollForm.benefit_amount_overrides), 0),
    [selectedBenefitRules, payrollForm.benefit_amount_overrides]
  )
  const deductionsTotalPreview = useMemo(
    () => selectedDeductionRules.reduce((sum, r) => sum + resolveRuleAmount(r, payrollForm.deduction_amount_overrides), 0),
    [selectedDeductionRules, payrollForm.deduction_amount_overrides]
  )
  const grossSalaryPreview = baseSalaryPreview + bonusesTotalPreview + benefitsTotalPreview
  const netSalaryPreview = grossSalaryPreview - deductionsTotalPreview

  const payrollStatusOptions: SearchableOption[] = [
    { value: 'draft', label: 'Brouillon' },
    { value: 'processed', label: 'Traite' },
    { value: 'paid', label: 'Paye' },
  ]
  const payrollCategoryOptions: SearchableOption[] = [
    { value: 'bonus', label: 'Prime' },
    { value: 'benefit', label: 'Avantage en nature' },
    { value: 'deduction', label: 'Retenue' },
  ]
  const genderOptions: SearchableOption[] = [
    { value: 'male', label: 'Homme' },
    { value: 'female', label: 'Femme' },
    { value: 'other', label: 'Autre' },
  ]
  const maritalStatusOptions: SearchableOption[] = [
    { value: 'single', label: 'Celibataire' },
    { value: 'married', label: 'Marie(e)' },
    { value: 'divorced', label: 'Divorce(e)' },
    { value: 'widowed', label: 'Veuf(ve)' },
  ]
  const contractTypeOptions: SearchableOption[] = [
    { value: 'permanent', label: 'Permanent' },
    { value: 'fixed_term', label: 'CDD' },
    { value: 'internship', label: 'Stage' },
    { value: 'consultant', label: 'Consultant' },
  ]
  const contractStatusOptions: SearchableOption[] = [
    { value: 'draft', label: 'Brouillon' },
    { value: 'active', label: 'Actif' },
    { value: 'suspended', label: 'Suspendu' },
    { value: 'ended', label: 'Termine' },
  ]
  const idDocumentTypeOptions: SearchableOption[] = [
    { value: "Carte Nationale d'Identite", label: "Carte Nationale d'Identite" },
    { value: 'Passeport', label: 'Passeport' },
    { value: 'Permis de conduire', label: 'Permis de conduire' },
    { value: "Carte d'electeur", label: "Carte d'electeur" },
  ]
  const payrollCategoryLabelMap: Record<PayrollRule['category'], string> = {
    bonus: 'Prime',
    benefit: 'Avantage en nature',
    deduction: 'Retenue',
  }
  const contractTypeLabelMap: Record<string, string> = {
    permanent: 'Permanent',
    fixed_term: 'CDD',
    internship: 'Stage',
    consultant: 'Consultant',
  }
  const contractStatusLabelMap: Record<string, string> = {
    draft: 'Brouillon',
    active: 'Actif',
    suspended: 'Suspendu',
    ended: 'Termine',
  }
  const payrollStatusLabelMap: Record<string, string> = {
    draft: 'Brouillon',
    processed: 'Traite',
    paid: 'Paye',
  }
  const leaveTypeLabelMap: Record<string, string> = {
    annual: 'Conges payes',
    sick: 'Maladie',
    unpaid: 'Sans solde',
    maternity: 'Maternite',
    other: 'Autre',
  }
  const leaveStatusLabelMap: Record<string, string> = {
    pending: 'En attente',
    approved: 'Approuve',
    rejected: 'Refuse',
    cancelled: 'Annule',
  }
  const leaveTypeOptions: SearchableOption[] = [
    { value: 'annual', label: 'Conges payes' },
    { value: 'sick', label: 'Maladie' },
    { value: 'unpaid', label: 'Sans solde' },
    { value: 'maternity', label: 'Maternite' },
    { value: 'other', label: 'Autre' },
  ]
  const genderLabelMap: Record<Employee['gender'], string> = {
    male: 'Homme',
    female: 'Femme',
    other: 'Autre',
  }
  const maritalStatusLabelMap: Record<Employee['marital_status'], string> = {
    single: 'Celibataire',
    married: 'Marie(e)',
    divorced: 'Divorce(e)',
    widowed: 'Veuf(ve)',
  }
  const countryOptions = useMemo<SearchableOption[]>(
    () =>
      countries.map((item) => ({
        value: item.code,
        label: `${item.name} (${item.code})`,
        keywords: `${item.capital || ''} ${item.continent || ''} ${item.currency_code || ''} ${item.iso3 || ''}`,
      })),
    [countries]
  )
  const displayCountry = (value: string) => countries.find((country) => country.code === value)?.name || value
  const displayDate = (value: string) => {
    if (!value) return '—'
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return value
    return d.toLocaleDateString('fr-FR')
  }
  const birthCityOptions = useMemo<SearchableOption[]>(
    () =>
      birthCities.map((item) => ({
        value: item.name,
        label: item.region ? `${item.name} (${item.region})` : item.name,
        keywords: item.region || '',
      })),
    [birthCities]
  )

  const managerUserOptions = useMemo<SearchableOption[]>(
    () =>
      hrUsers.map((u) => ({
        value: String(u.id),
        label: u.full_name || [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || u.username,
        keywords: `${u.email} ${u.username}`,
      })),
    [hrUsers]
  )

  const loadAll = async () => {
    setLoading(true)
    setError(null)
    try {
      const [employeesData, departmentsData, contractsData, payrollsData, payrollRulesData, leavesData, hrUsersData] =
        await Promise.all([
          apiRequest<Employee[]>('/hr/employees/'),
          apiRequest<Department[]>('/hr/departments/'),
          apiRequest<Contract[]>('/hr/contracts/'),
          apiRequest<Payroll[]>('/hr/payrolls/'),
          apiRequest<PayrollRule[]>('/hr/payroll-rules/'),
          apiRequest<LeaveRequest[]>('/hr/leaves/'),
          apiRequest<HrUserOption[]>('/hr/users/'),
        ])
      setEmployees(employeesData)
      setDepartments(departmentsData)
      setContracts(contractsData)
      setPayrolls(payrollsData)
      setPayrollRules(payrollRulesData)
      setLeaves(leavesData)
      setHrUsers(hrUsersData)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur de chargement'
      setError(msg)
      notify.error(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll().catch(() => undefined)
  }, [])

  const reloadLeaveBalances = useCallback(async (options?: { withSpinner?: boolean }) => {
    const withSpinner = options?.withSpinner ?? false
    if (withSpinner) setLoadingLeaveSummary(true)
    try {
      const data = await apiRequest<{ year: number; balances: LeaveBalanceRow[] }>(
        `/hr/leaves/summary/?year=${leaveBalanceYear}`
      )
      setLeaveBalances(data.balances)
    } catch {
      if (withSpinner) setLeaveBalances([])
    } finally {
      if (withSpinner) setLoadingLeaveSummary(false)
    }
  }, [leaveBalanceYear])

  useEffect(() => {
    if (activeTab !== 'leaves') return
    void reloadLeaveBalances({ withSpinner: true })
  }, [activeTab, leaveBalanceYear, reloadLeaveBalances])
  useEffect(() => {
    const run = async () => {
      setLoadingCountries(true)
      try {
        const data = await apiRequest<CountryItem[]>('/public/world/countries/?limit=300')
        setCountries(data)
      } catch {
        setCountries([])
      } finally {
        setLoadingCountries(false)
      }
    }
    run().catch(() => undefined)
  }, [])
  useEffect(() => {
    const countryCode = resolveCountryCode(employeeForm.nationality, countries)
    if (!countryCode) {
      setBirthCities([])
      return
    }
    const run = async () => {
      setLoadingBirthCities(true)
      try {
        const data = await apiRequest<CityItem[]>(`/public/world/cities/?country=${encodeURIComponent(countryCode)}&limit=300`)
        setBirthCities(data)
      } catch {
        setBirthCities([])
      } finally {
        setLoadingBirthCities(false)
      }
    }
    run().catch(() => undefined)
  }, [employeeForm.nationality, countries])

  const addRuleId = (
    ruleId: string,
    key: 'bonus_rule_ids' | 'benefit_rule_ids' | 'deduction_rule_ids',
    overrideKey: 'bonus_amount_overrides' | 'benefit_amount_overrides' | 'deduction_amount_overrides'
  ) => {
    if (!ruleId) return
    const rule = payrollRuleMap.get(ruleId)
    setPayrollForm((prev) => {
      if (prev[key].includes(ruleId)) return prev
      return {
        ...prev,
        [key]: [...prev[key], ruleId],
        [overrideKey]: {
          ...prev[overrideKey],
          [ruleId]: String(rule?.default_amount ?? '0'),
        },
      }
    })
  }
  const removeRuleId = (
    ruleId: string,
    key: 'bonus_rule_ids' | 'benefit_rule_ids' | 'deduction_rule_ids',
    overrideKey: 'bonus_amount_overrides' | 'benefit_amount_overrides' | 'deduction_amount_overrides'
  ) => {
    setPayrollForm((prev) => {
      const nextOverrides = { ...prev[overrideKey] }
      delete nextOverrides[ruleId]
      return {
        ...prev,
        [key]: prev[key].filter((id) => id !== ruleId),
        [overrideKey]: nextOverrides,
      }
    })
  }

  const openCreatePayroll = () => {
    setEditingPayrollId(null)
    setPayrollForm(emptyPayroll)
    setPayrollDialogOpen(true)
  }

  const openEditPayroll = (p: Payroll) => {
    setEditingPayrollId(p.id)
    setPayrollForm({
      employee: p.employee,
      period_month: p.period_month,
      period_year: p.period_year,
      status: p.status,
      note: p.note,
      bonus_rule_ids: p.selected_bonus_rule_ids || p.components?.filter((c) => c.category === 'bonus').map((c) => c.rule) || [],
      benefit_rule_ids: p.selected_benefit_rule_ids || p.components?.filter((c) => c.category === 'benefit').map((c) => c.rule) || [],
      deduction_rule_ids: p.selected_deduction_rule_ids || p.components?.filter((c) => c.category === 'deduction').map((c) => c.rule) || [],
      bonus_amount_overrides: Object.fromEntries(
        (p.components || [])
          .filter((c) => c.category === 'bonus')
          .map((c) => [c.rule, c.amount])
      ),
      benefit_amount_overrides: Object.fromEntries(
        (p.components || [])
          .filter((c) => c.category === 'benefit')
          .map((c) => [c.rule, c.amount])
      ),
      deduction_amount_overrides: Object.fromEntries(
        (p.components || [])
          .filter((c) => c.category === 'deduction')
          .map((c) => [c.rule, c.amount])
      ),
    })
    setPayrollDialogOpen(true)
  }

  const submitPayroll = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await apiRequest(editingPayrollId ? `/hr/payrolls/${editingPayrollId}/` : '/hr/payrolls/', {
        method: editingPayrollId ? 'PATCH' : 'POST',
        body: JSON.stringify(payrollForm),
      })
      await loadAll()
      setPayrollDialogOpen(false)
      notify.success(editingPayrollId ? 'Paie mise a jour' : 'Paie enregistree')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur enregistrement paie'
      setError(msg)
      notify.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const openCreateRule = () => {
    setEditingPayrollRuleId(null)
    setPayrollRuleForm(emptyPayrollRule)
    setPayrollRuleDialogOpen(true)
  }

  const openEditRule = (rule: PayrollRule) => {
    setEditingPayrollRuleId(rule.id)
    setPayrollRuleForm({
      name: rule.name,
      code: rule.code,
      category: rule.category,
      default_amount: rule.default_amount,
      is_active: rule.is_active,
    })
    setPayrollRuleDialogOpen(true)
  }

  const submitRule = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await apiRequest(editingPayrollRuleId ? `/hr/payroll-rules/${editingPayrollRuleId}/` : '/hr/payroll-rules/', {
        method: editingPayrollRuleId ? 'PATCH' : 'POST',
        body: JSON.stringify(payrollRuleForm),
      })
      await loadAll()
      setPayrollRuleDialogOpen(false)
      notify.success(editingPayrollRuleId ? 'Parametre de paie mis a jour' : 'Parametre de paie cree')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur enregistrement parametre'
      setError(msg)
      notify.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const openCreateDepartment = () => {
    setEditingDepartmentId(null)
    setDepartmentForm(emptyDepartment)
    setDepartmentDialogOpen(true)
  }

  const openEditDepartment = (d: Department) => {
    setEditingDepartmentId(d.id)
    setDepartmentForm({
      name: d.name,
      code: d.code,
      description: d.description,
      is_active: d.is_active,
    })
    setDepartmentDialogOpen(true)
  }

  const submitDepartment = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await apiRequest(
        editingDepartmentId ? `/hr/departments/${editingDepartmentId}/` : '/hr/departments/',
        {
          method: editingDepartmentId ? 'PATCH' : 'POST',
          body: JSON.stringify(departmentForm),
        }
      )
      const wasDeptUpdate = Boolean(editingDepartmentId)
      await loadAll()
      setDepartmentDialogOpen(false)
      setDepartmentForm(emptyDepartment)
      setEditingDepartmentId(null)
      notify.success(wasDeptUpdate ? 'Departement mis a jour' : 'Departement cree')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur enregistrement departement'
      setError(msg)
      notify.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const openCreateEmployee = () => {
    setEditingEmployeeId(null)
    setEmployeeForm(emptyEmployee)
    setEmployeePhotoFile(null)
    setEmployeePhotoPreview('')
    setRemoveEmployeePhoto(false)
    setEmployeeDialogOpen(true)
  }

  const openEditEmployee = (e: Employee) => {
    const nationalityCode =
      resolveCountryCode(e.nationality, countries) || e.nationality
    setEditingEmployeeId(e.id)
    setEmployeeForm({
      first_name: e.user_first_name || '',
      last_name: e.user_last_name || '',
      personal_email: e.user_email || '',
      send_whatsapp: false,
      employee_number: e.employee_number,
      nationality: nationalityCode,
      date_of_birth: e.date_of_birth,
      place_of_birth: e.place_of_birth,
      gender: e.gender,
      marital_status: e.marital_status,
      national_id_number: e.national_id_number,
      id_document_type: e.id_document_type,
      job_title: e.job_title,
      department: e.department,
      hire_date: e.hire_date,
      professional_email: e.professional_email,
      phone_number: e.phone_number,
      residential_country: e.residential_country,
      residential_city: e.residential_city,
      residential_address: e.residential_address,
      manager: e.manager != null ? String(e.manager) : '',
      annual_leave_entitlement_days:
        e.annual_leave_entitlement_days != null && String(e.annual_leave_entitlement_days).trim() !== ''
          ? String(e.annual_leave_entitlement_days)
          : '25',
    })
    setEmployeePhotoFile(null)
    setEmployeePhotoPreview(e.profile_photo || '')
    setRemoveEmployeePhoto(false)
    setEmployeeDialogOpen(true)
  }

  const openEmployeeDetails = (employee: Employee) => {
    setSelectedEmployeeDetails(employee)
    setEmployeeDetailsDialogOpen(true)
  }

  const handleEmployeePhotoChange = (file: File | null) => {
    if (!file) return
    setEmployeePhotoFile(file)
    setRemoveEmployeePhoto(false)
    const reader = new FileReader()
    reader.onload = () => {
      setEmployeePhotoPreview(typeof reader.result === 'string' ? reader.result : '')
    }
    reader.readAsDataURL(file)
  }

  const submitEmployee = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const selectedNationalityName =
        countries.find((country) => country.code === employeeForm.nationality)?.name || employeeForm.nationality
      const payload = new FormData()
      Object.entries(employeeForm).forEach(([key, value]) => {
        if (typeof value === 'boolean') {
          payload.append(key, value ? 'true' : 'false')
          return
        }
        payload.append(key, String(value ?? ''))
      })
      payload.set('nationality', selectedNationalityName)
      if (employeePhotoFile) {
        payload.append('profile_photo', employeePhotoFile)
      }
      if (removeEmployeePhoto) {
        payload.append('remove_profile_photo', 'true')
      }
      await apiRequest(editingEmployeeId ? `/hr/employees/${editingEmployeeId}/` : '/hr/employees/', {
        method: editingEmployeeId ? 'PATCH' : 'POST',
        body: payload,
      })
      const wasEmployeeUpdate = Boolean(editingEmployeeId)
      await loadAll()
      void reloadLeaveBalances({ withSpinner: false })
      setEmployeeDialogOpen(false)
      setEmployeeForm(emptyEmployee)
      setEditingEmployeeId(null)
      setEmployeePhotoFile(null)
      setEmployeePhotoPreview('')
      setRemoveEmployeePhoto(false)
      notify.success(wasEmployeeUpdate ? 'Employe mis a jour' : 'Employe cree')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur enregistrement employe'
      setError(msg)
      notify.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const openCreateContract = () => {
    setEditingContractId(null)
    setContractForm(emptyContract)
    setContractDialogOpen(true)
  }

  const openEditContract = (c: Contract) => {
    setEditingContractId(c.id)
    setContractForm({
      employee: c.employee,
      contract_type: c.contract_type,
      start_date: c.start_date,
      end_date: c.end_date || '',
      salary: c.salary,
      currency: c.currency,
      status: c.status,
      notes: c.notes,
    })
    setContractDialogOpen(true)
  }

  const submitContract = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await apiRequest(editingContractId ? `/hr/contracts/${editingContractId}/` : '/hr/contracts/', {
        method: editingContractId ? 'PATCH' : 'POST',
        body: JSON.stringify({
          ...contractForm,
          end_date: contractForm.end_date || null,
        }),
      })
      const wasContractUpdate = Boolean(editingContractId)
      await loadAll()
      setContractDialogOpen(false)
      setContractForm(emptyContract)
      setEditingContractId(null)
      notify.success(wasContractUpdate ? 'Contrat mis a jour' : 'Contrat cree')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur enregistrement contrat'
      setError(msg)
      notify.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const deleteItem = async (path: string, label: string) => {
    setPendingDelete({ path, label })
  }

  const confirmDeleteItem = async () => {
    if (!pendingDelete) return
    const deletedPath = pendingDelete.path
    setDeleteSubmitting(true)
    try {
      await apiRequest(deletedPath, { method: 'DELETE' })
      await loadAll()
      if (deletedPath.includes('/hr/leaves/')) void reloadLeaveBalances({ withSpinner: false })
      setPendingDelete(null)
      notify.success('Suppression effectuee')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur suppression'
      setError(msg)
      notify.error(msg)
    } finally {
      setDeleteSubmitting(false)
    }
  }

  const openCreateLeave = () => {
    setEditingLeaveId(null)
    setLeaveForm(emptyLeave)
    setLeaveDialogOpen(true)
  }

  const openEditLeave = (l: LeaveRequest) => {
    if (l.status !== 'pending') return
    setEditingLeaveId(l.id)
    setLeaveForm({
      employee: l.employee,
      leave_type: l.leave_type,
      start_date: l.start_date,
      end_date: l.end_date,
      reason: l.reason || '',
    })
    setLeaveDialogOpen(true)
  }

  const submitLeave = async (e: FormEvent) => {
    e.preventDefault()
    if (!leaveForm.employee.trim() || !leaveForm.start_date || !leaveForm.end_date) {
      notify.warning('Employe et dates sont obligatoires.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const wasLeaveUpdate = Boolean(editingLeaveId)
      await apiRequest(wasLeaveUpdate ? `/hr/leaves/${editingLeaveId}/` : '/hr/leaves/', {
        method: wasLeaveUpdate ? 'PATCH' : 'POST',
        body: JSON.stringify({
          employee: leaveForm.employee,
          leave_type: leaveForm.leave_type,
          start_date: leaveForm.start_date,
          end_date: leaveForm.end_date,
          reason: leaveForm.reason,
        }),
      })
      await loadAll()
      void reloadLeaveBalances({ withSpinner: false })
      setLeaveDialogOpen(false)
      setLeaveForm(emptyLeave)
      setEditingLeaveId(null)
      notify.success(wasLeaveUpdate ? 'Demande mise a jour' : 'Demande creee')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur enregistrement conge'
      setError(msg)
      notify.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const runLeaveAction = async (id: string, action: 'approve' | 'reject' | 'cancel') => {
    setLeaveActionLoading(`${action}-${id}`)
    setError(null)
    try {
      await apiRequest(`/hr/leaves/${id}/${action}/`, { method: 'POST' })
      await loadAll()
      void reloadLeaveBalances({ withSpinner: false })
      notify.success(
        action === 'approve' ? 'Demande approuvee' : action === 'reject' ? 'Demande refusee' : 'Demande annulee'
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Action impossible'
      setError(msg)
      notify.error(msg)
    } finally {
      setLeaveActionLoading(null)
    }
  }

  const toggleSort = <T extends string>(
    key: T,
    current: { key: T; direction: SortDirection },
    setSort: (value: { key: T; direction: SortDirection }) => void
  ) => {
    if (current.key === key) {
      setSort({ key, direction: current.direction === 'asc' ? 'desc' : 'asc' })
      return
    }
    setSort({ key, direction: 'asc' })
  }

  const sortArrow = (active: boolean, direction: SortDirection) => (active ? (direction === 'asc' ? '↑' : '↓') : '↕')
  const employeeDisplayName = (employee: Employee) =>
    employee.user_full_name || employee.user_name || employee.employee_number || employee.professional_email || employee.id
  const employeeInitials = (employee: Employee) => {
    const first = employee.user_first_name?.[0] || employee.user_name?.[0] || 'E'
    const last = employee.user_last_name?.[0] || ''
    return `${first}${last}`.toUpperCase()
  }
  const departmentNameById = useMemo(
    () => new Map(departments.map((department) => [department.id, department.name])),
    [departments]
  )
  const employeeNameById = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employeeDisplayName(employee)])),
    [employees]
  )
  const employeeDepartmentLabel = (employee: Employee) => departmentNameById.get(employee.department) || employee.department
  const contractEmployeeLabel = (contract: Contract) => contract.employee_name || employeeNameById.get(contract.employee) || contract.employee
  const contractPeriodLabel = (contract: Contract) => `${contract.start_date}${contract.end_date ? ` -> ${contract.end_date}` : ''}`
  const payrollEmployeeLabel = (payroll: Payroll) => payroll.employee_name || employeeNameById.get(payroll.employee) || payroll.employee
  const leaveEmployeeLabel = (leave: LeaveRequest) =>
    leave.employee_name || employeeNameById.get(leave.employee) || leave.employee
  const leavePeriodLabel = (leave: LeaveRequest) =>
    `${displayDate(leave.start_date)} - ${displayDate(leave.end_date)}`
  const payrollPeriodLabel = (payroll: Payroll) => `${String(payroll.period_month).padStart(2, '0')}/${payroll.period_year}`

  const filteredEmployees = useMemo(() => {
    const q = normalizeText(employeeSearch)
    return employees
      .filter((employee) =>
        !q ||
        [employeeDisplayName(employee), employee.job_title, employeeDepartmentLabel(employee), employee.professional_email]
          .some((field) => normalizeText(field).includes(q))
      )
      .sort((a, b) => {
        const left =
          employeeSort.key === 'employee' ? employeeDisplayName(a) :
            employeeSort.key === 'department' ? employeeDepartmentLabel(a) : a[employeeSort.key]
        const right =
          employeeSort.key === 'employee' ? employeeDisplayName(b) :
            employeeSort.key === 'department' ? employeeDepartmentLabel(b) : b[employeeSort.key]
        return compareValues(left, right, employeeSort.direction)
      })
  }, [employees, employeeSearch, employeeSort, departments])

  const filteredDepartments = useMemo(() => {
    const q = normalizeText(departmentSearch)
    return departments
      .filter((department) =>
        !q ||
        [department.name, department.code, department.description, department.is_active ? 'oui' : 'non']
          .some((field) => normalizeText(field).includes(q))
      )
      .sort((a, b) => compareValues(a[departmentSort.key], b[departmentSort.key], departmentSort.direction))
  }, [departments, departmentSearch, departmentSort])

  const filteredContracts = useMemo(() => {
    const q = normalizeText(contractSearch)
    return contracts
      .filter((contract) =>
        !q ||
        [
          contractEmployeeLabel(contract),
          contractTypeLabelMap[contract.contract_type] || contract.contract_type,
          contractPeriodLabel(contract),
          `${contract.salary} ${contract.currency}`,
          contractStatusLabelMap[contract.status] || contract.status,
        ].some((field) => normalizeText(field).includes(q))
      )
      .sort((a, b) => {
        const left =
          contractSort.key === 'employee_name' ? contractEmployeeLabel(a) :
            contractSort.key === 'period' ? contractPeriodLabel(a) :
              contractSort.key === 'contract_type' ? (contractTypeLabelMap[a.contract_type] || a.contract_type) :
                contractSort.key === 'status' ? (contractStatusLabelMap[a.status] || a.status) :
                  a[contractSort.key]
        const right =
          contractSort.key === 'employee_name' ? contractEmployeeLabel(b) :
            contractSort.key === 'period' ? contractPeriodLabel(b) :
              contractSort.key === 'contract_type' ? (contractTypeLabelMap[b.contract_type] || b.contract_type) :
                contractSort.key === 'status' ? (contractStatusLabelMap[b.status] || b.status) :
                  b[contractSort.key]
        return compareValues(left, right, contractSort.direction)
      })
  }, [contracts, contractSearch, contractSort, employees])

  const filteredPayrollRules = useMemo(() => {
    const q = normalizeText(payrollRuleSearch)
    return payrollRules
      .filter((rule) =>
        !q ||
        [
          payrollCategoryLabelMap[rule.category],
          rule.name,
          rule.default_amount,
          rule.is_active ? 'actif' : 'inactif',
        ].some((field) => normalizeText(field).includes(q))
      )
      .sort((a, b) => {
        const left =
          payrollRuleSort.key === 'category' ? payrollCategoryLabelMap[a.category] :
            payrollRuleSort.key === 'is_active' ? (a.is_active ? 'actif' : 'inactif') :
              a[payrollRuleSort.key]
        const right =
          payrollRuleSort.key === 'category' ? payrollCategoryLabelMap[b.category] :
            payrollRuleSort.key === 'is_active' ? (b.is_active ? 'actif' : 'inactif') :
              b[payrollRuleSort.key]
        return compareValues(left, right, payrollRuleSort.direction)
      })
  }, [payrollRules, payrollRuleSearch, payrollRuleSort])

  const filteredPayrolls = useMemo(() => {
    const q = normalizeText(payrollSearch)
    return payrolls
      .filter((payroll) =>
        !q ||
        [
          payrollEmployeeLabel(payroll),
          payrollPeriodLabel(payroll),
          payroll.base_salary,
          payroll.gross_salary,
          payroll.net_salary,
          payrollStatusLabelMap[payroll.status] || payroll.status,
        ].some((field) => normalizeText(field).includes(q))
      )
      .sort((a, b) => {
        const left =
          payrollSort.key === 'employee_name' ? payrollEmployeeLabel(a) :
            payrollSort.key === 'period' ? `${a.period_year}-${String(a.period_month).padStart(2, '0')}` :
              payrollSort.key === 'status' ? (payrollStatusLabelMap[a.status] || a.status) :
                a[payrollSort.key]
        const right =
          payrollSort.key === 'employee_name' ? payrollEmployeeLabel(b) :
            payrollSort.key === 'period' ? `${b.period_year}-${String(b.period_month).padStart(2, '0')}` :
              payrollSort.key === 'status' ? (payrollStatusLabelMap[b.status] || b.status) :
                b[payrollSort.key]
        return compareValues(left, right, payrollSort.direction)
      })
  }, [payrolls, payrollSearch, payrollSort, employees])

  const filteredLeaves = useMemo(() => {
    const q = normalizeText(leaveSearch)
    return leaves
      .filter((leave) => {
        if (!q) return true
        return [
          leaveEmployeeLabel(leave),
          leaveTypeLabelMap[leave.leave_type] || leave.leave_type,
          leavePeriodLabel(leave),
          leave.days,
          leaveStatusLabelMap[leave.status] || leave.status,
          leave.reason,
        ].some((field) => normalizeText(field).includes(q))
      })
      .sort((a, b) => {
        const left =
          leaveSort.key === 'employee_name'
            ? leaveEmployeeLabel(a)
            : leaveSort.key === 'period'
              ? `${a.start_date}|${a.end_date}`
              : leaveSort.key === 'status'
                ? (leaveStatusLabelMap[a.status] || a.status)
                : leaveSort.key === 'leave_type'
                  ? (leaveTypeLabelMap[a.leave_type] || a.leave_type)
                  : a.days
        const right =
          leaveSort.key === 'employee_name'
            ? leaveEmployeeLabel(b)
            : leaveSort.key === 'period'
              ? `${b.start_date}|${b.end_date}`
              : leaveSort.key === 'status'
                ? (leaveStatusLabelMap[b.status] || b.status)
                : leaveSort.key === 'leave_type'
                  ? (leaveTypeLabelMap[b.leave_type] || b.leave_type)
                  : b.days
        return compareValues(left, right, leaveSort.direction)
      })
  }, [leaves, leaveSearch, leaveSort, employees])

  const myEmployeeProfileId = useMemo(() => {
    if (!authUser) return null
    const mine = employees.find((e) => e.user === authUser.id)
    return mine?.id ?? null
  }, [authUser, employees])

  const canLeaveApproveReject = (l: LeaveRequest) => {
    if (!authUser) return false
    if (authUser.is_staff || authUser.is_superuser || authUser.is_company_admin) return true
    const mid = l.employee_manager_id
    return mid != null && mid === authUser.id
  }

  const canLeaveEditOrDelete = (l: LeaveRequest) => {
    if (!authUser) return false
    if (authUser.is_staff || authUser.is_superuser) return true
    return myEmployeeProfileId != null && l.employee === myEmployeeProfileId
  }

  const canLeaveCancel = (l: LeaveRequest) => {
    if (!authUser) return false
    if (authUser.is_staff || authUser.is_superuser || authUser.is_company_admin) return true
    return myEmployeeProfileId != null && l.employee === myEmployeeProfileId
  }

  const employeeTotalPages = Math.max(1, Math.ceil(filteredEmployees.length / employeePageSize))
  const paginatedEmployees = useMemo(
    () => filteredEmployees.slice((employeePage - 1) * employeePageSize, employeePage * employeePageSize),
    [filteredEmployees, employeePage, employeePageSize]
  )
  const departmentTotalPages = Math.max(1, Math.ceil(filteredDepartments.length / departmentPageSize))
  const paginatedDepartments = useMemo(
    () => filteredDepartments.slice((departmentPage - 1) * departmentPageSize, departmentPage * departmentPageSize),
    [filteredDepartments, departmentPage, departmentPageSize]
  )
  const contractTotalPages = Math.max(1, Math.ceil(filteredContracts.length / contractPageSize))
  const paginatedContracts = useMemo(
    () => filteredContracts.slice((contractPage - 1) * contractPageSize, contractPage * contractPageSize),
    [filteredContracts, contractPage, contractPageSize]
  )
  const leaveTotalPages = Math.max(1, Math.ceil(filteredLeaves.length / leavePageSize))
  const paginatedLeaves = useMemo(
    () => filteredLeaves.slice((leavePage - 1) * leavePageSize, leavePage * leavePageSize),
    [filteredLeaves, leavePage, leavePageSize]
  )
  const payrollRuleTotalPages = Math.max(1, Math.ceil(filteredPayrollRules.length / payrollRulePageSize))
  const paginatedPayrollRules = useMemo(
    () => filteredPayrollRules.slice((payrollRulePage - 1) * payrollRulePageSize, payrollRulePage * payrollRulePageSize),
    [filteredPayrollRules, payrollRulePage, payrollRulePageSize]
  )
  const payrollTotalPages = Math.max(1, Math.ceil(filteredPayrolls.length / payrollPageSize))
  const paginatedPayrolls = useMemo(
    () => filteredPayrolls.slice((payrollPage - 1) * payrollPageSize, payrollPage * payrollPageSize),
    [filteredPayrolls, payrollPage, payrollPageSize]
  )

  useEffect(() => {
    setActiveTab(resolveHrTabFromPath(pathname))
  }, [pathname])

  useEffect(() => setEmployeePage(1), [employeeSearch])
  useEffect(() => setDepartmentPage(1), [departmentSearch])
  useEffect(() => setContractPage(1), [contractSearch])
  useEffect(() => setLeavePage(1), [leaveSearch])
  useEffect(() => setPayrollRulePage(1), [payrollRuleSearch])
  useEffect(() => setPayrollPage(1), [payrollSearch])

  useEffect(() => setEmployeePage((p) => Math.min(p, employeeTotalPages)), [employeeTotalPages])
  useEffect(() => setDepartmentPage((p) => Math.min(p, departmentTotalPages)), [departmentTotalPages])
  useEffect(() => setContractPage((p) => Math.min(p, contractTotalPages)), [contractTotalPages])
  useEffect(() => setLeavePage((p) => Math.min(p, leaveTotalPages)), [leaveTotalPages])
  useEffect(() => setPayrollRulePage((p) => Math.min(p, payrollRuleTotalPages)), [payrollRuleTotalPages])
  useEffect(() => setPayrollPage((p) => Math.min(p, payrollTotalPages)), [payrollTotalPages])

  const handleTabChange = (value: HrTab) => {
    setActiveTab(value)
    router.push(HR_TAB_PATHS[value])
  }

  return (
    <div className="space-y-6 p-4 md:p-8">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">Ressources humaines</h1>
      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

      <Tabs value={activeTab} onValueChange={(value) => handleTabChange(value as HrTab)} className="space-y-4">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-muted/50 p-1">
          <TabsTrigger value="employees">Employes</TabsTrigger>
          <TabsTrigger value="departments">Departements</TabsTrigger>
          <TabsTrigger value="contracts">Contrats</TabsTrigger>
          <TabsTrigger value="leaves">Conges</TabsTrigger>
          <TabsTrigger value="payroll-settings">Parametres paie</TabsTrigger>
          <TabsTrigger value="payrolls">Paie</TabsTrigger>
        </TabsList>

        <TabsContent value="employees" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Input
              value={employeeSearch}
              onChange={(e) => setEmployeeSearch(e.target.value)}
              placeholder="Rechercher un employe, poste, departement..."
              className="sm:max-w-md"
            />
            <Button type="button" onClick={openCreateEmployee}>Nouvel employe</Button>
          </div>
          <Card className="border border-border/80 shadow-sm">
            <CardContent className="pt-3">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead>
                      <button type="button" className="inline-flex items-center gap-1 font-medium" onClick={() => toggleSort('employee', employeeSort, setEmployeeSort)}>
                        Employe <span className="text-xs">{sortArrow(employeeSort.key === 'employee', employeeSort.direction)}</span>
                      </button>
                    </TableHead>
                    <TableHead>
                      <button type="button" className="inline-flex items-center gap-1 font-medium" onClick={() => toggleSort('job_title', employeeSort, setEmployeeSort)}>
                        Poste <span className="text-xs">{sortArrow(employeeSort.key === 'job_title', employeeSort.direction)}</span>
                      </button>
                    </TableHead>
                    <TableHead>
                      <button type="button" className="inline-flex items-center gap-1 font-medium" onClick={() => toggleSort('department', employeeSort, setEmployeeSort)}>
                        Departement <span className="text-xs">{sortArrow(employeeSort.key === 'department', employeeSort.direction)}</span>
                      </button>
                    </TableHead>
                    <TableHead>
                      <button type="button" className="inline-flex items-center gap-1 font-medium" onClick={() => toggleSort('professional_email', employeeSort, setEmployeeSort)}>
                        Email pro <span className="text-xs">{sortArrow(employeeSort.key === 'professional_email', employeeSort.direction)}</span>
                      </button>
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedEmployees.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-xs font-semibold text-primary">
                            {e.profile_photo ? (
                              <img src={e.profile_photo} alt={employeeDisplayName(e)} className="h-full w-full object-cover" />
                            ) : (
                              <span>{employeeInitials(e)}</span>
                            )}
                          </div>
                          <span>{employeeDisplayName(e)}</span>
                        </div>
                      </TableCell>
                      <TableCell>{e.job_title}</TableCell>
                      <TableCell>{employeeDepartmentLabel(e)}</TableCell>
                      <TableCell>{e.professional_email}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button type="button" size="sm" variant="secondary" onClick={() => openEmployeeDetails(e)}>Voir fiche</Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => openEditEmployee(e)}>Modifier</Button>
                          <Button type="button" size="sm" variant="destructive" onClick={() => void deleteItem(`/hr/employees/${e.id}/`, 'cet employe')}>Supprimer</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredEmployees.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">Aucun employe trouve.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          {!!filteredEmployees.length ? (
            <DataPagination
              totalItems={filteredEmployees.length}
              page={employeePage}
              pageSize={employeePageSize}
              onPageChange={setEmployeePage}
              onPageSizeChange={(size) => {
                setEmployeePageSize(size)
                setEmployeePage(1)
              }}
            />
          ) : null}
        </TabsContent>
        <TabsContent value="departments" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Input
              value={departmentSearch}
              onChange={(e) => setDepartmentSearch(e.target.value)}
              placeholder="Rechercher un departement..."
              className="sm:max-w-md"
            />
            <Button type="button" onClick={openCreateDepartment}>Nouveau departement</Button>
          </div>
          <Card className="border border-border/80 shadow-sm">
            <CardContent className="pt-3">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead>
                      <button type="button" className="inline-flex items-center gap-1 font-medium" onClick={() => toggleSort('name', departmentSort, setDepartmentSort)}>
                        Nom <span className="text-xs">{sortArrow(departmentSort.key === 'name', departmentSort.direction)}</span>
                      </button>
                    </TableHead>
                    <TableHead>
                      <button type="button" className="inline-flex items-center gap-1 font-medium" onClick={() => toggleSort('code', departmentSort, setDepartmentSort)}>
                        Code <span className="text-xs">{sortArrow(departmentSort.key === 'code', departmentSort.direction)}</span>
                      </button>
                    </TableHead>
                    <TableHead>
                      <button type="button" className="inline-flex items-center gap-1 font-medium" onClick={() => toggleSort('description', departmentSort, setDepartmentSort)}>
                        Description <span className="text-xs">{sortArrow(departmentSort.key === 'description', departmentSort.direction)}</span>
                      </button>
                    </TableHead>
                    <TableHead>
                      <button type="button" className="inline-flex items-center gap-1 font-medium" onClick={() => toggleSort('is_active', departmentSort, setDepartmentSort)}>
                        Actif <span className="text-xs">{sortArrow(departmentSort.key === 'is_active', departmentSort.direction)}</span>
                      </button>
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedDepartments.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>{d.name}</TableCell>
                      <TableCell>{d.code || '—'}</TableCell>
                      <TableCell>{d.description || '—'}</TableCell>
                      <TableCell>{d.is_active ? 'Oui' : 'Non'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => openEditDepartment(d)}>Modifier</Button>
                          <Button type="button" size="sm" variant="destructive" onClick={() => void deleteItem(`/hr/departments/${d.id}/`, 'ce departement')}>Supprimer</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredDepartments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">Aucun departement trouve.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          {!!filteredDepartments.length ? (
            <DataPagination
              totalItems={filteredDepartments.length}
              page={departmentPage}
              pageSize={departmentPageSize}
              onPageChange={setDepartmentPage}
              onPageSizeChange={(size) => {
                setDepartmentPageSize(size)
                setDepartmentPage(1)
              }}
            />
          ) : null}
        </TabsContent>
        <TabsContent value="contracts" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Input
              value={contractSearch}
              onChange={(e) => setContractSearch(e.target.value)}
              placeholder="Rechercher un contrat..."
              className="sm:max-w-md"
            />
            <Button type="button" onClick={openCreateContract}>Nouveau contrat</Button>
          </div>
          <Card className="border border-border/80 shadow-sm">
            <CardContent className="pt-3">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead>
                      <button type="button" className="inline-flex items-center gap-1 font-medium" onClick={() => toggleSort('employee_name', contractSort, setContractSort)}>
                        Employe <span className="text-xs">{sortArrow(contractSort.key === 'employee_name', contractSort.direction)}</span>
                      </button>
                    </TableHead>
                    <TableHead>
                      <button type="button" className="inline-flex items-center gap-1 font-medium" onClick={() => toggleSort('contract_type', contractSort, setContractSort)}>
                        Type <span className="text-xs">{sortArrow(contractSort.key === 'contract_type', contractSort.direction)}</span>
                      </button>
                    </TableHead>
                    <TableHead>
                      <button type="button" className="inline-flex items-center gap-1 font-medium" onClick={() => toggleSort('period', contractSort, setContractSort)}>
                        Periode <span className="text-xs">{sortArrow(contractSort.key === 'period', contractSort.direction)}</span>
                      </button>
                    </TableHead>
                    <TableHead>
                      <button type="button" className="inline-flex items-center gap-1 font-medium" onClick={() => toggleSort('salary', contractSort, setContractSort)}>
                        Salaire <span className="text-xs">{sortArrow(contractSort.key === 'salary', contractSort.direction)}</span>
                      </button>
                    </TableHead>
                    <TableHead>
                      <button type="button" className="inline-flex items-center gap-1 font-medium" onClick={() => toggleSort('status', contractSort, setContractSort)}>
                        Statut <span className="text-xs">{sortArrow(contractSort.key === 'status', contractSort.direction)}</span>
                      </button>
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedContracts.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{contractEmployeeLabel(c)}</TableCell>
                      <TableCell>{contractTypeLabelMap[c.contract_type] || c.contract_type}</TableCell>
                      <TableCell>{contractPeriodLabel(c)}</TableCell>
                      <TableCell>{formatCurrency(c.salary, c.currency || tenantCurrency)}</TableCell>
                      <TableCell>{contractStatusLabelMap[c.status] || c.status}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => openEditContract(c)}>Modifier</Button>
                          <Button type="button" size="sm" variant="destructive" onClick={() => void deleteItem(`/hr/contracts/${c.id}/`, 'ce contrat')}>Supprimer</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredContracts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">Aucun contrat trouve.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          {!!filteredContracts.length ? (
            <DataPagination
              totalItems={filteredContracts.length}
              page={contractPage}
              pageSize={contractPageSize}
              onPageChange={setContractPage}
              onPageSizeChange={(size) => {
                setContractPageSize(size)
                setContractPage(1)
              }}
            />
          ) : null}
        </TabsContent>

        <TabsContent value="leaves" className="space-y-4">
          <Card className="border border-border/80 shadow-sm">
            <CardContent className="pt-4">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-medium">Soldes conges annuels</p>
                  <p className="text-xs text-muted-foreground">Droit, pris, en attente et reste (conges annuels).</p>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="leave-balance-year" className="whitespace-nowrap text-xs text-muted-foreground">
                    Annee
                  </Label>
                  <Input
                    id="leave-balance-year"
                    type="number"
                    className="w-24"
                    min={2000}
                    max={2100}
                    value={leaveBalanceYear}
                    onChange={(e) => setLeaveBalanceYear(Number(e.target.value) || new Date().getFullYear())}
                  />
                </div>
              </div>
              {loadingLeaveSummary ? (
                <p className="text-sm text-muted-foreground">Chargement des soldes...</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employe</TableHead>
                        <TableHead className="text-right">Droit</TableHead>
                        <TableHead className="text-right">Pris</TableHead>
                        <TableHead className="text-right">En attente</TableHead>
                        <TableHead className="text-right">Reste</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaveBalances.map((row) => (
                        <TableRow key={row.employee_id}>
                          <TableCell>{row.employee_name}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatLeaveDaysDisplay(row.entitlement)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatLeaveDaysDisplay(row.used)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatLeaveDaysDisplay(row.pending)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatLeaveDaysDisplay(row.remaining)}</TableCell>
                        </TableRow>
                      ))}
                      {leaveBalances.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="py-4 text-center text-sm text-muted-foreground">
                            Aucun solde a afficher.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Input
              value={leaveSearch}
              onChange={(e) => setLeaveSearch(e.target.value)}
              placeholder="Rechercher un employe, type, statut..."
              className="sm:max-w-md"
            />
            <Button type="button" onClick={openCreateLeave}>
              Nouvelle demande
            </Button>
          </div>
          <Card className="border border-border/80 shadow-sm">
            <CardContent className="pt-3">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 font-medium"
                        onClick={() => toggleSort('employee_name', leaveSort, setLeaveSort)}
                      >
                        Employe{' '}
                        <span className="text-xs">{sortArrow(leaveSort.key === 'employee_name', leaveSort.direction)}</span>
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 font-medium"
                        onClick={() => toggleSort('leave_type', leaveSort, setLeaveSort)}
                      >
                        Type{' '}
                        <span className="text-xs">{sortArrow(leaveSort.key === 'leave_type', leaveSort.direction)}</span>
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 font-medium"
                        onClick={() => toggleSort('period', leaveSort, setLeaveSort)}
                      >
                        Periode{' '}
                        <span className="text-xs">{sortArrow(leaveSort.key === 'period', leaveSort.direction)}</span>
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 font-medium"
                        onClick={() => toggleSort('days', leaveSort, setLeaveSort)}
                      >
                        Jours{' '}
                        <span className="text-xs">{sortArrow(leaveSort.key === 'days', leaveSort.direction)}</span>
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 font-medium"
                        onClick={() => toggleSort('status', leaveSort, setLeaveSort)}
                      >
                        Statut{' '}
                        <span className="text-xs">{sortArrow(leaveSort.key === 'status', leaveSort.direction)}</span>
                      </button>
                    </TableHead>
                    <TableHead>Valide par</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedLeaves.map((l) => {
                    const busy = Boolean(leaveActionLoading && leaveActionLoading.endsWith(l.id))
                    const pending = l.status === 'pending'
                    const showEdit = pending && canLeaveEditOrDelete(l)
                    const showApprove = pending && canLeaveApproveReject(l)
                    const showCancel = pending && canLeaveCancel(l)
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">{leaveEmployeeLabel(l)}</TableCell>
                        <TableCell>{leaveTypeLabelMap[l.leave_type] || l.leave_type}</TableCell>
                        <TableCell className="whitespace-nowrap">{leavePeriodLabel(l)}</TableCell>
                        <TableCell className="tabular-nums">{formatLeaveDaysDisplay(l.days)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              l.status === 'approved'
                                ? 'default'
                                : l.status === 'rejected'
                                  ? 'destructive'
                                  : l.status === 'cancelled'
                                    ? 'outline'
                                    : 'secondary'
                            }
                          >
                            {leaveStatusLabelMap[l.status] || l.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[140px] truncate text-xs text-muted-foreground">
                          {l.approved_by_name || '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-1">
                            {pending ? (
                              <>
                                {showEdit ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={busy}
                                    onClick={() => openEditLeave(l)}
                                  >
                                    Modifier
                                  </Button>
                                ) : null}
                                {showApprove ? (
                                  <>
                                    <Button
                                      type="button"
                                      size="sm"
                                      className="bg-emerald-600 text-white hover:bg-emerald-600/90"
                                      disabled={busy}
                                      onClick={() => void runLeaveAction(l.id, 'approve')}
                                    >
                                      {leaveActionLoading === `approve-${l.id}` ? '...' : 'Approuver'}
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="destructive"
                                      disabled={busy}
                                      onClick={() => void runLeaveAction(l.id, 'reject')}
                                    >
                                      {leaveActionLoading === `reject-${l.id}` ? '...' : 'Refuser'}
                                    </Button>
                                  </>
                                ) : null}
                                {showCancel ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    disabled={busy}
                                    onClick={() => void runLeaveAction(l.id, 'cancel')}
                                  >
                                    {leaveActionLoading === `cancel-${l.id}` ? '...' : 'Annuler'}
                                  </Button>
                                ) : null}
                                {showEdit ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="text-destructive"
                                    disabled={busy}
                                    onClick={() => void deleteItem(`/hr/leaves/${l.id}/`, 'cette demande de conge')}
                                  >
                                    Supprimer
                                  </Button>
                                ) : null}
                                {!showEdit && !showApprove && !showCancel ? (
                                  <span className="text-xs text-muted-foreground">—</span>
                                ) : null}
                              </>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {filteredLeaves.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                        Aucune demande de conge.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          {!!filteredLeaves.length ? (
            <DataPagination
              totalItems={filteredLeaves.length}
              page={leavePage}
              pageSize={leavePageSize}
              onPageChange={setLeavePage}
              onPageSizeChange={(size) => {
                setLeavePageSize(size)
                setLeavePage(1)
              }}
            />
          ) : null}
        </TabsContent>

        <TabsContent value="payroll-settings" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Input
              value={payrollRuleSearch}
              onChange={(e) => setPayrollRuleSearch(e.target.value)}
              placeholder="Rechercher un parametre de paie..."
              className="sm:max-w-md"
            />
            <Button type="button" onClick={openCreateRule}>Nouveau parametre</Button>
          </div>
          <Card className="border border-border/80 shadow-sm">
            <CardContent className="pt-3">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead>
                      <button type="button" className="inline-flex items-center gap-1 font-medium" onClick={() => toggleSort('category', payrollRuleSort, setPayrollRuleSort)}>
                        Type <span className="text-xs">{sortArrow(payrollRuleSort.key === 'category', payrollRuleSort.direction)}</span>
                      </button>
                    </TableHead>
                    <TableHead>
                      <button type="button" className="inline-flex items-center gap-1 font-medium" onClick={() => toggleSort('name', payrollRuleSort, setPayrollRuleSort)}>
                        Nom <span className="text-xs">{sortArrow(payrollRuleSort.key === 'name', payrollRuleSort.direction)}</span>
                      </button>
                    </TableHead>
                    <TableHead>
                      <button type="button" className="inline-flex items-center gap-1 font-medium" onClick={() => toggleSort('default_amount', payrollRuleSort, setPayrollRuleSort)}>
                        Montant <span className="text-xs">{sortArrow(payrollRuleSort.key === 'default_amount', payrollRuleSort.direction)}</span>
                      </button>
                    </TableHead>
                    <TableHead>
                      <button type="button" className="inline-flex items-center gap-1 font-medium" onClick={() => toggleSort('is_active', payrollRuleSort, setPayrollRuleSort)}>
                        Statut <span className="text-xs">{sortArrow(payrollRuleSort.key === 'is_active', payrollRuleSort.direction)}</span>
                      </button>
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedPayrollRules.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Badge variant={r.category === 'deduction' ? 'destructive' : 'secondary'}>
                          {payrollCategoryLabelMap[r.category]}
                        </Badge>
                      </TableCell>
                      <TableCell>{r.name}</TableCell>
                      <TableCell>{formatCurrency(r.default_amount)}</TableCell>
                      <TableCell>
                        <Badge variant={r.is_active ? 'default' : 'outline'}>
                          {r.is_active ? 'Actif' : 'Inactif'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => openEditRule(r)}>Modifier</Button>
                          <Button type="button" size="sm" variant="destructive" onClick={() => void deleteItem(`/hr/payroll-rules/${r.id}/`, 'ce parametre')}>Supprimer</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredPayrollRules.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">Aucun parametre trouve.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          {!!filteredPayrollRules.length ? (
            <DataPagination
              totalItems={filteredPayrollRules.length}
              page={payrollRulePage}
              pageSize={payrollRulePageSize}
              onPageChange={setPayrollRulePage}
              onPageSizeChange={(size) => {
                setPayrollRulePageSize(size)
                setPayrollRulePage(1)
              }}
            />
          ) : null}
        </TabsContent>

        <TabsContent value="payrolls" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Input
              value={payrollSearch}
              onChange={(e) => setPayrollSearch(e.target.value)}
              placeholder="Rechercher une paie..."
              className="sm:max-w-md"
            />
            <Button type="button" onClick={openCreatePayroll}>Nouvelle paie</Button>
          </div>
          <Card className="border border-border/80 shadow-sm">
            <CardContent className="pt-3">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead>
                      <button type="button" className="inline-flex items-center gap-1 font-medium" onClick={() => toggleSort('employee_name', payrollSort, setPayrollSort)}>
                        Employe <span className="text-xs">{sortArrow(payrollSort.key === 'employee_name', payrollSort.direction)}</span>
                      </button>
                    </TableHead>
                    <TableHead>
                      <button type="button" className="inline-flex items-center gap-1 font-medium" onClick={() => toggleSort('period', payrollSort, setPayrollSort)}>
                        Periode <span className="text-xs">{sortArrow(payrollSort.key === 'period', payrollSort.direction)}</span>
                      </button>
                    </TableHead>
                    <TableHead>
                      <button type="button" className="inline-flex items-center gap-1 font-medium" onClick={() => toggleSort('base_salary', payrollSort, setPayrollSort)}>
                        Base <span className="text-xs">{sortArrow(payrollSort.key === 'base_salary', payrollSort.direction)}</span>
                      </button>
                    </TableHead>
                    <TableHead>
                      <button type="button" className="inline-flex items-center gap-1 font-medium" onClick={() => toggleSort('gross_salary', payrollSort, setPayrollSort)}>
                        Brut <span className="text-xs">{sortArrow(payrollSort.key === 'gross_salary', payrollSort.direction)}</span>
                      </button>
                    </TableHead>
                    <TableHead>
                      <button type="button" className="inline-flex items-center gap-1 font-medium" onClick={() => toggleSort('net_salary', payrollSort, setPayrollSort)}>
                        Net <span className="text-xs">{sortArrow(payrollSort.key === 'net_salary', payrollSort.direction)}</span>
                      </button>
                    </TableHead>
                    <TableHead>
                      <button type="button" className="inline-flex items-center gap-1 font-medium" onClick={() => toggleSort('status', payrollSort, setPayrollSort)}>
                        Statut <span className="text-xs">{sortArrow(payrollSort.key === 'status', payrollSort.direction)}</span>
                      </button>
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedPayrolls.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{payrollEmployeeLabel(p)}</TableCell>
                      <TableCell>{payrollPeriodLabel(p)}</TableCell>
                      <TableCell>{formatCurrency(p.base_salary, getEmployeeContractCurrency(p.employee))}</TableCell>
                      <TableCell>{formatCurrency(p.gross_salary, getEmployeeContractCurrency(p.employee))}</TableCell>
                      <TableCell>{formatCurrency(p.net_salary, getEmployeeContractCurrency(p.employee))}</TableCell>
                      <TableCell>
                        <Badge variant={p.status === 'paid' ? 'default' : p.status === 'processed' ? 'secondary' : 'outline'}>
                          {payrollStatusLabelMap[p.status] || p.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => openEditPayroll(p)}>Modifier</Button>
                          <Button type="button" size="sm" variant="destructive" onClick={() => void deleteItem(`/hr/payrolls/${p.id}/`, 'cette paie')}>Supprimer</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredPayrolls.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">Aucune paie trouvee.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          {!!filteredPayrolls.length ? (
            <DataPagination
              totalItems={filteredPayrolls.length}
              page={payrollPage}
              pageSize={payrollPageSize}
              onPageChange={setPayrollPage}
              onPageSizeChange={(size) => {
                setPayrollPageSize(size)
                setPayrollPage(1)
              }}
            />
          ) : null}
        </TabsContent>
      </Tabs>

      <Dialog open={departmentDialogOpen} onOpenChange={setDepartmentDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingDepartmentId ? 'Modifier departement' : 'Nouveau departement'}</DialogTitle>
            <DialogDescription>Renseigner les informations du departement.</DialogDescription>
          </DialogHeader>
          <form className="grid gap-3" onSubmit={submitDepartment}>
            <div className="space-y-2">
              <Label>Nom<RequiredMark /></Label>
              <Input placeholder="Ex: Technologie" value={departmentForm.name} onChange={(e) => setDepartmentForm((p) => ({ ...p, name: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label>Code</Label>
              <Input placeholder="Ex: DEP-TECH" value={departmentForm.code} onChange={(e) => setDepartmentForm((p) => ({ ...p, code: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea placeholder="Description du departement" value={departmentForm.description} onChange={(e) => setDepartmentForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
            <label className="flex h-9 items-center gap-2 rounded-md border border-input px-3 text-sm">
              <input
                type="checkbox"
                checked={departmentForm.is_active}
                onChange={(e) => setDepartmentForm((p) => ({ ...p, is_active: e.target.checked }))}
              />
              Departement actif
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDepartmentDialogOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={submitting}>Enregistrer</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={employeeDialogOpen} onOpenChange={setEmployeeDialogOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editingEmployeeId ? 'Modifier employe' : 'Nouvel employe'}</DialogTitle>
            <DialogDescription>Creation de compte employe et profil RH.</DialogDescription>
          </DialogHeader>
          <form className="grid gap-3" onSubmit={submitEmployee}>
            <div className="rounded-lg border border-input/80 p-4">
              <p className="mb-3 text-sm font-medium">Informations personnelles</p>
              <div className="mb-3 rounded-lg border border-input/70 bg-muted/20 p-3">
                <Label>Photo de profil</Label>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-input bg-background text-sm font-semibold text-muted-foreground">
                    {employeePhotoPreview ? (
                      <img src={employeePhotoPreview} alt="Apercu photo profil" className="h-full w-full object-cover" />
                    ) : (
                      <span>Photo</span>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(event) => handleEmployeePhotoChange(event.target.files?.[0] || null)}
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEmployeePhotoFile(null)
                          setEmployeePhotoPreview('')
                          setRemoveEmployeePhoto(true)
                        }}
                        disabled={!employeePhotoPreview}
                      >
                        Retirer photo
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-2"><Label>Prenom<RequiredMark /></Label><Input placeholder="Ex: Jean" value={employeeForm.first_name} onChange={(e) => setEmployeeForm((p) => ({ ...p, first_name: e.target.value }))} required /></div>
                <div className="space-y-2"><Label>Nom<RequiredMark /></Label><Input placeholder="Ex: Dupont" value={employeeForm.last_name} onChange={(e) => setEmployeeForm((p) => ({ ...p, last_name: e.target.value }))} required /></div>
                <div className="space-y-2"><Label>Email personnel<RequiredMark /></Label><Input placeholder="Ex: employe@gmail.com" type="email" value={employeeForm.personal_email} onChange={(e) => setEmployeeForm((p) => ({ ...p, personal_email: e.target.value }))} required /></div>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <div className="space-y-2"><Label>Nationalite<RequiredMark /></Label><SearchableSelect value={employeeForm.nationality} onChange={(v) => setEmployeeForm((p) => ({ ...p, nationality: v, place_of_birth: '' }))} options={countryOptions} placeholder={loadingCountries ? 'Chargement des nationalites...' : 'Selectionner une nationalite'} /></div>
                <DateTimeField
                  label={<><span>Date naissance</span><RequiredMark /></>}
                  value={employeeForm.date_of_birth}
                  onChange={(value) => setEmployeeForm((p) => ({ ...p, date_of_birth: value }))}
                  required
                />
                <div className="space-y-2">
                  <Label>Lieu naissance<RequiredMark /></Label>
                  <SearchableSelect
                    value={employeeForm.place_of_birth}
                    onChange={(v) => setEmployeeForm((p) => ({ ...p, place_of_birth: v }))}
                    options={birthCityOptions}
                    placeholder={
                      !resolveCountryCode(employeeForm.nationality, countries)
                        ? "Selectionnez d'abord une nationalite"
                        : loadingBirthCities
                          ? 'Chargement des villes...'
                          : 'Selectionner une ville de naissance'
                    }
                    emptyMessage="Aucune ville trouvee"
                    disabled={!resolveCountryCode(employeeForm.nationality, countries)}
                  />
                </div>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <div className="space-y-2"><Label>Genre<RequiredMark /></Label><SearchableSelect value={employeeForm.gender} onChange={(v) => setEmployeeForm((p) => ({ ...p, gender: v as EmployeeForm['gender'] }))} options={genderOptions} placeholder="Selectionner le genre" /></div>
                <div className="space-y-2"><Label>Situation matrimoniale<RequiredMark /></Label><SearchableSelect value={employeeForm.marital_status} onChange={(v) => setEmployeeForm((p) => ({ ...p, marital_status: v as EmployeeForm['marital_status'] }))} options={maritalStatusOptions} placeholder="Selectionner la situation" /></div>
                <div className="space-y-2"><Label>Numero piece<RequiredMark /></Label><Input placeholder="Ex: CNI123456789" value={employeeForm.national_id_number} onChange={(e) => setEmployeeForm((p) => ({ ...p, national_id_number: e.target.value }))} required /></div>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="space-y-2"><Label>Type piece</Label><SearchableSelect value={employeeForm.id_document_type} onChange={(v) => setEmployeeForm((p) => ({ ...p, id_document_type: v }))} options={idDocumentTypeOptions} placeholder="Selectionner un type de piece" /></div>
                <div className="space-y-2"><Label>Adresse<RequiredMark /></Label><Input placeholder="Ex: Quartier, rue, numero" value={employeeForm.residential_address} onChange={(e) => setEmployeeForm((p) => ({ ...p, residential_address: e.target.value }))} required /></div>
              </div>

            </div>

            <div className="rounded-lg border border-input/80 p-4">
              <p className="mb-3 text-sm font-medium">Informations professionnelles</p>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-2"><Label>Matricule</Label><Input placeholder="Ex: EMP-001" value={employeeForm.employee_number} onChange={(e) => setEmployeeForm((p) => ({ ...p, employee_number: e.target.value }))} /></div>
                <DateTimeField
                  label={<><span>Date embauche</span><RequiredMark /></>}
                  value={employeeForm.hire_date}
                  onChange={(value) => setEmployeeForm((p) => ({ ...p, hire_date: value }))}
                  required
                />
                <div className="space-y-2"><Label>Telephone<RequiredMark /></Label><Input placeholder="Ex: +228 99 99 99 99" value={employeeForm.phone_number} onChange={(e) => setEmployeeForm((p) => ({ ...p, phone_number: e.target.value }))} required /></div>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="space-y-2"><Label>Poste<RequiredMark /></Label><Input placeholder="Ex: Developpeur Full Stack" value={employeeForm.job_title} onChange={(e) => setEmployeeForm((p) => ({ ...p, job_title: e.target.value }))} required /></div>
                <div className="space-y-2"><Label>Departement<RequiredMark /></Label><SearchableSelect value={employeeForm.department} onChange={(v) => setEmployeeForm((p) => ({ ...p, department: v }))} options={departmentOptions} placeholder="Selectionner un departement" /></div>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Responsable hierarchique</Label>
                  <SearchableSelect
                    value={employeeForm.manager}
                    onChange={(v) => setEmployeeForm((p) => ({ ...p, manager: v }))}
                    options={managerUserOptions}
                    placeholder="Aucun ou selectionner un superviseur"
                    emptyMessage="Aucun utilisateur"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Jours de conges annuels (droit)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.5"
                    value={employeeForm.annual_leave_entitlement_days}
                    onChange={(e) => setEmployeeForm((p) => ({ ...p, annual_leave_entitlement_days: e.target.value }))}
                  />
                </div>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="space-y-2"><Label>Email professionnel<RequiredMark /></Label><Input placeholder="Ex: prenom.nom@entreprise.com" type="email" value={employeeForm.professional_email} onChange={(e) => setEmployeeForm((p) => ({ ...p, professional_email: e.target.value }))} required /></div>
              </div>

              <div className="mt-3">
                <LocationCountryCityFields
                  country={employeeForm.residential_country}
                  city={employeeForm.residential_city}
                  onCountryChange={(v) => setEmployeeForm((p) => ({ ...p, residential_country: v }))}
                  onCityChange={(v) => setEmployeeForm((p) => ({ ...p, residential_city: v }))}
                  countryRequired
                  cityRequired
                  countryLabel="Pays professionnel"
                  cityLabel="Ville professionnelle"
                />
              </div>
            </div>

            <label className="flex h-9 items-center gap-2 rounded-md border border-input px-3 text-sm">
              <input type="checkbox" checked={employeeForm.send_whatsapp} onChange={(e) => setEmployeeForm((p) => ({ ...p, send_whatsapp: e.target.checked }))} />
              Envoyer les acces WhatsApp
            </label>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEmployeeDialogOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={submitting}>Enregistrer</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={employeeDetailsDialogOpen}
        onOpenChange={(open) => {
          setEmployeeDetailsDialogOpen(open)
          if (!open) setSelectedEmployeeDetails(null)
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Fiche employe</DialogTitle>
            <DialogDescription>Vue complete du profil employe.</DialogDescription>
          </DialogHeader>
          {selectedEmployeeDetails && (
            <div className="grid gap-4">
              <div className="rounded-xl border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-24 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-primary/20 bg-primary/10 text-base font-semibold text-primary shadow-sm">
                    {selectedEmployeeDetails.profile_photo ? (
                      <img
                        src={selectedEmployeeDetails.profile_photo}
                        alt={selectedEmployeeDetails.user_full_name || selectedEmployeeDetails.user_name || 'Employe'}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <>
                        {(selectedEmployeeDetails.user_first_name?.[0] || selectedEmployeeDetails.user_name?.[0] || 'E').toUpperCase()}
                        {(selectedEmployeeDetails.user_last_name?.[0] || '').toUpperCase()}
                      </>
                    )}
                  </div>
                  <div className="min-w-0 pt-1">
                    <p className="truncate text-base font-semibold">
                      {selectedEmployeeDetails.user_full_name || `${selectedEmployeeDetails.user_first_name || ''} ${selectedEmployeeDetails.user_last_name || ''}`.trim() || selectedEmployeeDetails.user_name || '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">Photo format passeport</p>
                    <p className="truncate text-sm text-muted-foreground">{selectedEmployeeDetails.professional_email || selectedEmployeeDetails.user_email || '—'}</p>
                  </div>
                  <div className="ml-auto hidden md:block">
                    <Badge variant="secondary">{employeeDepartmentLabel(selectedEmployeeDetails) || 'Sans departement'}</Badge>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-input/80 p-4">
                <p className="mb-3 text-sm font-semibold">Informations personnelles</p>
                <div className="grid gap-2 md:grid-cols-3">
                  <div className="rounded-md bg-muted/30 p-3 text-sm"><p className="text-xs text-muted-foreground">Email personnel</p><p className="font-medium">{selectedEmployeeDetails.user_email || '—'}</p></div>
                  <div className="rounded-md bg-muted/30 p-3 text-sm"><p className="text-xs text-muted-foreground">Nationalite</p><p className="font-medium">{displayCountry(selectedEmployeeDetails.nationality) || '—'}</p></div>
                  <div className="rounded-md bg-muted/30 p-3 text-sm"><p className="text-xs text-muted-foreground">Date de naissance</p><p className="font-medium">{displayDate(selectedEmployeeDetails.date_of_birth)}</p></div>
                  <div className="rounded-md bg-muted/30 p-3 text-sm"><p className="text-xs text-muted-foreground">Lieu de naissance</p><p className="font-medium">{selectedEmployeeDetails.place_of_birth || '—'}</p></div>
                  <div className="rounded-md bg-muted/30 p-3 text-sm"><p className="text-xs text-muted-foreground">Genre</p><p className="font-medium">{genderLabelMap[selectedEmployeeDetails.gender] || selectedEmployeeDetails.gender || '—'}</p></div>
                  <div className="rounded-md bg-muted/30 p-3 text-sm"><p className="text-xs text-muted-foreground">Situation matrimoniale</p><p className="font-medium">{maritalStatusLabelMap[selectedEmployeeDetails.marital_status] || selectedEmployeeDetails.marital_status || '—'}</p></div>
                  <div className="rounded-md bg-muted/30 p-3 text-sm"><p className="text-xs text-muted-foreground">Type de piece</p><p className="font-medium">{selectedEmployeeDetails.id_document_type || '—'}</p></div>
                  <div className="rounded-md bg-muted/30 p-3 text-sm"><p className="text-xs text-muted-foreground">Numero de piece</p><p className="font-medium">{selectedEmployeeDetails.national_id_number || '—'}</p></div>
                </div>
              </div>

              <div className="rounded-xl border border-input/80 p-4">
                <p className="mb-3 text-sm font-semibold">Informations professionnelles</p>
                <div className="grid gap-2 md:grid-cols-3">
                  <div className="rounded-md bg-muted/30 p-3 text-sm"><p className="text-xs text-muted-foreground">Matricule</p><p className="font-medium">{selectedEmployeeDetails.employee_number || '—'}</p></div>
                  <div className="rounded-md bg-muted/30 p-3 text-sm"><p className="text-xs text-muted-foreground">Date d'embauche</p><p className="font-medium">{displayDate(selectedEmployeeDetails.hire_date)}</p></div>
                  <div className="rounded-md bg-muted/30 p-3 text-sm"><p className="text-xs text-muted-foreground">Poste</p><p className="font-medium">{selectedEmployeeDetails.job_title || '—'}</p></div>
                  <div className="rounded-md bg-muted/30 p-3 text-sm"><p className="text-xs text-muted-foreground">Departement</p><p className="font-medium">{employeeDepartmentLabel(selectedEmployeeDetails) || '—'}</p></div>
                  <div className="rounded-md bg-muted/30 p-3 text-sm"><p className="text-xs text-muted-foreground">Email professionnel</p><p className="font-medium">{selectedEmployeeDetails.professional_email || '—'}</p></div>
                  <div className="rounded-md bg-muted/30 p-3 text-sm"><p className="text-xs text-muted-foreground">Telephone</p><p className="font-medium">{selectedEmployeeDetails.phone_number || '—'}</p></div>
                  <div className="rounded-md bg-muted/30 p-3 text-sm"><p className="text-xs text-muted-foreground">Pays professionnel</p><p className="font-medium">{displayCountry(selectedEmployeeDetails.residential_country) || '—'}</p></div>
                  <div className="rounded-md bg-muted/30 p-3 text-sm"><p className="text-xs text-muted-foreground">Ville professionnelle</p><p className="font-medium">{selectedEmployeeDetails.residential_city || '—'}</p></div>
                  <div className="rounded-md bg-muted/30 p-3 text-sm md:col-span-3"><p className="text-xs text-muted-foreground">Adresse professionnelle</p><p className="font-medium">{selectedEmployeeDetails.residential_address || '—'}</p></div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={contractDialogOpen} onOpenChange={setContractDialogOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingContractId ? 'Modifier contrat' : 'Nouveau contrat'}</DialogTitle>
            <DialogDescription>Contrat de travail de l employe.</DialogDescription>
          </DialogHeader>
          <form className="grid gap-3" onSubmit={submitContract}>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2"><Label>Employe<RequiredMark /></Label><SearchableSelect value={contractForm.employee} onChange={(v) => setContractForm((p) => ({ ...p, employee: v }))} options={employeeOptions} placeholder="Selectionner un employe" /></div>
              <div className="space-y-2"><Label>Type contrat<RequiredMark /></Label><SearchableSelect value={contractForm.contract_type} onChange={(v) => setContractForm((p) => ({ ...p, contract_type: v }))} options={contractTypeOptions} placeholder="Selectionner le type de contrat" /></div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <DateTimeField
                label={<><span>Date debut</span><RequiredMark /></>}
                value={contractForm.start_date}
                onChange={(value) => setContractForm((p) => ({ ...p, start_date: value }))}
                required
              />
              <DateTimeField
                label="Date fin"
                value={contractForm.end_date}
                onChange={(value) => setContractForm((p) => ({ ...p, end_date: value }))}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2"><Label>Salaire ({contractForm.currency || tenantCurrency})<RequiredMark /></Label><Input placeholder="Ex: 250000" type="number" value={contractForm.salary} onChange={(e) => setContractForm((p) => ({ ...p, salary: e.target.value }))} required /></div>
              <div className="space-y-2"><Label>Devise</Label><Input placeholder="Ex: XOF" value={contractForm.currency} onChange={(e) => setContractForm((p) => ({ ...p, currency: e.target.value }))} /></div>
            </div>
            <div className="space-y-2"><Label>Statut<RequiredMark /></Label><SearchableSelect value={contractForm.status} onChange={(v) => setContractForm((p) => ({ ...p, status: v }))} options={contractStatusOptions} placeholder="Selectionner le statut" /></div>
            <div className="space-y-2"><Label>Notes</Label><Textarea placeholder="Informations complementaires sur le contrat" value={contractForm.notes} onChange={(e) => setContractForm((p) => ({ ...p, notes: e.target.value }))} /></div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setContractDialogOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={submitting}>Enregistrer</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingLeaveId ? 'Modifier la demande' : 'Nouvelle demande de conge'}</DialogTitle>
            <DialogDescription>
              Les jours ouvrables sont calcules automatiquement (periode calendaire incluse).
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-3" onSubmit={submitLeave}>
            <div className="space-y-2">
              <Label>
                Employe
                <RequiredMark />
              </Label>
              <SearchableSelect
                value={leaveForm.employee}
                onChange={(v) => setLeaveForm((p) => ({ ...p, employee: v }))}
                options={employeeOptions}
                placeholder="Selectionner un employe"
              />
            </div>
            <div className="space-y-2">
              <Label>Type de conge</Label>
              <SearchableSelect
                value={leaveForm.leave_type}
                onChange={(v) => setLeaveForm((p) => ({ ...p, leave_type: v }))}
                options={leaveTypeOptions}
                placeholder="Type"
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <DateTimeField
                label={
                  <>
                    <span>Date debut</span>
                    <RequiredMark />
                  </>
                }
                value={leaveForm.start_date}
                onChange={(value) => setLeaveForm((p) => ({ ...p, start_date: value }))}
                required
              />
              <DateTimeField
                label={
                  <>
                    <span>Date fin</span>
                    <RequiredMark />
                  </>
                }
                value={leaveForm.end_date}
                onChange={(value) => setLeaveForm((p) => ({ ...p, end_date: value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Motif / commentaire</Label>
              <Textarea
                placeholder="Optionnel"
                value={leaveForm.reason}
                onChange={(e) => setLeaveForm((p) => ({ ...p, reason: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setLeaveDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={submitting}>
                Enregistrer
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={payrollRuleDialogOpen} onOpenChange={setPayrollRuleDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>{editingPayrollRuleId ? 'Modifier parametre de paie' : 'Nouveau parametre de paie'}</DialogTitle><DialogDescription>Primes, avantages, retenues</DialogDescription></DialogHeader>
          <form className="grid gap-3" onSubmit={submitRule}>
            <div className="space-y-2"><Label>Type<RequiredMark /></Label><SearchableSelect value={payrollRuleForm.category} onChange={(v) => setPayrollRuleForm((p) => ({ ...p, category: v as PayrollRuleForm['category'] }))} options={payrollCategoryOptions} placeholder="Selectionner un type" /></div>
            <div className="space-y-2"><Label>Nom<RequiredMark /></Label><Input placeholder="Ex: Prime de transport" value={payrollRuleForm.name} onChange={(e) => setPayrollRuleForm((p) => ({ ...p, name: e.target.value }))} required /></div>
            <div className="space-y-2"><Label>Montant ({tenantCurrency})<RequiredMark /></Label><Input placeholder="Ex: 15000" type="number" value={payrollRuleForm.default_amount} onChange={(e) => setPayrollRuleForm((p) => ({ ...p, default_amount: e.target.value }))} required /></div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setPayrollRuleDialogOpen(false)}>Annuler</Button><Button type="submit" disabled={submitting}>Enregistrer</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={payrollDialogOpen} onOpenChange={setPayrollDialogOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{editingPayrollId ? 'Modifier paie' : 'Nouvelle paie'}</DialogTitle>
            <DialogDescription>
              Base auto depuis contrat, brut et net calcules automatiquement.
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4 lg:grid-cols-[1.7fr_1fr]" onSubmit={submitPayroll}>
            <div className="space-y-4">
              <div className="rounded-lg border border-input p-4">
                <p className="mb-3 text-sm font-medium">Informations bulletin</p>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Employe<RequiredMark /></Label>
                    <SearchableSelect
                      value={payrollForm.employee}
                      onChange={(v) => setPayrollForm((p) => ({ ...p, employee: v }))}
                      options={employeeOptions}
                      placeholder="Selectionner un employe"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Statut<RequiredMark /></Label>
                    <SearchableSelect
                      value={payrollForm.status}
                      onChange={(v) => setPayrollForm((p) => ({ ...p, status: v }))}
                      options={payrollStatusOptions}
                      placeholder="Selectionner le statut"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Mois<RequiredMark /></Label>
                    <Input
                      type="number"
                      placeholder="Ex: 4"
                      value={payrollForm.period_month}
                      onChange={(e) => setPayrollForm((p) => ({ ...p, period_month: Number(e.target.value) }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Annee<RequiredMark /></Label>
                    <Input
                      type="number"
                      placeholder="Ex: 2026"
                      value={payrollForm.period_year}
                      onChange={(e) => setPayrollForm((p) => ({ ...p, period_year: Number(e.target.value) }))}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-input p-4">
                <p className="mb-3 text-sm font-medium">Primes</p>
                <div className="space-y-3">
                  <SearchableSelect
                    value={bonusRuleToAdd}
                    onChange={(v) => {
                      setBonusRuleToAdd(v)
                      addRuleId(v, 'bonus_rule_ids', 'bonus_amount_overrides')
                    }}
                    options={bonusRuleOptions}
                    placeholder="Ajouter une prime"
                  />
                  {selectedBonusRules.map((r) => (
                    <div key={r.id} className="grid gap-2 rounded-md border border-input px-2.5 py-2 md:grid-cols-[1fr_180px_88px] md:items-center">
                      <span className="text-xs font-medium">{r.name}</span>
                      <div className="relative">
                        <Input
                          type="number"
                          className="h-7 pr-10 text-xs"
                          value={payrollForm.bonus_amount_overrides[r.id] ?? String(r.default_amount)}
                          onChange={(e) => setPayrollForm((prev) => ({
                            ...prev,
                            bonus_amount_overrides: { ...prev.bonus_amount_overrides, [r.id]: e.target.value },
                          }))}
                        />
                        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                          {payrollPreviewCurrency}
                        </span>
                      </div>
                      <div className="flex justify-end">
                        <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => removeRuleId(r.id, 'bonus_rule_ids', 'bonus_amount_overrides')}>
                          Retirer
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-input p-4">
                <p className="mb-3 text-sm font-medium">Avantages en nature</p>
                <div className="space-y-3">
                  <SearchableSelect
                    value={benefitRuleToAdd}
                    onChange={(v) => {
                      setBenefitRuleToAdd(v)
                      addRuleId(v, 'benefit_rule_ids', 'benefit_amount_overrides')
                    }}
                    options={benefitRuleOptions}
                    placeholder="Ajouter un avantage"
                  />
                  {selectedBenefitRules.map((r) => (
                    <div key={r.id} className="grid gap-2 rounded-md border border-input px-2.5 py-2 md:grid-cols-[1fr_180px_88px] md:items-center">
                      <span className="text-xs font-medium">{r.name}</span>
                      <div className="relative">
                        <Input
                          type="number"
                          className="h-7 pr-10 text-xs"
                          value={payrollForm.benefit_amount_overrides[r.id] ?? String(r.default_amount)}
                          onChange={(e) => setPayrollForm((prev) => ({
                            ...prev,
                            benefit_amount_overrides: { ...prev.benefit_amount_overrides, [r.id]: e.target.value },
                          }))}
                        />
                        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                          {payrollPreviewCurrency}
                        </span>
                      </div>
                      <div className="flex justify-end">
                        <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => removeRuleId(r.id, 'benefit_rule_ids', 'benefit_amount_overrides')}>
                          Retirer
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-input p-4">
                <p className="mb-3 text-sm font-medium">Retenues</p>
                <div className="space-y-3">
                  <SearchableSelect
                    value={deductionRuleToAdd}
                    onChange={(v) => {
                      setDeductionRuleToAdd(v)
                      addRuleId(v, 'deduction_rule_ids', 'deduction_amount_overrides')
                    }}
                    options={deductionRuleOptions}
                    placeholder="Ajouter une retenue"
                  />
                  {selectedDeductionRules.map((r) => (
                    <div key={r.id} className="grid gap-2 rounded-md border border-input px-2.5 py-2 md:grid-cols-[1fr_180px_88px] md:items-center">
                      <span className="text-xs font-medium">{r.name}</span>
                      <div className="relative">
                        <Input
                          type="number"
                          className="h-7 pr-10 text-xs"
                          value={payrollForm.deduction_amount_overrides[r.id] ?? String(r.default_amount)}
                          onChange={(e) => setPayrollForm((prev) => ({
                            ...prev,
                            deduction_amount_overrides: { ...prev.deduction_amount_overrides, [r.id]: e.target.value },
                          }))}
                        />
                        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                          {payrollPreviewCurrency}
                        </span>
                      </div>
                      <div className="flex justify-end">
                        <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => removeRuleId(r.id, 'deduction_rule_ids', 'deduction_amount_overrides')}>
                          Retirer
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border border-input bg-muted/20 p-4 text-sm">
                <p className="mb-2 font-medium">Synthese</p>
                <div className="space-y-1">
                  <p className="flex items-center justify-between gap-2"><span className="font-medium">Base:</span><span className="text-right tabular-nums">{formatCurrency(baseSalaryPreview, payrollPreviewCurrency)}</span></p>
                  <p className="flex items-center justify-between gap-2"><span className="font-medium">Primes:</span><span className="text-right tabular-nums">{formatCurrency(bonusesTotalPreview, payrollPreviewCurrency)}</span></p>
                  <p className="flex items-center justify-between gap-2"><span className="font-medium">Avantages:</span><span className="text-right tabular-nums">{formatCurrency(benefitsTotalPreview, payrollPreviewCurrency)}</span></p>
                  <p className="flex items-center justify-between gap-2"><span className="font-medium">Brut:</span><span className="text-right tabular-nums">{formatCurrency(grossSalaryPreview, payrollPreviewCurrency)}</span></p>
                  <p className="flex items-center justify-between gap-2"><span className="font-medium">Retenues:</span><span className="text-right tabular-nums">{formatCurrency(deductionsTotalPreview, payrollPreviewCurrency)}</span></p>
                  <p className="flex items-center justify-between gap-2 pt-1 text-base font-semibold"><span>Net:</span><span className="text-right tabular-nums">{formatCurrency(netSalaryPreview, payrollPreviewCurrency)}</span></p>
                </div>
              </div>

              <div className="rounded-lg border border-input p-4">
                <Label>Note</Label>
                <Textarea
                  className="mt-2 min-h-[120px]"
                  placeholder="Ajouter une note sur ce bulletin de paie"
                  value={payrollForm.note}
                  onChange={(e) => setPayrollForm((p) => ({ ...p, note: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 lg:col-span-2">
              <Button type="button" variant="outline" onClick={() => setPayrollDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={submitting}>Enregistrer</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete ? `Voulez-vous vraiment supprimer ${pendingDelete.label} ?` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSubmitting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault()
                void confirmDeleteItem()
              }}
              disabled={deleteSubmitting}
            >
              {deleteSubmitting ? 'Suppression...' : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {loading && <p className="text-sm text-muted-foreground">Chargement des donnees RH...</p>}
    </div>
  )
}
