const worker = Tesseract.createWorker({
    logger: m => console.log(m)
});

// Simple initialization
(async () => {
    await worker.load();
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
})();

const WORD_SETS = {
    "set1": {
        name: "Basic Words",
        words: {
            "check": "To make sure something is correct",
            "where": "Ask this to know the place or location",
            "when": "Ask this to know the time something happens",
            "sneeze": "What you do when your nose is tickly - achoo!",
            "how": "Ask this to learn the way to do something",
            "same": "When two things are exactly alike",
            "push": "To move something by moving it away from you",
            "what": "Ask this to know more about something"
        }
    },
    "spelling1": {
        name: "Spelling 1 (16th April - Wednesday)",
        words: {
            "first": "Coming before all others",
            "second": "Coming after the first and before the third",
            "third": "Coming after the second and before the fourth",
            "fifth": "Coming after the fourth and before the sixth",
            "sixth": "Coming after the fifth and before the seventh",
            "seventh": "Coming after the sixth and before the eighth",
            "eighth": "Coming after the seventh and before the ninth",
            "ninth": "Coming after the eighth"
        }
    },
    "spelling2": {
        name: "Spelling 2 (30th April - Wednesday)",
        words: {
            "before": "At an earlier time than something else",
            "between": "In the middle of two things or times",
            "after": "Following in time or later than something",
            "eleven": "The number 11",
            "twelve": "The number 12",
            "thirteen": "The number 13",
            "fifteen": "The number 15",
            "eighteen": "The number 18"
        }
    },
    "spelling3": {
        name: "Spelling 3 (14th May - Wednesday)",
        words: {
            "pretty": "Attractive or pleasing to look at",
            "library": "A place where books are kept",
            "fact": "Something that is known to be true",
            "read": "To look at and understand written words",
            "scared": "Feeling fear or being frightened",
            "sorry": "Feeling sad or regretful about something",
            "money": "What we use to buy things",
            "because": "For the reason that"
        }
    },
    "spelling4": {
        name: "Spelling 4 (28th May - Wednesday)",
        words: {
            "stamp": "A small piece of paper you stick on a letter to mail it",
            "barn": "A building on a farm for animals or storing things",
            "lunch": "The meal eaten in the middle of the day",
            "dinner": "The main meal of the day, usually eaten in the evening",
            "guard": "To protect or watch over someone or something",
            "tooth": "One of the hard white objects in your mouth",
            "respect": "To admire someone because they are good or important",
            "care": "To look after someone or something"
        }
    }
};

let currentWordSet = "set1";
let WORDS = WORD_SETS[currentWordSet].words;

let currentWord = '';
let currentGameMode = '';
let score = 0;
let totalRounds = 0;
let currentWordIndex = 0;
let isDrawing = false;
let context;
let canvas;

// Simple sound setup with reliable URLs
const correctSound = new Audio('./sounds/Yay thats right.m4a');
const wrongSound = new Audio('./sounds/Ohh man.m4a');

// Basic error handling
correctSound.onerror = () => console.log('Error loading correct sound');
wrongSound.onerror = () => console.log('Error loading wrong sound');

// Add text-to-speech functionality
const speech = new SpeechSynthesisUtterance();
speech.rate = 0.9;  // Slightly slower for clarity
speech.pitch = 1;

// Add new game mode
function speakWord(word) {
    speech.text = word;
    window.speechSynthesis.speak(speech);
}

// Add repeat timer functionality
let repeatTimer = null;

function startRepeatTimer(word) {
    clearTimeout(repeatTimer);  // Clear any existing timer
    
    // Only start timer if we're in spelling mode
    if (currentGameMode === 'spelling') {
        repeatTimer = setTimeout(() => {
            // Check if we're still in spelling mode and on game screen
            if (currentGameMode === 'spelling' && 
                document.getElementById('game-screen').classList.contains('active')) {
                // Only repeat if input is empty (user hasn't started typing)
                if (!document.getElementById('user-input').value.trim()) {
                    speakWord(word);
                }
            }
        }, 5000);
    }
}

function stopRepeatTimer() {
    clearTimeout(repeatTimer);
}

// Add attempt counter
let attempts = 0;
const MAX_ATTEMPTS = 3;

