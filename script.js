// Import the necessary Firebase functions
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    GoogleAuthProvider, 
    signInWithPopup,
    createUserWithEmailAndPassword,   
    signInWithEmailAndPassword,        
    updateProfile  
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    serverTimestamp, 
    onSnapshot, 
    query, 
    setLogLevel 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- CONSTANTS AND GLOBAL STATE ---
const PUBLIC_COLLECTION_NAME = 'blogs';
window.isFirebaseReady = false; 
window.allPosts = []; // Global array to store ALL posts fetched from Firestore
window.selectedLanguageFilter = 'all'; // State variable for language filtering

// --- PAGINATION STATE ---
window.postsPerPage = 5;
window.currentPage = 1; // Tracks how many pages have been loaded

// =======================================================
// 🚨 FIREBASE CONFIGURATION
// -------------------------------------------------------


const FIREBASE_CONFIG = {
    apiKey:"AIzaSyB0kRQlH9WGg6oWoWZPMwDmfss5m1TT9ZY",
    authDomain: "spaceandstories-65215.firebaseapp.com",
    projectId: "spaceandstories-65215",
    storageBucket: "spaceandstories-65215.firebasestorage.app",
    messagingSenderId: "1034945453909",
    appId: "1:1034945453909:web:ff40a60be6d58fc6e3d9dc",
    measurementId: "G-8Y8YRP3NSL"
}

const APP_ID = FIREBASE_CONFIG.projectId || 'default-app-id';

function setPublishButtonState(ready, userId) {
    const button = document.getElementById('publish-button');
    if (!button) return;

    if (ready) {
        button.disabled = false;
        button.innerHTML = `<i data-lucide="send" class="w-5 h-5 inline mr-2"></i> Publish`;
        button.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-gray-400');
        button.classList.add('bg-pastel-primary', 'hover:bg-pastel-primary/90');
    } else {
        button.disabled = true;
        button.innerHTML = `<i data-lucide="loader-circle" class="w-5 h-5 inline mr-2 animate-spin"></i> Initializing...`;
        button.classList.add('opacity-50', 'cursor-not-allowed', 'bg-gray-400');
        button.classList.remove('bg-pastel-primary', 'hover:bg-pastel-primary/90');
    }
    if (window.lucide) lucide.createIcons();
}

window.initializeFirebase = async () => {
    const statusElement = document.getElementById('profile-status-text');
    // These IDs match the HTML we updated earlier
    const authUI = document.getElementById('auth-ui-container');
    const userInfo = document.getElementById('user-info-container');
    
    setPublishButtonState(false); 

    try {
        const app = initializeApp(FIREBASE_CONFIG);
        const db = getFirestore(app);
        const auth = getAuth(app);
        
        window.db = db;
        window.auth = auth;
        window.appId = APP_ID; 

        // Listen for Auth changes (Google Login or Logout)
        onAuthStateChanged(auth, (user) => {
            if (user) {
                // USER IS LOGGED IN
                window.userId = user.uid;
                window.isFirebaseReady = true;
                setPublishButtonState(true, user.uid);

                // Update UI for Logged In State
                if (authUI) authUI.classList.add('hidden');
                if (userInfo) {
                    userInfo.classList.remove('hidden');
                    const nameRow = !user.displayName ? `
                    <div class="mt-2">
                        <input id="set-name-input" type="text" placeholder="Set your display name" class="w-full text-xs p-2 mb-1 rounded bg-pastel-input border border-pastel-primary/30 outline-none"/>
                        <button onclick="window.setDisplayName()" class="w-full text-xs bg-pastel-primary text-white py-1 rounded hover:bg-pastel-primary/90">Save Name</button>
                    </div>` : '';
                    userInfo.innerHTML = `
                        <p class="text-sm font-medium text-pastel-text mb-1 truncate">Hi, ${user.displayName || 'Explorer'}</p>
                        <hr class="my-2 border-pastel-input"/>
                        <button onclick="window.auth.signOut()" class="flex items-center text-red-500 hover:text-red-700 w-full justify-start text-xs">
                             <i data-lucide="log-out" class="w-4 h-4 mr-2"></i> Log Out
                        </button>
                    `;
                    if (window.lucide) lucide.createIcons();
                }
                if (statusElement) statusElement.innerHTML = `<span class="text-green-600 font-bold">Logged In</span>`;
                
            } else {
                // USER IS LOGGED OUT
                window.userId = null;
                window.isFirebaseReady = false;
                setPublishButtonState(false);

                // Update UI for Logged Out State
                if (authUI) authUI.classList.remove('hidden');
                if (userInfo) userInfo.classList.add('hidden');
                if (statusElement) statusElement.innerHTML = `Not signed in`;
            }

            // Always start the listener so everyone can see the feed
            window.setupPostListener(db, APP_ID);
            document.body.classList.add('firebase-ready');
        });

    } catch (error) {
        console.error("Fatal error during Firebase initialization:", error);
        if (statusElement) statusElement.textContent = `Initialization Failed: ${error.message}`;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(window.initializeFirebase, 100); 
    window.changeView('feed'); 
    
    const publishButton = document.getElementById('publish-button');
    if (publishButton) publishButton.addEventListener('click', window.publishPost);

    const matchButton = document.getElementById('match-button');
    if (matchButton) matchButton.addEventListener('click', window.getComfortRecommendations);

    window.updateLanguageFilterUI('all');
});

