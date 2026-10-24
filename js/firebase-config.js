// Configuração pública do app web do Firebase (Console → Configurações do projeto → Seus apps).
// Estes valores NÃO são segredos: identificam o projeto. Quem protege os dados são as
// regras do Firestore (firestore.rules) e o login obrigatório.
// Enquanto apiKey estiver vazio, o sistema roda em "modo demonstração" (dados só neste navegador).
export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: ''
};
