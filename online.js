// Online multiplayer functionality
document.addEventListener('DOMContentLoaded', () => {
    const socket = io('https://tic-tac-toe-y8ex.onrender.com', {
        transports: ['websocket', 'polling'],
        timeout: 10000,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
    });
    
    // Game state variables
    let board = ['', '', '', '', '', '', '', '', ''];
    let currentPlayer = 'X';
    let gameActive = false;
    let playerSymbol = '';
    let roomId = '';
    let playerName = '';
    let opponentName = '';
    
    // DOM elements
    const onlineGame = document.getElementById('online-game');
    const waitingScreen = document.getElementById('waiting-screen');
    const createRoomBtn = document.getElementById('create-room-btn');
    const joinRoomBtn = document.getElementById('join-room-btn');
    const cancelWaitingBtn = document.getElementById('cancel-waiting-btn');
    const leaveRoomBtn = document.getElementById('leave-room-btn');
    const playAgainBtn = document.getElementById('online-play-again-btn');
    const roomIdInput = document.getElementById('room-id-input');
    const roomIdDisplay = document.getElementById('room-id-display');
    const waitingRoomId = document.getElementById('waiting-room-id');
    const playerNameInput = document.getElementById('online-player-name');
    const currentPlayerName = document.getElementById('current-player-name');
    const opponentNameDisplay = document.getElementById('opponent-name');
    const playerSymbolDisplay = document.getElementById('player-symbol');
    const opponentSymbolDisplay = document.getElementById('opponent-symbol');
    const playerTurnText = document.getElementById('online-player-turn');
    const resultModal = document.getElementById('online-result-modal');
    const resultMessage = document.getElementById('online-result-message');
    const cells = document.querySelectorAll('.cell');
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
        // Clear all cells
        cells.forEach(cell => {
            cell.textContent = '';
            cell.classList.remove('x', 'o');
            cell.addEventListener('click', handleCellClick);
        });
        
        if (leaveRoomBtn) leaveRoomBtn.addEventListener('click', leaveRoom);
        if (playAgainBtn) playAgainBtn.addEventListener('click', requestPlayAgain);
        if (cancelWaitingBtn) cancelWaitingBtn.addEventListener('click', cancelWaiting);
        
        // Player name input
        if (playerNameInput) {
            playerNameInput.addEventListener('input', updatePlayerName);
            playerName = playerNameInput.value || 'Player';
            currentPlayerName.textContent = playerName;
        }
        
        // Connection status indicators
        socket.on('connect', () => {
            console.log('✅ Connected to server');
            updateConnectionStatus('connected');
        });
        
        socket.on('disconnect', () => {
            console.log('❌ Disconnected from server');
            updateConnectionStatus('disconnected');
        });
        
        socket.on('connect_error', (error) => {
            console.log('❌ Connection error:', error);
            updateConnectionStatus('error');
            
            // Try to reconnect after 3 seconds
            setTimeout(() => {
                console.log('⟳ Attempting to reconnect...');
                socket.connect();
            }, 3000);
        });
    }
    
    // Update connection status UI
    function updateConnectionStatus(status) {
        const statusElement = document.getElementById('connection-status') || createStatusElement();
        
        switch(status) {
            case 'connected':
                statusElement.textContent = 'Connected ✓';
                statusElement.style.color = 'green';
                statusElement.style.background = 'rgba(0, 255, 0, 0.1)';
                break;
            case 'disconnected':
                statusElement.textContent = 'Disconnected ✗';
                statusElement.style.color = 'red';
                statusElement.style.background = 'rgba(255, 0, 0, 0.1)';
                break;
            case 'error':
                statusElement.textContent = 'Connection Error ⟳';
                statusElement.style.color = 'orange';
                statusElement.style.background = 'rgba(255, 165, 0, 0.1)';
                break;
        }
    }
    
    // Create connection status element if it doesn't exist
    function createStatusElement() {
        const statusElement = document.createElement('div');
        statusElement.id = 'connection-status';
        statusElement.style.position = 'fixed';
        statusElement.style.top = '10px';
        statusElement.style.right = '10px';
        statusElement.style.padding = '5px 10px';
        statusElement.style.background = 'rgba(0, 0, 0, 0.7)';
        statusElement.style.color = 'white';
        statusElement.style.borderRadius = '5px';
        statusElement.style.zIndex = '1000';
        statusElement.style.fontSize = '12px';
        statusElement.style.fontWeight = 'bold';
        document.body.appendChild(statusElement);
        return statusElement;
    }
    
    // Update player name
    function updatePlayerName() {
        playerName = playerNameInput.value || 'Player';
        currentPlayerName.textContent = playerName;
        
        // Send name update to server
        if (roomId) {
            socket.emit('updateName', { roomId, playerName });
        }
    }
    
    // Create room
    if (createRoomBtn) {
        createRoomBtn.addEventListener('click', () => {
            playerName = playerNameInput.value || 'Player';
            socket.emit('createRoom', { playerName });
            showWaitingScreen();
        });
    }
    
    // Join room
    if (joinRoomBtn) {
        joinRoomBtn.addEventListener('click', () => {
            const roomCode = roomIdInput.value.trim().toUpperCase();
            if (roomCode.length >= 4) {
                playerName = playerNameInput.value || 'Player';
                socket.emit('joinRoom', { roomId: roomCode, playerName });
                showWaitingScreen();
            } else {
                alert('Please enter a valid room ID (at least 4 characters)');
            }
        });
    }
    
    // Show waiting screen
    function showWaitingScreen() {
        if (waitingScreen) waitingScreen.classList.remove('hidden');
        if (onlineGame) onlineGame.classList.add('hidden');
    }
    
    // Hide waiting screen
    function hideWaitingScreen() {
        if (waitingScreen) waitingScreen.classList.add('hidden');
        if (onlineGame) onlineGame.classList.remove('hidden');
    }
    
    // Cancel waiting
    function cancelWaiting() {
        if (roomId) {
            socket.emit('leaveRoom', { roomId });
            roomId = '';
        }
        hideWaitingScreen();
    }
    
    // Leave room
    function leaveRoom() {
        if (roomId) {
            socket.emit('leaveRoom', { roomId });
            roomId = '';
        }
        if (onlineGame) onlineGame.classList.add('hidden');
        resetGame();
    }
    
    // Handle cell click - FIXED VERSION
    function handleCellClick(e) {
        if (!gameActive || currentPlayer !== playerSymbol) return;
        
        const cell = e.target;
        const cellIndex = parseInt(cell.getAttribute('data-cell-index'));
        
        // Check if cell is already played
        if (board[cellIndex] !== '') {
            return;
        }
        
        // Play sound
        if (clickSound) {
            clickSound.currentTime = 0;
            clickSound.play();
        }
        
        // ✅ IMMEDIATE UI UPDATE (Instant feedback)
        cell.textContent = currentPlayer;
        cell.classList.add(currentPlayer.toLowerCase());
        board[cellIndex] = currentPlayer;
        
        // Send move to server
        socket.emit('makeMove', { roomId, cellIndex });
        
        // ✅ Temporary disable to prevent double clicks
        gameActive = false;
        setTimeout(() => {
            gameActive = true;
        }, 300);
    }
    
    // Make a move - FIXED VERSION
    function makeMove(cellIndex, symbol) {
        // Update board state
        board[cellIndex] = symbol;
        
        // Update UI
        const cell = document.querySelector(`[data-cell-index="${cellIndex}"]`);
        if (cell) {
            cell.textContent = symbol;
            cell.classList.add(symbol.toLowerCase());
        }
        
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
            
            // Play win sound
            if (winSound) {
                winSound.currentTime = 0;
                winSound.play();
            }
            
            // Show result message
            const winnerName = currentPlayer === 'X' ? 
                (currentPlayer === playerSymbol ? playerName : opponentName) : 
                (currentPlayer === playerSymbol ? playerName : opponentName);
                
            showResult(`${winnerName} wins!`);
            return;
        }
        
        // Check for draw
        const roundDraw = !board.includes('');
        if (roundDraw) {
            gameActive = false;
            
            // Play draw sound
            if (drawSound) {
                drawSound.currentTime = 0;
                drawSound.play();
            }
            
            showResult("Game ended in a draw!");
            return;
        }
        
        // Continue game with next player
        changePlayer();
    }
    
    // Display winning line
    function displayWinningLine(combo) {
        if (!winningLine) return;
        
        const [a, b, c] = combo;
        const cellSize = cells[0].offsetWidth;
        
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
        if (playerTurnText) {
            if (currentPlayer === playerSymbol) {
                playerTurnText.textContent = "Your Turn";
            } else {
                playerTurnText.textContent = "Opponent's Turn";
            }
        }
    }
    
    // Show result modal
    function showResult(message) {
        if (resultModal && resultMessage) {
            resultMessage.textContent = message;
            resultModal.classList.add('active');
        }
    }
    
    // Request play again
    function requestPlayAgain() {
        socket.emit('playAgain', { roomId });
        if (resultModal) resultModal.classList.remove('active');
    }
    
    // Reset game board - FIXED VERSION
    function resetGame() {
        board = ['', '', '', '', '', '', '', '', ''];
        gameActive = true;
        currentPlayer = 'X';
        
        // Clear all cells
        cells.forEach(cell => {
            cell.textContent = '';
            cell.classList.remove('x', 'o');
        });
        
        if (winningLine) {
            winningLine.style.opacity = '0';
            winningLine.style.transform = 'none';
        }
        
        updateStatus();
    }
    
    // Socket event handlers - FIXED VERSION
    socket.on('roomCreated', (data) => {
        roomId = data.roomId;
        playerSymbol = 'X';
        if (playerSymbolDisplay) playerSymbolDisplay.textContent = 'X';
        if (opponentSymbolDisplay) opponentSymbolDisplay.textContent = 'O';
        if (roomIdDisplay) roomIdDisplay.textContent = roomId;
        if (waitingRoomId) waitingRoomId.textContent = roomId;
    });
    
    socket.on('roomJoined', (data) => {
        roomId = data.roomId;
        playerSymbol = 'O';
        if (playerSymbolDisplay) playerSymbolDisplay.textContent = 'O';
        if (opponentSymbolDisplay) opponentSymbolDisplay.textContent = 'X';
        opponentName = data.opponentName;
        if (opponentNameDisplay) opponentNameDisplay.textContent = opponentName;
        if (roomIdDisplay) roomIdDisplay.textContent = roomId;
        
        hideWaitingScreen();
        gameActive = true;
        updateStatus();
    });
    
    socket.on('playerJoined', (data) => {
        opponentName = data.playerName;
        if (opponentNameDisplay) opponentNameDisplay.textContent = opponentName;
        
        hideWaitingScreen();
        gameActive = true;
        updateStatus();
    });
    
    socket.on('moveMade', (data) => {
        console.log('Move received from server:', data);
        makeMove(data.cellIndex, data.symbol);
    });
    
    socket.on('playerLeft', () => {
        alert('Your opponent has left the game.');
        if (onlineGame) onlineGame.classList.add('hidden');
        resetGame();
    });
    
    socket.on('playAgain', () => {
        resetGame();
    });
    
    socket.on('error', (data) => {
        alert(data.message);
        hideWaitingScreen();
    });
    
    // Initialize the game
    initGame();
});