window.setupPostListener = (db, appId) => {
    const postsCollectionPath = `artifacts/${appId}/public/data/${PUBLIC_COLLECTION_NAME}`;
    const postsQuery = query(collection(db, postsCollectionPath));

    onSnapshot(postsQuery, (snapshot) => {
        const posts = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            posts.push({ id: doc.id, ...data });
        });
        posts.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));
        window.allPosts = posts; 
        window.currentPage = 1; 
        window.filterAndRenderPosts(); 
    }, (error) => {
        console.error("Error setting up listener:", error);
        displayMessage(`Failed to load feed data: ${error.message}.`, true);
    });
};

window.loadMorePosts = () => {
    window.currentPage += 1;
    window.filterAndRenderPosts();
    document.getElementById('feed-posts-container').scrollIntoView({ behavior: 'smooth', block: 'end' });
}

window.filterAndRenderPosts = () => {
    let filteredPosts = window.allPosts;
    const filter = window.selectedLanguageFilter;
    if (filter !== 'all') filteredPosts = window.allPosts.filter(post => post.language === filter);
    
    const startIndex = 0;
    const endIndex = window.currentPage * window.postsPerPage;
    const postsToRender = filteredPosts.slice(startIndex, endIndex);

    const viewMoreButton = document.getElementById('view-more-button');
    if (viewMoreButton) {
        if (postsToRender.length < filteredPosts.length) viewMoreButton.classList.remove('hidden');
        else viewMoreButton.classList.add('hidden');
    }
    window.renderPosts(postsToRender); 
};

window.updateLanguageFilterUI = (language) => {
    const displayElement = document.getElementById('current-language-display-text');
    const languageMap = { 'all': 'All', 'english': 'English', 'hindi': 'Hindi (हिंदी)', 'bengali': 'Bengali (বাংলা)' };
    if (displayElement) displayElement.textContent = `Language: ${languageMap[language]}`;
    document.querySelectorAll('.language-filter').forEach(link => link.classList.remove('font-bold'));
    const activeLink = document.getElementById(`filter-link-${language}`);
    if (activeLink) activeLink.classList.add('font-bold');
};

window.applyLanguageFilter = (language) => {
    window.selectedLanguageFilter = language;
    window.updateLanguageFilterUI(language);
    window.currentPage = 1; 
    window.filterAndRenderPosts();
}

window.renderPosts = (posts) => {
    const feedContainer = document.getElementById('feed-posts-container');
    if (!feedContainer) return;

    const loadingState = document.getElementById('feed-loading-state');
    if (loadingState) loadingState.remove();

    feedContainer.innerHTML = '';
    
    if (posts.length === 0) {
        const emptyMessage = window.selectedLanguageFilter === 'all' 
            ? `Welcome! Be the first to post!`
            : `No posts found for the selected language.`;

        feedContainer.innerHTML = `<div class="p-8 text-center bg-white/80 rounded-xl shadow-lg ring-1 ring-pastel-primary/10"><i data-lucide="inbox" class="w-10 h-10 mx-auto text-pastel-accent mb-3"></i><p class="text-xl font-semibold text-pastel-text">${emptyMessage}</p></div>`;
        if (window.lucide) lucide.createIcons();
        return;
    }

    posts.forEach(post => {
        const authorInitial = (post.authorName || post.userId || '?')[0].toUpperCase();
        const date = post.timestamp?.toDate ? post.timestamp.toDate() : new Date();
        const formattedTime = date.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });
        const displayLanguage = post.language.charAt(0).toUpperCase() + post.language.slice(1);
        const avatarColor = post.language === 'english' ? 'bg-pastel-primary' : (post.language === 'hindi' ? 'bg-indigo-500' : 'bg-pink-500');

        const postHtml = `
            <div class="bg-white/80 p-6 rounded-xl shadow-lg mb-6 transition duration-300 hover:shadow-xl ring-1 ring-pastel-primary/10">
                <div class="flex items-center mb-4">
                    <div class="w-10 h-10 ${avatarColor} rounded-full flex items-center justify-center text-white font-bold text-lg">${authorInitial}</div>
                    <div class="ml-3">
                        <p class="font-semibold text-pastel-text">${post.authorName || 'Anonymous'}</p>
                        <p class="text-xs text-gray-500">${formattedTime} • ${displayLanguage}</p>
                    </div>
                </div>
                <h2 class="text-xl font-bold mb-2 text-pastel-primary">${post.title}</h2>
                <p class="text-sm text-pastel-text/90 mb-4 line-clamp-3">${post.content}</p>
                <button onclick="window.openPostModal('${post.id}')" class="text-sm font-medium text-pastel-accent hover:text-pastel-primary transition focus:outline-none">
                    Read Full Post →
                </button>
            </div>`;
        feedContainer.innerHTML += postHtml;
    });
    if (window.lucide) lucide.createIcons();
};

