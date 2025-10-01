/**
 * 上传相关的 composable
 * 提供带进度追踪的文件上传功能
 */
import { ref } from 'vue';

export function useUpload() {
  const uploadProgress = ref(0);
  const isUploading = ref(false);

  /**
   * 使用 XMLHttpRequest 上传文件并追踪进度
   * @param {Object} options - 上传选项
   * @param {string} options.url - 上传 URL
   * @param {FormData} options.formData - 表单数据
   * @param {Function} options.onProgress - 进度回调
   * @param {number} options.timeoutMs - 超时时间（毫秒）
   * @returns {Promise<string>} 响应文本
   */
  function uploadWithProgress({ url, formData, onProgress, timeoutMs = 15000 }) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);

      xhr.upload.onprogress = (evt) => {
        if (typeof onProgress === 'function') {
          const pct = evt && evt.lengthComputable && evt.total > 0
            ? Math.round((evt.loaded / evt.total) * 100)
            : 0;
          onProgress(pct);
        }
      };

      xhr.timeout = timeoutMs;
      xhr.ontimeout = () => reject(new Error('Request timeout'));

      xhr.onload = () => {
        const ok = xhr.status >= 200 && xhr.status < 300;
        if (!ok) {
          reject(new Error(`HTTP ${xhr.status} - ${xhr.responseText || ''}`));
          return;
        }
        resolve(xhr.responseText);
      };

      xhr.onerror = () => reject(new Error('Network error'));
      xhr.onabort = () => reject(new Error('Request aborted'));

      xhr.send(formData);
    });
  }

  /**
   * 简化的上传方法，自动更新内部进度状态
   */
  async function upload(url, formData, timeoutMs) {
    isUploading.value = true;
    uploadProgress.value = 0;

    try {
      const result = await uploadWithProgress({
        url,
        formData,
        timeoutMs,
        onProgress: (pct) => {
          uploadProgress.value = pct;
        },
      });
      return result;
    } finally {
      isUploading.value = false;
    }
  }

  return {
    uploadProgress,
    isUploading,
    uploadWithProgress,
    upload,
  };
}
