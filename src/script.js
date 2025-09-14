setTimeout(() => {
// i18n helper and settings
const t = (key) => (typeof chrome !== 'undefined' && chrome.i18n ? chrome.i18n.getMessage(key) : '') || key;
// settings
let enableExtension = false; // master toggle
let enableActionButton = false; // feature: action bar button
let enableMapsTab = false; // feature: top navigation "Maps" tab
let enableLocalActionTile = false; // feature: local actions tile
let actionBarObserver = null;

// builds URL search query from search params, handles different domains scenarios
function buildMapsLink() {
    const searchQuery = new URLSearchParams(window.location.search).get('q');
    const currentUrl = new URL(window.location);
    const hostname = currentUrl.hostname;
    const mapsHostname = hostname.startsWith('www.') ? hostname.replace('www.', 'maps.') : `maps.${hostname}`;
    return `${currentUrl.protocol}//${mapsHostname}/maps?q=${searchQuery}`;
}

// DOM elements are queried on demand (Google often A/B tests their UI and nodes can appear later)

// Using selector array as sometimes multiple different selectors are used for the same element depending on the variant rendered by Google
const smallMapThumbnailElement = ['.lu-fs', '.V1GY4c']; // small thumbnail with a map, usually on the right side

// We use this to avoid duplicate "Open in maps" buttons in certain situations
let alreadyHasMapsButtonAppended = false;

function hasMapTabAlreadyDisplayed(tabsContainer) {
    if (!tabsContainer) return false;
    const links = tabsContainer.getElementsByTagName('a');
    let tabAlreadyDisplayed = false;

    for (let i = 0; i < links.length; i++) {
        if (links[i].href.includes('/maps')) {
            tabAlreadyDisplayed = true;
            break;
        }
    }

    alreadyHasMapsButtonAppended = tabAlreadyDisplayed;
    return tabAlreadyDisplayed;
}

function removeActionButtons() {
    document.querySelectorAll('.open-in-maps-action-btn').forEach((el) => el.remove());
}

function removeLocalActionIcons() {
    document.querySelectorAll('.open-in-maps-local-action').forEach((el) => el.remove());
}

// Inject an action-style button next to the action bar (.Uekwlc.kHIBvd) instead of an overlay
function injectActionButtons() {
    if (!enableExtension || !enableActionButton) return; // Respect user settings

    const actionBars = document.querySelectorAll('.Uekwlc.kHIBvd');
    if (!actionBars || !actionBars.length) return;

    actionBars.forEach((bar) => {
        // Avoid duplicates
        if (bar.querySelector('.open-in-maps-action-btn')) return;

        // Try to find an existing action button to clone for consistent styling
        const sampleBtn = bar.querySelector('.aiNDEb');
        let newBtnWrapper;
        if (sampleBtn) {
            newBtnWrapper = sampleBtn.cloneNode(true);
            // Clean JS-specific attributes
            ['jscontroller','jsaction','jsdata','jsname','data-ved','data-hveid','data-ld','data-sfo','data-sm','data-sp'].forEach(attr => newBtnWrapper.removeAttribute(attr));
            newBtnWrapper.setAttribute('role', 'link');
            newBtnWrapper.setAttribute('tabindex', '0');
            newBtnWrapper.setAttribute('aria-label', t('openInMaps') || 'Open in Maps');

            // Update label text
            const labelContainer = newBtnWrapper.querySelector('.QuU3Wb.sjVJQd div');
            if (labelContainer) labelContainer.textContent = t('openInMaps') || 'Open in Maps';

            // Update icon
            const iconSpan = newBtnWrapper.querySelector('.d3o3Ad.gJdC8e.z1asCe.Fp7My');
            if (iconSpan) {
                const svg = iconSpan.querySelector('svg');
                if (svg) {
                    svg.innerHTML = '<path d="M12 2C8.686 2 6 4.686 6 8c0 4.5 6 12 6 12s6-7.5 6-12c0-3.314-2.686-6-6-6zm0 8.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"></path>';
                    svg.setAttribute('viewBox', '0 0 24 24');
                    svg.setAttribute('width', '20');
                    svg.setAttribute('height', '20');
                    svg.setAttribute('focusable', 'false');
                    svg.setAttribute('aria-hidden', 'true');
                }
            }
        } else {
            // Fallback: construct a minimal button structure mimicking styles
            newBtnWrapper = document.createElement('a');
            newBtnWrapper.className = 'VDgVie btku5b fCrZyc NQYJvc FR7ZSc qVhvac OJeuxf';
            const iconWrap = document.createElement('span');
            iconWrap.className = 'd3o3Ad gJdC8e z1asCe Fp7My';
            iconWrap.style.cssText = 'height:20px;line-height:20px;width:20px';
            iconWrap.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" focusable="false" aria-hidden="true"><path d="M12 2C8.686 2 6 4.686 6 8c0 4.5 6 12 6 12s6-7.5 6-12c0-3.314-2.686-6-6-6zm0 8.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"></path></svg>';
            const labelWrap = document.createElement('div');
            labelWrap.className = 'QuU3Wb sjVJQd';
            const labelDiv = document.createElement('div');
            labelDiv.textContent = t('openInMaps') || 'Open in Maps';
            labelWrap.appendChild(labelDiv);
            const iconOuter1 = document.createElement('div');
            iconOuter1.className = 'niO4u';
            const iconOuter2 = document.createElement('div');
            iconOuter2.className = 'kHtcsd';
            iconOuter2.appendChild(iconWrap);
            iconOuter1.appendChild(iconOuter2);
            newBtnWrapper.appendChild(iconOuter1);
            newBtnWrapper.appendChild(labelWrap);
        }

        newBtnWrapper.classList.add('open-in-maps-action-btn');

        // Navigate on click/enter
        const go = () => { window.location.href = buildMapsLink(); };
        newBtnWrapper.addEventListener('click', (e) => { e.preventDefault(); go(); });
        newBtnWrapper.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });

        // Append after existing action (share) for side-by-side layout
        bar.appendChild(newBtnWrapper);
    });
}

