import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  AuthUser,
  BillingModule,
  CompanyOnboardingPayload,
  InAppNotification,
  Project,
  Task,
  TimeEntry,
  Tenant,
  TenantSubscription,
  UIState,
  TaskStatus,
} from './types'
import { getApiBaseUrl, formatApiErrorBody } from './api'
import { notify } from './notify'
import { normalizeCurrencyCode } from './currency'

// Mock data
const mockTenant: Tenant = {
  id: '1',
  name: 'Acme Corporation',
  logo: '🏢',
  plan: 'pro',
  members: 12,
  currencyCode: 'XOF',
}

const mockProjects: Project[] = [
  {
    id: 'proj-1',
    name: 'Website Redesign',
    description: 'Complete redesign of the company website',
    status: 'active',
    startDate: '2024-01-15',
    endDate: '2024-06-30',
    progress: 65,
    tenantId: '1',
    color: '#185FA5',
    team: [
      { id: 'user-1', name: 'Alice Johnson', email: 'alice@acme.com', avatar: '👩‍💼', role: 'lead' },
      { id: 'user-2', name: 'Bob Smith', email: 'bob@acme.com', avatar: '👨‍💻', role: 'member' },
    ],
  },
  {
    id: 'proj-2',
    name: 'Mobile App MVP',
    description: 'Build minimum viable product for mobile',
    status: 'active',
    startDate: '2024-02-01',
    endDate: '2024-07-15',
    progress: 45,
    tenantId: '1',
    color: '#0F6E56',
    team: [
      { id: 'user-2', name: 'Bob Smith', email: 'bob@acme.com', avatar: '👨‍💻', role: 'lead' },
      { id: 'user-3', name: 'Carol Davis', email: 'carol@acme.com', avatar: '👩‍🔬', role: 'member' },
    ],
  },
  {
    id: 'proj-3',
    name: 'API Integration',
    description: 'Integrate third-party payment APIs',
    status: 'planning',
    startDate: '2024-04-01',
    endDate: '2024-05-31',
    progress: 10,
    tenantId: '1',
    color: '#BA7517',
    team: [
      { id: 'user-1', name: 'Alice Johnson', email: 'alice@acme.com', avatar: '👩‍💼', role: 'lead' },
    ],
  },
]

const mockTasks: Task[] = [
  {
    id: 'task-1',
    projectId: 'proj-1',
    title: 'Design homepage mockups',
    description: 'Create high-fidelity mockups for the homepage',
    status: 'done',
    priority: 'high',
    assignee: 'Alice Johnson',
    assigneeAvatar: '👩‍💼',
    dueDate: '2024-02-15',
    estimatedHours: 16,
    actualHours: 18,
    order: 1,
    subtasks: [
      { id: 'sub-1', taskId: 'task-1', title: 'Header design', completed: true },
      { id: 'sub-2', taskId: 'task-1', title: 'Hero section', completed: true },
      { id: 'sub-3', taskId: 'task-1', title: 'Footer design', completed: true },
    ],
    comments: [
      {
        id: 'comment-1',
        taskId: 'task-1',
        author: 'Bob Smith',
        authorAvatar: '👨‍💻',
        content: 'Great mockups! Love the new design direction.',
        createdAt: '2024-02-14T10:30:00',
      },
    ],
    attachments: [
      { id: 'att-1', taskId: 'task-1', name: 'homepage-mockup.figma', url: '#', type: 'figma', size: 2048000 },
    ],
  },
  {
    id: 'task-2',
    projectId: 'proj-1',
    title: 'Develop homepage components',
    description: 'Build React components for homepage',
    status: 'in_progress',
    priority: 'high',
    assignee: 'Bob Smith',
    assigneeAvatar: '👨‍💻',
    dueDate: '2024-03-15',
    estimatedHours: 24,
    actualHours: 12,
    order: 2,
    subtasks: [
      { id: 'sub-4', taskId: 'task-2', title: 'Header component', completed: true },
      { id: 'sub-5', taskId: 'task-2', title: 'Hero component', completed: false },
      { id: 'sub-6', taskId: 'task-2', title: 'Feature cards', completed: false },
    ],
    comments: [],
    attachments: [],
  },
  {
    id: 'task-3',
    projectId: 'proj-1',
    title: 'Setup testing framework',
    description: 'Configure Jest and React Testing Library',
    status: 'todo',
    priority: 'medium',
    assignee: 'Carol Davis',
    assigneeAvatar: '👩‍🔬',
    dueDate: '2024-04-01',
    estimatedHours: 8,
    order: 3,
    subtasks: [],
    comments: [],
    attachments: [],
  },
  {
    id: 'task-4',
    projectId: 'proj-2',
    title: 'Design app wireframes',
    description: 'Create wireframes for iOS and Android',
    status: 'review',
    priority: 'high',
    assignee: 'Carol Davis',
    assigneeAvatar: '👩‍🔬',
    dueDate: '2024-02-28',
    estimatedHours: 20,
    actualHours: 22,
    order: 1,
    subtasks: [
      { id: 'sub-7', taskId: 'task-4', title: 'iOS wireframes', completed: true },
      { id: 'sub-8', taskId: 'task-4', title: 'Android wireframes', completed: true },
    ],
    comments: [],
    attachments: [],
  },
  {
    id: 'task-5',
    projectId: 'proj-3',
    title: 'Research payment providers',
    description: 'Evaluate Stripe, PayPal, and Square',
    status: 'backlog',
    priority: 'low',
    dueDate: '2024-04-15',
    estimatedHours: 6,
    order: 1,
    subtasks: [],
    comments: [],
    attachments: [],
  },
]

