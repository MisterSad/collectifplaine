/**
 * @fileoverview Générateur de documents PDF juridiques (Mises en demeure, Historiques, Pétitions).
 * Utilise jsPDF avec une gestion propre du chargement asynchrone.
 */

import { formatDateFR } from '../../utils/date-helpers.js';
import { Auth } from '../../core/auth.js';

function getJsPdfDoc() {
    const jsPDFClass = window.jspdf?.jsPDF || window.jsPDF;
    if (!jsPDFClass) {
        throw new Error("Bibliothèque jsPDF non chargée.");
    }
    return new jsPDFClass({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
    });
}

/**
 * Génère une lettre officielle de mise en demeure au format PDF.
 * @param {Object} params
 * @param {string} params.entrance
 * @param {number} params.downtimeDays
 * @param {Array<Object>} params.reports
 */
export function generateMiseEnDemeure({ entrance, downtimeDays, reports = [] }) {
    const doc = getJsPdfDoc();
    const profile = Auth.getProfile();
    const authorName = profile?.first_name && profile?.last_name 
        ? `${profile.first_name} ${profile.last_name}`
        : profile?.username || "Le Collectif des Locataires";
    const userApt = profile?.apartment ? `Appartement ${profile.apartment}` : "";

    // En-tête Expéditeur
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(authorName, 20, 25);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Résidence La Plaine - Entrée ${entrance}`, 20, 31);
    if (userApt) doc.text(userApt, 20, 36);
    doc.text("94230 Cachan", 20, userApt ? 41 : 36);

    // Destinataire
    doc.setFont("helvetica", "bold");
    doc.text("VALDÉVY - Direction Générale", 120, 50);
    doc.setFont("helvetica", "normal");
    doc.text("Service Gestion Locative & Maintenance", 120, 56);
    doc.text("94230 Cachan", 120, 61);

    // Date & Lieu
    doc.text(`Fait à Cachan, le ${formatDateFR(new Date(), false)}`, 20, 75);

    // Objet
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`OBJET : MISE EN DEMEURE - Rétablissement immédiat de l'ascenseur (Entrée ${entrance})`, 20, 85);
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.text("Lettre recommandée avec accusé de réception (LRAR) / Document à valeur probante", 20, 91);

    // Corps du texte
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const bodyText = `
Madame, Monsieur le Bailleur,

En tant que locataires résidant à l'entrée ${entrance} de la résidence, nous vous mettons formellement en demeure par la présente de procéder aux réparations nécessaires et urgentes de l'ascenseur de notre bâtiment.

En effet, nous constatons un arrêt prolongé et répété du service de l'ascenseur, totalisant un cumul d'indisponibilité de ${downtimeDays} jour(s) au cours des dernières semaines.

RAPPEL DES OBLIGATIONS LÉGALES :
Conformément à l'article 6 de la Loi n° 89-462 du 6 juillet 1989 et à l'article 1719 du Code civil, le bailleur est tenu d'assurer au locataire la jouissance paisible du logement et d'entretenir les locaux en état de servir à l'usage prévu par le contrat, en maintenant en état de fonctionnement les équipements communs.

Cette privation d'ascenseur cause un préjudice quotidien majeur aux résidents (personnes âgées, familles avec enfants en bas âge, personnes à mobilité réduite ou transport de charges).

PAR CONSÉQUENT :
Nous vous mettons en demeure de faire intervenir l'ascensoriste sous 48 heures ouvrées afin de rétablir définitivement le fonctionnement de l'appareil.

À défaut de résolution rapide, nous nous réservons le droit de saisir la Commission Départementale de Conciliation (CDC) ainsi que le Juge des Contentieux de la Protection du Tribunal Judiciaire afin de solliciter la consignation des loyers et une indemnisation pour trouble de jouissance.

Dans cette attente, veuillez agréer, Madame, Monsieur, nos salutations distinguées.
    `;

    const lines = doc.splitTextToSize(bodyText.trim(), 170);
    doc.text(lines, 20, 102);

    // Signature
    doc.setFont("helvetica", "bold");
    doc.text("Le Collectif des Locataires de La Plaine", 20, 245);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Document généré collectivement via l'application Collectif Plaine", 20, 280);

    doc.save(`Mise_en_demeure_Ascenseur_Entree_${entrance}.pdf`);
}

