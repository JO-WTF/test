<template>
  <a-modal
    :open="open"
    @update:open="(v) => $emit('update:open', v)"
    :footer="null"
    :closable="false"
    :maskClosable="true"
    :force-render="true"
    :centered="true"
    width="1000px"
    height="95%"
    wrap-class-name="admin-modal-wrap admin-history-modal-wrap"
    >
    <div class="modal large modal-content" ref="rootRef">
      <div class="modal-header">
        <h3>
          <span data-i18n="updateHistory.title">DN 更新记录</span>
          <span class="tag" v-if="dnNumber">{{ dnNumber }}</span>
        </h3>
      </div>
      <div class="modal-body">
        <div v-if="loading" class="loading-state" data-i18n="updateHistory.loading">加载中...</div>
        <div v-else-if="error" class="error-state">{{ error }}</div>
        <div v-else-if="!items || !items.length" class="empty-state">{{ translate('updateHistory.empty') || 'No update records' }}</div>
        <div v-else class="history-records">
          <div
            v-for="(item, index) in items"
            :key="item.key"
            :class="['history-record', { latest: index === 0 }]"
          >
            <div class="history-record-header">
              <div class="history-record-index">#{{ items.length - index }}</div>
              <div class="history-record-time">{{ item.createdAt || '-' }}</div>
            </div>
            <div class="history-record-main">
              <div class="history-record-info">
                <div class="history-info-row">
                  <div class="history-field">
                    <div class="history-field-label">{{ translate('updateHistory.statusDeliveryLabel') || translate('table.statusDelivery') || 'Delivery Status' }}</div>
                    <div class="history-field-value history-status"><strong>{{ item.statusDelivery || '-' }}</strong></div>
                  </div>
                  <div class="history-field">
                    <div class="history-field-label">{{ translate('updateHistory.statusSiteLabel') || translate('table.statusSite') || 'Site Status' }}</div>
                    <div class="history-field-value history-status"><strong>{{ item.statusSite || '-' }}</strong></div>
                  </div>
                  <div class="history-field">
                    <div class="history-field-label">{{ translate('updateHistory.updatedByLabel') || 'Updated By' }}</div>
                    <div class="history-field-value">{{ item.updatedBy || '-' }}</div>
                  </div>
                </div>
                <div class="history-field">
                  <div class="history-field-label">{{ translate('updateHistory.remarkLabel') || translate('table.remark') || 'Remark' }}</div>
                  <div class="history-field-value" v-html="formatRemark(item.remark)"></div>
                </div>
              </div>
              <div class="history-record-media">
                <!-- Map area: show image when available, otherwise show localized "no location" text -->
                <div class="history-media-item" v-if="item.mapImageUrl">
                  <a :href="item.googleMapsUrl" target="_blank" rel="noopener" :title="translate('updateHistory.openInGoogleMaps') || 'Open in Google Maps'" class="history-map-image-link">
                    <img :src="item.mapImageUrl" :alt="translate('updateHistory.mapAlt') || 'Location map'" class="history-map-image" loading="lazy" />
                    <div class="history-map-overlay" v-html="getIcon('map')"></div>
                  </a>
                </div>
                <div class="history-media-item" v-else>
                  <div class="history-map-placeholder muted">{{ translate('updateHistory.noLocation') || 'No location' }}</div>
                </div>

                <!-- Photo area: unchanged behavior -->
                <div class="history-media-item">
                  <img v-if="item.photoUrl" :src="item.photoUrl" :alt="translate('updateHistory.photoAlt') || 'Site photo'" class="history-photo-thumbnail view-link" @click.prevent="openViewer(item.photoUrl)" loading="lazy" />
                  <span v-else class="history-photo-placeholder muted">{{ translate('updateHistory.noPhoto') || 'No photo' }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="foot">
        <button class="btn" @click="$emit('close')">{{ translate('updateHistory.close') || 'Close' }}</button>
      </div>
    </div>
  </a-modal>
</template>

<script setup>
import { defineEmits, defineProps, ref, onMounted, watch } from 'vue';
import { useI18n } from '../i18n/useI18n';
import { applyI18n } from '../i18n/dom';

const props = defineProps({
    open: { type: Boolean, default: false },
    items: { type: Array, default: () => [] },
    dnNumber: { type: String, default: '' },
    loading: { type: Boolean, default: false },
    error: { type: String, default: '' },
    // no external getIconMarkup prop: component uses internal fixed icon
});

const emit = defineEmits(['update:open', 'close', 'openViewer']);

// i18n instance will be retrieved from shared useI18n
const rootRef = ref(null);
let i18nInstance = null;

onMounted(async () => {
    try {
        // request namespaces used by this component
        i18nInstance = await useI18n({ namespaces: ['core', 'admin'], fallbackLang: 'en' });
        if (rootRef.value) applyI18n(rootRef.value, i18nInstance);
    } catch (err) {
        // keep graceful fallback
    }
});

// when modal opens (teleported content might be re-attached), re-apply translations
watch(() => props.open, (v) => {
    if (v && i18nInstance && rootRef.value) {
        try {
            applyI18n(rootRef.value, i18nInstance);
        } catch (err) {
            // ignore
        }
    }
});

const translate = (key) => {
    if (!i18nInstance) return undefined;
    try {
        return i18nInstance.t(key);
    } catch (err) {
        return undefined;
    }
};

const openViewer = (url) => {
    emit('openViewer', url);
};

const formatRemark = (text) => {
    if (!text) return '<span class="muted">-</span>';
    // very small sanitization: escape < and >
    return String(text).replace(/</g, '&lt;').replace(/>/g, '&gt;');
};

const getIcon = (name) => {
    try {
        if (name === 'map') {
            return '<svg class="icon-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#1677ff"/><circle cx="12" cy="9" r="2.5" fill="#fff"/></svg>';
        }
        return '';
    } catch (err) {
        return '';
    }
};
</script>
