#!/bin/bash

# Script pour mettre à jour les noms des modèles dans librechat.yaml
# Usage: ./update_model_names.sh

set -e

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

CONFIG_FILE="/opt/apps/sovereignchat/librechat.yaml"

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}     📝 MISE À JOUR DES NOMS DE MODÈLES     ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${CYAN}Configuration actuelle des modèles :${NC}"
echo ""

# Extraire et afficher les noms actuels
echo -e "${YELLOW}Modèles disponibles :${NC}"
grep -A 3 "models:" "$CONFIG_FILE" | grep "- " | sed 's/.*- "/  • /' | sed 's/"//'

echo ""
echo -e "${YELLOW}Noms actuels :${NC}"
grep -A 10 "modelNames:" "$CONFIG_FILE" | grep '".*":' | while IFS= read -r line; do
    MODEL_ID=$(echo "$line" | cut -d'"' -f2)
    MODEL_NAME=$(echo "$line" | cut -d'"' -f4)
    echo -e "  • ${CYAN}$MODEL_ID${NC}"
    echo -e "    → ${GREEN}$MODEL_NAME${NC}"
done

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}Pour modifier un nom de modèle :${NC}"
echo ""
echo -e "1. Ouvrir le fichier : ${CYAN}nano $CONFIG_FILE${NC}"
echo -e "2. Chercher la section ${CYAN}modelNames:${NC} (ligne ~174)"
echo -e "3. Modifier le nom entre guillemets"
echo -e "4. Sauvegarder (Ctrl+O, Enter, Ctrl+X)"
echo ""

echo -e "${YELLOW}Exemple :${NC}"
echo -e '  modelNames:'
echo -e '    "gemma3:4b": "Mon Nouveau Nom"'
echo ""

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Voulez-vous ouvrir le fichier maintenant ? (y/n)${NC}"
read -r RESPONSE

if [[ "$RESPONSE" == "y" ]] || [[ "$RESPONSE" == "Y" ]]; then
    # Ouvrir à la ligne des modelNames
    nano +174 "$CONFIG_FILE"
    
    echo ""
    echo -e "${GREEN}✅ Fichier modifié${NC}"
    echo -e "${YELLOW}Redémarrage du service pour appliquer les changements...${NC}"
    
    # Trouver et redémarrer le conteneur
    CONTAINER=$(docker ps --filter "name=api-" --format "{{.Names}}" | head -1)
    if [ -n "$CONTAINER" ]; then
        docker restart "$CONTAINER" > /dev/null 2>&1
        echo -e "${GREEN}✅ Service redémarré${NC}"
        echo -e "${BLUE}Les nouveaux noms seront visibles dans quelques secondes sur l'interface${NC}"
    else
        echo -e "${YELLOW}⚠️  Conteneur non trouvé - redémarrez manuellement${NC}"
    fi
else
    echo -e "${CYAN}Pour éditer manuellement :${NC}"
    echo -e "  ${BLUE}nano +174 $CONFIG_FILE${NC}"
fi

echo ""
echo -e "${GREEN}💡 Astuce : Les changements sont appliqués automatiquement après redémarrage${NC}"
