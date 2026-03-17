// ---
const ADMIN_EMAILS = ['admin@phoneforge.com', 'acbc37099@gmail.com'];

let currentUser = null;
let isAdmin = false;
let activeCategory = 'all';
let searchQuery = '';

let items = []; // Ab data Firebase se aayega!
let currentPage = 1;
const itemsPerPage = 25; // Ek baar mein sirf 25 items

// Firebase se live data mangwane ka function
function loadItemsFromFirebase() {
  db.collection("products").onSnapshot((querySnapshot) => {
    items = []; // Clear previous items
    querySnapshot.forEach((doc) => {
      let data = doc.data();
      data.id = doc.id; // Firebase ka asli ID
      items.push(data);
    });
    renderGrid(); // Refresh UI
  });
}

const CURRENCY_SUFFIX = '\u20B9';
const PLACEHOLDER_ICON = '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h2l1-2h10l1 2h2v12H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';
const SEARCH_ICON = '<svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
let newItemImage = '';
let editImageData = null;

function cleanPrice(value) {
  const raw = String(value == null ? '' : value).trim();
  if (!raw) return '';
  return raw.replace(/[^\d.]/g, '');
}

function formatPrice(value) {
  const cleaned = cleanPrice(value);
  if (!cleaned) return '';
  const num = Number(cleaned);
  if (!Number.isFinite(num)) return cleaned;
  const hasDecimal = cleaned.includes('.');
  const formatted = num.toLocaleString('en-IN', { maximumFractionDigits: hasDecimal ? 2 : 0 });
  return `${formatted}${CURRENCY_SUFFIX}`;
}