/**
 * Exporte l'historique complet des pannes d'un ascenseur au format PDF.
 * @param {Object} elevator
 */
export function exportElevatorHistory(elevator) {
    const doc = getJsPdfDoc();
    const id = elevator.id;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(`Rapport Technique d'Indisponibilité - Entrée ${id}`, 20, 25);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Document officiel du Collectif Plaine • Émis le ${formatDateFR(new Date())}`, 20, 32);

    doc.setFillColor(245, 247, 250);
    doc.roundedRect(20, 40, 170, 22, 3, 3, 'F');

    doc.setFont("helvetica", "bold");
    doc.text(`Statut actuel : ${elevator.status === 'en_service' ? 'En Service' : 'En Panne'}`, 25, 49);
    doc.text(`Cumul d'indisponibilité enregistré : ${elevator.downtimeHours} heures (${elevator.downtimeDays} jours)`, 25, 56);

    doc.setFontSize(12);
    doc.text("Historique des événements et signalements :", 20, 75);

    let y = 85;
    const history = elevator.history || [];
    const sorted = [...history].sort((a, b) => new Date(b.created_at || b.timestamp).getTime() - new Date(a.created_at || a.timestamp).getTime());

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Date", 20, y);
    doc.text("Événement", 65, y);
    doc.text("Auteur / Note", 120, y);
    y += 4;
    doc.line(20, y, 190, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    for (const h of sorted.slice(0, 25)) {
        if (y > 270) {
            doc.addPage();
            y = 25;
        }

        const dStr = formatDateFR(h.created_at || h.timestamp, false);
        const statusLabel = h.status === 'en_service' ? 'Remise en service' : 'Panne signalée';
        const details = h.details ? h.details.substring(0, 45) : (h.user || 'Locataire');

        doc.text(dStr, 20, y);
        doc.text(statusLabel, 65, y);
        doc.text(details, 120, y);
        y += 7;
    }

    doc.save(`Historique_Pannes_Entree_${id}.pdf`);
}

/**
 * Exporte la liste certifiée des signatures d'une pétition (Réservé admin).
 * @param {Object} petition
 */
export function exportPetitionSignatures(petition) {
    const doc = getJsPdfDoc();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(`Pétition Collective : ${petition.title}`, 20, 22);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Registre des signatures citoyennes • Collectif Plaine • ${formatDateFR(new Date())}`, 20, 30);

    const descLines = doc.splitTextToSize(petition.description, 170);
    doc.setFont("helvetica", "italic");
    doc.text(descLines, 20, 38);

    let y = 42 + descLines.length * 5;

    doc.setFont("helvetica", "bold");
    doc.text(`Total des signatures recueillies : ${petition.signatures_count || 0}`, 20, y);
    y += 10;

    doc.setFontSize(9);
    doc.text("N°", 20, y);
    doc.text("Résident", 30, y);
    doc.text("Bâtiment", 90, y);
    doc.text("Date de signature", 130, y);
    y += 4;
    doc.line(20, y, 190, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    const signatures = petition.signatures || [];
    let index = 1;

    for (const sig of signatures) {
        if (y > 270) {
            doc.addPage();
            y = 25;
        }

        const res = sig.residents || {};
        const name = res.first_name && res.last_name ? `${res.first_name} ${res.last_name}` : (res.username || "Voisin");
        const entrance = res.entrance ? `Bâtiment ${res.entrance}` : "Résident";
        const dateStr = formatDateFR(sig.created_at, true);

        doc.text(String(index), 20, y);
        doc.text(name, 30, y);
        doc.text(entrance, 90, y);
        doc.text(dateStr, 130, y);

        y += 6;
        index++;
    }

    doc.save(`Signatures_Petition_${petition.id.substring(0, 8)}.pdf`);
}
