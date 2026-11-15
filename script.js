import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, addDoc, orderBy, onSnapshot, serverTimestamp, limit } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDPyoYEsvZTvSSaVUb7pKDyAJzpZLxE3fk",
  authDomain: "kal-is.firebaseapp.com",
  projectId: "kal-is",
  storageBucket: "kal-is.firebasestorage.app",
  messagingSenderId: "267978238420",
  appId: "1:267978238420:web:09f37b1e3a50e3398cce41",
  measurementId: "G-SDY8CJM1CC"
};

const IMGBB_API_KEY = 'aee3e1e7e8b54285d474846e3092dbbe';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = (id) => document.getElementById(id);
const isValidUsername = (u) => /^[a-zA-Z0-9_]{3,15}$/.test(u);
const escapeHtml = (str) => String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
const chatIdFor = (a, b) => [a, b].sort().join('__');

const state = { uid: null, me: null, contacts: {}, activeUser: null, unsubMessages: null, unsubAllChats: null };

function showInAppNotification(title, body, senderUsername, senderAvatar) {
  const container = $('notificationContainer');
  const el = document.createElement('div');
  el.className = 'in-app-notification';
  const avatarHtml = senderAvatar 
    ? `<div class="avatar"><img src="${senderAvatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"></div>`
    : `<div class="avatar">${title.charAt(0).toUpperCase()}</div>`;
    
  el.innerHTML = `
    ${avatarHtml}
    <div class="text">
      <h4>${escapeHtml(title)}</h4>
      <p>${escapeHtml(body)}</p>
    </div>
  `;
  el.onclick = async () => {
    el.remove();
    await loadUserAndOpenChat(senderUsername);
  };
  container.appendChild(el);
  setTimeout(() => el.classList.add('show'), 100);
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 5000);
}

async function loadUserAndOpenChat(username) {
  if (!state.contacts[username]) {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('username', '==', username));
    const snap = await getDocs(q);
    if (!snap.empty) state.contacts[username] = snap.docs[0].data();
    else return;
  }
  await openChat(username);
  renderChats();
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (snap.exists()) {
      const d = snap.data();
      state.uid = user.uid;
      state.me = { uid: user.uid, name: d.name, username: d.username, avatarUrl: d.avatarUrl || '' };
      enterApp();
      return;
    }
  }
  $('app').classList.add('hidden');
  $('registerScreen').classList.remove('hidden');
  initAuthLogic();
});

function initAuthLogic() {
  $('goToLogin').onclick = () => { $('registerScreen').classList.add('hidden'); $('loginScreen').classList.remove('hidden'); };
  $('goToRegister').onclick = () => { $('loginScreen').classList.add('hidden'); $('registerScreen').classList.remove('hidden'); };

  $('registerBtn').onclick = async () => {
    const name = $('regName').value.trim();
    const username = $('regUsername').value.trim().toLowerCase();
    const email = $('regEmail').value.trim();
    const password = $('regPassword').value;
    const err = $('regErr');
    err.textContent = '';
    
    if (!name) { err.textContent = 'Введите имя'; return; }
    if (!isValidUsername(username)) { err.textContent = 'Username: 3–15 символов, латиница, цифры, _'; return; }
    if (!email || !password) { err.textContent = 'Введите email и пароль'; return; }

    $('registerBtn').disabled = true;
    $('registerBtn').textContent = 'Регистрация...';

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;
      const unameRef = doc(db, 'usernames', username);
      const unameSnap = await getDoc(unameRef);
      if (unameSnap.exists()) {
        err.textContent = 'Этот username уже занят.';
        await signOut(auth); return;
      }
      await setDoc(doc(db, 'users', uid), { uid, name, username, email, createdAt: serverTimestamp(), avatarUrl: '' });
      await setDoc(unameRef, { uid });
      state.uid = uid;
      state.me = { uid, name, username, avatarUrl: '' };
      enterApp();
    } catch (e) {
      err.textContent = 'Ошибка: ' + (e.message || 'попробуй ещё раз');
    } finally {
      $('registerBtn').disabled = false;
      $('registerBtn').textContent = 'Зарегистрироваться';
    }
  };

  $('loginBtn').onclick = async () => {
    const email = $('logEmail').value.trim();
    const password = $('logPassword').value;
    const err = $('logErr');
    err.textContent = '';
    if (!email || !password) { err.textContent = 'Введите email и пароль'; return; }
    $('loginBtn').disabled = true;
    $('loginBtn').textContent = 'Вход...';
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e) {
      err.textContent = 'Неверный email или пароль';
    } finally {
      $('loginBtn').disabled = false;
      $('loginBtn').textContent = 'Войти';
    }
  };

  $('regUsername').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
  });
}

