// Common functionality across all pages
document.addEventListener('DOMContentLoaded', () => {
    // Initialize music toggle
    const musicToggle = document.getElementById('music-toggle');
    const backgroundMusic = document.getElementById('background-music');
    
    if (musicToggle && backgroundMusic) {
        let musicPlaying = localStorage.getItem('musicPlaying') === 'true';
        
        if (musicPlaying) {
            backgroundMusic.play().catch(e => console.log("Audio play failed:", e));
            musicToggle.innerHTML = '<i class="fas fa-volume-up"></i> Background Music';
        } else {
            musicToggle.innerHTML = '<i class="fas fa-volume-mute"></i> Background Music';
        }
        
        musicToggle.addEventListener('click', () => {
            musicPlaying = !musicPlaying;
            localStorage.setItem('musicPlaying', musicPlaying);
            
            if (musicPlaying) {
                backgroundMusic.play().catch(e => console.log("Audio play failed:", e));
                musicToggle.innerHTML = '<i class="fas fa-volume-up"></i> Background Music';
            } else {
                backgroundMusic.pause();
                musicToggle.innerHTML = '<i class="fas fa-volume-mute"></i> Background Music';
            }
        });
        
        // Set volume from settings
        const musicVolume = localStorage.getItem('musicVolume') || 50;
        backgroundMusic.volume = musicVolume / 100;
    }
    
    // Navigation
    const menuButtons = document.querySelectorAll('#menu-btn, #menu-btn-2, #settings-menu-btn, #online-menu-btn, #online-menu-btn-2');
    menuButtons.forEach(button => {
        if (button) {
            button.addEventListener('click', () => {
                window.location.href = 'index.html';
            });
        }
    });
    
    // Settings page functionality
    if (document.getElementById('save-settings')) {
        loadSettings();
        
        document.getElementById('save-settings').addEventListener('click', saveSettings);
        document.getElementById('reset-settings').addEventListener('click', resetSettings);
        
        // Volume sliders
        const musicVolumeSlider = document.getElementById('music-volume');
        const sfxVolumeSlider = document.getElementById('sfx-volume');
        
        if (musicVolumeSlider) {
            musicVolumeSlider.addEventListener('input', () => {
                document.getElementById('music-volume-value').textContent = `${musicVolumeSlider.value}%`;
            });
        }
        
        if (sfxVolumeSlider) {
            sfxVolumeSlider.addEventListener('input', () => {
                document.getElementById('sfx-volume-value').textContent = `${sfxVolumeSlider.value}%`;
            });
        }
    }
    
    // Local game functionality
    if (document.querySelector('.board')) {
        initLocalGame();
    }
});

// Navigation function
function navigateTo(page) {
    window.location.href = page;
}