window.publishPost = async function() {
    const title = document.getElementById('post-title').value;
    const content = document.getElementById('post-content').value;
    const language = document.getElementById('post-language').value;

    if (!title.trim() || !content.trim()) {
        displayMessage("Please enter both a title and content.", true);
        return;
    }

    if (!window.db || !window.userId || !window.isFirebaseReady) {
        displayMessage("Database not ready.", true);
        return;
    }

    try {
        const postsCollectionRef = collection(window.db, `artifacts/${window.appId}/public/data/${PUBLIC_COLLECTION_NAME}`);
        const user = window.auth.currentUser;
        const newPost = { 
            userId: window.userId, 
            authorName: user.displayName || user.email?.split('@')[0] || 'Anonymous',
            authorEmail: user.email || '',
            title, 
            content, 
            language, 
            timestamp: serverTimestamp() 
        };
        await addDoc(postsCollectionRef, newPost);
        document.getElementById('post-title').value = '';
        document.getElementById('post-content').value = '';
        displayMessage(`Post titled "${title}" published successfully!`);
        window.changeView('feed'); 
    } catch (error) {
        displayMessage(`Failed to publish: ${error.message}`, true);
    }
}

window.openPostModal = (postId) => {
    const post = window.allPosts.find(p => p.id === postId);
    if (!post) return;
    const date = post.timestamp?.toDate ? post.timestamp.toDate() : new Date();
    const formattedDate = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    document.getElementById('modal-title').textContent = post.title;
    document.getElementById('modal-content').textContent = post.content;
    document.getElementById('modal-author-id').textContent = post.authorName || 'Anonymous';
    document.getElementById('modal-date').textContent = formattedDate;
    document.getElementById('modal-language').textContent = post.language.charAt(0).toUpperCase() + post.language.slice(1);
    document.getElementById('summarize-button').setAttribute('data-post-id', postId);
    const modal = document.getElementById('post-modal');
    modal.classList.remove('opacity-0', 'pointer-events-none');
    modal.classList.add('opacity-100');
    document.body.classList.add('overflow-hidden');
    if (window.lucide) lucide.createIcons();
};

window.closeModal = () => {
    const modal = document.getElementById('post-modal');
    modal.classList.remove('opacity-100');
    modal.classList.add('opacity-0', 'pointer-events-none');
    document.body.classList.remove('overflow-hidden');
};

window.startSummaryGeneration = async (postId) => {
    const post = window.allPosts.find(p => p.id === postId);
    if (!post) return;
    window.closeModal(); 
    window.changeView('summary-results'); 
    document.getElementById('summary-header').textContent = `Analyzing: ${post.title.substring(0, 50)}...`;
    document.getElementById('summary-results-content').innerHTML = `
        <div class="p-6 text-center bg-white/80 rounded-xl shadow-lg ring-1 ring-pastel-primary/10">
            <i data-lucide="loader-circle" class="w-8 h-8 mx-auto text-pastel-primary animate-spin mb-3"></i>
            <p class="text-lg font-semibold text-pastel-text">Generating detailed analysis...</p>
        </div>`;
    if (window.lucide) lucide.createIcons();
    await window.getPostSummary(post);
};

