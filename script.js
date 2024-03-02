
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

    const mapsLink = `http://maps.google.com/maps?q=${searchQuery}`;
    mapsButton.href = mapsLink;

    clickableMapThumbnail.parentNode.href = mapsLink;

    tabsContainer.prepend(mapsButton);
}