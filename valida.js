const API = "http://localhost:3000";

async function register() {
  const usuario = document.getElementById("usuario").value;
  const email = document.getElementById("email").value;
  const senha = document.getElementById("senha").value;

  const res = await fetch(API + "/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usuario, email, senha })
  });

  const data = await res.json();
  alert(data.message);
}


async function login() {
    const API = "http://localhost:3000";

    
    const email = document.getElementById("loginEmail").value;
    const senha = document.getElementById("loginSenha").value;

    const res = await fetch(API + "/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha })
    });

    const data = await res.json();
    alert(data.message);
}

