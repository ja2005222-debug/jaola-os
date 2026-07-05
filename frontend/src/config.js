// 🛠️ عنوان الباك إند الموحد — نفس المنطق المستخدم سابقاً في Dashboard/useSocket/PreviewFrame
export const BACKEND_URL =
  window.location.hostname === 'localhost' || window.location.hostname.startsWith('100.115')
    ? `http://${window.location.hostname}:4000`
    : 'https://jaola-os.onrender.com';