window.getPostSummary = async (post) => {
    const systemPrompt = `You are a helpful and empathetic community moderator. Summarize theme, emotions, warning signs, and solutions. JSON output only.`;
    const userQuery = `Analyze: "${post.title}" Content: "${post.content}"`;
    const responseSchema = {
        type: "OBJECT",
        properties: {
            summary: { type: "STRING" },
            keyTakeaways: { type: "ARRAY", items: { type: "STRING" } },
            warningSigns: { type: "ARRAY", items: { type: "STRING" } },
            solutionsTaken: { type: "ARRAY", items: { type: "STRING" } }
        },
        required: ["summary", "keyTakeaways", "warningSigns", "solutionsTaken"]
    };

    const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { responseMimeType: "application/json", responseSchema: responseSchema }
    };

    // Inside window.getPostSummary...
    try {
    
    const response = await fetch("/.netlify/functions/gemini-proxy", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    
    const result = await response.json();
        
    // ADD THESE LINES to parse and show the result:
    const jsonString = result.candidates[0].content?.parts?.[0]?.text;
    window.renderPostSummary(JSON.parse(jsonString), post.title);
    } catch (error) {
        window.renderPostSummary(null, post.title, error.message);
    }
}

window.renderPostSummary = (summaryData, postTitle, error = null) => {
    const resultsContainer = document.getElementById('summary-results-content');
    if (error || !summaryData) {
        resultsContainer.innerHTML = `<div class="p-6 text-center bg-white/80 rounded-xl shadow-lg ring-1 ring-red-500/30">Error loading analysis.</div>`;
        return;
    }
    const { summary, keyTakeaways, warningSigns, solutionsTaken } = summaryData;
    const createListHtml = (items, icon, color) => `<ul class="space-y-2">${items.map(item => `<li class="flex items-start text-sm text-pastel-text"><i data-lucide="${icon}" class="w-4 h-4 mr-2 mt-1 text-${color}"></i>${item}</li>`).join('')}</ul>`;

    resultsContainer.innerHTML = `
        <div class="bg-white/90 p-8 rounded-xl shadow-2xl ring-2 ring-pastel-accent/50">
            <h2 class="text-2xl font-extrabold mb-4 text-pastel-primary">${postTitle}</h2>
            <p class="text-base text-pastel-text/90 leading-relaxed italic mb-6">${summary}</p>
            <div class="grid md:grid-cols-2 gap-6 mb-6">
                <div><h3 class="font-bold mb-3">Takeaways</h3>${createListHtml(keyTakeaways, 'dot', 'pastel-primary')}</div>
                <div><h3 class="font-bold mb-3">Warning Signs</h3>${createListHtml(warningSigns, 'minus-circle', 'red-500')}</div>
            </div>
            <div class="pt-4 border-t border-pastel-input"><h3 class="font-bold mb-3">Solutions</h3>${createListHtml(solutionsTaken, 'check-circle', 'pastel-accent')}</div>
            <button onclick="window.changeView('feed')" class="mt-8 bg-pastel-primary text-white py-2 px-6 rounded-full">Back to Feed</button>
        </div>`;
    if (window.lucide) lucide.createIcons();
};

window.getComfortRecommendations = async function() {
    const situation = document.getElementById('situation-input').value;
    const language = document.getElementById('match-language').value;
    const resultsContainer = document.getElementById('match-results-content');
    const matchButton = document.getElementById('match-button');
    
    if (!situation.trim()) return;
    matchButton.disabled = true;
    matchButton.innerHTML = `Finding Comfort...`;

    const systemPrompt = `Compassionate curator. Recommend 1 poem and 1 book based on feeling. Language: ${language}. JSON output only.`;
    const userQuery = `Feeling: "${situation}"`;
    const responseSchema = {
        type: "OBJECT",
        properties: {
            poem: { type: "OBJECT", properties: { title: { type: "STRING" }, content: { type: "STRING" } }, required: ["title", "content"] },
            book: { type: "OBJECT", properties: { title: { type: "STRING" }, author: { type: "STRING" }, summary: { type: "STRING" } }, required: ["title", "author", "summary"] }
        },
        required: ["poem", "book"]
    };

    // Inside window.getComfortRecommendations...
    try {
    const response = await fetch("/.netlify/functions/gemini-proxy", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: userQuery }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: { responseMimeType: "application/json", responseSchema: responseSchema }
        })
    });
    const result = await response.json();

    
    const recommendationData = JSON.parse(result.candidates[0].content?.parts?.[0]?.text);
    window.renderComfortResults(recommendationData, []);
    
    } catch (error) {
        window.renderComfortResults(null, [], error.message);
    }
    matchButton.disabled = false;
    matchButton.innerHTML = `<i data-lucide="sparkles" class="w-5 h-5 inline mr-2"></i> Find Comfort Now`;
    if (window.lucide) lucide.createIcons();
}