// Inject a tile in the local actions row (e.g., Strona/Trasa/Opinie/Udostępnij)
function injectLocalActionIcons() {
    if (!enableExtension || !enableLocalActionTile) return;

    // Rows that contain local action tiles
    const rows = document.querySelectorAll('.zhZ3gf');
    if (!rows || !rows.length) return;

    rows.forEach((row) => {
        // Avoid duplicates per row
        if (row.querySelector('.open-in-maps-local-action')) return;

        // Sample tile to clone for consistent layout
        const sampleTile = row.querySelector('.bkaPDb');
        if (!sampleTile) return;

        const labelText = (t('openInMaps') || 'Open in Maps').trim();

        // Clone the entire tile block
        const newTile = sampleTile.cloneNode(true);

        // Strip Google dynamic attrs to avoid their handlers
        const stripAttrs = (el) => {
            if (!el || !el.getAttributeNames) return;
            for (const attr of el.getAttributeNames()) {
                if (attr.startsWith('data-') || attr.startsWith('js') || attr === 'ssk' || attr === 'ping') {
                    el.removeAttribute(attr);
                }
            }
            el.childNodes && el.childNodes.forEach((child) => { if (child.nodeType === 1) stripAttrs(child); });
        };
        stripAttrs(newTile);

        // Ensure click target is an anchor
        let anchor = newTile.querySelector('a.n1obkb.mI8Pwc');
        if (!anchor) {
            const clickable = newTile.querySelector('.n1obkb.mI8Pwc') || newTile.querySelector('[role="button"].n1obkb');
            if (clickable) {
                const a = document.createElement('a');
                a.className = 'n1obkb mI8Pwc';
                while (clickable.firstChild) a.appendChild(clickable.firstChild);
                clickable.replaceWith(a);
                anchor = a;
            }
        }
        if (!anchor) return;

        anchor.setAttribute('href', buildMapsLink());
        anchor.setAttribute('rel', 'noopener');
        anchor.removeAttribute('role');
        anchor.removeAttribute('tabindex');

        // Update label
        const labelSpan = newTile.querySelector('.PbOY2e');
        if (labelSpan) labelSpan.textContent = labelText;

        // Update icon (map pin)
        const iconHolder = newTile.querySelector('.o7nARe');
        if (iconHolder) {
            let svg = iconHolder.querySelector('svg');
            if (!svg) {
                svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                iconHolder.appendChild(svg);
            }
            svg.setAttribute('viewBox', '0 0 24 24');
            svg.setAttribute('width', '24');
            svg.setAttribute('height', '24');
            svg.setAttribute('focusable', 'false');
            svg.setAttribute('aria-hidden', 'true');
            svg.innerHTML = '<path d="M12 2C8.686 2 6 4.686 6 8c0 4.5 6 12 6 12s6-7.5 6-12c0-3.314-2.686-6-6-6zm0 8.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" />';
        }

        newTile.classList.add('open-in-maps-local-action');
        row.appendChild(newTile);
    });
}