function checkAnswer(manualInput) {
    stopRepeatTimer();  // Stop word repetition when answer is submitted
    const userInput = manualInput || document.getElementById('user-input').value.toLowerCase().trim();
    const message = document.getElementById('message');
    
    if (userInput === currentWord) {
        // Stop any ongoing speech
        window.speechSynthesis.cancel();
        correctSound.play();
        score++;
        message.textContent = '🎉 Fantastic! You got it right!';
        message.style.color = '#28a745';
        attempts = 0;  // Reset attempts on correct answer
        
        totalRounds++;
        updateScore();
        
        // Move to next word after delay
        setTimeout(() => {
            setupGame(currentGameMode);
        }, 4000);
    } else {
        // Stop any ongoing speech
        window.speechSynthesis.cancel();
        wrongSound.play();
        attempts++;
        
        if (attempts >= MAX_ATTEMPTS) {
            message.textContent = `Sorry, the word was: ${currentWord.toUpperCase()}. Let's try the next word!`;
            message.style.color = '#dc3545';
            attempts = 0;  // Reset attempts
            totalRounds++;
            updateScore();
            
            // Move to next word after delay
            setTimeout(() => {
                setupGame(currentGameMode);
            }, 4000);
        } else {
            message.textContent = `Try again! You have ${MAX_ATTEMPTS - attempts} chances left.`;
            message.style.color = '#f39c12';  // Orange color for retry message
        }
    }
    
    // Clear the input field
    document.getElementById('user-input').value = '';
}

// Add welcome sound
const welcomeSound = new Audio('./sounds/Hey Atharva.m4a');
welcomeSound.playbackRate = 1.25;  // Speed up the welcome message

// Play welcome sound function
function playWelcomeSound() {
    welcomeSound.play().catch((error) => {
        console.log('Error playing welcome sound:', error);
        // For Chrome: Add a button to play sound if autoplay fails
        const playButton = document.createElement('button');
        playButton.textContent = '🔊 Click to Start';
        playButton.className = 'welcome-sound-btn';
        playButton.onclick = () => {
            welcomeSound.play();
            playButton.remove();
        };
        document.querySelector('.container').prepend(playButton);
    });
}

// Try to play sound when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Play welcome sound
    playWelcomeSound();

    // Setup canvas
    canvas = document.getElementById('writing-pad');
    context = canvas.getContext('2d');
    
    // Simple canvas setup
    setupCanvas();
    window.addEventListener('resize', setupCanvas);

    // Touch events for drawing
    canvas.addEventListener('touchstart', startDrawing);
    canvas.addEventListener('touchmove', draw);
    canvas.addEventListener('touchend', stopDrawing);

    // Mouse events for desktop testing
    canvas.addEventListener('mousedown', startDrawingMouse);
    canvas.addEventListener('mousemove', drawMouse);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);

    // Clear and recognize buttons
    document.getElementById('clear-btn').addEventListener('click', clearCanvas);
    document.getElementById('recognize-btn').addEventListener('click', recognizeHandwriting);

    // Add input listener
    document.getElementById('user-input').addEventListener('input', function() {
        clearTimeout(repeatTimer);  // Stop repeat timer when user starts typing
    });
    
    // Generate word set buttons
    generateWordSetButtons();
});

function startDrawing(e) {
    isDrawing = true;
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    context.beginPath();
    context.moveTo(
        touch.clientX - rect.left,
        touch.clientY - rect.top
    );
    e.preventDefault();
}

function draw(e) {
    if (!isDrawing) return;
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    context.lineTo(
        touch.clientX - rect.left,
        touch.clientY - rect.top
    );
    context.stroke();
    e.preventDefault();
}

function stopDrawing() {
    isDrawing = false;
}

function clearCanvas() {
    context.clearRect(0, 0, canvas.width, canvas.height);
}

// Simplified recognition function
async function recognizeHandwriting() {
    try {
        const { data: { text } } = await worker.recognize(canvas);
        
        // Basic text cleanup
        const cleanText = text.toLowerCase().trim();
        console.log('Recognized text:', cleanText);
        
        if (cleanText) {
            checkAnswer(cleanText);
            clearCanvas();
        } else {
            document.getElementById('message').textContent = '✏️ Please write more clearly';
            document.getElementById('message').style.color = '#f39c12';
        }
    } catch (error) {
        console.error('Recognition failed:', error);
        document.getElementById('message').textContent = '❌ Recognition failed, please try again';
        document.getElementById('message').style.color = '#e74c3c';
    }
}

// Keep the canvas setup simple
function setupCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = 200;
    context.lineWidth = 4;
    context.lineCap = 'round';
    context.strokeStyle = '#000';
}

// Update showWelcomeScreen function
function showWelcomeScreen() {
    clearTimeout(repeatTimer);  // Clear timer when returning to menu
    document.getElementById('game-screen').classList.remove('active');
    document.getElementById('welcome-screen').classList.add('active');
    score = 0;
    totalRounds = 0;
    attempts = 0;
    updateScore();
}

// Helper functions
function getRandomWord() {
    const words = Object.keys(WORDS);
    if (currentWordIndex >= words.length) {
        currentWordIndex = 0; // Reset to start if we've shown all words
    }
    return words[currentWordIndex++];
}

