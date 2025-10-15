export function createUpdateHistoryRenderer({
  container,
  signal,
  i18n,
  i18nStatusDisplay,
  escapeHtml,
  formatTimestampToJakarta,
  toAbsUrl,
  getIconMarkup,
  getMapboxStaticImageUrl,
  getTableRenderer,
}) {
  function render(items) {
    if (!container) return;

    const resolveText = (key, fallback) => {
      if (i18n && typeof i18n.t === 'function') {
        try {
          const val = i18n.t(key);
          if (typeof val === 'string' && val && val !== key) return val;
        } catch (err) {
          console.error(err);
        }
      }
      return fallback;
    };

    const text = {
      empty: resolveText('updateHistory.empty', 'No update records'),
      statusDeliveryLabel: resolveText(
        'updateHistory.statusDeliveryLabel',
        resolveText('table.statusDelivery', 'Delivery Status')
      ),
      statusSiteLabel: resolveText(
        'updateHistory.statusSiteLabel',
        resolveText('table.statusSite', 'Site Status')
      ),
      updatedByLabel: resolveText('updateHistory.updatedByLabel', 'Updated By'),
      remarkLabel: resolveText(
        'updateHistory.remarkLabel',
        resolveText('table.remark', 'Remark')
      ),
      phoneSuffixTemplate: resolveText('updateHistory.phoneSuffix', '({phone})'),
      mapTitle: resolveText('updateHistory.openInGoogleMaps', 'Open in Google Maps'),
      mapLinkLabel: resolveText('updateHistory.viewMap', 'View map'),
      noLocation: resolveText('updateHistory.noLocation', 'No location'),
      noPhoto: resolveText('updateHistory.noPhoto', 'No photo'),
      mapAlt: resolveText('updateHistory.mapAlt', 'Location map'),
      photoAlt: resolveText('updateHistory.photoAlt', 'Site photo'),
    };

    if (!items || items.length === 0) {
      const emptyMsg = text.empty;
      container.innerHTML = `<div class="empty-state">${escapeHtml(emptyMsg)}</div>`;
      return;
    }

    const recordsHtml = items
      .map((item, index) => {
        const statusDelivery = i18nStatusDisplay(item.status_delivery || '');
        const statusSite = i18nStatusDisplay(item.status_site || '');
        const remark = item.remark
          ? escapeHtml(item.remark)
          : '<span class="muted">-</span>';
        const photoUrl = item.photo_url ? toAbsUrl(item.photo_url) : '';

        let updatedBy = '<span class="muted">-</span>';
        if (item.updated_by) {
          updatedBy = escapeHtml(item.updated_by);
          if (item.phone_number) {
            const phoneSuffix = text.phoneSuffixTemplate.replace(
              '{phone}',
              escapeHtml(item.phone_number)
            );
            updatedBy += ` <span class="phone-number-suffix">${phoneSuffix}</span>`;
          }
        }

        const createdAtRaw = item.created_at ? formatTimestampToJakarta(item.created_at) : '';
        const createdAt = createdAtRaw
          ? escapeHtml(createdAtRaw).replace(/\n/g, '<br>')
          : '<span class="muted">-</span>';

        const [lat, lng] = [item.lat, item.lng];
        const hasCoords = lat && lng;

        let mapSection = '';
        if (hasCoords) {
          const mapImageUrl = getMapboxStaticImageUrl(lng, lat);
          const googleMapsUrl = `https://www.google.com/maps?q=${encodeURIComponent(lat)},${encodeURIComponent(lng)}`;
          if (mapImageUrl) {
            mapSection = `
            <a href="${escapeHtml(googleMapsUrl)}" target="_blank" rel="noopener" class="history-map-image-link" title="${escapeHtml(text.mapTitle)}">
              <img src="${escapeHtml(mapImageUrl)}" alt="${escapeHtml(text.mapAlt)}" class="history-map-image" loading="lazy" />
              <div class="history-map-overlay">
                ${getIconMarkup('map')}
              </div>
            </a>
          `;
          } else {
            mapSection = `
            <a href="${escapeHtml(googleMapsUrl)}" target="_blank" rel="noopener" class="history-map-link-compact">
              ${getIconMarkup('map')} ${escapeHtml(text.mapLinkLabel)}
            </a>
          `;
          }
        } else {
          mapSection = `<span class="muted">${escapeHtml(text.noLocation)}</span>`;
        }

        const photoSection = photoUrl
          ? `<img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(text.photoAlt)}" class="history-photo-thumbnail view-link" data-url="${escapeHtml(photoUrl)}" loading="lazy" />`
          : `<span class="muted">${escapeHtml(text.noPhoto)}</span>`;

        return `
        <div class="history-record ${index === 0 ? 'latest' : ''}">
          <div class="history-record-header">
            <div class="history-record-index">#${items.length - index}</div>
            <div class="history-record-time">${createdAt}</div>
          </div>
          <div class="history-record-main">
            <div class="history-record-info">
              <div class="history-info-row">
                <div class="history-field">
                  <div class="history-field-label">${escapeHtml(text.statusDeliveryLabel)}</div>
                  <div class="history-field-value history-status"><strong>${statusDelivery}</strong></div>
                </div>
                <div class="history-field">
                  <div class="history-field-label">${escapeHtml(text.statusSiteLabel)}</div>
                  <div class="history-field-value history-status"><strong>${statusSite}</strong></div>
                </div>
                <div class="history-field">
                  <div class="history-field-label">${escapeHtml(text.updatedByLabel)}</div>
                  <div class="history-field-value">${updatedBy}</div>
                </div>
              </div>
              <div class="history-field">
                <div class="history-field-label">${escapeHtml(text.remarkLabel)}</div>
                <div class="history-field-value">${remark}</div>
              </div>
            </div>
            <div class="history-record-media">
              <div class="history-media-item">${mapSection}</div>
              <div class="history-media-item">${photoSection}</div>
            </div>
          </div>
        </div>
      `;
      })
      .join('');

    container.innerHTML = `<div class="history-records">${recordsHtml}</div>`;

    const renderer = typeof getTableRenderer === 'function' ? getTableRenderer() : null;
    container.querySelectorAll('.view-link').forEach((trigger) => {
      trigger.addEventListener(
        'click',
        (e) => {
          e.preventDefault();
          e.stopPropagation();
          const url = trigger.getAttribute('data-url');
          renderer?.openViewerWithUrl?.(url);
        },
        { signal }
      );
    });
  }

  return { render };
}
