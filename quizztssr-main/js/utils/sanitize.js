/**
 * sanitize.js — Désinfection HTML légère (sans dépendance externe)
 * Utilise le DOMParser natif du navigateur pour neutraliser les vecteurs XSS.
 * Phase 3.2 du plan d'implémentation — Audit TSSR Quiz
 */

'use strict';

/**
 * Balises et attributs autorisés dans le rendu des questions.
 * Tout ce qui n'est pas dans cette liste est supprimé.
 */
const ALLOWED_TAGS = new Set([
  'b', 'strong', 'i', 'em', 'u', 'br', 'span', 'code',
  'pre', 'p', 'ul', 'ol', 'li', 'table', 'thead', 'tbody',
  'tr', 'th', 'td', 'mark', 'small', 'hr', 'del', 'ins'
]);

const ALLOWED_ATTRS = new Set([
  'class', 'style', 'title', 'colspan', 'rowspan', 'data-idx', 'data-val'
]);

/**
 * Nettoie une chaîne HTML et retourne uniquement le markup sûr.
 * @param {string} dirty - Chaîne HTML potentiellement dangereuse.
 * @returns {string} HTML sécurisé.
 */
function safeHTML(dirty) {
  if (typeof dirty !== 'string') return String(dirty || '');

  // Utiliser DOMParser pour parser sans exécuter de scripts
  const parser = new DOMParser();
  const doc = parser.parseFromString(dirty, 'text/html');

  // Supprimer les éléments dangereux en profondeur
  _sanitizeNode(doc.body);

  return doc.body.innerHTML;
}

/**
 * Nettoyage récursif d'un nœud DOM.
 * @param {Element} node
 */
function _sanitizeNode(node) {
  const children = Array.from(node.childNodes);
  for (const child of children) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const tag = child.tagName.toLowerCase();

      // Supprimer les balises interdites (mais garder leur contenu textuel)
      if (!ALLOWED_TAGS.has(tag)) {
        // Remplacer par un fragment contenant les enfants (dépouillés)
        const frag = document.createDocumentFragment();
        while (child.firstChild) frag.appendChild(child.firstChild);
        node.replaceChild(frag, child);
        continue;
      }

      // Supprimer les attributs dangereux
      const attrsToRemove = [];
      for (const attr of Array.from(child.attributes)) {
        const attrName = attr.name.toLowerCase();
        // Supprimer les handlers d'événements et les URIs javascript:
        if (
          attrName.startsWith('on') ||
          (attrName === 'href' && attr.value.trim().toLowerCase().startsWith('javascript:')) ||
          (attrName === 'src' && attr.value.trim().toLowerCase().startsWith('javascript:')) ||
          !ALLOWED_ATTRS.has(attrName)
        ) {
          attrsToRemove.push(attr.name);
        }
      }
      attrsToRemove.forEach(a => child.removeAttribute(a));

      // Récurser sur les enfants
      _sanitizeNode(child);
    }
    // Les nœuds texte sont intrinsèquement sûrs — rien à faire
  }
}

/**
 * Encode le texte brut pour une insertion textContent sécurisée.
 * À utiliser quand on sait que le contenu ne contient PAS de HTML.
 * @param {string} text
 * @returns {string}
 */
function safeText(text) {
  if (typeof text !== 'string') return String(text || '');
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Exposition globale (compatible avec le code existant non-module)
window.safeHTML = safeHTML;
window.safeText = safeText;