function startObservingActionBars() {
    if (actionBarObserver || !enableExtension || (!enableActionButton && !enableLocalActionTile)) return;
    try {
        actionBarObserver = new MutationObserver((mutations) => {
            let shouldInject = false;
            for (const m of mutations) {
                if (m.type === 'childList') {
                    m.addedNodes && m.addedNodes.forEach((n) => {
                        if (n.nodeType === 1) {
                            const el = /** @type {Element} */ (n);
                            if (el.classList && el.classList.contains('Uekwlc') && el.classList.contains('kHIBvd')) {
                                shouldInject = true;
                            } else if (el.querySelector && (el.querySelector('.Uekwlc.kHIBvd') || el.querySelector('.zhZ3gf'))) {
                                shouldInject = true;
                            }
                        }
                    });
                }
            }
            if (shouldInject) {
                // Debounce a bit to allow layout to settle
                setTimeout(() => { injectActionButtons(); injectLocalActionIcons(); }, 50);
            }
        });
        actionBarObserver.observe(document.documentElement || document.body, { childList: true, subtree: true });
    } catch (_) {
        // no-op
    }
}

function stopObservingActionBars() {
    if (actionBarObserver) {
        try { actionBarObserver.disconnect(); } catch (_) {}
        actionBarObserver = null;
    }
}

function injectTopUiAndThumbnails() {
    if (!enableExtension) return;
    // Query fresh each time in case DOM changed
    const tabsContainer = document.querySelector('.beZ0tf'); // tabs right below the search input
    const buttonContainer = document.querySelector('.IUOThf'); // round "bubble" buttons right below the search input
    // Recompute whether a Maps entry already exists (native or our injected)
    alreadyHasMapsButtonAppended = false;
    if (document.querySelector('.gmaps-ext-tab, .gmaps-ext-bubble')) {
        alreadyHasMapsButtonAppended = true;
    } else if (tabsContainer && hasMapTabAlreadyDisplayed(tabsContainer)) {
        // native Maps tab exists
        alreadyHasMapsButtonAppended = true;
    }
    // Tabs
    if (enableMapsTab && tabsContainer && !hasMapTabAlreadyDisplayed(tabsContainer)) {
        const tabButtonWrapper = document.createElement('div');
        tabButtonWrapper.classList.add('gmaps-ext-tab');
        tabButtonWrapper.role = 'listitem';
        const tabsButton = document.createElement('a');

        const mapSpan = document.createElement('span');
        mapSpan.classList.add('R1QWuf');
        // In the tabs we want short label like other tabs
        mapSpan.textContent = t('mapsTabLabel') || 'Maps';

        const innerDiv = document.createElement('div');
        innerDiv.classList.add('mXwfNd');
        innerDiv.appendChild(mapSpan);

        tabsButton.classList.add('C6AK7c');
        tabButtonWrapper.appendChild(tabsButton);
        tabsButton.appendChild(innerDiv);
        tabsButton && (tabsButton.href = buildMapsLink());
        tabsButton.classList.add('remove-text-underline');

        // Insert as third tab (after the second child)
        const children = tabsContainer.children;
        if (children.length >= 2) {
            tabsContainer.insertBefore(tabButtonWrapper, children[2]);
        } else {
            tabsContainer.appendChild(tabButtonWrapper);
        }
        alreadyHasMapsButtonAppended = true;
    }

    // Bubble button
    if (buttonContainer && !alreadyHasMapsButtonAppended) {
        const mapsButton = document.createElement('a');
        mapsButton.classList.add('gmaps-ext-bubble');
        mapsButton.classList.add('nPDzT', 'T3FoJb');

        const mapDiv = document.createElement('div');
        mapDiv.jsname = 'bVqjv';
        mapDiv.classList.add('GKS7s');

        const mapSpan = document.createElement('span');
        mapSpan.classList.add('FMKtTb', 'UqcIvb');
        mapSpan.jsname = 'pIvPIe';
        mapSpan.textContent = t('mapsBubbleLabel') || 'Maps';

        mapDiv.appendChild(mapSpan);
        mapsButton.appendChild(mapDiv);
        
        mapsButton && (mapsButton.href = buildMapsLink());
        buttonContainer.prepend(mapsButton);

        alreadyHasMapsButtonAppended = true;
    }

    // Thumbnail wrapper
    if (smallMapThumbnailElement.length) {
        setTimeout(() => {
            smallMapThumbnailElement.forEach((elementSelector) => {
                const targettedElement = document.querySelector(elementSelector);
                
                // check if element exists on the page
                if (targettedElement) {
                    const parent = targettedElement.parentNode;
                    if (parent && parent.tagName && parent.tagName.toLowerCase() === 'a') {
                        // update only if it's our wrapper
                        if (parent.classList && parent.classList.contains('gmaps-ext-thumb')) {
                            parent.href = buildMapsLink();
                        }
                    } else {
                        // otherwise create a new a tag with href attribute set to generated maps link, then wrap it around the element
                        const wrapperLink = document.createElement('a');
                        wrapperLink.classList.add('gmaps-ext-thumb');
                        wrapperLink.href = buildMapsLink();
                        targettedElement.parentNode.insertBefore(wrapperLink, targettedElement);
                        targettedElement.parentNode.removeChild(targettedElement);
                        wrapperLink.appendChild(targettedElement);
                    }
                }
            });
            
        }, 0)
    }
}

