# Frontend Open Steps

## Current Preview URL

The frontend is served locally at:

```text
http://127.0.0.1:5173
```

## Open From PowerShell

1. Go to the frontend folder:

```powershell
cd C:\Users\ROG\Desktop\capstone\frotend
```

2. Start the Vite development server:

```powershell
.\node_modules\.bin\vite.cmd --host 127.0.0.1 --port 5173
```

3. Open the browser:

```powershell
Start-Process http://127.0.0.1:5173
```

## Notes

- Keep the PowerShell window running while viewing the frontend.
- If port `5173` is already in use, change the port, for example:

```powershell
.\node_modules\.bin\vite.cmd --host 127.0.0.1 --port 5174
```

- This frontend is currently optimized for desktop viewing. Use a desktop browser width of at least `1180px`.
