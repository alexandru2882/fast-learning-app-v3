// script.js

// GLOBAL APP STATE
let appState = {
    language: null,
    currentLessonId: null,
    lessons: {} // structure: { lessonId: { content: string, chatHistory: [] } }
  };
  
  // DOM references
  const chatHistoryEl = document.getElementById('chat-history');
  const pastLessonsListEl = document.getElementById('past-lessons-list');
  const chatInputEl = document.getElementById('chat-input');
  const sendChatBtn = document.getElementById('send-chat-btn');
  const submitCodeBtn = document.getElementById('submit-code-btn');
  const returnCurrentBtn = document.getElementById('return-current-btn');
  const clearHistoryBtn = document.getElementById('clear-history-btn');
  
  // Initialize CodeMirror editor
  const editor = CodeMirror(document.getElementById('code-editor'), {
    mode: "javascript", // default mode; you may change based on language
    lineNumbers: true,
    value: ""
  });
  
  // Always move the cursor to a new, empty line when the editor is focused
  editor.on('focus', () => {
    const lastLine = editor.lineCount();
    editor.replaceRange("\n", { line: lastLine });
    editor.focus();
  });
  
  // --- Local Storage Helpers ---
  const STORAGE_KEY = "fastLearningAppState";
  
  function saveAppState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  }
  
  function loadAppState() {
    const savedState = localStorage.getItem(STORAGE_KEY);
    if (savedState) {
      appState = JSON.parse(savedState);
    }
  }
  
  // --- Chat UI Helpers ---
  function addChatMessage(message, sender, isLatest = true) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('chat-message');
    
    if (sender === 'user') {
      msgDiv.classList.add(isLatest ? 'user-message' : 'user-message', isLatest ? 'latest' : 'old');
    } else {
      msgDiv.classList.add(isLatest ? 'tutor-message' : 'tutor-message', isLatest ? 'latest' : 'old');
    }
    msgDiv.textContent = message;
    chatHistoryEl.appendChild(msgDiv);
    chatHistoryEl.scrollTop = chatHistoryEl.scrollHeight;
  }
  
  // Render chat history for the given lessonId
  function renderChatHistory(lessonId) {
    chatHistoryEl.innerHTML = "";
    const lesson = appState.lessons[lessonId];
    if (lesson && lesson.chatHistory) {
      lesson.chatHistory.forEach((entry, index) => {
        const isLatest = index === lesson.chatHistory.length - 1;
        addChatMessage(entry.message, entry.sender, isLatest);
      });
    }
  }
  
  // Update the lesson history list (past lessons only)
  function renderLessonHistory() {
    pastLessonsListEl.innerHTML = "";
    for (let lessonId in appState.lessons) {
      if (Number(lessonId) < Number(appState.currentLessonId)) {
        const li = document.createElement('li');
        li.textContent = `Lesson ${lessonId} - ${appState.lessons[lessonId].topic || ''}`;
        li.onclick = () => loadLessonView(lessonId);
        pastLessonsListEl.appendChild(li);
      }
    }
  }
  
  // --- Lesson Navigation ---
  function loadLessonView(lessonId) {
    if (!appState.lessons[lessonId]) return;
    editor.setValue(appState.lessons[lessonId].content);
    renderChatHistory(lessonId);
    returnCurrentBtn.style.display = (lessonId !== appState.currentLessonId) ? "block" : "none";
  }
  
  function loadCurrentLesson() {
    if (!appState.currentLessonId) return;
    loadLessonView(appState.currentLessonId);
    returnCurrentBtn.style.display = "none";
  }
  
  // --- API Calls ---
  async function fetchLesson(lessonId, language) {
    try {
      const response = await fetch(`/lesson?lessonId=${lessonId}&language=${language}`);
      const data = await response.json();
      if (data.error) {
        alert(data.error);
        return null;
      }
      return data;
    } catch (error) {
      console.error('Error fetching lesson:', error);
      alert('Failed to load lesson.');
      return null;
    }
  }
  
  async function sendChatMessage(message) {
    const conversationContext = appState.lessons[appState.currentLessonId]?.chatHistory
      .map(entry => `${entry.sender === 'user' ? 'User' : 'Tutor'}: ${entry.message}`)
      .join('\n') || "";
    addChatMessage(message, 'user');
    appState.lessons[appState.currentLessonId].chatHistory.push({ sender: 'user', message });
    saveAppState();
  
    try {
      const response = await fetch('/chat', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, conversation: conversationContext })
      });
      const data = await response.json();
      if (data.error) {
        addChatMessage(`Error: ${data.error}`, 'tutor');
      } else {
        addChatMessage(data.reply, 'tutor');
        appState.lessons[appState.currentLessonId].chatHistory.push({ sender: 'tutor', message: data.reply });
        saveAppState();
      }
    } catch (error) {
      console.error('Error sending chat message:', error);
      addChatMessage("Error: Unable to connect to Tutor Bot.", 'tutor');
    }
  }
  
  async function submitCode() {
    const code = editor.getValue();
    if (!code.trim()) {
      alert("Please write some code before submitting.");
      return;
    }
    try {
      const response = await fetch('/submit-code', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, lessonId: appState.currentLessonId })
      });
      const data = await response.json();
      if (data.error) {
        addChatMessage(`Error: ${data.error}`, 'tutor');
      } else {
        addChatMessage(data.feedback, 'tutor');
        appState.lessons[appState.currentLessonId].chatHistory.push({ sender: 'tutor', message: data.feedback });
        saveAppState();
        if (data.feedback.toLowerCase().includes("correct")) {
          addChatMessage("Great! You can now proceed to the next lesson. Type 'Next Lesson' or click the button below.", 'tutor');
        }
      }
    } catch (error) {
      console.error('Error submitting code:', error);
      addChatMessage("Error: Code evaluation failed. Please try again.", 'tutor');
    }
  }
  
  // --- Event Listeners ---
  sendChatBtn.addEventListener('click', () => {
    const message = chatInputEl.value.trim();
    if (!message) return;
    chatInputEl.value = "";
    
    // If language is not set, assume the first message sets the language or lesson.
    if (!appState.language) {
      if (message.toLowerCase().startsWith("lesson")) {
        const parts = message.split(" ");
        const lessonNum = parts[1] || "1";
        appState.currentLessonId = lessonNum;
        appState.language = "Python"; // default if not specified
        appState.lessons[lessonNum] = { content: "", chatHistory: [] };
        loadLesson(lessonNum);
      } else {
        appState.language = message;
        appState.currentLessonId = "1";
        appState.lessons["1"] = { content: "", chatHistory: [] };
        loadLesson("1");
      }
    } else {
      sendChatMessage(message);
      if (message.toLowerCase().includes("next lesson")) {
        const nextLessonId = String(Number(appState.currentLessonId) + 1);
        appState.currentLessonId = nextLessonId;
        appState.lessons[nextLessonId] = { content: "", chatHistory: [] };
        loadLesson(nextLessonId);
      }
    }
  });
  
  submitCodeBtn.addEventListener('click', submitCode);
  returnCurrentBtn.addEventListener('click', loadCurrentLesson);
  clearHistoryBtn.addEventListener('click', () => {
    if (confirm("Are you sure you want to clear all history? This cannot be undone.")) {
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
    }
  });
  
  // --- Lesson Loading ---
  async function loadLesson(lessonId) {
    const lessonData = await fetchLesson(lessonId, appState.language);
    if (lessonData) {
      appState.lessons[lessonId].content = lessonData.prompt;
      appState.lessons[lessonId].topic = lessonData.topic;
      saveAppState();
      editor.setValue(lessonData.prompt);
      appState.lessons[lessonId].chatHistory = [];
      chatHistoryEl.innerHTML = "";
      renderLessonHistory();
    }
  }
  
  // --- Initial App Launch ---
  function init() {
    loadAppState();
    if (!appState.language) {
      addChatMessage("Hello! I'm Tutor Bot. I'm here to help you learn to code. What language would you like to start learning? You can also type 'Lesson X' to start at a specific lesson.", 'tutor');
    } else {
      loadCurrentLesson();
      renderLessonHistory();
    }
  }
  
  init();
  