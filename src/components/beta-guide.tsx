import Link from "next/link";
import { DashboardHeading } from "@/components/dashboard/heading";
import { HomeFeatureAnimation } from "@/components/home-feature-animation";
import "./beta-guide.css";

type Step = {
  id: string;
  title: string;
  steps: string[];
  href: string;
  action: string;
  demo?: string;
};

const parent: Step[] = [
  {
    id: "invitation",
    title: "Relier le carnet de mon enfant",
    steps: [
      "Ouvrez le lien d’invitation transmis par votre soignant et connectez-vous.",
      "Confirmez votre demande de rattachement. Après validation, ouvrez Mes enfants et sélectionnez le carnet.",
    ],
    href: "/parent/invitation",
    action: "Relier un carnet",
    demo: "guide-invitation",
  },
  {
    id: "vaccinations",
    title: "Consulter les vaccinations",
    steps: [
      "Dans Vaccinations, sélectionnez l’enfant.",
      "Consultez les doses documentées. Les références de routine et les dates vérifiées par un soignant sont affichées séparément.",
    ],
    href: "/parent?view=vaccinations",
    action: "Ouvrir les vaccinations",
    demo: "vaccinations",
  },
  {
    id: "croissance",
    title: "Lire la courbe de croissance",
    steps: [
      "Dans Croissance, sélectionnez l’enfant.",
      "Comparez les mesures saisies. Pour une question sur une mesure, adressez-vous au professionnel qui suit l’enfant.",
    ],
    href: "/parent?view=growth",
    action: "Ouvrir la croissance",
    demo: "croissance",
  },
  {
    id: "rendez-vous",
    title: "Retrouver un rendez-vous",
    steps: [
      "Ouvrez Rendez-vous et sélectionnez l’enfant.",
      "Consultez la date, le lieu et le motif enregistrés. Contactez le cabinet pour demander un déplacement.",
    ],
    href: "/parent?view=appointments",
    action: "Voir mes rendez-vous",
  },
  {
    id: "partage",
    title: "Partager le carnet par QR",
    steps: [
      "Dans Partage & accès, sélectionnez l’enfant et choisissez les informations à partager.",
      "Confirmez votre consentement et présentez le QR au soignant vérifié. Le code est à usage unique et expire sous cinq minutes au plus tard.",
      "Depuis la même rubrique, révoquez le partage si nécessaire.",
    ],
    href: "/parent?view=access",
    action: "Ouvrir Partage & accès",
    demo: "guide-parent-qr",
  },
  {
    id: "preferences",
    title: "Gérer les notifications et le compte",
    steps: [
      "Consultez les notifications dans votre espace.",
      "Dans Paramètres, enregistrez vos préférences. Depuis Mes demandes, suivez vos demandes de rattachement.",
    ],
    href: "/parent/settings",
    action: "Ouvrir mes paramètres",
  },
];