// Local game functionality
function initLocalGame() {
    // Game state variables
    let board = ['', '', '', '', '', '', '', '', ''];
    let currentPlayer = 'X';
    let gameActive = true;
    let scores = {
        'X': 0,
        'O': 0,
        'Tie': 0
    };
    
    // Load scores from localStorage if available
    const savedScores = localStorage.getItem('tictactoeScores');
    if (savedScores) {
        scores = JSON.parse(savedScores);
    }
    
    // DOM elements
    const cells = document.querySelectorAll('.cell');
    const statusDisplay = document.querySelector('.current-player');
    const playerTurnText = document.getElementById('player-turn');
    const resultModal = document.getElementById('result-modal');
    const resultMessage = document.getElementById('result-message');
    const restartBtn = document.getElementById('restart-btn');
    const playAgainBtn = document.getElementById('play-again-btn');
    const playerXInput = document.getElementById('player-x');
    const playerOInput = document.getElementById('player-o');
    const playerXName = document.getElementById('player-x-name');
    const playerOName = document.getElementById('player-o-name');
    const winningLine = document.querySelector('.winning-line');
    
    // Sound elements
    const clickSound = document.getElementById('click-sound');
    const winSound = document.getElementById('win-sound');
    const drawSound = document.getElementById('draw-sound');
    
    // Set sound volumes
    const sfxVolume = localStorage.getItem('sfxVolume') || 70;
    if (clickSound) clickSound.volume = sfxVolume / 100;
    if (winSound) winSound.volume = sfxVolume / 100;
    if (drawSound) drawSound.volume = sfxVolume / 100;
    
    // Winning combinations
    const winningConditions = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
        [0, 4, 8], [2, 4, 6]             // diagonals
    ];
    
    // Initialize the game
    function initGame() {
        cells.forEach(cell => {
            cell.addEventListener('click', handleCellClick);
            cell.classList.remove('x', 'o');
        });
        
        if (restartBtn) restartBtn.addEventListener('click', restartGame);
        if (playAgainBtn) playAgainBtn.addEventListener('click', playAgain);
        
        // Player name inputs
        if (playerXInput && playerOInput) {
            // Load default names from settings
            const defaultXName = localStorage.getItem('defaultXName') || 'Player X';
            const defaultOName = localStorage.getItem('defaultOName') || 'Player O';
            
            playerXInput.value = defaultXName;
            playerOInput.value = defaultOName;
            
            playerXInput.addEventListener('input', updatePlayerNames);
            playerOInput.addEventListener('input', updatePlayerNames);
            
            updatePlayerNames();
        }
        
        updateStatus();
        updateScores();
    }
    
    // Update player names
    function updatePlayerNames() {
        if (playerXInput && playerOInput && playerXName && playerOName) {
            playerXName.textContent = playerXInput.value;
            playerOName.textContent = playerOInput.value;
            updateStatus();
        }
    }
    
    // Handle cell click
    function handleCellClick(e) {
        const cell = e.target;
        const cellIndex = parseInt(cell.getAttribute('data-cell-index'));
        
        // Check if cell is already played or game is not active
        if (board[cellIndex] !== '' || !gameActive) {
            return;
        }
        
        // Play sound
        if (clickSound) {
            clickSound.currentTime = 0;
            clickSound.play();
        }
        
        // Make move
        makeMove(cellIndex);
    }
    
    // Make a move
    function makeMove(cellIndex) {
        board[cellIndex] = currentPlayer;
        cells[cellIndex].classList.add(currentPlayer.toLowerCase());
        cells[cellIndex].textContent = currentPlayer;
        
        // Check result
        checkResult();
    }
    
    // Check game result
    function checkResult() {
        let roundWon = false;
        let winningCombo = null;
        
        // Check all winning conditions
        for (let i = 0; i < winningConditions.length; i++) {
            const [a, b, c] = winningConditions[i];
            
            if (board[a] === '' || board[b] === '' || board[c] === '') {
                continue;
            }
            
            if (board[a] === board[b] && board[b] === board[c]) {
                roundWon = true;
                winningCombo = winningConditions[i];
                break;
            }
        }
        
        // If won, display winner and highlight winning line
        if (roundWon) {
            gameActive = false;
            displayWinningLine(winningCombo);
            scores[currentPlayer]++;
            
            // Play win sound
            if (winSound) {
                winSound.currentTime = 0;
                winSound.play();
            }
            
            // Show result message
            const winnerName = currentPlayer === 'X' ? 
                (playerXInput ? playerXInput.value : 'Player X') : 
                (playerOInput ? playerOInput.value : 'Player O');
                
            showResult(`${winnerName} wins!`);
            saveScores();
            return;
        }
        
        // Check for draw
        const roundDraw = !board.includes('');
        if (roundDraw) {
            gameActive = false;
            scores['Tie']++;
            
            // Play draw sound
            if (drawSound) {
                drawSound.currentTime = 0;
                drawSound.play();
            }
            
            showResult("Game ended in a draw!");
            saveScores();
            return;
        }
        
        // Continue game with next player
        changePlayer();
    }
    
    // Display winning line
    function displayWinningLine(combo) {
        const [a, b, c] = combo;
        const cellSize = cells[0].offsetWidth;
        const boardRect = document.querySelector('.board').getBoundingClientRect();
        
        // Determine line position and rotation
        if (a === 0 && b === 1 && c === 2) {
            // Top row
            winningLine.style.width = `${cellSize * 3 + 20}px`;
            winningLine.style.height = '6px';
            winningLine.style.top = `${cellSize/2 - 3}px`;
            winningLine.style.left = '0';
        } else if (a === 3 && b === 4 && c === 5) {
            // Middle row
            winningLine.style.width = `${cellSize * 3 + 20}px`;
            winningLine.style.height = '6px';
            winningLine.style.top = `${cellSize * 1.5 + 10 - 3}px`;
            winningLine.style.left = '0';
        } else if (a === 6 && b === 7 && c === 8) {
            // Bottom row
            winningLine.style.width = `${cellSize * 3 + 20}px`;
            winningLine.style.height = '6px';
            winningLine.style.top = `${cellSize * 2.5 + 20 - 3}px`;
            winningLine.style.left = '0';
        } else if (a === 0 && b === 3 && c === 6) {
            // Left column
            winningLine.style.width = '6px';
            winningLine.style.height = `${cellSize * 3 + 20}px`;
            winningLine.style.top = '0';
            winningLine.style.left = `${cellSize/2 - 3}px`;
        } else if (a === 1 && b === 4 && c === 7) {
            // Middle column
            winningLine.style.width = '6px';
            winningLine.style.height = `${cellSize * 3 + 20}px`;
            winningLine.style.top = '0';
            winningLine.style.left = `${cellSize * 1.5 + 10 - 3}px`;
        } else if (a === 2 && b === 5 && c === 8) {
            // Right column
            winningLine.style.width = '6px';
            winningLine.style.height = `${cellSize * 3 + 20}px`;
            winningLine.style.top = '0';
            winningLine.style.left = `${cellSize * 2.5 + 20 - 3}px`;
        } else if (a === 0 && b === 4 && c === 8) {
            // Diagonal top-left to bottom-right
            winningLine.style.width = `${Math.sqrt(2) * (cellSize * 3 + 20)}px`;
            winningLine.style.height = '6px';
            winningLine.style.top = `${cellSize * 1.5 + 10 - 3}px`;
            winningLine.style.left = '0';
            winningLine.style.transform = 'rotate(45deg)';
            winningLine.style.transformOrigin = '0 50%';
        } else if (a === 2 && b === 4 && c === 6) {
            // Diagonal top-right to bottom-left
            winningLine.style.width = `${Math.sqrt(2) * (cellSize * 3 + 20)}px`;
            winningLine.style.height = '6px';
            winningLine.style.top = `${cellSize * 1.5 + 10 - 3}px`;
            winningLine.style.right = '0';
            winningLine.style.left = 'auto';
            winningLine.style.transform = 'rotate(-45deg)';
            winningLine.style.transformOrigin = '100% 50%';
        }
        
        winningLine.style.opacity = '1';
    }
    
    // Change player
    function changePlayer() {
        currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
        updateStatus();
    }
    
    // Update game status display
    function updateStatus() {
        if (statusDisplay) {
            const symbol = statusDisplay.querySelector('.player-symbol');
            symbol.textContent = currentPlayer;
            symbol.className = `player-symbol ${currentPlayer.toLowerCase()}`;
        }
        
        if (playerTurnText) {
            const playerName = currentPlayer === 'X' ? 
                (playerXInput ? playerXInput.value : 'Player X') : 
                (playerOInput ? playerOInput.value : 'Player O');
                
            playerTurnText.textContent = `${playerName}'s Turn`;
        }
    }
    
    // Update scores display
    function updateScores() {
        const scoreX = document.getElementById('score-x');
        const scoreO = document.getElementById('score-o');
        const scoreTie = document.getElementById('score-tie');
        
        if (scoreX) scoreX.textContent = scores['X'];
        if (scoreO) scoreO.textContent = scores['O'];
        if (scoreTie) scoreTie.textContent = scores['Tie'];
    }
    
    // Save scores to localStorage
    function saveScores() {
        localStorage.setItem('tictactoeScores', JSON.stringify(scores));
    }
    
    // Show result modal
    function showResult(message) {
        if (resultModal && resultMessage) {
            resultMessage.textContent = message;
            resultModal.classList.add('active');
            updateScores();
        }
    }
    
    // Restart game (keep scores)
    function restartGame() {
        board = ['', '', '', '', '', '', '', '', ''];
        gameActive = true;
        currentPlayer = 'X';
        
        cells.forEach(cell => {
            cell.textContent = '';
            cell.classList.remove('x', 'o');
        });
        
        if (winningLine) {
            winningLine.style.opacity = '0';
            winningLine.style.transform = 'none';
        }
        
        if (resultModal) {
            resultModal.classList.remove('active');
        }
        
        updateStatus();
    }
    
    // Play again (after result modal)
    function playAgain() {
        if (resultModal) {
            resultModal.classList.remove('active');
        }
        restartGame();
    }
    
    // Initialize the game
    initGame();
}

