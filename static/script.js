// Kept for backward-compat. Auth logic lives inline in each template.
function signUp() {
    const name     = document.getElementById('signupname').value;
    const email    = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    if (name && email && password) {
        localStorage.setItem('name', name);
        alert("Successfully signed up!");
        window.location.href = '/login';
    } else {
        alert("Please fill in all fields.");
    }
}

function login() {
    const email    = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    if (email && password) {
        alert("Successfully logged in!");
        window.location.href = '/interface';
    } else {
        alert("Please fill in all fields.");
    }
}
