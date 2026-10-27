# SuperMart - Static Supermarket Management System

This is a static HTML, CSS and JavaScript version. Java Servlets, Maven and MySQL dependencies have been removed. App data is saved in the browser's `localStorage`.

## Run locally
1. Extract this ZIP.
2. Open `src/main/webapp/index.html` in a modern browser, or open the folder in VS Code and run it with the Live Server extension.
3. Sign in with the default account below, or use Register to create a staff account.

## Default login
- Role: Admin
- Username: `admin`
- Password: `admin123`

## Deploy to Vercel
1. Upload the contents of `src/main/webapp` to a GitHub repository (the `index.html` file should be at the repository root).
2. Import the repository in Vercel.
3. Select the Other framework preset and leave the build command empty; use `.` as the output directory if requested.
4. Deploy.

## Important limitations
- Data is stored only in the current browser and device. It does not sync between users or computers.
- Clearing browser site data removes saved records.
- This is suitable for a demo or learning project, not secure production use. Browser localStorage is not a secure authentication system; passwords and records can be inspected by the browser user.
- A few advanced reports/counter reconciliation features may have simplified static-mode behavior because the original server-side calculations were removed.
