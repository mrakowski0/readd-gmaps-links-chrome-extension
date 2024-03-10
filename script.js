
const tabsContainer = document.querySelector('.IUOThf');
const clickableMapThumbnail = document.querySelector('.lu-fs');

if (tabsContainer) {
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

    const searchQuery = new URLSearchParams(window.location.search).get('q');

    const parts = new URL(window.location).hostname.split('.');

    const topLevelDomainCode = parts[parts.length - 1];

    const mapsLink = `http://maps.google.${topLevelDomainCode}/maps?q=${searchQuery}`;
    
    mapsButton && (mapsButton.href = mapsLink);
    clickableMapThumbnail && (clickableMapThumbnail.parentNode.href = mapsLink);

    tabsContainer.prepend(mapsButton);
}