function removeTopUiAndThumbnails() {
    try {
        // Remove our Maps tab
        document.querySelectorAll('.gmaps-ext-tab').forEach((el) => el.remove());
        // Remove our bubble button
        document.querySelectorAll('.gmaps-ext-bubble').forEach((el) => el.remove());
        // Reset duplicate-prevention flag
        alreadyHasMapsButtonAppended = false;
        // Unwrap thumbnails
        document.querySelectorAll('a.gmaps-ext-thumb').forEach((anchor) => {
            const parent = anchor.parentNode;
            if (!parent) return;
            const children = Array.from(anchor.childNodes);
            children.forEach((child) => parent.insertBefore(child, anchor));
            parent.removeChild(anchor);
        });
    } catch (_) { /* no-op */ }
}

// Load settings
if (typeof chrome !== 'undefined' && chrome.storage) {
    const keys = ['enableExtension','enableActionButton','enableMapsTab','enableLocalActionTile'];
    const readAll = (cb) => {
        const done = (syncRes = {}, localRes = {}) => {
            const pick = (k, defVal = true) => (typeof syncRes[k] === 'boolean' ? syncRes[k] : (typeof localRes[k] === 'boolean' ? localRes[k] : defVal));
            cb({
                enableExtension: pick('enableExtension', true),
                enableActionButton: pick('enableActionButton', true),
                enableMapsTab: pick('enableMapsTab', true),
                enableLocalActionTile: pick('enableLocalActionTile', true),
            });
        };
        try {
            chrome.storage?.sync?.get(keys, (syncRes) => {
                chrome.storage?.local?.get(keys, (localRes) => done(syncRes, localRes));
            });
        } catch (_) {
            chrome.storage?.local?.get(keys, (localRes) => done({}, localRes));
        }
    };

    readAll((res) => {
        enableExtension = !!res.enableExtension;
        enableActionButton = !!res.enableActionButton;
        enableMapsTab = !!res.enableMapsTab;
        enableLocalActionTile = !!res.enableLocalActionTile;

    // Core UI
    if (enableExtension) injectTopUiAndThumbnails(); else removeTopUiAndThumbnails();
    // Feature UIs
    if (enableExtension && enableActionButton) injectActionButtons(); else removeActionButtons();
    if (enableExtension && !enableMapsTab) { document.querySelectorAll('.gmaps-ext-tab').forEach((el) => el.remove()); }
    if (enableExtension && enableLocalActionTile) injectLocalActionIcons(); else removeLocalActionIcons();
    if (enableExtension && (enableActionButton || enableLocalActionTile)) startObservingActionBars(); else stopObservingActionBars();

        // Note: do not write defaults from content script to avoid overriding user changes from popup/options
    });
    if (chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area !== 'sync' && area !== 'local') return;
            let affected = false;
            if (Object.prototype.hasOwnProperty.call(changes, 'enableExtension')) {
                enableExtension = Boolean(changes.enableExtension.newValue);
                affected = true;
            }
            if (Object.prototype.hasOwnProperty.call(changes, 'enableActionButton')) {
                enableActionButton = Boolean(changes.enableActionButton.newValue);
                affected = true;
            }
            if (Object.prototype.hasOwnProperty.call(changes, 'enableMapsTab')) {
                enableMapsTab = Boolean(changes.enableMapsTab.newValue);
                affected = true;
            }
            if (Object.prototype.hasOwnProperty.call(changes, 'enableLocalActionTile')) {
                enableLocalActionTile = Boolean(changes.enableLocalActionTile.newValue);
                affected = true;
            }

            if (!affected) return;

            if (!enableExtension) {
                // Master off: remove everything
                removeActionButtons();
                removeLocalActionIcons();
                removeTopUiAndThumbnails();
                stopObservingActionBars();
            } else {
                // Master on: keep top UI, then adjust features individually
                injectTopUiAndThumbnails();
                if (enableActionButton) injectActionButtons(); else removeActionButtons();
                if (!enableMapsTab) document.querySelectorAll('.gmaps-ext-tab').forEach((el) => el.remove());
                if (enableLocalActionTile) injectLocalActionIcons(); else removeLocalActionIcons();
                if (enableActionButton || enableLocalActionTile) startObservingActionBars(); else stopObservingActionBars();
            }
        });
    }
} else {
    // Fallback
    enableExtension = true; enableActionButton = true; enableMapsTab = true; enableLocalActionTile = true;
    injectTopUiAndThumbnails();
    injectActionButtons();
    injectLocalActionIcons();
    startObservingActionBars();
}
}, 250);
