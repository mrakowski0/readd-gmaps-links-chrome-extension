document.addEventListener('DOMContentLoaded', () => {
  const hasChrome = typeof chrome !== 'undefined' && chrome && chrome.i18n;
  const t = (key) => (hasChrome ? chrome.i18n.getMessage(key) : '') || '';

  const titleEl = document.getElementById('title');
  const enableExtension = document.getElementById('enableExtension');
  const enableActionButton = document.getElementById('enableActionButton');
  const enableMapsTab = document.getElementById('enableMapsTab');
  const enableLocalActionTile = document.getElementById('enableLocalActionTile');
  const row_enableActionButton = document.getElementById('row_enableActionButton');
  const row_enableMapsTab = document.getElementById('row_enableMapsTab');
  const row_enableLocalActionTile = document.getElementById('row_enableLocalActionTile');
  const label_enableExtension = document.getElementById('label_enableExtension');
  const label_enableActionButton = document.getElementById('label_enableActionButton');
  const label_enableMapsTab = document.getElementById('label_enableMapsTab');
  const label_enableLocalActionTile = document.getElementById('label_enableLocalActionTile');

  if (titleEl) titleEl.textContent = t('optionsTitle');
  document.title = t('optionsTitle');
  if (label_enableExtension) label_enableExtension.textContent = t('option_enableExtension_label') || 'Enable extension';
  if (label_enableActionButton) label_enableActionButton.textContent = t('option_enableActionButton_label') || 'Add "Open in Maps" button next to the action bar';
  if (label_enableMapsTab) label_enableMapsTab.textContent = t('option_enableMapsTab_label') || "Add 'Maps' tab to the top navigation";
  if (label_enableLocalActionTile) label_enableLocalActionTile.textContent = t('option_enableLocalActionTile_label') || 'Add "Open in Maps" tile in the local actions row';

  // Migration & load
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
      chrome.storage?.sync?.get(['enableExtension','enableActionButton','enableMapsTab','enableLocalActionTile'], (syncRes) => {
        chrome.storage?.local?.get(['enableExtension','enableActionButton','enableMapsTab','enableLocalActionTile'], (localRes) => done(syncRes, localRes));
      });
    } catch {
      chrome.storage?.local?.get(['enableExtension','enableActionButton','enableMapsTab','enableLocalActionTile'], (localRes) => done({}, localRes));
    }
  };
  const writeAll = (vals, cb) => {
    let pending = 0;
    const next = () => { if (--pending <= 0 && typeof cb === 'function') cb(); };
    try { pending++; chrome.storage?.sync?.set(vals, next); } catch {}
    try { pending++; chrome.storage?.local?.set(vals, next); } catch {}
    if (pending === 0 && typeof cb === 'function') cb();
  };

  readAll((res) => {
    const current = {
      enableExtension: !!res.enableExtension,
      enableActionButton: !!res.enableActionButton,
      enableMapsTab: !!res.enableMapsTab,
      enableLocalActionTile: !!res.enableLocalActionTile,
    };

    if (enableExtension) enableExtension.checked = current.enableExtension;
    if (enableActionButton) {
      enableActionButton.checked = current.enableActionButton;
      enableActionButton.disabled = !current.enableExtension;
      if (row_enableActionButton) row_enableActionButton.classList.toggle('is-disabled', !current.enableExtension);
    }
    if (enableMapsTab) {
      enableMapsTab.checked = current.enableMapsTab;
      enableMapsTab.disabled = !current.enableExtension;
      if (row_enableMapsTab) row_enableMapsTab.classList.toggle('is-disabled', !current.enableExtension);
    }
    if (enableLocalActionTile) {
      enableLocalActionTile.checked = current.enableLocalActionTile;
      enableLocalActionTile.disabled = !current.enableExtension;
      if (row_enableLocalActionTile) row_enableLocalActionTile.classList.toggle('is-disabled', !current.enableExtension);
    }

    const needsPersist = [res.enableExtension, res.enableActionButton, res.enableMapsTab, res.enableLocalActionTile].some(v => typeof v !== 'boolean');
    if (needsPersist) writeAll(current);
  });

  const onChange = () => {
    const payload = {
      enableExtension: !!(enableExtension && enableExtension.checked),
      enableActionButton: !!(enableActionButton && enableActionButton.checked),
      enableMapsTab: !!(enableMapsTab && enableMapsTab.checked),
      enableLocalActionTile: !!(enableLocalActionTile && enableLocalActionTile.checked),
    };
  writeAll(payload);

    // Update disabled state live
    if (enableActionButton) enableActionButton.disabled = !payload.enableExtension;
    if (enableMapsTab) enableMapsTab.disabled = !payload.enableExtension;
    if (enableLocalActionTile) enableLocalActionTile.disabled = !payload.enableExtension;
    if (row_enableActionButton) row_enableActionButton.classList.toggle('is-disabled', !payload.enableExtension);
    if (row_enableMapsTab) row_enableMapsTab.classList.toggle('is-disabled', !payload.enableExtension);
    if (row_enableLocalActionTile) row_enableLocalActionTile.classList.toggle('is-disabled', !payload.enableExtension);
  };

  enableExtension && enableExtension.addEventListener('change', onChange);
  enableActionButton && enableActionButton.addEventListener('change', onChange);
  enableMapsTab && enableMapsTab.addEventListener('change', onChange);
  enableLocalActionTile && enableLocalActionTile.addEventListener('change', onChange);
});