function enterApp() {
  $('registerScreen').classList.add('hidden');
  $('loginScreen').classList.add('hidden');
  $('app').classList.remove('hidden');
  $('myTag').textContent = '@' + state.me.username;
  
  if ("Notification" in window && Notification.permission !== "granted") {
    Notification.requestPermission();
  }

  bindSearch();
  bindComposer();
  bindTabs();
  bindProfile();
  listenToAllChats();
  loadExistingChats();
  fillProfileData();
}

function bindTabs() {
  $('navChats').onclick = () => {
    $('navChats').classList.add('active'); $('navProfile').classList.remove('active');
    $('chatsTab').classList.remove('hidden'); $('profileTab').classList.add('hidden');
  };
  $('navProfile').onclick = () => {
    $('navProfile').classList.add('active'); $('navChats').classList.remove('active');
    $('profileTab').classList.remove('hidden'); $('chatsTab').classList.add('hidden');
    fillProfileData();
  };
}

function fillProfileData() {
  $('profileName').value = state.me.name;
  $('profileUsername').value = state.me.username;
  if (state.me.avatarUrl) {
    $('myAvatarImg').src = state.me.avatarUrl;
    $('myAvatarImg').classList.remove('hidden');
    $('myAvatarPlaceholder').classList.add('hidden');
  } else {
    $('myAvatarImg').classList.add('hidden');
    $('myAvatarPlaceholder').classList.remove('hidden');
  }
}

function bindProfile() {
  $('avatarClickArea').onclick = () => $('avatarInput').click();
  
  $('avatarInput').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (ev) => {
      $('myAvatarImg').src = ev.target.result;
      $('myAvatarImg').classList.remove('hidden');
      $('myAvatarPlaceholder').classList.add('hidden');
    };
    reader.readAsDataURL(file);
    
    try {
      const formData = new FormData();
      formData.append('image', file);
      
      const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        const url = data.data.url;
        await setDoc(doc(db, 'users', state.uid), { avatarUrl: url }, { merge: true });
        state.me.avatarUrl = url;
        alert('Аватарка обновлена!');
      } else {
        alert('Ошибка загрузки фото');
      }
    } catch (err) {
      console.error(err);
      alert('Ошибка загрузки фото');
    }
  };

  $('saveProfileBtn').onclick = async () => {
    const newName = $('profileName').value.trim();
    const newUsername = $('profileUsername').value.trim().toLowerCase();
    
    if (!newName) return alert('Введите имя');
    if (!isValidUsername(newUsername)) return alert('Некорректный username');

    if (newUsername !== state.me.username) {
      const unameRef = doc(db, 'usernames', newUsername);
      const unameSnap = await getDoc(unameRef);
      if (unameSnap.exists()) return alert('Этот username уже занят');
      
      await setDoc(unameRef, { uid: state.uid });
      await setDoc(doc(db, 'users', state.uid), { name: newName, username: newUsername }, { merge: true });
      state.me.name = newName;
      state.me.username = newUsername;
      $('myTag').textContent = '@' + newUsername;
    } else {
      await setDoc(doc(db, 'users', state.uid), { name: newName }, { merge: true });
      state.me.name = newName;
    }
    alert('Профиль обновлен!');
  };

  $('logoutBtn').onclick = doLogout;
}

async function loadExistingChats() {
  const chatsRef = collection(db, 'chats');
  const q = query(chatsRef, where('users', 'array-contains', state.uid));
  const snap = await getDocs(q);
  
  snap.forEach(d => {
    const data = d.data();
    const otherUid = data.users.find(u => u !== state.uid);
    const otherUsername = data[`uname_${otherUid}`];
    const otherName = data[`name_${otherUid}`];
    if (otherUsername) {
      state.contacts[otherUsername] = { uid: otherUid,
