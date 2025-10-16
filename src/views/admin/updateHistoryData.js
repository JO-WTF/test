import { normalizeTextValue } from './utils.js';

export function prepareUpdateHistoryItems(items = [], {
  i18n,
  i18nStatusDisplay,
  escapeHtml,
  formatTimestampToJakarta,
  toAbsUrl,
  getIconMarkup,
  getMapboxStaticImageUrl,
  statusDeliveryValueToKey,
  statusDeliveryAliasMap,
} = {}) {
  if (!Array.isArray(items)) return [];

  const STATUS_DELIVERY_VALUE_TO_KEY = statusDeliveryValueToKey || null;
  const STATUS_DELIVERY_ALIAS_MAP = statusDeliveryAliasMap || null;

  const resolveStatusDeliveryDisplay = (raw) => {
    const rawStr = normalizeTextValue(raw);
    let display = typeof i18nStatusDisplay === 'function' ? i18nStatusDisplay(rawStr) : rawStr || '';
    if (i18n && STATUS_DELIVERY_VALUE_TO_KEY) {
      let canonical = rawStr || '';
      if (STATUS_DELIVERY_ALIAS_MAP) {
        canonical = STATUS_DELIVERY_ALIAS_MAP[rawStr] || STATUS_DELIVERY_ALIAS_MAP[rawStr?.toUpperCase()] || canonical;
      }
      let translationKey = STATUS_DELIVERY_VALUE_TO_KEY[canonical] || STATUS_DELIVERY_VALUE_TO_KEY[rawStr] || STATUS_DELIVERY_VALUE_TO_KEY[canonical?.toUpperCase()];
      if (!translationKey && rawStr) {
        const underscoredToSpace = String(rawStr).replace(/_/g, ' ').trim();
        translationKey = STATUS_DELIVERY_VALUE_TO_KEY[underscoredToSpace] || STATUS_DELIVERY_VALUE_TO_KEY[underscoredToSpace.toUpperCase()];
      }
      if (!translationKey) {
        const lcRaw = String(rawStr || '').toLowerCase();
        for (const k of Object.keys(STATUS_DELIVERY_VALUE_TO_KEY)) {
          if (k && k.toLowerCase() === lcRaw) {
            translationKey = STATUS_DELIVERY_VALUE_TO_KEY[k];
            break;
          }
        }
      }
      if (translationKey) {
        const candidates = [translationKey, `core.${translationKey}`, `admin.${translationKey}`];
        for (const cand of candidates) {
          try {
            const translated = i18n.t(cand);
            if (translated && translated !== cand) {
              display = translated;
              break;
            }
          } catch (err) {
            // ignore
          }
        }
      }
    }
    return display || '';
  };

  return items.map((item, idx) => {
    const rawStatusDelivery = item?.status_delivery || '';
    const statusDelivery = resolveStatusDeliveryDisplay(rawStatusDelivery);
    const statusSite = (typeof i18nStatusDisplay === 'function' ? i18nStatusDisplay(item?.status_site || '') : normalizeTextValue(item?.status_site || '')) || '';
    const remark = item?.remark ? String(item.remark) : '';
    const photoUrl = item?.photo_url ? toAbsUrl(item.photo_url) : '';
    const createdAtRaw = item?.created_at ? formatTimestampToJakarta(item.created_at) : '';
    const createdAt = createdAtRaw ? String(createdAtRaw).replace(/\r?\n/, ' ').trim() : '';

    const lat = item?.lat || item?.latitude || '';
    const lng = item?.lng || item?.longitude || '';
    const hasCoords = !!(lat && lng);
    const googleMapsUrl = hasCoords ? `https://www.google.com/maps?q=${encodeURIComponent(lat)},${encodeURIComponent(lng)}` : '';
    const mapImageUrl = hasCoords ? getMapboxStaticImageUrl(lng, lat) : '';

    let updatedBy = item?.updated_by ? String(item.updated_by) : '';
    const phoneNumber = item?.phone_number ? String(item?.phone_number) : '';
    if (phoneNumber) {
      updatedBy = `${updatedBy} (${phoneNumber})`;
    }

    return {
      key: item?.id ?? `idx:${idx}`,
      statusDelivery,
      statusSite,
      remark: remark || '',
      photoUrl: photoUrl || '',
      createdAt,
      lat,
      lng,
      hasCoords,
      googleMapsUrl,
      mapImageUrl: mapImageUrl || '',
      updatedBy: updatedBy || '',
      phoneNumber: phoneNumber || '',
      original: item || {},
    };
  });
}
