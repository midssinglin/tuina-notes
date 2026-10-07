/* Firebase 設定（網頁用的 Firebase 設定是公開識別碼，不是密碼；資料安全由 firestore.rules 把關） */
window.TN_FB = {
  config: {
    apiKey: 'AIzaSyBNLSdp0zYgg8wgap4Z5z2u1WsW_M7Jk7k',
    authDomain: 'tuina-notes.firebaseapp.com',
    projectId: 'tuina-notes',
    storageBucket: 'tuina-notes.firebasestorage.app',
    messagingSenderId: '64776396467',
    appId: '1:64776396467:web:34e9c889c11fe24f8b1ac6',
  },
  // 網站擁有者：Firebase Authentication 的使用者 UID（firestore.rules 也要填同一個）
  ownerUid: '',
  // Gemini 模型（依序嘗試，前一個不存在就換下一個）
  models: ['gemini-3.8-flash', 'gemini-2.5-flash'],
  sdk: '12.19.0',
};