interface ProjectStore {
  tenant: Tenant
  projects: Project[]
  tasks: Task[]
  taskTimeEntries: Record<string, TimeEntry[]>
  uiState: UIState
  authUser: AuthUser | null
  isAuthenticated: boolean
  isAuthLoading: boolean
  authChecked: boolean
  isHydrating: boolean
  apiError: string | null
  authError: string | null
  notifications: InAppNotification[]
  unreadNotificationsCount: number
  clearAuthError: () => void
  hydrateNotifications: () => Promise<void>
  markNotificationRead: (id: string) => Promise<void>
  markAllNotificationsRead: () => Promise<void>
  billingModules: BillingModule[]
  tenantSubscriptions: TenantSubscription[]
  billingLoading: boolean
  onboardingLoading: boolean
  onboardingResult: {
    tenant_id: string
    name: string
    slug: string
    schema_name: string
    domain: string
    on_trial: boolean
    paid_until: string | null
    currency_code?: string
    trial_offer_days: number
  } | null
  resetOnboardingState: () => void
  updateTenant: (tenant: Tenant) => void
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
  bootstrapAuth: () => Promise<void>
  onboardCompany: (payload: CompanyOnboardingPayload) => Promise<boolean>
  addProject: (project: Project) => void
  createProject: (payload: {
    name: string
    description: string
    status: Project['status']
    startDate: string
    endDate: string
    workTeamId?: string | null
    color?: string
  }) => Promise<boolean>
  updateProject: (id: string, updates: Partial<Project>) => Promise<boolean>
  deleteProject: (id: string) => Promise<boolean>
  addTask: (task: Task) => void
  createTask: (payload: {
    projectId: string
    title: string
    description: string
    status: Task['status']
    priority: Task['priority']
    dueDate?: string
    startDate?: string
    assigneeId?: number | null
  }) => Promise<boolean>
  createSubtask: (taskId: string, title: string) => Promise<boolean>
  toggleSubtask: (taskId: string, subtaskId: string, completed: boolean) => Promise<void>
  addTaskComment: (taskId: string, content: string) => Promise<boolean>
  updateTaskComment: (taskId: string, commentId: string, content: string) => Promise<boolean>
  deleteTaskComment: (taskId: string, commentId: string) => Promise<void>
  addTaskAttachment: (taskId: string, payload: { name: string; url: string }) => Promise<boolean>
  addTaskAttachmentFromGed: (taskId: string, gedDocumentId: string, name?: string) => Promise<boolean>
  uploadTaskAttachment: (taskId: string, file: File, name?: string) => Promise<boolean>
  deleteTaskAttachment: (taskId: string, attachmentId: string) => Promise<void>
  updateSubtask: (
    taskId: string,
    subtaskId: string,
    payload: { title?: string; completed?: boolean }
  ) => Promise<boolean>
  deleteSubtask: (taskId: string, subtaskId: string) => Promise<void>
  loadTaskTimeEntries: (taskId: string) => Promise<void>
  startTaskTimer: (taskId: string, note?: string) => Promise<boolean>
  stopTaskTimer: (taskId: string, note?: string) => Promise<boolean>
  patchTask: (
    id: string,
    patch: Partial<{
      title: string
      description: string
      status: Task['status']
      priority: Task['priority']
      assigneeId: number | null
      startDate: string | null
      dueDate: string | null
      order: number
    }>
  ) => Promise<boolean>
  updateTaskStatus: (projectId: string, taskId: string, status: TaskStatus | string) => Promise<void>
  updateTaskPriority: (projectId: string, taskId: string, priority: Task['priority']) => Promise<void>
  deleteTask: (id: string) => Promise<boolean>
  updateUIState: (updates: Partial<UIState>) => void
  toggleDarkMode: () => void
  toggleSidebar: () => void
  setViewMode: (mode: UIState['viewMode']) => void
  moveTask: (taskId: string, status: Task['status'], order: number) => void
  /** Met à jour statut + ordre des tâches après glisser-déposer Kanban (persiste en API). */
  reconcileKanbanColumns: (projectId: string, columns: Record<string, string[]>) => Promise<void>
  getProjectTasks: (projectId: string) => Task[]
  hydrateFromApi: () => Promise<void>
  hydrateBillingFromApi: () => Promise<void>
  initiateModulesPayment: (
    moduleIds: string[],
    moduleMonths?: Record<string, number>
  ) => Promise<{ paymentUrl: string | null; transactionId: string | null }>
  syncModulesPayment: (transactionId: string) => Promise<boolean>
}

const API_BASE_URL = getApiBaseUrl()
const ACCESS_TOKEN_KEY = 'corpcore_access_token'
const REFRESH_TOKEN_KEY = 'corpcore_refresh_token'
const AUTH_COOKIE_KEY = 'corpcore_access_token'

const normalizeTaskStatus = (status: string): Task['status'] => {
  const map: Record<string, Task['status']> = {
    backlog: 'backlog',
    todo: 'todo',
    in_progress: 'in_progress',
    'in-progress': 'in_progress',
    review: 'review',
    in_review: 'review',
    done: 'done',
    completed: 'done',
  }
  return map[status] || 'todo'
}

const normalizeProjectKey = (value: string): string => {
  if (value.startsWith('proj-')) {
    return value.replace('proj-', '')
  }
  return value
}

const getAccessToken = (): string | null => {
  if (typeof window === 'undefined') {
    return null
  }
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

const getRefreshToken = (): string | null => {
  if (typeof window === 'undefined') {
    return null
  }
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

const setAuthCookie = (access: string) => {
  if (typeof document === 'undefined') {
    return
  }
  document.cookie = `${AUTH_COOKIE_KEY}=${encodeURIComponent(access)}; Path=/; Max-Age=86400; SameSite=Lax`
}

const clearAuthCookie = () => {
  if (typeof document === 'undefined') {
    return
  }
  document.cookie = `${AUTH_COOKIE_KEY}=; Path=/; Max-Age=0; SameSite=Lax`
}

const setAuthTokens = (access: string, refresh?: string | null) => {
  if (typeof window === 'undefined') {
    return
  }
  localStorage.setItem(ACCESS_TOKEN_KEY, access)
  setAuthCookie(access)
  if (refresh) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refresh)
  }
}

const clearAuthTokens = () => {
  if (typeof window === 'undefined') {
    return
  }
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  clearAuthCookie()
}

const buildApiHeaders = (): HeadersInit => {
  const token = getAccessToken()
  if (!token) {
    return { 'Content-Type': 'application/json' }
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }
}

const normalizeProject = (raw: any): Project => ({
  id: String(raw?.id ?? ''),
  name: String(raw?.name ?? 'Untitled project'),
  description: String(raw?.description ?? ''),
  status: raw?.status ?? 'planning',
  startDate: String(raw?.startDate ?? raw?.start_date ?? new Date().toISOString().slice(0, 10)),
  endDate: String(raw?.endDate ?? raw?.end_date ?? new Date().toISOString().slice(0, 10)),
  progress: Number(raw?.progress ?? 0),
  tenantId: String(raw?.tenantId ?? raw?.tenant_id ?? ''),
  team: Array.isArray(raw?.team)
    ? raw.team.map((member: any) => {
        const id = String(member?.id ?? '')
        const fullName = String(
          member?.name ??
            `${member?.first_name ?? ''} ${member?.last_name ?? ''}`.trim() ??
            member?.username ??
            member?.email ??
            'Membre'
        ).trim()
        const initials = (fullName || 'M')
          .split(' ')
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0]?.toUpperCase() ?? '')
          .join('')
        const backendRole = String(member?.role ?? 'member')
        const role: 'owner' | 'lead' | 'member' =
          backendRole === 'owner' ? 'owner' : backendRole === 'admin' ? 'lead' : 'member'
        return {
          id,
          name: fullName || 'Membre',
          email: String(member?.email ?? ''),
          avatar: String(member?.avatar ?? (initials || 'M')),
          role,
        }
      })
    : [],
  color: raw?.color ?? '#185FA5',
  workTeamId:
    raw?.workTeamId !== undefined && raw?.workTeamId !== null
      ? String(raw.workTeamId)
      : raw?.work_team_id !== undefined && raw?.work_team_id !== null
        ? String(raw.work_team_id)
        : null,
  workTeamName: String(raw?.workTeamName ?? raw?.work_team_name ?? ''),
})

