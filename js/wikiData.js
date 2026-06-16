/**
 * Collectif Plaine - Base de Données du Wiki du Locataire
 * Références et textes basés rigoureusement sur la législation française.
 */
const WIKI_DATA = [
    {
        id: "charges-recup",
        category: "charges",
        title: "Charges récupérables : qu'a le droit de facturer le bailleur ?",
        keywords: ["charges", "facture", "recuperables", "eau", "ordures", "taxe", "menage", "copropriete"],
        legislation: "Décret n° 87-713 du 26 août 1987",
        summary: "Le bailleur ne peut récupérer que les charges listées exhaustivement par la loi. Tout le reste est à sa charge exclusive.",
        content: `
            <p>Le locataire doit payer des provisions pour charges, mais le bailleur doit procéder à une <strong>régularisation annuelle</strong> en fournissant les justificatifs.</p>
            
            <div class="wiki-list-container">
                <div class="wiki-list-section positive">
                    <h4>✅ Ce qui est récupérable (à votre charge) :</h4>
                    <ul>
                        <li><strong>Services rendus :</strong> Consommation d'eau froide/chaude, chauffage collectif, électricité des parties communes, entretien de l'ascenseur (contrat de maintenance de base).</li>
                        <li><strong>Entretien courant :</strong> Ménage des parties communes, maintenance des espaces verts, menues réparations des équipements communs.</li>
                        <li><strong>Taxes :</strong> Taxe d'enlèvement des ordures ménagères (TEOM), taxe de balayage.</li>
                    </ul>
                </div>
                
                <div class="wiki-list-section negative">
                    <h4>❌ Ce qui n'est PAS récupérable (à la charge du bailleur) :</h4>
                    <ul>
                        <li><strong>Frais de gestion :</strong> Honoraires de syndic de copropriété, frais d'envoi des quittances de loyer (strictement interdit de les facturer).</li>
                        <li><strong>Travaux majeurs :</strong> Remplacement d'une chaudière collective, ravalement de façade, réparation de la cabine d'ascenseur ou remplacement d'un câble d'ascenseur rompu.</li>
                        <li><strong>Dégradations :</strong> Réparations dues à la vétusté ou à un cas de force majeure (tempête, etc.).</li>
                    </ul>
                </div>
            </div>
            
            <p class="wiki-law-note">⚠️ <em>En cas de doute, vous avez le droit d'exiger la consultation des pièces justificatives (factures, contrats) pendant les 6 mois qui suivent l'envoi de la régularisation.</em></p>
        `,
        actionText: "Vérifier mes charges",
        actionLink: "#/charges"
    },
    {
        id: "rep-locatives",
        category: "rep_locatives",
        title: "Réparations locatives : qui doit payer les travaux et l'entretien ?",
        keywords: ["reparations", "travaux", "locatives", "entretien", "robinet", "peinture", "ampoule", "serrure", "entretien chaudiere"],
        legislation: "Décret n° 87-712 du 26 août 1987",
        summary: "Le locataire assure l'entretien courant et les menues réparations. Le propriétaire prend en charge le reste (vétusté, gros travaux).",
        content: `
            <p>La règle générale distingue l'usage courant (locataire) des structures et de l'usure naturelle (propriétaire).</p>
            
            <div class="wiki-list-container">
                <div class="wiki-list-section positive">
                    <h4>🛠️ À la charge du locataire (entretien courant) :</h4>
                    <ul>
                        <li><strong>Plomberie :</strong> Remplacement des joints usés, débouchage des canalisations, remplacement des tuyaux flexibles de douche.</li>
                        <li><strong>Électricité :</strong> Remplacement des ampoules, fusibles, interrupteurs ou prises dégradés.</li>
                        <li><strong>Équipements :</strong> Entretien annuel de la chaudière individuelle, remplacement des filtres de hotte, graissage des gonds de portes/fenêtres.</li>
                        <li><strong>Menuiserie & Finitions :</strong> Remplacement des vitres brisées, menues réparations de poignées, entretien des peintures et revêtements de sol.</li>
                    </ul>
                </div>
                
                <div class="wiki-list-section negative">
                    <h4>🏢 À la charge du propriétaire (gros travaux & usure) :</h4>
                    <ul>
                        <li><strong>Vétusté :</strong> Remplacement d'un revêtement de sol usé par le temps, peintures écaillées par l'âge.</li>
                        <li><strong>Gros équipements :</strong> Remplacement d'un chauffe-eau en panne, réparation d'une chaudière collective défectueuse.</li>
                        <li><strong>Gros œuvre :</strong> Travaux d'étanchéité des fenêtres ou du toit, réparation des fissures structurelles, réparation complète de l'ascenseur.</li>
                    </ul>
                </div>
            </div>
        `,
        actionText: "Signaler une panne ou un incident",
        actionLink: "#/incidents"
    },
    {
        id: "panne-chauffage",
        category: "chauffage",
        title: "Pas de chauffage ou d'eau chaude : quels sont vos droits ?",
        keywords: ["chauffage", "eau chaude", "panne", "froid", "coupure", "temperature", "recours", "lettre"],
        legislation: "Articles R111-6 du Code de la construction / Article 1724 du Code civil",
        summary: "Le bailleur est obligé de fournir un chauffage décent et fonctionnel. La loi fixe des températures minimales.",
        content: `
            <p>Le bailleur doit assurer la jouissance paisible du logement et garantir un chauffage permettant d'atteindre les normes légales.</p>
            
            <div class="wiki-info-box">
                <h4>🌡️ La règle des 19°C :</h4>
                <p>Selon le Code de la construction et de l'habitation, les équipements de chauffage doivent permettre de maintenir une température moyenne de <strong>19°C</strong> dans le logement. Si la température descend en dessous de <strong>18°C</strong>, le logement peut être considéré comme non conforme.</p>
            </div>
            
            <h4>🚨 Recours en cas de panne de chauffage ou d'eau chaude collective :</h4>
            <ol>
                <li><strong>Alerter immédiatement :</strong> Signalez le problème au gardien et aux autres résidents ou via le collectif pour vérifier si la panne touche tout l'immeuble.</li>
                <li><strong>Mettre en demeure le bailleur :</strong> Si la panne persiste au-delà de 2 ou 3 jours, envoyez une <strong>lettre de mise en demeure en recommandé avec accusé de réception (LRAR)</strong>. Le bailleur dispose alors d'un délai maximal de <strong>21 jours</strong> pour effectuer les réparations (Art. 1724 du Code civil).</li>
                <li><strong>Demander une indemnisation :</strong> Si la coupure dure plus de 21 jours, vous êtes en droit de demander une réduction de loyer proportionnelle à la gêne subie.</li>
            </ol>
            
            <p class="wiki-law-note">⚠️ <em>Attention : Il est strictement interdit de suspendre de vous-même le paiement de votre loyer sans l'autorisation d'un juge (saisie du tribunal judiciaire), sous peine de poursuites pour impayés.</em></p>
        `,
        actionText: "Créer une mise en demeure",
        actionLink: "#/incidents"
    },
    {
        id: "nuisibles-decence",
        category: "decence",
        title: "Nuisibles (punaises de lit, cafards, rats) : qui doit payer le traitement ?",
        keywords: ["nuisibles", "punaises de lit", "cafards", "rats", "desinsectisation", "decence", "logement", "hygiene"],
        legislation: "Loi du 6 juillet 1989 (Article 6) / Loi ELAN",
        summary: "Le propriétaire est légalement tenu de délivrer un logement exempt de toute infestation de nuisibles et parasites.",
        content: `
            <p>La présence de nuisibles est une question de <strong>décence du logement</strong>. Le propriétaire a des obligations strictes à ce sujet.</p>
            
            <h4>🐜 Qui paye la désinsectisation ou dératisation ?</h4>
            <ul>
                <li><strong>Le propriétaire bailleur :</strong> Doit prendre en charge l'intégralité des frais de main d'œuvre et de produits pour l'éradication des nuisibles (cafards, punaises de lit, souris) dès lors que l'infestation n'est pas manifestement due à un manque d'entretien du locataire.</li>
                <li><strong>Le locataire :</strong> Ne peut se voir facturer que les produits consommables si cela est spécifié, mais en pratique, la jurisprudence attribue le coût global de l'intervention de l'entreprise spécialisée au bailleur.</li>
            </ul>
            
            <h4>💡 En copropriété / Immeuble collectif :</h4>
            <p>Les traitements individuels sont souvent inefficaces si les appartements voisins sont aussi touchés. Une action collective des résidents permet de demander au bailleur ou au syndic de commander un **traitement global de tout l'immeuble**, qui doit être pris en charge par le bailleur social ou la copropriété (non récupérable sur les charges des locataires).</p>
        `,
        actionText: "Signaler des nuisibles dans mon bâtiment",
        actionLink: "#/incidents"
    },
    {
        id: "depot-garantie",
        category: "garantie_conge",
        title: "Dépôt de garantie non rendu : délais, retenues et pénalités de retard",
        keywords: ["depot de garantie", "caution", "restitution", "delai", "retenue", "penalite", "etat des lieux"],
        legislation: "Loi du 6 juillet 1989 (Article 22)",
        summary: "Le propriétaire dispose de 1 à 2 mois pour restituer la caution. Tout retard l'expose à une pénalité de 10% par mois.",
        content: `
            <p>La restitution de la caution (dépôt de garantie) est une source fréquente de litiges.</p>
            
            <h4>⏱️ Les délais légaux de restitution :</h4>
            <ul>
                <li><strong>1 mois :</strong> Si l'état des lieux de sortie est conforme et identique à l'état des lieux d'entrée.</li>
                <li><strong>2 mois :</strong> Si des dégradations ont été constatées et notées sur l'état des lieux de sortie.</li>
            </ul>
            
            <h4>⚖️ Retenues sur caution : quelles sont les règles ?</h4>
            <p>Le bailleur ne peut pas retenir des sommes arbitrairement. Toute retenue doit être **justifiée par des pièces justificatives** : devis de réparation ou factures d'artisans. De plus, il doit appliquer une grille de **vétusté** : si une peinture a 10 ans et est défraîchie, le locataire n'a pas à payer sa réfection complète, car c'est de l'usure normale.</p>
            
            <h4>🔥 La pénalité de retard de 10% :</h4>
            <p>À défaut de restitution dans les délais, le montant restant dû au locataire est majoré de plein droit d'une somme égale à <strong>10 % du loyer mensuel en principal</strong>, pour chaque mois de retard commencé (sauf si le retard est dû au fait que le locataire n'a pas transmis sa nouvelle adresse).</p>
        `,
        actionText: "Créer une lettre de mise en demeure",
        actionLink: "#/incidents"
    },
    {
        id: "conge-preavis",
        category: "garantie_conge",
        title: "Préavis de départ : comment donner congé et quel est le délai ?",
        keywords: ["preavis", "conge", "depart", "resiliation", "zone tendue", "lettre", "duree"],
        legislation: "Loi du 6 juillet 1989 (Article 15) / Loi Alur",
        summary: "À Cachan (zone tendue), le préavis de départ est réduit à 1 mois pour tous les logements, meublés ou non.",
        content: `
            <p>Pour quitter votre logement, vous devez donner congé au bailleur par lettre recommandée avec accusé de réception (LRAR), par acte d'huissier ou par remise en main propre contre récépissé.</p>
            
            <h4>📍 Cachan est en zone tendue : préavis de 1 mois</h4>
            <p>En règle générale, le préavis is de 3 mois pour un logement vide. Cependant, si le logement est situé en **zone tendue** (ce qui est le cas de la commune de **Cachan** et de l'ensemble de la métropole parisienne), le délai de préavis est ramené à <strong>1 mois</strong>.</p>
            
            <div class="wiki-info-box">
                <h4>💡 Bon à savoir :</h4>
                <p>Pour bénéficier du préavis réduit à 1 mois, vous devez **impérativement mentionner dans votre lettre de congé** que le logement est situé en zone tendue (en citant le décret n° 2013-392 du 10 mai 2013). Sans cette mention explicite et le justificatif, le bailleur peut tenter d'exiger 3 mois de loyer.</p>
            </div>
            
            <h4>🤝 Autres cas de préavis réduit à 1 mois (partout en France) :</h4>
            <ul>
                <li>Obtention d'un premier emploi, mutation professionnelle ou perte d'emploi.</li>
                <li>Bénéficiaire du RSA ou de l'Allocation Adulte Handicapé (AAH).</li>
                <li>Attribution d'un logement social.</li>
            </ul>
        `,
        actionText: "Générer un courrier",
        actionLink: "#/incidents"
    }
];
