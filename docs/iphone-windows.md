# iPhone motion controller on Windows (LAN HTTPS)

This workflow uses the existing NestJS server to serve a production React build over HTTPS. The `wss://` control socket shares the HTTPS origin, so there is no separate Vite LAN proxy. It uses an X-Plane 12 native plugin already configured and confirmed to deliver telemetry.

## Preconditions

- Windows computer and iPhone on the **same trusted private Wi-Fi/LAN**. Do not forward any ports to the public internet.
- X-Plane plugin installed and sending native telemetry to the backend (`XPLANE_TRANSPORT=native`).
- Node.js 24, pnpm 12, and the project dependencies installed.
- Windows `mkcert` available. Install it with `winget install -e --id FiloSottile.mkcert` and restart VS Code before running this workflow.
- A real iPhone with Safari; desktop browser emulation does not provide live phone sensors.

## 1. Select your Windows LAN address

In PowerShell:

```powershell
Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notlike '169.254*' -and $_.IPAddress -ne '127.0.0.1' } |
    Select-Object IPAddress, InterfaceAlias
```

Choose the address on the network shared with your iPhone. Do not use the loopback address or a virtual adapter IP. A change in LAN IP requires regenerating the certificate.

## 2. Generate local HTTPS certificates

In the repository root, replace the example IP below with the actual selected IP:

```powershell
.\scripts\setup-iphone-https.ps1 -LanIp 192.168.1.100
```

The script confirms the IP belongs to the computer, generates `certs/cert.pem` and `certs/key.pem`, and updates **only** the HTTPS keys and `XPLANE_OUTPUT_ENABLED=false` in your existing `.env`. It preserves your native shared token and all other settings. It is safe to run again if the address changes.

The trusted development CA is installed on Windows. It is **not** automatically trusted on the iPhone. Transfer only `certs/iphone-root-ca.pem` to your own iPhone (a private file transfer or email to yourself), open the certificate/profile, and install it. Then enable full trust at **Settings > General > About > Certificate Trust Settings**. Do not transfer `rootCA-key.pem` or `certs/key.pem`. Do not commit `.env`, private certificates, or the simulator's `controller.conf`.

**Security:** Installing the development root CA grants broad certificate trust to that CA on your personal iPhone. Use a development-only CA and remove it when testing is complete. Do not share its private key.

## 3. Allow the LAN connection (private network only)

If Windows Firewall blocks the incoming connection, open an elevated PowerShell and add a narrow inbound rule (replace the port if changed):

```powershell
New-NetFirewallRule -DisplayName 'XPlaneMotionController HTTPS LAN' `
    -Direction Inbound -Protocol TCP -LocalPort 8443 -Action Allow `
    -Profile Private -RemoteAddress LocalSubnet
```

Only enable the rule on networks you trust. This application is not intended to be publicly accessible. The pairing code is separate from the native plugin shared secret.

## 4. Serve the web UI with NestJS

Stop existing development servers on ports 3000 or 8443 before starting the HTTPS process. Keep X-Plane running separately.

```powershell
pnpm install
pnpm build
pnpm start:server
```

Open `https://<YOUR_LAN_IP>:8443/?view=mobile` **in iPhone Safari**. The URL must exactly match the IP included in the certificate. If Safari reports a certificate warning, revisit the trust steps rather than bypassing the warning. With proper trust, the WebSocket should connect automatically via `wss://`.

If the UI loads without live data, check whether iPhone and Windows are on the same LAN, firewall policy, and the `HOST`, `PORT`, `TLS_CERT_FILE`, `TLS_KEY_FILE` values in `.env`.

## 5. First test with simulator output disabled

Keep `XPLANE_OUTPUT_ENABLED=false`. On the phone, tap **ENABLE MOTION** to request sensor access, hold the phone in a comfortable landscape position, and tap **RECENTER**. Watch the roll/pitch command indicators while tilting the phone slowly. Open settings to enter the six-digit pairing code printed by NestJS, then tap **ARM CONTROL**. The phone should display **MOTION PREVIEW ONLY**. The desktop diagnostics should show the phone sensor rate and input frame rate while X-Plane remains unaffected.

Check both axis directions and the zero point before attempting any simulator control. Neither the displayed phone command nor server pairing alone proves the plugin has acquired flight-axis ownership.

## 6. Controlled simulator output test (only after read-only checks)

Stop NestJS. With a default light aircraft parked on the ground or paused in a safe test scenario, set `XPLANE_OUTPUT_ENABLED=true` in `.env`, then restart `pnpm start:server`. Recenter the phone and arm it again. The UI should show **WAITING FOR SIM ARM** until the plugin's telemetry confirms override ownership, then **SIM CONTROL CONFIRMED**.

If the native plugin does not acknowledge the override within approximately 900 ms, or later reports losing it, the server releases the phone controller and displays a warning. The separate 350 ms frame watchdog still applies. Disarm immediately after each test. Verify simulator yoke response, axis polarity, and release on interruption before making any actual flight test.

In the control gateway, the old UDP fallback is explicitly **unverified**, because it does not expose native override acknowledgement. Avoid relying on that mode for these safety checks.

## Verify and diagnose

```powershell
pnpm typecheck
pnpm test
pnpm build
```

When you can access the app from the phone but motion remains offline, verify the secure-context requirement, Safari motion permission, and that the phone is supplying numeric `deviceorientation` events. The UI reports an error if no samples arrive after three seconds.

When the connection works but the simulator ignores controls, check that `XPLANE_OUTPUT_ENABLED` is explicitly enabled, no competing plugin has taken joystick override, and the native-control row in desktop diagnostics shows the plugin is armed.

HTTPS traffic is encrypted, but the local native UDP plugin link remains authenticated and IP-filtered **without encryption**. Keep its ports limited to the trusted local machine or network. Avoid exposing the NestJS HTTPS service or native UDP ports to the internet.