// Settings functionality
function loadSettings() {
    // Load music volume
    const musicVolume = localStorage.getItem('musicVolume') || 50;
    const musicVolumeSlider = document.getElementById('music-volume');
    const musicVolumeValue = document.getElementById('music-volume-value');
    
    if (musicVolumeSlider && musicVolumeValue) {
        musicVolumeSlider.value = musicVolume;
        musicVolumeValue.textContent = `${musicVolume}%`;
    }
    
    // Load SFX volume
    const sfxVolume = localStorage.getItem('sfxVolume') || 70;
    const sfxVolumeSlider = document.getElementById('sfx-volume');
    const sfxVolumeValue = document.getElementById('sfx-volume-value');
    
    if (sfxVolumeSlider && sfxVolumeValue) {
        sfxVolumeSlider.value = sfxVolume;
        sfxVolumeValue.textContent = `${sfxVolume}%`;
    }
    
    // Load theme
    const theme = localStorage.getItem('theme') || 'default';
    const themeSelect = document.getElementById('theme-select');
    
    if (themeSelect) {
        themeSelect.value = theme;
        document.body.className = theme;
    }
    
    // Load board color
    const boardColor = localStorage.getItem('boardColor') || '#6e8efb';
    const boardColorInput = document.getElementById('board-color');
    
    if (boardColorInput) {
        boardColorInput.value = boardColor;
    }
    
    // Load default names
    const defaultXName = localStorage.getItem('defaultXName') || 'Player X';
    const defaultOName = localStorage.getItem('defaultOName') || 'Player O';
    const defaultXNameInput = document.getElementById('default-x-name');
    const defaultONameInput = document.getElementById('default-o-name');
    
    if (defaultXNameInput) defaultXNameInput.value = defaultXName;
    if (defaultONameInput) defaultONameInput.value = defaultOName;
}

