import random
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from django_tenants.utils import schema_context

from support.models import SupportTicket, SupportTicketComment
from tenants.models import Client

User = get_user_model()

TICKET_SEEDS = [
    ("Connexion impossible au portail", "Le message d erreur indique session expiree apres la saisie du mot de passe."),
    ("Demande d acces au dossier GED finance", "Besoin des droits lecture sur le dossier Factures 2025 pour cloture."),
    ("Facture du mois non recue par email", "L abonnement Pro est actif mais aucun PDF en piece jointe depuis mardi."),
    ("Bug : totaux du tableau de bord ventes faux", "Les montants affiches ne correspondent pas a l export Excel pour la semaine 12."),
    ("Lenteur extreme sur la page fournisseurs", "Le chargement depasse 20 secondes avec moins de 50 lignes."),
    ("Changement de priorite pour la commande #4521", "Le client demande une livraison express, merci de mettre a jour le statut."),
    ("Erreur 500 lors de l enregistrement d un contact CRM", "Reproduit sur Chrome, apres ajout du telephone international."),
    ("Question sur la categorisation des depenses", "Ou classer les frais de deplacement interieur dans le module finance ?"),
    ("Demande d evolution : export PDF des tickets", "Serait utile pour archivage interne et audits."),
    ("Compte verrouille apres trois tentatives", "L utilisateur n a pas recu l email de reinitialisation."),
    ("Synchronisation calendrier absente", "Les conges saisis dans RH n apparaissent pas dans l agenda partage."),
    ("Donnees inventaire incoherentes apres transfert", "La quantite en entrepot A est negative apres mouvement vers B."),
    ("Acces API refuse pour l integration compta", "Token JWT retourne 403 sur l endpoint des factures."),
    ("Champ personnalise manquant sur le formulaire lead", "Le champ SIRET n est plus visible depuis la derniere mise a jour."),
    ("Double notification email pour un meme ticket", "Deux mails identiques recus a 30 secondes d intervalle."),
    ("Probleme d impression des bons de commande", "Mise en page cassee : pied de page coupe sur A4."),
    ("Demande de formation rapide module achats", "Equipe de 5 personnes, creneau d une demi-journee souhaite."),
    ("Erreur de validation sur montant TTC", "Message generique sans detail sur la ligne concernee."),
    ("Restauration d un ticket supprime par erreur", "Ticket reference TCK- ancien, besoin de recuperer l historique si possible."),
    ("Conflit de numerotation des references internes", "Deux bons portent le meme numero dans deux filiales."),
    ("Question sur la retention des logs d audit", "Duree de conservation et export pour conformite."),
    ("Interface mobile : menu support inaccessible", "Le lien Support disparait en mode paysage sur tablette."),
    ("Echec import CSV fournisseurs", "Fichier modele respecte, erreur ligne 14 sans precision de colonne."),
    ("Demande d assignation a l equipe infrastructure", "Ticket technique serveur, merci de reassigner."),
    ("Mise a jour statut bloquee en En cours", "Impossible de passer a Resolu depuis l interface."),
    ("Piece jointe trop volumineuse refusee", "Besoin d augmenter la limite pour rapport PDF 12 Mo."),
    ("Notification Slack non recue", "Webhook configure, aucun message sur nouveau ticket."),
    ("Traduction manquante sur le bandeau priorite", "Cle affichee a la place du libelle en anglais."),
    ("Demande de rapport hebdomadaire automatise", "Resume des tickets ouverts / fermes par equipe."),
    ("Comportement etrange filtres date sur le dashboard", "En choisissant la semaine courante, les totaux restent a zero."),
]

COMMENT_SNIPPETS = [
    "Merci de preciser la version du navigateur utilisee.",
    "Nous reproduisons le souci, analyse en cours.",
    "Pouvez-vous envoyer une capture d ecran ?",
    "Ticket pris en charge par l equipe support.",
    "Contournement possible : vider le cache puis reconnecter.",
    "C est corrige en preproduction, deploiement prevu demain.",
    "Besoin d un acces administrateur temporaire pour verifier.",
    "Le demandeur a confirme que c est resolu de son cote.",
]


class Command(BaseCommand):
    help = "Genere des tickets et commentaires factices pour le module support sur un tenant."

    def add_arguments(self, parser):
        parser.add_argument("--tenant", required=True, help="Schema du tenant (ex: mgs)")
        parser.add_argument("--count", type=int, default=30, help="Nombre de tickets a creer (defaut: 30)")
        parser.add_argument("--seed", type=int, default=42, help="Graine pseudo-aleatoire")

    def handle(self, *args, **options):
        tenant_schema = options["tenant"].strip()
        count = options["count"]
        seed = options["seed"]

        if count <= 0:
            raise CommandError("--count doit etre strictement positif.")

        tenant = Client.objects.filter(schema_name=tenant_schema).first()
        if not tenant:
            raise CommandError(f"Tenant introuvable: {tenant_schema}")

        random.seed(seed)

        with schema_context(tenant_schema):
            users = list(User.objects.filter(is_active=True).order_by("id"))
            if not users:
                raise CommandError(
                    f"Aucun utilisateur actif dans le schema '{tenant_schema}'. "
                    "Creez au moins un compte avant de lancer le seed."
                )

            categories = [c[0] for c in SupportTicket.CATEGORY_CHOICES]
            priorities = [p[0] for p in SupportTicket.PRIORITY_CHOICES]
            statuses = [s[0] for s in SupportTicket.STATUS_CHOICES]

            created_tickets = 0
            created_comments = 0

            with transaction.atomic():
                for i in range(count):
                    title, desc = TICKET_SEEDS[i % len(TICKET_SEEDS)]
                    if i >= len(TICKET_SEEDS):
                        title = f"{title} (#{i + 1})"

                    requester = random.choice(users)
                    assignee = None
                    if random.random() < 0.65:
                        candidates = [u for u in users if u.pk != requester.pk] or users
                        assignee = random.choice(candidates)

                    status = random.choices(
                        statuses,
                        weights=[18, 22, 12, 20, 28],
                        k=1,
                    )[0]

                    ticket = SupportTicket.objects.create(
                        title=title,
                        description=desc,
                        category=random.choice(categories),
                        priority=random.choice(priorities),
                        status=status,
                        requester=requester,
                        assignee=assignee,
                    )
                    created_tickets += 1

                    if random.random() < 0.85:
                        n_comments = random.randint(1, 3)
                        authors_pool = [requester] + ([assignee] if assignee else [])
                        authors_pool = [u for u in authors_pool if u is not None]
                        if not authors_pool:
                            authors_pool = users
                        for _ in range(n_comments):
                            author = random.choice(authors_pool)
                            body = random.choice(COMMENT_SNIPPETS)
                            SupportTicketComment.objects.create(
                                ticket=ticket,
                                author=author,
                                body=body,
                            )
                            created_comments += 1

                    fake_ts = timezone.now() - timedelta(days=random.randint(0, 45))
                    SupportTicket.objects.filter(pk=ticket.pk).update(created_at=fake_ts, updated_at=fake_ts)

        self.stdout.write(
            self.style.SUCCESS(
                f"Support seed OK pour '{tenant_schema}': {created_tickets} tickets, "
                f"{created_comments} commentaires."
            )
        )