const clinician: Step[] = [
  {
    id: "patients",
    title: "Trouver ou inscrire un enfant",
    steps: [
      "Recherchez dans Enfants par nom ou numéro de registre.",
      "Ouvrez un dossier autorisé, ou utilisez Ajouter un enfant pour inscrire un dossier dans votre périmètre.",
    ],
    href: "/patients",
    action: "Ouvrir le registre",
  },
  {
    id: "consultation",
    title: "Documenter une consultation",
    steps: [
      "Depuis Consultations, sélectionnez un enfant autorisé et ouvrez une nouvelle entrée.",
      "Saisissez le motif, la date et la source, puis enregistrez si votre compte dispose de l’habilitation.",
    ],
    href: "/consultations",
    action: "Ouvrir les consultations",
    demo: "guide-consultation",
  },
  {
    id: "dose",
    title: "Enregistrer une vaccination",
    steps: [
      "Ouvrez Vaccinations et sélectionnez le dossier.",
      "Renseignez la dose et sa provenance. Les repères calculés sont à vérifier contre votre registre.",
    ],
    href: "/vaccinations",
    action: "Ouvrir les vaccinations",
    demo: "saisie-vaccination",
  },
  {
    id: "agenda",
    title: "Ouvrir l’agenda et planifier",
    steps: [
      "Choisissez une date dans Rendez-vous pour afficher les créneaux.",
      "Avec l’habilitation, utilisez Planifier un rendez-vous. Vérifiez le dossier, le lieu et l’horaire avant la confirmation.",
    ],
    href: "/appointments",
    action: "Ouvrir le calendrier",
    demo: "agenda",
  },
  {
    id: "mesures",
    title: "Enregistrer et vérifier les mesures",
    steps: [
      "Ouvrez Croissance et sélectionnez le dossier.",
      "Avec l’habilitation, enregistrez la date et les valeurs mesurées, puis consultez la courbe.",
    ],
    href: "/growth",
    action: "Ouvrir la croissance",
    demo: "croissance",
  },
  {
    id: "qr",
    title: "Scanner le QR d’un parent",
    steps: [
      "Connectez-vous avec votre compte soignant vérifié. Cliquez sur Scanner un QR parent, puis sur Scanner avec la caméra.",
      "Autorisez la caméra et cadrez le QR. Vous pouvez aussi importer une image du QR ou coller le lien.",
      "Cliquez sur Ouvrir le partage. Le contenu est limité aux informations choisies par le parent et à la durée du partage.",
    ],
    href: "/share",
    action: "Ouvrir le scanner",
    demo: "guide-clinician-qr",
  },
  {
    id: "habilitations",
    title: "Vérifier mes habilitations",
    steps: [
      "Dans Mon compte soignant, vérifiez le statut du compte et ouvrez Mes habilitations.",
      "Si une action de saisie est indisponible, vérifiez l’habilitation associée avant de demander son examen.",
    ],
    href: "/account/clinical-permissions",
    action: "Voir mes habilitations",
  },
];

const provisional: Step[] = [
  {
    id: "provisoire",
    title: "Travailler avec un dossier provisoire",
    steps: [
      "Dans Enfants, ouvrez un de vos dossiers privés ou inscrivez un enfant fictif.",
      "Depuis le dossier, choisissez Consultations, Vaccinations, Croissance ou Rendez-vous selon l’information à saisir.",
      "Le dossier reste dans votre espace provisoire. L’examen du compte et l’accès à des dossiers partagés suivent des démarches distinctes.",
    ],
    href: "/provisional/children",
    action: "Ouvrir mes dossiers privés",
    demo: "guide-consultation",
  },
  {
    id: "compte",
    title: "Suivre la vérification de mon compte",
    steps: [
      "Ouvrez Mon compte soignant et consultez l’état de votre demande.",
      "Suivez le parcours de vérification proposé depuis votre compte.",
    ],
    href: "/account",
    action: "Ouvrir mon compte soignant",
  },
];

const guides = { parent, clinician, provisional };

const reportUrl =
  "mailto:abdorrahimbounga1@gmail.com?subject=Mon%20Enfant%20%7C%20Signalement%20b%C3%AAta";

export function BetaGuide({ audience }: { audience: keyof typeof guides }) {
  const sections = guides[audience];
  return (
    <div className="beta-guide">
      <DashboardHeading
        title={audience === "parent" ? "Guide parent" : "Guide soignant"}
        description="Suivez les étapes et les exemples animés pour prendre en main votre espace."
        section="guide"
        clinician={audience !== "parent"}
      />
      <nav className="beta-guide-index" aria-label="Sommaire du guide">
        {sections.map(({ id, title }) => (
          <a key={id} href={`#${id}`}>
            {title}
          </a>
        ))}
      </nav>
      {sections.map(({ id, title, steps, href, action, demo }) => (
        <section className="panel beta-guide-section" id={id} key={id}>
          <div>
            <h2>{title}</h2>
            <ol>
              {steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <Link className="button secondary" href={href}>
              {action}
            </Link>
          </div>
          {demo && <HomeFeatureAnimation name={demo} description={title} />}
        </section>
      ))}
      <section className="panel" id="signaler-un-bug">
        <h2>Signaler un bug pendant la bêta</h2>
        <p>
          Utilisez des données fictives. Dans votre signalement, indiquez
          l’appareil, le navigateur, la page, les étapes et le résultat attendu.
        </p>
        <p>
          Avant d’ajouter une capture, masquez les informations de santé, les
          adresses e-mail et les QR.
        </p>
        <a className="button secondary" href={reportUrl}>
          Signaler un bug par e-mail
        </a>
      </section>
    </div>
  );
}