const normalizeComment = (raw: any, taskId: string) => ({
  id: String(raw?.id ?? ''),
  taskId: String(raw?.taskId ?? raw?.task_id ?? taskId),
  authorId:
    raw?.authorId !== undefined && raw?.authorId !== null
      ? Number(raw.authorId)
      : raw?.author_id !== undefined && raw?.author_id !== null
        ? Number(raw.author_id)
        : undefined,
  author: String(raw?.author ?? ''),
  authorAvatar: String(raw?.authorAvatar ?? raw?.author_avatar ?? ''),
  content: String(raw?.content ?? ''),
  createdAt: String(raw?.createdAt ?? raw?.created_at ?? ''),
})

const normalizeTask = (raw: any): Task => {
  const id = String(raw?.id ?? '')
  return {
    id,
    projectId: String(raw?.projectId ?? raw?.project_id ?? ''),
    title: String(raw?.title ?? 'Untitled task'),
    description: String(raw?.description ?? ''),
    status: normalizeTaskStatus(String(raw?.status ?? 'todo')),
    priority: raw?.priority ?? 'medium',
    assigneeId:
      raw?.assigneeId !== undefined && raw?.assigneeId !== null
        ? Number(raw.assigneeId)
        : raw?.assignee_id !== undefined && raw?.assignee_id !== null
          ? Number(raw.assignee_id)
          : null,
    assignee: raw?.assignee ?? undefined,
    assigneeAvatar: raw?.assigneeAvatar ?? raw?.assignee_avatar ?? undefined,
    dueDate: raw?.dueDate ?? raw?.due_date ?? undefined,
    startDate: raw?.startDate ?? raw?.start_date ?? undefined,
    estimatedHours: raw?.estimatedHours ?? raw?.estimated_hours ?? undefined,
    actualHours: raw?.actualHours ?? raw?.actual_hours ?? undefined,
    subtasks: Array.isArray(raw?.subtasks) ? raw.subtasks : [],
    comments: Array.isArray(raw?.comments)
      ? raw.comments.map((c: any) => normalizeComment(c, id))
      : [],
    attachments: Array.isArray(raw?.attachments) ? raw.attachments : [],
    order: Number(raw?.order ?? raw?.sort_order ?? 0),
  }
}

const normalizeAttachment = (raw: any, taskId: string) => ({
  id: String(raw?.id ?? ''),
  taskId: String(raw?.taskId ?? raw?.task_id ?? taskId),
  name: String(raw?.name ?? ''),
  url: String(raw?.url ?? raw?.file_url ?? ''),
  type: String(raw?.type ?? raw?.mime_type ?? ''),
  size: Number(raw?.size ?? raw?.file_size ?? 0),
  source: (raw?.source ?? 'link') as 'upload' | 'ged' | 'link',
  gedDocumentId:
    raw?.gedDocumentId !== undefined && raw?.gedDocumentId !== null
      ? String(raw.gedDocumentId)
      : raw?.ged_document_id !== undefined && raw?.ged_document_id !== null
        ? String(raw.ged_document_id)
        : null,
})

const normalizeTimeEntry = (raw: any): TimeEntry => ({
  id: String(raw?.id ?? ''),
  taskId: String(raw?.taskId ?? raw?.task_id ?? ''),
  user: raw?.user ?? null,
  startedAt: String(raw?.startedAt ?? raw?.started_at ?? new Date().toISOString()),
  endedAt: raw?.endedAt ?? raw?.ended_at ?? null,
  secondsSpent: Number(raw?.secondsSpent ?? raw?.seconds_spent ?? 0),
  note: String(raw?.note ?? ''),
})

const normalizeNotification = (raw: any): InAppNotification => ({
  id: String(raw?.id ?? ''),
  title: String(raw?.title ?? ''),
  message: String(raw?.message ?? ''),
  notificationType: (raw?.notificationType ?? raw?.notification_type ?? 'info') as InAppNotification['notificationType'],
  isRead: Boolean(raw?.isRead ?? raw?.is_read ?? false),
  linkUrl: String(raw?.linkUrl ?? raw?.link_url ?? ''),
  metadata: (raw?.metadata ?? {}) as Record<string, unknown>,
  createdAt: String(raw?.createdAt ?? raw?.created_at ?? new Date().toISOString()),
})

