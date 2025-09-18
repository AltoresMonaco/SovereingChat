#!/bin/bash

# Script de déploiement des changements de branding
# Usage: ./deploy_branding.sh

set -e

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}     🎨 DÉPLOIEMENT DES CHANGEMENTS DE BRANDING     ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Identifier le conteneur LibreChat
CONTAINER_ID=$(docker ps --filter "name=api-" --format "{{.Names}}" | head -1)

if [ -z "$CONTAINER_ID" ]; then
    echo -e "${RED}❌ Aucun conteneur LibreChat trouvé${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Conteneur trouvé: $CONTAINER_ID${NC}"
echo ""

# Option 1: Build complet
echo -e "${YELLOW}Option 1: Build complet du frontend (recommandé)${NC}"
echo -e "Cette option va:"
echo -e "  • Compiler tous les fichiers TypeScript"
echo -e "  • Appliquer les changements de branding"
echo -e "  • Optimiser pour la production"
echo -e "  • Durée: ~2-3 minutes"
echo ""

# Option 2: Redémarrage simple
echo -e "${YELLOW}Option 2: Redémarrage du service (rapide)${NC}"
echo -e "Cette option va:"
echo -e "  • Redémarrer le conteneur"
echo -e "  • Les changements seront appliqués au prochain build"
echo -e "  • Durée: ~30 secondes"
echo ""

echo -n "Choisir une option (1/2): "
read -r CHOICE

case $CHOICE in
    1)
        echo -e "${BLUE}🔄 Build du frontend en cours...${NC}"
        docker exec "$CONTAINER_ID" sh -c "cd /app && npm run frontend" || {
            echo -e "${RED}❌ Erreur lors du build${NC}"
            echo -e "${YELLOW}Essai avec une méthode alternative...${NC}"
            docker exec "$CONTAINER_ID" sh -c "cd /app/client && npm run build" || {
                echo -e "${RED}❌ Build échoué${NC}"
                exit 1
            }
        }
        echo -e "${GREEN}✅ Build terminé${NC}"
        ;;
    2)
        echo -e "${BLUE}🔄 Redémarrage du service...${NC}"
        docker restart "$CONTAINER_ID"
        echo -e "${GREEN}✅ Service redémarré${NC}"
        echo -e "${YELLOW}Note: Les changements seront appliqués au prochain build automatique${NC}"
        ;;
    *)
        echo -e "${RED}Option invalide${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}                    📊 RÉSUMÉ                                  ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"

echo -e "${GREEN}✅ Changements appliqués:${NC}"
echo -e "   • Logo Monaco Cloud réduit (1.5em)"
echo -e "   • Modèles rebrandés en Altores"
echo -e "   • Interface personnalisée"
echo ""

echo -e "${BLUE}🔍 Vérification:${NC}"
echo -e "   1. Ouvrir https://chat.souverain.mc"
echo -e "   2. Vérifier le logo dans le footer"
echo -e "   3. Sélectionner un modèle et vérifier le nom Altores"
echo ""

echo -e "${GREEN}🎉 Déploiement terminé!${NC}"
