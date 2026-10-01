// Re-introduces Google Maps links on the search results page.
//
// Timing strategy (fix for tabs-row layout shift / misclick):
// the content script runs at document_start (see manifest.json) and inserts
// the "Open in Maps" tab via MutationObserver as soon as Google renders the
// tabs container -- ideally before first paint, so the surrounding tabs
// ("Images", ...) never move under the user's cursor.
// A 2s periodic check acts as fallback for any render pattern the observer
// filter misses; both paths are idempotent.
(function () {
'use strict';

// builds URL search query from search params, handles different domains scenarios
// Returns null when there is no query (e.g. homepage, consent) so callers skip injection.
function buildMapsLink() {
    const searchQuery = new URLSearchParams(window.location.search).get('q');
    if (!searchQuery) {
        return null;
    }
    const currentUrl = new URL(window.location);
    const hostname = currentUrl.hostname;
    const mapsHostname = hostname.startsWith('www.') ? hostname.replace('www.', 'maps.') : `maps.${hostname}`;
    return `${currentUrl.protocol}//${mapsHostname}/maps?q=${encodeURIComponent(searchQuery)}`;
}

// Selectors (all of these can possibly exist due to google's AB testing changing their UI)
const TABS_SELECTOR = '.beZ0tf'; // tabs right below the search input
const BUTTONS_SELECTOR = '.IUOThf'; // round "bubble" buttons right below the search input

// Using selector array as sometimes multiple different selectors are used for the same element depending on the variant rendered by Google
const smallMapThumbnailElement = ['.lu-fs', '.V1GY4c']; // small thumbnail with a map, usually on the right side
const addressMapSelector = '.lu_map_section';
const placesMapSelector = '.S7dMR';
const countryMapSelector = '.zMVLkf';

// Marker attributes so repeated observer callbacks stay idempotent.
const TAB_MARKER = 'data-readd-maps-tab';
const ROUND_BUTTON_MARKER = 'data-readd-maps-round-btn';

// Every container the observer cares about: tabs row plus late non-tabs
// content (thumbnails, map overlays, round buttons).
const WATCH_SELECTOR = [TABS_SELECTOR, BUTTONS_SELECTOR,
    ...smallMapThumbnailElement, addressMapSelector, placesMapSelector, countryMapSelector].join(',');

// We use this to avoid duplicate "Open in maps" buttons in certain situations.
// Derived from the DOM whenever the round-button path runs, so a Google
// re-render that removes our button cannot leave a stale `true` behind.
let alreadyHasMapsButtonAppended = false;

function refreshAppendedFlagFromDom() {
    if (!document.querySelector(`[${TAB_MARKER}]`) && !document.querySelector(`[${ROUND_BUTTON_MARKER}]`)) {
        alreadyHasMapsButtonAppended = false;
    }
}

function hasMapTabAlreadyDisplayed(tabsContainer) {
    // Same scoping: only direct tab children count, not stray /maps links.
    const children = tabsContainer.children;
    for (let i = 0; i < children.length; i++) {
        const link = children[i].querySelector ? children[i].querySelector('a') : null;
        if (link && link.href.includes('/maps')) {
            return true;
        }
    }
    return false;
}

// Same scan but ignoring our own injected tab: detects a NATIVE Maps tab
// that arrives after ours so we can withdraw ours instead of duplicating.
function hasNativeMapTab(tabsContainer) {
    // Scope to direct tab children only: a /maps link elsewhere on the
    // results page (knowledge panel, footer) must not count as a tab.
    const children = tabsContainer.children;
    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child.hasAttribute && child.hasAttribute(TAB_MARKER)) {
            continue;
        }
        const link = child.querySelector ? child.querySelector('a') : null;
        if (link && link.href.includes('/maps')) {
            return true;
        }
    }
    return false;
}