const refreshAccessToken = async (): Promise<string | null> => {
  const refresh = getRefreshToken()
  if (!refresh) {
    return null
  }
  const response = await fetch(`${API_BASE_URL}/auth/token/refresh/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refresh }),
  })
  if (!response.ok) {
    clearAuthTokens()
    return null
  }
  const payload = (await response.json()) as { access?: string; refresh?: string }
  if (!payload.access) {
    clearAuthTokens()
    return null
  }
  setAuthTokens(payload.access, payload.refresh ?? refresh)
  return payload.access
}

const fetchJson = async <T>(path: string, init?: RequestInit, retry = true): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...buildApiHeaders(),
      ...(init?.headers || {}),
    },
  })
  if (response.status === 401 && retry) {
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      return fetchJson<T>(path, init, false)
    }
  }
  if (!response.ok) {
    let detailMessage = ''
    try {
      const errorPayload = await response.json()
      detailMessage =
        formatApiErrorBody(errorPayload) ||
        (typeof (errorPayload as { message?: string }).message === 'string'
          ? (errorPayload as { message: string }).message
          : '')
    } catch {
      // non-json response, keep fallback message
    }
    throw new Error(detailMessage || `API request failed: ${response.status}`)
  }
  const text = await response.text()
  if (!text.trim()) {
    return undefined as T
  }
  return JSON.parse(text) as T
}

const extractApiErrorMessage = async (resp: Response): Promise<string> => {
  try {
    const payload = await resp.json()
    const parsed = formatApiErrorBody(payload)
    if (parsed) return parsed
    if (typeof (payload as { detail?: unknown }).detail === 'string') return (payload as { detail: string }).detail
  } catch {
    // ignore non-json errors
  }
  return `API request failed: ${resp.status}`
}

export const useStore = create<ProjectStore>()(
  persist<ProjectStore>(
    (set, get) => ({
      tenant: mockTenant,
      projects: mockProjects,
      tasks: mockTasks,
      taskTimeEntries: {},
      authUser: null,
      isAuthenticated: false,
      isAuthLoading: false,
      authChecked: false,
      isHydrating: false,
      apiError: null,
      authError: null,
      notifications: [],
      unreadNotificationsCount: 0,
      billingModules: [],
      tenantSubscriptions: [],
      billingLoading: false,
      onboardingLoading: false,
      onboardingResult: null,
      uiState: {
        sidebarOpen: true,
        sidebarDesktopMode: 'expanded' as UIState['sidebarDesktopMode'],
        darkMode: false,
        viewMode: 'dashboard' as UIState['viewMode'],
      },

      resetOnboardingState: () =>
        set({
          onboardingLoading: false,
          onboardingResult: null,
          apiError: null,
        }),

      updateTenant: (tenant) => set({ tenant }),

      clearAuthError: () => set({ authError: null }),

      hydrateNotifications: async () => {
        if (!get().isAuthenticated) {
          set({ notifications: [], unreadNotificationsCount: 0 })
          return
        }
        try {
          const items = await fetchJson<any[]>('/notifications/')
          const notifications = items.map(normalizeNotification)
          const unreadNotificationsCount = notifications.filter((item) => !item.isRead).length
          set({ notifications, unreadNotificationsCount })
        } catch {
          // Keep non-blocking: notifications should never break core flows.
        }
      },

      markNotificationRead: async (id) => {
        const previous = get().notifications
        set((state) => {
          const notifications = state.notifications.map((item) =>
            item.id === id ? { ...item, isRead: true } : item
          )
          return {
            notifications,
            unreadNotificationsCount: notifications.filter((item) => !item.isRead).length,
          }
        })
        try {
          await fetchJson(`/notifications/${id}/mark_read/`, { method: 'POST' })
        } catch {
          notify.error('Impossible de mettre a jour la notification')
          set({
            notifications: previous,
            unreadNotificationsCount: previous.filter((item) => !item.isRead).length,
          })
        }
      },

      markAllNotificationsRead: async () => {
        const previous = get().notifications
        const notifications = previous.map((item) => ({ ...item, isRead: true }))
        set({ notifications, unreadNotificationsCount: 0 })
        try {
          await fetchJson('/notifications/mark_all_read/', { method: 'POST' })
          notify.success('Toutes les notifications sont lues')
        } catch {
          notify.error('Impossible de marquer les notifications comme lues')
          set({
            notifications: previous,
            unreadNotificationsCount: previous.filter((item) => !item.isRead).length,
          })
        }
      },

      login: async (email, password) => {
        set({ isAuthLoading: true, authError: null })
        try {
          const loginResponse = await fetchJson<{
            access: string
            refresh?: string
            user?: AuthUser
            tenant?: {
              id?: string | number
              name?: string
              schema?: string
              currency_code?: string
              slogan?: string
              logo_url?: string | null
              hero_image_url?: string | null
              on_trial?: boolean
              paid_until?: string | null
            }
          }>('/auth/token/', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
          })

          setAuthTokens(loginResponse.access, loginResponse.refresh ?? null)

          if (loginResponse.tenant) {
            set((state) => ({
              tenant: {
                ...state.tenant,
                ...(loginResponse.tenant?.id != null ? { id: String(loginResponse.tenant.id) } : {}),
                ...(loginResponse.tenant?.name ? { name: loginResponse.tenant.name } : {}),
                ...(loginResponse.tenant?.currency_code
                  ? { currencyCode: normalizeCurrencyCode(loginResponse.tenant.currency_code) }
                  : {}),
                ...(loginResponse.tenant?.slogan !== undefined ? { slogan: loginResponse.tenant.slogan || '' } : {}),
                ...(loginResponse.tenant?.logo_url !== undefined ? { logoUrl: loginResponse.tenant.logo_url || null } : {}),
                ...(loginResponse.tenant?.hero_image_url !== undefined
                  ? { heroImageUrl: loginResponse.tenant.hero_image_url || null }
                  : {}),
                ...(typeof loginResponse.tenant.on_trial === 'boolean' ? { onTrial: loginResponse.tenant.on_trial } : {}),
                ...(loginResponse.tenant.paid_until !== undefined
                  ? { paidUntil: loginResponse.tenant.paid_until ?? null }
                  : {}),
              },
            }))
          }

          let meUser: AuthUser | null = loginResponse.user ?? null
          let tenantSchema = loginResponse.tenant?.schema ?? null
          try {
            const me = await fetchJson<{
              id: number
              username: string
              email: string
              first_name: string
              last_name: string
              is_staff: boolean
              is_superuser: boolean
              is_company_admin?: boolean
              profile_photo?: string | null
              tenant?: {
                id?: string | number
                name?: string
                schema?: string
                currency_code?: string
                slogan?: string
                logo_url?: string | null
                hero_image_url?: string | null
                on_trial?: boolean
                paid_until?: string | null
              }
            }>('/auth/me/')
            meUser = {
              id: me.id,
              username: me.username,
              email: me.email,
              first_name: me.first_name,
              last_name: me.last_name,
              is_staff: me.is_staff,
              is_superuser: me.is_superuser,
              is_company_admin: Boolean(me.is_company_admin),
              profile_photo: me.profile_photo ?? null,
            }
            tenantSchema = me.tenant?.schema ?? tenantSchema
            if (me.tenant) {
              set((state) => ({
                tenant: {
                  ...state.tenant,
                  id: String(me.tenant?.id ?? state.tenant.id),
                  name: me.tenant?.name || state.tenant.name,
                  currencyCode: me.tenant?.currency_code
                    ? normalizeCurrencyCode(me.tenant.currency_code)
                    : state.tenant.currencyCode || 'XOF',
                  slogan: me.tenant?.slogan ?? state.tenant.slogan ?? '',
                  logoUrl: me.tenant?.logo_url ?? state.tenant.logoUrl ?? null,
                  heroImageUrl: me.tenant?.hero_image_url ?? state.tenant.heroImageUrl ?? null,
                  onTrial: typeof me.tenant?.on_trial === 'boolean' ? me.tenant?.on_trial : state.tenant.onTrial,
                  paidUntil: me.tenant?.paid_until ?? state.tenant.paidUntil ?? null,
                },
              }))
            }
          } catch {
            // Keep payload user when /auth/me is temporarily unavailable.
          }

          set({
            authUser: meUser,
            isAuthenticated: true,
            isAuthLoading: false,
            authChecked: true,
            authError: null,
          })

          const shouldHydrateTenantData = tenantSchema !== 'public'
          if (shouldHydrateTenantData) {
            try {
              await get().hydrateFromApi()
              await get().hydrateBillingFromApi()
              await get().hydrateNotifications()
            } catch {
              // Non bloquant: la session reste valide meme si certaines APIs metier echouent.
            }
          }
          notify.success('Connexion reussie')
          return true
        } catch (error) {
          const authMessage =
            error instanceof TypeError
              ? 'Connexion API impossible. Verifie le backend et la configuration CORS.'
              : error instanceof Error
                ? error.message
                : 'Authentication failed'
          notify.error(authMessage)
          clearAuthTokens()
          set({
            isAuthLoading: false,
            isAuthenticated: false,
            authChecked: true,
            authUser: null,
            authError: authMessage,
          })
          return false
        }
      },

      logout: () => {
        notify.info('Session fermee')
        clearAuthTokens()
        set({
          authUser: null,
          isAuthenticated: false,
          authChecked: true,
          authError: null,
          projects: mockProjects,
          tasks: mockTasks,
          taskTimeEntries: {},
          notifications: [],
          unreadNotificationsCount: 0,
          tenant: mockTenant,
        })
      },

      bootstrapAuth: async () => {
        const access = getAccessToken()
        if (!access) {
          set({ authChecked: true, isAuthLoading: false, isAuthenticated: false, authUser: null })
          return
        }
        setAuthCookie(access)
        set({ isAuthLoading: true, authError: null })
        try {
          const me = await fetchJson<{
            id: number
            username: string
            email: string
            first_name: string
            last_name: string
            is_staff: boolean
            is_superuser: boolean
            is_company_admin?: boolean
            profile_photo?: string | null
            tenant?: {
              id?: string | number
              name?: string
              schema?: string
              currency_code?: string
              slogan?: string
              logo_url?: string | null
              hero_image_url?: string | null
              on_trial?: boolean
              paid_until?: string | null
            }
          }>('/auth/me/')

          set((state) => ({
            authUser: {
              id: me.id,
              username: me.username,
              email: me.email,
              first_name: me.first_name,
              last_name: me.last_name,
              is_staff: me.is_staff,
              is_superuser: me.is_superuser,
              is_company_admin: Boolean(me.is_company_admin),
              profile_photo: me.profile_photo ?? null,
            },
            isAuthenticated: true,
            isAuthLoading: false,
            authChecked: true,
            authError: null,
            tenant: {
              ...state.tenant,
              id: String(me.tenant?.id ?? state.tenant.id),
              name: me.tenant?.name || state.tenant.name,
              currencyCode: me.tenant?.currency_code
                ? normalizeCurrencyCode(me.tenant.currency_code)
                : state.tenant.currencyCode || 'XOF',
              slogan: me.tenant?.slogan ?? state.tenant.slogan ?? '',
              logoUrl: me.tenant?.logo_url ?? state.tenant.logoUrl ?? null,
              heroImageUrl: me.tenant?.hero_image_url ?? state.tenant.heroImageUrl ?? null,
              onTrial: typeof me.tenant?.on_trial === 'boolean' ? me.tenant?.on_trial : state.tenant.onTrial,
              paidUntil: me.tenant?.paid_until ?? state.tenant.paidUntil ?? null,
            },
          }))

          const shouldHydrateTenantData = me.tenant?.schema !== 'public'
          if (shouldHydrateTenantData) {
            try {
              await get().hydrateFromApi()
              await get().hydrateBillingFromApi()
              await get().hydrateNotifications()
            } catch {
              // Non bloquant: ne pas deconnecter pour une erreur API metier.
            }
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Session expiree'
          notify.error(msg)
          clearAuthTokens()
          set({
            authUser: null,
            isAuthenticated: false,
            isAuthLoading: false,
            authChecked: true,
            authError: msg,
          })
        }
      },

      onboardCompany: async (payload) => {
        set({ onboardingLoading: true, apiError: null })
        try {
          const result = await fetchJson<{
            tenant_id: string
            name: string
            slug: string
            schema_name: string
            domain: string
            on_trial: boolean
            paid_until: string | null
            currency_code?: string
            trial_offer_days: number
          }>('/public/onboarding/', {
            method: 'POST',
            body: JSON.stringify(payload),
          })
          set({
            onboardingLoading: false,
            onboardingResult: result,
            apiError: null,
          })
          notify.success('Entreprise creee avec succes')
          return true
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Onboarding failed'
          notify.error(msg)
          set({
            onboardingLoading: false,
            apiError: msg,
          })
          return false
        }
      },

      addProject: (project) =>
        set((state) => ({
          projects: [...state.projects, project],
        })),

      createProject: async (payload) => {
        try {
          const created = await fetchJson<any>('/projects/', {
            method: 'POST',
            body: JSON.stringify({
              ...payload,
              workTeamId: payload.workTeamId || null,
            }),
          })
          const project = normalizeProject(created)
          set((state) => ({
            projects: [project, ...state.projects],
            apiError: null,
          }))
          notify.success('Projet cree')
          return true
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Failed to create project'
          notify.error(msg)
          set({ apiError: msg })
          return false
        }
      },

      updateProject: async (id, updates) => {
        const body: Record<string, unknown> = {}
        if (updates.name !== undefined) body.name = updates.name
        if (updates.description !== undefined) body.description = updates.description
        if (updates.status !== undefined) body.status = updates.status
        if (updates.startDate !== undefined) body.startDate = updates.startDate
        if (updates.endDate !== undefined) body.endDate = updates.endDate
        if (updates.color !== undefined) body.color = updates.color
        if (updates.progress !== undefined) body.progress = updates.progress
        if (updates.workTeamId !== undefined) body.workTeamId = updates.workTeamId

        let previous: Project[] = []
        set((state) => {
          previous = state.projects
          return {
            apiError: null,
            projects: state.projects.map((p) => (p.id === id ? { ...p, ...updates } : p)),
          }
        })
        try {
          const updated = await fetchJson<any>(`/projects/${id}/`, {
            method: 'PATCH',
            body: JSON.stringify(body),
          })
          const project = normalizeProject(updated)
          set((state) => ({
            projects: state.projects.map((p) => (p.id === id ? project : p)),
            apiError: null,
          }))
          notify.success('Projet mis a jour')
          return true
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Mise à jour du projet impossible'
          notify.error(msg)
          set({
            apiError: msg,
            projects: previous,
          })
          return false
        }
      },

      deleteProject: async (id) => {
        const previousProjects = get().projects
        const previousTasks = get().tasks
        const previousTime = { ...get().taskTimeEntries }
        const removedTaskIds = new Set(
          previousTasks.filter((t) => t.projectId === id).map((t) => t.id)
        )
        const nextTime = { ...previousTime }
        for (const tid of removedTaskIds) {
          delete nextTime[tid]
        }
        set({
          apiError: null,
          projects: previousProjects.filter((p) => p.id !== id),
          tasks: previousTasks.filter((t) => t.projectId !== id),
          taskTimeEntries: nextTime,
        })
        try {
          await fetchJson(`/projects/${id}/`, { method: 'DELETE' })
          notify.success('Projet supprime')
          return true
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Suppression du projet impossible'
          notify.error(msg)
          set({
            apiError: msg,
            projects: previousProjects,
            tasks: previousTasks,
            taskTimeEntries: previousTime,
          })
          return false
        }
      },

      addTask: (task) =>
        set((state) => ({
          tasks: [...state.tasks, task],
        })),

      createTask: async (payload) => {
        try {
          const created = await fetchJson<any>('/tasks/', {
            method: 'POST',
            body: JSON.stringify({
              project: payload.projectId,
              title: payload.title,
              description: payload.description,
              status: payload.status,
              priority: payload.priority,
              dueDate: payload.dueDate,
              startDate: payload.startDate,
              assigneeId: payload.assigneeId ?? null,
            }),
          })
          const task = normalizeTask(created)
          set((state) => ({
            tasks: [task, ...state.tasks],
            apiError: null,
          }))
          notify.success('Tache creee')
          return true
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Failed to create task'
          notify.error(msg)
          set({ apiError: msg })
          return false
        }
      },

      createSubtask: async (taskId, title) => {
        const cleanTitle = title.trim()
        if (!cleanTitle) {
          const msg = 'Le titre de la sous-tache est obligatoire.'
          notify.warning(msg)
          set({ apiError: msg })
          return false
        }
        try {
          const created = await fetchJson<any>('/subtasks/', {
            method: 'POST',
            body: JSON.stringify({
              task: taskId,
              title: cleanTitle,
              completed: false,
            }),
          })
          const normalized = {
            id: String(created?.id ?? crypto.randomUUID()),
            taskId: String(created?.taskId ?? created?.task_id ?? taskId),
            title: String(created?.title ?? cleanTitle),
            completed: Boolean(created?.completed ?? false),
          }
          set((state) => ({
            apiError: null,
            tasks: state.tasks.map((task) =>
              task.id === taskId
                ? {
                    ...task,
                    subtasks: [...task.subtasks, normalized],
                  }
                : task
            ),
          }))
          notify.success('Sous-tache ajoutee')
          return true
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Creation sous-tache impossible'
          notify.error(msg)
          set({ apiError: msg })
          return false
        }
      },

      toggleSubtask: async (taskId, subtaskId, completed) => {
        let previous: Task[] = []
        set((state) => {
          previous = state.tasks
          return {
            apiError: null,
            tasks: state.tasks.map((task) =>
              task.id === taskId
                ? {
                    ...task,
                    subtasks: task.subtasks.map((subtask) =>
                      subtask.id === subtaskId ? { ...subtask, completed } : subtask
                    ),
                  }
                : task
            ),
          }
        })
        try {
          await fetchJson(`/subtasks/${subtaskId}/`, {
            method: 'PATCH',
            body: JSON.stringify({ completed }),
          })
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Mise a jour sous-tache impossible'
          notify.error(msg)
          set({
            apiError: msg,
            tasks: previous,
          })
        }
      },

      updateSubtask: async (taskId, subtaskId, payload) => {
        let previous: Task[] = []
        set((state) => {
          previous = state.tasks
          return {
            apiError: null,
            tasks: state.tasks.map((task) =>
              task.id === taskId
                ? {
                    ...task,
                    subtasks: task.subtasks.map((s) =>
                      s.id === subtaskId ? { ...s, ...payload } : s
                    ),
                  }
                : task
            ),
          }
        })
        try {
          await fetchJson(`/subtasks/${subtaskId}/`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          })
          notify.success('Sous-tache mise a jour')
          return true
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Mise a jour sous-tache impossible'
          notify.error(msg)
          set({
            apiError: msg,
            tasks: previous,
          })
          return false
        }
      },

      deleteSubtask: async (taskId, subtaskId) => {
        let previous: Task[] = []
        set((state) => {
          previous = state.tasks
          return {
            apiError: null,
            tasks: state.tasks.map((task) =>
              task.id === taskId
                ? {
                    ...task,
                    subtasks: task.subtasks.filter((s) => s.id !== subtaskId),
                  }
                : task
            ),
          }
        })
        try {
          await fetchJson(`/subtasks/${subtaskId}/`, { method: 'DELETE' })
          notify.success('Sous-tache supprimee')
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Suppression sous-tache impossible'
          notify.error(msg)
          set({
            apiError: msg,
            tasks: previous,
          })
        }
      },

      addTaskComment: async (taskId, content) => {
        const cleanContent = content.trim()
        if (!cleanContent) {
          const msg = 'Le commentaire ne peut pas etre vide.'
          notify.warning(msg)
          set({ apiError: msg })
          return false
        }
        try {
          const created = await fetchJson<any>('/task-comments/', {
            method: 'POST',
            body: JSON.stringify({
              task: taskId,
              content: cleanContent,
            }),
          })
          const normalized = normalizeComment(
            {
              ...created,
              author: created?.author ?? get().authUser?.email ?? 'Utilisateur',
              content: created?.content ?? cleanContent,
              createdAt: created?.createdAt ?? new Date().toISOString(),
            },
            taskId
          )
          set((state) => ({
            apiError: null,
            tasks: state.tasks.map((task) =>
              task.id === taskId
                ? {
                    ...task,
                    comments: [...task.comments, normalized],
                  }
                : task
            ),
          }))
          notify.success('Commentaire ajoute')
          return true
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Ajout commentaire impossible'
          notify.error(msg)
          set({ apiError: msg })
          return false
        }
      },

      updateTaskComment: async (taskId, commentId, content) => {
        const clean = content.trim()
        if (!clean) {
          const msg = 'Le commentaire ne peut pas etre vide.'
          notify.warning(msg)
          set({ apiError: msg })
          return false
        }
        let previous: Task[] = []
        set((state) => {
          previous = state.tasks
          return {
            apiError: null,
            tasks: state.tasks.map((task) =>
              task.id === taskId
                ? {
                    ...task,
                    comments: task.comments.map((c) =>
                      c.id === commentId ? { ...c, content: clean } : c
                    ),
                  }
                : task
            ),
          }
        })
        try {
          const updated = await fetchJson<any>(`/task-comments/${commentId}/`, {
            method: 'PATCH',
            body: JSON.stringify({ content: clean }),
          })
          const normalized = normalizeComment(updated, taskId)
          set((state) => ({
            apiError: null,
            tasks: state.tasks.map((task) =>
              task.id === taskId
                ? {
                    ...task,
                    comments: task.comments.map((c) => (c.id === commentId ? normalized : c)),
                  }
                : task
            ),
          }))
          notify.success('Commentaire modifie')
          return true
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Modification du commentaire impossible'
          notify.error(msg)
          set({
            apiError: msg,
            tasks: previous,
          })
          return false
        }
      },

      deleteTaskComment: async (taskId, commentId) => {
        let previous: Task[] = []
        set((state) => {
          previous = state.tasks
          return {
            apiError: null,
            tasks: state.tasks.map((task) =>
              task.id === taskId
                ? {
                    ...task,
                    comments: task.comments.filter((c) => c.id !== commentId),
                  }
                : task
            ),
          }
        })
        try {
          await fetchJson(`/task-comments/${commentId}/`, { method: 'DELETE' })
          notify.success('Commentaire supprime')
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Suppression du commentaire impossible'
          notify.error(msg)
          set({
            apiError: msg,
            tasks: previous,
          })
        }
      },

      addTaskAttachment: async (taskId, payload) => {
        const name = payload.name.trim()
        const url = payload.url.trim()
        if (!name || !url) {
          const msg = 'Le nom et l’URL de la pièce jointe sont obligatoires.'
          notify.warning(msg)
          set({ apiError: msg })
          return false
        }
        try {
          const created = await fetchJson<any>('/task-attachments/', {
            method: 'POST',
            body: JSON.stringify({
              task: taskId,
              name,
              url,
              type: '',
              size: 0,
            }),
          })
          const normalized = normalizeAttachment(created, taskId)
          set((state) => ({
            apiError: null,
            tasks: state.tasks.map((task) =>
              task.id === taskId
                ? {
                    ...task,
                    attachments: [...task.attachments, normalized],
                  }
                : task
            ),
          }))
          notify.success('Piece jointe ajoutee')
          return true
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Ajout de la pièce jointe impossible'
          notify.error(msg)
          set({ apiError: msg })
          return false
        }
      },

      addTaskAttachmentFromGed: async (taskId, gedDocumentId, name) => {
        if (!gedDocumentId) {
          const msg = 'Selectionne un document GED.'
          notify.warning(msg)
          set({ apiError: msg })
          return false
        }
        try {
          const created = await fetchJson<any>('/task-attachments/import-ged/', {
            method: 'POST',
            body: JSON.stringify({
              task: taskId,
              gedDocumentId,
              name: (name || '').trim() || undefined,
            }),
          })
          const normalized = normalizeAttachment(created, taskId)
          set((state) => ({
            apiError: null,
            tasks: state.tasks.map((task) =>
              task.id === taskId
                ? {
                    ...task,
                    attachments: [...task.attachments, normalized],
                  }
                : task
            ),
          }))
          notify.success('Fichier GED ajoute a la tache')
          return true
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Ajout depuis GED impossible"
          notify.error(msg)
          set({ apiError: msg })
          return false
        }
      },

      uploadTaskAttachment: async (taskId, file, name) => {
        if (!file) {
          const msg = 'Fichier requis.'
          notify.warning(msg)
          set({ apiError: msg })
          return false
        }
        const upload = async (): Promise<Response> => {
          const fd = new FormData()
          fd.append('task', taskId)
          fd.append('file', file)
          if ((name || '').trim()) fd.append('name', (name || '').trim())
          const token = getAccessToken()
          return fetch(`${API_BASE_URL}/task-attachments/upload/`, {
            method: 'POST',
            body: fd,
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          })
        }
        try {
          let resp = await upload()
          if (resp.status === 401) {
            const refreshed = await refreshAccessToken()
            if (refreshed) {
              resp = await upload()
            }
          }
          if (!resp.ok) {
            throw new Error(await extractApiErrorMessage(resp))
          }
          const created = (await resp.json()) as any
          const normalized = normalizeAttachment(created, taskId)
          set((state) => ({
            apiError: null,
            tasks: state.tasks.map((task) =>
              task.id === taskId
                ? {
                    ...task,
                    attachments: [...task.attachments, normalized],
                  }
                : task
            ),
          }))
          notify.success('Fichier importe dans la tache')
          return true
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Upload de la pièce jointe impossible'
          notify.error(msg)
          set({ apiError: msg })
          return false
        }
      },

      deleteTaskAttachment: async (taskId, attachmentId) => {
        let previous: Task[] = []
        set((state) => {
          previous = state.tasks
          return {
            apiError: null,
            tasks: state.tasks.map((task) =>
              task.id === taskId
                ? {
                    ...task,
                    attachments: task.attachments.filter((a) => a.id !== attachmentId),
                  }
                : task
            ),
          }
        })
        try {
          await fetchJson(`/task-attachments/${attachmentId}/`, {
            method: 'DELETE',
          })
          notify.success('Piece jointe supprimee')
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Suppression de la pièce jointe impossible'
          notify.error(msg)
          set({
            apiError: msg,
            tasks: previous,
          })
        }
      },

      loadTaskTimeEntries: async (taskId) => {
        try {
          const entries = await fetchJson<any[]>(`/time-entries/?task=${encodeURIComponent(taskId)}`)
          set((state) => ({
            apiError: null,
            taskTimeEntries: {
              ...state.taskTimeEntries,
              [taskId]: entries.map(normalizeTimeEntry),
            },
          }))
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Chargement time entries impossible'
          notify.error(msg)
          set({ apiError: msg })
        }
      },

      startTaskTimer: async (taskId, note = '') => {
        try {
          const created = await fetchJson<any>('/time-entries/start/', {
            method: 'POST',
            body: JSON.stringify({ task: taskId, note }),
          })
          const normalized = normalizeTimeEntry(created)
          set((state) => {
            const current = state.taskTimeEntries[taskId] ?? []
            const withoutRunning = current.filter((entry) => entry.endedAt !== null)
            const merged = [...withoutRunning.filter((entry) => entry.id !== normalized.id), normalized].sort(
              (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
            )
            return {
              apiError: null,
              taskTimeEntries: {
                ...state.taskTimeEntries,
                [taskId]: merged,
              },
            }
          })
          notify.success('Chronometre demarre')
          return true
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Demarrage timer impossible'
          notify.error(msg)
          set({ apiError: msg })
          return false
        }
      },

      stopTaskTimer: async (taskId, note = '') => {
        try {
          const stopped = await fetchJson<any>('/time-entries/stop/', {
            method: 'POST',
            body: JSON.stringify({ task: taskId, note }),
          })
          const normalized = normalizeTimeEntry(stopped)
          set((state) => {
            const current = state.taskTimeEntries[taskId] ?? []
            const merged = [...current.filter((entry) => entry.id !== normalized.id), normalized].sort(
              (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
            )
            return {
              apiError: null,
              taskTimeEntries: {
                ...state.taskTimeEntries,
                [taskId]: merged,
              },
            }
          })
          notify.success('Temps enregistre')
          return true
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Arret timer impossible'
          notify.error(msg)
          set({ apiError: msg })
          return false
        }
      },

      patchTask: async (id, patch) => {
        const body: Record<string, unknown> = {}
        if (patch.title !== undefined) body.title = patch.title
        if (patch.description !== undefined) body.description = patch.description
        if (patch.status !== undefined) body.status = patch.status
        if (patch.priority !== undefined) body.priority = patch.priority
        if (patch.assigneeId !== undefined) body.assigneeId = patch.assigneeId
        if (patch.startDate !== undefined) {
          body.startDate = patch.startDate === '' ? null : patch.startDate
        }
        if (patch.dueDate !== undefined) {
          body.dueDate = patch.dueDate === '' ? null : patch.dueDate
        }
        if (patch.order !== undefined) body.order = patch.order

        let previous: Task[] = []
        set((state) => {
          previous = state.tasks
          return {
            apiError: null,
            tasks: state.tasks.map((t) => {
              if (t.id !== id) return t
              const nextStart =
                patch.startDate === undefined
                  ? t.startDate
                  : patch.startDate === null
                    ? undefined
                    : patch.startDate
              const nextDue =
                patch.dueDate === undefined ? t.dueDate : patch.dueDate === null ? undefined : patch.dueDate
              return {
                ...t,
                ...patch,
                startDate: nextStart,
                dueDate: nextDue,
              }
            }),
          }
        })
        try {
          const updated = await fetchJson<any>(`/tasks/${id}/`, {
            method: 'PATCH',
            body: JSON.stringify(body),
          })
          const normalized = normalizeTask(updated)
          set((state) => ({
            apiError: null,
            tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...normalized } : t)),
          }))
          return true
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Mise a jour de la tache impossible'
          notify.error(msg)
          set({
            apiError: msg,
            tasks: previous,
          })
          return false
        }
      },

      updateTaskStatus: async (_projectId, taskId, status) => {
        const normalized = normalizeTaskStatus(String(status))
        let previous: Task[] = []
        set((state) => {
          previous = state.tasks
          return {
            apiError: null,
            tasks: state.tasks.map((task) =>
              task.id === taskId
                ? {
                    ...task,
                    status: normalized,
                  }
                : task
            ),
          }
        })

        try {
          await fetchJson(`/tasks/${taskId}/`, {
            method: 'PATCH',
            body: JSON.stringify({ status: normalized }),
          })
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Mise à jour du statut impossible'
          notify.error(msg)
          set({
            apiError: msg,
            tasks: previous,
          })
        }
      },

      updateTaskPriority: async (_projectId, taskId, priority) => {
        let previous: Task[] = []
        set((state) => {
          previous = state.tasks
          return {
            apiError: null,
            tasks: state.tasks.map((task) =>
              task.id === taskId
                ? {
                    ...task,
                    priority,
                  }
                : task
            ),
          }
        })
        try {
          await fetchJson(`/tasks/${taskId}/`, {
            method: 'PATCH',
            body: JSON.stringify({ priority }),
          })
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Mise à jour de la priorité impossible'
          notify.error(msg)
          set({
            apiError: msg,
            tasks: previous,
          })
        }
      },

      deleteTask: async (id) => {
        const previousTasks = get().tasks
        const previousTime = { ...get().taskTimeEntries }
        set({
          apiError: null,
          tasks: previousTasks.filter((t) => t.id !== id),
          taskTimeEntries: (() => {
            const next = { ...previousTime }
            delete next[id]
            return next
          })(),
        })
        try {
          await fetchJson(`/tasks/${id}/`, { method: 'DELETE' })
          notify.success('Tache supprimee')
          return true
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Suppression de la tache impossible'
          notify.error(msg)
          set({
            apiError: msg,
            tasks: previousTasks,
            taskTimeEntries: previousTime,
          })
          return false
        }
      },

      updateUIState: (updates) =>
        set((state) => ({
          uiState: { ...state.uiState, ...updates },
        })),

      toggleDarkMode: () =>
        set((state) => ({
          uiState: { ...state.uiState, darkMode: !state.uiState.darkMode },
        })),

      toggleSidebar: () =>
        set((state) => ({
          uiState: { ...state.uiState, sidebarOpen: !state.uiState.sidebarOpen },
        })),

      setViewMode: (mode) =>
        set((state) => ({
          uiState: { ...state.uiState, viewMode: mode },
        })),

      moveTask: (taskId, status, order) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId ? { ...t, status, order } : t
          ),
        })),

      reconcileKanbanColumns: async (projectId, columns) => {
        const key = normalizeProjectKey(projectId)
        const prevTasks = get().tasks

        const nextTasks = prevTasks.map((task) => {
          if (normalizeProjectKey(task.projectId) !== key) {
            return task
          }
          for (const [status, ids] of Object.entries(columns)) {
            const idx = ids.indexOf(task.id)
            if (idx !== -1) {
              const normalizedStatus = normalizeTaskStatus(status)
              return { ...task, status: normalizedStatus, order: idx }
            }
          }
          return task
        })

        const patches: { id: string; status: Task['status']; order: number }[] = []
        for (const t of nextTasks) {
          if (normalizeProjectKey(t.projectId) !== key) continue
          const old = prevTasks.find((p) => p.id === t.id)
          if (!old) continue
          if (old.status !== t.status || old.order !== t.order) {
            patches.push({ id: t.id, status: t.status, order: t.order })
          }
        }

        if (patches.length === 0) {
          return
        }

        set({ tasks: nextTasks, apiError: null })

        try {
          await Promise.all(
            patches.map((p) =>
              fetchJson(`/tasks/${p.id}/`, {
                method: 'PATCH',
                body: JSON.stringify({ status: p.status, order: p.order }),
              })
            )
          )
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Impossible de réorganiser le tableau'
          notify.error(msg)
          set({
            tasks: prevTasks,
            apiError: msg,
          })
        }
      },

      getProjectTasks: (projectId): Task[] => {
        const state = get()
        const key = normalizeProjectKey(projectId)
        return state.tasks
          .filter((task) => normalizeProjectKey(task.projectId) === key)
          .sort((a, b) => a.order - b.order)
      },

      hydrateFromApi: async () => {
        set({ isHydrating: true, apiError: null })
        try {
          const projectsRaw = await fetchJson<any[]>('/projects/')
          const projects = projectsRaw.map(normalizeProject)

          const taskRequests = projects.map((project) =>
            fetchJson<any[]>(`/tasks/?project=${project.id}`)
              .then((items) => items.map(normalizeTask))
              .catch(() => [])
          )
          const tasksGrouped = await Promise.all(taskRequests)
          const tasks = tasksGrouped.flat()

          set({ projects, tasks, isHydrating: false, apiError: null })
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Failed to sync projects'
          notify.error(msg)
          set({
            isHydrating: false,
            apiError: msg,
          })
        }
      },

      hydrateBillingFromApi: async () => {
        if (!get().isAuthenticated) {
          set({ billingModules: [], tenantSubscriptions: [], billingLoading: false })
          return
        }
        set({ billingLoading: true, apiError: null })
        try {
          const [modules, subscriptions] = await Promise.all([
            fetchJson<BillingModule[]>('/billing/modules/'),
            fetchJson<TenantSubscription[]>('/billing/subscriptions/'),
          ])
          set({
            billingModules: modules,
            tenantSubscriptions: subscriptions,
            billingLoading: false,
          })
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Failed to load billing data'
          notify.error(msg)
          set({
            billingLoading: false,
            apiError: msg,
          })
        }
      },

      initiateModulesPayment: async (moduleIds, moduleMonths = {}) => {
        if (!moduleIds.length) {
          const msg = 'Selectionne au moins un module.'
          notify.warning(msg)
          set({ apiError: msg })
          return { paymentUrl: null, transactionId: null }
        }
        const sanitizedModuleMonths: Record<string, number> = {}
        moduleIds.forEach((moduleId) => {
          const raw = Number(moduleMonths[moduleId] ?? 1)
          sanitizedModuleMonths[moduleId] = Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1
        })
        try {
          const response = await fetchJson<{
            payment_url?: string | null
            transaction_id?: string | null
          }>('/billing/payments/initiate/', {
            method: 'POST',
            body: JSON.stringify({ module_ids: moduleIds, module_months: sanitizedModuleMonths }),
          })
          return {
            paymentUrl: response.payment_url ?? null,
            transactionId: response.transaction_id ?? null,
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Paiement initiation failed'
          notify.error(msg)
          set({ apiError: msg })
          return { paymentUrl: null, transactionId: null }
        }
      },

      syncModulesPayment: async (transactionId) => {
        try {
          await fetchJson('/billing/payments/sync/', {
            method: 'POST',
            body: JSON.stringify({ transaction_id: transactionId }),
          })
          await get().bootstrapAuth()
          await get().hydrateBillingFromApi()
          notify.success('Paiement synchronise')
          return true
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Paiement sync failed'
          notify.error(msg)
          set({ apiError: msg })
          return false
        }
      },
    }),
    {
      name: 'corpcorestore',
    }
  )
)
