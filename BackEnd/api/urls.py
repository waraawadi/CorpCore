from django.urls import include, path
from rest_framework.routers import DefaultRouter

from ged.views import DocumentFolderViewSet, DocumentViewSet, GedShareViewSet
from crm.views import (
    CrmActivityViewSet,
    CrmContactViewSet,
    CrmDashboardView,
    CrmLeadViewSet,
    CrmOpportunityViewSet,
)
from finance.views import (
    FinanceAccountViewSet,
    FinanceCategoryViewSet,
    FinanceDashboardView,
    FinanceDocumentViewSet,
    FinanceInvoiceLineViewSet,
    FinanceInvoiceViewSet,
    FinanceReportView,
    FinanceTransactionViewSet,
)
from inventory.views import (
    InventoryAssetReferenceViewSet,
    InventoryCategoryViewSet,
    InventoryItemViewSet,
    InventoryLocationViewSet,
    InventoryMovementViewSet,
)
from employees.views import (
    ContractViewSet,
    DepartmentViewSet,
    EmployeeProfileViewSet,
    LeaveRequestViewSet,
    PayrollViewSet,
    PayrollRuleViewSet,
    PositionViewSet,
    UserOptionViewSet,
)
from projects.views import (
    MilestoneViewSet,
    ProjectAttachmentViewSet,
    ProjectViewSet,
    SprintViewSet,
    SubTaskViewSet,
    TaskAttachmentViewSet,
    TaskCommentViewSet,
    TaskDependencyViewSet,
    TaskViewSet,
    TeamViewSet,
    InAppNotificationViewSet,
    TimeEntryViewSet,
)
from tenants.views import CompanyProfileView

from .views import HealthCheckView

router = DefaultRouter()
router.register("projects", ProjectViewSet, basename="projects")
router.register("teams", TeamViewSet, basename="teams")
router.register("notifications", InAppNotificationViewSet, basename="notifications")
router.register("tasks", TaskViewSet, basename="tasks")
router.register("subtasks", SubTaskViewSet, basename="subtasks")
router.register("sprints", SprintViewSet, basename="sprints")
router.register("milestones", MilestoneViewSet, basename="milestones")
router.register("task-comments", TaskCommentViewSet, basename="task-comments")
router.register("task-attachments", TaskAttachmentViewSet, basename="task-attachments")
router.register("project-attachments", ProjectAttachmentViewSet, basename="project-attachments")
router.register("task-dependencies", TaskDependencyViewSet, basename="task-dependencies")
router.register("time-entries", TimeEntryViewSet, basename="time-entries")
router.register("hr/departments", DepartmentViewSet, basename="hr-departments")
router.register("hr/users", UserOptionViewSet, basename="hr-users")
router.register("hr/positions", PositionViewSet, basename="hr-positions")
router.register("hr/employees", EmployeeProfileViewSet, basename="hr-employees")
router.register("hr/contracts", ContractViewSet, basename="hr-contracts")
router.register("hr/leaves", LeaveRequestViewSet, basename="hr-leaves")
router.register("hr/payrolls", PayrollViewSet, basename="hr-payrolls")
router.register("hr/payroll-rules", PayrollRuleViewSet, basename="hr-payroll-rules")
router.register("ged/folders", DocumentFolderViewSet, basename="ged-folders")
router.register("ged/documents", DocumentViewSet, basename="ged-documents")
router.register("ged/shares", GedShareViewSet, basename="ged-shares")
router.register("inventory/categories", InventoryCategoryViewSet, basename="inventory-categories")
router.register("inventory/locations", InventoryLocationViewSet, basename="inventory-locations")
router.register("inventory/items", InventoryItemViewSet, basename="inventory-items")
router.register("inventory/movements", InventoryMovementViewSet, basename="inventory-movements")
router.register("inventory/assets", InventoryAssetReferenceViewSet, basename="inventory-assets")
router.register("crm/contacts", CrmContactViewSet, basename="crm-contacts")
router.register("crm/leads", CrmLeadViewSet, basename="crm-leads")
router.register("crm/opportunities", CrmOpportunityViewSet, basename="crm-opportunities")
router.register("crm/activities", CrmActivityViewSet, basename="crm-activities")
router.register("finance/accounts", FinanceAccountViewSet, basename="finance-accounts")
router.register("finance/categories", FinanceCategoryViewSet, basename="finance-categories")
router.register("finance/transactions", FinanceTransactionViewSet, basename="finance-transactions")
router.register("finance/invoices", FinanceInvoiceViewSet, basename="finance-invoices")
router.register("finance/invoice-lines", FinanceInvoiceLineViewSet, basename="finance-invoice-lines")
router.register("finance/documents", FinanceDocumentViewSet, basename="finance-documents")

urlpatterns = [
    path("health/", HealthCheckView.as_view(), name="health-check"),
    path("crm/dashboard/", CrmDashboardView.as_view(), name="crm-dashboard"),
    path("finance/dashboard/", FinanceDashboardView.as_view(), name="finance-dashboard"),
    path("finance/reports/", FinanceReportView.as_view(), name="finance-reports"),
    path("company/profile/", CompanyProfileView.as_view(), name="company-profile"),
    path("billing/", include("subscriptions.urls")),
    path("public/world/", include("worlddata.urls")),
    path("", include(router.urls)),
]
