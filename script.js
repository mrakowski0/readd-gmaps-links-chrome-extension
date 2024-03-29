// DOM elements (both of these are possible due to google's AB testing changing their UI)
const buttonContainer = document.querySelector('.IUOThf');
const tabsContainer = document.querySelector('.crJ18e');

const clickableMapThumbnail = document.querySelector('.lu-fs');
const addressMapContainer = document.querySelector('#pimg_1');
const placesMapContainer = document.querySelector('.S7dMR')
const countryMapContainer = document.querySelector('.CYJS5e.W0urI.SodP3b.GHMsie.ZHugbd.UivI7b');


// build url search query
const searchQuery = new URLSearchParams(window.location.search).get('q');
const parts = new URL(window.location).hostname.split('.');
const topLevelDomainCode = parts[parts.length - 1];
const mapsLink = `http://maps.google.${topLevelDomainCode}/maps?q=${searchQuery}`;

// if buttons exist, add the maps button and make the small map thumbnail on the right clickable
if (buttonContainer) {
    const mapsButton = document.createElement('a');
    mapsButton.classList.add('nPDzT', 'T3FoJb');

    const mapDiv = document.createElement('div');
    mapDiv.jsname = 'bVqjv';
    mapDiv.classList.add('GKS7s');

    const mapSpan = document.createElement('span');
    mapSpan.classList.add('FMKtTb', 'UqcIvb');
    mapSpan.jsname = 'pIvPIe';
    mapSpan.textContent = 'Maps';

    mapDiv.appendChild(mapSpan);
    mapsButton.appendChild(mapDiv);
    
    mapsButton && (mapsButton.href = mapsLink);
    setTimeout(() => {
        clickableMapThumbnail && (clickableMapThumbnail.parentNode.href = mapsLink);
    }, 0)

    buttonContainer.prepend(mapsButton);
}

// if tabs exist, add the maps tab and make the small map thumbnail on the right clickable
if (tabsContainer) {
    const tabsButton = document.createElement('a');
    tabsButton.classList.add('LatpMc', 'nPDzT', 'T3FoJb');

    const mapSpan = document.createElement('span');
    mapSpan.classList.add('YmvwI');
    mapSpan.textContent = 'Maps';

    tabsButton.appendChild(mapSpan);
    
    tabsButton && (tabsButton.href = mapsLink);
    setTimeout(() => {
        clickableMapThumbnail && (clickableMapThumbnail.parentNode.href = mapsLink);
    }, 0)

    // tabsContainer.prepend(tabsButton);
    if (tabsContainer.children.length > 0) {
        tabsContainer.insertBefore(tabsButton, tabsContainer.firstElementChild.nextSibling);
    } else {
        tabsContainer.appendChild(tabsButton);
    }
}

// if address map is shown (the one right below search bar), make it clickable
if (addressMapContainer) {
    const mapWrapperLinkEl = document.createElement('a');
    mapWrapperLinkEl && (mapWrapperLinkEl.href = mapsLink);

    addressMapContainer.parentElement.insertBefore(mapWrapperLinkEl, addressMapContainer);
    mapWrapperLinkEl.appendChild(addressMapContainer);
}

// if places map is shown (the one right below search bar), make it clickable
if (placesMapContainer) {
    const mapWrapperLinkEl = document.createElement('a');
    mapWrapperLinkEl && (mapWrapperLinkEl.href = mapsLink);

    placesMapContainer.parentElement.insertBefore(mapWrapperLinkEl, placesMapContainer);
    mapWrapperLinkEl.appendChild(placesMapContainer);
}

// if green tinted country map is shown (the one right below search bar), instead of making it size-extend on click, open google maps instead
if (countryMapContainer) {
    const mapWrapperLinkEl = document.createElement('a');
    mapWrapperLinkEl.text = 'OPEN IN MAPS';
    mapWrapperLinkEl.style.fontSize = '32px';
    mapWrapperLinkEl.style.position = 'absolute';
    mapWrapperLinkEl.style.bottom = '0';
    mapWrapperLinkEl.style.background = 'rgba(0, 0, 0, 0.85)';
    mapWrapperLinkEl.style.textAlign = 'center';
    mapWrapperLinkEl.style.color = '#fff';
    mapWrapperLinkEl.style.cursor = 'pointer';
    mapWrapperLinkEl.style.left = '0';
    mapWrapperLinkEl.style.right = '0';
    mapWrapperLinkEl.style.height = '100px';
    mapWrapperLinkEl.style.lineHeight = '100px';

    mapWrapperLinkEl && (mapWrapperLinkEl.href = mapsLink);
    countryMapContainer.append(mapWrapperLinkEl);
}