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
    appendContent({ role: currentlySpeaking, content: transcript });
    stopUserRecording();
    letAISpeak();
  };
}

async function letAISpeak() {
  currentlySpeaking = "assistant";
  const userQuery = chatHistory[chatHistory.length - 1].content;
  let contextText = "";

  if (SEARCH_TOGGLE.checked) {
    const cx = "15140b128e4f64491";
    const apiKey = "AIzaSyByOn4KLXTZdnfsYKkjbEWbye6QKWh5s6Y";

    try {
      const googleResponse = await fetch(`https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(userQuery)}&key=${apiKey}&cx=${cx}`);
      const googleData = await googleResponse.json();

      const snippets = googleData.items?.slice(0, 3).map(item => `- ${item.snippet}`).join("\n") || "";
      const sources = googleData.items?.slice(0, 3).map(item => item.link).join("\n") || "";

      contextText = `Use this real-time info from the web to help answer:\n${snippets}\n\nSources:\n${sources}`;
    } catch (error) {
      contextText = "Unable to retrieve live search results due to an API error.";
    }
  }

  const response = await (await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: [
        ...chatHistory,
        { role: "system", content: contextText }
      ]
    }),
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer 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" // Replace with your OpenAI key
    }
  })).json();

  const { content } = response.choices[0].message;
  appendContent({ role: currentlySpeaking, content });

  const spokenResponse = new SpeechSynthesisUtterance(content);
  spokenResponse.onend = () => letUserSpeak();
  VOICE.speak(spokenResponse);
}

function updateUserBubble(analyzer) {
  const fbcArray = new Uint8Array(analyzer.frequencyBinCount);
  analyzer.getByteFrequencyData(fbcArray);
  const level = fbcArray.reduce((accum, val) => accum + val, 0) / fbcArray.length;

  USER_VISUALIZER.style.transform = `scale(${level / 10})`;
  animationId = requestAnimationFrame(() => updateUserBubble(analyzer));
}

function stopUserRecording() {
  cancelAnimationFrame(animationId);
  animationId = null;
  stream.getTracks().forEach(s => s.stop());
  stream = null;
  USER_VISUALIZER.style.transform = 'scale(0)';
}

TOGGLE_BTN.addEventListener("click", () => {
  isChatting = !isChatting;
  isChatting ? startChat() : stopChat();
});
