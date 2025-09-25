<template>
  <div class="lang-switch" aria-label="Language switch">
    <button
      v-for="option in normalizedOptions"
      :key="option.code"
      type="button"
      :class="{ active: modelValue === option.code }"
      :aria-label="option.ariaLabel"
      :aria-pressed="modelValue === option.code"
      @click="() => select(option.code)"
    >
      <img :src="option.flag" :alt="option.alt" />
      {{ option.label }}
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const FALLBACK_OPTIONS = [
  {
    code: 'zh',
    label: '中文',
    ariaLabel: '切换为中文',
    flag: 'https://flagcdn.com/w20/cn.png',
    alt: 'CN',
  },
  {
    code: 'en',
    label: 'English',
    ariaLabel: 'Switch to English',
    flag: 'https://flagcdn.com/w20/gb.png',
    alt: 'GB',
  },
  {
    code: 'id',
    label: 'Indonesia',
    ariaLabel: 'Beralih ke Bahasa Indonesia',
    flag: 'https://flagcdn.com/w20/id.png',
    alt: 'ID',
  },
];

const props = defineProps({
  modelValue: {
    type: String,
    default: 'en',
  },
  languages: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(['update:modelValue', 'change']);

const normalizedOptions = computed(() => {
  if (!Array.isArray(props.languages) || props.languages.length === 0) {
    return FALLBACK_OPTIONS;
  }
  const mapped = props.languages
    .map((option) => ({
      code: option?.code ?? '',
      label: option?.label ?? option?.name ?? '',
      ariaLabel: option?.ariaLabel ?? option?.aria ?? '',
      flag: option?.flag ?? '',
      alt: option?.alt ?? (typeof option?.code === 'string' ? option.code.toUpperCase() : ''),
    }))
    .filter((option) => option.code && option.label && option.flag);
  return mapped.length ? mapped : FALLBACK_OPTIONS;
});

const select = (code) => {
  if (!code || code === props.modelValue) return;
  emit('update:modelValue', code);
  emit('change', code);
};
</script>