// Tabs work only matters on search results pages; everywhere else the
// observer callback and periodic check must stay a true no-op (no DOM scan).
// Pathname alone is not enough: a search started from the homepage (/webhp
// or /) keeps that path while results render, so also accept search query
// params (?q=, tbm, udm). Pure URL check, no DOM cost.
function isSearchPage() {
    const path = window.location.pathname;
    if (path === '/search' || path.startsWith('/search/')) {
        return true;
    }
    // Homepage-like paths only count with an actual search in the URL:
    // a bare homepage must stay a true no-op (no observer, no interval).
    try {
        const params = new URLSearchParams(window.location.search);
        if (!params.has('q') && !params.has('tbm') && !params.has('udm')) {
            return false;
        }
        return path === '/webhp' || path === '/' || path === '/imghp';
    } catch (e) {
        return false;
    }
}

// Anchor labels identifying the "all results" tab across locales.
// Used to position our tab right after it instead of a brittle child index.
// Coverage is best-effort: unknown locales fall back to the Images-tab
// anchor, then to the positional fallback in findAnchorChild().
const ALL_TAB_LABELS = ['tous', 'all', 'alle', 'todos', 'tutti', 'allemaal', 'wszystko', 'vše'];

// Copies the live class names from a native tab so our injected tab keeps
// Google's styling even after obfuscated-class renames (AB testing).
// Falls back to the last known classes.
function nativeTabClasses(tabsContainer) {
    const fallback = { link: 'C6AK7c', box: 'mXwfNd', label: 'R1QWuf' };
    try {
        // First native <a>: skip any link inside our own injected wrapper.
        const links = tabsContainer.getElementsByTagName('a');
        let nativeLink = null;
        for (let i = 0; i < links.length; i++) {
            if (links[i].closest && links[i].closest(`[${TAB_MARKER}]`)) {
                continue;
            }
            nativeLink = links[i];
            break;
        }
        if (!nativeLink) {
            return fallback;
        }
        const box = nativeLink.querySelector('div');
        const label = nativeLink.querySelector('span');
        return {
            link: nativeLink.className || fallback.link,
            box: (box && box.className) || fallback.box,
            label: (label && label.className) || fallback.label
        };
    } catch (e) {
        return fallback;
    }
}

// Finds the tab after which ours should be inserted: the "all results" tab
// when recognizable, else the Images tab, else positional fallback.
function findAnchorChild(tabsContainer) {
    const children = Array.from(tabsContainer.children);
    const byAllLabel = children.find((child) => {
        // textContent only: innerText forces a reflow, worse inside an observer.
        const text = (child.textContent || '').trim().toLowerCase();
        return ALL_TAB_LABELS.some((label) => text === label || text.startsWith(label + ' '));
    });
    if (byAllLabel) {
        return byAllLabel.nextElementSibling;
    }
    const imagesTab = children.find((child) => {
        const link = child.querySelector ? child.querySelector('a') : null;
        const href = link ? link.getAttribute('href') || '' : '';
        return href.includes('udm=2') || href.includes('/imghp');
    });
    if (imagesTab) {
        return imagesTab;
    }
    return children.length >= 2 ? children[2] : null;
}

// Inserts the "Open in Maps" tab right after the "all results" tab.
// Idempotent: re-running never creates a duplicate.
function withdrawOwnTabIfNativePresent(tabsContainer) {
    const ownTab = tabsContainer.querySelector(`[${TAB_MARKER}]`);
    if (ownTab && hasNativeMapTab(tabsContainer)) {
        ownTab.remove();
        return true;
    }
    return false;
}

// Refreshes the href of our already-injected tab after SPA navigations.
// Removes the tab when there is no query (e.g. navigated to homepage).
function refreshOwnTabHref(tabsContainer, mapsHref) {
    const ownTab = tabsContainer.querySelector(`[${TAB_MARKER}]`);
    if (!ownTab) {
        return false;
    }
    const ownLink = ownTab.querySelector('a');
    if (!ownLink) {
        return true;
    }
    if (!mapsHref) {
        ownTab.remove();
        return true;
    }
    ownLink.href = mapsHref;
    return true;
}

