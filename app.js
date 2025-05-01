const TOGGLE_BTN = document.getElementById("toggleBtn");
const USER_VISUALIZER = document.getElementById("userVisualizer");
const CHAT_HISTORY = document.getElementById("chatHistory");
const SEARCH_TOGGLE = document.getElementById("searchToggle");

const VOICE = window.speechSynthesis;
let isChatting = false;
let speechObj = null;
let context = new AudioContext();
let stream = null;
let animationId = null;
let currentlySpeaking = null;

const chatHistory = [];
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

TOGGLE_BTN.addEventListener("click", () => {
  isChatting = !isChatting;
  isChatting ? startChat() : stopChat();
});

async function startChat() {
  TOGGLE_BTN.innerText = "Stop";
  speechObj = new SpeechRecognition();
  letUserSpeak();
}

function stopChat() {
  if (currentlySpeaking === "user") stopUserRecording();
  if (VOICE.speaking) VOICE.cancel();
  currentlySpeaking = null;
  speechObj = null;
  TOGGLE_BTN.innerText = "Start";
}

function appendContent({ role, content }) {
  chatHistory.push({ role, content });
  const contentEl = document.createElement('p');
  contentEl.innerText = content;
  contentEl.classList.add('speechBubble', role);
  CHAT_HISTORY.append(contentEl);
}

async function letUserSpeak() {
  currentlySpeaking = "user";
  const newStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream = newStream;
  const source = context.createMediaStreamSource(newStream);
  const analyzer = context.createAnalyser();
  source.connect(analyzer);
  animationId = updateUserBubble(analyzer);

  speechObj.start();
  speechObj.onresult = function (e) {
    const { transcript } = e.results[0][0];
    appendContent({ role: "user", content: transcript });
    stopUserRecording();
    letAISpeak();
  };

  speechObj.onerror = function (e) {
    console.error("Speech recognition error:", e.error);
    stopUserRecording();
  };
}

function stopUserRecording() {
  cancelAnimationFrame(animationId);
  animationId = null;
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
  USER_VISUALIZER.style.transform = 'scale(0)';
}

function updateUserBubble(analyzer) {
  const fbcArray = new Uint8Array(analyzer.frequencyBinCount);
  analyzer.getByteFrequencyData(fbcArray);
  const level = fbcArray.reduce((acc, val) => acc + val, 0) / fbcArray.length;
  USER_VISUALIZER.style.transform = `scale(${level / 10})`;
  animationId = requestAnimationFrame(() => updateUserBubble(analyzer));
}

async function letAISpeak() {
  currentlySpeaking = "assistant";
  const userQuery = chatHistory[chatHistory.length - 1]?.content || "Hello";
  let contextText = "";

  // Google Custom Search (optional)
  if (SEARCH_TOGGLE.checked) {
    const cx = "15140b128e4f64491";
    const apiKey = "AIzaSyByOn4KLXTZdnfsYKkjbEWbye6QKWh5s6Y";
    try {
      const googleResponse = await fetch(`https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(userQuery)}&key=${apiKey}&cx=${cx}`);
      const googleData = await googleResponse.json();
      const snippets = googleData.items?.slice(0, 3).map(item => `- ${item.snippet}`).join("\n") || "";
      const sources = googleData.items?.slice(0, 3).map(item => item.link).join("\n") || "";
      contextText = `Use this real-time info from the web to help answer:\n${snippets}\n\nSources:\n${sources}`;
    } catch (err) {
      console.error("Google API error:", err);
      contextText = "Unable to retrieve live search results due to an API error.";
    }
  }

  try {
    const apiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer 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"
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          ...chatHistory,
          { role: "system", content: contextText }
        ]
      })
    });

    const response = await apiResponse.json();

    if (!response.choices || !response.choices[0]?.message?.content) {
      throw new Error("OpenAI response missing content.");
    }

    const { content } = response.choices[0].message;
    appendContent({ role: "assistant", content });

    const spokenResponse = new SpeechSynthesisUtterance(content);
    spokenResponse.onend = () => letUserSpeak();
    VOICE.speak(spokenResponse);
  } catch (error) {
    console.error("OpenAI API Error:", error);
    const fallback = "Sorry, I'm having trouble answering right now.";
    appendContent({ role: "assistant", content: fallback });

    const spokenResponse = new SpeechSynthesisUtterance(fallback);
    spokenResponse.onend = () => letUserSpeak();
    VOICE.speak(spokenResponse);
  }
}
