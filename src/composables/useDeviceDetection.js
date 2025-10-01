/**
 * 设备信息检测 composable
 * 检测是否为移动设备和浏览器类型
 */
import { ref, onMounted } from 'vue';

export function useDeviceDetection() {
  const isMobile = ref(false);
  const browserId = ref('');

  function detectDevice() {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return { isMobile: false, browserId: '' };
    }

    const ua = navigator.userAgent || '';
    const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);

    let browser = '';
    if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) {
      browser = 'Safari';
    } else if (/Chrome/i.test(ua)) {
      browser = 'Chrome';
    } else if (/Firefox/i.test(ua)) {
      browser = 'Firefox';
    } else if (/Edge/i.test(ua) || /Edg\//i.test(ua)) {
      browser = 'Edge';
    } else {
      browser = 'Unknown';
    }

    return { isMobile: mobile, browserId: browser };
  }

  onMounted(() => {
    const detection = detectDevice();
    isMobile.value = detection.isMobile;
    browserId.value = detection.browserId;
  });

  return {
    isMobile,
    browserId,
    detectDevice,
  };
}