function injectMapsTab() {
    const tabsContainer = document.querySelector(TABS_SELECTOR);
    if (!tabsContainer) {
        return;
    }
    // A native Maps tab wins over ours: withdraw instead of duplicating.
    if (withdrawOwnTabIfNativePresent(tabsContainer)) {
        alreadyHasMapsButtonAppended = true;
        return;
    }
    const mapsHref = buildMapsLink();
    if (tabsContainer.querySelector(`[${TAB_MARKER}]`) || hasMapTabAlreadyDisplayed(tabsContainer)) {
        // Already injected (e.g. SPA navigation kept the row): refresh href.
        refreshOwnTabHref(tabsContainer, mapsHref);
        alreadyHasMapsButtonAppended = true;
        return;
    }
    if (!mapsHref) {
        return;
    }
    const classes = nativeTabClasses(tabsContainer);

    const tabButtonWrapper = document.createElement('div');
    tabButtonWrapper.role = 'listitem';
    tabButtonWrapper.setAttribute(TAB_MARKER, '1');
    const tabsButton = document.createElement('a');

    const mapSpan = document.createElement('span');
    mapSpan.className = classes.label;
    mapSpan.textContent = 'Open in Maps';

    const innerDiv = document.createElement('div');
    innerDiv.className = classes.box;
    innerDiv.appendChild(mapSpan);

    tabsButton.className = classes.link;
    tabButtonWrapper.appendChild(tabsButton);
    tabsButton.appendChild(innerDiv);
    tabsButton.href = mapsHref;
    tabsButton.classList.add('remove-text-underline');

    const anchor = findAnchorChild(tabsContainer);
    if (anchor) {
        tabsContainer.insertBefore(tabButtonWrapper, anchor);
    } else {
        tabsContainer.appendChild(tabButtonWrapper);
    }
    alreadyHasMapsButtonAppended = true;

    // If the round "bubble" variant was injected earlier (tabs rendered
    // after it), remove it so only one Maps entry exists.
    const staleRoundButton = document.querySelector(`[${ROUND_BUTTON_MARKER}]`);
    if (staleRoundButton) {
        staleRoundButton.remove();
    }
}

// Injects the round "bubble" Maps button. Only used when no tabs variant
// exists; skipped once the tab is in place. Idempotent.
function injectRoundButton() {
    refreshAppendedFlagFromDom();
    if (alreadyHasMapsButtonAppended) {
        return;
    }
    const mapsHref = buildMapsLink();
    const buttonContainer = document.querySelector(BUTTONS_SELECTOR);
    if (!buttonContainer) {
        return;
    }
    const ownButton = buttonContainer.querySelector(`[${ROUND_BUTTON_MARKER}]`);
    if (ownButton) {
        // Already injected: refresh href after SPA navigations.
        if (!mapsHref) {
            ownButton.remove();
        } else {
            ownButton.href = mapsHref;
        }
        return;
    }
    if (!mapsHref) {
        return;
    }

    const mapsButton = document.createElement('a');
    mapsButton.classList.add('nPDzT', 'T3FoJb');
    mapsButton.setAttribute(ROUND_BUTTON_MARKER, '1');

    const mapDiv = document.createElement('div');
    mapDiv.jsname = 'bVqjv';
    mapDiv.classList.add('GKS7s');

    const mapSpan = document.createElement('span');
    mapSpan.classList.add('FMKtTb', 'UqcIvb');
    mapSpan.jsname = 'pIvPIe';
    mapSpan.textContent = 'Maps';

    mapDiv.appendChild(mapSpan);
    mapsButton.appendChild(mapDiv);

    mapsButton.href = mapsHref;
    buttonContainer.prepend(mapsButton);

    alreadyHasMapsButtonAppended = true;
}

