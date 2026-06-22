/**
 * Générateur de documents légaux (Mise en Demeure & Historique)
 * Utilise jsPDF pour exporter des PDFs côté client.
 */

window.LegalGenerator = (() => {
    
    /**
     * Formate une date en JJ/MM/AAAA
     */
    function formatDate(ms) {
        if (!ms) return "Date inconnue";
        const d = new Date(ms);
        return d.toLocaleDateString("fr-FR");
    }

    /**
     * Exporte l'historique complet d'un ascenseur au format PDF
     */
    async function exportElevatorHistory(elevatorId) {
        if (!window.jspdf) {
            alert("La librairie d'export PDF n'est pas encore chargée.");
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        const elevator = Store.getElevatorById(elevatorId);
        if (!elevator) return;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.text(`Historique des pannes - Ascenseur N° ${elevatorId}`, 15, 20);
        
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.text("Édité le : " + new Date().toLocaleDateString('fr-FR'), 15, 30);
        doc.text("Par le Collectif Plaine - Résidence Division Leclerc, Cachan", 15, 36);

        // Statistiques globales
        doc.setFont("helvetica", "bold");
        doc.text("Bilan actuel :", 15, 50);
        doc.setFont("helvetica", "normal");
        doc.text(`Jours de pannes cumulés : ${elevator.downtimeDays} jours`, 15, 58);

        // Historique
        let yPos = 75;
        doc.setFont("helvetica", "bold");
        doc.text("Historique des événements (30 derniers jours) :", 15, yPos);
        yPos += 10;
        doc.setFont("helvetica", "normal");

        const history = [...elevator.history].sort((a, b) => b.timestamp - a.timestamp); // Plus récent d'abord

        if (history.length === 0) {
            doc.text("Aucun événement répertorié.", 15, yPos);
        } else {
            history.forEach((event, index) => {
                if (yPos > 270) {
                    doc.addPage();
                    yPos = 20;
                }
                const dateStr = formatDate(event.timestamp);
                let statusLabel = event.status === 'en_panne' ? 'Panne signalée' : (event.status === 'en_maintenance' ? 'Mise en maintenance' : 'Remise en service');
                
                doc.setFont("helvetica", "bold");
                doc.text(`${dateStr} - ${statusLabel}`, 15, yPos);
                yPos += 6;
                doc.setFont("helvetica", "normal");
                
                // Découpage du texte pour éviter qu'il ne déborde
                const lines = doc.splitTextToSize(event.notes || "Aucun commentaire.", 180);
                doc.text(lines, 15, yPos);
                yPos += (lines.length * 6) + 6;
            });
        }

        doc.save(`Historique_Ascenseur_${elevatorId}_CollectifPlaine.pdf`);
    }

    /**
     * Charge dynamiquement jsPDF si non présent
     */
    function loadJsPdf() {
        return new Promise((resolve, reject) => {
            if (window.jspdf) {
                resolve(window.jspdf);
                return;
            }
            const script = document.createElement('script');
            script.src = 'js/jspdf.umd.min.js';
            script.onload = () => {
                if (window.jspdf) resolve(window.jspdf);
                else reject(new Error("jsPDF n'a pas pu être initialisé"));
            };
            script.onerror = () => reject(new Error("Erreur de chargement de jsPDF"));
            document.head.appendChild(script);
        });
    }

    /**
     * Génère une mise en demeure formelle pour le bailleur
     */
    async function generateMiseEnDemeure(formData) {
        try {
            await loadJsPdf();
        } catch (e) {
            alert("La librairie d'export PDF n'est pas encore chargée ou est bloquée.");
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Entête locataire
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text(`${formData.firstname} ${formData.lastname}`, 15, 20);
        doc.setFont("helvetica", "normal");
        doc.text(`Bâtiment ${formData.entrance}, Appt ${formData.apartment}`, 15, 26);
        doc.text("Avenue de la Division Leclerc", 15, 32);
        doc.text("94230 CACHAN", 15, 38);

        // Destinataire (Valdévy)
        doc.text("À l'attention de VALDÉVY", 120, 50);
        doc.text("Direction du Patrimoine", 120, 56);
        doc.text("4 allée Pierre-de-Montreuil", 120, 62);
        doc.text("94230 CACHAN", 120, 68);

        doc.text("Objet : MISE EN DEMEURE - Défaut d'entretien des ascenseurs", 15, 85);
        
        doc.setFont("helvetica", "bold");
        doc.text("Lettre recommandée avec avis de réception", 15, 95);

        doc.setFont("helvetica", "normal");
        let yPos = 110;
        const dateJour = new Date().toLocaleDateString('fr-FR');
        doc.text(`Fait à Cachan, le ${dateJour}`, 15, yPos);
        yPos += 15;

        let incidentText = "le défaut d'entretien chronique de l'ascenseur de mon immeuble";
        if (formData.outage && formData.outage !== "general") {
            incidentText = `la panne de l'ascenseur survenue le ${formData.outage} et qui perdure de manière inacceptable`;
        }

        const bodyText = `
Madame, Monsieur,

En qualité de locataire au sein de la résidence de l'Avenue de la Division Leclerc (Bâtiment ${formData.entrance}), je vous adresse la présente mise en demeure concernant ${incidentText}.

Conformément à l'article 6 de la loi n° 89-462 du 6 juillet 1989, il vous incombe en tant que bailleur d'entretenir les locaux et équipements d'usage commun afin de garantir une jouissance paisible des lieux loués. Or, nous subissons des pannes récurrentes qui entravent gravement notre quotidien.

Les données recueillies via l'application du Collectif Plaine attestent d'une indisponibilité inacceptable de ce service, pour lequel nous payons pourtant des charges régulières.

En conséquence, je vous mets en demeure de procéder, dans un délai de 8 jours à compter de la réception de ce courrier, à la réparation définitive de cet équipement ou à son remplacement si sa vétusté le justifie.

À défaut de régularisation dans ce délai, je me réserve le droit, conjointement avec les autres locataires du Collectif Plaine, de saisir le tribunal judiciaire afin de demander une injonction de faire, ainsi qu'une indemnisation pour trouble de jouissance sous forme de diminution du loyer.

Dans l'attente d'une intervention rapide de vos services, je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.
        `;

        const lines = doc.splitTextToSize(bodyText.trim(), 180);
        doc.text(lines, 15, yPos);

        doc.save(`Mise_En_Demeure_Valdevy_Bat${formData.entrance}_${formData.lastname}.pdf`);
    }

    /**
     * Exporte une pétition et la liste complète de ses signatures au format PDF
     */
    async function exportPetitionSignatures(petitionId) {
        try {
            await loadJsPdf();
        } catch (e) {
            alert("La librairie d'export PDF n'est pas encore chargée ou est bloquée.");
            return;
        }

        // Vérification de sécurité (seul l'administrateur a le droit d'exporter)
        const loggedTenant = Security.getLoggedInTenant();
        const isAdmin = loggedTenant && loggedTenant.username === 'Tavares50';
        if (!isAdmin) {
            alert("Accès refusé : Seul l'administrateur peut exporter les signatures.");
            return;
        }

        const petitions = Store.getPetitions();
        const petition = petitions.find(p => String(p.id) === String(petitionId));
        if (!petition) {
            alert("Pétition introuvable.");
            return;
        }

        // Vérification de sécurité sur le délai de mise en ligne (30 jours)
        const deadline = new Date(new Date(petition.created_at).getTime() + 30 * 24 * 60 * 60 * 1000);
        const isEnded = new Date() >= deadline;
        if (!isEnded) {
            alert("Accès refusé : La pétition est encore en cours et ne peut pas être exportée.");
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Titre de la pétition
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        const titleLines = doc.splitTextToSize(petition.title, 180);
        doc.text(titleLines, 15, 20);
        
        let yPos = 20 + (titleLines.length * 7);

        // Métadonnées
        doc.setFontSize(10);
        doc.setFont("helvetica", "italic");
        doc.text(`Lancée le : ${formatDate(petition.created_at)}`, 15, yPos);
        yPos += 6;
        doc.text(`Nombre de signatures collectées : ${petition.petition_signatures ? petition.petition_signatures.length : 0}`, 15, yPos);
        yPos += 10;

        // Description
        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        const descLines = doc.splitTextToSize(petition.description || "Aucune description.", 180);
        doc.text(descLines, 15, yPos);
        yPos += (descLines.length * 6) + 15;

        // Ligne de séparation
        doc.setDrawColor(200, 200, 200);
        doc.line(15, yPos - 5, 195, yPos - 5);

        // Titre de la liste des signatures
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("Liste des signataires :", 15, yPos);
        yPos += 10;

        // Liste des signatures
        const signatures = petition.petition_signatures || [];
        if (signatures.length === 0) {
            doc.setFont("helvetica", "italic");
            doc.setFontSize(10);
            doc.text("Aucune signature enregistrée pour le moment.", 15, yPos);
        } else {
            // Entête du tableau
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.text("Date", 15, yPos);
            doc.text("Signataire (Nom / Pseudo)", 55, yPos);
            doc.text("Bâtiment", 135, yPos);
            doc.text("Statut", 175, yPos);
            
            yPos += 6;
            doc.line(15, yPos - 2, 195, yPos - 2);
            doc.setFont("helvetica", "normal");

            // Trier les signatures par date (plus anciennes d'abord)
            const sortedSigs = [...signatures].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

            sortedSigs.forEach((sig) => {
                if (yPos > 275) {
                    doc.addPage();
                    yPos = 20;
                    
                    // Ré-entête sur la nouvelle page
                    doc.setFont("helvetica", "bold");
                    doc.text("Date", 15, yPos);
                    doc.text("Signataire (Nom / Pseudo)", 55, yPos);
                    doc.text("Bâtiment", 135, yPos);
                    doc.text("Statut", 175, yPos);
                    
                    yPos += 6;
                    doc.line(15, yPos - 2, 195, yPos - 2);
                    doc.setFont("helvetica", "normal");
                }

                const sigDate = formatDate(sig.created_at);
                
                // Récupération des infos du résident
                let displayName = "Résident anonyme";
                let entranceName = "Non spécifié";
                if (sig.residents) {
                    const res = sig.residents;
                    if (res.first_name || res.last_name) {
                        displayName = `${res.first_name || ""} ${res.last_name || ""}`.trim();
                    } else {
                        displayName = res.username || "Résident anonyme";
                    }
                    entranceName = res.entrance ? `N° ${res.entrance}` : "Non spécifié";
                }

                doc.text(sigDate, 15, yPos);
                
                // Limiter la taille du nom pour éviter les débordements
                const nameLines = doc.splitTextToSize(displayName, 75);
                doc.text(nameLines[0], 55, yPos); // Affiche la première ligne
                
                doc.text(entranceName, 135, yPos);
                doc.text("Signé", 175, yPos);

                yPos += 8;
            });
        }

        // Export du document
        const fileTitle = petition.title.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
        doc.save(`Petition_${fileTitle}_Signatures.pdf`);
    }

    return {
        exportElevatorHistory,
        generateMiseEnDemeure,
        exportPetitionSignatures
    };
})();