function scrambleWord(word) {
    let scrambled;
    do {
        scrambled = word.split('')
            .sort(() => Math.random() - 0.5)
            .join('')
            .toUpperCase();
    } while (scrambled === word.toUpperCase()); // Keep trying until we get a different arrangement
    
    return scrambled;
}

function createBlanks(word) {
    const blanks = Array(word.length).fill('_');
    const revealCount = Math.floor(word.length / 2);
    const positions = new Set();
    
    while(positions.size < revealCount) {
        positions.add(Math.floor(Math.random() * word.length));
    }
    
    positions.forEach(pos => {
        blanks[pos] = word[pos].toUpperCase();
    });
    
    return blanks.join(' ');
}

function updateScore() {
    document.getElementById('score').textContent = score;
    document.getElementById('total').textContent = totalRounds;
}

function startTimer() {
    const timer = document.getElementById('timer');
    timer.classList.remove('hidden');
    let time = 0;
    
    const interval = setInterval(() => {
        time += 0.1;
        timer.textContent = `Time: ${time.toFixed(1)}s`;
    }, 100);
    
    document.getElementById('user-input').addEventListener('keyup', function(e) {
        if (e.key === 'Enter') {
            clearInterval(interval);
            checkAnswer();
        }
    });
}

// Event Listeners
document.getElementById('user-input').addEventListener('keyup', function(e) {
    if (e.key === 'Enter') {
        checkAnswer();
    }
});

// Add mouse versions of the drawing functions
function startDrawingMouse(e) {
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    context.beginPath();
    context.moveTo(
        e.clientX - rect.left,
        e.clientY - rect.top
    );
    e.preventDefault();
}

function drawMouse(e) {
    if (!isDrawing) return;
    const rect = canvas.getBoundingClientRect();
    context.lineTo(
        e.clientX - rect.left,
        e.clientY - rect.top
    );
    context.stroke();
    e.preventDefault();
}

// Add function to handle sequential sounds
async function playSequentialSounds(sounds) {
    for (const sound of sounds) {
        try {
            await new Promise((resolve) => {
                sound.onended = resolve;
                sound.play();
            });
        } catch (error) {
            console.log('Error playing sound:', error);
        }
    }
}

// Reset attempts when starting new game or changing modes
function startGame(mode) {
    attempts = 0;  // Reset attempts
    currentGameMode = mode;
    document.getElementById('welcome-screen').classList.remove('active');
    document.getElementById('game-screen').classList.add('active');
    document.getElementById('game-screen').setAttribute('data-mode', mode);
    
    setupGame(mode);
}

function setupGame(mode) {
    currentWord = getRandomWord();
    const wordDisplay = document.getElementById('word-display');
    const hint = document.getElementById('hint');
    const gameTitle = document.getElementById('game-title');
    
    switch(mode) {
        case 'spelling':
            gameTitle.textContent = '🎧 Spelling Practice';
            wordDisplay.textContent = '👂 Listen and Type';
            speakWord(currentWord);
            startRepeatTimer(currentWord);
            break;
        case 'scramble':
            gameTitle.textContent = '🎲 Unscramble the Word';
            wordDisplay.textContent = scrambleWord(currentWord);
            break;
        case 'blanks':
            gameTitle.textContent = '🎯 Fill in the Blanks';
            wordDisplay.textContent = createBlanks(currentWord);
            break;
    }
    
    hint.textContent = mode === 'spelling' ? 
        "Type the word you hear. Click 'Hear Again' to repeat." : 
        `Hint: ${WORDS[currentWord]}`;
    
    document.getElementById('user-input').value = '';
    document.getElementById('message').textContent = '';
    attempts = 0;  // Reset attempts for new word
}

// Function to generate word set buttons
function generateWordSetButtons() {
    const wordSetContainer = document.createElement('div');
    wordSetContainer.className = 'word-sets';
    wordSetContainer.innerHTML = '<h3>Choose a Word Set:</h3>';
    
    for (const setKey in WORD_SETS) {
        const button = document.createElement('button');
        button.className = 'word-set-btn';
        button.textContent = WORD_SETS[setKey].name;
        button.onclick = function() {
            selectWordSet(setKey);
        };
        wordSetContainer.appendChild(button);
    }
    
    // Insert before game modes
    const gameModes = document.querySelector('.game-modes');
    gameModes.parentNode.insertBefore(wordSetContainer, gameModes);
}

// Function to select word set
function selectWordSet(setKey) {
    currentWordSet = setKey;
    WORDS = WORD_SETS[setKey].words;
    currentWordIndex = 0;
    
    // Update UI to show selected set
    const buttons = document.querySelectorAll('.word-set-btn');
    buttons.forEach(btn => {
        if (btn.textContent === WORD_SETS[setKey].name) {
            btn.classList.add('selected');
        } else {
            btn.classList.remove('selected');
        }
    });
}