// Makes the small map thumbnail clickable. Idempotent: re-running only
// refreshes the href when the thumbnail is already wrapped in a link.
function injectSmallMapThumbnails() {
    const mapsHref = buildMapsLink();
    if (!mapsHref) {
        return;
    }
    smallMapThumbnailElement.forEach((elementSelector) => {
        const targetedElements = document.querySelectorAll(elementSelector);

        for (let i = 0; i < targetedElements.length; i++) {
            const targettedElement = targetedElements[i];

            // check if element exists on the page
            if (targettedElement && targettedElement.parentNode && targettedElement.parentNode.tagName) {
                if (targettedElement.parentNode.tagName.toLowerCase() === 'a') {
                    // if its already an a tag, just update its href attribute with the generated maps link
                    targettedElement.parentNode.href = mapsHref;
                } else {
                    // otherwise create a new a tag with href attribute set to generated maps link, then wrap it around the element
                    const wrapperLink = document.createElement('a');
                    wrapperLink.href = mapsHref;
                    targettedElement.parentNode.insertBefore(wrapperLink, targettedElement);
                    targettedElement.parentNode.removeChild(targettedElement);
                    wrapperLink.appendChild(targettedElement);
                }
            }
        }
    });
}

// Adds the "Open in Maps" overlay button to a map container.
// Idempotent: refreshes href when the button already exists.
function injectMapOverlay(container) {
    if (!container) {
        return;
    }
    const mapsHref = buildMapsLink();
    const existing = container.querySelector('.open-in-maps-extension-button');
    if (existing) {
        if (!mapsHref) {
            existing.remove();
        } else {
            existing.href = mapsHref;
        }
        return;
    }
    if (!mapsHref) {
        return;
    }
    const mapWrapperLinkEl = document.createElement('a');
    mapWrapperLinkEl.textContent = 'Open in Maps';
    mapWrapperLinkEl.className = 'open-in-maps-extension-button';
    container.style.position = 'relative';

    mapWrapperLinkEl.href = mapsHref;

    // Add the button as an overlay instead of wrapping the entire container
    container.appendChild(mapWrapperLinkEl);
    window.setTimeout(function() {
        mapWrapperLinkEl.style.opacity = '1';
    }, 100);
}

function injectMapOverlays() {
    injectMapOverlay(document.querySelector(addressMapSelector));
    injectMapOverlay(document.querySelector(placesMapSelector));
    injectMapOverlay(document.querySelector(countryMapSelector));
}

function tryInjectAll() {
    refreshAppendedFlagFromDom();
    // we start with "tabs" variant first because its only used for the top-most navigation
    // while round buttons are also used as subnavigation in search results, images etc.
    injectMapsTab();

    // ---------------------------
    // if buttons exist -AND- we HAVE NOT appended a different variant already,
    // add the maps round button
    injectRoundButton();

    // if map thumbnail exists
    injectSmallMapThumbnails();

    // if address / places / country maps are shown, make them clickable
    injectMapOverlays();
}

// Observer: Google renders .beZ0tf asynchronously and re-renders it on SPA
// navigations, so the observer stays connected for the page lifetime.
// Cost control: the callback only runs tryInjectAll() when a mutation
// touches the tabs row (or removes our tab); every inject function is
// idempotent, so unrelated page churn is a cheap no-op. Re-armed state is
// reset on SPA navigations, which Google performs without full reloads.
let tabsObserver = null;

