# Alexo

Alexo is a weather dashboard styled with a Windows 95 aesthetic, designed to run on a 3.5" screen powered by a Raspberry Pi Zero. It displays current weather, daily forecasts, calendar, and messages with real-time updates via WebSocket.

./video.mp4

## Features

- **Weather Information**: Displays current weather and a 5-day forecast using the Open-Meteo API
- **Pixelated Clock**: A retro-style clock rendered on a canvas
- **Calendar View**: Visual calendar interface
- **Message Screen**: Real-time message display with NFC integration
- **WebSocket Communication**: Real-time updates between frontend and backend
- **Windows 95 Theme**: Styled using [`@react95/core`](https://react95.github.io/React95/) and custom CSS
- **Optimized for Small Screens**: Designed to fit and function on a 3.5" display

## Architecture

The project is structured as a monorepo with two main components:

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 4
- **Styling**: Tailwind CSS + React95 components
- **Routing**: React Router v6
- **Key Libraries**:
  - `@react95/core` & `@react95/icons` - Windows 95 UI components

### Backend
- **Runtime**: Node.js (v14.x)
- **Framework**: Express.js
- **WebSocket**: ws library for real-time communication
- **API Endpoints**:
  - `POST /api/nfc` - Receive NFC messages and broadcast via WebSocket

## Getting Started

### Prerequisites

- Node.js (v14.15.1 or higher)
- npm (v6.14.8 or higher)
- Raspberry Pi Zero with a 3.5" screen (for deployment)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/ggdaltoso/alexo.git
   cd alexo
   ```

2. Install dependencies for the root project:
   ```bash
   npm install
   ```

3. Install frontend dependencies:
   ```bash
   cd frontend
   npm install
   cd ..
   ```

4. Install backend dependencies:
   ```bash
   cd backend
   npm install
   cd ..
   ```

### Development

Run both frontend and backend in development mode:

```bash
npm run dev
```

This will start:
- **Backend** on `http://localhost:3001` (WebSocket server + API)
- **Frontend** on `http://localhost:5173` (Vite dev server)

Or run them separately:

```bash
# Frontend only
npm run dev:frontend

# Backend only
npm run dev:backend
```

### Build and Deploy to Raspberry Pi

1. Build the frontend for production:
   ```bash
   npm run build
   ```
   This generates optimized files in the `frontend/dist` directory.

2. Copy the frontend build to your Raspberry Pi Zero:
   ```bash
   scp -r frontend/dist/ pi@<raspberry-pi-ip>:/home/pi/alexo
   ```

3. Copy the backend to your Raspberry Pi Zero:
   ```bash
   scp -r backend/ pi@<raspberry-pi-ip>:/home/pi/alexo-backend
   ```

4. On the Raspberry Pi, install backend dependencies and start the server:
   ```bash
   ssh pi@<raspberry-pi-ip>
   cd /home/pi/alexo-backend
   npm install
   node server.js
   ```

5. Run Chromium browser in kiosk mode to display the frontend:
   ```bash
   chromium-browser --kiosk --incognito --disable-infobars /home/pi/alexo/dist/index.html
   ```


#### Optional: Create Systemd Services to Run on Boot

To automatically launch both the backend and frontend on boot, create systemd services:

##### Backend Service

1. Create a backend service file:
   ```bash
   sudo nano /etc/systemd/system/alexo-backend.service
   ```

2. Add the following content:
   ```ini
   [Unit]
   Description=Alexo Backend Server
   After=network-online.target
   Requires=network-online.target

   [Service]
   Type=simple
   User=pi
   WorkingDirectory=/home/pi/alexo-backend
   ExecStart=/usr/bin/node server.js
   Restart=always
   RestartSec=10

   [Install]
   WantedBy=multi-user.target
   ```

3. Enable and start the backend service:
   ```bash
   sudo systemctl enable alexo-backend.service
   sudo systemctl start alexo-backend.service
   ```

##### Frontend Service

1. Create a frontend service file:
   ```bash
   sudo nano /etc/systemd/system/alexo-frontend.service
   ```

2. Add the following content:
   ```ini
   [Unit]
   Description=Alexo Frontend Display
   After=graphical.target alexo-backend.service
   Requires=alexo-backend.service

   [Service]
   User=pi
   ExecStart=/usr/bin/chromium-browser --kiosk --incognito --disable-infobars /home/pi/alexo/dist/index.html
   Environment=DISPLAY=:0
   Restart=always
   RestartSec=10

   [Install]
   WantedBy=graphical.target
   ```

3. Enable and start the frontend service:
   ```bash
   sudo systemctl enable alexo-frontend.service
   sudo systemctl start alexo-frontend.service
   ```

## API Reference

### Backend Endpoints

#### POST /api/nfc
Receives NFC messages and broadcasts them to all connected WebSocket clients.

**Request Body:**
```json
{
  "type": "string",
  "message": "string"
}
```

**Response:**
```json
{
  "ok": true
}
```

### WebSocket Connection

The backend runs a WebSocket server on the same port as the HTTP server (default: 3001).

**Connection URL:** `ws://localhost:3001`

**Message Format:**
```json
{
  "type": "string",
  "message": "string",
  "timestamp": 1234567890
}
```

## Project Structure

```
alexo/
├── frontend/              # React frontend application
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── screens/      # Main screen components
│   │   ├── contexts/     # React contexts
│   │   ├── hooks/        # Custom React hooks
│   │   ├── services/     # API and WebSocket services
│   │   └── config/       # Configuration files
│   └── dist/             # Production build output
├── backend/              # Express.js backend server
│   ├── server.js         # Main server file
│   ├── ws.js             # WebSocket server logic
│   └── state.js          # Application state management
└── package.json          # Root package configuration
```

## License

This project is licensed under the MIT License.

## Useful Commands

Here are some helpful commands for managing and debugging Alexo on the Raspberry Pi:

### Systemd Services

- **Check backend service logs in real-time**
  ```bash
  journalctl -u alexo-backend.service -f
  ```

- **Check frontend service logs in real-time**
  ```bash
  journalctl -u alexo-frontend.service -f
  ```

- **Restart services**
  ```bash
  sudo systemctl restart alexo-backend.service
  sudo systemctl restart alexo-frontend.service
  ```

- **Stop services**
  ```bash
  sudo systemctl stop alexo-backend.service
  sudo systemctl stop alexo-frontend.service
  ```

- **Check service status**
  ```bash
  sudo systemctl status alexo-backend.service
  sudo systemctl status alexo-frontend.service
  ```

  ```bash
  sudo systemctl stop alexo.service
  ```

- **Enable the service to start on boot**
  ```bash
  sudo systemctl enable alexo.service
  ```

- **Disable the service**
  ```bash
  sudo systemctl disable alexo.service
  ```