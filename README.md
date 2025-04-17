# Alexo

Alexo is a weather dashboard styled with a Windows 95 aesthetic, designed to run on a 3.5" screen powered by a Raspberry Pi Zero. It displays current weather, daily forecasts, world clocks, and battery status.

<div align="center">
  <img src="./screenshot.png" alt="Alexo Screenshot" />
</div>

## Features

- **Weather Information**: Displays current weather and a 5-day forecast using the Open-Meteo API.
- **World Clocks**: Shows the current time in multiple time zones.
- **Battery Indicator**: Displays the device's battery status.
- **Pixelated Clock**: A retro-style clock rendered on a canvas.
- **Windows 95 Theme**: Styled using [`@react95/core`](https://react95.github.io/React95/) and custom CSS.
- **Optimized for Small Screens**: Designed to fit and function on a 3.5" display.

## Getting Started

### Prerequisites

- Node.js (v14.15.1)
- npm (v6.14.8)
- Raspberry Pi Zero with a 3.5" screen

### Build and Deploy to Raspberry Pi

1. Build the project for production:
   ```bash
   npm run build
   ```
   This process will generate a single index.html file along with other assets in the dist directory.
2. Copy and paste the output into your Raspberry Pi Zero. You can use scp for this:
   ```bash
   scp -r dist/ pi@<raspberry-pi-ip>:/home/pi/alexo
   ```
3. Run chromium-browser in kiosk mode on the Raspberry Pi:
   ```bash
   chromium-browser --kiosk --incognito --disable-infobars /home/pi/alexo/dist/index.html
   ```

#### Optional: Create a Service to Run on Boot

To automatically launch the app on boot, create a systemd service:

1. Create a new service file:
   ```bash
   sudo nano /etc/systemd/system/alexo.service
   ```
2. Add the following content to the file:

   ```[Unit]
   Description=Show Alexo on Chromium
   After=graphical.target
   Requires=network-online.target

   [Service]
   User=pi
   ExecStart=chromium-browser --kiosk --incognito --disable-infobars /home/pi/alexo/dist/index.html
   Environment=DISPLAY=:0
   Restart=always

   [Install]
   WantedBy=graphical.target
   ```

3. Save and close the file.
4. Enable the service:

```bash
sudo systemctl enable alexo.service
```

5. Start the service:
   ```bash
   sudo systemctl start alexo.service
   ```

### License

This project is licensed under the MIT License.
