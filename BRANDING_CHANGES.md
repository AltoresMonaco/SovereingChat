# 🎨 Modifications de Branding - SovereignChat

## ✅ Changements effectués

### 1. Logo Monaco Cloud dans le Footer
**Fichier modifié:** `client/src/components/Chat/Footer.tsx`
- **Avant:** Taille du logo `h-[2.2em]`
- **Après:** Taille réduite à `h-[1.5em]`
- **Résultat:** Le logo Monaco Cloud est maintenant plus discret dans le footer

### 2. Rebranding des Modèles - Configuration via librechat.yaml

Les noms des modèles sont maintenant **entièrement gérés via le fichier librechat.yaml**.

**Configuration actuelle dans librechat.yaml:**
```yaml
modelNames:
  "lucifers/Polaris-4B-Preview.Q8_0:latest": "Altores Sovereign Intelligence Reasoning 1.0"
  "llava:latest": "Altores Sovereign Intelligence Vision"
  "gemma3:4b": "Altores Sovereign Intelligence 3.0"
```

## 📋 Système de Naming Dynamique

Le système utilise maintenant **directement les noms définis dans librechat.yaml** :

| Nom Technique (ID) | Nom Affiché (depuis librechat.yaml) |
|-------------------|--------------------------------------|
| lucifers/Polaris-4B-Preview.Q8_0:latest | Altores Sovereign Intelligence Reasoning 1.0 |
| llava:latest | Altores Sovereign Intelligence Vision |
| gemma3:4b | Altores Sovereign Intelligence 3.0 |

## 🔄 Comment modifier les noms

Pour changer le nom d'un modèle :

1. **Ouvrir** `/opt/apps/sovereignchat/librechat.yaml`
2. **Modifier** la section `modelNames` sous l'endpoint Ollama :
   ```yaml
   modelNames:
     "gemma3:4b": "Nouveau nom pour ce modèle"
   ```
3. **Redémarrer** le service pour appliquer les changements

## ✨ Avantages de cette approche

- ✅ **Configuration centralisée** : Un seul fichier à modifier
- ✅ **Mise à jour dynamique** : Les changements dans librechat.yaml sont automatiquement reflétés
- ✅ **Pas de code en dur** : Plus besoin de modifier le code source
- ✅ **Simplicité** : Gestion facile via YAML

## 🚀 Appliquer les changements

Pour appliquer les modifications après un changement dans librechat.yaml :

```bash
# Option 1: Redémarrer le conteneur
docker restart api-lccss40gg8s8k4w0kc0c0484-002601709977

# Option 2: Utiliser le script de déploiement
./deploy_branding.sh
```

## 📝 Notes importantes

- Les noms techniques restent utilisés pour l'API Ollama
- Seule l'interface utilisateur affiche les noms personnalisés
- La configuration est chargée au démarrage de l'application
- Aucun modèle supplémentaire n'est ajouté - seuls ceux définis dans librechat.yaml sont utilisés