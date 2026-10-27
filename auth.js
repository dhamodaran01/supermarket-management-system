/*
DETAILED CMD-STYLE LEARNING TRACE — js/auth.js
Purpose: Add behaviour to index.html. This file sends requests to the Java backend.

JS STEP 01> Browser loads this file because index.html has <script src="js/auth.js" defer>.
JS STEP 02> document.getElementById(...) finds the form and its fields by their IDs.
JS STEP 03> updateAuthButton() reads the hidden action and role values and updates button text.
JS STEP 04> The role-button event listeners wait for Admin/Staff clicks.
JS STEP 05> On a role click, JavaScript removes the old active class, marks the clicked role active,
            stores its data-role value in the hidden role input and updates the button text.
JS STEP 06> switchAuth(action) changes the hidden action to login/register, updates the active tab,
            refreshes button text and clears the old status message.
JS STEP 07> The form's submit event listener runs when the user submits the form.
JS STEP 08> event.preventDefault() stops the browser's normal form navigation so JavaScript can
            submit the request and handle the response.
JS STEP 09> The script shows a waiting message and disables the submit button to reduce double clicks.
JS STEP 10> The script collects action, role, username, email and password into request data.
JS STEP 11> fetch(...) sends the request to the configured authentication endpoint (api/auth).
JS STEP 12> The Java backend processes the request and returns a response, normally JSON.
JS STEP 13> JavaScript reads that response. If successful, it can redirect to dashboard.html;
            if unsuccessful, it displays an error message in #authMessage.
JS STEP 14> catch handles request/network errors, and finally-style cleanup (if present in the
            implementation) restores the button state.

HOW TO EXPLAIN:
HTML supplies the form and IDs; CSS styles them; this JavaScript responds to user actions.
The browser does not connect directly to MySQL. The Java backend handles database operations.
These JS STEP lines are comments for learning, not commands to type into CMD.
*/

/*
COMMAND-LINE FLOW: index.html -> css/index.css -> js/auth.js
-> user selects Admin/Staff and Login/Register -> submit event
-> POST api/auth -> Java authentication endpoint -> JSON response
-> success: dashboard.html | failure: show #authMessage.
Functions: updateAuthButton() synchronizes button text; switchAuth(action) switches the
login/register tab; role click handlers update the selected role; the submit listener sends
credentials and handles the response. This file sends requests; it does not query MySQL.
Detailed trace: FRONTEND_EXECUTION_FLOW.md
*/
// JS SECTION: Find the HTML elements this script controls.
const form = document.getElementById('authForm');
const actionEl = document.getElementById('action');
const roleEl = document.getElementById('role');
const usernameEl = document.getElementById('username');
const emailEl = document.getElementById('email');
const passwordEl = document.getElementById('password');
const authButton = document.getElementById('authButton');
const authMessage = document.getElementById('authMessage');

function updateAuthButton(){
    const action = actionEl.value;
    const role = roleEl.value;
    authButton.textContent = (action === 'login' ? 'Login as ' : 'Register as ') + role.charAt(0).toUpperCase() + role.slice(1);
}

document.querySelectorAll('.role').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.role').forEach(x => x.classList.remove('active'));
        button.classList.add('active');
        roleEl.value = button.dataset.role;
        updateAuthButton();
    });
});

function switchAuth(action){
    actionEl.value = action;
    document.querySelectorAll('.tab').forEach((x,i) => x.classList.toggle('active', action === 'login' ? i === 0 : i === 1));
    updateAuthButton();
    authMessage.textContent = '';
    authMessage.className = 'message';
}

form.addEventListener('submit', async (event) => {
    event.preventDefault();
    authMessage.textContent = 'Please wait...';
    authMessage.className = 'message';
    authButton.disabled = true;
    try {
        const body = new URLSearchParams({action:actionEl.value,role:roleEl.value,username:usernameEl.value.trim(),email:emailEl.value.trim(),password:passwordEl.value});
        const data = await window.supermartLocalApi('auth',{method:'POST',body});
        authMessage.textContent = data.message || 'Success';
        authMessage.className = 'message ok';
        setTimeout(() => { window.location.href = 'dashboard.html'; }, 100);
    } catch (error) {
        console.error('Authentication error:', error);
        authMessage.textContent = error.message || 'Unable to continue.';
        authMessage.className = 'message error';
        authButton.disabled = false;
    }
});

updateAuthButton();
