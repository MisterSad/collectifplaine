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
     * Génère une mise en demeure formelle pour le bailleur
     */
    async function generateMiseEnDemeure(formData) {
        if (!window.jspdf) {
            alert("La librairie d'export PDF n'est pas encore chargée.");
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

        const bodyText = `
Madame, Monsieur,

En qualité de locataire au sein de la résidence de l'Avenue de la Division Leclerc (Bâtiment ${formData.entrance}), je vous adresse la présente mise en demeure concernant le défaut d'entretien chronique de l'ascenseur de mon immeuble.

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

    return {
        exportElevatorHistory,
        generateMiseEnDemeure
    };
})();