function tabsRowNeedsWork() {
    if (!isSearchPage()) {
        return false;
    }
    const mapsHref = buildMapsLink();
    const tabsContainer = document.querySelector(TABS_SELECTOR);
    const overlaySelectors = [addressMapSelector, placesMapSelector, countryMapSelector];
    // No query (e.g. /search without ?q=): nothing to inject or refresh,
    // only removing our own stale UI still counts as work so the safety
    // net can settle instead of looping.
    if (!mapsHref) {
        if (tabsContainer && tabsContainer.querySelector(`[${TAB_MARKER}]`)) {
            return true;
        }
        if (document.querySelector(`[${ROUND_BUTTON_MARKER}]`)) {
            return true;
        }
        for (let i = 0; i < overlaySelectors.length; i++) {
            const container = document.querySelector(overlaySelectors[i]);
            if (container && container.querySelector('.open-in-maps-extension-button')) {
                return true;
            }
        }
        return false;
    }
    if (tabsContainer) {
        // Missing tab needs work; a coexisting native tab is a duplicate to resolve.
        if (!tabsContainer.querySelector(`[${TAB_MARKER}]`)) {
            return true;
        }
        if (hasNativeMapTab(tabsContainer)) {
            return true;
        }
        // Own tab with a stale href (SPA query change) needs a refresh.
        const ownLink = tabsContainer.querySelector(`[${TAB_MARKER}] a`);
        if (ownLink && mapsHref && ownLink.getAttribute('href') !== mapsHref) {
            return true;
        }
    }
    // Late thumbnails (lazy knowledge panel, etc.): per-element check, since
    // a single comma selector cannot express "unwrapped" for both classes.
    for (let i = 0; i < smallMapThumbnailElement.length; i++) {
        const thumbs = document.querySelectorAll(smallMapThumbnailElement[i]);
        for (let j = 0; j < thumbs.length; j++) {
            const thumb = thumbs[j];
            const parent = thumb.parentNode;
            const wrapped = parent && parent.tagName && parent.tagName.toLowerCase() === 'a';
            if (!wrapped) {
                return true;
            }
            if (mapsHref && parent.getAttribute('href') !== mapsHref) {
                return true;
            }
        }
    }
    // Stale round-button href (round-only page + SPA query change).
    const ownRound = document.querySelector(`[${ROUND_BUTTON_MARKER}]`);
    if (ownRound && mapsHref && ownRound.getAttribute('href') !== mapsHref) {
        return true;
    }
    for (let i = 0; i < overlaySelectors.length; i++) {
        const container = document.querySelector(overlaySelectors[i]);
        if (!container) {
            continue;
        }
        const btn = container.querySelector('.open-in-maps-extension-button');
        if (!btn) {
            return true;
        }
        if (mapsHref && btn.getAttribute('href') !== mapsHref) {
            return true;
        }
    }
    return false;
}

function onTabsMutations(mutations) {
    try {
        let relevant = false;
        for (const m of mutations) {
            if (m.type === 'attributes') {
                // Hydration pattern: element created first, class set after.
                if (m.target && m.target.nodeType === 1 &&
                    (m.target.matches(TABS_SELECTOR) || (m.target.closest && m.target.closest(TABS_SELECTOR)))) {
                    relevant = true;
                    break;
                }
                continue;
            }
            if (m.type !== 'childList') {
                continue;
            }
            const nodes = [];
            m.addedNodes.forEach((n) => nodes.push(n));
            m.removedNodes.forEach((n) => nodes.push(n));
            for (const n of nodes) {
                // Skip text nodes: Text.matches does not exist.
                if (!n || n.nodeType !== 1) {
                    continue;
                }
                const el = n;
                // Our own tab removed by a Google re-render: must re-inject.
                if (el.matches && el.matches(`[${TAB_MARKER}]`)) {
                    relevant = true;
                    break;
                }
                if (el.matches && (el.matches(TABS_SELECTOR) || el.matches(`${TABS_SELECTOR} *`))) {
                    relevant = true;
                    break;
                }
                if (el.querySelector && (el.querySelector(TABS_SELECTOR) || el.querySelector(`[${TAB_MARKER}]`))) {
                    relevant = true;
                    break;
                }
                // Late non-tabs content (thumbnail, map overlay, round
                // buttons): same treatment as the tabs row.
                if (el.matches && (el.matches(WATCH_SELECTOR) || el.matches(`${WATCH_SELECTOR} *`))) {
                    relevant = true;
                    break;
                }
                if (el.querySelector && (el.querySelector(WATCH_SELECTOR) || el.querySelector(`[${ROUND_BUTTON_MARKER}]`))) {
                    relevant = true;
                    break;
                }
                // Container kept, children replaced via innerHTML: the row
                // itself is the mutation target, not an added node.
                if (m.target && m.target.nodeType === 1 &&
                    (m.target.matches(TABS_SELECTOR) || (m.target.closest && m.target.closest(TABS_SELECTOR)))) {
                    relevant = true;
                    break;
                }
                // Same for watched containers replaced in place.
                if (m.target && m.target.nodeType === 1 &&
                    (m.target.matches(WATCH_SELECTOR) || (m.target.closest && m.target.closest(WATCH_SELECTOR)))) {
                    relevant = true;
                    break;
                }
            }
            if (relevant) {
                break;
            }
        }
        if (!relevant && !tabsRowNeedsWork()) {
            return;
        }
        tryInjectAll();
    } catch (e) {
        // Never let an observer callback die: retry on next mutation.
        if (window.console && window.console.debug) {
            window.console.debug('[readd-maps] observer retry after error', e);
        }
    }
}