function formatPriceInput(value) {
  const cleaned = cleanPrice(value);
  if (!cleaned) return '';
  const num = Number(cleaned);
  if (!Number.isFinite(num)) return cleaned;
  const hasDecimal = cleaned.includes('.');
  return num.toLocaleString('en-IN', { maximumFractionDigits: hasDecimal ? 2 : 0 });
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeRegExp(value) {
  return String(value == null ? '' : value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function nameFromEmail(email) {
  if (!email) return 'Guest User';
  const local = String(email).split('@')[0] || '';
  const cleaned = local.replace(/[._-]+/g, ' ').trim();
  if (!cleaned) return 'Guest User';
  return cleaned.split(' ').filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
}

// SMART IMAGE COMPRESSOR & TYPE CHECK
function readImageFile(file, cb) {
  if (!file) { cb(''); return; }
  // SECURITY CHECK: ensure it is an image
  const name = (file.name || '').toLowerCase();
  const extOk = name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || name.endsWith('.webp');
  const typeOk = file.type && file.type.startsWith('image/');
  if (!(typeOk || extOk)) {
    alert("Security Alert: Only image files (JPG/PNG/WebP) are allowed.");
    cb('');
    return;
  }
  const reader = new FileReader();

  reader.onload = e => {
    // Create an offscreen image and draw on canvas (to reduce size)
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 600; // Photo ki max chaurai
      const MAX_HEIGHT = 600; // Photo ki max lambai
      let width = img.width;
      let height = img.height;

      // If image is large, scale it down
      if (width > height) {
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width *= MAX_HEIGHT / height;
          height = MAX_HEIGHT;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      // Compress to JPEG at 70% quality (0.7)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      cb(dataUrl); // Ab yeh compressed photo database mein jayegi
    };
    img.src = e.target.result;
  };

  reader.readAsDataURL(file);
}

function setImagePreview(el, dataUrl) {
  if (!el) return;
  if (dataUrl) {
    el.innerHTML = `<img src="${dataUrl}" alt="Preview"/>`;
  } else {
    el.innerHTML = '<div>No image selected</div>';
  }
}

// ---
const themeToggle = document.getElementById('themeToggle');
const themeIcon   = document.getElementById('themeIcon');
const storedTheme = localStorage.getItem('pf_theme');
let theme = storedTheme === 'dark' ? 'light' : (storedTheme || 'light');
applyTheme(theme);
localStorage.setItem('pf_theme', theme);

themeToggle.addEventListener('click', () => {
  theme = theme === 'dark' ? 'light' : 'dark';
  applyTheme(theme);
  localStorage.setItem('pf_theme', theme);
});

function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  themeIcon.innerHTML = t === 'dark'
    ? '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'
    : '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
}

// ---
// --- ADVANCED PAGINATION GRID ---
function renderGrid() {
  const grid = document.getElementById('productGrid');
  let filtered = items.filter(i => activeCategory === 'all' || i.cat === activeCategory);

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(i =>
      String(i.name || '').toLowerCase().includes(q) ||
      String(i.desc || '').toLowerCase().includes(q) ||
      String(i.cat || '').toLowerCase().includes(q)
    );
  }

  // PAGINATION LOGIC (Sirf 25 item nikalna)
  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  if (currentPage > totalPages) currentPage = totalPages || 1;
  if (currentPage < 1) currentPage = 1;

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = filtered.slice(startIndex, endIndex); // 25 Items ka data

  const labels = { all:'All Items', repair:'Repair Services', phone:'New Phones', product:'Products' };
  const labelSpans = { all:'Items', repair:'Services', phone:'Phones', product:'Products' };
  document.getElementById('sectionLabel').innerHTML =
    labels[activeCategory].replace(labelSpans[activeCategory], `<span>${labelSpans[activeCategory]}</span>`);

  if (!currentItems.length) {
    grid.innerHTML = `<div class="empty-state"><div>${SEARCH_ICON}</div><p>No items found. Try a different search or category.</p></div>`;
    let oldPagination = document.getElementById('paginationArea');
    if (oldPagination) oldPagination.remove(); // Empty hone par buttons hatao
    return;
  }

  // Sirf 25 items ko screen par banana
  grid.innerHTML = currentItems.map(item => {
    const safeCat = ['repair','phone','product'].includes(item.cat) ? item.cat : 'product';
    const safeId = item.id;
    const safeName = highlight(item.name);
    const safeDesc = item.desc && String(item.desc).trim() ? highlight(item.desc) : '';

    const hasImage = item.emoji && typeof item.emoji === 'string' && (item.emoji.startsWith('http') || item.emoji.startsWith('data:image/'));
    const safeEmoji = (!hasImage && item.emoji) ? escapeHtml(item.emoji) : '';

    const media = hasImage
      ? `<img src="${item.emoji}" alt="${escapeHtml(item.name)}"/>`
      : `<div class="card-placeholder">${safeEmoji || PLACEHOLDER_ICON}</div>`;

    return `
      <div class="card" style="animation-delay:${(currentItems.indexOf(item)*0.05)}s" onclick="openViewModal('${safeId}')">
        ${isAdmin ? `<button class="edit-card-btn" onclick="event.stopPropagation();openEditModal('${safeId}')" title="Edit">
          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>` : ''}
        <span class="card-badge badge-${safeCat}">${safeCat === 'repair' ? 'Repair' : safeCat === 'phone' ? 'Phone' : 'Product'}</span>
        <div class="card-img">${media}</div>
        <div class="card-body">
          <div class="card-name">${safeName}</div>
          ${safeDesc ? `<div class="card-desc">${safeDesc}</div>` : ''}
          <div class="card-footer">
            <div class="card-price">${formatPrice(item.price)}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Paginator render karna
  renderPagination(totalItems, totalPages);
}

// --- PAGINATION BUTTONS RENDERER ---
function renderPagination(totalItems, totalPages) {
  let oldPagination = document.getElementById('paginationArea');
  if (oldPagination) oldPagination.remove();

  if (totalPages <= 1) return; // Agar 25 se kam item hain toh button mat dikhao

  const mainWrap = document.querySelector('.main-wrap');

  // Sundar Next/Prev Buttons
  const paginationHTML = `
    <div id="paginationArea" style="display:flex; justify-content:center; align-items:center; gap:1.5rem; margin-top:3rem; padding-bottom:1rem;">
      <button onclick="changePage(-1)" ${currentPage === 1 ? 'disabled' : ''}
        style="padding:0.7rem 1.4rem; border-radius:999px; background:var(--bg3); border:1px solid var(--border); color:${currentPage === 1 ? 'var(--muted)' : 'var(--text)'}; cursor:${currentPage === 1 ? 'not-allowed' : 'pointer'}; font-weight:700; font-family:'Syne',sans-serif; transition:all 0.2s;">
        &larr; Prev
      </button>

      <span style="font-family:'Syne',sans-serif; font-weight:800; font-size:1.1rem; color:var(--accent);">
        ${currentPage} <span style="color:var(--muted); font-weight:600; font-size:0.9rem;">/ ${totalPages}</span>
      </span>

      <button onclick="changePage(1)" ${currentPage === totalPages ? 'disabled' : ''}
        style="padding:0.7rem 1.4rem; border-radius:999px; background:var(--bg3); border:1px solid var(--border); color:${currentPage === totalPages ? 'var(--muted)' : 'var(--text)'}; cursor:${currentPage === totalPages ? 'not-allowed' : 'pointer'}; font-weight:700; font-family:'Syne',sans-serif; transition:all 0.2s;">
        Next &rarr;
      </button>
    </div>
  `;

  mainWrap.insertAdjacentHTML('beforeend', paginationHTML);
}

// --- PAGE CHANGE HONE PAR SCROLL UPAR KARNA ---
function changePage(direction) {
  currentPage += direction;
  renderGrid();

  // Page badalne par smoothly wapas upar le jana
  const catBar = document.querySelector('.cat-bar');
  if (catBar) {
    window.scrollTo({ top: catBar.offsetTop - 20, behavior: 'smooth' });
  }
}

// --- VIEW MODAL ---
function openViewModal(id) {
  const item = items.find(i => i.id === id);
  if (!item) return;

  const safeCat = ['repair','phone','product'].includes(item.cat) ? item.cat : 'product';
  const hasImage = item.emoji && typeof item.emoji === 'string' && (item.emoji.startsWith('http') || item.emoji.startsWith('data:image/'));
  const safeEmoji = (!hasImage && item.emoji) ? escapeHtml(item.emoji) : '';
  const media = hasImage
    ? `<img src="${item.emoji}" alt="${escapeHtml(item.name)}" style="width:100%;height:220px;object-fit:cover;border-radius:12px;display:block;margin-bottom:1.25rem;"/>`
    : `<div style="width:100%;height:180px;border-radius:12px;background:var(--bg3);display:flex;align-items:center;justify-content:center;margin-bottom:1.25rem;color:var(--muted);">${safeEmoji ? `<span style="font-size:4rem;">${safeEmoji}</span>` : PLACEHOLDER_ICON}</div>`;

  const catLabel = safeCat === 'repair' ? 'Repair' : safeCat === 'phone' ? 'Phone' : 'Product';
  const badgeClass = `badge-${safeCat}`;

  const viewModal = document.getElementById('addModal');
  const viewContent = document.getElementById('addContent');

  viewContent.innerHTML = `
    ${media}
    <span class="card-badge ${badgeClass}" style="position:static;display:inline-block;margin-bottom:0.75rem;">${catLabel}</span>
    <div style="font-family:'Syne',sans-serif;font-weight:800;font-size:1.35rem;margin-bottom:0.5rem;line-height:1.3;">${escapeHtml(item.name)}</div>
    <div style="font-size:0.9rem;color:var(--muted);margin-bottom:1rem;line-height:1.6;">${escapeHtml(item.desc)}</div>
    <div style="display:flex;align-items:center;justify-content:space-between;padding-top:1rem;border-top:1px solid var(--border);">
      <div style="font-family:'Syne',sans-serif;font-weight:800;font-size:1.5rem;color:var(--accent);">${formatPrice(item.price)}</div>
    </div>
  `;

  viewModal.classList.add('open');
}

function highlight(text) {
  const safeText = escapeHtml(text);
  if (!searchQuery) return safeText;
  const re = new RegExp(`(${escapeRegExp(searchQuery)})`, 'gi');
  return safeText.replace(re, '<mark>$1</mark>');
}

// --- CATEGORY TABS ---
document.querySelectorAll('.cat-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    activeCategory = tab.dataset.cat;
    currentPage = 1; // FIX: Nayi category par Page 1 se shuru karein
    renderGrid();
  });
});

// --- SEARCH BOX ---
document.getElementById('searchInput').addEventListener('input', e => {
  searchQuery = e.target.value.trim();
  currentPage = 1; // FIX: Naye search par Page 1 se shuru karein
  renderGrid();
});

// ---
const chatFab   = document.getElementById('chatFab');
const chatbox   = document.getElementById('chatbox');
const chatClose = document.getElementById('chatClose');
const chatInput = document.getElementById('chatInput');
const chatSend  = document.getElementById('chatSend');
const chatMsgs  = document.getElementById('chatMsgs');

chatFab.addEventListener('click',   () => chatbox.classList.add('open'));
chatClose.addEventListener('click', () => chatbox.classList.remove('open'));

// 1. Send user message to Firebase (silent)
async function sendChatMsg() {
  const txt = chatInput.value.trim();
  if (!txt) return;

  // Get user name and phone (fallback to Guest)
  let senderName = currentUser ? currentUser.name : "Guest User";
  let senderPhone = currentUser ? currentUser.phone : "Not Provided";

  try {
    // Save in "inquiries" collection
    await db.collection("inquiries").add({
      name: senderName,
      phone: senderPhone,
      message: txt,
      timestamp: Date.now()
    });

    chatInput.value = ''; // Clear input
    chatbox.classList.remove('open'); // Close chatbox
    showToast('Your message has been sent to the admin! ✅'); // User confirmation

  } catch (error) {
    alert("Error sending message: " + error.message);
  }
}
chatSend.addEventListener('click', sendChatMsg);
chatInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendChatMsg(); });

// ---
const profileBtn  = document.getElementById('profileBtn');
const profileAvatar = document.getElementById('profileAvatar');
const authModal   = document.getElementById('authModal');
const authClose   = document.getElementById('authClose');
const authContent = document.getElementById('authContent');

profileBtn.addEventListener('click', () => {
  if (currentUser) { renderUserDash(); }
  else { renderLogin(); }
  authModal.classList.add('open');
});
authClose.addEventListener('click', () => authModal.classList.remove('open'));
authModal.addEventListener('click', e => { if(e.target===authModal) authModal.classList.remove('open'); });

function renderLogin() {
  authContent.innerHTML = `
    <div class="modal-title">Welcome Back</div>
    <div class="modal-sub">Sign in to your Digital Zone account</div>
    <div class="input-group">
      <label>Email Address</label>
      <input type="email" id="loginEmail" placeholder="you@example.com"/>
    </div>
    <div class="input-group">
      <label>Password</label>
      <input type="password" id="loginPass" placeholder="********"/>
    </div>
    <button class="btn-primary" id="doLogin">Sign In</button>
    <div class="divider">or</div>
    <button class="btn-google" id="doGoogle">
      <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.2 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C33.9 6.5 29.2 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 20-9 20-20 0-1.3-.1-2.7-.4-4z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16 19 13 24 13c3 0 5.7 1.1 7.8 2.9l5.7-5.7C33.9 6.5 29.2 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5.1l-6.2-5.2C29.3 35.5 26.8 36 24 36c-5.2 0-9.6-2.8-11.3-7h-6.6C9.7 39.6 16.3 44 24 44z"/><path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.7l6.2 5.2C41 35.2 44 30 44 24c0-1.3-.1-2.7-.4-4z"/></svg>
      Continue with Google
    </button>
    <p style="text-align:center;margin-top:1rem;font-size:0.82rem;color:var(--muted)">
      No account? <span style="color:var(--accent);cursor:pointer;" id="switchSignup">Sign up</span>
    </p>`;

  document.getElementById('doLogin').addEventListener('click', () => {
    const email = document.getElementById('loginEmail').value.trim();
    const pass  = document.getElementById('loginPass').value;
    if (!email) return alert('Enter your email.');
    loginUser({ name: email.split('@')[0], email, phone:'-', location:'-', google:false });
  });
  document.getElementById('doGoogle').addEventListener('click', () => {
    // FIX: Mobile devices block popups, so use Redirect there
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;

    if (isMobile) {
      // Mobile: Google Redirect
      auth.signInWithRedirect(provider);
    } else {
      // Desktop: Google Popup
      auth.signInWithPopup(provider).then(() => {
        authModal.classList.remove('open');
      }).catch((error) => {
        alert("Login Error: " + error.message);
      });
    }
  });
  document.getElementById('switchSignup').addEventListener('click', renderSignup);
}

function renderSignup() {
  authContent.innerHTML = `
    <div class="modal-title">Create Account</div>
    <div class="modal-sub">Join Digital Zone today</div>
    <div class="input-group"><label>Full Name</label><input type="text" id="suName" placeholder="John Doe"/></div>
    <div class="input-group"><label>Email</label><input type="email" id="suEmail" placeholder="you@example.com"/></div>
    <div class="input-group"><label>Phone</label><input type="text" id="suPhone" placeholder="+91 98765 43210"/></div>
    <div class="input-group"><label>Password</label><input type="password" id="suPass" placeholder="********"/></div>
    <button class="btn-primary" id="doSignup">Create Account</button>
    <div class="divider">or</div>
    <button class="btn-google" id="doGoogleSu">
      <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.2 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C33.9 6.5 29.2 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 20-9 20-20 0-1.3-.1-2.7-.4-4z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16 19 13 24 13c3 0 5.7 1.1 7.8 2.9l5.7-5.7C33.9 6.5 29.2 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5.1l-6.2-5.2C29.3 35.5 26.8 36 24 36c-5.2 0-9.6-2.8-11.3-7h-6.6C9.7 39.6 16.3 44 24 44z"/><path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.7l6.2 5.2C41 35.2 44 30 44 24c0-1.3-.1-2.7-.4-4z"/></svg>
      Sign up with Google
    </button>
    <p style="text-align:center;margin-top:1rem;font-size:0.82rem;color:var(--muted)">
      Have an account? <span style="color:var(--accent);cursor:pointer;" id="switchLogin">Sign in</span>
    </p>`;

  document.getElementById('doSignup').addEventListener('click', () => {
    const name  = document.getElementById('suName').value.trim();
    const email = document.getElementById('suEmail').value.trim();
    const phone = document.getElementById('suPhone').value.trim();
    if (!name || !email) return alert('Please fill name and email.');
    loginUser({ name, email, phone: phone||'-', location:'-', google:false });
  });
  document.getElementById('doGoogleSu').addEventListener('click', () => {
    // FIX: Use real Google login instead of prompt
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;

    if (isMobile) {
      auth.signInWithRedirect(provider);
    } else {
      auth.signInWithPopup(provider).then(() => {
        authModal.classList.remove('open');
      }).catch((error) => {
        alert("Login Error: " + error.message);
      });
    }
  });
  document.getElementById('switchLogin').addEventListener('click', renderLogin);
}

function loginUser(user) {
  currentUser = user;
  isAdmin = ADMIN_EMAILS.includes(user.email.toLowerCase());
  document.getElementById('profileDot').style.display = 'block';
  document.getElementById('addFab').classList.toggle('show', isAdmin);
  authModal.classList.remove('open');
  renderGrid();
  if (isAdmin) showToast('Admin mode activated');
  else showToast(`Welcome, ${user.name}!`);
}

// 1. Dashboard UI (Asli Google DP ke sath)
function renderUserDash() {
  const u = currentUser;
  let displayName = (u.name && u.name !== "Unknown" && u.name !== "null") ? u.name : nameFromEmail(u.email);
  const safeName = escapeHtml(displayName);
  const safeEmail = escapeHtml(u.email);
  const safePhone = escapeHtml(u.phone);
  const safeLocation = escapeHtml(u.location);

    // Check if user has Google profile photo
  let avatarHTML = '';
  if (u.photo) {
    // Agar Google DP hai, toh Gol Photo dikhao
    avatarHTML = `<img src="${escapeHtml(u.photo)}" alt="Profile" style="width:72px; height:72px; border-radius:50%; object-fit:cover; margin: 0 auto 1rem; display:block; border:2px solid var(--accent); box-shadow: 0 4px 15px rgba(108,99,255,0.3);">`;
  } else {
    // If not, show initials
    const initials = displayName.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
    avatarHTML = `<div class="avatar-circle">${escapeHtml(initials)}</div>`;
  }

  authContent.innerHTML = `
    ${avatarHTML}
    <div style="text-align:center;margin-bottom:1.25rem;">
      <div style="font-family:'Syne',sans-serif;font-weight:800;font-size:1.2rem;">${safeName}</div>
      <div style="font-size:0.8rem;color:var(--muted);margin-top:0.2rem;">${safeEmail} ${isAdmin?'<span class="admin-pill">Admin</span>':''}</div>
    </div>

    <div class="user-info-row" id="phoneRow">
      <span class="label">Phone</span>
      <span>${safePhone} <span class="edit-link" onclick="inlineEdit('phone')">Edit</span></span>
    </div>

    <div class="user-info-row" id="locationRow">
      <span class="label">Location</span>
      <span>${safeLocation} <span class="edit-link" onclick="inlineEdit('location')">Edit</span></span>
    </div>

    ${isAdmin ? `<div style="margin-top:1rem;"><button class="btn-primary" style="background:rgba(255,107,107,0.15);color:var(--accent2);border:1px solid rgba(255,107,107,0.3);" onclick="openMsgPanel()">📬 View Messages</button></div>` : ''}
    <div style="margin-top:1rem;">
      <button class="btn-primary" style="background:var(--bg3);color:var(--text);" onclick="logout()">Sign Out</button>
    </div>`;
}

// 2. Naya Box (Input Field)
function inlineEdit(field) {
  const row = document.getElementById(field + 'Row');
  const currentValue = (currentUser[field] === 'Not Provided' || currentUser[field] === 'India') ? '' : currentUser[field];
  const isPhone = field === 'phone';

  row.innerHTML = `
    <span class="label" style="text-transform: capitalize;">${field}</span>
    <div style="display:flex; gap:0.5rem; align-items:center;">
      <input type="${isPhone ? 'tel' : 'text'}" id="editInput_${field}" value="${escapeHtml(currentValue)}" placeholder="Enter ${field}..."
        ${isPhone ? 'inputmode="numeric" pattern="[0-9]*" maxlength="12" oninput="this.value=this.value.replace(/\\D/g, \'\').slice(0, 12)"' : ''}
        style="padding:0.4rem 0.6rem; border-radius:6px; border:1px solid var(--accent); background:var(--bg3); color:var(--text); width:130px; font-size:0.85rem; outline:none;" autofocus>
      <button onclick="saveField('${field}')" style="background:var(--accent); color:white; border:none; border-radius:6px; padding:0.4rem 0.8rem; font-size:0.8rem; cursor:pointer; font-weight:bold;">Save</button>
    </div>
  `;
}

// 3. Save button: write profile to Firebase
async function saveField(field) {
  const input = document.getElementById('editInput_' + field);
  if (input) {
    let val = input.value.trim();
    if (field === 'phone') {
      val = val.replace(/\D/g, '');
      if (val && (val.length < 10 || val.length > 12)) {
        showToast('Phone number must be 10-12 digits.');
        return;
      }
    }
    currentUser[field] = val || (field === 'location' ? 'India' : 'Not Provided');

    try {
      await db.collection("users").doc(currentUser.uid).set({
        phone: currentUser.phone,
        location: currentUser.location,
        email: currentUser.email,
        name: currentUser.name
      }, { merge: true });

      showToast('Profile Updated! ✅');
    } catch (error) {
      // If Firebase blocks, show the error
      alert("Save failed! Firebase Error: " + error.message);
    }

    renderUserDash();
  }
}

function logout() {
  auth.signOut().then(() => {
    authModal.classList.remove('open');
    showToast('Signed out successfully 🔒');
  });
}

// 2. Admin inbox: show all inquiries
function openMsgPanel() {
  authModal.classList.remove('open');
  const editMod = document.getElementById('editModal');

  // Firebase se saare messages nikalna (Naye message sabse upar aayenge)
  db.collection("inquiries").orderBy("timestamp", "desc").onSnapshot((snapshot) => {
    let msgHTML = `<div class="modal-title" style="margin-bottom:1rem;">📬 User Inquiries</div>`;

    if (snapshot.empty) {
      msgHTML += `<div style="color:var(--muted); font-size:0.9rem;">No messages yet.</div>`;
    }

    // Har ek message ke liye ek dabba banana
    snapshot.forEach((doc) => {
      let m = doc.data();
      const name = escapeHtml(m.name);
      const phone = escapeHtml(m.phone);
      const message = escapeHtml(m.message);
      const reply = escapeHtml(m.reply);

      msgHTML += `
        <div style="background:var(--bg3);border-radius:12px;padding:0.85rem;margin-bottom:0.75rem;border:1px solid var(--border);">
          <div style="font-weight:700;font-size:0.95rem;color:var(--accent);margin-bottom:0.25rem;">
            👤 ${name}
          </div>
          <div style="font-size:0.8rem;color:var(--muted);margin-bottom:0.4rem;">
            📞 Phone: ${phone}
          </div>
          <div style="font-size:0.9rem;color:var(--text);">
            💬 ${message}
          </div>
          ${m.reply ? `<div style="font-size:0.8rem;color:var(--accent3);margin-top:0.5rem;">✅ Replied: ${reply}</div>` : ''}
          <div style="display:flex;gap:0.4rem;margin-top:0.6rem;">
            <input id="rep_${doc.id}" type="text" value="${reply}" placeholder="Type reply…"
              style="flex:1;padding:0.4rem 0.75rem;border-radius:8px;background:var(--bg2);border:1px solid var(--border);color:var(--text);font-size:0.82rem;outline:none;"/>
            <button onclick="sendInquiryReply('${doc.id}')" style="padding:0.4rem 0.8rem;background:var(--accent);color:#fff;border:none;border-radius:8px;font-family:'Syne',sans-serif;font-weight:700;font-size:0.78rem;cursor:pointer;">
              Send Reply
            </button>
          </div>
          <button onclick="deleteInquiry('${doc.id}')" style="margin-top:10px;padding:0.3rem 0.8rem;background:rgba(255,107,107,0.15);color:var(--accent2);border:1px solid rgba(255,107,107,0.3);border-radius:6px;font-size:0.75rem;cursor:pointer;">
            🗑️ Delete
          </button>
        </div>`;
    });

    document.getElementById('editContent').innerHTML = msgHTML;
  });

  editMod.classList.add('open');
}

// 3. Admin can delete a message after reading
async function deleteInquiry(id) {
  if(confirm("Are you sure you want to delete this message?")) {
    await db.collection("inquiries").doc(id).delete();
    showToast("Message deleted! 🗑️");
  }
}

// 4. Update admin reply in Firebase
async function sendInquiryReply(id) {
  const input = document.getElementById(`rep_${id}`);
  if (!input) return;
  const reply = input.value.trim();
  if (!reply) {
    showToast('Please type a reply.');
    return;
  }
  try {
    await db.collection("inquiries").doc(id).set({
      reply,
      repliedAt: Date.now()
    }, { merge: true });
    showToast('Reply sent! ✅');
  } catch (e) {
    alert('Reply error: ' + e.message);
  }
}

// ---
const editModal   = document.getElementById('editModal');
const editClose   = document.getElementById('editClose');
const editContent = document.getElementById('editContent');

editClose.addEventListener('click', () => editModal.classList.remove('open'));
editModal.addEventListener('click', e => { if(e.target===editModal) editModal.classList.remove('open'); });

function openEditModal(id) {
  const item = items.find(i=>i.id===id);
  if (!item) return;
  editImageData = null;

  editContent.innerHTML = `
    <div class="modal-title">Edit Item</div>
    <div class="modal-sub">Update the details below</div>
    <div class="input-group"><label>Name</label><input id="eName" type="text" value="${escapeHtml(item.name)}"/></div>
    <div class="input-group"><label>Price (${CURRENCY_SUFFIX} auto-added)</label><input id="ePrice" type="number" inputmode="numeric" onkeydown="return ['Backspace','Delete','Tab','Escape','Enter','ArrowLeft','ArrowRight'].includes(event.code) || /[0-9]/.test(event.key)" value="${cleanPrice(item.price)}"/></div>
    <div class="input-group"><label>Description</label><input id="eDesc" type="text" value="${escapeHtml(item.desc)}"/></div>
    <div class="input-group">
      <label>Image</label>
      <input id="eImage" class="image-input" type="file" accept="image/jpeg, image/jpg, image/png, image/webp, .jpg, .jpeg, .png, .webp"/>
      <div class="image-preview" id="eImagePreview"></div>
    </div>
    <div style="display:flex;gap:0.75rem;margin-top:0.5rem;">
      <button class="btn-primary" onclick="saveEdit('${item.id}')">Save Changes</button>
      <button class="btn-primary" style="background:rgba(255,107,107,0.15);color:var(--accent2);border:1px solid rgba(255,107,107,0.3);" onclick="deleteItem('${item.id}')">Delete</button>
    </div>`;

  editModal.classList.add('open');

  const eImage = document.getElementById('eImage');
  const eImagePreview = document.getElementById('eImagePreview');

  // FIX: Purani photo ko preview mein dikhane ke liye item.emoji use kiya hai
  setImagePreview(eImagePreview, item.emoji && item.emoji.startsWith('data:') ? item.emoji : '');

  eImage.addEventListener('change', () => {
    const file = eImage.files && eImage.files[0];
    readImageFile(file, dataUrl => {
      editImageData = dataUrl || '';
      setImagePreview(eImagePreview, dataUrl);
    });
  });
}

async function saveEdit(id) {
  const item = items.find(i=>i.id===id);
  const newName = document.getElementById('eName').value.trim() || item.name;
  const priceVal = document.getElementById('ePrice').value.trim() || item.price;
  const newDesc = document.getElementById('eDesc').value.trim() || item.desc;

  let newImage = item.emoji; // Purani photo rakho
  if (editImageData !== null) {
     newImage = editImageData; // Agar nayi photo chuni hai toh wo le lo
  }

  try {
    // Update that item in Firebase
    await db.collection("products").doc(id).update({
      name: newName,
      price: priceVal,
      desc: newDesc,
      emoji: newImage
    });

    editModal.classList.remove('open');
    showToast('Item Updated in Database! 🔄');
  } catch(error) {
    alert("Update error: " + error.message);
  }
}
async function deleteItem(id) {
  if (!confirm('Are you sure you want to delete this item?')) return;

  try {
    // Permanently delete from Firebase
    await db.collection("products").doc(id).delete();
    editModal.classList.remove('open');
    showToast('Item Deleted permanently 🗑️');
  } catch(error) {
    alert("Delete error: " + error.message);
  }
}

// ---
const addModal   = document.getElementById('addModal');
const addClose   = document.getElementById('addClose');
const addContent = document.getElementById('addContent');
const addFab     = document.getElementById('addFab');

addClose.addEventListener('click', () => addModal.classList.remove('open'));
addModal.addEventListener('click', e => { if(e.target===addModal) addModal.classList.remove('open'); });

addFab.addEventListener('click', () => {
  // Reset to add-item mode
  newItemImage = '';
  addContent.innerHTML = `
    <div class="modal-title">Add New Item</div>
    <div class="modal-sub">Fill in the details for the new listing</div>
    <div class="input-group"><label>Category</label>
      <select id="nCat" style="width:100%;padding:0.65rem 1rem;background:var(--bg3);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:0.9rem;outline:none;">
        <option value="repair">Repair</option>
        <option value="phone">Phone</option>
        <option value="product">Product</option>
      </select>
    </div>
    <div class="input-group"><label>Name</label><input id="nName" type="text" placeholder="e.g. Back Glass Replacement"/></div>
    <div class="input-group"><label>Price (${CURRENCY_SUFFIX} auto-added)</label><input id="nPrice" type="tel" inputmode="numeric" oninput="this.value=this.value.replace(/[^0-9]/g, '')" placeholder="e.g. 12000"/></div>
    <div class="input-group"><label>Description</label><input id="nDesc" type="text" placeholder="Short description..."/></div>
    <div class="input-group">
      <label>Image</label>
      <input id="nImage" class="image-input" type="file" accept="image/jpeg, image/jpg, image/png, image/webp, .jpg, .jpeg, .png, .webp"/>
      <div class="image-preview" id="nImagePreview"></div>
    </div>
    <button class="btn-primary" onclick="addItem()">Add to Store</button>`;
  addModal.classList.add('open');
  const nImage = document.getElementById('nImage');
  const nImagePreview = document.getElementById('nImagePreview');
  setImagePreview(nImagePreview, '');
  nImage.addEventListener('change', () => {
    const file = nImage.files && nImage.files[0];
    readImageFile(file, dataUrl => {
      newItemImage = dataUrl || '';
      setImagePreview(nImagePreview, dataUrl);
    });
  });
});

async function addItem() {
  const cat = document.getElementById('nCat').value;
  const name = document.getElementById('nName').value.trim();
  const price = document.getElementById('nPrice').value.trim();
  const desc = document.getElementById('nDesc').value.trim() || 'No description.';

  if (!name || !price) return alert('Name and price are required.');

  let imageUrl = '📦'; // Default emoji

  // If user uploaded a photo, use its Base64 data
  if (newItemImage) {
    imageUrl = newItemImage;
  }

  try {
    // Save Base64 image directly in the database
    await db.collection("products").add({
      cat: cat,
      name: name,
      price: price,
      desc: desc,
      emoji: imageUrl
    });

    addModal.classList.remove('open');
    showToast('Item added to Database! ✅');
  } catch (error) {
    alert("Add Error: " + error.message);
  }
}

// ---
function showToast(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = `
    position:fixed;bottom:6rem;left:50%;transform:translateX(-50%);
    background:var(--accent);color:#fff;
    padding:0.6rem 1.25rem;border-radius:999px;
    font-family:'Syne',sans-serif;font-weight:600;font-size:0.85rem;
    box-shadow:0 8px 30px rgba(108,99,255,0.4);z-index:999;
    animation:fadeUp 0.3s ease;white-space:nowrap;
  `;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(), 2800);
}

// ---
// Load data on page load
loadItemsFromFirebase();

// 4. Asli Google Login aur Data Loading
auth.onAuthStateChanged(async (user) => {
  if (user) {
    currentUser = {
      uid: user.uid,
      name: user.displayName || nameFromEmail(user.email),
      email: user.email,
      photo: user.photoURL, // <-- ASLI GOOGLE DP YAHAN SE AAYEGI
      phone: 'Not Provided',
      location: 'India'
    };

    try {
      // Load saved profile from Firebase
      const userDoc = await db.collection("users").doc(user.uid).get();
      if (userDoc.exists) {
        const dbData = userDoc.data();
        currentUser.phone = dbData.phone || 'Not Provided';
        currentUser.location = dbData.location || 'India';
      }
    } catch (e) {
      console.log("Profile data could not be loaded: ", e);
    }

    isAdmin = ADMIN_EMAILS.includes(user.email.toLowerCase());
    document.getElementById('profileDot').style.display = 'block';
    document.getElementById('addFab').classList.toggle('show', isAdmin);
    if (profileAvatar && currentUser.photo) {
      profileAvatar.src = currentUser.photo;
      profileAvatar.style.display = 'block';
      profileBtn.classList.add('has-avatar');
    } else if (profileAvatar) {
      profileAvatar.removeAttribute('src');
      profileAvatar.style.display = 'none';
      profileBtn.classList.remove('has-avatar');
    }

    renderGrid();
  } else {
    currentUser = null;
    isAdmin = false;
    document.getElementById('profileDot').style.display = 'none';
    document.getElementById('addFab').classList.remove('show');
    if (profileAvatar) {
      profileAvatar.removeAttribute('src');
      profileAvatar.style.display = 'none';
      profileBtn.classList.remove('has-avatar');
    }
    renderGrid();
  }
});
