export interface Tenant {
  id: string
  name: string
  logo?: string
  plan: 'starter' | 'pro' | 'enterprise'
  members: number
  onTrial?: boolean
  paidUntil?: string | null
}

export interface Project {
  id: string
  name: string
  description: string
  status: 'planning' | 'active' | 'on_hold' | 'completed'
  startDate: string
  endDate: string
  progress: number
  tenantId: string
  team: TeamMember[]
  workTeamId?: string | null
  workTeamName?: string | null
  color?: string
}

export interface Task {
  id: string
  projectId: string
  title: string
  description: string
  status: 'backlog' | 'todo' | 'in_progress' | 'review' | 'done'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  assigneeId?: number | null
  assignee?: string
  assigneeAvatar?: string
  dueDate?: string
  startDate?: string
  estimatedHours?: number
  actualHours?: number
  subtasks: Subtask[]
  comments: Comment[]
  attachments: Attachment[]
  order: number
}

export type TaskStatus = Task['status']

export interface Subtask {
  id: string
  taskId: string
  title: string
  completed: boolean
}

export interface Comment {
  id: string
  taskId: string
  /** Identifiant auteur (API) pour restreindre édition / suppression côté UI. */
  authorId?: number
  author: string
  authorAvatar: string
  content: string
  createdAt: string
}

export interface Attachment {
  id: string
  taskId: string
  name: string
  url: string
  type: string
  size: number
  source?: 'upload' | 'ged' | 'link'
  gedDocumentId?: string | null
}

export interface ProjectAttachment {
  id: string
  projectId: string
  name: string
  url: string
  type: string
  size: number
  source?: 'upload' | 'ged' | 'link'
  gedDocumentId?: string | null
}

export interface TeamMember {
  id: string
  name: string
  email: string
  avatar: string
  role: 'owner' | 'lead' | 'member'
}

export interface GanttTask extends Task {
  duration: number
  dependencies: string[]
}

export interface KanbanColumn {
  id: string
  title: string
  status: Task['status']
  taskIds: string[]
}

export interface UIState {
  sidebarOpen: boolean
  darkMode: boolean
  selectedProjectId?: string
  selectedTaskId?: string
  viewMode: 'dashboard' | 'list' | 'kanban' | 'gantt' | 'timeline' | 'calendar'
}

export interface AuthUser {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  is_staff: boolean
  is_superuser: boolean
  /** RH entreprise: peut valider les conges comme un manager global. */
  is_company_admin?: boolean
  profile_photo?: string | null
}

export interface InAppNotification {
  id: string
  title: string
  message: string
  notificationType: 'info' | 'success' | 'warning' | 'error'
  isRead: boolean
  linkUrl?: string
  metadata?: Record<string, unknown>
  createdAt: string
}

export interface BillingModule {
  id: string
  code: string
  name: string
  description: string
  monthly_price_xof: number
  is_active: boolean
}

export interface TenantSubscription {
  id: string
  module: BillingModule
  status: 'pending' | 'active' | 'grace' | 'suspended' | 'cancelled'
  started_at: string | null
  grace_until: string | null
  renewal_at: string | null
  auto_renew: boolean
  fedapay_transaction_id: string
  metadata: Record<string, unknown>
}

export interface TimeEntry {
  id: string
  taskId: string
  user?: number | null
  startedAt: string
  endedAt: string | null
  secondsSpent: number
  note: string
}

export interface CompanyOnboardingPayload {
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
  admin_id_document_type?: string
  admin_job_title: string
  admin_department: string
  admin_employee_number?: string
  admin_hire_date: string
  admin_residential_country: string
  admin_residential_city: string
  admin_residential_address: string
  first_name: string
  last_name: string
  legal_name: string
  registration_number?: string
  tax_identification_number?: string
  legal_status?: string
  industry?: string
  country: string
  city?: string
  address_line: string
  postal_code?: string
  company_email: string
  company_phone?: string
  representative_full_name: string
  representative_role?: string
  representative_id_number?: string
}
