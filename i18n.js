// i18n.js
export const translations = {
  zh: {
    scanTitle:"📷 扫码",
    torch:"闪光灯", on:"开", off:"关",
    startScan:"开始扫描", stop:"停止", torchToggle:"切换闪光灯",
    rescan:"重新扫描", result:"识别结果",
    updateStatus:"更新 DU 状态", choose:"请选择",
    inTransit:"运输中", arrived:"已到达",
    remark:"备注信息", remarkPlaceholder:"可填写额外说明…",
    uploadPhoto:"上传照片", photoTip:"支持拍照或从相册选择",
    removePhoto:"移除照片",
    needSelectStatus:"请先选择运输状态",
    invalidId:"无效的DU ID",
    submit:"提交", submitting:"提交中…", submittingDots:"提交中…",
    uploadIng:"上传中…", uploadingPct:"上传中：",
    submitSuccess:"提交成功",
    submitCanceled:"提交已取消",
    submitNetworkErr:"提交失败：网络错误",
    submitHttpErrPrefix:"提交失败：",
    apiUrlMissing:"未配置后端 API_URL，请在页面顶部通过 window.API_URL 或直接改代码设置真实地址"
  },
  en: {
    scanTitle:"📷 Scan",
    torch:"Torch", on:"On", off:"Off",
    startScan:"Start Scan", stop:"Stop", torchToggle:"Toggle Torch",
    rescan:"Rescan", result:"Result",
    updateStatus:"Update DU Status", choose:"Please select",
    inTransit:"In Transit", arrived:"Arrived",
    remark:"Remark", remarkPlaceholder:"Optional notes…",
    uploadPhoto:"Upload Photo", photoTip:"Take or choose from gallery",
    removePhoto:"Remove Photo",
    needSelectStatus:"Please select a shipping status",
    invalidId:"Invalid DU ID",
    submit:"Submit", submitting:"Submitting…", submittingDots:"Submitting…",
    uploadIng:"Uploading…", uploadingPct:"Uploading:",
    submitSuccess:"Submitted successfully",
    submitCanceled:"Submission canceled",
    submitNetworkErr:"Submission failed: Network error",
    submitHttpErrPrefix:"Submission failed: ",
    apiUrlMissing:"API_URL not configured. Set it via window.API_URL or in code."
  },
  id: {
    scanTitle:"📷 Pindai",
    torch:"Lampu", on:"Nyala", off:"Mati",
    startScan:"Mulai Pindai", stop:"Berhenti", torchToggle:"Ubah Lampu",
    rescan:"Pindai Ulang", result:"Hasil",
    updateStatus:"Perbarui Status DU", choose:"Silakan pilih",
    inTransit:"Dalam Perjalanan", arrived:"Tiba",
    remark:"Catatan", remarkPlaceholder:"Tambahkan keterangan…",
    uploadPhoto:"Unggah Foto", photoTip:"Dukung kamera atau galeri",
    removePhoto:"Hapus Foto",
    needSelectStatus:"Silakan pilih status pengiriman",
    invalidId:"ID DU tidak valid",
    submit:"Kirim", submitting:"Mengirim…", submittingDots:"Mengirim…",
    uploadIng:"Mengunggah…", uploadingPct:"Mengunggah:",
    submitSuccess:"Berhasil dikirim",
    submitCanceled:"Pengiriman dibatalkan",
    submitNetworkErr:"Gagal kirim: Kesalahan jaringan",
    submitHttpErrPrefix:"Gagal kirim: ",
    apiUrlMissing:"API_URL belum dikonfigurasi. Atur via window.API_URL atau di kode."
  }
};

export function tFactory(state){
  return (key)=> (translations[state.lang] && translations[state.lang][key]) || key;
}
