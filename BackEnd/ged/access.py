"""Regles d'acces GED (style Drive: dossiers, descendants, partages)."""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db.models import Q

from .models import Document, DocumentFolder, GedShare


def user_can_manage_ged_share(user, share: GedShare) -> bool:
    """Qui peut modifier ou supprimer une ligne GedShare (y compris partage sur dossier parent)."""
    if user.is_staff or user.is_superuser:
        return True
    if share.shared_by_id == user.id:
        return True
    if share.folder_id and share.folder and can_share_folder(user, share.folder):
        return True
    if share.document_id and share.document and can_share_document(user, share.document):
        return True
    return False


def expand_folder_descendants(seed_ids: set) -> set:
    if not seed_ids:
        return set()
    all_ids = set(seed_ids)
    frontier = list(seed_ids)
    while frontier:
        children = DocumentFolder.objects.filter(parent_id__in=frontier).values_list("id", flat=True)
        next_frontier = []
        for cid in children:
            if cid not in all_ids:
                all_ids.add(cid)
                next_frontier.append(cid)
        frontier = next_frontier
    return all_ids


def public_folder_tree_ids() -> set:
    roots = DocumentFolder.objects.filter(created_by__isnull=True).values_list("id", flat=True)
    return expand_folder_descendants(set(roots))


def accessible_folder_ids(user) -> set | None:
    """Ensemble des dossiers visibles par l'utilisateur. None = tout (staff)."""
    if user.is_staff or user.is_superuser:
        return None
    ids = set(public_folder_tree_ids())
    owned = set(DocumentFolder.objects.filter(created_by=user).values_list("id", flat=True))
    shared = set(
        GedShare.objects.filter(shared_with=user, folder_id__isnull=False).values_list("folder_id", flat=True)
    )
    seed = owned | shared
    ids |= expand_folder_descendants(seed)
    return ids


def folder_is_under_public_tree(folder: DocumentFolder) -> bool:
    walk = folder
    while walk:
        if walk.created_by_id is None:
            return True
        walk = walk.parent
    return False


def can_view_folder(user, folder: DocumentFolder) -> bool:
    if user.is_staff or user.is_superuser:
        return True
    if folder_is_under_public_tree(folder):
        return True
    acc = accessible_folder_ids(user)
    if acc is None:
        return True
    return folder.id in acc


def can_edit_folder(user, folder: DocumentFolder) -> bool:
    if user.is_staff or user.is_superuser:
        return True
    walk = folder
    while walk:
        if walk.created_by_id == user.id:
            return True
        if GedShare.objects.filter(shared_with=user, folder=walk, role=GedShare.ROLE_EDITOR).exists():
            return True
        walk = walk.parent
    return False


def can_share_folder(user, folder: DocumentFolder) -> bool:
    return can_edit_folder(user, folder)


def can_view_document(user, doc: Document) -> bool:
    if user.is_staff or user.is_superuser:
        return True
    if doc.uploaded_by_id == user.id:
        return True
    if GedShare.objects.filter(shared_with=user, document=doc).exists():
        return True
    if doc.folder_id:
        acc = accessible_folder_ids(user)
        if acc is not None and doc.folder_id in acc:
            return True
        # dossier public (ancetre sans created_by)
        if doc.folder and folder_is_under_public_tree(doc.folder):
            return True
    return False


def can_edit_document(user, doc: Document) -> bool:
    if user.is_staff or user.is_superuser:
        return True
    if doc.uploaded_by_id == user.id:
        return True
    if GedShare.objects.filter(shared_with=user, document=doc, role=GedShare.ROLE_EDITOR).exists():
        return True
    if doc.folder_id and doc.folder:
        return can_edit_folder(user, doc.folder)
    return False


def can_share_document(user, doc: Document) -> bool:
    return can_edit_document(user, doc)


def document_queryset_for_user(user):
    qs = Document.objects.select_related("folder", "uploaded_by").all()
    if user.is_staff or user.is_superuser:
        return qs
    acc = accessible_folder_ids(user)
    shared_doc_ids = GedShare.objects.filter(shared_with=user, document_id__isnull=False).values_list(
        "document_id", flat=True
    )
    q = Q(uploaded_by=user) | Q(id__in=shared_doc_ids)
    if acc is not None:
        q |= Q(folder_id__in=acc)
    return qs.filter(q).distinct()


def folder_queryset_for_user(user):
    qs = DocumentFolder.objects.all()
    if user.is_staff or user.is_superuser:
        return qs
    acc = accessible_folder_ids(user)
    if acc is None:
        return qs
    return qs.filter(id__in=acc)