window.renderComfortResults = (recommendationData, sources, error = null) => {
    const resultsContainer = document.getElementById('match-results-content');
    if (error || !recommendationData) {
        resultsContainer.innerHTML = `<div class="p-6 text-center">Failed to get recommendations.</div>`;
        return;
    }
    const { poem, book } = recommendationData;
    resultsContainer.innerHTML = `
        <div class="bg-white/90 p-6 rounded-xl shadow-lg ring-1 ring-pastel-accent/20">
            <div class="mb-8"><h3 class="text-2xl font-bold text-pastel-primary">Poem</h3><div class="p-5 bg-pastel-input/50 rounded-xl"><p class="font-bold">${poem.title}</p><pre class="whitespace-pre-wrap font-sans">${poem.content}</pre></div></div>
            <div class="mb-8"><h3 class="text-2xl font-bold text-pastel-primary">Book</h3><div class="p-5 bg-pastel-input/50 rounded-xl"><p class="font-bold">${book.title}</p><p class="italic text-gray-600">by ${book.author}</p><p class="text-sm">${book.summary}</p></div></div>
        </div>`;
    if (window.lucide) lucide.createIcons();
};

// --- OAUTH LOG-IN LOGIC ---
window.signInWithGoogle = async () => {
    // 1. Create the Google Provider object
    const provider = new GoogleAuthProvider();
    
    try {
        // 2. Trigger the Google Popup
        const result = await signInWithPopup(window.auth, provider);
        console.log("Successfully signed in:", result.user.displayName);
        
        // Note: You don't need to manually update the UI here. 
        // Your 'onAuthStateChanged' listener in initializeFirebase 
        // will detect the login and update the profile automatically!
        
    } catch (error) {
        console.error("Google Sign-In Error:", error);
        displayMessage("Login failed: " + error.message, true);
    }
};

// Toggle login/signup tabs
window.showAuthTab = (tab) => {
    const nameField = document.getElementById('auth-name');
    const submitBtn = document.getElementById('auth-submit-btn');
    const tabLogin = document.getElementById('tab-login');
    const tabSignup = document.getElementById('tab-signup');
    
    if (tab === 'signup') {
        nameField.classList.remove('hidden');
        submitBtn.textContent = 'Create Account';
        tabLogin.classList.remove('border-b-2', 'border-pastel-primary', 'text-pastel-primary');
        tabLogin.classList.add('text-gray-400');
        tabSignup.classList.add('border-b-2', 'border-pastel-primary', 'text-pastel-primary');
        tabSignup.classList.remove('text-gray-400');
    } else {
        nameField.classList.add('hidden');
        submitBtn.textContent = 'Login';
        tabSignup.classList.remove('border-b-2', 'border-pastel-primary', 'text-pastel-primary');
        tabSignup.classList.add('text-gray-400');
        tabLogin.classList.add('border-b-2', 'border-pastel-primary', 'text-pastel-primary');
        tabLogin.classList.remove('text-gray-400');
    }
    window._authTab = tab;
};

window.handleEmailAuth = async () => {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const name = document.getElementById('auth-name').value.trim();
    const isSignup = window._authTab === 'signup';
    
    if (!email || !password) {
        displayMessage('Please enter email and password.', true);
        return;
    }
    
    try {
        if (isSignup) {
            if (!name) { displayMessage('Please enter a display name.', true); return; }
            const result = await createUserWithEmailAndPassword(window.auth, email, password);
            // Set their display name immediately after signup
            await updateProfile(result.user, { displayName: name });
        } else {
            await signInWithEmailAndPassword(window.auth, email, password);
        }
        // onAuthStateChanged handles the rest
    } catch (error) {
        const msg = error.code === 'auth/email-already-in-use' ? 'Email already in use. Try logging in.' 
                  : error.code === 'auth/wrong-password' ? 'Incorrect password.'
                  : error.code === 'auth/user-not-found' ? 'No account with that email.'
                  : error.message;
        displayMessage(msg, true);
    }
};

window.setDisplayName = async () => {
    const name = document.getElementById('set-name-input')?.value.trim();
    if (!name) return;
    await updateProfile(window.auth.currentUser, { displayName: name });
    displayMessage('Display name saved!');
    // Re-trigger auth state update
    window.auth.currentUser.reload();
};


// Expose functions to the HTML buttons
window.changeView = changeView;
window.applyLanguageFilter = applyLanguageFilter;
window.getComfortRecommendations = getComfortRecommendations;
window.publishPost = publishPost;
window.openPostModal = openPostModal;
window.loadMorePosts = loadMorePosts;
window.signInWithGoogle = signInWithGoogle;
window.showAuthTab=showAuthTab;
window.handleEmailAuth=handleEmailAuth;
window.setDisplayName=setDisplayName;