function saveSettings() {
    // Save music volume
    const musicVolume = document.getElementById('music-volume').value;
    localStorage.setItem('musicVolume', musicVolume);
    
    // Update background music volume if it exists
    const backgroundMusic = document.getElementById('background-music');
    if (backgroundMusic) {
        backgroundMusic.volume = musicVolume / 100;
    }
    
    // Save SFX volume
    const sfxVolume = document.getElementById('sfx-volume').value;
    localStorage.setItem('sfxVolume', sfxVolume);
    
    // Save theme
    const theme = document.getElementById('theme-select').value;
    localStorage.setItem('theme', theme);
    document.body.className = theme;
    
    // Save board color
    const boardColor = document.getElementById('board-color').value;
    localStorage.setItem('boardColor', boardColor);
    
    // Save default names
    const defaultXName = document.getElementById('default-x-name').value;
    const defaultOName = document.getElementById('default-o-name').value;
    localStorage.setItem('defaultXName', defaultXName);
    localStorage.setItem('defaultOName', defaultOName);
    
    alert('Settings saved successfully!');
}

function resetSettings() {
    if (confirm('Are you sure you want to reset all settings to default?')) {
        localStorage.removeItem('musicVolume');
        localStorage.removeItem('sfxVolume');
        localStorage.removeItem('theme');
        localStorage.removeItem('boardColor');
        localStorage.removeItem('defaultXName');
        localStorage.removeItem('defaultOName');
        
        loadSettings();
        alert('Settings reset to defaults!');
    }
}

// Add to the initGame function in script.js
function updatePlayerTurnHighlight() {
    const currentPlayerEl = document.querySelector('.current-player');
    if (currentPlayerEl) {
        // Remove all color classes
        currentPlayerEl.classList.remove('x-turn', 'o-turn');
        
        // Add appropriate class
        if (currentPlayer === 'X') {
            currentPlayerEl.classList.add('x-turn');
        } else {
            currentPlayerEl.classList.add('o-turn');
        }
    }
}

// Then call this function whenever the player changes
// In the changePlayer function, add:
updatePlayerTurnHighlight();