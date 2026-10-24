// Configuração pública do app web do Firebase (Console → Configurações do projeto → Seus apps).
// Estes valores NÃO são segredos: identificam o projeto. Quem protege os dados são as
// regras do Firestore (firestore.rules) e o login obrigatório.
// Enquanto apiKey estiver vazio, o sistema roda em "modo demonstração" (dados só neste navegador).
export const firebaseConfig = {
  apiKey: 'AIzaSyDX_kF5chz9aqthHgfdxY8df5j8fEjQKfo',
  authDomain: 'leori-gestao.firebaseapp.com',
  projectId: 'leori-gestao',
  storageBucket: 'leori-gestao.firebasestorage.app',
  messagingSenderId: '505326627189',
  appId: '1:505326627189:web:ac4c399754aa2f44f5cb3c'
};
