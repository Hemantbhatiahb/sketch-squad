
# Draw & Guess Game

This is a real-time multiplayer drawing and guessing game built with React, TypeScript, and Socket.io.

## Features

- Real-time drawing and chat functionality
- Multi-player rooms
- Turn-based gameplay
- Score tracking
- Customizable game settings
- Responsive design for mobile and desktop

## Frontend Technologies

- React
- TypeScript
- TailwindCSS
- shadcn/ui components
- Socket.io client

## Backend Technologies

- Node.js
- Express
- Socket.io
- File-based JSON storage

## Running the App

### Running the Frontend

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open [http://localhost:5173](http://localhost:5173) in your browser.

### Running the Backend

1. Navigate to the server directory:
```bash
cd server
```

2. Install server dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm run dev
```

The server will run on [http://localhost:3001](http://localhost:3001).

## How to Play

1. Enter your name and create a room
2. Share the room code with friends
3. Wait for players to join
4. Start the game
5. Take turns drawing and guessing
6. Earn points by correctly guessing words
7. The player with the most points at the end wins!

## Game Settings

- **Players**: Maximum number of players allowed in a room
- **Draw Time**: Time limit for each drawing round
- **Rounds**: Total number of rounds in a game
- **Word Count**: Number of words to choose from
- **Hints**: Number of letter hints provided

## License

MIT