function startTabsObserver() {
    if (tabsObserver) {
        tabsObserver.disconnect();
    }
    // Off search pages there is nothing to inject: stay disconnected so
    // Gmail/Docs/Drive pay zero observer cost.
    if (!isSearchPage()) {
        tabsObserver = null;
        return;
    }
    const root = document.documentElement || document;
    tabsObserver = new MutationObserver(onTabsMutations);
    tabsObserver.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
}

function resetForNavigation() {
    alreadyHasMapsButtonAppended = false;
    // Deferred: Google re-renders the row after the navigation event, so
    // observe + inject there. start/stop are idempotent, no double work.
    window.setTimeout(() => {
        try {
            tryInjectAll();
        } catch (e) {
            // Never let a navigation reset die: the observer + safety net retry.
            if (window.console && window.console.debug) {
                window.console.debug('[readd-maps] navigation retry after error', e);
            }
        }
        startTabsObserver();
        startSafetyNet();
    }, 0);
}

// Google navigates between searches without reloads (pushState/pjax):
// re-run + re-observe so the tab is injected on every results page.
window.addEventListener('popstate', resetForNavigation);
if (window.navigation && window.navigation.addEventListener) {
    window.navigation.addEventListener('navigate', resetForNavigation);
}
// Safety net on all browsers (the "fallback timer" from the header):
// catches any render pattern the observer filter misses. Cheap: skips
// immediately off search pages, and tryInjectAll() is idempotent.
// Settles after consecutive idle checks; re-armed on SPA navigations.
let safetyNetTimer = 0;
let safetyNetIdleCount = 0;
const SAFETY_NET_INTERVAL_MS = 2000;
const SAFETY_NET_SETTLE_AFTER_IDLE = 5;

function stopSafetyNet() {
    if (safetyNetTimer) {
        window.clearInterval(safetyNetTimer);
        safetyNetTimer = 0;
    }
}

function startSafetyNet() {
    stopSafetyNet();
    // Off search pages there is nothing to check: stay a true no-op.
    if (!isSearchPage()) {
        return;
    }
    safetyNetIdleCount = 0;
    safetyNetTimer = window.setInterval(() => {
        try {
            if (tabsRowNeedsWork()) {
                safetyNetIdleCount = 0;
                tryInjectAll();
            } else if (++safetyNetIdleCount >= SAFETY_NET_SETTLE_AFTER_IDLE) {
                stopSafetyNet();
            }
        } catch (e) {
            // Never let the periodic check die: retry on next tick.
        }
    }, SAFETY_NET_INTERVAL_MS);
}

// Fast path: tabs injection matters on search pages; off search pages only
// the map overlays/thumbnails (cheap single pass, no observer). The observer
// lives for the page lifetime on search pages and is re-armed on SPA
// navigations. Boot itself is guarded: an injector must never take down
// startup (cf. strict-mode throw fixed on the overlay button class).
try {
    if (isSearchPage()) {
        tryInjectAll();
    } else {
        injectSmallMapThumbnails();
        injectMapOverlays();
    }
} catch (e) {
    if (window.console && window.console.debug) {
        window.console.debug('[readd-maps] boot retry via observer', e);
    }
}
startTabsObserver();
startSafetyNet();
})();
